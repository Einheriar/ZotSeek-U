import './helpers/zotero-stub';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { autoIndexManager } from '../src/core/auto-index-manager';
import { indexFreshnessTracker } from '../src/core/index-freshness';
import { textExtractor } from '../src/core/text-extractor';
import type { StartupFingerprint, TextSourceType } from '../src/core/vector-store-sqlite';

type FakePaper = ReturnType<typeof createPaper>;

function createPaper(id: number) {
  const suffix = String(id).padStart(7, '0');
  return {
    id,
    key: `P${suffix}`,
    libraryID: 1,
    parentID: null,
    deleted: false,
    itemType: 'journalArticle',
    dateModified: '2026-08-30 10:00:00',
    title: `Title ${id}`,
    abstract: `Abstract ${id}`,
    noteID: 1000 + id,
    noteText: `Note ${id}`,
    noteVersion: 1,
    noteModified: '2026-08-30 10:00:00',
    getField(field: string) {
      if (field === 'title') return this.title;
      if (field === 'abstractNote') return this.abstract;
      return '';
    },
    getTags: () => [],
    getNotes() { return [this.noteID]; },
    isRegularItem: () => true,
    isNote: () => false,
    isAttachment: () => false,
  };
}

function createNote(paper: FakePaper) {
  return {
    id: paper.noteID,
    key: `N${String(paper.id).padStart(7, '0')}`,
    libraryID: 1,
    parentID: paper.id,
    deleted: false,
    get version() { return paper.noteVersion; },
    get dateModified() { return paper.noteModified; },
    isNote: () => true,
    getNote: () => paper.noteText,
  };
}

describe('scoped index reconciliation', () => {
  test('checks 150 supplied papers but sends only the changed parent to Note update', async () => {
    const zotero = installZoteroStub({
      'zotseek.indexingMode': 'notes',
      'zotseek.embeddingModel': 'multilingual-e5-base',
      'zotseek.maxChunksPerPaper': 100,
      'zotseek.excludeBooks': false,
      'zotseek.excludeTag': '',
    });
    const papers = Array.from({ length: 150 }, (_, index) => createPaper(index + 1));
    const paperByKey = new Map(papers.map(paper => [paper.key, paper]));
    const notes = new Map(papers.map(paper => [paper.noteID, createNote(paper)]));
    zotero.Libraries = {
      userLibraryID: 1,
      get: (libraryID: number) => libraryID === 1
        ? { libraryID: 1, libraryType: 'user' }
        : null,
    };
    zotero.Items = {
      get: (id: number) => papers.find(paper => paper.id === id) || notes.get(id) || null,
      getAsync: async (ids: number[]) => ids.map(id => notes.get(id)).filter(Boolean),
    };

    const fingerprints = new Map<string, StartupFingerprint>();
    const store = {
      getIndexedIdentities: async () => papers.map(paper => ({
        libraryKey: 'user',
        itemKey: paper.key,
      })),
      getStartupFingerprint: async (libraryKey: string, itemKey: string, modelId: string) =>
        fingerprints.get(`${libraryKey}\u0000${itemKey}\u0000${modelId}`) || null,
      setStartupFingerprint: async (fingerprint: StartupFingerprint) => {
        fingerprints.set(
          `${fingerprint.libraryKey}\u0000${fingerprint.itemKey}\u0000${fingerprint.modelId}`,
          fingerprint,
        );
      },
      getChunkTextsBySources: async (
        _libraryKey: string,
        itemKey: string,
        sources: TextSourceType[],
      ) => {
        const paper = paperByKey.get(itemKey)!;
        return sources.includes('note')
          ? [paper.noteText]
          : [`Summary ${paper.id}`];
      },
    };

    const originalExtract = textExtractor.extractChunksFromItem;
    (textExtractor as any).extractChunksFromItem = async (paper: FakePaper) => ({
      chunks: [
        { type: 'summary', text: `Summary ${paper.id}` },
        { type: 'note', text: paper.noteText },
      ],
      wasTruncated: false,
    });
    autoIndexManager.setVectorStore(store);

    try {
      const baseline = await autoIndexManager.reconcileItems(papers, {
        allowWrites: false,
      });
      assert.equal(baseline.checked, 150);
      assert.equal(baseline.baselined, 150);
      assert.equal(fingerprints.size, 150);

      // Zotero may bump Note version/date even when normalization produces the
      // same indexed text. That advances only the fingerprint baseline.
      const stateOnly = papers[0];
      stateOnly.noteVersion++;
      stateOnly.noteModified = '2026-08-31 08:59:00';
      const stateOnlyResult = await autoIndexManager.reconcileItems([stateOnly], {
        fullIndexCallback: async () => { throw new Error('unexpected full rebuild'); },
        noteIndexCallback: async () => { throw new Error('unexpected Note embedding'); },
      });
      assert.equal(stateOnlyResult.checked, 1);
      assert.equal(stateOnlyResult.baselined, 1);
      assert.equal(stateOnlyResult.notesUpdated, 0);

      const changed = papers[72];
      changed.noteText = 'Changed Note 73';
      changed.noteVersion++;
      changed.noteModified = '2026-08-31 09:00:00';

      const fullCalls: number[][] = [];
      const noteCalls: number[][] = [];
      const result = await autoIndexManager.reconcileItems(papers, {
        fullIndexCallback: async candidates => {
          fullCalls.push(candidates.map(item => item.id));
          return candidates.map(item => item.id);
        },
        noteIndexCallback: async candidates => {
          noteCalls.push(candidates.map(item => item.id));
          return candidates.map(item => item.id);
        },
      });

      assert.equal(result.checked, 150);
      assert.equal(result.notesUpdated, 1);
      assert.equal(result.unchanged, 149);
      assert.equal(result.failed, 0);
      assert.deepEqual(fullCalls, []);
      assert.deepEqual(noteCalls, [[73]]);
      assert.equal(indexFreshnessTracker.isDirty({
        libraryKey: 'user',
        itemKey: changed.key,
      }), false);

      // The selected-item entry point supplies exactly one parent, so a later
      // Note edit must not pull any of the other 149 papers back into scope.
      changed.noteText = 'Changed Note 73 again';
      changed.noteVersion++;
      changed.noteModified = '2026-08-31 09:00:30';
      const selectedCalls: number[][] = [];
      const selectedResult = await autoIndexManager.reconcileItems([changed], {
        fullIndexCallback: async () => [],
        noteIndexCallback: async candidates => {
          selectedCalls.push(candidates.map(item => item.id));
          return candidates.map(item => item.id);
        },
      });
      assert.equal(selectedResult.checked, 1);
      assert.equal(selectedResult.notesUpdated, 1);
      assert.deepEqual(selectedCalls, [[73]]);

      const failedPaper = papers[73];
      failedPaper.noteText = 'Changed Note 74';
      failedPaper.noteVersion++;
      failedPaper.noteModified = '2026-08-31 09:01:00';
      const fingerprintKey = `user\u0000${failedPaper.key}\u0000multilingual-e5-base`;
      const fingerprintBeforeFailure = fingerprints.get(fingerprintKey);
      const failedResult = await autoIndexManager.reconcileItems([failedPaper], {
        fullIndexCallback: async () => [],
        noteIndexCallback: async () => [],
      });

      assert.equal(failedResult.checked, 1);
      assert.equal(failedResult.notesUpdated, 0);
      assert.equal(failedResult.failed, 1);
      assert.equal(failedResult.outdated, 1);
      assert.equal(fingerprints.get(fingerprintKey), fingerprintBeforeFailure);
      assert.equal(indexFreshnessTracker.isDirty({
        libraryKey: 'user',
        itemKey: failedPaper.key,
      }), true);
    } finally {
      (textExtractor as any).extractChunksFromItem = originalExtract;
      autoIndexManager.setVectorStore(null);
      indexFreshnessTracker.clearAll();
    }
  });
});

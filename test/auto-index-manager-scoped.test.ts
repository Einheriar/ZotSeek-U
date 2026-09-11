import './helpers/zotero-stub';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { autoIndexManager } from '../src/core/auto-index-manager';
import {
  indexFreshnessTracker,
  legacyIndexConfigFingerprint,
  metadataFingerprint,
  noteContentFingerprint,
  noteStateFingerprint,
} from '../src/core/index-freshness';
import { modelInputPolicyFingerprint, resolveModelInputPolicy } from '../src/core/model-input-policy';
import { getActiveModel } from '../src/core/model-registry';
import { textExtractor } from '../src/core/text-extractor';
import { CHUNK_STRATEGY_VERSION, getChunkOptionsFromPrefs } from '../src/utils/chunker';
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
    tags: [] as Array<{ tag: string }>,
    getField(field: string) {
      if (field === 'title') return this.title;
      if (field === 'abstractNote') return this.abstract;
      return '';
    },
    getTags() { return this.tags; },
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
  test('fingerprints the same normalized maxChunks value used by extraction', () => {
    const zotero = installZoteroStub({
      'zotseek.embeddingModel': 'multilingual-e5-base',
      'zotseek.maxChunksPerPaper': 0,
    });
    const runtimeMaxChunks = getChunkOptionsFromPrefs(zotero).maxChunks;
    const snapshot = (autoIndexManager as any).getConfigSnapshot('notes');
    assert.equal(runtimeMaxChunks, 1);
    assert.equal(snapshot.maxChunksPerPaper, runtimeMaxChunks);
  });

  test('rebuilds only truncated papers when maxChunksPerPaper is increased', async () => {
    const zotero = installZoteroStub({
      'zotseek.indexScope': 'user',
      'zotseek.indexingMode': 'notes',
      'zotseek.embeddingModel': 'multilingual-e5-base',
      'zotseek.maxChunksPerPaper': 100,
      'zotseek.excludeBooks': false,
      'zotseek.excludeTag': '',
    });
    const papers = [createPaper(1), createPaper(2)];
    const notes = new Map(papers.map(paper => [paper.noteID, createNote(paper)]));
    const paperByKey = new Map(papers.map(paper => [paper.key, paper]));
    zotero.Libraries = {
      userLibraryID: 1,
      get: () => ({ libraryID: 1, libraryType: 'user' }),
    };
    zotero.Items = {
      get: (id: number) => papers.find(paper => paper.id === id) || notes.get(id) || null,
      getAsync: async (ids: number[]) => ids.map(id => notes.get(id)).filter(Boolean),
      getIDFromLibraryAndKey: (_libraryID: number, key: string) =>
        papers.find(paper => paper.key === key)?.id || false,
    };

    const legacyConfigFingerprint = legacyIndexConfigFingerprint({
      indexContractVersion: 4,
      mode: 'notes',
      maxChunksPerPaper: 100,
      chunkStrategyVersion: CHUNK_STRATEGY_VERSION,
      modelInputPolicy: modelInputPolicyFingerprint(resolveModelInputPolicy(
        getActiveModel(),
        zotero.Prefs.get('zotseek.maxTokens', true),
      )),
      pdfSourceIdentityVersion: 0,
    });
    const fingerprints = new Map<string, StartupFingerprint>(papers.map(paper => [
      `user\u0000${paper.key}\u0000multilingual-e5-base`,
      {
        libraryKey: 'user',
        itemKey: paper.key,
        modelId: 'multilingual-e5-base',
        configFingerprint: legacyConfigFingerprint,
        metadataFingerprint: metadataFingerprint(paper),
        noteStateFingerprint: noteStateFingerprint([createNote(paper)], 'notes'),
        noteContentFingerprint: noteContentFingerprint([
          { key: createNote(paper).key, text: paper.noteText },
        ], 'notes'),
        checkedAt: '2026-08-30T00:00:00.000Z',
      },
    ]));
    let fingerprintWrites = 0;
    let failFingerprintFor: string | null = null;
    const truncatedKeys = new Set([papers[0].key]);
    const identities = papers.map(paper => ({ libraryKey: 'user', itemKey: paper.key }));
    const store = {
      getIndexedIdentities: async () => identities,
      getMetadata: async () => 'notes',
      getIndexStatusByIdentity: async (requested: Array<{ libraryKey: string; itemKey: string }>) =>
        new Map(requested.map(identity => [
          `${identity.libraryKey}|${identity.itemKey}`,
          { wasTruncated: truncatedKeys.has(identity.itemKey) },
        ])),
      getStartupFingerprint: async (libraryKey: string, itemKey: string, modelId: string) =>
        fingerprints.get(`${libraryKey}\u0000${itemKey}\u0000${modelId}`) || null,
      setStartupFingerprint: async (fingerprint: StartupFingerprint) => {
        if (fingerprint.itemKey === failFingerprintFor) {
          failFingerprintFor = null;
          throw new Error('fingerprint busy');
        }
        fingerprintWrites++;
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
        return sources.includes('note') ? [paper.noteText] : [`Summary ${paper.id}`];
      },
    };
    autoIndexManager.setVectorStore(store);

    const originalExtract = textExtractor.extractChunksFromItem;
    (textExtractor as any).extractChunksFromItem = async (paper: FakePaper) => ({
      chunks: [
        { type: 'summary', text: `Summary ${paper.id}` },
        { type: 'note', text: paper.noteText },
      ],
      wasTruncated: paper.id === 1,
    });

    try {
      const baseline = await autoIndexManager.reconcileItems(papers, {
        allowWrites: false,
      });
      assert.equal(baseline.baselined, 2);
      assert.equal(fingerprintWrites, 2);

      zotero.Prefs.set('zotseek.maxChunksPerPaper', 101, true);
      autoIndexManager.setItemProvider(async () => papers);
      autoIndexManager.setIndexCallback(async () => []);
      autoIndexManager.setNoteIndexCallback(async () => []);

      let promptedAffected = 0;
      let promptedRebuildRequired = 0;
      autoIndexManager.setStartupConfigChangeCallback(context => {
        promptedAffected = context.affected;
        promptedRebuildRequired = context.rebuildRequired;
        return 'cancel';
      });
      const cancelled = await autoIndexManager.runNow({ promptForConfigChanges: true });
      assert.equal(promptedAffected, 2);
      assert.equal(promptedRebuildRequired, 1);
      assert.equal(cancelled.outdated, 2);
      assert.equal(fingerprintWrites, 2);

      const fullCalls: number[][] = [];
      const noteCalls: number[][] = [];
      autoIndexManager.setIndexCallback(async candidates => {
        fullCalls.push(candidates.map(item => item.id));
        return candidates.map(item => item.id);
      });
      autoIndexManager.setNoteIndexCallback(async candidates => {
        noteCalls.push(candidates.map(item => item.id));
        return candidates.map(item => item.id);
      });
      autoIndexManager.setStartupConfigChangeCallback(() => 'update');
      const updated = await autoIndexManager.runNow({ promptForConfigChanges: true });

      assert.deepEqual(fullCalls, [[1]]);
      assert.deepEqual(noteCalls, []);
      assert.equal(updated.rebuilt, 1);
      assert.equal(updated.baselined, 1);
      assert.equal(updated.failed, 0);
      assert.equal(updated.paused, false);
      assert.equal(fingerprintWrites, 4);

      // Fingerprint-only progress is isolated per item. A failed write keeps
      // the old config and dirty state so the next scoped check retries it.
      zotero.Prefs.set('zotseek.maxChunksPerPaper', 102, true);
      failFingerprintFor = papers[1].key;
      const failedUpgrade = await autoIndexManager.reconcileItems(papers, {
        fullIndexCallback: async candidates => candidates.map(item => item.id),
        noteIndexCallback: async () => [],
      });
      assert.equal(failedUpgrade.rebuilt, 1);
      assert.equal(failedUpgrade.failed, 1);
      assert.equal(failedUpgrade.outdated, 1);
      assert.equal(indexFreshnessTracker.isDirty({
        libraryKey: 'user', itemKey: papers[1].key,
      }), true);

      const retried = await autoIndexManager.reconcileItems([papers[1]], {
        fullIndexCallback: async () => { throw new Error('unexpected full rebuild'); },
        noteIndexCallback: async () => { throw new Error('unexpected Note update'); },
      });
      assert.equal(retried.baselined, 1);
      assert.equal(retried.failed, 0);
      assert.equal(indexFreshnessTracker.isDirty({
        libraryKey: 'user', itemKey: papers[1].key,
      }), false);

      // Even when no item is truncated, startup still asks before advancing
      // configuration records, so Cancel remains a true zero-write choice.
      truncatedKeys.clear();
      zotero.Prefs.set('zotseek.maxChunksPerPaper', 103, true);
      let allCurrentContext = { affected: 0, rebuildRequired: -1 };
      autoIndexManager.setStartupConfigChangeCallback(context => {
        allCurrentContext = context;
        return 'cancel';
      });
      const writesBeforeCancel = fingerprintWrites;
      const allCurrentCancelled = await autoIndexManager.runNow({ promptForConfigChanges: true });
      assert.equal(allCurrentContext.affected, 2);
      assert.equal(allCurrentContext.rebuildRequired, 0);
      assert.equal(allCurrentCancelled.outdated, 2);
      assert.equal(fingerprintWrites, writesBeforeCancel);

      autoIndexManager.setIndexCallback(async () => {
        throw new Error('unexpected full rebuild');
      });
      autoIndexManager.setNoteIndexCallback(async () => {
        throw new Error('unexpected Note update');
      });
      autoIndexManager.setStartupConfigChangeCallback(() => 'update');
      const allCurrentUpdated = await autoIndexManager.runNow({ promptForConfigChanges: true });
      assert.equal(allCurrentUpdated.baselined, 2);
      assert.equal(allCurrentUpdated.rebuilt, 0);
      assert.equal(allCurrentUpdated.failed, 0);
    } finally {
      (textExtractor as any).extractChunksFromItem = originalExtract;
      autoIndexManager.setStartupConfigChangeCallback(null);
      autoIndexManager.setIndexCallback(null);
      autoIndexManager.setNoteIndexCallback(null);
      autoIndexManager.setItemProvider(null);
      autoIndexManager.setVectorStore(null);
      indexFreshnessTracker.clearAll();
    }
  });

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

  test('fully rebuilds a truncated Full-mode item when its Note content changes', async () => {
    const zotero = installZoteroStub({
      'zotseek.indexingMode': 'full',
      'zotseek.embeddingModel': 'multilingual-e5-base',
      'zotseek.maxChunksPerPaper': 100,
      'zotseek.excludeBooks': false,
      'zotseek.excludeTag': '',
    });
    const paper = createPaper(1);
    const note = createNote(paper);
    zotero.Libraries = {
      userLibraryID: 1,
      get: () => ({ libraryID: 1, libraryType: 'user' }),
    };
    zotero.Items = {
      get: (id: number) => id === paper.id ? paper : id === note.id ? note : null,
      getAsync: async (ids: number[]) => ids.includes(note.id) ? [note] : [],
    };

    const fingerprints = new Map<string, StartupFingerprint>();
    const store = {
      getIndexedIdentities: async () => [{ libraryKey: 'user', itemKey: paper.key }],
      getIndexStatusByIdentity: async () => new Map([
        [`user|${paper.key}`, { wasTruncated: true }],
      ]),
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
        _itemKey: string,
        sources: TextSourceType[],
      ) => sources.includes('note') ? [paper.noteText] : [`Summary ${paper.id}`],
    };
    autoIndexManager.setVectorStore(store);

    const originalExtract = textExtractor.extractChunksFromItem;
    (textExtractor as any).extractChunksFromItem = async () => ({
      chunks: [
        { type: 'summary', text: `Summary ${paper.id}` },
        { type: 'note', text: paper.noteText },
        { type: 'pdf', text: 'PDF page', page: 1 },
      ],
      wasTruncated: true,
    });

    try {
      const baseline = await autoIndexManager.reconcileItems([paper], {
        allowWrites: false,
      });
      assert.equal(baseline.baselined, 1);

      paper.noteText = 'Changed Note 1';
      paper.noteVersion++;
      paper.noteModified = '2026-08-31 09:00:00';
      const fullCalls: number[][] = [];
      const noteCalls: number[][] = [];
      const result = await autoIndexManager.reconcileItems([paper], {
        fullIndexCallback: async candidates => {
          fullCalls.push(candidates.map(item => item.id));
          return candidates.map(item => item.id);
        },
        noteIndexCallback: async candidates => {
          noteCalls.push(candidates.map(item => item.id));
          return candidates.map(item => item.id);
        },
      });

      assert.equal(result.rebuilt, 1);
      assert.equal(result.notesUpdated, 0);
      assert.deepEqual(fullCalls, [[1]]);
      assert.deepEqual(noteCalls, []);
    } finally {
      (textExtractor as any).extractChunksFromItem = originalExtract;
      autoIndexManager.setVectorStore(null);
      indexFreshnessTracker.clearAll();
    }
  });

  test('propagates paused callback results and persists only completed items', async () => {
    const zotero = installZoteroStub({
      'zotseek.indexingMode': 'notes',
      'zotseek.embeddingModel': 'multilingual-e5-base',
      'zotseek.maxChunksPerPaper': 100,
      'zotseek.excludeBooks': false,
      'zotseek.excludeTag': '',
    });
    const papers = [createPaper(1), createPaper(2)];
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
      getChunkTextsBySources: async () => [],
    };
    autoIndexManager.setVectorStore(store);

    const originalExtract = textExtractor.extractChunksFromItem;
    (textExtractor as any).extractChunksFromItem = async (paper: FakePaper) => ({
      chunks: [
        { type: 'summary', text: `Summary ${paper.id}` },
        { type: 'note', text: paper.noteText },
      ],
      wasTruncated: false,
    });

    try {
      let noteCall: number[] | null = null;
      const fullPaused = await autoIndexManager.reconcileItems(papers, {
        fullIndexCallback: async candidates => ({
          successfulIds: [candidates[0].id],
          paused: true,
        }),
        noteIndexCallback: async candidates => {
          noteCall = candidates.map(item => item.id);
          return candidates.map(item => item.id);
        },
      });

      assert.equal(fullPaused.paused, true);
      assert.equal(fullPaused.rebuilt, 1);
      assert.equal(fullPaused.failed, 1);
      assert.equal(fullPaused.outdated, 1);
      assert.equal(fingerprints.size, 1);
      assert.equal(noteCall, null);

      const changed = papers[0];
      changed.noteText = 'Changed Note 1';
      changed.noteVersion++;
      changed.noteModified = '2026-08-31 09:00:00';
      const notePaused = await autoIndexManager.reconcileItems([changed], {
        fullIndexCallback: async () => { throw new Error('unexpected full rebuild'); },
        noteIndexCallback: async (candidates: any[]) => {
          noteCall = candidates.map((item: any) => Number(item.id)) as number[];
          return { successfulIds: [candidates[0].id], paused: true };
        },
      });

      assert.equal(notePaused.paused, true);
      assert.equal(notePaused.notesUpdated, 1);
      assert.equal(notePaused.failed, 0);
      assert.deepEqual(noteCall, [1]);
      assert.equal(fingerprints.size, 1);
    } finally {
      (textExtractor as any).extractChunksFromItem = originalExtract;
      autoIndexManager.setVectorStore(null);
      indexFreshnessTracker.clearAll();
    }
  });

  test('purges missing Zotero identities only when the explicit scope enables it', async () => {
    const zotero = installZoteroStub({
      'zotseek.indexScope': 'user',
      'zotseek.indexingMode': 'abstract',
      'zotseek.embeddingModel': 'multilingual-e5-base',
      'zotseek.maxChunksPerPaper': 100,
      'zotseek.excludeBooks': false,
      'zotseek.excludeTag': '',
    });
    zotero.Libraries = {
      userLibraryID: 1,
      get: (libraryID: number) => libraryID === 1
        ? { libraryID: 1, libraryType: 'user' }
        : null,
    };
    zotero.Items = {
      get: () => null,
      getAsync: async () => [],
      getIDFromLibraryAndKey: () => false,
    };

    let deleted = 0;
    const store = {
      getIndexedIdentities: async () => [{ libraryKey: 'user', itemKey: 'DELETED1' }],
      deleteItem: async () => { deleted++; },
    };
    autoIndexManager.setVectorStore(store);

    try {
      const scoped = await autoIndexManager.reconcileItems([], {
        fullIndexCallback: async () => [],
        noteIndexCallback: async () => [],
      });
      assert.equal(scoped.removed, 0);
      assert.equal(deleted, 0);

      const library = await autoIndexManager.reconcileItems([], {
        purgeMissingScope: 'user',
        fullIndexCallback: async () => [],
        noteIndexCallback: async () => [],
      });
      assert.equal(library.removed, 1);
      assert.equal(deleted, 1);
    } finally {
      autoIndexManager.setVectorStore(null);
    }
  });

  test('removes excluded identities in the supplied scope across model partitions and retries failures', async () => {
    const zotero = installZoteroStub({
      'zotseek.indexingMode': 'abstract',
      'zotseek.embeddingModel': 'multilingual-e5-base',
      'zotseek.maxChunksPerPaper': 100,
      'zotseek.excludeBooks': true,
      'zotseek.excludeTag': 'no-zotseek',
    });
    const tagged = createPaper(1);
    tagged.tags = [{ tag: 'no-zotseek' }];
    const book = createPaper(2);
    book.itemType = 'book';
    const outside = createPaper(3);
    outside.tags = [{ tag: 'no-zotseek' }];
    const papers = [tagged, book, outside];
    zotero.Libraries = {
      userLibraryID: 1,
      get: (libraryID: number) => libraryID === 1
        ? { libraryID: 1, libraryType: 'user' }
        : null,
    };
    zotero.Items = {
      get: (id: number) => papers.find(paper => paper.id === id) || null,
      getAsync: async () => [],
      getIDFromLibraryAndKey: (_libraryID: number, key: string) =>
        papers.find(paper => paper.key === key)?.id || false,
    };

    const allCovered = new Set(papers.map(paper => paper.key));
    // The tagged item exists only in an inactive model partition. Exclusion
    // cleanup must still find and remove it.
    const activeCovered = new Set([book.key, outside.key]);
    const deleted: string[] = [];
    let failBookDelete = true;
    let fingerprintWrites = 0;
    const identities = (keys: Set<string>) => Array.from(keys, itemKey => ({
      libraryKey: 'user',
      itemKey,
    }));
    const store = {
      getIndexedIdentities: async (modelId?: string) =>
        identities(modelId === 'legacy-model'
          ? new Set([tagged.key])
          : activeCovered),
      getPerModelStats: async () => [
        { modelId: 'multilingual-e5-base' },
        { modelId: 'legacy-model' },
      ],
      getMetadata: async () => 'abstract',
      getStartupFingerprint: async () => null,
      getChunkTextsBySources: async () => [],
      setStartupFingerprint: async () => { fingerprintWrites++; },
      deleteItem: async (_libraryKey: string, itemKey: string) => {
        if (itemKey === book.key && failBookDelete) {
          failBookDelete = false;
          throw new Error('busy');
        }
        deleted.push(itemKey);
        allCovered.delete(itemKey);
        activeCovered.delete(itemKey);
      },
    };
    autoIndexManager.setVectorStore(store);

    const originalExtract = textExtractor.extractChunksFromItem;
    (textExtractor as any).extractChunksFromItem = async (paper: FakePaper) => ({
      chunks: [{ type: 'summary', text: `Summary ${paper.id}` }],
      wasTruncated: false,
    });

    try {
      const selected = await autoIndexManager.reconcileItems([tagged], {
        fullIndexCallback: async () => [],
        noteIndexCallback: async () => [],
      });
      assert.equal(selected.checked, 1);
      assert.equal(selected.removed, 1);
      assert.deepEqual(deleted, [tagged.key]);

      // The same exclusion outside the supplied selected/collection scope is
      // untouched. A failed delete remains retryable and keeps the dirty bit.
      assert.equal(allCovered.has(outside.key), true);
      const failed = await autoIndexManager.reconcileItems([book], {
        fullIndexCallback: async () => [],
        noteIndexCallback: async () => [],
      });
      assert.equal(failed.removed, 0);
      assert.equal(failed.failed, 1);
      assert.equal(failed.outdated, 1);
      assert.equal(allCovered.has(book.key), true);
      assert.equal(indexFreshnessTracker.isDirty({ libraryKey: 'user', itemKey: book.key }), true);

      const retried = await autoIndexManager.reconcileItems([book], {
        fullIndexCallback: async () => [],
        noteIndexCallback: async () => [],
      });
      assert.equal(retried.removed, 1);
      assert.equal(retried.failed, 0);
      assert.equal(allCovered.has(book.key), false);
      assert.equal(indexFreshnessTracker.isDirty({ libraryKey: 'user', itemKey: book.key }), false);

      const readOnly = await autoIndexManager.reconcileItems([outside], {
        allowWrites: false,
      });
      assert.equal(readOnly.removed, 0);
      assert.equal(readOnly.outdated, 1);
      assert.equal(allCovered.has(outside.key), true);

      // Removing the policy condition after a successful purge makes the item
      // a normal missing item for the active model.
      tagged.tags = [];
      const reintroduced = await autoIndexManager.reconcileItems([tagged], {
        fullIndexCallback: async candidates => candidates.map(item => item.id),
        noteIndexCallback: async () => [],
      });
      assert.equal(reintroduced.indexedNew, 1);
      assert.equal(reintroduced.failed, 0);
      assert.equal(fingerprintWrites, 1);
    } finally {
      (textExtractor as any).extractChunksFromItem = originalExtract;
      autoIndexManager.setVectorStore(null);
      indexFreshnessTracker.clearAll();
    }
  });

  test('keeps group exclusions outside user-library cleanup and removes them in all-library cleanup', async () => {
    const zotero = installZoteroStub({
      'zotseek.indexingMode': 'abstract',
      'zotseek.embeddingModel': 'multilingual-e5-base',
      'zotseek.maxChunksPerPaper': 100,
      'zotseek.excludeBooks': false,
      'zotseek.excludeTag': 'no-zotseek',
    });
    const userPaper = createPaper(1);
    userPaper.tags = [{ tag: 'no-zotseek' }];
    const groupPaper = createPaper(2);
    groupPaper.libraryID = 2;
    groupPaper.tags = [{ tag: 'no-zotseek' }];
    const papers = [userPaper, groupPaper];
    zotero.Libraries = {
      userLibraryID: 1,
      get: (libraryID: number) => {
        if (libraryID === 1) return { libraryID: 1, libraryType: 'user' };
        if (libraryID === 2) {
          return { libraryID: 2, libraryType: 'group', groupID: 99 };
        }
        return null;
      },
    };
    zotero.Groups = {
      get: (groupID: number) => groupID === 99 ? { libraryID: 2 } : null,
    };
    zotero.Items = {
      get: (id: number) => papers.find(paper => paper.id === id) || null,
      getAsync: async () => [],
      getIDFromLibraryAndKey: (libraryID: number, key: string) =>
        papers.find(paper => paper.libraryID === libraryID && paper.key === key)?.id || false,
    };

    const indexed = new Map([
      [`user\u0000${userPaper.key}`, { libraryKey: 'user', itemKey: userPaper.key }],
      [`group:99\u0000${groupPaper.key}`, {
        libraryKey: 'group:99',
        itemKey: groupPaper.key,
      }],
    ]);
    const deleted: string[] = [];
    const store = {
      getIndexedIdentities: async () => Array.from(indexed.values()),
      getPerModelStats: async () => [{ modelId: 'multilingual-e5-base' }],
      deleteItem: async (libraryKey: string, itemKey: string) => {
        deleted.push(`${libraryKey}/${itemKey}`);
        indexed.delete(`${libraryKey}\u0000${itemKey}`);
      },
    };
    autoIndexManager.setVectorStore(store);

    try {
      const userOnly = await autoIndexManager.reconcileItems(papers, {
        purgeMissingScope: 'user',
        fullIndexCallback: async () => [],
        noteIndexCallback: async () => [],
      });
      assert.equal(userOnly.removed, 1);
      assert.deepEqual(deleted, [`user/${userPaper.key}`]);
      assert.equal(indexed.has(`group:99\u0000${groupPaper.key}`), true);

      const allLibraries = await autoIndexManager.reconcileItems([groupPaper], {
        purgeMissingScope: 'all',
        fullIndexCallback: async () => [],
        noteIndexCallback: async () => [],
      });
      assert.equal(allLibraries.removed, 1);
      assert.deepEqual(deleted, [
        `user/${userPaper.key}`,
        `group:99/${groupPaper.key}`,
      ]);
      assert.equal(indexed.size, 0);
    } finally {
      autoIndexManager.setVectorStore(null);
      indexFreshnessTracker.clearAll();
    }
  });

  test('startup config cancel and rebuild decisions happen before every write', async () => {
    const zotero = installZoteroStub({
      'zotseek.indexScope': 'user',
      'zotseek.indexingMode': 'abstract',
      'zotseek.embeddingModel': 'multilingual-e5-base',
      'zotseek.maxChunksPerPaper': 150,
      'zotseek.excludeBooks': false,
      'zotseek.excludeTag': '',
    });
    const paper = createPaper(1);
    zotero.Libraries = {
      userLibraryID: 1,
      get: (libraryID: number) => libraryID === 1
        ? { libraryID: 1, libraryType: 'user' }
        : null,
    };
    zotero.Items = {
      get: () => paper,
      getAsync: async () => [],
      getIDFromLibraryAndKey: () => paper.id,
    };

    let writes = 0;
    let rebuilds = 0;
    let hasStoredFingerprint = true;
    let storedIndexingMode = 'abstract';
    const store = {
      getIndexedIdentities: async () => [{ libraryKey: 'user', itemKey: paper.key }],
      getMetadata: async () => storedIndexingMode,
      getStartupFingerprint: async () => hasStoredFingerprint
        ? ({
            libraryKey: 'user',
            itemKey: paper.key,
            modelId: 'multilingual-e5-base',
            configFingerprint: 'old-config',
            metadataFingerprint: 'old-metadata',
            noteStateFingerprint: 'abstract',
            noteContentFingerprint: 'abstract',
            checkedAt: '2026-08-30T00:00:00.000Z',
          })
        : null,
      deleteItem: async () => { writes++; },
      setStartupFingerprint: async () => { writes++; },
    };
    autoIndexManager.setVectorStore(store);
    autoIndexManager.setItemProvider(async () => [paper]);
    autoIndexManager.setStartupRebuildCallback(async () => { rebuilds++; });
    autoIndexManager.setIndexCallback(async items => items.map(item => item.id));
    autoIndexManager.setNoteIndexCallback(async () => []);

    const originalExtract = textExtractor.extractChunksFromItem;
    (textExtractor as any).extractChunksFromItem = async () => ({
      chunks: [{ type: 'summary', text: 'Summary 1' }],
      wasTruncated: false,
    });

    try {
      const restored = await autoIndexManager.restoreIndexedFreshness();
      assert.equal(restored.outdated, 1);
      assert.equal(writes, 0);

      autoIndexManager.setStartupConfigChangeCallback(() => 'cancel');
      const cancelled = await autoIndexManager.runNow({ promptForConfigChanges: true });
      assert.equal(cancelled.skipped, true);
      assert.equal(cancelled.checked, 1);
      assert.equal(cancelled.outdated, 1);
      assert.equal(writes, 0);
      assert.equal(rebuilds, 0);

      autoIndexManager.setStartupConfigChangeCallback(() => 'rebuild');
      const rebuilt = await autoIndexManager.runNow({ promptForConfigChanges: true });
      assert.equal(rebuilt.skipped, true);
      assert.equal(rebuilt.outdated, 1);
      assert.equal(writes, 0);
      assert.equal(rebuilds, 1);

      autoIndexManager.setStartupConfigChangeCallback(() => 'update');
      const updated = await autoIndexManager.runNow({ promptForConfigChanges: true });
      assert.equal(updated.skipped, false);
      assert.equal(updated.rebuilt, 1);
      assert.equal(updated.failed, 0);
      assert.equal(writes, 1);
      assert.equal(rebuilds, 1);

      // A legacy index without per-item fingerprints can still prove that its
      // persisted indexing mode differs. It must prompt and rebuild, not adopt
      // the current mode by silently writing a baseline.
      writes = 0;
      hasStoredFingerprint = false;
      storedIndexingMode = 'full';
      autoIndexManager.setStartupConfigChangeCallback(() => 'cancel');
      const legacyCancelled = await autoIndexManager.runNow({ promptForConfigChanges: true });
      assert.equal(legacyCancelled.outdated, 1);
      assert.equal(legacyCancelled.skipped, true);
      assert.equal(writes, 0);

      autoIndexManager.setStartupConfigChangeCallback(() => 'update');
      const legacyUpdated = await autoIndexManager.runNow({ promptForConfigChanges: true });
      assert.equal(legacyUpdated.rebuilt, 1);
      assert.equal(legacyUpdated.failed, 0);
      assert.equal(writes, 1);
    } finally {
      (textExtractor as any).extractChunksFromItem = originalExtract;
      autoIndexManager.setStartupConfigChangeCallback(null);
      autoIndexManager.setStartupRebuildCallback(null);
      autoIndexManager.setIndexCallback(null);
      autoIndexManager.setNoteIndexCallback(null);
      autoIndexManager.setItemProvider(null);
      autoIndexManager.setVectorStore(null);
    }
  });

  test('startup config cancel also defers exclusion deletion until update is chosen', async () => {
    const zotero = installZoteroStub({
      'zotseek.indexScope': 'user',
      'zotseek.indexingMode': 'abstract',
      'zotseek.embeddingModel': 'multilingual-e5-base',
      'zotseek.maxChunksPerPaper': 150,
      'zotseek.excludeBooks': false,
      'zotseek.excludeTag': 'no-zotseek',
    });
    const changed = createPaper(1);
    const excluded = createPaper(2);
    excluded.tags = [{ tag: 'no-zotseek' }];
    const papers = [changed, excluded];
    zotero.Libraries = {
      userLibraryID: 1,
      get: (libraryID: number) => libraryID === 1
        ? { libraryID: 1, libraryType: 'user' }
        : null,
    };
    zotero.Items = {
      get: (id: number) => papers.find(paper => paper.id === id) || null,
      getAsync: async () => [],
      getIDFromLibraryAndKey: (_libraryID: number, key: string) =>
        papers.find(paper => paper.key === key)?.id || false,
    };

    const indexed = new Set(papers.map(paper => paper.key));
    let fingerprintWrites = 0;
    const deleted: string[] = [];
    const store = {
      getIndexedIdentities: async () => Array.from(indexed, itemKey => ({
        libraryKey: 'user',
        itemKey,
      })),
      getMetadata: async () => 'abstract',
      getStartupFingerprint: async (_libraryKey: string, itemKey: string) =>
        itemKey === changed.key
          ? ({
              libraryKey: 'user',
              itemKey,
              modelId: 'multilingual-e5-base',
              configFingerprint: 'old-config',
              metadataFingerprint: 'old-metadata',
              noteStateFingerprint: 'old-note-state',
              noteContentFingerprint: 'old-note-content',
              checkedAt: '2026-08-30T00:00:00.000Z',
            })
          : null,
      setStartupFingerprint: async () => { fingerprintWrites++; },
      deleteItem: async (_libraryKey: string, itemKey: string) => {
        deleted.push(itemKey);
        indexed.delete(itemKey);
      },
    };
    autoIndexManager.setVectorStore(store);
    autoIndexManager.setItemProvider(async () => papers);
    autoIndexManager.setIndexCallback(async candidates => candidates.map(item => item.id));
    autoIndexManager.setNoteIndexCallback(async () => []);

    const originalExtract = textExtractor.extractChunksFromItem;
    (textExtractor as any).extractChunksFromItem = async () => ({
      chunks: [{ type: 'summary', text: 'Summary' }],
      wasTruncated: false,
    });

    try {
      autoIndexManager.setStartupConfigChangeCallback(() => 'cancel');
      const cancelled = await autoIndexManager.runNow({ promptForConfigChanges: true });
      assert.equal(cancelled.skipped, true);
      assert.equal(fingerprintWrites, 0);
      assert.deepEqual(deleted, []);
      assert.equal(indexed.has(excluded.key), true);

      autoIndexManager.setStartupConfigChangeCallback(() => 'update');
      const updated = await autoIndexManager.runNow({ promptForConfigChanges: true });
      assert.equal(updated.rebuilt, 1);
      assert.equal(updated.removed, 1);
      assert.equal(updated.failed, 0);
      assert.deepEqual(deleted, [excluded.key]);
      assert.equal(fingerprintWrites, 1);
    } finally {
      (textExtractor as any).extractChunksFromItem = originalExtract;
      autoIndexManager.setStartupConfigChangeCallback(null);
      autoIndexManager.setIndexCallback(null);
      autoIndexManager.setNoteIndexCallback(null);
      autoIndexManager.setItemProvider(null);
      autoIndexManager.setVectorStore(null);
      indexFreshnessTracker.clearAll();
    }
  });

  test('forceFull rebuilds an already-current item and persists fresh coverage', async () => {
    const zotero = installZoteroStub({
      'zotseek.indexingMode': 'abstract',
      'zotseek.embeddingModel': 'multilingual-e5-base',
      'zotseek.maxChunksPerPaper': 150,
      'zotseek.excludeBooks': false,
      'zotseek.excludeTag': '',
    });
    const paper = createPaper(1);
    zotero.Libraries = {
      userLibraryID: 1,
      get: () => ({ libraryID: 1, libraryType: 'user' }),
    };
    zotero.Items = {
      get: () => paper,
      getAsync: async () => [],
      getIDFromLibraryAndKey: () => paper.id,
    };

    let fingerprintWrites = 0;
    let fingerprintReads = 0;
    const store = {
      getIndexedIdentities: async () => [{ libraryKey: 'user', itemKey: paper.key }],
      getMetadata: async () => 'abstract',
      getIndexStatusByIdentity: async () => new Map(),
      getStartupFingerprint: async () => { fingerprintReads++; return null; },
      setStartupFingerprint: async () => { fingerprintWrites++; },
    };
    autoIndexManager.setVectorStore(store);
    const originalExtract = textExtractor.extractChunksFromItem;
    (textExtractor as any).extractChunksFromItem = async () => ({
      chunks: [{ type: 'summary', text: 'Summary 1' }],
      wasTruncated: false,
    });
    const rebuilt: number[][] = [];
    try {
      const result = await autoIndexManager.reconcileItems([paper], {
        forceFull: true,
        fullIndexCallback: async candidates => {
          rebuilt.push(candidates.map(item => item.id));
          return candidates.map(item => item.id);
        },
        noteIndexCallback: async () => [],
      });
      assert.deepEqual(rebuilt, [[paper.id]]);
      assert.equal(result.rebuilt, 1);
      assert.equal(result.failed, 0);
      assert.equal(fingerprintReads, 0);
      assert.equal(fingerprintWrites, 1);
    } finally {
      (textExtractor as any).extractChunksFromItem = originalExtract;
      autoIndexManager.setVectorStore(null);
      indexFreshnessTracker.clearAll();
    }
  });

  test('an explicit operation reservation blocks reconciliation before any reads', async () => {
    installZoteroStub();
    let reads = 0;
    autoIndexManager.setVectorStore({
      getIndexedIdentities: async () => { reads++; return []; },
    });
    const token = autoIndexManager.tryBeginExplicitOperation();
    assert.ok(token);
    try {
      const result = await autoIndexManager.reconcileItems([], { allowWrites: false });
      assert.equal(result.skipped, true);
      assert.equal(reads, 0);
    } finally {
      autoIndexManager.endExplicitOperation(token);
      autoIndexManager.setVectorStore(null);
    }
  });

  test('the explicit lease owner can enter reconciliation, while a stale token cannot', async () => {
    installZoteroStub();
    let reads = 0;
    autoIndexManager.setVectorStore({
      getIndexedIdentities: async () => { reads++; return []; },
    });
    const token = autoIndexManager.tryBeginExplicitOperation();
    assert.ok(token);
    try {
      const owned = await autoIndexManager.reconcileItems([], {
        allowWrites: false,
        operationToken: token,
      });
      assert.equal(owned.skipped, false);
      assert.equal(reads, 1);
    } finally {
      autoIndexManager.endExplicitOperation(token);
    }

    const stale = await autoIndexManager.reconcileItems([], {
      allowWrites: false,
      operationToken: token,
    });
    assert.equal(stale.skipped, true);
    assert.equal(reads, 1);
    autoIndexManager.setVectorStore(null);
  });

  test('an active reconciliation rejects a destructive-operation reservation', async () => {
    installZoteroStub({
      'zotseek.indexingMode': 'abstract',
      'zotseek.embeddingModel': 'multilingual-e5-base',
      'zotseek.maxChunksPerPaper': 100,
      'zotseek.excludeBooks': false,
      'zotseek.excludeTag': '',
    });
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    const readStarted = new Promise<void>(resolve => { markReadStarted = resolve; });
    const readGate = new Promise<void>(resolve => { releaseRead = resolve; });
    autoIndexManager.setVectorStore({
      getIndexedIdentities: async () => {
        markReadStarted();
        await readGate;
        return [];
      },
    });
    const reconciliation = autoIndexManager.reconcileItems([], { allowWrites: false });
    await readStarted;
    assert.equal(autoIndexManager.tryBeginExplicitOperation(), null);
    releaseRead();
    await reconciliation;
    const token = autoIndexManager.tryBeginExplicitOperation();
    assert.ok(token);
    autoIndexManager.endExplicitOperation(token);
    autoIndexManager.setVectorStore(null);
  });
});

import './helpers/zotero-stub';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { installZoteroStub } from './helpers/zotero-stub';
import { TextExtractor } from '../src/core/text-extractor';
import type { ChunkOptions } from '../src/utils/chunker';
import {
  buildIndexedMetadataSnapshot,
  INDEXED_ABSTRACT_MIN_CHARS,
} from '../src/utils/indexed-metadata';

const chunkOptions: ChunkOptions = {
  maxTokens: 420,
  maxChunks: 100,
  maxChars: 8000,
  tokenCounter: text => Math.ceil(text.length / 4),
  modelIdSnapshot: 'test-model',
};

function paper() {
  return {
    id: 1,
    key: 'PARENT',
    libraryID: 1,
    itemType: 'journalArticle',
    getField: (field: string) => {
      if (field === 'title') return 'Target article title';
      if (field === 'abstractNote') return 'A stable abstract describing the target article and its principal findings.';
      return '';
    },
    getTags: () => [],
    getNotes: () => [],
    isRegularItem: () => true,
    isAttachment: () => false,
    isNote: () => false,
  } as any;
}

function bodyPage(pageNumber: number, header: string) {
  return {
    pageNumber,
    text: [
      header,
      `This is the first ordinary body paragraph on physical page ${pageNumber}. It contains enough searchable prose to remain in the PDF body chunks.`,
      `This is the second ordinary body paragraph on physical page ${pageNumber}. It also contains enough material for deterministic packing.`,
      `Unique footer ${pageNumber}`,
    ].join('\n'),
  };
}

describe('TextExtractor PDF main-text production chain', () => {
  test('builds the same non-hash Metadata Summary in all three modes', async () => {
    const zotero = installZoteroStub();
    zotero.Items.getAsync = async () => [];
    const longTitle = 'Shared Metadata title '.repeat(20);
    const longAbstract = 'A sufficiently long abstract shared by all three indexing modes.';
    const item = {
      ...paper(),
      getField: (field: string) => {
        if (field === 'title') return longTitle;
        if (field === 'abstractNote') return longAbstract;
        return '';
      },
      getTags: () => [
        { tag: '#review' },
        { tag: ' EEG ' },
        { tag: 'Hyperscanning' },
        { tag: '   ' },
      ],
    } as any;
    const extractor = new TextExtractor();
    (extractor as any).zoteroAPI = {
      getSelectedMainPdfText: async () => ({
        selection: { decision: 'abstain', abstainReason: 'no-main' },
        selectedText: null,
      }),
    };

    const results = await Promise.all((['abstract', 'notes', 'full'] as const)
      .map(mode => extractor.extractChunksFromItem(item, mode, chunkOptions)));
    const summaries = results.map(result => result!.chunks
      .filter(chunk => chunk.type === 'summary')
      .map(chunk => chunk.text));

    assert.deepEqual(summaries[0], summaries[1]);
    assert.deepEqual(summaries[1], summaries[2]);
    assert.match(summaries[0].join('\n'), /Tags: EEG, Hyperscanning/);
    assert.doesNotMatch(summaries[0].join('\n'), /#review/);
  });

  test('drops only short abstracts while retaining short ordinary Tags', () => {
    const item = {
      getField: (field: string) => field === 'title' ? 'Paper' : 'Too short.',
      getTags: () => [{ tag: '#todo' }, { tag: ' EEG ' }],
    };
    const snapshot = buildIndexedMetadataSnapshot(item);
    assert.equal(snapshot.abstract, null);
    assert.equal(snapshot.body, 'Tags: EEG');
    assert.deepEqual(snapshot.tags, ['EEG']);

    const boundary = buildIndexedMetadataSnapshot({
      getField: (field: string) => field === 'title'
        ? 'Paper'
        : 'x'.repeat(INDEXED_ABSTRACT_MIN_CHARS),
      getTags: () => [],
    });
    assert.equal(boundary.abstract, 'x'.repeat(INDEXED_ABSTRACT_MIN_CHARS));
  });

  test('lets a multi-chunk Metadata Summary consume the shared paper quota first', async () => {
    const zotero = installZoteroStub();
    zotero.Items.getAsync = async () => [{
      key: 'NOTE0001',
      deleted: false,
      isNote: () => true,
      getNote: () => '<p>This child note should lose its slot to the Metadata Summary.</p>',
    }];
    const item = {
      ...paper(),
      getField: (field: string) => field === 'title' ? 'Quota paper' : '',
      getTags: () => [{ tag: `topic-${'x'.repeat(240)}` }],
      getNotes: () => [2],
    } as any;
    const extractor = new TextExtractor();
    const result = await extractor.extractChunksFromItem(item, 'notes', {
      ...chunkOptions,
      maxTokens: 30,
      maxChunks: 2,
      tokenCounter: text => Math.ceil(text.length / 4),
    });

    assert.ok(result);
    assert.equal(result.chunks.length, 2);
    assert.ok(result.chunks.every(chunk => chunk.type === 'summary'));
    assert.equal(result.wasTruncated, true);
  });

  test('selects the conservative counter only for Cloud runtime', async () => {
    installZoteroStub({ 'zotseek.embeddingModel': 'cloud-slot' });
    const cloudOptions = await (new TextExtractor() as any).resolveChunkOptions(undefined);
    assert.equal(cloudOptions.tokenCounter('中文'), 4);

    installZoteroStub({ 'zotseek.embeddingModel': 'nomic-embed-text-v1.5' });
    const nomicOptions = await (new TextExtractor() as any).resolveChunkOptions(undefined);
    assert.equal(nomicOptions.tokenCounter, undefined);

    installZoteroStub({
      'zotseek.embeddingModel': 'server-slot',
      'zotseek.serverModels': JSON.stringify([{
        id: 'server:test',
        label: 'Test',
        baseUrl: 'http://127.0.0.1:1234',
        serverModelName: 'test',
        dimensions: 768,
        maxInputTokens: 8192,
        recommendedChunkTokens: 2000,
        queryPrefix: '',
        docPrefix: '',
      }]),
    });
    const serverOptions = await (new TextExtractor() as any).resolveChunkOptions(undefined);
    assert.equal(serverOptions.tokenCounter, undefined);
  });

  test('keeps metadata when selector abstains and never calls a legacy PDF fallback', async () => {
    installZoteroStub();
    const extractor = new TextExtractor();
    (extractor as any).zoteroAPI = {
      getSelectedMainPdfText: async () => ({
        selection: { decision: 'abstain', abstainReason: 'no-main' },
        selectedText: null,
      }),
      getFullText: async () => {
        throw new Error('legacy PDF fallback must not run');
      },
    };

    const result = await extractor.extractChunksFromItem(paper(), 'full', chunkOptions);

    assert.ok(result);
    assert.equal(result.pagesTotal, 0);
    assert.equal(result.pagesIndexed, 0);
    assert.ok(result.chunks.some(chunk => chunk.type === 'summary'));
    assert.equal(result.chunks.some(chunk => chunk.type !== 'summary'), false);
  });

  test('applies References v2 then F v1 before title and same-page packing', async () => {
    installZoteroStub();
    const extractor = new TextExtractor();
    const pages = [
      bodyPage(1, 'REPEATED JOURNAL HEADER'),
      bodyPage(2, 'REPEATED JOURNAL HEADER'),
      bodyPage(3, 'REPEATED JOURNAL HEADER'),
      {
        pageNumber: 4,
        text: [
          'REPEATED JOURNAL HEADER',
          'Discussion text before the bibliography remains searchable and is deliberately long enough to become part of a body chunk.',
          'References',
          '[1] Smith, A. (2021). Journal 2(1), 10-20. doi:10.1000/one',
          '[2] Jones, B. (2022). University Press, pp. 30-40.',
        ].join('\n'),
      },
    ];
    (extractor as any).zoteroAPI = {
      getSelectedMainPdfText: async () => ({
        selection: { decision: 'selected-main', selectedAttachmentKey: 'MAIN' },
        selectedText: {
          attachmentId: 10,
          attachmentKey: 'MAIN',
          fileName: 'target.pdf',
          pagesTotal: pages.length,
          pages,
          status: 'ok',
        },
      }),
    };

    const result = await extractor.extractChunksFromItem(paper(), 'full', chunkOptions);
    const body = result!.chunks.filter(chunk => chunk.type !== 'summary');
    const text = body.map(chunk => chunk.text).join('\n');

    assert.ok(body.length > 0);
    assert.doesNotMatch(text, /Smith, A\. \(2021\)/);
    assert.doesNotMatch(text, /Jones, B\. \(2022\)/);
    assert.deepEqual([...new Set(body.map(chunk => chunk.pageNumber))].sort(), [1, 2, 3, 4]);
    assert.ok(body.every(chunk => chunk.text.startsWith('Target article title\n\n')));
    assert.ok(body.every(chunk => chunk.pdfAttachmentKey === 'MAIN'));
    assert.ok(result!.chunks.filter(chunk => chunk.type === 'summary')
      .every(chunk => chunk.pdfAttachmentKey === undefined));
    assert.equal((text.match(/REPEATED JOURNAL HEADER/g) ?? []).length, 1);
  });

  test('allows explicit preprocessor off modes without re-enabling legacy References', async () => {
    installZoteroStub();
    const extractor = new TextExtractor();
    const referenceText = [
      'References',
      '[1] Smith, A. (2021). This bibliography entry is intentionally long enough to remain independently searchable. doi:10.1000/one',
      '[2] Jones, B. (2022). This second bibliography entry is also deliberately long enough for the chunker. University Press.',
    ].join('\n\n');
    (extractor as any).zoteroAPI = {
      getSelectedMainPdfText: async () => ({
        selection: { decision: 'selected-main', selectedAttachmentKey: 'MAIN' },
        selectedText: {
          attachmentId: 10,
          attachmentKey: 'MAIN',
          fileName: 'target.pdf',
          pagesTotal: 1,
          pages: [{ pageNumber: 1, text: referenceText }],
          status: 'ok',
        },
      }),
    };

    const result = await extractor.extractChunksFromItem(paper(), 'full', {
      ...chunkOptions,
      pdfReferenceRegionFiltering: 'off',
      pdfPageFurnitureFiltering: 'off',
      pdfReferenceFiltering: 'legacy',
    });
    const bodyText = result!.chunks
      .filter(chunk => chunk.type !== 'summary')
      .map(chunk => chunk.text)
      .join('\n');

    assert.match(bodyText, /Smith, A\. \(2021\)/);
    assert.match(bodyText, /Jones, B\. \(2022\)/);
  });

  test('notes and abstract modes never call the PDF selector', async () => {
    const zotero = installZoteroStub();
    zotero.Items.getAsync = async () => [];
    const extractor = new TextExtractor();
    (extractor as any).zoteroAPI = {
      getSelectedMainPdfText: async () => {
        throw new Error('PDF selector must not run outside Full mode');
      },
    };

    const notes = await extractor.extractChunksFromItem(paper(), 'notes', chunkOptions);
    const abstract = await extractor.extractChunksFromItem(paper(), 'abstract', chunkOptions);

    assert.ok(notes);
    assert.ok(abstract);
    assert.equal(notes.pagesTotal, 0);
    assert.equal(abstract.pagesTotal, 0);
  });
});

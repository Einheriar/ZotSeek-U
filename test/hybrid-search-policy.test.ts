import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { HybridSearchEngine } from '../src/core/hybrid-search';

describe('HybridSearchEngine product dispatch', () => {
  const result = (
    itemId: number,
    itemKey: string,
    source: 'semantic' | 'keyword' | 'both' = 'semantic',
  ) => ({
    itemId,
    libraryKey: 'user',
    itemKey,
    title: itemKey,
    creators: '',
    year: 2024,
    semanticScore: source === 'keyword' ? null : 0.8,
    keywordScore: source === 'semantic' ? null : 1,
    rrfScore: 0.01,
    semanticRank: source === 'keyword' ? null : 1,
    keywordRank: source === 'semantic' ? null : 1,
    source,
  });

  function engineWithSpies() {
    const engine = new HybridSearchEngine({} as any) as any;
    const calls: string[] = [];
    engine.identityNavigationSearch = async () => [];
    engine.semanticOnlySearch = async () => { calls.push('semantic'); return []; };
    engine.keywordOnlySearch = async () => { calls.push('keyword'); return []; };
    engine.fixedHybridSearch = async () => { calls.push('notes-h1'); return []; };
    engine.fullSourceAwareSearch = async () => { calls.push('full-2+N'); return []; };
    return { engine, calls };
  }

  test('dispatches hybrid by stable indexing mode', async () => {
    for (const [indexingMode, expected] of [
      ['abstract', 'semantic'],
      ['notes', 'notes-h1'],
      ['full', 'full-2+N'],
    ] as const) {
      const { engine, calls } = engineWithSpies();
      await engine.search('concept query', { mode: 'hybrid', indexingMode });
      assert.deepEqual(calls, [expected]);
    }
  });

  test('preserves explicit semantic and keyword overrides', async () => {
    const semantic = engineWithSpies();
    await semantic.engine.search('query', { mode: 'semantic', indexingMode: 'full' });
    assert.deepEqual(semantic.calls, ['semantic']);

    const keyword = engineWithSpies();
    await keyword.engine.search('query', { mode: 'keyword', indexingMode: 'notes' });
    assert.deepEqual(keyword.calls, ['keyword']);
  });

  test('returns identity navigation without invoking a content specialist', async () => {
    const { engine, calls } = engineWithSpies();
    engine.identityNavigationSearch = async () => [{ itemId: 1 }];
    const results = await engine.search('Exact Title', { mode: 'hybrid', indexingMode: 'full' });
    assert.equal(results[0].itemId, 1);
    assert.deepEqual(calls, []);
  });

  test('allocates Full by stable identity and fills a missing PDF tail from Notes', async () => {
    const engine = new HybridSearchEngine({} as any) as any;
    engine.fixedHybridSearch = async () => [
      result(1, 'NOTE0001', 'both'),
      result(2, 'NOTE0002', 'both'),
      result(3, 'NOTE0003', 'both'),
    ];
    engine.semanticOnlySearch = async () => [
      // Same stable paper as NOTE0001 but a deliberately different local ID.
      result(99, 'NOTE0001'),
      result(4, 'PDF00004'),
    ];
    engine.populateItemMetadata = async () => undefined;

    const results = await engine.fullSourceAwareSearch('query', {
      semanticTopK: 50,
      keywordTopK: 50,
      finalTopK: 4,
      rrfK: 60,
      minSimilarity: 0.3,
      semanticWeight: 0.5,
      returnAllChunks: false,
      mode: 'hybrid',
      indexingMode: 'full',
    });

    assert.deepEqual(results.map((entry: any) => entry.itemKey), [
      'NOTE0001', 'NOTE0002', 'PDF00004', 'NOTE0003',
    ]);
    assert.deepEqual(results.map((entry: any) => entry.policyChannel), [
      'notes', 'notes', 'pdf', 'notes',
    ]);
  });

  test('fuses semantic and keyword hits by stable identity rather than local ID', () => {
    const engine = new HybridSearchEngine({} as any) as any;
    const fused = engine.reciprocalRankFusion(
      [{
        itemId: 1,
        libraryKey: 'user',
        itemKey: 'PAPER001',
        score: 0.8,
      }],
      [{
        itemId: 999,
        libraryKey: 'user',
        itemKey: 'PAPER001',
        score: 1,
      }],
      {
        rrfK: 60,
        semanticWeight: 0.5,
        returnAllChunks: false,
      },
    );

    assert.equal(fused.length, 1);
    assert.equal(fused[0].source, 'both');
    assert.equal(fused[0].itemId, 1);
    assert.equal(fused[0].itemKey, 'PAPER001');
  });

  test('batch-loads semantic book-filter items and preserves result order', async () => {
    const zotero = installZoteroStub({ 'zotseek.excludeBooks': true });
    const items = new Map<number, any>([
      [1, { id: 1, itemType: 'journalArticle' }],
      [2, { id: 2, itemType: 'book' }],
      [3, null],
    ]);
    const calls: unknown[] = [];
    zotero.Items = {
      getAsync: async (ids: number[] | number) => {
        calls.push(ids);
        const requested = Array.isArray(ids) ? ids : [ids];
        return requested.map(id => items.get(id) ?? null);
      },
    };
    const engine = new HybridSearchEngine({
      isReady: () => true,
      search: async () => [
        { itemId: 1, libraryKey: 'user', itemKey: 'ONE', similarity: 0.9, textSource: 'summary' },
        { itemId: 2, libraryKey: 'user', itemKey: 'TWO', similarity: 0.8, textSource: 'summary' },
        { itemId: 3, libraryKey: 'user', itemKey: 'THREE', similarity: 0.7, textSource: 'summary' },
      ],
    } as any) as any;

    const results = await engine.semanticSearchQuery('query', {
      semanticTopK: 50,
      minSimilarity: 0.3,
      libraryId: undefined,
      semanticTextSources: undefined,
      returnAllChunks: false,
    });

    assert.deepEqual(calls, [[1, 2, 3]]);
    assert.deepEqual(results.map((result: any) => result.itemId), [1]);
  });

  test('batch-loads quicksearch notes and parents, dropping missing items', async () => {
    const zotero = installZoteroStub();
    const parent = {
      id: 10,
      key: 'PARENT10',
      libraryID: 1,
      itemType: 'journalArticle',
      isNote: () => false,
      isRegularItem: () => true,
      getField: (field: string) => field === 'title' ? 'A parent paper' : '',
      getCreators: () => [],
    };
    const note = {
      id: 11,
      parentID: 10,
      isNote: () => true,
      getNote: () => '<p>exact phrase in the note</p>',
    };
    const calls: unknown[] = [];
    const items = new Map<number, any>([[10, parent], [11, note]]);
    zotero.Libraries = { get: (id: number) => id === 1 ? { libraryType: 'user' } : null };
    zotero.Search = class {
      addCondition(): void {}
      async search(): Promise<number[]> { return [11, 10, 99]; }
    };
    zotero.Items = {
      getAsync: async (ids: number[] | number) => {
        calls.push(ids);
        const requested = Array.isArray(ids) ? ids : [ids];
        return requested.map(id => items.get(id) ?? null);
      },
    };
    const engine = new HybridSearchEngine({
      searchIndexedText: async () => [],
    } as any) as any;

    const results = await engine.keywordSearchQuery('exact phrase', {
      semanticTopK: 50,
      keywordTopK: 50,
      finalTopK: 20,
      rrfK: 60,
      minSimilarity: 0.3,
      semanticWeight: 0.5,
      returnAllChunks: false,
      mode: 'keyword',
      indexingMode: 'notes',
    });

    assert.deepEqual(calls, [[11, 10, 99], [10]]);
    assert.deepEqual(results.map((result: any) => result.itemId), [10]);
    assert.match(results[0].chunkText, /exact phrase/);
  });

  test('batch-loads indexed matches and metadata, retaining missing/error semantics', async () => {
    const zotero = installZoteroStub();
    const makeItem = (id: number, title: string) => ({
      id,
      key: `ITEM${id}`,
      libraryID: 1,
      itemType: 'journalArticle',
      isRegularItem: () => true,
      isNote: () => false,
      getField: (field: string) => field === 'title' ? title : '',
      getCreators: () => [],
    });
    const items = new Map<number, any>([[20, makeItem(20, 'First')], [21, makeItem(21, 'Second')]]);
    const calls: unknown[] = [];
    zotero.Libraries = { get: (id: number) => id === 1 ? { libraryType: 'user' } : null };
    zotero.Search = class {
      addCondition(): void {}
      async search(): Promise<number[]> { return []; }
    };
    zotero.Items = {
      getAsync: async (ids: number[] | number) => {
        calls.push(ids);
        if (Array.isArray(ids)) {
          return ids.map(id => items.get(id) ?? null);
        }
        return items.get(ids) ?? null;
      },
    };
    const engine = new HybridSearchEngine({
      searchIndexedText: async () => [
        { itemId: 20, libraryKey: 'user', itemKey: 'ITEM20', chunkIndex: 0, chunkText: 'first', textSource: 'note', score: 1 },
        { itemId: 21, libraryKey: 'user', itemKey: 'ITEM21', chunkIndex: 0, chunkText: 'second', textSource: 'note', score: 0.9 },
        { itemId: 99, libraryKey: 'user', itemKey: 'ITEM99', chunkIndex: 0, chunkText: 'missing', textSource: 'note', score: 0.8 },
      ],
    } as any) as any;

    const results = await engine.keywordSearchQuery('indexed', {
      semanticTopK: 50,
      keywordTopK: 3,
      finalTopK: 20,
      rrfK: 60,
      minSimilarity: 0.3,
      semanticWeight: 0.5,
      returnAllChunks: false,
      mode: 'keyword',
      indexingMode: 'notes',
    });
    assert.deepEqual(calls, [[20, 21, 99]]);
    assert.deepEqual(results.map((result: any) => result.itemId), [20, 21]);

    const metadataResults = [
      { itemId: 21, itemKey: '', libraryKey: undefined, title: '', creators: '', year: 0 },
      { itemId: 99, itemKey: 'KEEP', libraryKey: 'user', title: 'Keep', creators: '', year: 0 },
    ];
    await engine.populateItemMetadata(metadataResults);
    assert.deepEqual(calls[1], [21, 99]);
    assert.equal(metadataResults[0].title, 'Second');
    assert.equal(metadataResults[1].title, 'Keep');

    const fallbackScalarCalls: number[] = [];
    zotero.Items.getAsync = async (ids: number[] | number) => {
      if (Array.isArray(ids)) {
        calls.push(ids);
        throw new Error('batch unavailable');
      }
      fallbackScalarCalls.push(ids);
      if (ids === 20) return items.get(ids);
      throw new Error('item unavailable');
    };
    const errorResults = [
      { itemId: 20, itemKey: '', libraryKey: undefined, title: 'Original', creators: '', year: 0 },
      { itemId: 99, itemKey: '', libraryKey: undefined, title: 'Missing', creators: '', year: 0 },
    ];
    await engine.populateItemMetadata(errorResults);
    assert.deepEqual(calls.slice(2), [[20, 99]]);
    assert.deepEqual(fallbackScalarCalls, [20, 99]);
    assert.equal(errorResults[0].title, 'First');
    assert.equal(errorResults[1].title, 'Missing');
  });
});

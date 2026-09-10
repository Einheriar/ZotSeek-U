import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { HybridSearchEngine } from '../src/core/hybrid-search';
import { metadataIdentityCache } from '../src/core/metadata-identity-cache';

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
    let capturedPartitions: any[] = [];
    engine.semanticSearchPartitionsQuery = async (_query: string, partitions: any[]) => {
      capturedPartitions = partitions;
      return new Map([
        ['notes', [
          { itemId: 1, libraryKey: 'user', itemKey: 'NOTE0001', score: 0.9 },
          { itemId: 2, libraryKey: 'user', itemKey: 'NOTE0002', score: 0.8 },
          { itemId: 3, libraryKey: 'user', itemKey: 'NOTE0003', score: 0.7 },
        ]],
        ['pdf', [
          // Same stable paper as NOTE0001 but a deliberately different local ID.
          { itemId: 99, libraryKey: 'user', itemKey: 'NOTE0001', score: 0.95 },
          { itemId: 4, libraryKey: 'user', itemKey: 'PDF00004', score: 0.85 },
        ]],
      ]);
    };
    engine.keywordSearchQuery = async () => [];
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
    assert.deepEqual(capturedPartitions, [
      { key: 'notes', topK: 50, textSources: ['summary', 'abstract', 'title_only', 'note'] },
      { key: 'pdf', topK: 50, textSources: ['fulltext', 'methods', 'findings', 'content'] },
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

  test('uses the reusable semantic score table with a bounded lexical bonus', () => {
    const engine = new HybridSearchEngine({} as any) as any;
    const fused = engine.boundedLexicalBonusFusion(
      [
        { itemId: 1, libraryKey: 'user', itemKey: 'SEM001', score: 0.9 },
        { itemId: 2, libraryKey: 'user', itemKey: 'SEM002', score: 0.89 },
      ],
      new Map([
        ['user|SEM001', { itemId: 1, libraryKey: 'user', itemKey: 'SEM001', similarity: 0.9 }],
        ['user|SEM002', { itemId: 2, libraryKey: 'user', itemKey: 'SEM002', similarity: 0.89 }],
        // This semantic score is outside the displayed semantic Top-2, but it
        // is still available when the keyword branch brings the item in.
        ['user|LEX001', { itemId: 3, libraryKey: 'user', itemKey: 'LEX001', similarity: 0.88 }],
      ]),
      [
        { itemId: 3, libraryKey: 'user', itemKey: 'LEX001', score: 1 },
        { itemId: 1, libraryKey: 'user', itemKey: 'SEM001', score: 0.5 },
      ],
      {
        rrfK: 60,
        semanticWeight: 0.2,
        returnAllChunks: false,
      },
    );

    assert.deepEqual(fused.map((entry: any) => entry.itemKey), [
      'SEM001', 'LEX001', 'SEM002',
    ]);
    assert.equal(fused[0].source, 'both');
    assert.equal(fused[1].source, 'both');
    assert.equal(fused[1].semanticRank, null);
    assert.ok(Math.abs(fused[0].rrfScore - (0.9 + 0.05 * (11 / 12))) < 1e-6);
    assert.ok(Math.abs(fused[1].rrfScore - (0.88 + 0.05)) < 1e-6);
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
    assert.deepEqual(results.map((result: any) => result.itemId), [20, 21, undefined]);
    assert.equal(results[2].itemStatus, 'item_not_found');

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

  test('cached identity navigation stays equivalent to the legacy candidate gate', async () => {
    const zotero = installZoteroStub({ 'zotseek.excludeBooks': true });
    const makeItem = (
      id: number,
      key: string,
      title: string,
      doi: string,
      date: string,
      creators: any[],
      itemType = 'journalArticle',
    ) => ({
      id,
      key,
      libraryID: 1,
      itemType,
      isRegularItem: () => true,
      getField: (field: string) => ({ title, DOI: doi, date } as any)[field] || '',
      getCreators: () => creators,
    });
    const title = 'Parenting Stress Undermines Mother-Child Brain-to-Brain Synchrony';
    const doi = '10.1000/example';
    const items = new Map<number, any>([
      [1, makeItem(1, 'PAPER001', title, doi, '2019', [{ firstName: 'Alice', lastName: 'Azhari' }])],
      [2, makeItem(2, 'PAPER002', 'A second paper', '', '2023', [{ firstName: 'Alice', lastName: 'Azhari' }])],
      [3, makeItem(3, 'PAPER003', 'Duplicate DOI', doi, '2020', [{ firstName: 'Wei', lastName: 'Zhang' }])],
      [4, makeItem(4, 'PAPER004', title, '', '2018', [{ firstName: 'Other', lastName: 'Author' }])],
      [5, makeItem(5, 'BOOK0005', 'Excluded book', doi, '2025', [{ firstName: 'Alice', lastName: 'Azhari' }], 'book')],
      [6, makeItem(6, 'PAPER006', '中文标题', '', '2024', [{ lastName: '王小明' }])],
    ]);
    const allIds = [...items.keys()];
    let wholeScopeSearches = 0;
    let querySpecificSearches = 0;
    zotero.Libraries = {
      userLibraryID: 1,
      get: (id: number) => id === 1 ? { libraryType: 'user' } : null,
    };
    zotero.Items = {
      getAsync: async (ids: number[] | number) => {
        const requested = Array.isArray(ids) ? ids : [ids];
        return requested.map(id => items.get(id) ?? null);
      },
    };
    zotero.Search = class {
      private conditions: Array<[string, string, string]> = [];
      addCondition(field: string, operator: string, value: string): void {
        this.conditions.push([field, operator, value]);
      }
      async search(): Promise<number[]> {
        const quick = this.conditions.find(([field]) => field.startsWith('quicksearch'))?.[2];
        if (!quick) {
          wholeScopeSearches++;
          return allIds;
        }
        querySpecificSearches++;
        const normalized = quick.toLocaleLowerCase('und');
        if (normalized === title.toLocaleLowerCase('und')) return [1, 4];
        if (normalized === doi) return [1, 3, 5];
        if (normalized === 'azhari') return [1, 2, 5];
        if (normalized === 'azhari 2023') return [2];
        if (normalized === '王小明') return [6];
        return [];
      }
    };
    const engine = new HybridSearchEngine({} as any) as any;
    engine.populateItemMetadata = async () => undefined;
    metadataIdentityCache.invalidate('identity equivalence fixture');
    const opts = {
      semanticTopK: 50,
      keywordTopK: 50,
      finalTopK: 10,
      rrfK: 60,
      minSimilarity: 0.3,
      semanticWeight: 0.5,
      returnAllChunks: false,
      mode: 'hybrid',
      indexingMode: 'full',
      libraryId: 1,
    };

    for (const query of [
      title,
      doi,
      'Azhari',
      'Azhari 2023',
      '王小明',
      'unrelated concept query',
      `“${title}”`,
    ]) {
      const cached = await engine.identityNavigationSearch(query, opts);
      const legacy = await engine.legacyIdentityNavigationSearch(query, opts);
      assert.deepEqual(cached, legacy, query);
    }
    assert.equal(wholeScopeSearches, 1);
    // Potential identity matches retain Zotero's query-specific gate; concept
    // negatives are answered from the scope snapshot without invoking it.
    assert.equal(querySpecificSearches, 13);
    metadataIdentityCache.invalidate('identity equivalence fixture cleanup');
  });

  test('falls back to query-specific Zotero Search when snapshot construction fails', async () => {
    const zotero = installZoteroStub({ 'zotseek.excludeBooks': true });
    const item = {
      id: 7,
      key: 'PAPER007',
      libraryID: 1,
      itemType: 'journalArticle',
      isRegularItem: () => true,
      getField: (field: string) => field === 'title' ? 'Fallback Identity Title' : '',
      getCreators: () => [],
    };
    zotero.Libraries = { get: () => ({ libraryType: 'user' }) };
    zotero.Items = { getAsync: async () => [item] };
    zotero.Search = class {
      private hasQuickSearch = false;
      addCondition(field: string): void {
        if (field.startsWith('quicksearch')) this.hasQuickSearch = true;
      }
      async search(): Promise<number[]> {
        if (!this.hasQuickSearch) throw new Error('whole-scope search unavailable');
        return [7];
      }
    };
    const engine = new HybridSearchEngine({} as any) as any;
    engine.populateItemMetadata = async () => undefined;
    metadataIdentityCache.invalidate('fallback fixture');

    const results = await engine.identityNavigationSearch('Fallback Identity Title', {
      semanticTopK: 50,
      keywordTopK: 50,
      finalTopK: 10,
      rrfK: 60,
      minSimilarity: 0.3,
      semanticWeight: 0.5,
      returnAllChunks: false,
      mode: 'hybrid',
      indexingMode: 'full',
      libraryId: 1,
    });

    assert.deepEqual(results.map((entry: any) => entry.itemKey), ['PAPER007']);
    metadataIdentityCache.invalidate('fallback fixture cleanup');
  });
});

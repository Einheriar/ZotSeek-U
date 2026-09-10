import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { HybridSearchEngine } from '../src/core/hybrid-search';
import { SearchEngine } from '../src/core/search-engine';
import { getActiveModelId } from '../src/core/model-registry';
import { T0BM25Index } from '../src/core/lexical-search';

test('lexical eligibility fills top-K without refitting corpus scores', () => {
  const index = new T0BM25Index(Array.from({ length: 70 }, (_, i) => ({
    itemPk: i + 1, libraryKey: 'user', itemKey: `P${String(i).padStart(7, '0')}`,
    chunkIndex: 0, chunkText: 'neural coupling', textSource: 'note' as const,
  })));
  const all = index.search('neural', { limit: 70 });
  const excluded = new Set(all.slice(0, 20).map(hit => hit.itemKey));
  const filtered = index.search('neural', {
    limit: 50, candidateFilter: identity => !excluded.has(identity.itemKey),
  });
  assert.deepEqual(filtered.map(hit => hit.itemKey), all.slice(20).map(hit => hit.itemKey));
  assert.deepEqual(filtered.map(hit => hit.score), all.slice(20).map(hit => hit.score));
});

test('K50 fuses independent Quick and BM25 ranks with fixed k=10', () => {
  const engine = new HybridSearchEngine({} as any) as any;
  const hit = (itemKey: string, score: number) => ({ libraryKey: 'user', itemKey, score });
  const ranked = engine.fuseKeywordChannels(
    [hit('A', 0.99), hit('B', 0.01)], [hit('B', 10000), hit('C', 9999)], 50,
  );
  assert.deepEqual(ranked.map((r: any) => r.itemKey), ['B', 'A', 'C']);
  assert.equal(ranked[0].score, 0.5 / 12 + 0.5 / 11);
});

test('paper Hybrid scans globally, excludes books before S50 and hydrates a K-only PDF winner', async () => {
  const zotero = installZoteroStub({ 'zotseek.excludeBooks': true });
  zotero.Libraries = { get: () => ({ libraryType: 'user' }), userLibraryID: 1 };
  const items = new Map<number, any>();
  const chunks = Array.from({ length: 112 }, (_, i) => {
    const id = i + 1;
    const key = `P${String(id).padStart(7, '0')}`;
    items.set(id, {
      id, key, libraryID: 1, itemType: i < 60 ? 'book' : 'journalArticle',
      isRegularItem: () => true, isNote: () => false,
      getField: () => '', getCreators: () => [],
    });
    const score = i < 60 ? 0.99 : 0.9 - (i - 60) * 0.0005;
    return {
      itemPk: id, libraryKey: 'user', itemKey: key, itemId: id, libraryId: 1,
      chunkIndex: i === 111 ? 7 : 0, title: key,
      textSource: i === 111 ? 'content' as const : 'note' as const,
      pageNumber: i === 111 ? 12 : undefined,
      modelId: getActiveModelId(), embedding: new Float32Array([score, 0]),
    };
  });
  zotero.Items = {
    get: (id: number) => items.get(id),
    getAsync: async (ids: number[]) => ids.map(id => items.get(id)),
  };
  zotero.Search = class { addCondition() {} async search() { return []; } };
  let scans = 0;
  let embedded = 0;
  const winner = chunks[111];
  const semantic = new SearchEngine({
    isReady: () => true,
    embedQuery: async () => { embedded++; return { embedding: [1, 0] }; },
  } as any);
  (semantic as any).store = {
    isReady: () => true,
    getAllCached: async () => { scans++; return chunks; },
    searchText: async () => [{ ...winner, score: 1, chunkText: 'Wrong lexical snippet', textSource: 'note' }],
    getChunkTexts: async () => new Map([['112:7', { text: 'Winning PDF passage', pdfAttachmentKey: 'PDF00001' }]]),
  };
  const hybrid = new HybridSearchEngine(semantic) as any;
  hybrid.identityNavigationSearch = async () => [];
  hybrid.populateItemMetadata = async () => {};
  const results = await hybrid.search('coupling', {
    mode: 'hybrid', indexingMode: 'full', minSimilarity: 0, finalTopK: 55,
  });
  assert.equal(scans, 1);
  assert.equal(embedded, 1);
  assert.equal(results.length, 51, 'S50 plus the independent K-only paper');
  assert.ok(results.every((r: any) => r.itemId > 60));
  assert.equal(results[0].itemId, 112);
  assert.equal(results[0].semanticRank, null);
  assert.equal(results[0].source, 'both');
  assert.ok(Math.abs(results[0].rrfScore - (winner.embedding[0] + 0.05)) < 1e-8);
  assert.equal(results[0].textSource, 'content');
  assert.equal(results[0].chunkIndex, 7);
  assert.equal(results[0].pageNumber, 12);
  assert.equal(results[0].chunkText, 'Winning PDF passage');
  assert.equal(results[0].pdfAttachmentKey, 'PDF00001');
});

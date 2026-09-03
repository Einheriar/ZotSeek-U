import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/zotero-stub';
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
});

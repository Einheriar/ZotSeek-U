import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/zotero-stub';
import { SearchEngine } from '../src/core/search-engine';
import { getActiveModelId } from '../src/core/model-registry';

function cachedChunk(
  itemPk: number,
  itemKey: string,
  libraryId: number,
  embedding: [number, number],
  textSource: 'note' | 'content' | 'summary' = 'note',
  chunkIndex = 0,
) {
  return {
    itemPk,
    libraryKey: libraryId === 1 ? 'user' : `group:${libraryId}`,
    itemKey,
    itemId: itemPk,
    libraryId,
    chunkIndex,
    title: itemKey,
    textSource,
    modelId: getActiveModelId(),
    embedding: new Float32Array(embedding),
  };
}

describe('library-scoped semantic search cache', () => {
  test('reuses normalized cache and filters candidates by library', async () => {
    let cachedReads = 0;
    let uncachedReads = 0;
    const store = {
      isReady: () => true,
      getAllCached: async () => {
        cachedReads++;
        return [
          { ...cachedChunk(1, 'USER0001', 1, [1, 0]), textSource: 'methods' as const },
          cachedChunk(2, 'GROUP001', 2, [1, 0]),
          cachedChunk(3, 'USER0002', 1, [0.8, 0.6]),
        ];
      },
      getByLibrary: async () => {
        uncachedReads++;
        throw new Error('library-scoped search must not use uncached vector reads');
      },
      getChunkTexts: async () => new Map([
        ['1:0', {
          text: 'Matched PDF passage',
          pdfAttachmentKey: 'PDFKEY01',
        }],
      ]),
    };
    const pipeline = {
      isReady: () => true,
      embedQuery: async () => ({ embedding: [1, 0] }),
    };
    const engine = new SearchEngine(pipeline as any);
    (engine as any).store = store;

    const results = await engine.search('test', {
      libraryId: 1,
      topK: 10,
      minSimilarity: 0,
    });

    assert.equal(cachedReads, 1);
    assert.equal(uncachedReads, 0);
    assert.deepEqual(results.map(r => r.itemKey), ['USER0001', 'USER0002']);
    assert.ok(results.every(r => r.libraryId === 1));
    assert.equal(results[0].chunkText, 'Matched PDF passage');
    assert.equal(results[0].pdfAttachmentKey, 'PDFKEY01');
  });

  test('keeps global search candidates from every cached library', async () => {
    const store = {
      isReady: () => true,
      getAllCached: async () => [
        cachedChunk(1, 'USER0001', 1, [1, 0]),
        cachedChunk(2, 'GROUP001', 2, [0.9, 0.1]),
      ],
    };
    const pipeline = {
      isReady: () => true,
      embedQuery: async () => ({ embedding: [1, 0] }),
    };
    const engine = new SearchEngine(pipeline as any);
    (engine as any).store = store;

    const results = await engine.search('test', { topK: 10, minSimilarity: 0 });

    assert.deepEqual(results.map(r => r.itemKey), ['USER0001', 'GROUP001']);
  });

  test('filters semantic candidates by specialist text source before MaxSim', async () => {
    const store = {
      isReady: () => true,
      getAllCached: async () => [
        cachedChunk(1, 'NOTE0001', 1, [0.8, 0.6], 'note'),
        cachedChunk(2, 'PDF00002', 1, [1, 0], 'content'),
        cachedChunk(3, 'META0003', 1, [0.9, 0.1], 'summary'),
      ],
    };
    const pipeline = {
      isReady: () => true,
      embedQuery: async () => ({ embedding: [1, 0] }),
    };
    const engine = new SearchEngine(pipeline as any);
    (engine as any).store = store;

    const notes = await engine.search('test', {
      topK: 10,
      minSimilarity: 0,
      textSources: ['summary', 'note'],
    });
    const pdf = await engine.search('test', {
      topK: 10,
      minSimilarity: 0,
      textSources: ['content'],
    });

    assert.deepEqual(notes.map(result => result.itemKey), ['META0003', 'NOTE0001']);
    assert.deepEqual(pdf.map(result => result.itemKey), ['PDF00002']);
  });

  test('shares embedding, cache read, and dot products across independently ranked partitions', async () => {
    let embeddingCalls = 0;
    let cachedReads = 0;
    const hydrationCalls: Array<Array<{ itemPk: number; chunkIndex: number }>> = [];
    const chunks = [
      cachedChunk(1, 'SHARED01', 1, [1, 0], 'summary', 0),
      cachedChunk(1, 'SHARED01', 1, [0.6, 0.8], 'content', 1),
      cachedChunk(2, 'NOTE0002', 1, [0.8, 0.6], 'note', 0),
      cachedChunk(3, 'PDF00003', 1, [0.9, 0.4358899], 'content', 0),
    ];
    const store = {
      isReady: () => true,
      getAllCached: async () => {
        cachedReads++;
        return chunks;
      },
      getChunkTexts: async (pairs: Array<{ itemPk: number; chunkIndex: number }>) => {
        hydrationCalls.push(pairs);
        return new Map(pairs.map(pair => [
          `${pair.itemPk}:${pair.chunkIndex}`,
          { text: `passage-${pair.itemPk}-${pair.chunkIndex}` },
        ]));
      },
    };
    const pipeline = {
      isReady: () => true,
      embedQuery: async () => {
        embeddingCalls++;
        return { embedding: [1, 0] };
      },
    };
    const engine = new SearchEngine(pipeline as any);
    (engine as any).store = store;
    let dotProducts = 0;
    const originalDotProduct = (engine as any).dotProductFloat32.bind(engine);
    (engine as any).dotProductFloat32 = (left: Float32Array, right: Float32Array) => {
      dotProducts++;
      return originalDotProduct(left, right);
    };

    const partitioned = await engine.searchPartitions('test', [
      { key: 'notes', topK: 2, textSources: ['summary', 'note'] },
      { key: 'pdf', topK: 2, textSources: ['content'] },
    ], { minSimilarity: 0 });

    assert.equal(embeddingCalls, 1);
    assert.equal(cachedReads, 1);
    assert.equal(dotProducts, chunks.length);
    assert.deepEqual(partitioned.get('notes')?.map(result => result.itemKey), [
      'SHARED01', 'NOTE0002',
    ]);
    assert.deepEqual(partitioned.get('pdf')?.map(result => result.itemKey), [
      'PDF00003', 'SHARED01',
    ]);
    assert.equal(partitioned.get('notes')?.[0].matchedChunkIndex, 0);
    assert.equal(partitioned.get('pdf')?.[1].matchedChunkIndex, 1);
    assert.equal(hydrationCalls.length, 2);
    assert.deepEqual(hydrationCalls.map(call => call.length), [2, 2]);
  });

  test('retains a stable-identity score table without widening hydration', async () => {
    const chunks = [
      cachedChunk(1, 'SCORE0001', 1, [1, 0], 'summary'),
      cachedChunk(2, 'SCORE0002', 1, [0.8, 0.6], 'summary'),
      cachedChunk(3, 'SCORE0003', 1, [0.6, 0.8], 'summary'),
    ];
    const hydrated: number[] = [];
    const store = {
      isReady: () => true,
      getAllCached: async () => chunks,
      getChunkTexts: async (pairs: Array<{ itemPk: number; chunkIndex: number }>) => {
        hydrated.push(pairs.length);
        return new Map();
      },
    };
    const engine = new SearchEngine({
      isReady: () => true,
      embedQuery: async () => ({ embedding: [1, 0] }),
    } as any);
    (engine as any).store = store;

    const pass = await engine.searchPartitionsWithScores('test', [
      { key: 'default', topK: 1, textSources: ['summary'] },
    ], { minSimilarity: 0.9 });

    assert.deepEqual(pass.resultsByPartition.get('default')?.map(result => result.itemKey), ['SCORE0001']);
    const scores = pass.scoresByPartition.get('default')!;
    assert.deepEqual([...scores.keys()], [
      'user|SCORE0001', 'user|SCORE0002', 'user|SCORE0003',
    ]);
    assert.ok(Math.abs(scores.get('user|SCORE0001')!.similarity - 1) < 1e-6);
    assert.ok(Math.abs(scores.get('user|SCORE0002')!.similarity - 0.8) < 1e-6);
    assert.ok(Math.abs(scores.get('user|SCORE0003')!.similarity - 0.6) < 1e-6);
    assert.deepEqual(hydrated, [1]);
  });

  test('matches two legacy source searches while retaining each top-50 hydration window', async () => {
    const chunks = [
      ...Array.from({ length: 55 }, (_, index) =>
        cachedChunk(index + 1, `NOTE${String(index).padStart(4, '0')}`, 1,
          [1 - index / 100, 0], 'note')),
      ...Array.from({ length: 55 }, (_, index) =>
        cachedChunk(index + 101, `PDF${String(index).padStart(5, '0')}`, 1,
          [1 - index / 100, 0], 'content')),
    ];
    const makeStore = (hydrationSizes: number[]) => ({
      isReady: () => true,
      getAllCached: async () => chunks,
      getChunkTexts: async (pairs: Array<{ itemPk: number; chunkIndex: number }>) => {
        hydrationSizes.push(pairs.length);
        return new Map();
      },
    });
    const pipeline = {
      isReady: () => true,
      embedQuery: async () => ({ embedding: [1, 0] }),
    };

    const legacyEngine = new SearchEngine(pipeline as any);
    (legacyEngine as any).store = makeStore([]);
    const [legacyNotes, legacyPdf] = await Promise.all([
      legacyEngine.search('test', { topK: 50, minSimilarity: 0, textSources: ['note'] }),
      legacyEngine.search('test', { topK: 50, minSimilarity: 0, textSources: ['content'] }),
    ]);

    const hydrationSizes: number[] = [];
    const partitionedEngine = new SearchEngine(pipeline as any);
    (partitionedEngine as any).store = makeStore(hydrationSizes);
    const partitioned = await partitionedEngine.searchPartitions('test', [
      { key: 'notes', topK: 50, textSources: ['note'] },
      { key: 'pdf', topK: 50, textSources: ['content'] },
    ], { minSimilarity: 0 });

    assert.deepEqual(partitioned.get('notes'), legacyNotes);
    assert.deepEqual(partitioned.get('pdf'), legacyPdf);
    assert.deepEqual(hydrationSizes, [50, 50]);
  });

  test('reuses the same cache for library-scoped similar-paper search', async () => {
    let uncachedReads = 0;
    const store = {
      isReady: () => true,
      getItemChunksByIdentity: async () => [{
        ...cachedChunk(10, 'SOURCE01', 1, [1, 0]),
        embedding: [1, 0],
      }],
      getAllCached: async () => [
        cachedChunk(10, 'SOURCE01', 1, [1, 0]),
        cachedChunk(11, 'USER0001', 1, [0.9, 0.1]),
        cachedChunk(12, 'GROUP001', 2, [1, 0]),
      ],
      getByLibrary: async () => {
        uncachedReads++;
        throw new Error('similar-paper search must not use uncached vector reads');
      },
    };
    const engine = new SearchEngine({ isReady: () => true } as any);
    (engine as any).store = store;

    const results = await engine.findSimilarByIdentity('user', 'SOURCE01', {
      libraryId: 1,
      topK: 10,
      minSimilarity: 0,
    });

    assert.equal(uncachedReads, 0);
    assert.deepEqual(results.map(r => r.itemKey), ['USER0001']);
  });
});

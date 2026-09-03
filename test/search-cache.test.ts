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
) {
  return {
    itemPk,
    libraryKey: libraryId === 1 ? 'user' : `group:${libraryId}`,
    itemKey,
    itemId: itemPk,
    libraryId,
    chunkIndex: 0,
    title: itemKey,
    textSource: 'note' as const,
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

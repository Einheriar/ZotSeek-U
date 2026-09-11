import './helpers/zotero-stub';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ServerEmbeddingClient,
  ServerEmbeddingResponseError,
} from '../src/core/server-embedding-client';

const originalFetch = globalThis.fetch;

function response(data: unknown): any {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => '',
  };
}

function client(): ServerEmbeddingClient {
  return new ServerEmbeddingClient({
    baseUrl: 'http://127.0.0.1:1234',
    serverModelName: 'test-model',
    dimensions: 3,
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Local Server embedding response validation', () => {
  test('orders a valid batch by its explicit indexes', async () => {
    globalThis.fetch = (async () => response({ data: [
      { index: 1, embedding: [4, 5, 6] },
      { index: 0, embedding: [1, 2, 3] },
    ] })) as any;
    assert.deepEqual(await client().embed(['a', 'b'], 0), [[1, 2, 3], [4, 5, 6]]);
  });

  test('rejects missing, duplicate, and out-of-range indexes', async () => {
    for (const data of [
      [{ embedding: [1, 2, 3] }],
      [{ index: 0, embedding: [1, 2, 3] }, { index: 0, embedding: [4, 5, 6] }],
      [{ index: 1, embedding: [1, 2, 3] }],
    ]) {
      globalThis.fetch = (async () => response({ data })) as any;
      await assert.rejects(() => client().embed(new Array(data.length).fill('x'), 0), {
        code: 'SERVER_INVALID_RESPONSE',
      });
    }
  });

  test('rejects missing vectors, wrong dimensions, non-finite values, and zero vectors', async () => {
    for (const embedding of [
      undefined,
      [1, 2],
      [1, null, 3],
      [1, '2', 3],
      [1, Number.POSITIVE_INFINITY, 3],
      [0, 0, 0],
    ]) {
      globalThis.fetch = (async () => response({ data: [{ index: 0, embedding }] })) as any;
      await assert.rejects(
        () => client().embed(['x'], 0),
        (error: unknown) => error instanceof ServerEmbeddingResponseError,
      );
    }
  });
});

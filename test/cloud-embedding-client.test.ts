import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CloudEmbeddingCancelledError,
  CloudEmbeddingClient,
  CloudEmbeddingRequestError,
  parseRetryAfter,
} from '../src/core/cloud-embedding-client';

const config = {
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  modelName: 'qwen3.7-text-embedding',
  dimensions: 3,
  apiKey: 'secret-key-not-for-logs',
  batchSize: 2,
};

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('cloud embedding client', () => {
  test('splits batches and restores provider response order', async () => {
    const requests: any[] = [];
    const client = new CloudEmbeddingClient(config, {
      abortController: null,
      fetch: async (url, init) => {
        requests.push({ url, init });
        const input = JSON.parse(init.body).input as string[];
        return response(200, {
          data: input.map((_, index) => ({ index, embedding: [index + 1, 2, 3] })).reverse(),
        });
      },
    });
    const vectors = await client.embed(['a', 'b', 'c'], 0);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, `${config.baseUrl}/embeddings`);
    assert.equal(JSON.parse(requests[0].init.body).dimensions, 3);
    assert.deepEqual(vectors, [[1, 2, 3], [2, 2, 3], [1, 2, 3]]);
  });

  test('connection probe validates the configured batch size', async () => {
    let received: string[] = [];
    const client = new CloudEmbeddingClient(config, {
      fetch: async (_url, init) => {
        received = JSON.parse(init.body).input;
        return response(200, {
          data: received.map((_, index) => ({ index, embedding: [1, 2, 3] })),
        });
      },
    });
    assert.equal(await client.probe(), 3);
    assert.equal(received.length, config.batchSize);
    assert.match(received[0], /fixed|probe/);
  });

  test('rejects duplicate indexes and wrong dimensions', async () => {
    const duplicate = new CloudEmbeddingClient(config, {
      fetch: async () => response(200, { data: [
        { index: 0, embedding: [1, 2, 3] },
        { index: 0, embedding: [1, 2, 3] },
      ] }),
    });
    await assert.rejects(() => duplicate.embed(['a', 'b'], 0), /invalid embedding indexes/);

    const wrongDimensions = new CloudEmbeddingClient(config, {
      fetch: async () => response(200, { data: [{ index: 0, embedding: [1, 2] }] }),
    });
    await assert.rejects(() => wrongDimensions.embed(['a'], 0), /expected 3 finite values/);
  });

  test('retries 429 using Retry-After without exposing the provider message', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const client = new CloudEmbeddingClient(config, {
      sleep: async ms => { delays.push(ms); },
      fetch: async () => {
        attempts++;
        if (attempts === 1) {
          return response(429, { error: { code: 'rate_limit', message: 'echo secret-key-not-for-logs' } }, {
            'Retry-After': '2',
          });
        }
        return response(200, { data: [{ index: 0, embedding: [1, 2, 3] }] });
      },
    });
    assert.deepEqual(await client.embed(['a'], 1), [[1, 2, 3]]);
    assert.deepEqual(delays, [2000]);
  });

  test('does not retry deterministic 401 errors and sanitizes the body', async () => {
    let attempts = 0;
    const client = new CloudEmbeddingClient(config, {
      fetch: async () => {
        attempts++;
        return response(401, { error: { code: 'invalid_api_key', message: 'secret-key-not-for-logs' } });
      },
    });
    await assert.rejects(
      () => client.embed(['a']),
      (error: any) => error instanceof CloudEmbeddingRequestError
        && error.message.includes('invalid_api_key')
        && !error.message.includes('secret-key-not-for-logs'),
    );
    assert.equal(attempts, 1);
  });

  test('parses and caps Retry-After', () => {
    assert.equal(parseRetryAfter('1.5', 0), 1500);
    assert.equal(parseRetryAfter('999', 0), 60000);
    assert.equal(parseRetryAfter('invalid', 0), undefined);
  });

  test('cancels an in-flight request without retrying it', async () => {
    let attempts = 0;
    class FakeAbortController {
      private reject: ((error: Error) => void) | null = null;
      signal = {
        setReject: (reject: (error: Error) => void) => { this.reject = reject; },
      };
      abort() {
        const error = new Error('aborted');
        error.name = 'AbortError';
        this.reject?.(error);
      }
    }
    const client = new CloudEmbeddingClient(config, {
      abortController: FakeAbortController,
      fetch: async (_url, init) => {
        attempts++;
        return await new Promise((_resolve, reject) => init.signal.setReject(reject));
      },
    });
    const pending = client.embed(['a'], 3);
    client.cancelPending();
    await assert.rejects(pending, CloudEmbeddingCancelledError);
    assert.equal(attempts, 1);
  });
});

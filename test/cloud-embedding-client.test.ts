import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CloudEmbeddingCancelledError,
  CloudEmbeddingClient,
  CloudEmbeddingRequestError,
  parseRetryAfter,
} from '../src/core/cloud-embedding-client';
import { createDashScopeEmbeddingAdapter } from '../src/core/dashscope-embedding-adapter';

const bailianBase = {
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  modelName: 'qwen3.7-text-embedding',
  dimensions: 3,
  queryRole: 'query',
  documentRole: 'document',
  apiKey: 'secret-key-not-for-logs',
};

function makeAdapter(overrides: Partial<typeof bailianBase> = {}) {
  return createDashScopeEmbeddingAdapter({ ...bailianBase, ...overrides });
}

function clientConfig(overrides: Partial<typeof bailianBase> = {}) {
  return {
    adapter: makeAdapter(overrides),
    dimensions: 3,
    apiKey: 'secret-key-not-for-logs',
    batchSize: 2,
  };
}

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
  test('derives the native embedding path without changing a workspace host', () => {
    const adapter = makeAdapter({
      baseUrl: 'https://llm-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
    });
    const request = adapter.buildRequest(['a'], 'document');
    assert.equal(
      request.endpoint,
      'https://llm-example.cn-beijing.maas.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding',
    );
  });

  test('splits batches and restores provider response order', async () => {
    const requests: any[] = [];
    const client = new CloudEmbeddingClient(clientConfig(), {
      abortController: null,
      fetch: async (url, init) => {
        requests.push({ url, init });
        const input = JSON.parse(init.body).input.texts as string[];
        return response(200, {
          output: {
            embeddings: input.map((_, index) => ({
              text_index: index,
              embedding: [index + 1, 2, 3],
            })).reverse(),
          },
        });
      },
    });
    const vectors = await client.embed(['a', 'b', 'c'], { retries: 0 });
    assert.equal(requests.length, 2);
    assert.equal(
      requests[0].url,
      'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding',
    );
    assert.deepEqual(JSON.parse(requests[0].init.body).parameters, {
      dimension: 3,
      output_type: 'dense',
      text_type: 'document',
    });
    assert.deepEqual(vectors, [[1, 2, 3], [2, 2, 3], [1, 2, 3]]);
  });

  test('connection probe validates query and document roles separately', async () => {
    const received: Array<{ texts: string[]; role?: string }> = [];
    const client = new CloudEmbeddingClient(clientConfig(), {
      fetch: async (_url, init) => {
        const body = JSON.parse(init.body);
        received.push({ texts: body.input.texts, role: body.parameters.text_type });
        return response(200, {
          output: {
            embeddings: body.input.texts.map((_: string, index: number) => ({
              text_index: index,
              embedding: [1, 2, 3],
            })),
          },
        });
      },
    });
    assert.equal(await client.probe(), 3);
    assert.deepEqual(received.map(item => item.role), ['document', 'query']);
    assert.equal(received.every(item => item.texts.length === 1), true);
  });

  test('rejects duplicate indexes and wrong dimensions', async () => {
    const duplicate = new CloudEmbeddingClient(clientConfig(), {
      fetch: async () => response(200, { output: { embeddings: [
        { text_index: 0, embedding: [1, 2, 3] },
        { text_index: 0, embedding: [1, 2, 3] },
      ] } }),
    });
    await assert.rejects(
      () => duplicate.embed(['a', 'b'], { retries: 0 }),
      /invalid embedding text indexes/,
    );

    const wrongDimensions = new CloudEmbeddingClient(clientConfig(), {
      fetch: async () => response(200, {
        output: { embeddings: [{ text_index: 0, embedding: [1, 2] }] },
      }),
    });
    await assert.rejects(
      () => wrongDimensions.embed(['a'], { retries: 0 }),
      /expected 3 finite values/,
    );

    const allZero = new CloudEmbeddingClient(clientConfig(), {
      fetch: async () => response(200, {
        output: { embeddings: [{ text_index: 0, embedding: [0, 0, 0] }] },
      }),
    });
    await assert.rejects(() => allZero.embed(['a'], { retries: 0 }), /invalid embedding/);
  });

  test('omits text_type for an explicitly blank role and never adds instruct', async () => {
    let body: any;
    const client = new CloudEmbeddingClient(clientConfig({ queryRole: '' }), {
      fetch: async (_url, init) => {
        body = JSON.parse(init.body);
        return response(200, {
          output: { embeddings: [{ text_index: 0, embedding: [1, 2, 3] }] },
        });
      },
    });
    await client.embed(['raw query'], { kind: 'query', retries: 0 });
    assert.equal(body.input.texts[0], 'raw query');
    assert.equal('text_type' in body.parameters, false);
    assert.equal('instruct' in body.parameters, false);
    assert.equal(body.parameters.output_type, 'dense');
  });

  test('reports native request id and billed token usage per successful batch', async () => {
    const receipts: any[] = [];
    const client = new CloudEmbeddingClient(clientConfig(), {
      onBatchSuccess: receipt => receipts.push(receipt),
      fetch: async () => response(200, {
        output: { embeddings: [{ text_index: 0, embedding: [1, 2, 3] }] },
        request_id: 'request-123',
        usage: { total_tokens: 17 },
      }),
    });
    await client.embed(['a'], { kind: 'query', retries: 0 });
    assert.deepEqual(receipts, [{
      requestId: 'request-123',
      totalTokens: 17,
      inputCount: 1,
      kind: 'query',
    }]);
  });

  test('retries 429 using Retry-After without exposing the provider message', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const client = new CloudEmbeddingClient(clientConfig(), {
      sleep: async ms => { delays.push(ms); },
      fetch: async () => {
        attempts++;
        if (attempts === 1) {
          return response(429, { error: { code: 'rate_limit', message: 'echo secret-key-not-for-logs' } }, {
            'Retry-After': '2',
          });
        }
        return response(200, {
          output: { embeddings: [{ text_index: 0, embedding: [1, 2, 3] }] },
        });
      },
    });
    assert.deepEqual(await client.embed(['a'], { retries: 1 }), [[1, 2, 3]]);
    assert.deepEqual(delays, [2000]);
  });

  test('does not retry deterministic 401 errors and sanitizes the body', async () => {
    let attempts = 0;
    const client = new CloudEmbeddingClient(clientConfig(), {
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
    const client = new CloudEmbeddingClient(clientConfig(), {
      abortController: FakeAbortController,
      fetch: async (_url, init) => {
        attempts++;
        return await new Promise((_resolve, reject) => init.signal.setReject(reject));
      },
    });
    const pending = client.embed(['a'], { retries: 3 });
    client.cancelPending();
    await assert.rejects(pending, CloudEmbeddingCancelledError);
    assert.equal(attempts, 1);
  });
});

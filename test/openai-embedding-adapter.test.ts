import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  OPENAI_EMBEDDINGS_ENDPOINT,
  buildOpenAIEmbeddingBody,
  createOpenAIEmbeddingAdapter,
  parseOpenAIEmbeddingResponse,
} from '../src/core/openai-embedding-adapter';

const baseConfig = {
  endpoint: OPENAI_EMBEDDINGS_ENDPOINT,
  modelName: 'text-embedding-3-small',
  apiKey: 'secret-key-not-for-logs',
  sendDimensions: true,
  dimensions: 1536,
};

describe('openai embedding adapter', () => {
  test('uses the fixed official endpoint with Bearer auth', () => {
    const adapter = createOpenAIEmbeddingAdapter(baseConfig);
    const request = adapter.buildRequest(['hello'], 'document');
    assert.equal(request.endpoint, 'https://api.openai.com/v1/embeddings');
    assert.equal(request.headers.Authorization, 'Bearer secret-key-not-for-logs');
    assert.equal(request.headers['Content-Type'], 'application/json');
  });

  test('sends the model, the input array, and the dimensions parameter', () => {
    const body = buildOpenAIEmbeddingBody(baseConfig, ['a', 'b']);
    assert.deepEqual(body, {
      model: 'text-embedding-3-small',
      input: ['a', 'b'],
      dimensions: 1536,
    });
  });

  test('never adds task roles or textual prefixes for either kind', () => {
    const adapter = createOpenAIEmbeddingAdapter(baseConfig);
    const query = adapter.buildRequest(['q text'], 'query');
    const document = adapter.buildRequest(['d text'], 'document');
    assert.equal(JSON.stringify(query.body), JSON.stringify(document.body).replace('d text', 'q text'));
    assert.equal('task' in (query.body as any), false);
    assert.equal('input_type' in (query.body as any), false);
    const text = (query.body as any).input[0];
    assert.equal(text, 'q text');
  });

  test('custom providers reuse the format but never send dimensions', () => {
    const custom = createOpenAIEmbeddingAdapter({
      endpoint: 'https://api.example.com/v1/embeddings',
      modelName: 'bge-m3',
      apiKey: 'k',
      sendDimensions: false,
      dimensions: 1024,
    });
    const request = custom.buildRequest(['a'], 'document');
    assert.equal(request.endpoint, 'https://api.example.com/v1/embeddings');
    assert.deepEqual(request.body, { model: 'bge-m3', input: ['a'] });
  });

  test('restores provider order from the data index and parses usage', () => {
    const parsed = parseOpenAIEmbeddingResponse({
      id: 'emb-123',
      data: [
        { index: 1, embedding: [2, 2] },
        { index: 0, embedding: [1, 1] },
      ],
      usage: { prompt_tokens: 5, total_tokens: 7 },
    }, 2);
    assert.deepEqual(parsed.embeddings, [[1, 1], [2, 2]]);
    assert.equal(parsed.requestId, 'emb-123');
    assert.equal(parsed.totalTokens, 7);
  });

  test('rejects wrong counts, duplicate indexes, and malformed payloads', () => {
    assert.throws(
      () => parseOpenAIEmbeddingResponse({ data: [] }, 1),
      (error: any) => error.code === 'CLOUD_EMBEDDING_REQUEST_ERROR' && error.status === 502,
    );
    assert.throws(
      () => parseOpenAIEmbeddingResponse({ data: [
        { index: 0, embedding: [1] },
        { index: 0, embedding: [1] },
      ] }, 2),
      /invalid embedding indexes/,
    );
    assert.throws(
      () => parseOpenAIEmbeddingResponse({ data: [{ index: 0, embedding: 'nope' }] }, 1),
      /invalid embedding payload/,
    );
    // Non-array data is treated as a provider contract violation, not a crash.
    assert.throws(() => parseOpenAIEmbeddingResponse({}, 1));
  });
});

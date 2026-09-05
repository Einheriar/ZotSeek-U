import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  GEMINI_API_BASE_URL,
  buildGeminiEmbeddingBody,
  createGeminiEmbeddingAdapter,
  geminiBatchEmbedContentsEndpoint,
  parseGeminiEmbeddingResponse,
} from '../src/core/gemini-embedding-adapter';

const baseConfig = {
  modelName: 'gemini-embedding-001',
  apiKey: 'secret-key-not-for-logs',
  queryTaskType: 'RETRIEVAL_QUERY',
  documentTaskType: 'RETRIEVAL_DOCUMENT',
  outputDimensionality: 768,
};

describe('gemini embedding adapter', () => {
  test('targets the synchronous batchEmbedContents endpoint with the API key header', () => {
    assert.equal(
      geminiBatchEmbedContentsEndpoint('gemini-embedding-001'),
      `${GEMINI_API_BASE_URL}/models/gemini-embedding-001:batchEmbedContents`,
    );
    const adapter = createGeminiEmbeddingAdapter(baseConfig);
    const request = adapter.buildRequest(['a'], 'document');
    assert.equal(request.endpoint, geminiBatchEmbedContentsEndpoint('gemini-embedding-001'));
    assert.equal(request.headers['x-goog-api-key'], 'secret-key-not-for-logs');
  });

  test('maps query and document kinds to their retrieval task types', () => {
    const query = buildGeminiEmbeddingBody(baseConfig, ['q'], 'query');
    const document = buildGeminiEmbeddingBody(baseConfig, ['d'], 'document');
    assert.equal((query as any).requests[0].embedContentConfig.taskType, 'RETRIEVAL_QUERY');
    assert.equal((document as any).requests[0].embedContentConfig.taskType, 'RETRIEVAL_DOCUMENT');
  });

  test('places taskType and outputDimensionality inside embedContentConfig only', () => {
    const body: any = buildGeminiEmbeddingBody(baseConfig, ['a'], 'document');
    const request = body.requests[0];
    assert.equal(request.model, 'models/gemini-embedding-001');
    assert.deepEqual(request.content, { parts: [{ text: 'a' }] });
    assert.deepEqual(request.embedContentConfig, {
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: 768,
    });
    // The top-level taskType/outputDimensionality fields are deprecated.
    assert.equal('taskType' in body, false);
    assert.equal('outputDimensionality' in request, false);
    assert.equal('title' in request.embedContentConfig, false);
  });

  test('returns embeddings in input order and parses usageMetadata', () => {
    const parsed = parseGeminiEmbeddingResponse({
      embeddings: [{ values: [1, 1] }, { values: [2, 2] }],
      usageMetadata: { totalTokenCount: 9 },
    }, 2);
    assert.deepEqual(parsed.embeddings, [[1, 1], [2, 2]]);
    assert.equal(parsed.totalTokens, 9);
    assert.equal(parsed.requestId, undefined);
  });

  test('rejects wrong counts and malformed payloads', () => {
    assert.throws(
      () => parseGeminiEmbeddingResponse({ embeddings: [{ values: [1] }] }, 2),
      (error: any) => error.code === 'CLOUD_EMBEDDING_REQUEST_ERROR' && error.status === 502,
    );
    assert.throws(
      () => parseGeminiEmbeddingResponse({ embeddings: [{ values: 'nope' }] }, 1),
      /invalid embedding payload/,
    );
    assert.throws(() => parseGeminiEmbeddingResponse({}, 1));
  });
});

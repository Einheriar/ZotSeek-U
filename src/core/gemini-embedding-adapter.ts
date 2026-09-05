/**
 * Google Gemini API embeddings adapter (gemini-embedding-001).
 *
 * Uses the synchronous batchEmbedContents endpoint, which is the Gemini
 * equivalent of the OpenAI input array. Per the current API reference, the
 * top-level `taskType`/`title`/`outputDimensionality` request fields are
 * deprecated: all configuration must go through `embedContentConfig`.
 */

import {
  CloudEmbeddingRequestError,
  type CloudEmbeddingHttpRequest,
  type CloudEmbeddingKind,
  type CloudEmbeddingParseResult,
  type CloudEmbeddingRequestAdapter,
} from './cloud-embedding-client';

export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiEmbeddingAdapterConfig {
  /** Provider model name, e.g. 'gemini-embedding-001'. */
  modelName: string;
  apiKey: string;
  /** Catalog task types, e.g. RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT. */
  queryTaskType: string;
  documentTaskType: string;
  /** Catalog output dimensionality, e.g. 768. */
  outputDimensionality: number;
}

export function geminiBatchEmbedContentsEndpoint(modelName: string): string {
  return `${GEMINI_API_BASE_URL}/models/${modelName}:batchEmbedContents`;
}

export function buildGeminiEmbeddingBody(
  config: GeminiEmbeddingAdapterConfig,
  texts: string[],
  kind: CloudEmbeddingKind,
): Record<string, unknown> {
  const taskType = kind === 'query' ? config.queryTaskType : config.documentTaskType;
  return {
    requests: texts.map(text => ({
      model: `models/${config.modelName}`,
      content: { parts: [{ text }] },
      embedContentConfig: {
        taskType,
        outputDimensionality: config.outputDimensionality,
      },
    })),
  };
}

export function parseGeminiEmbeddingResponse(
  json: unknown,
  expectedCount: number,
): CloudEmbeddingParseResult {
  const data = (json as any)?.embeddings;
  const entries = Array.isArray(data) ? data : [];
  if (entries.length !== expectedCount) {
    throw new CloudEmbeddingRequestError(
      `Cloud provider returned ${entries.length} embeddings for ${expectedCount} inputs.`,
      502,
    );
  }
  const ordered: number[][] = [];
  for (const entry of entries) {
    // batchEmbedContents returns embeddings in input order, each as {values}.
    const values = entry?.values;
    if (!Array.isArray(values)) {
      throw new CloudEmbeddingRequestError('Cloud provider returned an invalid embedding payload.', 502);
    }
    ordered.push(values);
  }
  const totalTokens = (json as any)?.usageMetadata?.totalTokenCount;
  return {
    embeddings: ordered,
    totalTokens: typeof totalTokens === 'number' && Number.isFinite(totalTokens)
      ? totalTokens
      : undefined,
  };
}

export function createGeminiEmbeddingAdapter(config: GeminiEmbeddingAdapterConfig): CloudEmbeddingRequestAdapter {
  return {
    buildRequest(texts: string[], kind: CloudEmbeddingKind): CloudEmbeddingHttpRequest {
      return {
        endpoint: geminiBatchEmbedContentsEndpoint(config.modelName),
        headers: {
          'x-goog-api-key': config.apiKey,
          'Content-Type': 'application/json',
        },
        body: buildGeminiEmbeddingBody(config, texts, kind),
      };
    },
    parseResponse(json: unknown, expectedCount: number): CloudEmbeddingParseResult {
      return parseGeminiEmbeddingResponse(json, expectedCount);
    },
  };
}

/**
 * OpenAI-compatible embeddings request adapter.
 *
 * Serves two providers: the built-in OpenAI provider (official endpoint, sends
 * the dimensions parameter) and the Custom (OpenAI-compatible) provider (user
 * endpoint, never sends dimensions because many compatible gateways reject
 * unknown parameters — the configured dimension is only used for response
 * validation). Neither provider has query/document roles or text prefixes.
 */

import {
  CloudEmbeddingRequestError,
  type CloudEmbeddingHttpRequest,
  type CloudEmbeddingKind,
  type CloudEmbeddingParseResult,
  type CloudEmbeddingRequestAdapter,
} from './cloud-embedding-client';

export const OPENAI_EMBEDDINGS_ENDPOINT = 'https://api.openai.com/v1/embeddings';

export interface OpenAIEmbeddingAdapterConfig {
  endpoint: string;
  modelName: string;
  apiKey: string;
  /** Built-in OpenAI sends `dimensions`; the Custom provider must not. */
  sendDimensions: boolean;
  dimensions?: number;
}

export function buildOpenAIEmbeddingBody(
  config: OpenAIEmbeddingAdapterConfig,
  texts: string[],
): Record<string, unknown> {
  return {
    model: config.modelName,
    input: texts,
    ...(config.sendDimensions && config.dimensions
      ? { dimensions: config.dimensions }
      : {}),
  };
}

export function parseOpenAIEmbeddingResponse(
  json: unknown,
  expectedCount: number,
): CloudEmbeddingParseResult {
  const data = (json as any)?.data;
  const entries = Array.isArray(data) ? data : [];
  if (entries.length !== expectedCount) {
    throw new CloudEmbeddingRequestError(
      `Cloud provider returned ${entries.length} embeddings for ${expectedCount} inputs.`,
      502,
    );
  }
  const ordered: number[][] = new Array(expectedCount);
  const seen = new Set<number>();
  for (const entry of entries) {
    const index = entry?.index;
    const embedding = entry?.embedding;
    if (!Number.isInteger(index) || index < 0 || index >= expectedCount || seen.has(index)) {
      throw new CloudEmbeddingRequestError('Cloud provider returned invalid embedding indexes.', 502);
    }
    if (!Array.isArray(embedding)) {
      throw new CloudEmbeddingRequestError('Cloud provider returned an invalid embedding payload.', 502);
    }
    seen.add(index);
    ordered[index] = embedding;
  }
  const totalTokens = (json as any)?.usage?.total_tokens;
  return {
    embeddings: ordered,
    requestId: typeof (json as any)?.id === 'string' ? (json as any).id : undefined,
    totalTokens: typeof totalTokens === 'number' && Number.isFinite(totalTokens)
      ? totalTokens
      : undefined,
  };
}

export function createOpenAIEmbeddingAdapter(config: OpenAIEmbeddingAdapterConfig): CloudEmbeddingRequestAdapter {
  return {
    buildRequest(texts: string[], _kind: CloudEmbeddingKind): CloudEmbeddingHttpRequest {
      // Query and document embeddings are sent as plain text: the OpenAI
      // embeddings API has no task roles and no official instruction prefixes.
      return {
        endpoint: config.endpoint,
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: buildOpenAIEmbeddingBody(config, texts),
      };
    },
    parseResponse(json: unknown, expectedCount: number): CloudEmbeddingParseResult {
      return parseOpenAIEmbeddingResponse(json, expectedCount);
    },
  };
}

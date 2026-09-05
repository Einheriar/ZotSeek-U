/** Alibaba Bailian native text-embedding request adapter. */

import { CLOUD_OUTPUT_TYPE } from './cloud-model-config';
import {
  CloudEmbeddingRequestError,
  type CloudEmbeddingHttpRequest,
  type CloudEmbeddingKind,
  type CloudEmbeddingParseResult,
  type CloudEmbeddingRequestAdapter,
} from './cloud-embedding-client';

export type { CloudEmbeddingKind } from './cloud-embedding-client';

export const DASHSCOPE_TEXT_EMBEDDING_PATH =
  '/services/embeddings/text-embedding/text-embedding';

export interface DashScopeEmbeddingAdapterConfig {
  modelName: string;
  dimensions: number;
  queryRole: string;
  documentRole: string;
}

export function dashScopeEmbeddingEndpoint(baseUrl: string): string {
  const url = new URL(baseUrl);
  // Cloud settings retain the compatible-mode URL because brief generation
  // shares it. Only the provider adapter crosses into the native API surface.
  url.pathname = `/api/v1${DASHSCOPE_TEXT_EMBEDDING_PATH}`;
  url.search = '';
  url.hash = '';
  return url.href;
}

export function buildDashScopeEmbeddingBody(
  config: DashScopeEmbeddingAdapterConfig,
  texts: string[],
  kind: CloudEmbeddingKind,
): Record<string, unknown> {
  const role = kind === 'query' ? config.queryRole : config.documentRole;
  return {
    model: config.modelName,
    input: { texts },
    parameters: {
      dimension: config.dimensions,
      output_type: CLOUD_OUTPUT_TYPE,
      ...(role ? { text_type: role } : {}),
    },
  };
}

export function parseDashScopeEmbeddingResponse(
  json: unknown,
  expectedCount: number,
): CloudEmbeddingParseResult {
  const data = (json as any)?.output?.embeddings;
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
    const index = entry?.text_index;
    const embedding = entry?.embedding;
    if (!Number.isInteger(index) || index < 0 || index >= expectedCount || seen.has(index)) {
      throw new CloudEmbeddingRequestError('Cloud provider returned invalid embedding text indexes.', 502);
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
    requestId: typeof (json as any)?.request_id === 'string' ? (json as any).request_id : undefined,
    totalTokens: typeof totalTokens === 'number' && Number.isFinite(totalTokens)
      ? totalTokens
      : undefined,
  };
}

export function createDashScopeEmbeddingAdapter(config: {
  baseUrl: string;
  modelName: string;
  dimensions: number;
  queryRole: string;
  documentRole: string;
  apiKey: string;
}): CloudEmbeddingRequestAdapter {
  const bodyConfig: DashScopeEmbeddingAdapterConfig = {
    modelName: config.modelName,
    dimensions: config.dimensions,
    queryRole: config.queryRole,
    documentRole: config.documentRole,
  };
  return {
    buildRequest(texts: string[], kind: CloudEmbeddingKind): CloudEmbeddingHttpRequest {
      return {
        endpoint: dashScopeEmbeddingEndpoint(config.baseUrl),
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: buildDashScopeEmbeddingBody(bodyConfig, texts, kind),
      };
    },
    parseResponse(json: unknown, expectedCount: number): CloudEmbeddingParseResult {
      return parseDashScopeEmbeddingResponse(json, expectedCount);
    },
  };
}

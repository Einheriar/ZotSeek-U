/** Alibaba Bailian native text-embedding request adapter. */

import { CLOUD_OUTPUT_TYPE } from './cloud-model-config';

export const DASHSCOPE_TEXT_EMBEDDING_PATH =
  '/services/embeddings/text-embedding/text-embedding';

export type CloudEmbeddingKind = 'query' | 'document';

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

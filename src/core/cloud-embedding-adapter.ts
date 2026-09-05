/**
 * Factory mapping resolved Cloud settings to the matching request adapter.
 *
 * Built-in provider endpoints are fixed here; only the Custom
 * (OpenAI-compatible) provider takes a user-configured URL, which is
 * validated on every construction.
 */

import {
  CloudConfigRejectedError,
  customEmbeddingEndpoint,
  type CloudModelSettings,
} from './cloud-model-config';
import type { CloudEmbeddingRequestAdapter } from './cloud-embedding-client';
import { createDashScopeEmbeddingAdapter } from './dashscope-embedding-adapter';
import { createGeminiEmbeddingAdapter } from './gemini-embedding-adapter';
import { OPENAI_EMBEDDINGS_ENDPOINT, createOpenAIEmbeddingAdapter } from './openai-embedding-adapter';

export function createCloudEmbeddingRequestAdapter(
  settings: CloudModelSettings,
  apiKey: string,
): CloudEmbeddingRequestAdapter {
  switch (settings.provider) {
    case 'alibaba-bailian':
      return createDashScopeEmbeddingAdapter({
        baseUrl: settings.baseUrl,
        modelName: settings.modelName,
        dimensions: settings.dimensions,
        queryRole: settings.queryRole,
        documentRole: settings.documentRole,
        apiKey,
      });
    case 'openai':
      return createOpenAIEmbeddingAdapter({
        endpoint: OPENAI_EMBEDDINGS_ENDPOINT,
        modelName: settings.modelName,
        apiKey,
        sendDimensions: true,
        dimensions: settings.dimensions,
      });
    case 'google-gemini-api':
      return createGeminiEmbeddingAdapter({
        modelName: settings.modelName,
        apiKey,
        queryTaskType: settings.queryRole,
        documentTaskType: settings.documentRole,
        outputDimensionality: settings.dimensions,
      });
    case 'custom-openai-compatible':
      if (!settings.customBaseUrl) {
        throw new CloudConfigRejectedError(
          'The Custom (OpenAI-compatible) provider has no Base URL.',
        );
      }
      return createOpenAIEmbeddingAdapter({
        endpoint: customEmbeddingEndpoint(settings.customBaseUrl),
        modelName: settings.modelName,
        apiKey,
        // Never send `dimensions` to unknown gateways: the configured value
        // is enforced by response validation instead.
        sendDimensions: false,
      });
  }
}

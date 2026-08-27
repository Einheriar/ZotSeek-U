/**
 * Model input facts and ZotSeek runtime policy defaults.
 *
 * Identity, dimensions, pooling, prefixes and file locations stay in the
 * model registry. This module owns the input contract that chunking and
 * inference must share.
 */

import { MODELS, type ModelConfig } from './model-registry';

export type ModelQuantization = 'q8' | 'fp16' | 'fp32' | 'server-managed';
export type TokenizerType = 'bert' | 'xlm-roberta' | 'server-managed';

export interface ModelInputConfig {
  maxInputTokens: number | null;
  recommendedChunkTokens: number;
  // Lossless upstream split threshold, never a pre-inference truncation limit.
  maxChunkChars: number;
  quantization: ModelQuantization;
  tokenizerType: TokenizerType;
  supportsExactTokenCount: boolean;
}

export const LOCAL_MODEL_INPUT_CONFIGS: Readonly<Record<string, ModelInputConfig>> = Object.freeze({
  'nomic-embed-text-v1.5': Object.freeze({
    maxInputTokens: 8192,
    recommendedChunkTokens: 2000,
    maxChunkChars: 8000,
    quantization: 'q8',
    tokenizerType: 'bert',
    supportsExactTokenCount: false,
  }),
  'multilingual-e5-base': Object.freeze({
    maxInputTokens: 512,
    recommendedChunkTokens: 420,
    maxChunkChars: 8000,
    quantization: 'q8',
    tokenizerType: 'xlm-roberta',
    supportsExactTokenCount: true,
  }),
  'bge-m3': Object.freeze({
    maxInputTokens: 8192,
    recommendedChunkTokens: 2000,
    maxChunkChars: 8000,
    quantization: 'q8',
    tokenizerType: 'xlm-roberta',
    supportsExactTokenCount: true,
  }),
});

export function getModelInputConfig(model: ModelConfig): ModelInputConfig {
  if (model.runtime === 'server') {
    if (!model.serverMaxInputTokens || !model.serverRecommendedChunkTokens) {
      throw new Error(`Server model "${model.id}" is missing its input contract`);
    }
    return {
      maxInputTokens: model.serverMaxInputTokens,
      recommendedChunkTokens: model.serverRecommendedChunkTokens,
      maxChunkChars: 8000,
      quantization: 'server-managed',
      tokenizerType: 'server-managed',
      supportsExactTokenCount: false,
    };
  }
  const config = LOCAL_MODEL_INPUT_CONFIGS[model.id];
  if (!config) throw new Error(`Missing input config for local model "${model.id}"`);
  return config;
}

/** Return every registry/config integrity problem without depending on Zotero. */
export function validateModelInputConfigs(models: readonly ModelConfig[] = MODELS): string[] {
  const errors: string[] = [];
  const localIds = new Set(models.filter(model => model.runtime === 'onnx').map(model => model.id));

  for (const id of localIds) {
    const config = LOCAL_MODEL_INPUT_CONFIGS[id];
    if (!config) {
      errors.push(`Missing input config for ${id}`);
      continue;
    }
    if (config.maxInputTokens !== null && config.recommendedChunkTokens > config.maxInputTokens) {
      errors.push(`Recommended chunk size exceeds the input limit for ${id}`);
    }
    if (config.recommendedChunkTokens <= 0 || config.maxChunkChars <= 0) {
      errors.push(`Input limits must be positive for ${id}`);
    }
  }

  for (const id of Object.keys(LOCAL_MODEL_INPUT_CONFIGS)) {
    if (!localIds.has(id)) errors.push(`Orphan input config for ${id}`);
  }
  return errors;
}

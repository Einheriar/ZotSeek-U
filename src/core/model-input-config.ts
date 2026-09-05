/**
 * Model input facts and ZotSeek runtime policy defaults.
 *
 * Identity, dimensions, pooling, prefixes and file locations stay in the
 * model registry. This module owns the input contract that chunking and
 * inference must share.
 */

import { MODELS, type ModelConfig } from './model-registry';
import {
  calculateRecommendedChunkTokens,
  calculateSoftMinTokens,
  validateChunkProfile,
  fixedChunkProfile,
  type ModelChunkProfile,
} from './model-chunk-profile';

export type ModelQuantization = 'q8' | 'fp16' | 'fp32' | 'server-managed';
export type TokenizerType = 'bert' | 'xlm-roberta' | 'server-managed';

export interface ModelInputConfig {
  maxInputTokens: number | null;
  recommendedChunkTokens: number;
  softMinTokens: number;
  chunkProfile: ModelChunkProfile;
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
    softMinTokens: 500,
    chunkProfile: fixedChunkProfile(2000),
    maxChunkChars: 8000,
    quantization: 'q8',
    tokenizerType: 'bert',
    supportsExactTokenCount: false,
  }),
  'multilingual-e5-base': Object.freeze({
    maxInputTokens: 512,
    recommendedChunkTokens: 420,
    softMinTokens: 105,
    chunkProfile: fixedChunkProfile(420),
    maxChunkChars: 8000,
    quantization: 'q8',
    tokenizerType: 'xlm-roberta',
    supportsExactTokenCount: true,
  }),
  'bge-m3': Object.freeze({
    maxInputTokens: 8192,
    recommendedChunkTokens: 2000,
    softMinTokens: 500,
    chunkProfile: fixedChunkProfile(2000),
    maxChunkChars: 8000,
    quantization: 'q8',
    tokenizerType: 'xlm-roberta',
    supportsExactTokenCount: true,
  }),
});

export function getModelInputConfig(model: ModelConfig): ModelInputConfig {
  if (model.runtime === 'server') {
    if (!model.serverMaxInputTokens || !model.serverRecommendedChunkTokens) {
      throw new Error(`Local Server model "${model.id}" is missing its input contract`);
    }
    const recommendedChunkTokens = calculateRecommendedChunkTokens(model.chunkProfile, model.serverMaxInputTokens);
    return {
      maxInputTokens: model.serverMaxInputTokens,
      recommendedChunkTokens,
      softMinTokens: calculateSoftMinTokens(model.chunkProfile, recommendedChunkTokens),
      chunkProfile: model.chunkProfile,
      maxChunkChars: 8000,
      quantization: 'server-managed',
      tokenizerType: 'server-managed',
      supportsExactTokenCount: false,
    };
  }
  if (model.runtime === 'cloud') {
    if (!model.serverMaxInputTokens || !model.serverRecommendedChunkTokens) {
      throw new Error(`Cloud model "${model.id}" is missing its input contract`);
    }
    const recommendedChunkTokens = calculateRecommendedChunkTokens(model.chunkProfile, model.serverMaxInputTokens);
    return {
      maxInputTokens: model.serverMaxInputTokens,
      recommendedChunkTokens,
      softMinTokens: calculateSoftMinTokens(model.chunkProfile, recommendedChunkTokens),
      chunkProfile: model.chunkProfile,
      maxChunkChars: 8000,
      quantization: 'server-managed',
      tokenizerType: 'server-managed',
      supportsExactTokenCount: false,
    };
  }
  const config = LOCAL_MODEL_INPUT_CONFIGS[model.id];
  if (!config) throw new Error(`Missing input config for local model "${model.id}"`);
  // The registry profile is the source of truth for runtime chunking. The
  // local table retains the other model facts and is validated against it.
  const recommendedChunkTokens = calculateRecommendedChunkTokens(model.chunkProfile, config.maxInputTokens);
  return {
    ...config,
    recommendedChunkTokens,
    softMinTokens: calculateSoftMinTokens(model.chunkProfile, recommendedChunkTokens),
    chunkProfile: model.chunkProfile,
  };
}

/** Return every registry/config integrity problem without depending on Zotero. */
export function validateModelInputConfigs(models: readonly ModelConfig[] = MODELS): string[] {
  const errors: string[] = [];
  for (const model of models) {
    errors.push(...validateChunkProfile(model.chunkProfile, model.id));
    if (model.runtime !== 'onnx' && model.serverMaxInputTokens && model.serverRecommendedChunkTokens) {
      const calculated = calculateRecommendedChunkTokens(model.chunkProfile, model.serverMaxInputTokens);
      if (calculated !== model.serverRecommendedChunkTokens) {
        errors.push(`Registered chunk profile does not match the input contract for ${model.id}`);
      }
    }
  }
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
    errors.push(...validateChunkProfile(config.chunkProfile, id));
    const model = models.find(candidate => candidate.id === id);
    if (model && JSON.stringify(config.chunkProfile) !== JSON.stringify(model.chunkProfile)) {
      errors.push(`Local input config profile does not match the registry profile for ${id}`);
    }
    if (model) {
      const recommended = calculateRecommendedChunkTokens(model.chunkProfile, config.maxInputTokens);
      if (recommended !== config.recommendedChunkTokens ||
          calculateSoftMinTokens(model.chunkProfile, recommended) !== config.softMinTokens) {
        errors.push(`Local input config recommendation does not match the registry profile for ${id}`);
      }
    }
  }

  for (const id of Object.keys(LOCAL_MODEL_INPUT_CONFIGS)) {
    if (!localIds.has(id)) errors.push(`Orphan input config for ${id}`);
  }
  return errors;
}

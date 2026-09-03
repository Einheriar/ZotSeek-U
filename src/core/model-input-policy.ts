/** Pure model-aware chunk policy resolution. */

import { requiresInstructionPrefix, type ModelConfig } from './model-registry';
import { getModelInputConfig } from './model-input-config';

export const MODEL_INPUT_POLICY_VERSION = 1;

export interface ResolvedModelInputPolicy {
  modelId: string;
  requestedChunkTokens: number;
  effectiveChunkTokens: number;
  maxInputTokens: number | null;
  recommendedChunkTokens: number;
  maxChunkChars: number;
  requiresInstructionPrefix: boolean;
  supportsExactTokenCount: boolean;
  policyVersion: number;
  usesUserOverride: boolean;
  runtime: ModelConfig['runtime'];
  docPrefix: string;
}

export function normalizeRequestedChunkTokens(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.floor(value);
}

export function resolveModelInputPolicy(
  model: ModelConfig,
  requestedValue?: unknown,
): ResolvedModelInputPolicy {
  const config = getModelInputConfig(model);
  const requestedOverride = normalizeRequestedChunkTokens(requestedValue);
  const requestedChunkTokens = requestedOverride ?? config.recommendedChunkTokens;
  const effectiveChunkTokens = config.maxInputTokens === null
    ? requestedChunkTokens
    : Math.min(requestedChunkTokens, config.maxInputTokens);

  return {
    modelId: model.id,
    requestedChunkTokens,
    effectiveChunkTokens,
    maxInputTokens: config.maxInputTokens,
    recommendedChunkTokens: config.recommendedChunkTokens,
    maxChunkChars: config.maxChunkChars,
    requiresInstructionPrefix: requiresInstructionPrefix(model),
    supportsExactTokenCount: config.supportsExactTokenCount,
    policyVersion: MODEL_INPUT_POLICY_VERSION,
    usesUserOverride: requestedOverride !== undefined,
    runtime: model.runtime,
    docPrefix: model.docPrefix,
  };
}

/** The old plugin wrote 450 as a default, so it is not a reliable override. */
export function shouldClearLegacyDefaultChunkPreference(
  value: unknown,
  migrationAlreadyApplied: boolean,
): boolean {
  return !migrationAlreadyApplied && value === 450;
}

export function modelInputPolicyFingerprint(policy: ResolvedModelInputPolicy): string {
  const parts: Array<string | number> = [
    `v${policy.policyVersion}`,
    policy.modelId,
    policy.effectiveChunkTokens,
    policy.maxInputTokens ?? 'unknown',
    policy.maxChunkChars,
    policy.supportsExactTokenCount ? 'exact' : 'estimated',
  ];
  // Remote document prefixes are user-editable input-contract data. A change
  // alters every stored document vector and must be visible to reconciliation.
  if (policy.runtime === 'server' || policy.runtime === 'cloud') {
    parts.push(`doc=${encodeURIComponent(policy.docPrefix)}`);
  }
  return parts.join(':');
}

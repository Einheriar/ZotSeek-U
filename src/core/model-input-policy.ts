/** Pure model-aware chunk policy resolution. */

import { CLOUD_OUTPUT_TYPE } from './cloud-model-config';
import { requiresInstructionPrefix, type ModelConfig } from './model-registry';
import { getModelInputConfig } from './model-input-config';

export const MODEL_INPUT_POLICY_VERSION = 1;
export const CLOUD_TOKEN_ESTIMATOR_VERSION = 1;

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
  cloudDocumentRole?: string;
  cloudApiAdapterVersion?: string;
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
    cloudDocumentRole: model.cloudDocumentRole,
    cloudApiAdapterVersion: model.cloudApiAdapterVersion,
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
  // Only Cloud changes chunk boundaries under Plan 47. Keep every other
  // model's existing fingerprint stable to avoid unrelated rebuild prompts.
  if (policy.runtime === 'cloud' && !policy.supportsExactTokenCount) {
    parts.push(`estimate=cloud-multilingual-v${CLOUD_TOKEN_ESTIMATOR_VERSION}`);
  }
  // Local-server prefixes are textual model-contract data. A change alters
  // every stored document vector and must be visible to reconciliation.
  if (policy.runtime === 'server') {
    parts.push(`doc=${encodeURIComponent(policy.docPrefix)}`);
  }
  // Cloud task roles are provider API parameters, not text prefixes. Persist
  // the complete document-side contract so adapter/role changes cannot mix
  // incompatible vectors in one model partition.
  if (policy.runtime === 'cloud') {
    parts.push(
      `adapter=${encodeURIComponent(policy.cloudApiAdapterVersion || 'unknown')}`,
      `role=${encodeURIComponent(policy.cloudDocumentRole || '')}`,
      `output=${CLOUD_OUTPUT_TYPE}`,
      'instruct=none',
    );
  }
  return parts.join(':');
}

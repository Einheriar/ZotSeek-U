/** Per-model chunk recommendation and grouping policy. */

export type ChunkRecommendation =
  | { kind: 'fixed'; defaultTokens: number }
  | { kind: 'ratio-cap'; ratio: number; cap: number };

export interface ModelChunkProfile {
  defaultChunkTokens: number;
  recommendation: ChunkRecommendation;
  softMinRatio: number;
}

export function fixedChunkProfile(defaultTokens: number, softMinRatio = 0.25): ModelChunkProfile {
  return Object.freeze({
    defaultChunkTokens: defaultTokens,
    recommendation: Object.freeze({ kind: 'fixed', defaultTokens }),
    softMinRatio,
  });
}

export function calculateRecommendedChunkTokens(
  profile: ModelChunkProfile,
  maxInputTokens: number | null,
): number {
  const calculated = profile.recommendation.kind === 'fixed'
    ? profile.recommendation.defaultTokens
    : Math.min(
      profile.recommendation.cap,
      Math.floor(maxInputTokens === null
        ? profile.defaultChunkTokens
        : maxInputTokens * profile.recommendation.ratio),
    );
  return maxInputTokens === null
    ? Math.max(1, calculated)
    : Math.max(1, Math.min(calculated, maxInputTokens));
}

export function calculateSoftMinTokens(profile: ModelChunkProfile, recommendedChunkTokens: number): number {
  return Math.max(1, Math.floor(recommendedChunkTokens * profile.softMinRatio));
}

export function validateChunkProfile(profile: ModelChunkProfile, modelId: string): string[] {
  const errors: string[] = [];
  if (!Number.isSafeInteger(profile.defaultChunkTokens) || profile.defaultChunkTokens <= 0) {
    errors.push(`Default chunk size must be positive for ${modelId}`);
  }
  if (!Number.isFinite(profile.softMinRatio) || profile.softMinRatio <= 0 || profile.softMinRatio > 1) {
    errors.push(`Soft-min ratio must be between 0 and 1 for ${modelId}`);
  }
  if (profile.recommendation.kind === 'fixed') {
    if (profile.recommendation.defaultTokens !== profile.defaultChunkTokens) {
      errors.push(`Fixed recommendation must match the default chunk size for ${modelId}`);
    }
  } else if (!Number.isFinite(profile.recommendation.ratio) || profile.recommendation.ratio <= 0
    || profile.recommendation.ratio > 1 || !Number.isSafeInteger(profile.recommendation.cap)
    || profile.recommendation.cap <= 0) {
    errors.push(`Invalid ratio-cap recommendation for ${modelId}`);
  }
  return errors;
}

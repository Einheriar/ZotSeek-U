export interface IntegerPreferenceBounds {
  min: number;
  max: number;
  defaultValue: number;
}

export const MAX_CHUNKS_PER_PAPER_BOUNDS: IntegerPreferenceBounds = Object.freeze({
  min: 1,
  max: 200,
  defaultValue: 100,
});

export const SEARCH_TOP_K_BOUNDS: IntegerPreferenceBounds = Object.freeze({
  min: 5,
  max: 100,
  defaultValue: 20,
});

export const MIN_SIMILARITY_PERCENT_BOUNDS: IntegerPreferenceBounds = Object.freeze({
  min: 0,
  max: 100,
  defaultValue: 70,
});

/** Defensive core read: finite numbers are truncated and clamped; other values use the default. */
export function normalizeIntegerPreference(
  value: unknown,
  bounds: IntegerPreferenceBounds,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return bounds.defaultValue;
  return Math.max(bounds.min, Math.min(bounds.max, Math.trunc(value)));
}

/** UI commit parser: invalid, fractional, or out-of-range text is rejected rather than clamped. */
export function parseIntegerPreferenceInput(
  value: string,
  bounds: IntegerPreferenceBounds,
): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < bounds.min || parsed > bounds.max) return null;
  return parsed;
}

export function normalizeMaxChunksPerPaper(value: unknown): number {
  return normalizeIntegerPreference(value, MAX_CHUNKS_PER_PAPER_BOUNDS);
}

export function normalizeSearchTopK(value: unknown): number {
  return normalizeIntegerPreference(value, SEARCH_TOP_K_BOUNDS);
}

export function normalizeMinSimilarityPercent(value: unknown): number {
  return normalizeIntegerPreference(value, MIN_SIMILARITY_PERCENT_BOUNDS);
}

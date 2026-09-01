export type CanonicalIndexingMode = 'abstract' | 'notes' | 'full';

/** Normalize persisted machine values, including pre-fork legacy values. */
export function normalizeStoredIndexingMode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  switch (raw.toLowerCase()) {
    case 'abstract':
      return 'abstract';
    case 'notes':
      return 'notes';
    case 'full':
    case 'fulltext':
    case 'hybrid':
      return 'full';
    default:
      // Preserve an unknown future machine value so the UI can require a
      // rebuild instead of silently treating it as the current strategy.
      return raw;
  }
}

export function isCanonicalIndexingMode(value: string): value is CanonicalIndexingMode {
  return value === 'abstract' || value === 'notes' || value === 'full';
}

export function hasIndexingModeMismatch(
  indexedMode: string | undefined,
  currentMode: CanonicalIndexingMode,
  indexedPapers: number,
): boolean {
  return indexedPapers > 0 && indexedMode !== undefined && indexedMode !== currentMode;
}

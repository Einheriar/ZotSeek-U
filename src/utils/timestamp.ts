/** Parse Zotero SQL timestamps and ISO-8601 timestamps as UTC milliseconds. */
export function parseTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let normalized = trimmed.includes('T')
    ? trimmed
    : trimmed.replace(' ', 'T');
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) {
    normalized += 'Z';
  }

  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** True only when an item changed after every successful index verification. */
export function isModifiedAfterVerification(
  dateModified: unknown,
  ...verifiedTimestamps: unknown[]
): boolean {
  const modifiedAt = parseTimestamp(dateModified);
  if (modifiedAt === null) return false;

  const verified = verifiedTimestamps
    .map(parseTimestamp)
    .filter((value): value is number => value !== null);
  if (verified.length === 0) return false;
  return modifiedAt > Math.max(...verified);
}

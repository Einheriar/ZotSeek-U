/**
 * Canonical Metadata/Summary input shared by every indexing mode.
 *
 * Workflow tags prefixed with `#` remain available to Zotero and exclusion
 * rules, but they are deliberately omitted from semantic embedding text.
 */

export const INDEXED_ABSTRACT_MIN_CHARS = 50;

export interface IndexedMetadataItemLike {
  getField?: (field: string) => unknown;
  getTags?: () => unknown[];
}

export interface IndexedMetadataSnapshot {
  /** Full title used by existing chunkers and stored item metadata. */
  title: string;
  /** Original abstract when it passes the shared noise guard. */
  abstract: string | null;
  /** Trimmed, sorted tags that are eligible for semantic indexing. */
  tags: string[];
  /** Abstract and Tags body passed to the Summary chunker. */
  body: string | null;
}

function tagText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  return String((value as { tag?: unknown }).tag ?? '').trim();
}

/** Build the exact mode-independent Metadata payload used for embeddings. */
export function buildIndexedMetadataSnapshot(
  item: IndexedMetadataItemLike,
  fallbackTitle = '',
): IndexedMetadataSnapshot {
  const title = String(item?.getField?.('title') || fallbackTitle);
  const rawAbstractValue = item?.getField?.('abstractNote');
  const rawAbstract = rawAbstractValue ? String(rawAbstractValue) : '';
  const abstract = rawAbstract.trim().length >= INDEXED_ABSTRACT_MIN_CHARS
    ? rawAbstract
    : null;
  const tags = (item?.getTags?.() || [])
    .map(tagText)
    .filter(tag => tag.length > 0 && !tag.startsWith('#'))
    .sort((a, b) => a.localeCompare(b));
  const body = [
    abstract,
    tags.length > 0 ? `Tags: ${tags.join(', ')}` : null,
  ].filter((part): part is string => !!part && part.trim().length > 0)
    .join('\n\n');

  return {
    title,
    abstract,
    tags,
    body: body || null,
  };
}

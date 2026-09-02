export type IndexExclusionReason = 'exclude-tag' | 'exclude-book';

export type IndexExclusionPolicy = Readonly<{
  excludeBooks: boolean;
  excludeTag: string;
}>;

/** Capture the index-exclusion preferences as stable machine values. */
export function readIndexExclusionPolicy(zotero: any): IndexExclusionPolicy {
  let excludeBooks = false;
  let excludeTag = '';
  try {
    excludeBooks = (zotero?.Prefs?.get?.('zotseek.excludeBooks', true) ?? true) === true;
    excludeTag = String(zotero?.Prefs?.get?.('zotseek.excludeTag', true) || '').trim();
  } catch {
    // A preference read failure must never become a destructive match.
  }
  return { excludeBooks, excludeTag };
}

/** Return the policy reason that makes an item ineligible for indexing. */
export function getIndexExclusionReason(
  item: any,
  policy: IndexExclusionPolicy,
): IndexExclusionReason | null {
  if (policy.excludeTag && typeof item?.getTags === 'function') {
    try {
      const tags = item.getTags() as Array<{ tag?: unknown }>;
      if (tags.some(tag => String(tag?.tag || '') === policy.excludeTag)) {
        return 'exclude-tag';
      }
    } catch {
      // A transient tag read failure must not turn into a destructive match.
    }
  }
  if (policy.excludeBooks && item?.itemType === 'book') {
    return 'exclude-book';
  }
  return null;
}

export function isItemExcludedFromIndex(
  item: any,
  policy: IndexExclusionPolicy,
): boolean {
  return getIndexExclusionReason(item, policy) !== null;
}

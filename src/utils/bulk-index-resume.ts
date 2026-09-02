export const BULK_INDEX_PENDING_PREF = 'zotseek.bulkIndex.pendingScope';
export const BULK_INDEX_RESUME_THRESHOLD = 25;

export type BulkIndexScope =
  | { type: 'library'; libraryId: number }
  | { type: 'all-libraries' }
  | { type: 'collection'; libraryId: number; collectionId: number }
  | { type: 'collections'; collections: Array<{ libraryId: number; collectionId: number }> }
  | { type: 'items'; items: Array<{ libraryKey: string; itemKey: string }> };

export function isBulkIndexScope(value: unknown): value is BulkIndexScope {
  if (!value || typeof value !== 'object') return false;
  const scope = value as any;
  if (scope.type === 'all-libraries') return true;
  if (scope.type === 'library') return Number.isFinite(scope.libraryId);
  if (scope.type === 'collection') {
    return Number.isFinite(scope.libraryId) && Number.isFinite(scope.collectionId);
  }
  if (scope.type === 'collections' && Array.isArray(scope.collections)) {
    return scope.collections.every((entry: any) =>
      Number.isFinite(entry?.libraryId) && Number.isFinite(entry?.collectionId));
  }
  if (scope.type === 'items' && Array.isArray(scope.items)) {
    return scope.items.length > 0 && scope.items.every((entry: any) =>
      typeof entry?.libraryKey === 'string' && entry.libraryKey.length > 0 &&
      typeof entry?.itemKey === 'string' && entry.itemKey.length > 0);
  }
  return false;
}

/** Compare persisted scopes without treating item/collection ordering as identity. */
export function bulkIndexScopesEqual(left: BulkIndexScope, right: BulkIndexScope): boolean {
  if (left.type !== right.type) return false;
  if (left.type === 'all-libraries' && right.type === 'all-libraries') return true;
  if (left.type === 'library' && right.type === 'library') {
    return left.libraryId === right.libraryId;
  }
  if (left.type === 'collection' && right.type === 'collection') {
    return left.libraryId === right.libraryId && left.collectionId === right.collectionId;
  }
  if (left.type === 'collections' && right.type === 'collections') {
    const normalize = (scope: typeof left) => scope.collections
      .map(entry => `${entry.libraryId}\u0000${entry.collectionId}`)
      .sort();
    return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
  }
  if (left.type === 'items' && right.type === 'items') {
    const normalize = (scope: typeof left) => scope.items
      .map(entry => `${entry.libraryKey}\u0000${entry.itemKey}`)
      .sort();
    return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
  }
  return false;
}

export type BulkIndexCompletion = {
  skipped: boolean;
  failed: number;
  outdated: number;
  paused?: boolean;
};

/** Persist the original scope, not the smaller set later classified as changed. */
export function shouldRecordBulkIndexScope(scope: unknown, itemCount: number): boolean {
  return scope !== null && scope !== undefined && itemCount >= BULK_INDEX_RESUME_THRESHOLD;
}

/** Retryable failures keep the marker; a completed all-current pass clears it. */
export function shouldClearBulkIndexScope(result: BulkIndexCompletion): boolean {
  return !result.paused && !result.skipped && result.failed === 0 && result.outdated === 0;
}

/** Never clear another operation's recovery marker after a small manual run. */
export function shouldClearMatchingBulkIndexScope(
  pending: BulkIndexScope,
  completed: BulkIndexScope,
  result: BulkIndexCompletion,
): boolean {
  return shouldClearBulkIndexScope(result) && bulkIndexScopesEqual(pending, completed);
}

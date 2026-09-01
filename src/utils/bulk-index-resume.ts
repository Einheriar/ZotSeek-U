export const BULK_INDEX_PENDING_PREF = 'zotseek.bulkIndex.pendingScope';
export const BULK_INDEX_RESUME_THRESHOLD = 25;

export type BulkIndexCompletion = {
  skipped: boolean;
  failed: number;
  outdated: number;
};

/** Persist the original scope, not the smaller set later classified as changed. */
export function shouldRecordBulkIndexScope(scope: unknown, itemCount: number): boolean {
  return scope !== null && scope !== undefined && itemCount >= BULK_INDEX_RESUME_THRESHOLD;
}

/** Retryable failures keep the marker; a completed all-current pass clears it. */
export function shouldClearBulkIndexScope(result: BulkIndexCompletion): boolean {
  return !result.skipped && result.failed === 0 && result.outdated === 0;
}

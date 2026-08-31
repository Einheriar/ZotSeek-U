/** Minimal result shape needed by the manual incremental-sync UI. */
export interface ManualIndexCheckResult {
  checked: number;
  indexedNew: number;
  rebuilt: number;
  notesUpdated: number;
  removed: number;
  skipped: boolean;
}

export type ManualIndexCheckPresentation =
  | { kind: 'skipped' }
  | {
      kind: 'complete';
      checked: number;
      changed: number;
      removed: number;
    };

/** Keep a skipped reconciliation distinct from a successful zero-change run. */
export function getManualIndexCheckPresentation(
  result: ManualIndexCheckResult,
): ManualIndexCheckPresentation {
  if (result.skipped) return { kind: 'skipped' };
  return {
    kind: 'complete',
    checked: result.checked,
    changed: result.indexedNew + result.rebuilt + result.notesUpdated,
    removed: result.removed,
  };
}

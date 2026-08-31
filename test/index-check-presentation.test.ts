import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getManualIndexCheckPresentation } from '../src/utils/index-check-presentation';

const baseResult = {
  checked: 150,
  indexedNew: 2,
  rebuilt: 3,
  notesUpdated: 4,
  removed: 5,
  skipped: false,
};

describe('manual incremental-sync result presentation', () => {
  test('does not present a skipped run as a successful zero-change sync', () => {
    assert.deepEqual(
      getManualIndexCheckPresentation({
        ...baseResult,
        checked: 0,
        indexedNew: 0,
        rebuilt: 0,
        notesUpdated: 0,
        removed: 0,
        skipped: true,
      }),
      { kind: 'skipped' },
    );
  });

  test('summarizes a completed run with all changed-item categories', () => {
    assert.deepEqual(getManualIndexCheckPresentation(baseResult), {
      kind: 'complete',
      checked: 150,
      changed: 9,
      removed: 5,
    });
  });
});

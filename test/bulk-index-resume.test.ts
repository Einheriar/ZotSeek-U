import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BULK_INDEX_RESUME_THRESHOLD,
  shouldClearBulkIndexScope,
  shouldRecordBulkIndexScope,
} from '../src/utils/bulk-index-resume';

describe('bulk index resume marker decisions', () => {
  test('records the original large scope even when few items may later need work', () => {
    const scope = { type: 'collection', libraryId: 1, collectionId: 10 };
    assert.equal(shouldRecordBulkIndexScope(scope, BULK_INDEX_RESUME_THRESHOLD - 1), false);
    assert.equal(shouldRecordBulkIndexScope(scope, BULK_INDEX_RESUME_THRESHOLD), true);
    assert.equal(shouldRecordBulkIndexScope(undefined, 150), false);
  });

  test('clears only after a completed pass with no retryable stale items', () => {
    assert.equal(shouldClearBulkIndexScope({ skipped: false, failed: 0, outdated: 0 }), true);
    assert.equal(shouldClearBulkIndexScope({ skipped: false, failed: 1, outdated: 1 }), false);
    assert.equal(shouldClearBulkIndexScope({ skipped: true, failed: 0, outdated: 0 }), false);
  });
});

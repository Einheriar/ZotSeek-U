import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BULK_INDEX_RESUME_THRESHOLD,
  bulkIndexScopesEqual,
  isBulkIndexScope,
  shouldClearBulkIndexScope,
  shouldClearMatchingBulkIndexScope,
  shouldRecordBulkIndexScope,
} from '../src/utils/bulk-index-resume';

describe('bulk index resume marker decisions', () => {
  test('records the original large scope even when few items may later need work', () => {
    const scope = { type: 'collection', libraryId: 1, collectionId: 10 };
    assert.equal(shouldRecordBulkIndexScope(scope, BULK_INDEX_RESUME_THRESHOLD - 1), false);
    assert.equal(shouldRecordBulkIndexScope(scope, BULK_INDEX_RESUME_THRESHOLD), true);
    assert.equal(shouldRecordBulkIndexScope(undefined, 150), false);
  });

  test('accepts selected-item scopes only with stable identities', () => {
    assert.equal(isBulkIndexScope({
      type: 'items',
      items: [
        { libraryKey: 'user', itemKey: 'ABCDEFGH' },
        { libraryKey: 'group:42', itemKey: 'HGFEDCBA' },
      ],
    }), true);
    assert.equal(isBulkIndexScope({ type: 'items', items: [] }), false);
    assert.equal(isBulkIndexScope({
      type: 'items',
      items: [{ libraryId: 1, itemId: 2 }],
    }), false);
  });

  test('matches the same selected scope regardless of item order', () => {
    const first = {
      type: 'items' as const,
      items: [
        { libraryKey: 'user', itemKey: 'A' },
        { libraryKey: 'group:42', itemKey: 'B' },
      ],
    };
    const reordered = { type: 'items' as const, items: [...first.items].reverse() };
    const different = {
      type: 'items' as const,
      items: [{ libraryKey: 'user', itemKey: 'A' }],
    };
    assert.equal(bulkIndexScopesEqual(first, reordered), true);
    assert.equal(bulkIndexScopesEqual(first, different), false);
  });

  test('clears only after a completed pass with no retryable stale items', () => {
    assert.equal(shouldClearBulkIndexScope({ skipped: false, failed: 0, outdated: 0 }), true);
    assert.equal(shouldClearBulkIndexScope({ skipped: false, failed: 1, outdated: 1 }), false);
    assert.equal(shouldClearBulkIndexScope({ skipped: true, failed: 0, outdated: 0 }), false);
    assert.equal(shouldClearBulkIndexScope({ skipped: false, failed: 0, outdated: 0, paused: true }), false);
  });

  test('clears a pending marker only after the same scope completes', () => {
    const pending = {
      type: 'items' as const,
      items: [{ libraryKey: 'user', itemKey: 'A' }],
    };
    const other = {
      type: 'items' as const,
      items: [{ libraryKey: 'user', itemKey: 'B' }],
    };
    const complete = { skipped: false, failed: 0, outdated: 0, paused: false };
    assert.equal(shouldClearMatchingBulkIndexScope(pending, pending, complete), true);
    assert.equal(shouldClearMatchingBulkIndexScope(pending, other, complete), false);
    assert.equal(shouldClearMatchingBulkIndexScope(pending, pending, { ...complete, paused: true }), false);
  });
});

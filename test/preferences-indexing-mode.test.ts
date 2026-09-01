import './helpers/zotero-stub';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  hasIndexingModeMismatch,
  normalizeStoredIndexingMode,
} from '../src/utils/indexing-mode';

describe('preferences indexing-mode mismatch', () => {
  test('normalizes persisted and legacy machine values', () => {
    assert.equal(normalizeStoredIndexingMode('abstract'), 'abstract');
    assert.equal(normalizeStoredIndexingMode('notes'), 'notes');
    assert.equal(normalizeStoredIndexingMode('fulltext'), 'full');
    assert.equal(normalizeStoredIndexingMode('hybrid'), 'full');
  });

  test('compares stable machine values without display labels', () => {
    assert.equal(hasIndexingModeMismatch('notes', 'notes', 150), false);
    assert.equal(hasIndexingModeMismatch('notes', 'full', 150), true);
  });

  test('display labels are not accepted as persisted machine values', () => {
    assert.equal(normalizeStoredIndexingMode('Metadata + Notes'), 'Metadata + Notes');
    assert.equal(hasIndexingModeMismatch('Metadata + Notes', 'notes', 150), true);
  });

  test('ignores mismatch checks for an empty index or missing metadata', () => {
    assert.equal(hasIndexingModeMismatch('notes', 'full', 0), false);
    assert.equal(hasIndexingModeMismatch(undefined, 'full', 150), false);
  });

  test('treats unknown stored modes as requiring a rebuild', () => {
    assert.equal(hasIndexingModeMismatch('future-mode', 'notes', 150), true);
  });
});

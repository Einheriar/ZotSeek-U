import './helpers/zotero-stub';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  DEFAULT_INDEXING_MODE,
  hasIndexingModeMismatch,
  normalizeCurrentIndexingMode,
  normalizeStoredIndexingMode,
} from '../src/utils/indexing-mode';

describe('preferences indexing-mode mismatch', () => {
  test('uses notes only for a missing current preference', () => {
    assert.equal(DEFAULT_INDEXING_MODE, 'notes');
    assert.equal(normalizeCurrentIndexingMode(undefined), 'notes');
    assert.equal(normalizeCurrentIndexingMode(null), 'notes');
    assert.equal(normalizeCurrentIndexingMode(''), 'notes');
    assert.equal(normalizeCurrentIndexingMode('abstract'), 'abstract');
    assert.equal(normalizeCurrentIndexingMode('full'), 'full');
    assert.equal(normalizeCurrentIndexingMode('future-mode'), 'abstract');
  });

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

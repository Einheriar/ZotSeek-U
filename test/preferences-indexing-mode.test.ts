import './helpers/zotero-stub';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  DEFAULT_INDEXING_MODE,
  hasIndexingModeMismatch,
  normalizeCurrentIndexingMode,
  normalizeStoredIndexingMode,
} from '../src/utils/indexing-mode';
import {
  MAX_CHUNKS_PER_PAPER_BOUNDS,
  MIN_SIMILARITY_PERCENT_BOUNDS,
  SEARCH_TOP_K_BOUNDS,
  normalizeMaxChunksPerPaper,
  normalizeMinSimilarityPercent,
  normalizeSearchTopK,
  parseIntegerPreferenceInput,
} from '../src/utils/numeric-preferences';

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

describe('numeric preference boundaries', () => {
  test('rejects malformed or out-of-range UI input instead of silently coercing it', () => {
    for (const value of ['', 'NaN', '1.5', '0', '-1', '201']) {
      assert.equal(parseIntegerPreferenceInput(value, MAX_CHUNKS_PER_PAPER_BOUNDS), null);
    }
    assert.equal(parseIntegerPreferenceInput('1', MAX_CHUNKS_PER_PAPER_BOUNDS), 1);
    assert.equal(parseIntegerPreferenceInput('200', MAX_CHUNKS_PER_PAPER_BOUNDS), 200);
  });

  test('normalizes untrusted core values with the same documented bounds', () => {
    assert.equal(normalizeMaxChunksPerPaper(undefined), 100);
    assert.equal(normalizeMaxChunksPerPaper(Number.NaN), 100);
    assert.equal(normalizeMaxChunksPerPaper('7'), 100);
    assert.equal(normalizeMaxChunksPerPaper(0), 1);
    assert.equal(normalizeMaxChunksPerPaper(-8), 1);
    assert.equal(normalizeMaxChunksPerPaper(4.9), 4);
    assert.equal(normalizeMaxChunksPerPaper(999), 200);

    assert.equal(normalizeSearchTopK(0), 5);
    assert.equal(normalizeSearchTopK(101), 100);
    assert.equal(normalizeSearchTopK(null), SEARCH_TOP_K_BOUNDS.defaultValue);
    assert.equal(normalizeMinSimilarityPercent(-1), 0);
    assert.equal(normalizeMinSimilarityPercent(101), 100);
    assert.equal(
      normalizeMinSimilarityPercent('70'),
      MIN_SIMILARITY_PERCENT_BOUNDS.defaultValue,
    );
  });
});

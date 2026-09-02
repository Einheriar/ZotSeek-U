import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getIndexExclusionReason,
  isItemExcludedFromIndex,
  readIndexExclusionPolicy,
} from '../src/utils/index-exclusion';

describe('index exclusion policy', () => {
  test('reads stable preference values and trims only the configured tag', () => {
    const values = new Map<string, unknown>([
      ['zotseek.excludeBooks', false],
      ['zotseek.excludeTag', '  no-zotseek  '],
    ]);
    const policy = readIndexExclusionPolicy({
      Prefs: { get: (key: string) => values.get(key) },
    });
    assert.deepEqual(policy, {
      excludeBooks: false,
      excludeTag: 'no-zotseek',
    });
  });

  test('distinguishes tag and book exclusions without localized labels', () => {
    const tagged = {
      itemType: 'journalArticle',
      getTags: () => [{ tag: 'no-zotseek' }],
    };
    const book = {
      itemType: 'book',
      getTags: () => [],
    };
    const policy = { excludeBooks: true, excludeTag: 'no-zotseek' } as const;

    assert.equal(getIndexExclusionReason(tagged, policy), 'exclude-tag');
    assert.equal(getIndexExclusionReason(book, policy), 'exclude-book');
    assert.equal(isItemExcludedFromIndex(tagged, policy), true);
    assert.equal(isItemExcludedFromIndex(book, { ...policy, excludeBooks: false }), false);
    assert.equal(isItemExcludedFromIndex(tagged, { ...policy, excludeTag: '' }), false);
  });

  test('a tag read failure never becomes a destructive exclusion match', () => {
    const item = {
      itemType: 'journalArticle',
      getTags: () => { throw new Error('not loaded'); },
    };
    assert.equal(isItemExcludedFromIndex(item, {
      excludeBooks: true,
      excludeTag: 'no-zotseek',
    }), false);
  });

  test('a preference read failure disables destructive exclusion matching', () => {
    const policy = readIndexExclusionPolicy({
      Prefs: { get: () => { throw new Error('prefs unavailable'); } },
    });
    assert.deepEqual(policy, { excludeBooks: false, excludeTag: '' });
  });
});

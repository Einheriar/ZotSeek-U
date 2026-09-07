import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { T0BM25Index, tokenizeT0 } from '../src/core/lexical-search';
import type { LexicalDocument } from '../src/core/lexical-search';

function doc(
  itemPk: number,
  itemKey: string,
  chunkIndex: number,
  chunkText: string,
  textSource: LexicalDocument['textSource'],
  libraryKey = 'user',
): LexicalDocument {
  return { itemPk, itemKey, itemId: itemPk, libraryKey, chunkIndex, chunkText, textSource };
}

describe('Plan 24C T0 production lexical search', () => {
  test('recovers Latin occurrences in merged Hangul segments without losing TF', (t) => {
    // Model the Gecko boundary; native Node normally separates these scripts.
    t.mock.method((Intl as any).Segmenter.prototype, 'segment', (text: string) =>
      text.split(/(\s+)/u).map(segment => ({ segment, isWordLike: /[\p{L}\p{N}]/u.test(segment) })));
    for (const text of ['EEG로 EEG로', 'EEG EEG로']) {
      assert.equal(tokenizeT0(text).get('eeg'), 2);
      assert.ok(tokenizeT0(text).has('eeg로'), 'preserve the original segment');
    }
    const index = new T0BM25Index([doc(1, 'KOREAN01', 0, 'EEG로', 'note')]);
    assert.equal(index.search('EEG')[0]?.itemKey, 'KOREAN01');
    for (const [text, query] of [['EEG로', 'EE'], ['EEG로', 'EG'], ['fMRI로', 'MRI'], ['EEG2로', 'EEG'], ['EEG2로', '2']]) {
      assert.equal(new T0BM25Index([doc(1, 'KOREAN01', 0, text, 'note')]).search(query).length, 0);
    }
    assert.equal(tokenizeT0('한EEG로').get('eeg'), 1);
    assert.equal(tokenizeT0('EEG2로').get('eeg2'), 1);
    assert.equal(tokenizeT0('café로').get('café'), 1);
  });

  test('does not duplicate Latin terms when the runtime already separates them', (t) => {
    t.mock.method((Intl as any).Segmenter.prototype, 'segment', () => [
      { segment: 'eeg', isWordLike: true }, { segment: '로', isWordLike: true },
      { segment: ' ', isWordLike: false }, { segment: 'eeg', isWordLike: true },
    ]);
    assert.equal(tokenizeT0('EEG로 EEG').get('eeg'), 2);
  });

  test('retains false-word-like Thai words without relaxing other scripts or marks', (t) => {
    t.mock.method((Intl as any).Segmenter.prototype, 'segment', (segment: string) =>
      [{ segment, isWordLike: false }]);
    assert.equal(tokenizeT0('ค้นหา').get('ค้นหา'), 1);
    const index = new T0BM25Index([doc(1, 'THAI0001', 0, 'ค้นหา', 'note')]);
    assert.equal(index.search('ค้นหา')[0]?.itemKey, 'THAI0001');
    for (const text of ['english', '123', '!!!', '🧠', '\u0301', '\u0E48', 'ค้นหาenglish']) {
      assert.equal(tokenizeT0(text).size, 0, text);
    }
  });

  test('combines Intl natural terms with CJK bigrams using max TF', () => {
    const terms = tokenizeT0('研究研究 Hybrid Search');
    assert.ok((terms.get('研究') ?? 0) >= 1);
    assert.ok(terms.has('hybrid'));
    assert.ok(terms.has('search'));
    assert.equal(terms.get('研究'), 2, 'natural/bigram overlap must not sum duplicate TF');
  });

  test('ranks the strongest BM25 chunk and aggregates to one row per paper', () => {
    const index = new T0BM25Index([
      doc(1, 'AAAA0001', 0, 'neural synchrony hyperscanning', 'summary'),
      doc(1, 'AAAA0001', 1, 'unrelated note', 'note'),
      doc(2, 'BBBB0002', 0, 'neural methods', 'summary'),
      doc(3, 'CCCC0003', 0, 'social interaction', 'summary'),
    ]);
    const results = index.search('neural synchrony', { limit: 10 });
    assert.equal(results[0].itemKey, 'AAAA0001');
    assert.equal(results[0].score, 1);
    assert.ok(results.every(result => result.score >= 0 && result.score <= 1));
    assert.equal(results.filter(result => result.itemKey === 'AAAA0001').length, 1);
  });

  test('reports corpus size diagnostics without retaining another text copy', () => {
    const index = new T0BM25Index([
      doc(1, 'AAAA0001', 0, '中文A', 'note'),
      doc(2, 'BBBB0002', 0, 'plain', 'summary'),
    ]);

    assert.equal(index.stats.documentCount, 2);
    assert.equal(index.stats.totalTextChars, 8);
    assert.equal(index.stats.totalTextBytes, 12);
    assert.ok(index.stats.termCount > 0);
    assert.ok(index.stats.postingCount >= index.stats.termCount);
  });

  test('isolates metadata/Notes and PDF corpora before computing BM25', () => {
    const index = new T0BM25Index([
      doc(1, 'NOTE0001', 0, 'shared phrase in note', 'note'),
      doc(2, 'PDF00002', 0, 'shared phrase in pdf', 'content'),
      doc(3, 'GROUP003', 0, 'shared phrase elsewhere', 'note', 'group:3'),
    ]);
    assert.deepEqual(
      index.search('shared phrase', { textSources: ['note'] }).map(row => row.itemKey),
      ['GROUP003', 'NOTE0001'],
    );
    assert.deepEqual(
      index.search('shared phrase', { textSources: ['content'] }).map(row => row.itemKey),
      ['PDF00002'],
    );
    assert.deepEqual(
      index.search('shared phrase', { textSources: ['note'], libraryKey: 'user' }).map(row => row.itemKey),
      ['NOTE0001'],
    );
  });
});

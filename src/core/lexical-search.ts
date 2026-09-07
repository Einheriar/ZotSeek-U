import type { TextSourceType } from './vector-store-sqlite';

export const T0_LEXICAL_CONTRACT_ID = 'intl-segmenter-zh-hans-cjk-bigram-v2';
export const T0_BM25_CONTRACT_ID = 'chunk-bm25-k1-1.2-b-0.75-v1';

const CJK_RUN = /(?:\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul})+/gu;

export interface LexicalDocument {
  itemPk: number;
  libraryKey: string;
  itemKey: string;
  itemId?: number;
  chunkIndex: number;
  chunkText: string;
  sectionPaths?: string[][];
  pdfAttachmentKey?: string;
  textSource: TextSourceType;
}

export interface LexicalSearchOptions {
  limit?: number;
  libraryKey?: string;
  textSources?: TextSourceType[];
}

export interface LexicalMatch extends LexicalDocument {
  score: number;
}

function increment(terms: Map<string, number>, term: string): void {
  if (!term) return;
  terms.set(term, (terms.get(term) ?? 0) + 1);
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

// Segmenter construction is relatively expensive compared with iterating a
// chunk.  Keep one instance for the lifetime of this module while preserving
// the existing no-Segmenter fallback.
let zhHansWordSegmenter: any | null | undefined;

function getZhHansWordSegmenter(): any | null {
  if (zhHansWordSegmenter !== undefined) return zhHansWordSegmenter;
  const Segmenter = (Intl as any).Segmenter;
  zhHansWordSegmenter = typeof Segmenter === 'function'
    ? new Segmenter('zh-Hans', { granularity: 'word' })
    : null;
  return zhHansWordSegmenter;
}

export function normalizeLexicalText(value: string): string {
  return String(value ?? '').normalize('NFC').toLocaleLowerCase('und');
}

function naturalTerms(normalized: string): Map<string, number> {
  const terms = new Map<string, number>();
  const hasHangul = /\p{Script=Hangul}/u.test(normalized);
  const segmenter = getZhHansWordSegmenter();
  if (segmenter) {
    for (const part of segmenter.segment(normalized)) {
      const term = String(part.segment ?? '').trim();
      // Gecko can keep EEG로 as one segment. Add only missing Latin occurrences;
      // already separated tokens retain their original TF without duplication.
      if (hasHangul && /(?:[\p{Script=Latin}\p{N}]\p{Script=Hangul}|\p{Script=Hangul}[\p{Script=Latin}\p{N}])/u.test(term)) {
        for (const latin of term.matchAll(/\p{Script=Latin}[\p{Script=Latin}\p{M}\p{N}]*/gu)) {
          increment(terms, latin[0]);
        }
      }
      // Some Gecko Thai words have isWordLike=false. Keep this exception scoped:
      // relaxing the flag globally changes unrelated CJK rankings.
      if ((part.isWordLike || /^[\p{Script=Thai}\p{M}]+$/u.test(term)) &&
          term && /[\p{L}\p{N}]/u.test(term)) increment(terms, term);
    }
    return terms;
  }

  // Zotero 9+ provides Intl.Segmenter. This deterministic fallback keeps the
  // index usable in Node or an unusual runtime without changing the CJK channel.
  for (const match of normalized.matchAll(/[\p{L}\p{N}]+/gu)) increment(terms, match[0]);
  return terms;
}

function cjkBigramTerms(normalized: string): Map<string, number> {
  const terms = new Map<string, number>();
  for (const match of normalized.matchAll(CJK_RUN)) {
    const characters = Array.from(match[0]);
    for (let index = 0; index + 1 < characters.length; index++) {
      increment(terms, `${characters[index]}${characters[index + 1]}`);
    }
  }
  return terms;
}

/** Plan 24C T0: natural terms plus CJK bigrams, merging overlap with max(TF). */
export function tokenizeT0(value: string): Map<string, number> {
  const normalized = normalizeLexicalText(value);
  const natural = naturalTerms(normalized);
  const bigrams = cjkBigramTerms(normalized);
  const merged = new Map(natural);
  for (const [term, count] of bigrams) {
    merged.set(term, Math.max(count, merged.get(term) ?? 0));
  }
  return merged;
}

interface IndexedDocument extends LexicalDocument {
  documentId: string;
  length: number;
}

/** In-memory BM25 index over one selected model partition per paper. */
export class T0BM25Index {
  private documents = new Map<string, IndexedDocument>();
  private postings = new Map<string, Map<string, number>>();
  private postingCount = 0;
  private totalTextChars = 0;
  private totalTextBytes = 0;

  constructor(
    documents: LexicalDocument[],
    private readonly k1 = 1.2,
    private readonly b = 0.75,
  ) {
    for (const document of documents) this.add(document);
  }

  get documentCount(): number {
    return this.documents.size;
  }

  get stats(): {
    documentCount: number;
    termCount: number;
    postingCount: number;
    totalTextChars: number;
    totalTextBytes: number;
  } {
    return {
      documentCount: this.documents.size,
      termCount: this.postings.size,
      postingCount: this.postingCount,
      totalTextChars: this.totalTextChars,
      totalTextBytes: this.totalTextBytes,
    };
  }

  private add(document: LexicalDocument): void {
    const documentId = `${document.itemPk}:${document.chunkIndex}`;
    if (this.documents.has(documentId)) return;
    const terms = tokenizeT0(document.chunkText);
    const length = [...terms.values()].reduce((sum, count) => sum + count, 0);
    this.documents.set(documentId, { ...document, documentId, length });
    this.totalTextChars += document.chunkText.length;
    this.totalTextBytes += utf8ByteLength(document.chunkText);
    for (const [term, tf] of terms) {
      const posting = this.postings.get(term) ?? new Map<string, number>();
      posting.set(documentId, tf);
      this.postings.set(term, posting);
      this.postingCount++;
    }
  }

  search(query: string, options: LexicalSearchOptions = {}): LexicalMatch[] {
    const queryTerms = tokenizeT0(query);
    if (queryTerms.size === 0 || this.documents.size === 0) return [];

    const allowedSources = options.textSources?.length
      ? new Set(options.textSources)
      : null;
    const eligible = new Set<string>();
    let totalLength = 0;
    for (const [documentId, document] of this.documents) {
      if (options.libraryKey && document.libraryKey !== options.libraryKey) continue;
      if (allowedSources && !allowedSources.has(document.textSource)) continue;
      eligible.add(documentId);
      totalLength += document.length;
    }
    if (eligible.size === 0) return [];

    const averageLength = totalLength / eligible.size || 1;
    const scores = new Map<string, number>();
    for (const term of queryTerms.keys()) {
      const posting = this.postings.get(term);
      if (!posting) continue;
      let df = 0;
      for (const documentId of posting.keys()) {
        if (eligible.has(documentId)) df++;
      }
      if (df === 0) continue;
      const idf = Math.log(1 + (eligible.size - df + 0.5) / (df + 0.5));
      for (const [documentId, tf] of posting) {
        if (!eligible.has(documentId)) continue;
        const document = this.documents.get(documentId)!;
        const denominator = tf + this.k1 * (1 - this.b + this.b * document.length / averageLength);
        const contribution = idf * (tf * (this.k1 + 1)) / denominator;
        scores.set(documentId, (scores.get(documentId) ?? 0) + contribution);
      }
    }

    const bestByItem = new Map<number, { document: IndexedDocument; score: number }>();
    for (const [documentId, score] of scores) {
      const document = this.documents.get(documentId)!;
      const previous = bestByItem.get(document.itemPk);
      if (!previous || score > previous.score ||
          (score === previous.score && document.documentId < previous.document.documentId)) {
        bestByItem.set(document.itemPk, { document, score });
      }
    }

    const ranked = [...bestByItem.values()]
      .sort((left, right) => right.score - left.score ||
        left.document.libraryKey.localeCompare(right.document.libraryKey) ||
        left.document.itemKey.localeCompare(right.document.itemKey))
      .slice(0, options.limit ?? 50);
    const maxScore = ranked[0]?.score ?? 1;
    return ranked
      .map(({ document, score }) => ({
        itemPk: document.itemPk,
        libraryKey: document.libraryKey,
        itemKey: document.itemKey,
        itemId: document.itemId,
        chunkIndex: document.chunkIndex,
        chunkText: document.chunkText,
        sectionPaths: document.sectionPaths,
        textSource: document.textSource,
        // The fusion consumes ranks, while UI/debug consumers historically
        // expect keyword relevance in [0, 1]. Normalizing by the query's best
        // BM25 hit preserves order without exposing unbounded raw BM25 values.
        score: maxScore > 0 ? score / maxScore : 0,
      }));
  }
}

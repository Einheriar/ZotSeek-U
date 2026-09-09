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

/**
 * In-memory BM25 index over one selected model partition per paper.
 *
 * Plan 61B stage 1: postings and per-document data live in CSR-style typed
 * arrays instead of nested Maps. The previous Map<term, Map<"pk:chunk", tf>>
 * layout cost roughly 50-80 bytes of object overhead per posting (~700 MiB
 * for the 9.5M-posting personal Full corpus) and rebuilt an eligible-document
 * Set plus average length on every query. The compact layout keeps the frozen
 * T0 tokenizer, BM25 formula, tie-breaks and result shape bit-exact while
 * reducing resident heap ~3x and hot-query latency ~10x on that corpus.
 *
 * Preserved behavioral contract:
 * - duplicate documentIds keep the first added document;
 * - BM25 idf uses log(1 + (N - df + 0.5) / (df + 0.5)) over eligible docs;
 * - per-item best chunk wins; score ties resolve by ascending legacy
 *   documentId string ("itemPk:chunkIndex", string order, so "123:10" < "123:9");
 * - item-level ties resolve by ascending libraryKey then itemKey;
 * - returned scores are normalized by the query's best BM25 hit.
 */
export class T0BM25Index {
  // Document columns (dense integer doc ids).
  private itemPkCol!: Uint32Array;
  private chunkIndexCol!: Uint32Array;
  private lengthCol!: Uint32Array;
  private sourceCodeCol!: Int32Array;
  private libraryCodeCol!: Int32Array;
  private chunkTextCol: string[] = [];
  private itemKeyCol: string[] = [];
  private itemIdCol: Array<number | undefined> = [];
  private legacyDocumentId: string[] = [];
  private sectionPathsCol: Array<string[][] | undefined> = [];
  private pdfAttachmentKeyCol: Array<string | undefined> = [];

  // Term dictionary and CSR postings.
  private termIndex = new Map<string, number>();
  private postingOffsets!: Uint32Array; // termCount + 1
  private postingDoc!: Uint32Array;
  private postingTf!: Float64Array;

  private libraryStrings: string[] = [];
  private sourceStrings: TextSourceType[] = [];
  private sourceCodeByName = new Map<TextSourceType, number>();

  // Group cache keyed by `libCode` + NUL + sorted source codes; -1 = no filter.
  private groups = new Map<string, { docs: Uint32Array; averageLength: number } | null>();

  private documentCountInternal = 0;
  private postingCountInternal = 0;
  private totalTextChars = 0;
  private totalTextBytes = 0;

  private k1 = 1.2;
  private b = 0.75;

  constructor(
    documents: LexicalDocument[],
    k1 = 1.2,
    b = 0.75,
  ) {
    this.k1 = k1;
    this.b = b;
    for (const _ of this.buildSteps(documents)) { /* Synchronous benchmark contract. */ }
  }

  /** Same construction order as the synchronous path, with cooperative UI yields. */
  static async buildAsync(
    documents: LexicalDocument[],
    canContinue: () => boolean = () => true,
  ): Promise<T0BM25Index> {
    const index = new T0BM25Index([]);
    let sliceStarted = Date.now();
    for (const _ of index.buildSteps(documents)) {
      if (!canContinue()) throw new Error('BM25 preparation cancelled');
      if (Date.now() - sliceStarted >= 8) {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        sliceStarted = Date.now();
      }
    }
    if (!canContinue()) throw new Error('BM25 preparation cancelled');
    return index;
  }

  get documentCount(): number {
    return this.documentCountInternal;
  }

  get stats(): {
    documentCount: number;
    termCount: number;
    postingCount: number;
    totalTextChars: number;
    totalTextBytes: number;
  } {
    return {
      documentCount: this.documentCountInternal,
      termCount: this.termIndex.size,
      postingCount: this.postingCountInternal,
      totalTextChars: this.totalTextChars,
      totalTextBytes: this.totalTextBytes,
    };
  }

  private codeForSource(source: TextSourceType): number {
    let code = this.sourceCodeByName.get(source);
    if (code === undefined) {
      code = this.sourceStrings.length;
      this.sourceCodeByName.set(source, code);
      this.sourceStrings.push(source);
    }
    return code;
  }

  private *buildSteps(documents: LexicalDocument[]): Generator<void> {
    // Deduplicate exactly like the legacy index: first documentId wins.
    const seen = new Set<string>();
    const kept: LexicalDocument[] = [];
    const legacyIds: string[] = [];
    for (const document of documents) {
      const legacyId = `${document.itemPk}:${document.chunkIndex}`;
      if (seen.has(legacyId)) continue;
      seen.add(legacyId);
      kept.push(document);
      legacyIds.push(legacyId);
      if (kept.length % 256 === 0) yield;
    }

    const count = kept.length;
    this.documentCountInternal = count;
    this.itemPkCol = new Uint32Array(count);
    this.chunkIndexCol = new Uint32Array(count);
    this.lengthCol = new Uint32Array(count);
    this.sourceCodeCol = new Int32Array(count);
    this.libraryCodeCol = new Int32Array(count);
    this.chunkTextCol = new Array(count);
    this.itemKeyCol = new Array(count);
    this.itemIdCol = new Array(count);
    this.legacyDocumentId = legacyIds;
    this.sectionPathsCol = new Array(count);
    this.pdfAttachmentKeyCol = new Array(count);

    const libraryCodeByKey = new Map<string, number>();

    // Pass 1: tokenize, fill document columns, register terms.
    const perDocTerms: Array<Map<string, number>> = new Array(count);
    for (let index = 0; index < count; index += 1) {
      const document = kept[index];
      this.itemPkCol[index] = document.itemPk;
      this.chunkIndexCol[index] = document.chunkIndex;
      this.chunkTextCol[index] = document.chunkText;
      this.itemKeyCol[index] = document.itemKey;
      this.itemIdCol[index] = document.itemId;
      this.sectionPathsCol[index] = document.sectionPaths;
      this.pdfAttachmentKeyCol[index] = document.pdfAttachmentKey;
      this.sourceCodeCol[index] = this.codeForSource(document.textSource);

      let libraryCode = libraryCodeByKey.get(document.libraryKey);
      if (libraryCode === undefined) {
        libraryCode = this.libraryStrings.length;
        libraryCodeByKey.set(document.libraryKey, libraryCode);
        this.libraryStrings.push(document.libraryKey);
      }
      this.libraryCodeCol[index] = libraryCode;

      this.totalTextChars += document.chunkText.length;
      this.totalTextBytes += utf8ByteLength(document.chunkText);

      const terms = tokenizeT0(document.chunkText);
      perDocTerms[index] = terms;
      let length = 0;
      for (const tf of terms.values()) length += tf;
      this.lengthCol[index] = length;

      for (const term of terms.keys()) {
        if (!this.termIndex.has(term)) {
          this.termIndex.set(term, this.termIndex.size);
        }
        this.postingCountInternal += 1;
      }
      if (index % 32 === 0) yield;
    }

    // Pass 2: allocate CSR arrays from per-term counts, then fill.
    const termCount = this.termIndex.size;
    const counts = new Uint32Array(termCount);
    for (let index = 0; index < count; index += 1) {
      for (const term of perDocTerms[index].keys()) {
          counts[this.termIndex.get(term)!] += 1;
        }
      if (index % 64 === 0) yield;
    }
    this.postingOffsets = new Uint32Array(termCount + 1);
    let totalPostings = 0;
    for (let term = 0; term < termCount; term += 1) {
      this.postingOffsets[term] = totalPostings;
      totalPostings += counts[term];
      if (term % 1024 === 0) yield;
    }
    this.postingOffsets[termCount] = totalPostings;
    this.postingDoc = new Uint32Array(totalPostings);
    this.postingTf = new Float64Array(totalPostings);

    const fill = new Uint32Array(termCount);
    for (let index = 0; index < count; index += 1) {
      for (const [term, tf] of perDocTerms[index]) {
        const termId = this.termIndex.get(term)!;
        const slot = this.postingOffsets[termId] + fill[termId];
        this.postingDoc[slot] = index;
        this.postingTf[slot] = tf;
        fill[termId] += 1;
      }
      // Release temporary term Maps as soon as their CSR segment is filled.
      perDocTerms[index].clear();
      if (index % 32 === 0) yield;
    }
  }

  private groupFor(libraryKey: string | undefined, sources: TextSourceType[] | undefined) {
    let libraryCode = -1;
    if (libraryKey !== undefined) {
      libraryCode = this.libraryStrings.indexOf(libraryKey);
      if (libraryCode === -1) return null; // unknown library: empty result
    }

    const sourceKey = sources?.length
      ? sources.map((source) => this.codeForSource(source)).sort((a, b) => a - b)
      : null;
    const groupKey = sourceKey === null
      ? `${libraryCode}|`
      : `${libraryCode}|${sourceKey.join(',')}`;
    if (this.groups.has(groupKey)) return this.groups.get(groupKey)!;

    const docs: number[] = [];
    let totalLength = 0;
    const allowed = sourceKey === null ? null : new Set(sourceKey);
    for (let index = 0; index < this.documentCountInternal; index += 1) {
      if (libraryCode !== -1 && this.libraryCodeCol[index] !== libraryCode) continue;
      if (allowed !== null && !allowed.has(this.sourceCodeCol[index])) continue;
      docs.push(index);
      totalLength += this.lengthCol[index];
    }
    const group = docs.length === 0
      ? null
      : { docs: Uint32Array.from(docs), averageLength: totalLength / docs.length };
    this.groups.set(groupKey, group);
    return group;
  }

  search(query: string, options: LexicalSearchOptions = {}): LexicalMatch[] {
    const queryTerms = tokenizeT0(query);
    if (queryTerms.size === 0 || this.documentCountInternal === 0) return [];

    const group = this.groupFor(options.libraryKey, options.textSources);
    if (!group) return [];

    const eligible = new Uint8Array(this.documentCountInternal);
    for (const doc of group.docs) eligible[doc] = 1;
    const eligibleCount = group.docs.length;
    const averageLength = group.averageLength;
    const { k1, b } = this;

    const scores = new Map<number, number>();
    for (const term of queryTerms.keys()) {
      const termId = this.termIndex.get(term);
      if (termId === undefined) continue;
      const start = this.postingOffsets[termId];
      const end = this.postingOffsets[termId + 1];
      let df = 0;
      for (let slot = start; slot < end; slot += 1) {
        if (eligible[this.postingDoc[slot]]) df += 1;
      }
      if (df === 0) continue;
      const idf = Math.log(1 + (eligibleCount - df + 0.5) / (df + 0.5));
      for (let slot = start; slot < end; slot += 1) {
        const doc = this.postingDoc[slot];
        if (!eligible[doc]) continue;
        const tf = this.postingTf[slot];
        const denominator = tf + k1 * (1 - b + (b * this.lengthCol[doc]) / averageLength);
        const contribution = (idf * (tf * (k1 + 1))) / denominator;
        scores.set(doc, (scores.get(doc) ?? 0) + contribution);
      }
    }

    // Aggregate to the best chunk per item, preserving the legacy tie-break:
    // equal scores keep the smaller legacy "itemPk:chunkIndex" string.
    const bestByItem = new Map<number, { doc: number; score: number; legacyDocumentId: string }>();
    for (const [doc, score] of scores) {
      const itemPk = this.itemPkCol[doc];
      const legacyId = this.legacyDocumentId[doc];
      const previous = bestByItem.get(itemPk);
      if (!previous || score > previous.score ||
          (score === previous.score && legacyId < previous.legacyDocumentId)) {
        bestByItem.set(itemPk, { doc, score, legacyDocumentId: legacyId });
      }
    }

    const ranked = [...bestByItem.values()]
      .sort((left, right) => right.score - left.score || this.compareItems(left.doc, right.doc))
      .slice(0, options.limit ?? 50);
    const maxScore = ranked[0]?.score ?? 1;
    return ranked.map(({ doc, score }) => ({
      itemPk: this.itemPkCol[doc],
      libraryKey: this.libraryStrings[this.libraryCodeCol[doc]],
      itemKey: this.itemKeyCol[doc],
      itemId: this.itemIdCol[doc],
      chunkIndex: this.chunkIndexCol[doc],
      chunkText: this.chunkTextCol[doc],
      sectionPaths: this.sectionPathsCol[doc],
      textSource: this.sourceStrings[this.sourceCodeCol[doc]],
      // The fusion consumes ranks, while UI/debug consumers historically
      // expect keyword relevance in [0, 1]. Normalizing by the query's best
      // BM25 hit preserves order without exposing unbounded raw BM25 values.
      score: maxScore > 0 ? score / maxScore : 0,
    }));
  }

  private compareItems(leftDoc: number, rightDoc: number): number {
    const leftLibrary = this.libraryStrings[this.libraryCodeCol[leftDoc]];
    const rightLibrary = this.libraryStrings[this.libraryCodeCol[rightDoc]];
    const byLibrary = leftLibrary.localeCompare(rightLibrary);
    if (byLibrary !== 0) return byLibrary;
    return this.itemKeyCol[leftDoc].localeCompare(this.itemKeyCol[rightDoc]);
  }

  /**
   * Serialize the index to a JSON-friendly snapshot. All typed arrays are
   * converted to plain number arrays and all strings are preserved so the
   * snapshot round-trips losslessly through JSON. The caller is responsible
   * for versioning, integrity (fingerprint) and deciding whether a snapshot
   * is still valid for the current corpus.
   */
  serialize(): Record<string, unknown> {
    return {
      k1: this.k1,
      b: this.b,
      documentCount: this.documentCountInternal,
      postingCount: this.postingCountInternal,
      totalTextChars: this.totalTextChars,
      totalTextBytes: this.totalTextBytes,
      itemPk: Array.from(this.itemPkCol),
      chunkIndex: Array.from(this.chunkIndexCol),
      length: Array.from(this.lengthCol),
      sourceCode: Array.from(this.sourceCodeCol),
      libraryCode: Array.from(this.libraryCodeCol),
      chunkText: this.chunkTextCol,
      itemKey: this.itemKeyCol,
      itemId: this.itemIdCol,
      legacyDocumentId: this.legacyDocumentId,
      sectionPaths: this.sectionPathsCol,
      pdfAttachmentKey: this.pdfAttachmentKeyCol,
      terms: [...this.termIndex.keys()],
      postingOffsets: Array.from(this.postingOffsets),
      postingDoc: Array.from(this.postingDoc),
      postingTf: Array.from(this.postingTf),
      libraryStrings: this.libraryStrings,
      sourceStrings: this.sourceStrings,
    };
  }

  /** Bounded JSON records avoid copying/stringifying the entire postings table. */
  *snapshotRecords(): Generator<Record<string, unknown>> {
    yield { metadata: { k1: this.k1, b: this.b, documentCount: this.documentCountInternal,
      postingCount: this.postingCountInternal, totalTextChars: this.totalTextChars,
      totalTextBytes: this.totalTextBytes } };
    const columns: Record<string, ArrayLike<unknown>> = {
      itemPk: this.itemPkCol, chunkIndex: this.chunkIndexCol, length: this.lengthCol,
      sourceCode: this.sourceCodeCol, libraryCode: this.libraryCodeCol,
      chunkText: this.chunkTextCol, itemKey: this.itemKeyCol,
      itemId: new Array(this.documentCountInternal).fill(null),
      legacyDocumentId: this.legacyDocumentId, sectionPaths: this.sectionPathsCol,
      pdfAttachmentKey: this.pdfAttachmentKeyCol, terms: [...this.termIndex.keys()],
      postingOffsets: this.postingOffsets, postingDoc: this.postingDoc, postingTf: this.postingTf,
      libraryStrings: this.libraryStrings, sourceStrings: this.sourceStrings,
    };
    for (const [key, column] of Object.entries(columns)) {
      const size = ArrayBuffer.isView(column) ? 16384 : 128;
      // Include empty columns so a truncated/missing column cannot look valid.
      for (let offset = 0; offset < Math.max(1, column.length); offset += size) {
        const values = [];
        for (let i = offset; i < Math.min(offset + size, column.length); i++) values.push(column[i]);
        yield { key, offset, values };
      }
    }
  }

  /**
   * Rebuild an index from serialize() output. This is a trusted fast path:
   * the caller must already have validated the snapshot's fingerprint against
   * the live corpus. No re-tokenization or re-scoring happens here, so a
   * mismatched snapshot would silently serve stale rankings.
   */
  static deserialize(data: Record<string, any>): T0BM25Index {
    const index = Object.create(T0BM25Index.prototype) as T0BM25Index;
    index.k1 = data.k1;
    index.b = data.b;
    index.documentCountInternal = data.documentCount;
    index.postingCountInternal = data.postingCount;
    index.totalTextChars = data.totalTextChars;
    index.totalTextBytes = data.totalTextBytes;
    // The disk decoder transfers owned typed columns, avoiding a second full copy.
    index.itemPkCol = data.itemPk instanceof Uint32Array ? data.itemPk : Uint32Array.from(data.itemPk);
    index.chunkIndexCol = data.chunkIndex instanceof Uint32Array ? data.chunkIndex : Uint32Array.from(data.chunkIndex);
    index.lengthCol = data.length instanceof Uint32Array ? data.length : Uint32Array.from(data.length);
    index.sourceCodeCol = data.sourceCode instanceof Int32Array ? data.sourceCode : Int32Array.from(data.sourceCode);
    index.libraryCodeCol = data.libraryCode instanceof Int32Array ? data.libraryCode : Int32Array.from(data.libraryCode);
    index.chunkTextCol = data.chunkText;
    index.itemKeyCol = data.itemKey;
    index.itemIdCol = data.itemId;
    index.legacyDocumentId = data.legacyDocumentId;
    index.sectionPathsCol = data.sectionPaths;
    index.pdfAttachmentKeyCol = data.pdfAttachmentKey;
    index.termIndex = new Map((data.terms as string[]).map((term, i) => [term, i]));
    index.postingOffsets = data.postingOffsets instanceof Uint32Array ? data.postingOffsets : Uint32Array.from(data.postingOffsets);
    index.postingDoc = data.postingDoc instanceof Uint32Array ? data.postingDoc : Uint32Array.from(data.postingDoc);
    index.postingTf = data.postingTf instanceof Float64Array ? data.postingTf : Float64Array.from(data.postingTf);
    index.libraryStrings = data.libraryStrings;
    index.sourceStrings = data.sourceStrings;
    index.sourceCodeByName = new Map(
      (data.sourceStrings as TextSourceType[]).map((source, i) => [source, i]),
    );
    index.groups = new Map();
    return index;
  }
}

/**
 * Reproducible BM25 cache, independent of the durable chunk database.
 * Identity is captured before construction; saving never relabels old data with
 * a later revision. Bounded JSON records yield between codec operations.
 */
import { T0BM25Index, T0_LEXICAL_CONTRACT_ID, T0_BM25_CONTRACT_ID } from './lexical-search';
import { Logger } from '../utils/logger';

declare const Zotero: any;
declare const PathUtils: any;
declare const IOUtils: any;

export interface LexicalSnapshotIdentity {
  databaseId: string;
  revision: string;
  modelId: string;
}

const logger = new Logger('LexicalSnapshot');
const SNAPSHOT_FORMAT = 3;
const SEPARATOR = ',\n"records":';
let writer: Promise<void> = Promise.resolve();

export function sameLexicalIdentity(a: LexicalSnapshotIdentity, b: LexicalSnapshotIdentity): boolean {
  return a.databaseId === b.databaseId && a.revision === b.revision && a.modelId === b.modelId;
}

function snapshotPath(): string {
  return PathUtils.join(Zotero.DataDirectory.dir, 'zotseek-lexical-snapshot.json');
}

async function digest(text: string): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

/** Check all array boundaries before entering the trusted typed-array decoder. */
function* validationSteps(data: any): Generator<void> {
  const integer = (n: any) => Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff;
  const column = (value: any): boolean => Array.isArray(value) || ArrayBuffer.isView(value);
  if (!data || data.k1 !== 1.2 || data.b !== 0.75 ||
      !integer(data.documentCount) || !integer(data.postingCount)) throw new Error('Invalid BM25 header');
  const n = data.documentCount;
  const p = data.postingCount;
  for (const key of ['itemPk', 'chunkIndex', 'length', 'sourceCode', 'libraryCode',
    'chunkText', 'itemKey', 'itemId', 'legacyDocumentId', 'sectionPaths', 'pdfAttachmentKey']) {
    if (!column(data[key]) || data[key].length !== n) throw new Error('Invalid document column: ' + key);
  }
  for (const key of ['terms', 'libraryStrings', 'sourceStrings']) {
    if (!Array.isArray(data[key]) || data[key].some((s: any) => typeof s !== 'string')) {
      throw new Error('Invalid dictionary: ' + key);
    }
  }
  if (new Set(data.terms).size !== data.terms.length ||
      !column(data.postingOffsets) || data.postingOffsets.length !== data.terms.length + 1 ||
      !column(data.postingDoc) || data.postingDoc.length !== p ||
      !column(data.postingTf) || data.postingTf.length !== p ||
      data.postingOffsets[0] !== 0 || data.postingOffsets[data.terms.length] !== p) {
    throw new Error('Invalid posting dimensions');
  }
  for (let i = 0; i < data.postingOffsets.length; i++) {
    if (i % 16384 === 0) yield;
    const offset = data.postingOffsets[i];
    if (!integer(offset) || offset > p || (i && offset < data.postingOffsets[i - 1])) {
      throw new Error('Invalid posting offset');
    }
  }
  for (let i = 0; i < p; i++) {
    if (i % 16384 === 0) yield;
    if (!integer(data.postingDoc[i]) || data.postingDoc[i] >= n ||
        !Number.isFinite(data.postingTf[i]) || data.postingTf[i] <= 0) throw new Error('Invalid posting');
  }
  for (let i = 0; i < n; i++) {
    if (i % 128 === 0) yield;
    if (!integer(data.itemPk[i]) || !integer(data.chunkIndex[i]) || !integer(data.length[i]) ||
        !integer(data.sourceCode[i]) || data.sourceCode[i] >= data.sourceStrings.length ||
        !integer(data.libraryCode[i]) || data.libraryCode[i] >= data.libraryStrings.length ||
        typeof data.chunkText[i] !== 'string' || typeof data.itemKey[i] !== 'string' ||
        data.legacyDocumentId[i] !== data.itemPk[i] + ':' + data.chunkIndex[i] ||
        (data.pdfAttachmentKey[i] != null && typeof data.pdfAttachmentKey[i] !== 'string') ||
        (data.sectionPaths[i] != null && (!Array.isArray(data.sectionPaths[i]) ||
          data.sectionPaths[i].some((path: any) => !Array.isArray(path) ||
            path.some((part: any) => typeof part !== 'string'))))) throw new Error('Invalid document');
  }
  for (const key of ['totalTextChars', 'totalTextBytes']) {
    if (!Number.isSafeInteger(data[key]) || data[key] < 0) throw new Error('Invalid text statistics');
  }
}

export function validateLexicalSnapshot(data: any): void {
  for (const _ of validationSteps(data)) { /* Synchronous test/debug entry point. */ }
}

const yieldToUI = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function encode(index: T0BM25Index, canPublish: () => boolean): Promise<string> {
  const records: string[] = [];
  let deadline = Date.now() + 8;
  for (const record of index.snapshotRecords()) {
    records.push(JSON.stringify(record));
    if (Date.now() >= deadline) {
      await yieldToUI();
      if (!canPublish()) throw new Error('BM25 snapshot save cancelled');
      deadline = Date.now() + 8;
    }
  }
  return '[' + records.join(',\n') + ']';
}

async function decode(payload: string): Promise<Record<string, any>> {
  if (payload[0] !== '[' || payload[payload.length - 1] !== ']') throw new Error('Invalid records');
  const data: Record<string, any> = Object.create(null);
  const allowed = new Set(['itemPk', 'chunkIndex', 'length', 'sourceCode', 'libraryCode',
    'chunkText', 'itemKey', 'itemId', 'legacyDocumentId', 'sectionPaths', 'pdfAttachmentKey',
    'terms', 'postingOffsets', 'postingDoc', 'postingTf', 'libraryStrings', 'sourceStrings']);
  const numeric = new Set(['itemPk', 'chunkIndex', 'length', 'sourceCode', 'libraryCode',
    'postingOffsets', 'postingDoc', 'postingTf']);
  const positions = new Map<string, number>();
  let start = 1, first = true, deadline = Date.now() + 8;
  while (start < payload.length - 1) {
    const next = payload.indexOf(',\n', start);
    const end = next < 0 ? payload.length - 1 : next;
    const record = JSON.parse(payload.slice(start, end));
    if (first) {
      if (!record.metadata || Object.keys(record).length !== 1) throw new Error('Missing metadata');
      for (const key of ['k1', 'b', 'documentCount', 'postingCount', 'totalTextChars', 'totalTextBytes']) {
        data[key] = record.metadata[key];
      }
      for (const key of ['documentCount', 'postingCount']) {
        if (!Number.isSafeInteger(data[key]) || data[key] < 0 || data[key] > 0xffffffff) throw new Error('Invalid dimensions');
      }
      first = false;
    } else {
      const { key, offset, values } = record;
      if (!allowed.has(key) || !Array.isArray(values) || values.length > 16384 ||
          !Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid record');
      if ((positions.get(key) ?? 0) !== offset || (positions.has(key) && values.length === 0)) throw new Error('Invalid record offset');
      if (numeric.has(key)) {
        const count = key === 'postingOffsets' ? data.terms?.length + 1 :
          key === 'postingDoc' || key === 'postingTf' ? data.postingCount : data.documentCount;
        if (!Number.isSafeInteger(count) || offset + values.length > count) throw new Error('Invalid numeric dimensions');
        // Validate before typed-array assignment: coercion must not hide corruption.
        for (const value of values) {
          if (key === 'postingTf' ? !Number.isFinite(value) || value <= 0 :
              !Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) throw new Error('Invalid numeric value');
        }
        const column = data[key] || (data[key] = key === 'postingTf' ? new Float64Array(count) :
          key === 'sourceCode' || key === 'libraryCode' ? new Int32Array(count) : new Uint32Array(count));
        column.set(values, offset);
      } else {
        const column = data[key] || (data[key] = []);
        for (const value of values) column.push(value);
      }
      positions.set(key, offset + values.length);
    }
    start = end + 2;
    if (Date.now() >= deadline) { await yieldToUI(); deadline = Date.now() + 8; }
  }
  for (const key of allowed) {
    if (!positions.has(key) || positions.get(key) !== data[key].length) throw new Error('Incomplete column');
  }
  for (const _ of validationSteps(data)) {
    if (Date.now() >= deadline) { await yieldToUI(); deadline = Date.now() + 8; }
  }
  return data;
}

export async function loadLexicalSnapshot(identity: LexicalSnapshotIdentity): Promise<T0BM25Index | null> {
  const started = Date.now();
  try {
    const raw = await IOUtils.readUTF8(snapshotPath());
    // The envelope is valid JSON. Its fixed separator lets us hash the exact
    // payload bytes without parsing/stringifying the full object twice.
    const split = raw.indexOf(SEPARATOR);
    if (!raw.startsWith('{"header":') || split < 0 || raw[raw.length - 1] !== '}') return null;
    const header = JSON.parse(raw.slice(10, split));
    if (header.format !== SNAPSHOT_FORMAT ||
        header.lexicalContract !== T0_LEXICAL_CONTRACT_ID ||
        header.bm25Contract !== T0_BM25_CONTRACT_ID ||
        !sameLexicalIdentity(header, identity)) return null;
    const payload = raw.slice(split + SEPARATOR.length, -1);
    if (await digest(payload) !== header.sha256) return null;
    const data = await decode(payload);
    // Local IDs are deliberately re-resolved from stable keys by searchText.
    data.itemId = new Array(data.documentCount).fill(undefined);
    data.sectionPaths = data.sectionPaths.map((v: any) => v ?? undefined);
    data.pdfAttachmentKey = data.pdfAttachmentKey.map((v: any) => v ?? undefined);
    const index = T0BM25Index.deserialize(data);
    logger.info('Loaded BM25 snapshot revision=' + identity.revision + ' in ' + (Date.now() - started) + 'ms');
    return index;
  } catch (error) {
    logger.debug('BM25 snapshot miss: ' + error);
    return null;
  }
}

export function persistLexicalSnapshot(
  identity: LexicalSnapshotIdentity,
  index: T0BM25Index,
  canPublish: () => boolean,
): Promise<void> {
  const job = writer.then(async () => {
    let temp: string | undefined;
    try {
      if (!canPublish()) return;
      const started = Date.now();
      const path = snapshotPath();
      temp = path + '.tmp';
      const payload = await encode(index, canPublish);
      const header = { ...identity, format: SNAPSHOT_FORMAT,
        lexicalContract: T0_LEXICAL_CONTRACT_ID, bm25Contract: T0_BM25_CONTRACT_ID,
        sha256: await digest(payload) };
      if (!canPublish()) return;
      const raw = '{"header":' + JSON.stringify(header) + SEPARATOR + payload + '}';
      const bytes = await IOUtils.writeUTF8(temp, raw);
      if ((await IOUtils.stat(temp)).size !== bytes) throw new Error('Incomplete snapshot write');
      if (!canPublish()) return;
      // Same-directory replacement; never delete the last complete snapshot first.
      await IOUtils.move(temp, path);
      logger.info('Saved BM25 snapshot revision=' + identity.revision +
        ' bytes=' + bytes + ' in ' + (Date.now() - started) + 'ms');
    } catch (error) {
      logger.warn('BM25 snapshot save failed (memory index remains usable): ' + error);
    } finally {
      if (temp) {
        try { await IOUtils.remove(temp, { ignoreAbsent: true }); } catch { /* Reproducible cache only. */ }
      }
    }
  });
  writer = job.catch(() => {});
  return job;
}

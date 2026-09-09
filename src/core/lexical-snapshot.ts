/**
 * Reproducible BM25 cache, independent of the durable chunk database.
 * Identity is captured before construction; saving never relabels old data with
 * a later revision. JSON remains the initial format pending runtime profiling.
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
const SNAPSHOT_FORMAT = 2;
const SEPARATOR = ',\n"index":';
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
export function validateLexicalSnapshot(data: any): void {
  const integer = (n: any) => Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff;
  if (!data || data.k1 !== 1.2 || data.b !== 0.75 ||
      !integer(data.documentCount) || !integer(data.postingCount)) throw new Error('Invalid BM25 header');
  const n = data.documentCount;
  const p = data.postingCount;
  for (const key of ['itemPk', 'chunkIndex', 'length', 'sourceCode', 'libraryCode',
    'chunkText', 'itemKey', 'itemId', 'legacyDocumentId', 'sectionPaths', 'pdfAttachmentKey']) {
    if (!Array.isArray(data[key]) || data[key].length !== n) throw new Error('Invalid document column: ' + key);
  }
  for (const key of ['terms', 'libraryStrings', 'sourceStrings']) {
    if (!Array.isArray(data[key]) || data[key].some((s: any) => typeof s !== 'string')) {
      throw new Error('Invalid dictionary: ' + key);
    }
  }
  if (new Set(data.terms).size !== data.terms.length ||
      !Array.isArray(data.postingOffsets) || data.postingOffsets.length !== data.terms.length + 1 ||
      !Array.isArray(data.postingDoc) || data.postingDoc.length !== p ||
      !Array.isArray(data.postingTf) || data.postingTf.length !== p ||
      data.postingOffsets[0] !== 0 || data.postingOffsets[data.terms.length] !== p) {
    throw new Error('Invalid posting dimensions');
  }
  for (let i = 0; i < data.postingOffsets.length; i++) {
    const offset = data.postingOffsets[i];
    if (!integer(offset) || offset > p || (i && offset < data.postingOffsets[i - 1])) {
      throw new Error('Invalid posting offset');
    }
  }
  for (let i = 0; i < p; i++) {
    if (!integer(data.postingDoc[i]) || data.postingDoc[i] >= n ||
        !Number.isFinite(data.postingTf[i]) || data.postingTf[i] <= 0) throw new Error('Invalid posting');
  }
  for (let i = 0; i < n; i++) {
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
    const data = JSON.parse(payload);
    validateLexicalSnapshot(data);
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
      const data = index.serialize();
      // Never persist installation-local Zotero IDs as cross-session identity.
      data.itemId = new Array(index.documentCount).fill(null);
      const payload = JSON.stringify(data);
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

/**
 * Shared tool layer for ZotSeek's local HTTP interfaces (MCP + REST).
 *
 * Module-level functions, not class methods: in the esbuild IIFE bundle,
 * class methods may not land on the runtime prototype.
 * Uses the `Zotero` global directly.
 *
 * All operations are read-only adapters over the existing search engines.
 */
import { searchEngine, SearchResult } from '../core/search-engine';
import { HybridSearchEngine, HybridSearchResult, SearchMode } from '../core/hybrid-search';
import { getVectorStore } from '../core/storage-factory';
import { getActiveModelId } from '../core/model-registry';
import {
  getSelectedServerModelConfigurationIssue,
  serverModelConfigurationErrorMessage,
} from '../core/server-model-config';
import { identityFromItem } from '../core/identity-resolver';
import { noteHTMLFirstHeading, noteHTMLToStructuredText } from '../utils/note-text';
import {
  PdfFullReadLimits,
  PdfReadResult,
  PdfReadSource,
  ZoteroAPI,
} from '../utils/zotero-api';
import {
  extractPdfReferencePages,
  PDF_REFERENCE_REGION_STRATEGY_ID,
  PDF_REFERENCE_REGION_STRATEGY_VERSION,
} from '../utils/pdf-preprocessor';
import { OPEN_PATH } from './open-endpoint';
import { normalizeProductIndexingMode } from '../core/search-policy';
import {
  MIN_SIMILARITY_PERCENT_BOUNDS,
  normalizeMinSimilarityPercent,
} from '../utils/numeric-preferences';
import {
  readZoteroStyleJournalMetrics,
  type JournalMetrics,
} from './zotero-style-adapter';

declare const Zotero: any;

// One engine instance for all HTTP-facing searches (same wrapping the UI uses)
const hybridEngine = new HybridSearchEngine(searchEngine);
const zoteroAPI = new ZoteroAPI();

export const GET_ITEM_PDF_FULL_READ_LIMITS: Readonly<PdfFullReadLimits> = Object.freeze({
  batchPages: 20,
  maxPages: 100,
  maxCharacters: 300_000,
});

export const GET_ITEM_PDF_REFERENCE_READ_LIMITS: Readonly<PdfFullReadLimits> = Object.freeze({
  batchPages: 20,
  maxPages: 100,
  maxCharacters: 300_000,
});

export interface MatchedChunk {
  snippet?: string;
  page?: number;
  textSource?: string;
  sectionPaths?: string[][];
  pdfAttachmentKey?: string;
}

export interface ResultLinks {
  /** Selects the item in the Zotero main pane */
  select: string;
  /** http launcher equivalent of `select`, for clients that only linkify http(s) URLs */
  selectHttp: string;
  /** Opens the PDF in Zotero's reader, at the matched page when known */
  openPdf?: string;
  /** http launcher equivalent of `openPdf` */
  openPdfHttp?: string;
}

export interface BibliographicCreator {
  creatorType: string;
  firstName?: string;
  lastName?: string;
  /** Single-field creator name, used for institutions and organizations. */
  name?: string;
}

/**
 * Structured Zotero metadata needed by MCP clients to format citations.
 * Only populated fields are returned; no citation style is imposed here.
 */
export interface BibliographicMetadata {
  itemType?: string;
  title: string;
  creators: BibliographicCreator[];
  date?: string;
  year?: number;
  publicationTitle?: string;
  bookTitle?: string;
  proceedingsTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  edition?: string;
  publisher?: string;
  place?: string;
  DOI?: string;
  ISBN?: string;
  ISSN?: string;
  url?: string;
  abstractNote?: string;
}

export interface ToolResultItem {
  itemKey: string;
  libraryKey: string | null; // 'user' | 'group:<id>' | null when unresolvable
  title: string;
  itemStatus?: 'item_not_found';
  authors?: string[] | string;
  year?: number;
  score: number;
  /** Unrounded component scores; null means unavailable, not zero relevance. */
  semanticScore: number | null;
  bm25Score: number | null;
  source?: 'both' | 'semantic' | 'keyword';
  matchedChunk: MatchedChunk | null;
  links?: ResultLinks;
  /** Full bibliographic fields from the live Zotero item, when resolvable. */
  metadata?: BibliographicMetadata;
  /** Optional journal enrichment read from Zotero Style's existing cache. */
  journalMetrics?: JournalMetrics;
}

export interface SearchToolArgs {
  query: string;
  max_results?: number;
  mode?: SearchMode;
  granularity?: 'papers' | 'passages';
  /** 0-1; defaults to the user's minSimilarityPercent preference */
  min_similarity?: number;
  /** 'user' for the personal library, or 'group:<groupID>' to limit the search to one group library. Omit to search all indexed libraries. */
  library_key?: string;
  /** Stable collection key. Requires an explicit library_key. */
  collection_key?: string;
  /** Include every descendant collection. Valid only with collection_key; defaults to true. */
  include_subcollections?: boolean;
  filter?: SearchResultFilter;
}

export interface SearchResultFilter {
  year_from?: number;
  year_to?: number;
  journal?: string;
  author?: string;
  tag?: string;
  exact?: boolean;
}

export interface LibraryCollectionNode {
  collectionKey: string;
  name: string;
  children: LibraryCollectionNode[];
}

export interface LibraryMapToolArgs {
  library_key?: string;
}

export interface LibraryMapResult {
  libraryKey: string;
  name: string;
  collections: LibraryCollectionNode[];
}

export interface FindSimilarToolArgs {
  item_key: string;
  library_key?: string;
  max_results?: number;
}

export interface GetItemToolArgs {
  item_key: string;
  library_key?: string;
  include_notes?: boolean;
  include_pdf?: 'none' | 'pages' | 'full' | 'references';
  pdf_pages?: string;
  pdf_attachment_key?: string;
}

export interface ItemNoteResult {
  noteKey: string;
  title?: string;
  text: string;
  sections: Array<{ path: string[]; pathLevels: number[]; paragraphs: string[] }>;
  sectionPaths: string[][];
}

export interface ItemAttachmentResult {
  key: string;
  contentType?: string;
  isPDF: boolean;
  filename?: string;
  isIndexedPdfSource: boolean;
  links?: Pick<ResultLinks, 'openPdf' | 'openPdfHttp'>;
}

export interface GetItemResult {
  itemKey: string;
  libraryKey: string;
  metadata: BibliographicMetadata;
  tags: string[];
  collections: Array<{ libraryKey: string; key: string; name: string }>;
  relatedItems: Array<{ libraryKey: string; itemKey: string }>;
  attachments: ItemAttachmentResult[];
  links?: ResultLinks;
  journalMetrics?: JournalMetrics;
  notes?: ItemNoteResult[];
  pdf?: PdfReadResult;
}

const VALID_MODES: SearchMode[] = ['hybrid', 'semantic', 'keyword'];

function clampInt(value: any, min: number, max: number, fallback: number): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function clampFloat(value: any, min: number, max: number, fallback: number): number {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** The user's minimum-similarity preference, as the UI reads it. */
function prefMinSimilarity(): number {
  try {
    return normalizeMinSimilarityPercent(
      Zotero.Prefs.get('zotseek.minSimilarityPercent', true),
    ) / 100;
  } catch {
    // fall through to default
  }
  return MIN_SIMILARITY_PERCENT_BOUNDS.defaultValue / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function chunkOf(r: { chunkText?: string; pageNumber?: number; textSource?: string; sectionPaths?: string[][]; pdfAttachmentKey?: string }): MatchedChunk | null {
  if (!r.chunkText && r.pageNumber === undefined) return null;
  return {
    snippet: r.chunkText || undefined,
    page: r.pageNumber,
    textSource: r.textSource || undefined,
    sectionPaths: r.sectionPaths,
    pdfAttachmentKey: r.pdfAttachmentKey,
  };
}

function libraryKeyForItemId(itemId: number | undefined): string | null {
  if (!itemId) return null;
  try {
    const item = Zotero.Items.get(itemId);
    return item ? (identityFromItem(item)?.libraryKey ?? null) : null;
  } catch {
    return null;
  }
}

/** The auto-adjust-weights preference, shared with the search dialog. */
function prefAutoAdjustWeights(): boolean {
  try {
    return Zotero.Prefs.get('extensions.zotero.zotseek.hybridSearch.autoAdjustWeights', true) !== false;
  } catch {
    return true;
  }
}

function cleanField(value: any): string | undefined {
  if (value === undefined || value === null || value === false) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function readItemField(item: any, field: string): string | undefined {
  try {
    return cleanField(item.getField(field));
  } catch {
    return undefined;
  }
}

function yearFromDate(date: string | undefined): number | undefined {
  const match = date?.match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : undefined;
}

function getLocalItem(itemId: number | undefined): any | undefined {
  if (!itemId) return undefined;
  try {
    return Zotero.Items.get(itemId) || undefined;
  } catch {
    return undefined;
  }
}

/** Read citation-relevant fields from Zotero rather than the embedding DB. */
function buildBibliographicMetadata(item: any): BibliographicMetadata | undefined {
  if (!item) return undefined;

  const title = readItemField(item, 'title') || 'Untitled';
  const date = readItemField(item, 'date');
  const creators: BibliographicCreator[] = [];
  try {
    for (const creator of item.getCreators?.() || []) {
      let creatorType = cleanField(creator.creatorType);
      if (!creatorType && creator.creatorTypeID !== undefined) {
        try {
          creatorType = cleanField(Zotero.CreatorTypes.getName(creator.creatorTypeID));
        } catch {
          // Keep an empty creator type only as a last resort.
        }
      }
      creators.push({
        creatorType: creatorType || 'author',
        firstName: cleanField(creator.firstName),
        lastName: cleanField(creator.lastName),
        name: cleanField(creator.name),
      });
    }
  } catch {
    // Metadata is still useful when an unusual item has no readable creators.
  }

  let itemType: string | undefined;
  try {
    itemType = cleanField(Zotero.ItemTypes.getName(item.itemTypeID));
  } catch {
    itemType = cleanField(item.itemType);
  }

  return {
    itemType,
    title,
    creators,
    date,
    year: yearFromDate(date),
    publicationTitle: readItemField(item, 'publicationTitle'),
    bookTitle: readItemField(item, 'bookTitle'),
    proceedingsTitle: readItemField(item, 'proceedingsTitle'),
    volume: readItemField(item, 'volume'),
    issue: readItemField(item, 'issue'),
    pages: readItemField(item, 'pages'),
    edition: readItemField(item, 'edition'),
    publisher: readItemField(item, 'publisher'),
    place: readItemField(item, 'place'),
    DOI: readItemField(item, 'DOI'),
    ISBN: readItemField(item, 'ISBN'),
    ISSN: readItemField(item, 'ISSN'),
    url: readItemField(item, 'url'),
    abstractNote: readItemField(item, 'abstractNote'),
  };
}

/**
 * zotero:// deep links for a result. `select` always works; `openPdf` is
 * added when the item has a PDF attachment, pointing at the matched page
 * when known. An exact indexed source key takes precedence; legacy results
 * without one retain the best-attachment fallback.
 */
async function buildLinks(
  libraryKey: string | null,
  itemKey: string,
  page?: number,
  pdfAttachmentKey?: string,
): Promise<ResultLinks | undefined> {
  if (!itemKey) return undefined;
  const isGroup = !!libraryKey && libraryKey.startsWith('group:');
  if (libraryKey !== 'user' && !isGroup) return undefined; // orphan/unknown: no stable link
  const prefix = isGroup ? `groups/${libraryKey!.slice('group:'.length)}` : 'library';
  // http launcher base for clients that don't linkify zotero:// URIs
  const port = Zotero.Server?.port || 23119;
  const openBase = `http://localhost:${port}${OPEN_PATH}`;
  const libParam = isGroup ? `&library=${encodeURIComponent(libraryKey!)}` : '';
  const links: ResultLinks = {
    select: `zotero://select/${prefix}/items/${itemKey}`,
    selectHttp: `${openBase}?target=select&key=${itemKey}${libParam}`,
  };
  try {
    const libraryId = isGroup
      ? Zotero.Groups.getLibraryIDFromGroupID(Number(libraryKey!.slice('group:'.length)))
      : Zotero.Libraries.userLibraryID;
    const item = Zotero.Items.getByLibraryAndKey(libraryId, itemKey);
    const att = pdfAttachmentKey
      ? Zotero.Items.getByLibraryAndKey(libraryId, pdfAttachmentKey)
      : item ? await item.getBestAttachment() : null;
    const exactParentMatches = !pdfAttachmentKey ||
      Number(att?.parentID ?? att?.parentItemID ?? 0) === Number(item?.id);
    if (att && exactParentMatches &&
        (typeof att.isPDFAttachment !== 'function' || att.isPDFAttachment())) {
      const pageSuffix = page ? `?page=${page}` : '';
      links.openPdf = `zotero://open-pdf/${prefix}/items/${att.key}${pageSuffix}`;
      links.openPdfHttp =
        `${openBase}?target=pdf&key=${att.key}${libParam}` + (page ? `&page=${page}` : '');
    }
  } catch {
    // keep the select links only
  }
  return links;
}

async function mapHybridResult(r: HybridSearchResult): Promise<ToolResultItem> {
  const libraryKey = r.libraryKey || libraryKeyForItemId(r.itemId);
  const scores = {
    semanticScore: typeof r.semanticScore === 'number' && Number.isFinite(r.semanticScore) ? r.semanticScore : null,
    bm25Score: typeof r.bm25Score === 'number' && Number.isFinite(r.bm25Score) ? r.bm25Score : null,
  };
  if (r.itemStatus === 'item_not_found') {
    return {
      itemKey: r.itemKey, libraryKey, title: 'Item not found', itemStatus: 'item_not_found',
      score: round3(r.rrfScore), source: r.source, matchedChunk: chunkOf(r),
      ...scores,
    };
  }
  const item = getLocalItem(r.itemId);
  const metadata = buildBibliographicMetadata(item);
  const journalMetrics = await readZoteroStyleJournalMetrics(item);
  return {
    itemKey: r.itemKey,
    libraryKey,
    title: r.title,
    authors: r.creators || undefined,
    year: metadata?.year ?? (r.year || undefined),
    score: round3(r.rrfScore),
    ...scores,
    source: r.source,
    matchedChunk: chunkOf(r),
    links: await buildLinks(libraryKey, r.itemKey, r.pageNumber, r.pdfAttachmentKey),
    metadata,
    ...(journalMetrics ? { journalMetrics } : {}),
  };
}

async function mapSearchResult(r: SearchResult): Promise<ToolResultItem> {
  const item = getLocalItem(r.itemId);
  const metadata = buildBibliographicMetadata(item);
  const journalMetrics = await readZoteroStyleJournalMetrics(item);
  return {
    itemKey: r.itemKey,
    libraryKey: r.libraryKey || null,
    title: r.title,
    authors: r.authors && r.authors.length ? r.authors : undefined,
    year: metadata?.year ?? r.year,
    score: round3(r.similarity),
    semanticScore: Number.isFinite(r.similarity) ? r.similarity : null,
    bm25Score: null,
    matchedChunk: chunkOf(r),
    links: await buildLinks(r.libraryKey || null, r.itemKey, r.pageNumber, r.pdfAttachmentKey),
    metadata,
    ...(journalMetrics ? { journalMetrics } : {}),
  };
}

/**
 * Defence-in-depth Origin check. Zotero's server already cancels browser
 * traffic (Mozilla/ User-Agent) before plugin endpoints run unless it
 * carries a Zotero-Allowed-Request or connector header, and it validates
 * the Host header. This check additionally rejects non-browser clients
 * that present a forged non-localhost Origin. Requests without an Origin
 * header (curl, native MCP clients) pass.
 */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
}

function resolveLibraryId(libraryKey: string | undefined, operation = 'search'): number | undefined {
  if (!libraryKey || typeof libraryKey !== 'string') return undefined;
  const key = libraryKey.trim();
  if (!key || key === 'user') return Zotero.Libraries.userLibraryID;
  if (key.startsWith('group:')) {
    const groupId = Number(key.slice('group:'.length).trim());
    if (!Number.isFinite(groupId) || groupId <= 0) {
      throw new Error(`${operation}: invalid group library key "${libraryKey}"`);
    }
    const libraryId = Zotero.Groups.getLibraryIDFromGroupID(groupId);
    if (libraryId === false) {
      throw new Error(`${operation}: unknown group library for group ${groupId}`);
    }
    return libraryId;
  }
  throw new Error(`${operation}: library_key must be "user" or "group:<groupID>", got "${libraryKey}"`);
}

function canonicalLibraryKey(libraryKey: string): string {
  const key = libraryKey.trim();
  return key === 'user' ? 'user' : `group:${Number(key.slice('group:'.length).trim())}`;
}

function normalizeCollectionKey(value: unknown, operation: string): string {
  if (typeof value !== 'string' || !/^[A-Z0-9]{8}$/i.test(value.trim())) {
    throw new Error(`${operation}: collection_key must be an 8-character Zotero collection key`);
  }
  return value.trim().toUpperCase();
}

function collectionParentId(collection: any, byKey: Map<string, any>): number | undefined {
  const rawId = collection?.parentID ?? collection?.parentCollectionID;
  if (rawId !== undefined && rawId !== null && rawId !== false && rawId !== '') {
    const value = Number(rawId);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`get_library_map: invalid parent for collection ${String(collection?.key || '')}`);
    }
    return value === 0 ? undefined : value;
  }
  const parentKey = cleanField(collection?.parentKey)?.toUpperCase();
  if (!parentKey) return undefined;
  const parent = byKey.get(parentKey);
  if (!parent) {
    throw new Error(`get_library_map: missing parent ${parentKey} for collection ${String(collection?.key || '')}`);
  }
  return Number(parent.id);
}

/** Build a complete deterministic tree and fail rather than silently omitting corrupt nodes. */
export function buildLibraryCollectionTree(
  collections: any[],
  expectedLibraryId: number,
): LibraryCollectionNode[] {
  const byId = new Map<number, any>();
  const byKey = new Map<string, any>();
  for (const collection of collections || []) {
    const id = Number(collection?.id);
    const key = normalizeCollectionKey(collection?.key, 'get_library_map');
    const name = cleanField(collection?.name);
    if (!Number.isSafeInteger(id) || id <= 0 || !name) {
      throw new Error(`get_library_map: invalid collection record ${key}`);
    }
    if (Number(collection.libraryID) !== expectedLibraryId) {
      throw new Error(`get_library_map: collection ${key} belongs to another library`);
    }
    if (byId.has(id) || byKey.has(key)) {
      throw new Error(`get_library_map: duplicate collection identity ${key}`);
    }
    byId.set(id, collection);
    byKey.set(key, collection);
  }

  const parentById = new Map<number, number | undefined>();
  const childrenById = new Map<number, number[]>();
  for (const [id, collection] of byId) {
    const parentId = collectionParentId(collection, byKey);
    if (parentId === id) throw new Error(`get_library_map: collection ${collection.key} is its own parent`);
    if (parentId !== undefined && !byId.has(parentId)) {
      throw new Error(`get_library_map: missing parent ${parentId} for collection ${collection.key}`);
    }
    parentById.set(id, parentId);
    if (parentId !== undefined) {
      const children = childrenById.get(parentId) || [];
      children.push(id);
      childrenById.set(parentId, children);
    }
  }

  const states = new Map<number, 1 | 2>();
  const visit = (id: number): void => {
    if (states.get(id) === 1) {
      throw new Error(`get_library_map: collection hierarchy contains a cycle at ${byId.get(id)?.key}`);
    }
    if (states.get(id) === 2) return;
    states.set(id, 1);
    const parentId = parentById.get(id);
    if (parentId !== undefined) visit(parentId);
    states.set(id, 2);
  };
  for (const id of byId.keys()) visit(id);

  const compareIds = (left: number, right: number) => {
    const a = byId.get(left);
    const b = byId.get(right);
    return String(a.name).localeCompare(String(b.name)) || String(a.key).localeCompare(String(b.key));
  };
  const toNode = (id: number): LibraryCollectionNode => {
    const collection = byId.get(id);
    return {
      collectionKey: String(collection.key).toUpperCase(),
      name: String(collection.name),
      children: (childrenById.get(id) || []).sort(compareIds).map(toNode),
    };
  };
  return [...byId.keys()]
    .filter(id => parentById.get(id) === undefined)
    .sort(compareIds)
    .map(toNode);
}

interface ResolvedCollectionScope {
  libraryId: number;
  collectionId: number;
  includeSubcollections: boolean;
  candidateFilterKey: string;
  candidateFilter: (identity: { libraryKey: string; itemKey: string }) => boolean;
  empty: boolean;
}

async function resolveCollectionScope(
  args: SearchToolArgs,
  libraryId: number | undefined,
): Promise<ResolvedCollectionScope | undefined> {
  const suppliedCollection = args.collection_key !== undefined;
  const suppliedRecursive = args.include_subcollections !== undefined;
  if (!suppliedCollection) {
    if (suppliedRecursive) {
      throw new Error('search: include_subcollections requires collection_key');
    }
    return undefined;
  }
  if (typeof args.include_subcollections !== 'undefined' && typeof args.include_subcollections !== 'boolean') {
    throw new Error('search: include_subcollections must be a boolean');
  }
  if (typeof args.library_key !== 'string' || !args.library_key.trim() || libraryId === undefined) {
    throw new Error('search: collection_key requires an explicit library_key');
  }
  const collectionKey = normalizeCollectionKey(args.collection_key, 'search');
  const includeSubcollections = args.include_subcollections !== false;
  let collection: any;
  try {
    collection = Zotero.Collections.getByLibraryAndKey(libraryId, collectionKey);
  } catch (error: any) {
    throw new Error(`search: failed to resolve collection ${collectionKey}: ${error?.message || error}`);
  }
  if (!collection || Number(collection.libraryID) !== libraryId) {
    throw new Error(`search: collection ${collectionKey} was not found in library ${args.library_key!.trim()}`);
  }

  const search = new Zotero.Search();
  search.libraryID = libraryId;
  search.addCondition('collectionID', 'is', String(collection.id));
  if (includeSubcollections) search.addCondition('recursive', 'true');
  search.addCondition('itemType', 'isNot', 'attachment');
  search.addCondition('itemType', 'isNot', 'note');
  let itemIds: number[];
  try {
    const rawIds = await search.search();
    if (!Array.isArray(rawIds)) {
      throw new Error('Zotero Search returned a non-array member list');
    }
    itemIds = [...new Set(rawIds.map(Number).filter(Number.isSafeInteger))];
  } catch (error: any) {
    throw new Error(`search: failed to read members of collection ${collectionKey}: ${error?.message || error}`);
  }

  let items: any[] = [];
  try {
    if (itemIds.length > 0) {
      const resolved = await Zotero.Items.getAsync(itemIds);
      items = Array.isArray(resolved) ? resolved : [resolved];
    }
  } catch (error: any) {
    throw new Error(`search: failed to resolve members of collection ${collectionKey}: ${error?.message || error}`);
  }
  const itemsById = new Map(items.filter(Boolean).map(item => [Number(item.id), item]));
  const unresolvedIds = itemIds.filter(itemId => !itemsById.has(itemId));
  if (unresolvedIds.length > 0) {
    throw new Error(
      `search: failed to resolve ${unresolvedIds.length} member(s) of collection ${collectionKey}`,
    );
  }
  const identities = new Set<string>();
  for (const item of items) {
    if (!item?.isRegularItem?.() || item.deleted || Number(item.libraryID) !== libraryId) continue;
    const identity = identityFromItem(item);
    if (!identity) {
      throw new Error(`search: stable identity unavailable for collection member ${String(item?.id || '')}`);
    }
    identities.add(`${identity.libraryKey}|${identity.itemKey}`);
  }
  const libraryKey = canonicalLibraryKey(args.library_key);
  return {
    libraryId,
    collectionId: Number(collection.id),
    includeSubcollections,
    candidateFilterKey: `${libraryKey}:${collectionKey}:${includeSubcollections ? 'recursive' : 'direct'}`,
    candidateFilter: identity => identities.has(`${identity.libraryKey}|${identity.itemKey}`),
    empty: identities.size === 0,
  };
}

export async function runGetLibraryMapTool(args: LibraryMapToolArgs = {}): Promise<LibraryMapResult> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('get_library_map: arguments must be an object');
  }
  if (args.library_key !== undefined &&
      (typeof args.library_key !== 'string' || !args.library_key.trim())) {
    throw new Error('get_library_map: library_key must be "user" or "group:<groupID>"');
  }
  const requestedLibraryKey = args.library_key?.trim() || 'user';
  const libraryId = resolveLibraryId(requestedLibraryKey, 'get_library_map');
  if (libraryId === undefined) throw new Error('get_library_map: library_key is required');
  const libraryKey = canonicalLibraryKey(requestedLibraryKey);
  let collections: any[];
  try {
    const raw = Zotero.Collections.getByLibrary(libraryId);
    if (!Array.isArray(raw)) {
      throw new Error('Zotero Collections returned a non-array collection list');
    }
    collections = raw;
  } catch (error: any) {
    throw new Error(`get_library_map: failed to enumerate library ${libraryKey}: ${error?.message || error}`);
  }
  const libraryName = cleanField(Zotero.Libraries.get?.(libraryId)?.name) ||
    (libraryKey === 'user' ? 'My Library' : libraryKey);
  return {
    libraryKey,
    name: libraryName,
    collections: buildLibraryCollectionTree(collections, libraryId),
  };
}

function normalizeFilterText(value: string): string {
  return value.trim().normalize('NFC').toLocaleLowerCase();
}

function validateSearchFilter(filter: SearchResultFilter | undefined): SearchResultFilter | undefined {
  if (filter === undefined) return undefined;
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    throw new Error('search: "filter" must be an object');
  }
  const normalized: SearchResultFilter = {};
  for (const field of ['year_from', 'year_to'] as const) {
    const value = filter[field];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error(`search: filter.${field} must be an integer`);
    }
    normalized[field] = value;
  }
  for (const field of ['journal', 'author', 'tag'] as const) {
    const value = filter[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`search: filter.${field} must be a non-empty string`);
    }
    normalized[field] = value.trim();
  }
  if (filter.exact !== undefined) {
    if (typeof filter.exact !== 'boolean') {
      throw new Error('search: filter.exact must be a boolean');
    }
    normalized.exact = filter.exact;
  }
  if (normalized.year_from !== undefined && normalized.year_to !== undefined &&
      normalized.year_from > normalized.year_to) {
    throw new Error('search: filter.year_from must not exceed filter.year_to');
  }
  return normalized;
}

function creatorCandidates(creator: BibliographicCreator): string[] {
  const firstName = creator.firstName?.trim() || '';
  const lastName = creator.lastName?.trim() || '';
  return [
    creator.name,
    firstName,
    lastName,
    firstName && lastName ? `${firstName} ${lastName}` : undefined,
    firstName && lastName ? `${lastName}, ${firstName}` : undefined,
  ].filter((value): value is string => !!value);
}

function hasSearchFilterCriteria(filter: SearchResultFilter | undefined): filter is SearchResultFilter {
  return !!filter && (filter.year_from !== undefined || filter.year_to !== undefined ||
    filter.journal !== undefined || filter.author !== undefined || filter.tag !== undefined);
}

function matchesSearchFilter(
  metadata: BibliographicMetadata | undefined,
  fallbackYear: number | undefined,
  tags: string[],
  filter: SearchResultFilter,
): boolean {
  const exact = filter.exact === true;
  const matches = (candidate: string, query: string) => {
    const normalizedCandidate = normalizeFilterText(candidate);
    const normalizedQuery = normalizeFilterText(query);
    return exact
      ? normalizedCandidate === normalizedQuery
      : normalizedCandidate.includes(normalizedQuery);
  };
  const year = metadata?.year ?? fallbackYear;
  if (filter.year_from !== undefined && (year === undefined || year < filter.year_from)) return false;
  if (filter.year_to !== undefined && (year === undefined || year > filter.year_to)) return false;

  if (filter.journal !== undefined) {
    const venues = [
      metadata?.publicationTitle,
      metadata?.bookTitle,
      metadata?.proceedingsTitle,
    ].filter((value): value is string => !!value);
    if (!venues.some(venue => matches(venue, filter.journal!))) return false;
  }

  if (filter.author !== undefined) {
    const candidates = (metadata?.creators || []).flatMap(creatorCandidates);
    if (!candidates.some(candidate => matches(candidate, filter.author!))) return false;
  }

  if (filter.tag !== undefined) {
    const expected = filter.tag.normalize('NFC');
    if (!tags.some(tag => tag.normalize('NFC') === expected)) return false;
  }
  return true;
}

/** Apply the documented post-filter while preserving the input ranking. */
export function applySearchResultFilter(
  results: ToolResultItem[],
  rawFilter: SearchResultFilter | undefined,
): ToolResultItem[] {
  const filter = validateSearchFilter(rawFilter);
  if (!hasSearchFilterCriteria(filter)) return results;
  return results.filter(result => matchesSearchFilter(
    result.metadata,
    result.year,
    (result as ToolResultItem & { tags?: string[] }).tags || [],
    filter,
  ));
}

/** MCP has a fixed threshold; legacy arguments cannot override it or UI prefs. */
export async function runMcpSearchTool(args: Omit<SearchToolArgs, 'min_similarity'>): Promise<{ results: ToolResultItem[] }> {
  return runSearchTool({ ...args, min_similarity: 0 });
}

export async function runSearchTool(args: SearchToolArgs): Promise<{ results: ToolResultItem[] }> {
  if (!args || typeof args.query !== 'string' || !args.query.trim()) {
    throw new Error('search: "query" is required and must be a non-empty string');
  }
  const finalTopK = clampInt(args.max_results, 1, 100, 10);
  const filter = validateSearchFilter(args.filter);
  const mode: SearchMode = args.mode && VALID_MODES.includes(args.mode) ? args.mode : 'hybrid';
  const libraryId = resolveLibraryId(args.library_key);
  const collectionScope = await resolveCollectionScope(args, libraryId);
  if (collectionScope?.empty) return { results: [] };
  const serverIssue = getSelectedServerModelConfigurationIssue();
  if (mode !== 'keyword' && serverIssue) {
    throw new Error(serverModelConfigurationErrorMessage(serverIssue));
  }
  const returnAllChunks = args.granularity === 'passages';
  const minSimilarity =
    args.min_similarity !== undefined
      ? clampFloat(args.min_similarity, 0, 1, prefMinSimilarity())
      : prefMinSimilarity();
  const indexingMode = normalizeProductIndexingMode(
    Zotero.Prefs.get('zotseek.indexingMode', true)
  );
  const options: any = { mode, finalTopK, returnAllChunks, minSimilarity, indexingMode };
  if (libraryId !== undefined) {
    options.libraryId = libraryId;
  }
  if (collectionScope) {
    options.collectionId = collectionScope.collectionId;
    options.includeSubcollections = collectionScope.includeSubcollections;
    options.candidateFilterKey = collectionScope.candidateFilterKey;
    options.candidateFilter = collectionScope.candidateFilter;
  }
  if (hasSearchFilterCriteria(filter)) {
    options.postFilter = (result: HybridSearchResult) => {
      const item = getLocalItem(result.itemId);
      if (!item || item.deleted) return false;
      return matchesSearchFilter(
        buildBibliographicMetadata(item),
        result.year || undefined,
        readTags(item),
        filter,
      );
    };
  }
  // UI, MCP and REST share the same paper ranking. Legacy smart-search
  // preferences do not change the fixed bounded bonus.
  const query = args.query.trim();
  const results =
    mode === 'hybrid' && prefAutoAdjustWeights()
      ? await hybridEngine.smartSearch(query, options)
      : await hybridEngine.search(query, options);
  const mapped = await Promise.all(results.map(mapHybridResult));
  // The engine applies live filters before finalTopK. Keep the old mapped
  // metadata check as defence in depth, excluding tag because search results
  // deliberately do not expose a new public tags field.
  const mappedFilter = filter?.tag === undefined ? filter : { ...filter, tag: undefined };
  return { results: applySearchResultFilter(mapped, mappedFilter) };
}

export async function runFindSimilarTool(args: FindSimilarToolArgs): Promise<{ results: ToolResultItem[] }> {
  const serverIssue = getSelectedServerModelConfigurationIssue();
  if (serverIssue) throw new Error(serverModelConfigurationErrorMessage(serverIssue));
  const key = typeof args?.item_key === 'string' ? args.item_key.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{8}$/.test(key)) {
    throw new Error('find_similar: "item_key" must be an 8-character Zotero item key');
  }
  const libraryKey = typeof args.library_key === 'string' && args.library_key.trim() ? args.library_key.trim() : 'user';
  const topK = clampInt(args.max_results, 1, 100, 10);
  const results = await searchEngine.findSimilarByIdentity(libraryKey, key, { topK });
  return { results: await Promise.all(results.map(mapSearchResult)) };
}

/** Parse the intentionally small first-version page grammar: N or N-M. */
export function parsePdfPageRange(value: string | undefined, maxPages = 20): number[] {
  const text = typeof value === 'string' ? value.trim() : '';
  const match = text.match(/^(\d+)(?:-(\d+))?$/u);
  if (!match) {
    throw new Error('get_item: "pdf_pages" must be one page or one continuous range such as "3" or "3-5"');
  }
  const start = Number(match[1]);
  const end = Number(match[2] || match[1]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    throw new Error('get_item: "pdf_pages" must use positive pages in ascending order');
  }
  if (end - start + 1 > maxPages) {
    throw new Error(`get_item: "pdf_pages" may request at most ${maxPages} continuous pages`);
  }
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function mergePdfReadSources(sources: Set<PdfReadSource>): PdfReadSource | undefined {
  if (sources.has('cache+pdfworker') ||
      (sources.has('zotero-fulltext-cache') && sources.has('pdfworker'))) {
    return 'cache+pdfworker';
  }
  if (sources.has('pdfworker')) return 'pdfworker';
  if (sources.has('zotero-fulltext-cache')) return 'zotero-fulltext-cache';
  return undefined;
}

/**
 * Scan a bounded physical-page tail backwards until References v2 finds a
 * citation region. Only the detected region is returned to the client; the
 * scan bound limits PDFWorker work without pretending a partial scan found no
 * references.
 */
async function readPdfReferenceRegion(attachment: any): Promise<PdfReadResult> {
  const limits = GET_ITEM_PDF_REFERENCE_READ_LIMITS;
  const probe = await zoteroAPI.readPdfAttachment(attachment, [1]);
  if (probe.status === 'failed') return probe;
  const totalPages = Number(probe.totalPages ?? 0);
  if (!Number.isSafeInteger(totalPages) || totalPages <= 0) {
    return {
      status: 'failed',
      attachmentKey: String(attachment.key || ''),
      complete: false,
      pages: [],
      error: 'Unable to determine the PDF page count',
    };
  }

  const available = new Map(probe.pages.map(page => [page.page, page]));
  const scanned = new Map<number, { page: number; text: string }>();
  const sources = new Set<PdfReadSource>();
  if (probe.source) sources.add(probe.source);
  let indexedPages = probe.indexedPages ?? 0;
  let cursor = totalPages;
  let scannedCharacters = 0;

  while (cursor >= 1 && scanned.size < limits.maxPages &&
      scannedCharacters < limits.maxCharacters) {
    const remaining = limits.maxPages - scanned.size;
    const start = Math.max(1, cursor - limits.batchPages + 1, cursor - remaining + 1);
    const pageNumbers = Array.from(
      { length: cursor - start + 1 },
      (_, index) => start + index,
    );
    const missing = pageNumbers.filter(page => !available.has(page));
    if (missing.length > 0) {
      const read = await zoteroAPI.readPdfAttachment(attachment, missing);
      if (read.status === 'failed') return read;
      if (read.source) sources.add(read.source);
      indexedPages = Math.max(indexedPages, read.indexedPages ?? 0);
      for (const page of read.pages) available.set(page.page, page);
    }
    for (const pageNumber of pageNumbers) {
      const page = available.get(pageNumber);
      if (!page) {
        return {
          status: 'failed',
          attachmentKey: String(attachment.key || ''),
          indexedPages,
          totalPages,
          complete: false,
          pages: [],
          error: `PDF read did not return physical page ${pageNumber}`,
        };
      }
      if (!scanned.has(pageNumber)) {
        scanned.set(pageNumber, page);
        scannedCharacters += page.text.length;
      }
    }

    const scannedPages = [...scanned.values()].sort((a, b) => a.page - b.page);
    const extracted = extractPdfReferencePages(scannedPages.map(page => ({
      pageNumber: page.page,
      text: page.text,
    })));
    if (extracted.regions.length > 0) {
      const pages = extracted.pages.map(page => ({ page: page.pageNumber, text: page.text }));
      const returned: typeof pages = [];
      let returnedCharacters = 0;
      let nextPage: number | undefined;
      for (const page of pages) {
        if (returned.length >= limits.maxPages ||
            (returned.length > 0 && returnedCharacters + page.text.length > limits.maxCharacters)) {
          nextPage = page.page;
          break;
        }
        returned.push(page);
        returnedCharacters += page.text.length;
      }
      const complete = nextPage === undefined;
      return {
        status: complete ? (returned.some(page => page.text.trim()) ? 'ok' : 'empty') : 'partial',
        source: mergePdfReadSources(sources),
        attachmentKey: String(attachment.key || ''),
        indexedPages,
        totalPages,
        complete,
        pages: returned,
        ...(!complete ? { limitReason: 'character_limit' as const, nextPage } : {}),
        referenceDetection: {
          strategyId: PDF_REFERENCE_REGION_STRATEGY_ID,
          strategyVersion: PDF_REFERENCE_REGION_STRATEGY_VERSION,
          scannedFromPage: scannedPages[0].page,
          scannedToPage: scannedPages[scannedPages.length - 1].page,
        },
      };
    }
    cursor = start - 1;
  }

  const scannedPages = [...scanned.values()].sort((a, b) => a.page - b.page);
  const fullyScanned = cursor < 1;
  const limitReason = scanned.size >= limits.maxPages ? 'page_limit' : 'character_limit';
  return {
    status: fullyScanned ? 'not_found' : 'partial',
    source: mergePdfReadSources(sources),
    attachmentKey: String(attachment.key || ''),
    indexedPages,
    totalPages,
    complete: fullyScanned,
    pages: [],
    ...(!fullyScanned ? { limitReason: limitReason as 'page_limit' | 'character_limit' } : {}),
    referenceDetection: {
      strategyId: PDF_REFERENCE_REGION_STRATEGY_ID,
      strategyVersion: PDF_REFERENCE_REGION_STRATEGY_VERSION,
      scannedFromPage: scannedPages[0]?.page ?? 1,
      scannedToPage: scannedPages[scannedPages.length - 1]?.page ?? totalPages,
    },
  };
}

function itemKeyArg(value: unknown, operation: string, argumentName = 'item_key'): string {
  const key = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{8}$/.test(key)) {
    throw new Error(`${operation}: "${argumentName}" must be an 8-character Zotero item key`);
  }
  return key;
}

function attachmentFilename(attachment: any): string | undefined {
  return cleanField(attachment?.attachmentFilename) ||
    cleanField(attachment?.getFilename?.()) ||
    readItemField(attachment, 'title');
}

function pdfAttachmentsForItem(item: any): any[] {
  const attachments: any[] = [];
  for (const id of item.getAttachments?.() || []) {
    try {
      const attachment = Zotero.Items.get(id);
      if (attachment) attachments.push(attachment);
    } catch {
      // Keep the rest of the attachment snapshot readable.
    }
  }
  return attachments;
}

function validatePdfAttachment(
  parent: any,
  libraryId: number,
  attachmentKey: string,
  suppliedByCaller: boolean,
): any | undefined {
  const attachment = Zotero.Items.getByLibraryAndKey(libraryId, attachmentKey);
  const parentId = Number(attachment?.parentID ?? attachment?.parentItemID ?? 0);
  const valid = !!attachment &&
    Number(attachment.libraryID ?? libraryId) === libraryId &&
    parentId === Number(parent.id) &&
    attachment.isAttachment?.() !== false &&
    attachment.isPDFAttachment?.() === true;
  if (valid) return attachment;
  if (suppliedByCaller) {
    throw new Error(
      'get_item: "pdf_attachment_key" must identify a PDF attachment belonging to the requested parent item and library',
    );
  }
  return undefined;
}

function readTags(item: any): string[] {
  const tags: string[] = (item.getTags?.() || [])
    .map((entry: any) => cleanField(entry?.tag))
    .filter((tag: string | undefined): tag is string => !!tag);
  return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b));
}

function readCollections(item: any, libraryKey: string): Array<{ libraryKey: string; key: string; name: string }> {
  const collections: Array<{ libraryKey: string; key: string; name: string }> =
    (item.getCollections?.() || []).map((id: number) => {
    try {
      const collection = Zotero.Collections.get(id);
      const key = cleanField(collection?.key);
      const name = cleanField(collection?.name);
      return key && name ? { libraryKey, key, name } : null;
    } catch {
      return null;
    }
    }).filter((value: any): value is { libraryKey: string; key: string; name: string } => !!value);
  return collections.sort((a, b) => a.key.localeCompare(b.key));
}

function readRelatedItems(item: any, libraryKey: string): Array<{ libraryKey: string; itemKey: string }> {
  const related = item.relatedItems ?? item.getRelatedItems?.() ?? [];
  const identities: Array<{ libraryKey: string; itemKey: string }> = [];
  for (const value of related) {
    if (typeof value === 'string' && /^[A-Z0-9]{8}$/i.test(value)) {
      identities.push({ libraryKey, itemKey: value.toUpperCase() });
      continue;
    }
    const relatedItem = typeof value === 'number' ? Zotero.Items.get(value) : value;
    const identity = relatedItem ? identityFromItem(relatedItem) : null;
    if (identity) identities.push(identity);
  }
  const unique = new Map(identities.map(identity => [
    `${identity.libraryKey}|${identity.itemKey}`,
    identity,
  ]));
  return Array.from(unique.values()).sort((a, b) =>
    `${a.libraryKey}|${a.itemKey}`.localeCompare(`${b.libraryKey}|${b.itemKey}`));
}

function readNotes(item: any): ItemNoteResult[] {
  const notes: ItemNoteResult[] = [];
  for (const id of item.getNotes?.() || []) {
    try {
      const note = Zotero.Items.get(id);
      if (!note?.isNote?.()) continue;
      const html = String(note.getNote?.() || '');
      const structured = noteHTMLToStructuredText(html, { filterIndexSubtrees: false });
      const sections = structured.sections.map(section => ({
        path: section.path,
        pathLevels: section.pathLevels,
        paragraphs: section.paragraphs,
      }));
      const uniquePaths = new Map<string, string[]>();
      for (const section of sections) {
        if (section.path.length > 0) uniquePaths.set(JSON.stringify(section.path), section.path);
      }
      const title = cleanField(note.getNoteTitle?.()) || noteHTMLFirstHeading(html);
      notes.push({
        noteKey: String(note.key || ''),
        ...(title ? { title } : {}),
        text: structured.visibleText,
        sections,
        sectionPaths: Array.from(uniquePaths.values()),
      });
    } catch {
      // One malformed child Note must not hide the rest of the item snapshot.
    }
  }
  return notes.filter(note => !!note.noteKey).sort((a, b) => a.noteKey.localeCompare(b.noteKey));
}

async function indexedPdfAttachmentKey(libraryKey: string, itemKey: string): Promise<string | undefined> {
  try {
    const store = getVectorStore();
    if (!store.isReady()) await store.init();
    return store.getIndexedPdfAttachmentKey(libraryKey, itemKey);
  } catch {
    // Reading a live Zotero item must remain available even without an index.
    return undefined;
  }
}

export async function runGetItemTool(rawArgs: GetItemToolArgs): Promise<GetItemResult> {
  const args = rawArgs || {} as GetItemToolArgs;
  const itemKey = itemKeyArg(args.item_key, 'get_item');
  const libraryKey = typeof args.library_key === 'string' && args.library_key.trim()
    ? args.library_key.trim()
    : 'user';
  const libraryId = resolveLibraryId(libraryKey, 'get_item');
  if (libraryId === undefined) throw new Error('get_item: unable to resolve library');

  const includePdf = args.include_pdf ?? 'none';
  if (!['none', 'pages', 'full', 'references'].includes(includePdf)) {
    throw new Error('get_item: "include_pdf" must be "none", "pages", "full", or "references"');
  }
  if (args.include_notes !== undefined && typeof args.include_notes !== 'boolean') {
    throw new Error('get_item: "include_notes" must be a boolean');
  }
  if (includePdf !== 'pages' && args.pdf_pages !== undefined) {
    throw new Error('get_item: "pdf_pages" is only valid when include_pdf is "pages"');
  }
  const requestedPages = includePdf === 'pages' ? parsePdfPageRange(args.pdf_pages) : null;

  const item = Zotero.Items.getByLibraryAndKey(libraryId, itemKey);
  if (!item) throw new Error(`get_item: item not found (${libraryKey}, ${itemKey})`);
  if (item.isNote?.() || item.isAttachment?.() || item.isRegularItem?.() === false) {
    throw new Error(`get_item: (${libraryKey}, ${itemKey}) is not a parent bibliographic item`);
  }

  const metadata = buildBibliographicMetadata(item);
  const journalMetrics = await readZoteroStyleJournalMetrics(item);
  if (!metadata) throw new Error('get_item: unable to read item metadata');
  const rawAttachments = pdfAttachmentsForItem(item);
  const indexedKey = rawAttachments.some(attachment => attachment.isPDFAttachment?.() === true)
    ? await indexedPdfAttachmentKey(libraryKey, itemKey)
    : undefined;
  const suppliedPdfKey = args.pdf_attachment_key === undefined
    ? undefined
    : itemKeyArg(args.pdf_attachment_key, 'get_item', 'pdf_attachment_key').toUpperCase();
  const selectedAttachment = suppliedPdfKey
    ? validatePdfAttachment(item, libraryId, suppliedPdfKey, true)
    : indexedKey ? validatePdfAttachment(item, libraryId, indexedKey, false) : undefined;

  const attachments: ItemAttachmentResult[] = [];
  for (const attachment of rawAttachments) {
    const isPDF = attachment.isPDFAttachment?.() === true;
    const exactLinks = isPDF
      ? await buildLinks(libraryKey, itemKey, undefined, String(attachment.key || ''))
      : undefined;
    attachments.push({
      key: String(attachment.key || ''),
      contentType: cleanField(attachment.attachmentContentType),
      isPDF,
      filename: attachmentFilename(attachment),
      isIndexedPdfSource: !!indexedKey && attachment.key === indexedKey,
      ...(exactLinks?.openPdf ? {
        links: { openPdf: exactLinks.openPdf, openPdfHttp: exactLinks.openPdfHttp },
      } : {}),
    });
  }
  attachments.sort((a, b) => a.key.localeCompare(b.key));

  const result: GetItemResult = {
    itemKey,
    libraryKey,
    metadata,
    tags: readTags(item),
    collections: readCollections(item, libraryKey),
    relatedItems: readRelatedItems(item, libraryKey),
    attachments,
    links: await buildLinks(libraryKey, itemKey, undefined, selectedAttachment?.key),
    ...(journalMetrics ? { journalMetrics } : {}),
  };

  if (args.include_notes) result.notes = readNotes(item);

  if (includePdf !== 'none') {
    const pdfAttachments = rawAttachments.filter(attachment => attachment.isPDFAttachment?.() === true);
    if (pdfAttachments.length === 0) {
      result.pdf = { status: 'missing', complete: false, pages: [] };
    } else if (!selectedAttachment) {
      result.pdf = { status: 'unresolved', complete: false, pages: [] };
    } else {
      const pdf = includePdf === 'references'
        ? await readPdfReferenceRegion(selectedAttachment)
        : await zoteroAPI.readPdfAttachment(
            selectedAttachment,
            includePdf === 'pages' ? requestedPages : null,
            includePdf === 'full' ? GET_ITEM_PDF_FULL_READ_LIMITS : undefined,
          );
      if (pdf.status === 'failed' && pdf.error?.startsWith('Requested PDF page exceeds')) {
        throw new Error(`get_item: ${pdf.error}`);
      }
      result.pdf = pdf;
    }
  }

  return result;
}

export async function runIndexStatusTool(): Promise<object> {
  const store = getVectorStore();
  if (!store.isReady()) {
    await store.init();
  }
  const stats = await store.getStats();
  const serverIssue = getSelectedServerModelConfigurationIssue();
  const activeModel = getActiveModelId();
  // A placeholder selection is not a vector-space id. Report zero usable
  // coverage without querying the database under that sentinel.
  const coverage = serverIssue
    ? { covered: 0, total: stats.indexedPapers }
    : await store.getCoverage(activeModel);
  return {
    // "Will searches return meaningful results?" — the embedding pipeline
    // lazy-loads on first search, so readiness is about the index itself.
    ready: !serverIssue && stats.indexedPapers > 0,
    modelLoaded: !serverIssue && (Zotero.ZotSeek?.api?.isReady?.() ?? false),
    indexedPapers: stats.indexedPapers,
    totalChunks: stats.totalChunks,
    modelId: stats.modelId,
    activeModel,
    coverage,
    ...(serverIssue
      ? { configurationError: serverModelConfigurationErrorMessage(serverIssue) }
      : {}),
    lastIndexed: stats.lastIndexed,
    storageUsedBytes: stats.storageUsedBytes,
  };
}

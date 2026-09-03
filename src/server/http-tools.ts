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
import { PdfReadResult, ZoteroAPI } from '../utils/zotero-api';
import { OPEN_PATH } from './open-endpoint';
import { normalizeProductIndexingMode } from '../core/search-policy';

declare const Zotero: any;

// One engine instance for all HTTP-facing searches (same wrapping the UI uses)
const hybridEngine = new HybridSearchEngine(searchEngine);
const zoteroAPI = new ZoteroAPI();

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
  authors?: string[] | string;
  year?: number;
  score: number;
  source?: 'both' | 'semantic' | 'keyword';
  matchedChunk: MatchedChunk | null;
  links?: ResultLinks;
  /** Full bibliographic fields from the live Zotero item, when resolvable. */
  metadata?: BibliographicMetadata;
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
  filter?: SearchResultFilter;
}

export interface SearchResultFilter {
  year_from?: number;
  year_to?: number;
  journal?: string;
  author?: string;
  exact?: boolean;
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
  include_pdf?: 'none' | 'pages' | 'full';
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
    const pct = Zotero.Prefs.get('zotseek.minSimilarityPercent', true);
    if (typeof pct === 'number' && pct >= 0 && pct <= 100) return pct / 100;
  } catch {
    // fall through to default
  }
  return 0.3;
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
  const metadata = buildBibliographicMetadata(getLocalItem(r.itemId));
  return {
    itemKey: r.itemKey,
    libraryKey,
    title: r.title,
    authors: r.creators || undefined,
    year: metadata?.year ?? (r.year || undefined),
    score: round3(r.rrfScore),
    source: r.source,
    matchedChunk: chunkOf(r),
    links: await buildLinks(libraryKey, r.itemKey, r.pageNumber, r.pdfAttachmentKey),
    metadata,
  };
}

async function mapSearchResult(r: SearchResult): Promise<ToolResultItem> {
  const metadata = buildBibliographicMetadata(getLocalItem(r.itemId));
  return {
    itemKey: r.itemKey,
    libraryKey: r.libraryKey || null,
    title: r.title,
    authors: r.authors && r.authors.length ? r.authors : undefined,
    year: metadata?.year ?? r.year,
    score: round3(r.similarity),
    matchedChunk: chunkOf(r),
    links: await buildLinks(r.libraryKey || null, r.itemKey, r.pageNumber, r.pdfAttachmentKey),
    metadata,
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
  for (const field of ['journal', 'author'] as const) {
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

/** Apply the documented post-filter to the already-ranked result window. */
export function applySearchResultFilter(
  results: ToolResultItem[],
  rawFilter: SearchResultFilter | undefined,
): ToolResultItem[] {
  const filter = validateSearchFilter(rawFilter);
  if (!filter) return results;
  const exact = filter.exact === true;
  const matches = (candidate: string, query: string) => {
    const normalizedCandidate = normalizeFilterText(candidate);
    const normalizedQuery = normalizeFilterText(query);
    return exact
      ? normalizedCandidate === normalizedQuery
      : normalizedCandidate.includes(normalizedQuery);
  };

  return results.filter(result => {
    const year = result.metadata?.year ?? result.year;
    if (filter.year_from !== undefined && (year === undefined || year < filter.year_from)) return false;
    if (filter.year_to !== undefined && (year === undefined || year > filter.year_to)) return false;

    if (filter.journal !== undefined) {
      const venues = [
        result.metadata?.publicationTitle,
        result.metadata?.bookTitle,
        result.metadata?.proceedingsTitle,
      ].filter((value): value is string => !!value);
      if (!venues.some(venue => matches(venue, filter.journal!))) return false;
    }

    if (filter.author !== undefined) {
      const candidates = (result.metadata?.creators || []).flatMap(creatorCandidates);
      if (!candidates.some(candidate => matches(candidate, filter.author!))) return false;
    }
    return true;
  });
}

export async function runSearchTool(args: SearchToolArgs): Promise<{ results: ToolResultItem[] }> {
  if (!args || typeof args.query !== 'string' || !args.query.trim()) {
    throw new Error('search: "query" is required and must be a non-empty string');
  }
  const finalTopK = clampInt(args.max_results, 1, 100, 10);
  const filter = validateSearchFilter(args.filter);
  const mode: SearchMode = args.mode && VALID_MODES.includes(args.mode) ? args.mode : 'hybrid';
  const serverIssue = getSelectedServerModelConfigurationIssue();
  if (mode !== 'keyword' && serverIssue) {
    throw new Error(serverModelConfigurationErrorMessage(serverIssue));
  }
  const returnAllChunks = args.granularity === 'passages';
  const minSimilarity =
    args.min_similarity !== undefined
      ? clampFloat(args.min_similarity, 0, 1, prefMinSimilarity())
      : prefMinSimilarity();
  const libraryId = resolveLibraryId(args.library_key);
  const indexingMode = normalizeProductIndexingMode(
    Zotero.Prefs.get('zotseek.indexingMode', true)
  );
  const options: any = { mode, finalTopK, returnAllChunks, minSimilarity, indexingMode };
  if (libraryId !== undefined) {
    options.libraryId = libraryId;
  }
  // UI, MCP and REST share the same indexing-mode-aware product policy and
  // the same optional query-weight analysis inside the Notes H1 specialist.
  const query = args.query.trim();
  const results =
    mode === 'hybrid' && prefAutoAdjustWeights()
      ? await hybridEngine.smartSearch(query, options)
      : await hybridEngine.search(query, options);
  const mapped = await Promise.all(results.map(mapHybridResult));
  return { results: applySearchResultFilter(mapped, filter) };
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
  if (!['none', 'pages', 'full'].includes(includePdf)) {
    throw new Error('get_item: "include_pdf" must be "none", "pages", or "full"');
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
  };

  if (args.include_notes) result.notes = readNotes(item);

  if (includePdf !== 'none') {
    const pdfAttachments = rawAttachments.filter(attachment => attachment.isPDFAttachment?.() === true);
    if (pdfAttachments.length === 0) {
      result.pdf = { status: 'missing', complete: false, pages: [] };
    } else if (!selectedAttachment) {
      result.pdf = { status: 'unresolved', complete: false, pages: [] };
    } else {
      const pdf = await zoteroAPI.readPdfAttachment(
        selectedAttachment,
        includePdf === 'pages' ? requestedPages : null,
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

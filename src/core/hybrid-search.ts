/**
 * Hybrid Search - Combines semantic search with Zotero keyword search
 *
 * Uses Reciprocal Rank Fusion (RRF) to merge results from:
 * 1. Semantic search (embedding similarity)
 * 2. Zotero's built-in quick search (keywords, metadata)
 *
 * This addresses limitations of pure semantic search:
 * - Author names: "Smith 2023" → keyword search finds the author
 * - Acronyms: "RLHF" → keyword matches exact term
 * - Technical terms: "p < 0.05" → keyword captures exact notation
 * - Zotero metadata: tags, collections, item types
 */

import { Logger } from '../utils/logger';
import { SearchEngine, SearchResult } from './search-engine';
import { TextSourceType } from './vector-store-sqlite';
import { boundedTextSnippet, noteHTMLToStructuredText } from '../utils/note-text';
import { identityFromItem } from './identity-resolver';
import {
  FULL_NOTES_HEAD_SLOTS,
  METADATA_NOTE_SOURCES,
  PDF_SOURCES,
  ProductIndexingMode,
  allocatePrimaryWithAlternateTail,
  classifyMetadataIdentity,
  normalizeProductIndexingMode,
  resolveProductHybridPolicy,
} from './search-policy';

declare const Zotero: any;

export interface HybridSearchResult {
  itemId: number;
  itemKey: string;
  libraryKey?: string;
  title: string;
  creators: string;
  year: number;

  // Scores from different sources
  semanticScore: number | null;    // Cosine similarity (0-1)
  keywordScore: number | null;     // Normalized keyword relevance

  // Combined score
  rrfScore: number;                // RRF combined score

  // Rank information (for debugging/display)
  semanticRank: number | null;
  keywordRank: number | null;

  // Source indicator: 'both' | 'semantic' | 'keyword'
  source: 'both' | 'semantic' | 'keyword';

  // Internal product-policy channel. This lets UI-level multi-query merging
  // preserve Full's Notes-head/PDF-tail allocation after combining scores.
  policyChannel?: 'identity' | 'notes' | 'pdf';

  // Original text source from semantic search (e.g., 'methods', 'findings', 'summary')
  textSource?: TextSourceType;

  // Chunk identification (for all-chunks mode)
  chunkIndex?: number;        // Chunk index within the item

  // Text of the matched chunk (top results only) — for snippet display on hover
  chunkText?: string;
  sectionPaths?: string[][];
  pdfAttachmentKey?: string;

  // Location information from matched chunk
  pageNumber?: number;        // 1-based page number
  paragraphIndex?: number;    // 0-based paragraph index within page

  // Multi-query scores (for tooltip display in multi-query search)
  queryScores?: number[];     // Individual scores from each query
}

export interface HybridSearchOptions {
  // How many results to fetch from each source before fusion
  semanticTopK?: number;      // Default: 50
  keywordTopK?: number;       // Default: 50

  // Final results limit
  finalTopK?: number;         // Default: 20

  // RRF constant (higher = more weight to lower ranks)
  rrfK?: number;              // Default: 60

  // Minimum semantic similarity to include
  minSimilarity?: number;     // Default: 0.7 (multilingual E5)

  // Weight balance (0 = keyword only, 1 = semantic only)
  semanticWeight?: number;    // Default: 0.5 (equal weight)

  // Scope
  collectionId?: number;      // Limit to collection
  libraryId?: number;         // Limit to library

  // Search mode override
  mode?: 'hybrid' | 'semantic' | 'keyword';

  // Stable indexing mode used to choose the product-default hybrid policy.
  indexingMode?: ProductIndexingMode;

  // Internal specialist source constraints.
  semanticTextSources?: TextSourceType[];
  keywordTextSources?: TextSourceType[];

  // Return all chunks instead of MaxSim aggregation (for location-level results)
  returnAllChunks?: boolean;  // Default: false
}

type ResolvedHybridSearchOptions = Required<Omit<
  HybridSearchOptions,
  'collectionId' | 'libraryId' | 'mode' | 'indexingMode' |
  'semanticTextSources' | 'keywordTextSources'
>> & HybridSearchOptions;

const DEFAULT_OPTIONS: Required<Omit<
  HybridSearchOptions,
  'collectionId' | 'libraryId' | 'mode' | 'indexingMode' |
  'semanticTextSources' | 'keywordTextSources'
>> = {
  semanticTopK: 50,
  keywordTopK: 50,
  finalTopK: 20,
  rrfK: 60,
  minSimilarity: 0.7,
  semanticWeight: 0.5,
  returnAllChunks: false,
};

export interface QueryAnalysis {
  semanticWeight: number;
  reasoning: string;
  detectedPatterns: string[];
}

interface KeywordSearchHit {
  itemId: number;
  libraryKey?: string;
  itemKey?: string;
  score: number;
  textSource?: TextSourceType;
  chunkText?: string;
  sectionPaths?: string[][];
  pdfAttachmentKey?: string;
}

interface SemanticSearchHit {
  itemId: number;
  libraryKey: string;
  itemKey: string;
  score: number;
  textSource?: TextSourceType;
  chunkIndex?: number;
  chunkText?: string;
  sectionPaths?: string[][];
  pdfAttachmentKey?: string;
  pageNumber?: number;
  paragraphIndex?: number;
}

function stableRankingKey(result: {
  itemId: number;
  libraryKey?: string;
  itemKey?: string;
}): string {
  return result.libraryKey && result.itemKey
    ? `${result.libraryKey}|${result.itemKey}`
    : `local:${result.itemId}`;
}

function stablePassageKey(result: HybridSearchResult): string {
  return `${stableRankingKey(result)}|chunk:${result.chunkIndex ?? 0}`;
}

interface ItemBatchEntry {
  item: any | null;
  failed: boolean;
}

/**
 * Resolve items in one Zotero round trip while retaining per-id failure
 * semantics.  The scalar fallback is only used when the batch API rejects;
 * normal reads therefore avoid an N-round-trip loop without turning a batch
 * failure into a result-wide failure.
 */
async function getItemsBatch(ids: number[]): Promise<Map<number, ItemBatchEntry>> {
  const uniqueIds = [...new Set(ids.filter(id => Number.isFinite(id)))];
  const entries = new Map<number, ItemBatchEntry>();
  uniqueIds.forEach(id => entries.set(id, { item: null, failed: false }));
  if (uniqueIds.length === 0) return entries;

  try {
    const resolved = await Zotero.Items.getAsync(uniqueIds);
    const items = Array.isArray(resolved) ? resolved : (resolved ? [resolved] : []);
    const requested = new Set(uniqueIds);
    items.forEach((item: any, index: number) => {
      if (!item) return;
      const itemId = Number(item.id);
      // Zotero normally returns item objects with ids.  The positional
      // fallback keeps mocks and older runtimes usable when an id is absent.
      const mappedId = requested.has(itemId)
        ? itemId
        : (items.length === uniqueIds.length ? uniqueIds[index] : undefined);
      if (mappedId !== undefined) entries.set(mappedId, { item, failed: false });
    });
    return entries;
  } catch {
    await Promise.all(uniqueIds.map(async id => {
      try {
        const resolved = await Zotero.Items.getAsync(id);
        const item = Array.isArray(resolved) ? (resolved[0] ?? null) : (resolved ?? null);
        entries.set(id, { item, failed: false });
      } catch {
        entries.set(id, { item: null, failed: true });
      }
    }));
    return entries;
  }
}

/**
 * Hybrid Search Engine
 * Combines semantic and keyword search using Reciprocal Rank Fusion
 */
export class HybridSearchEngine {
  private logger: Logger;
  private semanticSearch: SearchEngine;

  constructor(semanticSearchEngine: SearchEngine) {
    this.logger = new Logger('HybridSearch');
    this.semanticSearch = semanticSearchEngine;
  }

  /**
   * Perform hybrid search combining semantic and keyword results
   */
  async search(query: string, options: HybridSearchOptions = {}): Promise<HybridSearchResult[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    this.logger.info(`Hybrid search: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);

    // Handle mode overrides
    if (opts.mode === 'semantic') {
      return this.semanticOnlySearch(query, opts);
    } else if (opts.mode === 'keyword') {
      return this.keywordOnlySearch(query, opts);
    }

    const indexingMode = this.resolveIndexingMode(opts.indexingMode);
    const policy = resolveProductHybridPolicy(indexingMode, 'hybrid');
    this.logger.info(`Product hybrid policy: ${policy} (indexingMode=${indexingMode})`);

    const identityResults = await this.identityNavigationSearch(query, opts);
    if (identityResults.length > 0) return identityResults;

    if (policy === 'abstract-identity-semantic') {
      return this.semanticOnlySearch(query, opts);
    }
    if (policy === 'notes-identity-h1') {
      return this.fixedHybridSearch(query, {
        ...opts,
        semanticTextSources: METADATA_NOTE_SOURCES,
        keywordTextSources: METADATA_NOTE_SOURCES,
      });
    }
    if (policy === 'full-identity-notes2-pdf') {
      return this.fullSourceAwareSearch(query, opts);
    }

    return this.fixedHybridSearch(query, opts);
  }

  private resolveIndexingMode(override?: ProductIndexingMode): ProductIndexingMode {
    if (override) return normalizeProductIndexingMode(override);
    try {
      return normalizeProductIndexingMode(Zotero.Prefs.get('zotseek.indexingMode', true));
    } catch {
      return 'abstract';
    }
  }

  /** H1: frozen RRF structure over semantic and T0 BM25 ranks. */
  private async fixedHybridSearch(
    query: string,
    opts: ResolvedHybridSearchOptions,
    populateMetadata = true,
  ): Promise<HybridSearchResult[]> {
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearchQuery(query, opts),
      this.keywordSearchQuery(query, opts),
    ]);

    this.logger.info(`Got ${semanticResults.length} semantic, ${keywordResults.length} keyword results`);

    // Fuse results using RRF
    const fusedResults = this.reciprocalRankFusion(
      semanticResults,
      keywordResults,
      opts
    );

    // Populate metadata for top results
    if (populateMetadata) {
      await this.populateItemMetadata(fusedResults.slice(0, opts.finalTopK));
    }

    // Return top K
    return fusedResults.slice(0, opts.finalTopK);
  }

  /** Full product default: Notes H1 owns two head slots; PDF semantic owns the tail. */
  private async fullSourceAwareSearch(
    query: string,
    opts: ResolvedHybridSearchOptions,
  ): Promise<HybridSearchResult[]> {
    const specialistTopK = Math.max(opts.finalTopK, opts.semanticTopK, opts.keywordTopK);
    const [notesResults, pdfResults] = await Promise.all([
      this.fixedHybridSearch(query, {
        ...opts,
        finalTopK: specialistTopK,
        semanticTextSources: METADATA_NOTE_SOURCES,
        keywordTextSources: METADATA_NOTE_SOURCES,
      }, false),
      this.semanticOnlySearch(query, {
        ...opts,
        finalTopK: specialistTopK,
        semanticTopK: specialistTopK,
        semanticTextSources: PDF_SOURCES,
      }, false),
    ]);

    const taggedNotes = notesResults.map(result => ({ ...result, policyChannel: 'notes' as const }));
    const taggedPdf = pdfResults.map(result => ({ ...result, policyChannel: 'pdf' as const }));
    const identity = opts.returnAllChunks ? stablePassageKey : stableRankingKey;
    const allocated = allocatePrimaryWithAlternateTail(
      taggedNotes,
      taggedPdf,
      opts.finalTopK,
      FULL_NOTES_HEAD_SLOTS,
      identity,
    ).map((result, index) => ({
      ...result,
      // Hybrid scores remain rank-only values. The specialist's native
      // semanticScore/keywordScore fields retain the useful diagnostics.
      rrfScore: 1 / (opts.rrfK + index + 1),
    }));

    await this.populateItemMetadata(allocated);
    return allocated;
  }

  /**
   * Metadata-only navigation. Exact identity and author collections return
   * directly, so author/title lookup does not depend on Note/PDF contents.
   */
  private async identityNavigationSearch(
    query: string,
    opts: ResolvedHybridSearchOptions,
  ): Promise<HybridSearchResult[]> {
    const totalStartedAt = Date.now();
    let searchMs = 0;
    let metadataLoadMs = 0;
    let candidateFilterMs = 0;
    let classifyMs = 0;
    let itemIdCount = 0;
    let candidateCount = 0;
    try {
      const search = new Zotero.Search();
      if (opts.libraryId !== undefined) search.libraryID = opts.libraryId;
      if (opts.collectionId) {
        search.addCondition('collectionID', 'is', opts.collectionId.toString());
      }
      const doiQuery = /(?:^|doi(?:\.org)?[/:\s])10\.\d{4,9}\//i.test(query);
      search.addCondition(
        doiQuery ? 'quicksearch-everything' : 'quicksearch-titleCreatorYear',
        'contains',
        query,
      );
      search.addCondition('itemType', 'isNot', 'attachment');
      search.addCondition('itemType', 'isNot', 'note');
      const searchStartedAt = Date.now();
      const itemIds = await search.search().catch(() => []);
      searchMs = Date.now() - searchStartedAt;
      itemIdCount = itemIds.length;
      const excludeBooks = Zotero.Prefs.get('zotseek.excludeBooks', true) ?? true;
      const candidates: Array<{
        id: string;
        title: string;
        doi?: string;
        year?: string;
        creators: Array<{ firstName?: string; lastName?: string; name?: string }>;
        item: any;
      }> = [];
      // Identity and author-set semantics require the complete metadata match
      // set. Bulk resolution avoids an N-round-trip loop and lets the final
      // author collection be sorted deterministically instead of depending on
      // Zotero Search's unspecified result order.
      const metadataLoadStartedAt = Date.now();
      const resolvedItems = itemIds.length > 0
        ? await Zotero.Items.getAsync(itemIds)
        : [];
      metadataLoadMs = Date.now() - metadataLoadStartedAt;
      const candidateFilterStartedAt = Date.now();
      for (const item of (Array.isArray(resolvedItems) ? resolvedItems : [resolvedItems])) {
        if (!item?.isRegularItem?.()) continue;
        if (excludeBooks && item.itemType === 'book') continue;
        const date = String(item.getField('date') || '');
        candidates.push({
          id: String(item.id),
          title: String(item.getField('title') || ''),
          doi: String(item.getField('DOI') || ''),
          year: date.match(/\b\d{4}\b/)?.[0],
          creators: (item.getCreators?.() || []).map((creator: any) => ({
            firstName: creator.firstName,
            lastName: creator.lastName,
            name: creator.name,
          })),
          item,
        });
      }
      candidateFilterMs = Date.now() - candidateFilterStartedAt;
      candidateCount = candidates.length;

      const classifyStartedAt = Date.now();
      const match = classifyMetadataIdentity(query, candidates);
      classifyMs = Date.now() - classifyStartedAt;
      if (!match) {
        this.logger.debug(
          `Identity prepass: match=none itemIds=${itemIdCount} candidates=${candidateCount} ` +
          `search=${searchMs}ms metadata=${metadataLoadMs}ms filter=${candidateFilterMs}ms ` +
          `classify=${classifyMs}ms total=${Date.now() - totalStartedAt}ms`
        );
        return [];
      }
      const resultStartedAt = Date.now();
      const matchedCandidates = [...match.candidates];
      const candidateIdentity = (candidate: typeof matchedCandidates[number]) => {
        const stable = identityFromItem(candidate.item);
        return stable ? `${stable.libraryKey}|${stable.itemKey}` : `local:${candidate.item.id}`;
      };
      if (match.kind === 'author-set' || match.kind === 'author-year-set') {
        matchedCandidates.sort((left, right) =>
          String(right.year ?? '').localeCompare(String(left.year ?? '')) ||
          left.title.localeCompare(right.title) ||
          candidateIdentity(left).localeCompare(candidateIdentity(right)));
      } else {
        matchedCandidates.sort((left, right) =>
          candidateIdentity(left).localeCompare(candidateIdentity(right)));
      }
      const results = matchedCandidates.slice(0, opts.finalTopK).map((candidate, index) => ({
        libraryKey: identityFromItem(candidate.item)?.libraryKey,
        itemId: candidate.item.id,
        itemKey: candidate.item.key || '',
        title: candidate.title || 'Untitled',
        creators: '',
        year: Number(candidate.year || 0),
        semanticScore: null,
        keywordScore: 1,
        rrfScore: 1 / (opts.rrfK + index + 1),
        semanticRank: null,
        keywordRank: index + 1,
        source: 'keyword' as const,
        policyChannel: 'identity' as const,
        textSource: 'summary' as TextSourceType,
      }));
      await this.populateItemMetadata(results);
      this.logger.info(
        `Identity navigation: match=${match.kind} results=${results.length} ` +
        `itemIds=${itemIdCount} candidates=${candidateCount} search=${searchMs}ms ` +
        `metadata=${metadataLoadMs}ms filter=${candidateFilterMs}ms classify=${classifyMs}ms ` +
        `finalize=${Date.now() - resultStartedAt}ms total=${Date.now() - totalStartedAt}ms`
      );
      return results;
    } catch (error) {
      this.logger.debug(
        `Identity navigation abstained after metadata error: ${error}; ` +
        `itemIds=${itemIdCount} candidates=${candidateCount} search=${searchMs}ms ` +
        `metadata=${metadataLoadMs}ms filter=${candidateFilterMs}ms ` +
        `classify=${classifyMs}ms total=${Date.now() - totalStartedAt}ms`
      );
      return [];
    }
  }

  /**
   * Semantic-only search (converts to HybridSearchResult format)
   */
  private async semanticOnlySearch(
    query: string,
    opts: ResolvedHybridSearchOptions,
    populateMetadata = true,
  ): Promise<HybridSearchResult[]> {
    const results = await this.semanticSearchQuery(query, opts);

    const hybridResults: HybridSearchResult[] = results.map((r, index) => ({
      itemId: r.itemId,
      libraryKey: r.libraryKey,
      itemKey: r.itemKey,
      title: '',
      creators: '',
      year: 0,
      semanticScore: r.score,
      keywordScore: null,
      rrfScore: r.score, // Use raw score for semantic-only
      semanticRank: index + 1,
      keywordRank: null,
      source: 'semantic' as const,
      textSource: r.textSource,
      chunkIndex: r.chunkIndex,
      chunkText: r.chunkText,
      sectionPaths: r.sectionPaths,
      pdfAttachmentKey: r.pdfAttachmentKey,
      pageNumber: r.pageNumber,
      paragraphIndex: r.paragraphIndex,
    }));

    if (populateMetadata) {
      await this.populateItemMetadata(hybridResults.slice(0, opts.finalTopK));
    }
    return hybridResults.slice(0, opts.finalTopK);
  }

  /**
   * Keyword-only search (converts to HybridSearchResult format)
   */
  private async keywordOnlySearch(
    query: string,
    opts: ResolvedHybridSearchOptions
  ): Promise<HybridSearchResult[]> {
    const results = await this.keywordSearchQuery(query, opts);

    const hybridResults: HybridSearchResult[] = results.map((r, index) => ({
      itemId: r.itemId,
      libraryKey: r.libraryKey,
      itemKey: r.itemKey || '',
      title: '',
      creators: '',
      year: 0,
      semanticScore: null,
      keywordScore: r.score,
      rrfScore: r.score, // Use raw score for keyword-only
      semanticRank: null,
      keywordRank: index + 1,
      source: 'keyword' as const,
      textSource: r.textSource,
      chunkText: r.chunkText,
      sectionPaths: r.sectionPaths,
      pdfAttachmentKey: r.pdfAttachmentKey,
    }));

    await this.populateItemMetadata(hybridResults.slice(0, opts.finalTopK));
    return hybridResults.slice(0, opts.finalTopK);
  }

  /**
   * Semantic search using embeddings
   */
  private async semanticSearchQuery(
    query: string,
    opts: ResolvedHybridSearchOptions
  ): Promise<SemanticSearchHit[]> {
    try {
      // Initialize search engine if needed
      if (!this.semanticSearch.isReady()) {
        await this.semanticSearch.init();
      }

      const results = await this.semanticSearch.search(query, {
        topK: opts.returnAllChunks ? opts.semanticTopK * 3 : opts.semanticTopK, // Get more chunks when returning all
        minSimilarity: opts.minSimilarity,
        libraryId: opts.libraryId,
        textSources: opts.semanticTextSources,
        returnAllChunks: opts.returnAllChunks,
      });

      // Drop orphan results (no resolved local itemId) — hybrid search needs a
      // local item for keyword merging and navigation.
      let filteredResults = results.filter(
        (r): r is SearchResult & { itemId: number } => r.itemId !== undefined
      );

      // Filter out books if preference is set
      const excludeBooks = Zotero.Prefs.get('zotseek.excludeBooks', true) ?? true;
      if (excludeBooks) {
        const itemsById = await getItemsBatch(filteredResults.map(r => r.itemId));
        const kept: typeof filteredResults = [];
        for (const r of filteredResults) {
          const entry = itemsById.get(r.itemId);
          // If an individual lookup failed, retain the previous fail-open
          // behavior. A missing item still drops the result as before.
          if (entry?.failed) kept.push(r);
          else if (entry?.item && entry.item.itemType !== 'book') kept.push(r);
        }
        filteredResults = kept;
      }

      return filteredResults.map((r) => ({
        itemId: r.itemId,
        libraryKey: r.libraryKey,
        itemKey: r.itemKey,
        score: r.similarity,
        textSource: r.textSource,
        chunkIndex: r.chunkIndex,
        chunkText: r.chunkText,
        sectionPaths: r.sectionPaths,
        pdfAttachmentKey: r.pdfAttachmentKey,
        pageNumber: r.pageNumber,
        paragraphIndex: r.paragraphIndex,
      }));
    } catch (error) {
      if ((error as any)?.code === 'SERVER_MODEL_NOT_READY') throw error;
      this.logger.error('Semantic search failed:', error);
      return [];
    }
  }

  /**
   * Keyword search using Zotero's built-in search
   *
   * Zotero's quicksearch doesn't rank by relevance, so we add our own scoring:
   * - Title contains query terms → higher score
   * - Year matches query year → bonus
   * - Author matches query pattern → bonus
   */
  private async keywordSearchQuery(
    query: string,
    opts: ResolvedHybridSearchOptions
  ): Promise<KeywordSearchHit[]> {
    try {
      // Search ZotSeek's own stored chunks as well as Zotero metadata. This is
      // the reliable path for exact text inside child notes, because Zotero's
      // quicksearch does not consistently promote a matching note to its parent.
      const indexedTextPromise = this.semanticSearch.searchIndexedText(query, {
        topK: opts.keywordTopK,
        libraryId: opts.libraryId,
        textSources: opts.keywordTextSources,
      }).catch((error: any) => {
        this.logger.debug(`Indexed text search failed: ${error?.message || error}`);
        return [];
      });

      // Use Zotero's quick search
      const search = new Zotero.Search();
      if (opts.libraryId !== undefined) search.libraryID = opts.libraryId;

      // Add collection constraint if specified
      if (opts.collectionId) {
        search.addCondition('collectionID', 'is', opts.collectionId.toString());
      }

      // Quick search searches title, creators, year, tags, etc.
      // This is the same search used in Zotero's search bar
      search.addCondition(
        opts.keywordTextSources ? 'quicksearch-titleCreatorYear' : 'quicksearch-everything',
        'contains',
        query,
      );

      // Attachments are not standalone search results. Notes are deliberately
      // included and mapped to their parent bibliographic item below.
      search.addCondition('itemType', 'isNot', 'attachment');

      // Exclude books if preference is set
      const excludeBooks = Zotero.Prefs.get('zotseek.excludeBooks', true) ?? true;
      if (excludeBooks) {
        search.addCondition('itemType', 'isNot', 'book');
      }

      const itemIds = await search.search().catch((error: any) => {
        this.logger.debug(`Zotero keyword search failed: ${error?.message || error}`);
        return [];
      });

      // Extract query components for scoring
      const queryLower = query.toLowerCase();
      const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 1);
      const queryYearMatch = query.match(/\b(19|20)\d{2}\b/);
      const queryYear = queryYearMatch ? queryYearMatch[0] : null;

      // Score each result based on match quality
      const scoredResults = new Map<number, KeywordSearchHit>();

      const quicksearchItemIds = itemIds.slice(0, opts.keywordTopK * 2); // Get more to allow reranking
      const matchedItems = await getItemsBatch(quicksearchItemIds);
      const noteParentIds: number[] = [];
      for (const itemId of quicksearchItemIds) {
        const matchedItem = matchedItems.get(itemId)?.item;
        try {
          if (matchedItem?.isNote?.()) {
            const parentID = Number(matchedItem.parentID);
            if (Number.isFinite(parentID) && parentID > 0) noteParentIds.push(parentID);
          }
        } catch {
          // The original per-item loop skipped this result if isNote failed.
        }
      }
      const parentItems = await getItemsBatch(noteParentIds);

      for (const itemId of quicksearchItemIds) {
        try {
          const matchedEntry = matchedItems.get(itemId);
          if (!matchedEntry || matchedEntry.failed || !matchedEntry.item) continue;
          const matchedItem = matchedEntry.item;

          const isNoteMatch = !!matchedItem.isNote?.();
          let item = matchedItem;
          let noteText = '';

          if (isNoteMatch) {
            const parentID = Number(matchedItem.parentID);
            if (!Number.isFinite(parentID) || parentID <= 0) continue;

            const parentEntry = parentItems.get(parentID);
            if (!parentEntry || parentEntry.failed) continue;
            item = parentEntry.item;
            if (!item?.isRegularItem?.()) continue;
            noteText = noteHTMLToStructuredText(matchedItem.getNote?.() || '').filteredText;
          }

          if (excludeBooks && item.itemType === 'book') continue;

          let score = 0.5; // Base score

          // Title matching
          const title = (item.getField('title') || '').toLowerCase();
          let titleMatchCount = 0;
          for (const term of queryTerms) {
            if (title.includes(term)) {
              titleMatchCount++;
            }
          }
          // Bonus for title matches (up to 0.3)
          if (queryTerms.length > 0) {
            score += 0.3 * (titleMatchCount / queryTerms.length);
          }

          // Exact title match bonus
          if (queryTerms.length > 0 && queryTerms.every(term => title.includes(term))) {
            score += 0.15; // All query terms in title
          }

          // Child notes are returned by Zotero quicksearch as note items. Map
          // them back to the indexed parent and score against clean note text.
          // This guarantees that an exact phrase in a note is not lost merely
          // because its embedding similarity falls below the semantic cutoff.
          if (isNoteMatch && noteText) {
            const noteLower = noteText.toLowerCase();
            const matchedTerms = queryTerms.filter(term => noteLower.includes(term)).length;
            if (queryLower && noteLower.includes(queryLower)) {
              score = Math.max(score, 1.0);
            } else if (queryTerms.length > 0 && matchedTerms > 0) {
              score = Math.max(score, 0.65 + 0.3 * (matchedTerms / queryTerms.length));
            } else {
              // Zotero quicksearch saw only content filtered from our index
              // (for example Basic Information or References).
              continue;
            }
          }

          // Year matching
          if (queryYear) {
            const itemDate = item.getField('date') || '';
            if (itemDate.includes(queryYear)) {
              score += 0.15; // Year match bonus
            }
          }

          // Author matching (check if query contains author-like patterns)
          // Only check names with 3+ chars to avoid false positives like "Li" in "literature"
          const creators = item.getCreators();
          if (creators && creators.length > 0) {
            for (const creator of creators) {
              const lastName = (creator.lastName || '').toLowerCase();
              if (lastName && lastName.length >= 3 && queryLower.includes(lastName)) {
                score += 0.1; // Author match bonus
                break;
              }
            }
          }

          // Cap score at 1.0 (100%)
          score = Math.min(score, 1.0);

          const hit: KeywordSearchHit = {
            itemId: item.id,
            libraryKey: identityFromItem(item)?.libraryKey,
            itemKey: item.key,
            score,
            textSource: isNoteMatch ? 'note' : undefined,
            chunkText: isNoteMatch ? boundedTextSnippet(noteText, query) : undefined,
          };
          const previous = scoredResults.get(hit.itemId);
          // Indexed text is already a bounded production chunk and may carry
          // section paths, so it wins ties over the quicksearch fallback.
          if (!previous || hit.score >= previous.score) {
            scoredResults.set(hit.itemId, hit);
          }
        } catch (e) {
          this.logger.debug(`Could not score keyword result ${itemId}: ${e}`);
        }
      }

      // Merge exact matches from the ZotSeek index. These hits already point
      // at the parent bibliographic item and carry the matched note passage.
      const indexedMatches = await indexedTextPromise;
      const indexedItems = await getItemsBatch(
        indexedMatches
          .map(match => match.itemId)
          .filter((itemId): itemId is number => itemId !== undefined),
      );
      for (const match of indexedMatches) {
        if (match.itemId === undefined) continue;
        try {
          const entry = indexedItems.get(match.itemId);
          if (!entry || entry.failed) continue;
          const item = entry.item;
          if (!item?.isRegularItem?.()) continue;
          if (excludeBooks && item.itemType === 'book') continue;

          if (opts.collectionId) {
            const collection = Zotero.Collections.get(opts.collectionId);
            if (collection?.hasItem && !collection.hasItem(match.itemId)) continue;
          }

          const hit: KeywordSearchHit = {
            itemId: match.itemId,
            libraryKey: match.libraryKey,
            itemKey: match.itemKey,
            score: match.score,
            textSource: match.textSource,
            chunkText: match.chunkText,
            sectionPaths: match.sectionPaths,
            pdfAttachmentKey: match.pdfAttachmentKey,
          };
          const previous = scoredResults.get(hit.itemId);
          if (!previous || hit.score > previous.score) {
            scoredResults.set(hit.itemId, hit);
          }
        } catch (error) {
          this.logger.debug(`Could not merge indexed text result ${match.itemId}: ${error}`);
        }
      }

      // Sort by score descending
      const sortedResults = Array.from(scoredResults.values())
        .sort((a, b) => b.score - a.score ||
          stableRankingKey(a).localeCompare(stableRankingKey(b)));

      // Return top K with normalized scores
      return sortedResults.slice(0, opts.keywordTopK);
    } catch (error) {
      this.logger.error('Keyword search failed:', error);
      return [];
    }
  }

  /**
   * Reciprocal Rank Fusion
   *
   * Combines results from multiple ranked lists using the formula:
   * RRF(d) = Σ weight_i / (k + rank_i(d))
   *
   * Properties:
   * - Doesn't need score normalization (works on ranks only)
   * - Higher k = more emphasis on top ranks relative to lower ranks
   * - Typical k = 60 (from original RRF paper by Cormack et al.)
   *
   * @param semanticResults - Results from semantic search, ordered by similarity
   * @param keywordResults - Results from keyword search, ordered by relevance
   * @param opts - Options including rrfK and semanticWeight
   */
  private reciprocalRankFusion(
    semanticResults: SemanticSearchHit[],
    keywordResults: KeywordSearchHit[],
    opts: ResolvedHybridSearchOptions
  ): HybridSearchResult[] {
    const k = opts.rrfK;
    const semanticWeight = opts.semanticWeight;
    const keywordWeight = 1 - semanticWeight;

    // When returnAllChunks is true, use itemId-chunkIndex as key to preserve all chunks
    // Otherwise, use just itemId (MaxSim-style aggregation)
    const useChunkKey = opts.returnAllChunks;

    // Build maps for quick lookup
    // Key is either stable paper identity or stable identity + chunk index.
    const semanticMap = new Map<string, SemanticSearchHit & { rank: number }>();
    semanticResults.forEach((r, index) => {
      const baseKey = stableRankingKey(r);
      const key = useChunkKey ? `${baseKey}|chunk:${r.chunkIndex ?? 0}` : baseKey;
      // In all-chunks mode, keep all entries; in MaxSim mode, keep only first (best) per item
      if (!semanticMap.has(key)) {
        semanticMap.set(key, { ...r, rank: index + 1 });
      }
    });

    const keywordMap = new Map<string, KeywordSearchHit & { rank: number }>();
    keywordResults.forEach((r, index) => {
      const key = stableRankingKey(r);
      if (!keywordMap.has(key)) {
        keywordMap.set(key, { ...r, rank: index + 1 });
      }
    });

    // Get all unique keys from both result sets
    const allKeys = new Set<string>([
      ...semanticMap.keys(),
      ...keywordMap.keys(),
    ]);

    // Calculate RRF score for each unique entry
    const fusedResults: HybridSearchResult[] = [];

    for (const key of allKeys) {
      const semantic = semanticMap.get(key);
      // Keyword results are paper-level, even when semantic results are passages.
      const baseKey = useChunkKey ? key.replace(/\|chunk:\d+$/, '') : key;
      const keyword = keywordMap.get(baseKey);
      const representative = semantic ?? keyword;
      if (!representative) continue;
      const itemId = representative.itemId;

      // RRF formula with weights:
      // RRF(d) = semanticWeight / (k + semantic_rank) + keywordWeight / (k + keyword_rank)
      let rrfScore = 0;
      if (semantic) {
        rrfScore += semanticWeight * (1 / (k + semantic.rank));
      }
      if (keyword) {
        rrfScore += keywordWeight * (1 / (k + keyword.rank));
      }

      // Determine source
      let source: 'both' | 'semantic' | 'keyword';
      if (semantic && keyword) {
        source = 'both';
      } else if (semantic) {
        source = 'semantic';
      } else {
        source = 'keyword';
      }

      fusedResults.push({
        itemId,
        libraryKey: representative.libraryKey,
        itemKey: representative.itemKey || '',
        title: '',
        creators: '',
        year: 0,
        semanticScore: semantic?.score ?? null,
        keywordScore: keyword?.score ?? null,
        rrfScore,
        semanticRank: semantic?.rank ?? null,
        keywordRank: keyword?.rank ?? null,
        source,
        textSource: semantic?.textSource ?? keyword?.textSource,
        chunkIndex: semantic?.chunkIndex,
        chunkText: semantic?.chunkText ?? keyword?.chunkText,
        sectionPaths: semantic?.sectionPaths ?? keyword?.sectionPaths,
        pdfAttachmentKey: semantic?.pdfAttachmentKey ?? keyword?.pdfAttachmentKey,
        pageNumber: semantic?.pageNumber,
        paragraphIndex: semantic?.paragraphIndex,
      });
    }

    // Sort by RRF score descending (highest score first)
    fusedResults.sort((a, b) => b.rrfScore - a.rrfScore ||
      stableRankingKey(a).localeCompare(stableRankingKey(b)) ||
      (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));

    return fusedResults;
  }

  /**
   * Populate item metadata (title, creators, year) for results
   */
  private async populateItemMetadata(results: HybridSearchResult[]): Promise<void> {
    const itemsById = await getItemsBatch(results.map(result => result.itemId));
    for (const result of results) {
      try {
        const entry = itemsById.get(result.itemId);
        if (entry?.failed) throw new Error(`Failed to resolve item ${result.itemId}`);
        const item = entry?.item;
        if (item) {
          result.itemKey = item.key;
          result.libraryKey = identityFromItem(item)?.libraryKey ?? result.libraryKey;
          result.title = item.getField('title') || 'Untitled';

          // Get year from date field
          const dateStr = item.getField('date');
          if (dateStr) {
            const yearMatch = dateStr.match(/\d{4}/);
            if (yearMatch) {
              result.year = parseInt(yearMatch[0]);
            }
          }

          // Format creators
          const creators = item.getCreators();
          if (creators && creators.length > 0) {
            const firstAuthor = creators[0].lastName || creators[0].name || '';
            if (creators.length === 1) {
              result.creators = firstAuthor;
            } else if (creators.length === 2) {
              const secondAuthor = creators[1].lastName || creators[1].name || '';
              result.creators = `${firstAuthor} & ${secondAuthor}`;
            } else {
              result.creators = `${firstAuthor} et al.`;
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to get metadata for item ${result.itemId}:`, error);
      }
    }
  }

  /**
   * Analyze query to determine optimal search strategy
   *
   * Returns recommended weights based on query characteristics:
   * - Author patterns → boost keyword
   * - Year patterns → boost keyword
   * - Acronyms → boost keyword
   * - Exact phrases (quotes) → boost keyword
   * - Questions → boost semantic
   * - Long conceptual queries → boost semantic
   */
  analyzeQuery(query: string): QueryAnalysis {
    const tokens = query.toLowerCase().split(/\s+/);
    const detectedPatterns: string[] = [];

    // Patterns that suggest keyword search is important
    const hasYear = /\b(19|20)\d{2}\b/.test(query);
    const hasAuthorPattern = /\b[A-Z][a-z]+\s+(et\s+al\.?|&|\band\b)/i.test(query);
    const hasAcronym = /\b[A-Z]{2,}\b/.test(query);
    const hasQuotes = query.includes('"') || query.includes("'");
    const hasSpecialChars = /[<>=]/.test(query);
    const hasShortTerms = tokens.some(t => t.length <= 3 && t.length > 0);

    // Patterns that suggest semantic search is important
    const isQuestion = /^(what|how|why|when|where|which|who)\b/i.test(query);
    const isConceptual = tokens.length >= 4 && !hasYear && !hasAuthorPattern;
    const hasConceptualPhrases = /\b(related to|similar to|about|regarding|concerning)\b/i.test(query);

    let keywordBoost = 0;

    if (hasYear) {
      keywordBoost += 0.15;
      detectedPatterns.push('year');
    }
    if (hasAuthorPattern) {
      keywordBoost += 0.2;
      detectedPatterns.push('author pattern');
    }
    if (hasAcronym) {
      keywordBoost += 0.1;
      detectedPatterns.push('acronym');
    }
    if (hasQuotes) {
      keywordBoost += 0.15;
      detectedPatterns.push('exact phrase');
    }
    if (hasSpecialChars) {
      keywordBoost += 0.1;
      detectedPatterns.push('special characters');
    }
    if (hasShortTerms && tokens.length <= 2) {
      keywordBoost += 0.1;
      detectedPatterns.push('short terms');
    }

    let semanticBoost = 0;
    if (isQuestion) {
      semanticBoost += 0.15;
      detectedPatterns.push('question');
    }
    if (isConceptual) {
      semanticBoost += 0.1;
      detectedPatterns.push('conceptual');
    }
    if (hasConceptualPhrases) {
      semanticBoost += 0.1;
      detectedPatterns.push('conceptual phrases');
    }

    // Base weight is 0.5 (equal), adjust based on detected patterns
    // Clamp to [0.2, 0.8] to always give both methods some weight
    const semanticWeight = Math.max(0.2, Math.min(0.8, 0.5 + semanticBoost - keywordBoost));

    let reasoning: string;
    if (detectedPatterns.length > 0) {
      reasoning = detectedPatterns.join(', ');
    } else {
      reasoning = 'balanced query';
    }

    return {
      semanticWeight,
      reasoning,
      detectedPatterns,
    };
  }

  /**
   * Smart search that auto-adjusts weights based on query analysis
   */
  async smartSearch(query: string, options: HybridSearchOptions = {}): Promise<HybridSearchResult[]> {
    const analysis = this.analyzeQuery(query);
    this.logger.info(`Query analysis: weight=${analysis.semanticWeight.toFixed(2)}, ${analysis.reasoning}`);
    return this.search(query, {
      ...options,
      semanticWeight: analysis.semanticWeight,
    });
  }

  /**
   * Get source indicator emoji for display
   */
  static getSourceIndicator(result: HybridSearchResult): string {
    switch (result.source) {
      case 'both':
        return '🔗';  // Found in both searches (high confidence)
      case 'semantic':
        return '🧠';  // Found by semantic search only
      case 'keyword':
        return '🔤';  // Found by keyword search only
      default:
        return '';
    }
  }

  /**
   * Get source description for tooltips
   */
  static getSourceDescription(result: HybridSearchResult): string {
    switch (result.source) {
      case 'both':
        return `Found by both semantic (rank #${result.semanticRank}) and keyword (rank #${result.keywordRank}) search`;
      case 'semantic':
        return `Found by semantic search (rank #${result.semanticRank}, similarity ${((result.semanticScore || 0) * 100).toFixed(0)}%)`;
      case 'keyword':
        return `Found by keyword search (rank #${result.keywordRank})`;
      default:
        return '';
    }
  }
}

// Export types for use in UI
export type SearchMode = 'hybrid' | 'semantic' | 'keyword';


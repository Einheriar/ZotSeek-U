/**
 * Chunker - Semantic section-based chunking for nomic-embed-text-v1.5
 * 
 * Philosophy: With 8K context, chunk by SEMANTIC PURPOSE, not token limits.
 * This improves retrieval quality by creating focused embeddings.
 * 
 * Three indexing modes:
 * - abstract: Title + Abstract only (fast, good for most uses)
 * - notes: Title + Abstract + Tags + Child Notes (no PDF processing)
 * - full: Title + Abstract + Tags + Child Notes + PDF sections
 */

export type ChunkType = 'summary' | 'methods' | 'findings' | 'content' | 'note';

export interface Chunk {
  index: number;
  text: string;
  type: ChunkType;
  tokenCount?: number;

  // Passage-level location (Phase 2: evidence linking)
  pageNumber?: number;        // 1-based estimated page number
  paragraphIndex?: number;    // 0-based paragraph index within the chunk's source
  startChar?: number;         // Character offset in source fulltext
  endChar?: number;           // End character offset in source fulltext
}

/**
 * Extended chunk with location data for passage-level linking
 */
export interface ChunkWithLocation extends Chunk {
  pageNumber: number;         // 1-based page number (required)
  paragraphIndex: number;     // 0-based paragraph index (required)
  startChar: number;          // Start character offset (required)
  endChar: number;            // End character offset (required)
}

export type TokenCounter = (text: string) => number;

export interface ChunkOptions {
  maxTokens?: number;      // Safety limit (default: 7000)
  maxChunks?: number;      // Max chunks per paper (default: 5)
  maxChars?: number;       // Hard character limit per chunk (must match embedding worker MAX_CHARS)
  totalPages?: number;     // Total pages from Zotero.Fulltext.getPages() for calibrated estimation
  tokenCounter?: TokenCounter; // Exact active-model counter, injected lazily for Notes/Full mode
}

/**
 * Result of chunking a document, with metadata about whether the chunk
 * limit was hit (causing partial indexing of large papers).
 */
export interface ChunkResult {
  chunks: Chunk[];
  wasTruncated: boolean;   // True if maxChunks limit was reached and there was more content
  pagesIndexed: number;    // Number of pages with at least one chunk (0 in abstract mode)
  pagesTotal: number;      // Total pages in the source document (0 if unknown)
}

// User-selectable indexing modes
export type IndexingMode = 'abstract' | 'notes' | 'full';

// Default options for nomic-embed-v1.5 (8192 token limit)
// PERFORMANCE: Smaller chunks embed MUCH faster due to O(n²) attention
// - 7000 tokens: ~45 seconds per chunk (too slow!)
// - 500 tokens: ~0.3-0.5 seconds per chunk (very fast!)
// With paragraph-level chunking, we need many more chunks
const DEFAULT_OPTIONS: Required<Pick<ChunkOptions, 'maxTokens' | 'maxChunks' | 'maxChars'>> = {
  maxTokens: 450,     // Stay below multilingual E5 Base's 512-token limit
  maxChunks: 100,     // Allow up to 100 paragraphs per paper (covers most papers)
  maxChars: 8000,     // Must match embedding worker MAX_CHARS (hard character ceiling)
};

// Patterns to identify section boundaries
const SECTION_PATTERNS = {
  // Methods-like sections (how the research was done)
  methods: /\n(?=(?:\d+\.?\s*)?(?:Introduction|Background|Literature\s*Review|Related\s*Work|Theoretical\s*Framework|Methods?|Methodology|Materials?\s*(?:and\s*Methods)?|Experimental\s*(?:Setup|Design)?|Study\s*Design|Data\s*(?:Collection|Sources)|Approach|Framework|Model|System|Implementation)\b)/i,
  
  // Findings-like sections (what was discovered)
  findings: /\n(?=(?:\d+\.?\s*)?(?:Results?|Findings|Evaluation|Experiments?|Analysis|Discussion|Implications|Conclusion|Conclusions|Summary|Limitations|Future\s*Work|Recommendations)\b)/i,
};

/**
 * Estimate token count for nomic tokenizer
 * Conservative estimate: ~1.3 tokens per word for English academic text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return Math.ceil(words.length * 1.3);
}

/**
 * Split a single oversized chunk into multiple chunks at sentence boundaries,
 * respecting a hard character limit. Preserves metadata (page, paragraph, type).
 */
function splitChunkByCharLimit(chunk: Chunk, maxChars: number): Chunk[] {
  if (chunk.text.length <= maxChars) return [chunk];

  // Extract title prefix (everything before first \n\n) to prepend to each sub-chunk
  const separatorIdx = chunk.text.indexOf('\n\n');
  const titlePrefix = separatorIdx >= 0 ? chunk.text.substring(0, separatorIdx) : '';
  const body = separatorIdx >= 0 ? chunk.text.substring(separatorIdx + 2) : chunk.text;
  const prefixLen = titlePrefix.length + 2; // +2 for \n\n
  const availableChars = maxChars - prefixLen;

  if (availableChars <= 0) {
    // Title alone exceeds limit; just truncate the whole chunk
    return [{ ...chunk, text: chunk.text.substring(0, maxChars) }];
  }

  const sentences = body.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [body];
  const result: Chunk[] = [];
  let currentText = '';

  for (const sentence of sentences) {
    // Preserve an oversized sentence by slicing it into multiple pieces rather
    // than truncating its tail. This matters for long CJK note paragraphs.
    const pieces: string[] = [];
    for (let offset = 0; offset < sentence.length; offset += availableChars) {
      pieces.push(sentence.substring(offset, offset + availableChars));
    }

    for (const piece of pieces) {
      if (currentText.length + piece.length > availableChars && currentText.trim()) {
        result.push({
          ...chunk,
          index: 0, // Re-indexed by caller
          text: titlePrefix ? `${titlePrefix}\n\n${currentText.trim()}` : currentText.trim(),
          tokenCount: estimateTokens(currentText),
        });
        currentText = piece;
      } else {
        currentText += piece;
      }
    }
  }

  // Flush remaining
  if (currentText.trim()) {
    result.push({
      ...chunk,
      index: 0,
      text: titlePrefix ? `${titlePrefix}\n\n${currentText.trim()}` : currentText.trim(),
      tokenCount: estimateTokens(currentText),
    });
  }

  return result;
}

/**
 * Post-process chunks to enforce a hard character limit.
 * Splits any chunk exceeding maxChars at sentence boundaries.
 * This catches chunks that slip through the token-based limits due to
 * the variable token-to-character ratio in academic text.
 */
/**
 * Post-process chunks to enforce a hard character limit and report whether
 * the maxChunks ceiling was hit while there was still content to add.
 */
function enforceCharLimitEx(
  chunks: Chunk[],
  maxChars: number,
  maxChunks: number,
): { chunks: Chunk[]; truncatedByCharLimit: boolean } {
  const result: Chunk[] = [];
  let truncatedByCharLimit = false;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (result.length >= maxChunks) {
      truncatedByCharLimit = true;
      break;
    }

    if (chunk.text.length <= maxChars) {
      result.push(chunk);
    } else {
      const subChunks = splitChunkByCharLimit(chunk, maxChars);
      for (let j = 0; j < subChunks.length; j++) {
        if (result.length >= maxChunks) {
          // We dropped at least one sub-chunk of this oversized chunk
          truncatedByCharLimit = true;
          break;
        }
        result.push(subChunks[j]);
      }
    }
  }

  // Re-index
  for (let i = 0; i < result.length; i++) {
    result[i].index = i;
  }

  return { chunks: result, truncatedByCharLimit };
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE ESTIMATION UTILITIES (Phase 2: passage-level location)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default characters per page for academic papers (fallback)
 * Based on: ~3000 chars for a typical double-column PDF page
 */
const DEFAULT_CHARS_PER_PAGE = 3000;

/**
 * Page estimation context - allows calibrated estimation per document
 * When totalPages is known (from Zotero.Fulltext.getPages), we can calculate
 * the actual chars/page for this specific document.
 */
export interface PageEstimationContext {
  totalChars: number;      // Total characters in fulltext
  totalPages?: number;     // Total pages from Zotero (if available)
  charsPerPage: number;    // Calculated or default chars per page
}

/**
 * Create a page estimation context for a document
 * Uses calibrated chars/page when totalPages is available from Zotero
 */
export function createPageEstimationContext(
  totalChars: number,
  totalPages?: number
): PageEstimationContext {
  // If we know the total pages, calculate actual chars per page for this document
  const charsPerPage = (totalPages && totalPages > 0)
    ? Math.floor(totalChars / totalPages)
    : DEFAULT_CHARS_PER_PAGE;

  return {
    totalChars,
    totalPages,
    charsPerPage,
  };
}

/**
 * Estimate page number from character offset in fulltext
 * Returns 1-based page number
 *
 * @param charOffset - Character position in the fulltext
 * @param context - Optional calibration context (uses default if not provided)
 */
export function estimatePageNumber(
  charOffset: number,
  context?: PageEstimationContext
): number {
  if (charOffset <= 0) return 1;

  const charsPerPage = context?.charsPerPage || DEFAULT_CHARS_PER_PAGE;

  // Clamp to totalPages if known
  const estimatedPage = Math.floor(charOffset / charsPerPage) + 1;
  if (context?.totalPages) {
    return Math.min(estimatedPage, context.totalPages);
  }
  return estimatedPage;
}

/**
 * Estimate which page a text range falls on (using midpoint)
 */
export function estimatePageForRange(
  startChar: number,
  endChar: number,
  context?: PageEstimationContext
): number {
  const midpoint = (startChar + endChar) / 2;
  return estimatePageNumber(midpoint, context);
}

/**
 * Count paragraphs in text up to a given position
 * Paragraphs are separated by double newlines
 */
export function countParagraphsUpTo(text: string, charPosition: number): number {
  if (charPosition <= 0) return 0;
  const textUpTo = text.substring(0, charPosition);
  const paragraphs = textUpTo.split(/\n\n+/);
  return paragraphs.length - 1; // 0-indexed
}

/**
 * Location tracking context for chunking
 */
export interface LocationContext {
  sourceText: string;           // The full source text
  currentCharOffset: number;    // Current position in source text
  paragraphCount: number;       // Running paragraph count
}

/**
 * Truncate text to approximately maxTokens, ending at sentence boundary
 */
function truncateToTokens(text: string, maxTokens: number): string {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;
  
  // Estimate character position
  const ratio = maxTokens / currentTokens;
  const targetLength = Math.floor(text.length * ratio * 0.95); // 5% safety margin
  
  // Find sentence boundary
  const truncated = text.substring(0, targetLength);
  const lastSentence = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('.\n'),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('! ')
  );
  
  if (lastSentence > targetLength * 0.5) {
    return truncated.substring(0, lastSentence + 1).trim();
  }
  
  return truncated.trim() + '...';
}

/**
 * Split a large text into multiple chunks at paragraph boundaries
 * Returns array of chunks, each within maxTokens limit
 *
 * @param sourceStartOffset - Character offset where this text starts in full source (for location)
 * @param paragraphStartIndex - Starting paragraph index (for location tracking)
 * @param pageContext - Optional calibration context for accurate page estimation
 */
function splitTextIntoChunks(
  text: string,
  titlePrefix: string,
  maxTokens: number,
  type: Exclude<ChunkType, 'summary'>,
  sourceStartOffset: number = 0,
  paragraphStartIndex: number = 0,
  pageContext?: PageEstimationContext,
  minParagraphChars: number = 50
): Chunk[] {
  const chunks: Chunk[] = [];
  const titleTokens = estimateTokens(titlePrefix) + 10; // Buffer for newlines
  const availableTokens = maxTokens - titleTokens;
  
  // If text fits in one chunk, return it with location data
  const textTokens = estimateTokens(text);
  if (textTokens <= availableTokens) {
    const startChar = sourceStartOffset;
    const endChar = sourceStartOffset + text.length;
    chunks.push({
      index: 0,
      text: `${titlePrefix}\n\n${text}`,
      type,
      tokenCount: textTokens + titleTokens,
      // Location data (Phase 2) - uses calibrated page estimation
      startChar,
      endChar,
      pageNumber: estimatePageForRange(startChar, endChar, pageContext),
      paragraphIndex: paragraphStartIndex,
    });
    return chunks;
  }
  
  // Split into paragraphs with position tracking
  const paragraphSplits = text.split(/\n\n+/);
  const paragraphs: Array<{ text: string; start: number; end: number }> = [];
  let searchPos = 0;
  for (const p of paragraphSplits) {
    if (p.trim().length >= minParagraphChars) {
      const idx = text.indexOf(p, searchPos);
      const start = idx >= 0 ? idx : searchPos;
      paragraphs.push({ text: p, start, end: start + p.length });
      searchPos = start + p.length;
    }
  }

  let currentChunk = '';
  let currentTokens = 0;
  // Location tracking
  let chunkStartChar = sourceStartOffset;
  let chunkEndChar = sourceStartOffset;
  let chunkParagraphIdx = paragraphStartIndex;
  let runningParagraphIdx = paragraphStartIndex;
  
  // Helper to flush current chunk with location data (uses calibrated page estimation)
  const flushCurrentChunk = () => {
    if (currentChunk.trim()) {
      chunks.push({
        index: chunks.length,
        text: `${titlePrefix}\n\n${currentChunk.trim()}`,
        type,
        tokenCount: currentTokens + titleTokens,
        // Location data - uses calibrated page estimation
        startChar: chunkStartChar,
        endChar: chunkEndChar,
        pageNumber: estimatePageForRange(chunkStartChar, chunkEndChar, pageContext),
        paragraphIndex: chunkParagraphIdx,
      });
    }
  };

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para.text);
    const paraStartChar = sourceStartOffset + para.start;
    const paraEndChar = sourceStartOffset + para.end;

    // If single paragraph is too large, split it by sentences
    if (paraTokens > availableTokens) {
      // Flush current chunk first
      flushCurrentChunk();
      currentChunk = '';
      currentTokens = 0;
      chunkStartChar = paraStartChar;
      chunkParagraphIdx = runningParagraphIdx;

      // Split paragraph by sentences
      const sentences = para.text.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [para.text];
      for (const sentence of sentences) {
        const sentTokens = estimateTokens(sentence);
        if (currentTokens + sentTokens > availableTokens && currentChunk.trim()) {
          chunkEndChar = paraStartChar + currentChunk.length;
          flushCurrentChunk();
          currentChunk = sentence;
          currentTokens = sentTokens;
          chunkStartChar = chunkEndChar;
          chunkParagraphIdx = runningParagraphIdx;
        } else {
          currentChunk += sentence;
          currentTokens += sentTokens;
        }
      }
      chunkEndChar = paraEndChar;
    }
    // Check if adding this paragraph would exceed limit
    else if (currentTokens + paraTokens > availableTokens) {
      // Save current chunk and start new one
      flushCurrentChunk();
      currentChunk = para.text + '\n\n';
      currentTokens = paraTokens;
      chunkStartChar = paraStartChar;
      chunkEndChar = paraEndChar;
      chunkParagraphIdx = runningParagraphIdx;
    } else {
      if (currentChunk === '') {
        chunkStartChar = paraStartChar;
        chunkParagraphIdx = runningParagraphIdx;
      }
      currentChunk += para.text + '\n\n';
      currentTokens += paraTokens;
      chunkEndChar = paraEndChar;
    }

    runningParagraphIdx++;
  }

  // Don't forget the last chunk
  flushCurrentChunk();

  return chunks;
}

/**
 * Semantic section with location offset
 */
interface SemanticSection {
  text: string;
  startOffset: number;  // Character offset in source fulltext
}

/**
 * Split fulltext into semantic sections (methods vs findings)
 * Now returns offsets for location tracking
 */
function splitIntoSemanticSections(fulltext: string): {
  methods: SemanticSection | null;
  findings: SemanticSection | null;
} {
  // Try to find the boundary between methods and findings
  const findingsMatch = SECTION_PATTERNS.findings.exec(fulltext);

  if (findingsMatch && findingsMatch.index && findingsMatch.index > 500) {
    const methodsText = fulltext.substring(0, findingsMatch.index).trim();
    const findingsText = fulltext.substring(findingsMatch.index).trim();

    // Find actual start offsets (accounting for trim)
    const methodsStart = fulltext.indexOf(methodsText);
    const findingsStart = findingsMatch.index + (fulltext.substring(findingsMatch.index).indexOf(findingsText.substring(0, 50)));

    return {
      methods: methodsText.length > 300 ? { text: methodsText, startOffset: methodsStart >= 0 ? methodsStart : 0 } : null,
      findings: findingsText.length > 300 ? { text: findingsText, startOffset: findingsStart >= 0 ? findingsStart : findingsMatch.index } : null,
    };
  }

  // No clear boundary found - return null to trigger fallback
  return { methods: null, findings: null };
}

/**
 * Main chunking function - simplified for nomic-embed-v1.5
 * 
 * @param title - Paper title (prepended to each chunk for context)
 * @param abstract - Paper abstract
 * @param fulltext - Full text from PDF
 * @param mode - 'abstract' or 'full'
 * @param options - Chunking options
 */
export function chunkDocument(
  title: string,
  abstract: string | null,
  fulltext: string | null,
  mode: IndexingMode,
  options: ChunkOptions = {}
): Chunk[] {
  return chunkDocumentEx(title, abstract, fulltext, mode, options).chunks;
}

/**
 * Extended version of chunkDocument that also reports whether the chunk
 * limit was hit (so the caller can warn the user about partial indexing).
 */
export function chunkDocumentEx(
  title: string,
  abstract: string | null,
  fulltext: string | null,
  mode: IndexingMode,
  options: ChunkOptions = {}
): ChunkResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: Chunk[] = [];
  let wasTruncated = false;
  
  // Prepare title prefix (truncate if extremely long)
  const titlePrefix = title.length > 300 
    ? title.substring(0, 300) + '...' 
    : title;
  
  // ═══════════════════════════════════════════════════════════════════════
  // CHUNK 1: Summary (always included in both modes)
  // Purpose: "What is this paper about?"
  // Note: Summary chunks don't have fulltext location (they come from metadata)
  // ═══════════════════════════════════════════════════════════════════════
  // Abstract-only indexing keeps the upstream noise guard for placeholder
  // abstracts. Notes/full mode may pass a short but useful metadata body such
  // as a tag, so those modes only require non-empty text.
  const summaryBodyIsUseful = mode === 'abstract'
    ? !!abstract && abstract.trim().length >= 50
    : !!abstract && abstract.trim().length > 0;
  const summaryText = summaryBodyIsUseful
    ? `${titlePrefix}\n\n${abstract}`
    : titlePrefix;

  chunks.push({
    index: 0,
    text: summaryText,
    type: 'summary',
    tokenCount: estimateTokens(summaryText),
    // Summary has no fulltext location (comes from item metadata, not PDF)
    pageNumber: 1,  // Abstracts are typically on page 1
    paragraphIndex: 0,
    startChar: undefined,  // No fulltext offset for metadata-sourced chunks
    endChar: undefined,
  });
  
  // Abstract and Notes modes do not process PDF full text. Notes are appended
  // by TextExtractor so note source boundaries remain explicit.
  if (mode !== 'full') {
    const enforced = enforceCharLimitEx(chunks, opts.maxChars, opts.maxChunks);
    return {
      chunks: enforced.chunks,
      wasTruncated: wasTruncated || enforced.truncatedByCharLimit,
      pagesIndexed: 0,
      pagesTotal: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FULL MODE: Add section-based chunks from PDF
  // ═══════════════════════════════════════════════════════════════════════
  if (!fulltext || fulltext.length < 500) {
    // No meaningful fulltext available
    const enforced = enforceCharLimitEx(chunks, opts.maxChars, opts.maxChunks);
    return {
      chunks: enforced.chunks,
      wasTruncated: wasTruncated || enforced.truncatedByCharLimit,
      pagesIndexed: 0,
      pagesTotal: opts.totalPages || 0,
    };
  }

  // Create page estimation context for calibrated page numbers
  // If totalPages is provided (from Zotero.Fulltext.getPages), we use it to
  // calculate actual chars/page for this specific document
  const pageContext = createPageEstimationContext(fulltext.length, opts.totalPages);

  // Try to split into semantic sections
  const sections = splitIntoSemanticSections(fulltext);

  // Track running paragraph index across sections
  let runningParagraphIdx = 0;

  if (sections.methods || sections.findings) {
    // ─────────────────────────────────────────────────────────────────────
    // CHUNK 2+: Methods section(s)
    // Purpose: "How did they do it?"
    // Split into multiple chunks if too large for fast embedding
    // ─────────────────────────────────────────────────────────────────────
    if (sections.methods) {
      const methodChunks = splitTextIntoChunks(
        sections.methods.text,
        titlePrefix,
        opts.maxTokens,
        'methods',
        sections.methods.startOffset,
        runningParagraphIdx,
        pageContext  // Pass calibrated page estimation context
      );
      for (let i = 0; i < methodChunks.length; i++) {
        if (chunks.length >= opts.maxChunks) {
          // There were still method chunks to add when we hit the limit
          if (i < methodChunks.length) wasTruncated = true;
          break;
        }
        chunks.push({
          ...methodChunks[i],
          index: chunks.length,
        });
      }
      // Update running paragraph index
      runningParagraphIdx += sections.methods.text.split(/\n\n+/).length;
    }

    // ─────────────────────────────────────────────────────────────────────
    // CHUNK N+: Findings section(s)
    // Purpose: "What did they find?"
    // ─────────────────────────────────────────────────────────────────────
    if (sections.findings) {
      const findingsChunks = splitTextIntoChunks(
        sections.findings.text,
        titlePrefix,
        opts.maxTokens,
        'findings',
        sections.findings.startOffset,
        runningParagraphIdx,
        pageContext  // Pass calibrated page estimation context
      );
      for (let i = 0; i < findingsChunks.length; i++) {
        if (chunks.length >= opts.maxChunks) {
          if (i < findingsChunks.length) wasTruncated = true;
          break;
        }
        chunks.push({
          ...findingsChunks[i],
          index: chunks.length,
        });
      }
    }
  } else {
    // ─────────────────────────────────────────────────────────────────────
    // FALLBACK: No clear sections found, split content into chunks
    // ─────────────────────────────────────────────────────────────────────
    const contentChunks = splitTextIntoChunks(
      fulltext,
      titlePrefix,
      opts.maxTokens,
      'content',
      0,  // Start at beginning of fulltext
      0,  // Start paragraph index at 0
      pageContext  // Pass calibrated page estimation context
    );
    for (let i = 0; i < contentChunks.length; i++) {
      if (chunks.length >= opts.maxChunks) {
        if (i < contentChunks.length) wasTruncated = true;
        break;
      }
      chunks.push({
        ...contentChunks[i],
        index: chunks.length,
      });
    }
  }

  // Enforce character limit as safety net (token estimates can undercount for dense text)
  const enforced = enforceCharLimitEx(chunks, opts.maxChars, opts.maxChunks);

  // pagesIndexed: count distinct pages reflected in surviving chunks
  const distinctPages = new Set<number>();
  for (const c of enforced.chunks) {
    if (c.pageNumber != null) distinctPages.add(c.pageNumber);
  }

  return {
    chunks: enforced.chunks,
    wasTruncated: wasTruncated || enforced.truncatedByCharLimit,
    pagesIndexed: distinctPages.size,
    pagesTotal: opts.totalPages || 0,
  };
}

interface ExactTextPart {
  text: string;
  tokenCount: number;
}

/**
 * Split one unpunctuated unit by original Unicode character offsets. The
 * tokenizer is the authority, while binary search keeps calls logarithmic.
 */
function splitExactUnitByCharacters(
  unit: string,
  countBody: (body: string) => number,
  maxTokens: number
): ExactTextPart[] {
  const characters = Array.from(unit);
  const parts: ExactTextPart[] = [];
  let offset = 0;

  while (offset < characters.length) {
    let low = 1;
    let high = characters.length - offset;
    let best = 0;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = characters.slice(offset, offset + middle).join('');
      if (countBody(candidate) <= maxTokens) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    // A 200-character title should always leave room for at least one body
    // character. Keep forward progress if a malformed tokenizer says it does
    // not; the embedding worker's own limit remains the final safety net.
    if (best === 0) best = 1;

    // Prefer a nearby natural boundary without reconstructing text through
    // tokenizer.decode(), which can alter Chinese spacing and punctuation.
    const raw = characters.slice(offset, offset + best).join('');
    const boundary = Math.max(
      raw.lastIndexOf('\n'),
      raw.lastIndexOf(' '),
      raw.lastIndexOf('，'),
      raw.lastIndexOf(','),
      raw.lastIndexOf('；'),
      raw.lastIndexOf(';'),
      raw.lastIndexOf('、')
    );
    const cut = boundary >= Math.floor(raw.length * 0.75)
      ? Array.from(raw.slice(0, boundary + 1)).length
      : best;
    const text = characters.slice(offset, offset + Math.max(1, cut)).join('');
    parts.push({ text, tokenCount: countBody(text) });
    offset += Math.max(1, cut);
  }

  return parts;
}

/** Split an oversized body at sentence boundaries, then characters if needed. */
function splitExactBodyBySentences(
  body: string,
  countBody: (body: string) => number,
  maxTokens: number
): ExactTextPart[] {
  const sentences = body.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/gu) || [body];
  const parts: ExactTextPart[] = [];
  let current = '';

  const flush = () => {
    const text = current.trim();
    if (text) parts.push({ text, tokenCount: countBody(text) });
    current = '';
  };

  for (const sentence of sentences) {
    const candidate = current ? `${current}${sentence}` : sentence;
    if (countBody(candidate) <= maxTokens) {
      current = candidate;
      continue;
    }

    flush();
    if (countBody(sentence) <= maxTokens) {
      current = sentence;
    } else {
      parts.push(...splitExactUnitByCharacters(sentence, countBody, maxTokens));
    }
  }

  flush();
  return parts;
}

/**
 * Exact multilingual-E5 note splitting.
 *
 * Paragraph costs are cached by TokenizerService. We use their additive cost
 * for the common greedy path, then verify each emitted chunk with the real
 * tokenizer. Only an oversized final candidate takes the sentence/binary path.
 */
function splitNoteTextWithExactCounter(
  noteText: string,
  titlePrefix: string,
  maxTokens: number,
  tokenCounter: TokenCounter
): Chunk[] {
  const countBody = (body: string) => tokenCounter(`${titlePrefix}\n\n${body}`);
  const paragraphs = noteText
    .split(/\n\s*\n+/u)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return [];

  const chunks: ExactTextPart[] = [];
  const prefixTokens = countBody('');
  // Leave a small boundary margin because SentencePiece token counts are not
  // perfectly additive across paragraph joins. Final verification is exact.
  const approximateBodyBudget = Math.max(1, maxTokens - prefixTokens - 8);
  let currentParagraphs: string[] = [];
  let approximateTokens = 0;

  const appendVerified = (body: string) => {
    const text = body.trim();
    if (!text) return;
    const tokenCount = countBody(text);
    if (tokenCount <= maxTokens) {
      chunks.push({ text, tokenCount });
    } else {
      chunks.push(...splitExactBodyBySentences(text, countBody, maxTokens));
    }
  };

  const flush = () => {
    if (currentParagraphs.length > 0) {
      appendVerified(currentParagraphs.join('\n\n'));
    }
    currentParagraphs = [];
    approximateTokens = 0;
  };

  for (const paragraph of paragraphs) {
    const paragraphTokens = countBody(paragraph);
    const paragraphCost = Math.max(1, paragraphTokens - prefixTokens);

    if (paragraphTokens > maxTokens) {
      flush();
      chunks.push(...splitExactBodyBySentences(paragraph, countBody, maxTokens));
      continue;
    }

    if (
      currentParagraphs.length > 0 &&
      approximateTokens + paragraphCost > approximateBodyBudget
    ) {
      flush();
    }

    currentParagraphs.push(paragraph);
    approximateTokens += paragraphCost;
  }

  flush();

  return chunks.map((part, index) => ({
    index,
    text: `${titlePrefix}\n\n${part.text}`,
    type: 'note',
    tokenCount: part.tokenCount,
    pageNumber: undefined,
    paragraphIndex: undefined,
    startChar: undefined,
    endChar: undefined,
  }));
}

/**
 * Split normalized child-note texts into chunks that belong to their parent
 * bibliographic item. Note chunks intentionally carry no PDF location data.
 */
export function chunkNoteTexts(
  title: string,
  noteTexts: string[],
  options: ChunkOptions = {},
  startIndex: number = 0
): { chunks: Chunk[]; wasTruncated: boolean } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const availableSlots = Math.max(0, opts.maxChunks - startIndex);
  const titlePrefix = title.length > 200 ? `${title.substring(0, 200)}...` : title;
  const rawChunks: Chunk[] = [];
  let wasTruncated = false;

  for (let noteIndex = 0; noteIndex < noteTexts.length; noteIndex++) {
    const noteText = noteTexts[noteIndex]?.trim();
    if (!noteText) continue;

    if (rawChunks.length >= availableSlots) {
      wasTruncated = true;
      break;
    }

    const noteChunks = opts.tokenCounter
      ? splitNoteTextWithExactCounter(
          noteText,
          titlePrefix,
          opts.maxTokens,
          opts.tokenCounter
        )
      : splitTextIntoChunks(
          noteText,
          titlePrefix,
          opts.maxTokens,
          'note',
          0,
          0,
          undefined,
          1
        );

    for (let chunkIndex = 0; chunkIndex < noteChunks.length; chunkIndex++) {
      if (rawChunks.length >= availableSlots) {
        wasTruncated = true;
        break;
      }
      const chunk = noteChunks[chunkIndex];
      rawChunks.push({
        ...chunk,
        index: rawChunks.length,
        pageNumber: undefined,
        paragraphIndex: undefined,
        startChar: undefined,
        endChar: undefined,
      });
    }

    if (wasTruncated) break;
  }

  const enforced = enforceCharLimitEx(rawChunks, opts.maxChars, availableSlots);
  enforced.chunks.forEach((chunk, index) => {
    chunk.index = startIndex + index;
    if (opts.tokenCounter) {
      chunk.tokenCount = opts.tokenCounter(chunk.text);
    }
    chunk.pageNumber = undefined;
    chunk.paragraphIndex = undefined;
    chunk.startChar = undefined;
    chunk.endChar = undefined;
  });

  return {
    chunks: enforced.chunks,
    wasTruncated: wasTruncated || enforced.truncatedByCharLimit,
  };
}

export interface FullModeChunkSources {
  summaryChunks: Chunk[];
  noteChunks: Chunk[];
  pdfChunks: Chunk[];
  notesWereTruncated?: boolean;
  pdfWasTruncated?: boolean;
  pagesTotal?: number;
}

/**
 * Combine metadata, note, and PDF chunks under one per-item chunk limit.
 * Metadata is kept first. Remaining capacity is shared between notes and PDF
 * so that a long source cannot completely crowd out the other source.
 */
export function combineFullModeChunks(
  sources: FullModeChunkSources,
  options: ChunkOptions = {}
): ChunkResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxChunks = Math.max(1, opts.maxChunks);
  const summaryChunks = sources.summaryChunks.slice(0, maxChunks);
  const remainingSlots = Math.max(0, maxChunks - summaryChunks.length);

  let noteCount = 0;
  let pdfCount = 0;

  if (sources.noteChunks.length > 0 && sources.pdfChunks.length > 0) {
    const noteQuota = Math.ceil(remainingSlots / 2);
    const pdfQuota = remainingSlots - noteQuota;
    noteCount = Math.min(noteQuota, sources.noteChunks.length);
    pdfCount = Math.min(pdfQuota, sources.pdfChunks.length);

    let unusedSlots = remainingSlots - noteCount - pdfCount;
    if (unusedSlots > 0) {
      const extraNotes = Math.min(
        unusedSlots,
        sources.noteChunks.length - noteCount
      );
      noteCount += extraNotes;
      unusedSlots -= extraNotes;
    }
    if (unusedSlots > 0) {
      pdfCount += Math.min(
        unusedSlots,
        sources.pdfChunks.length - pdfCount
      );
    }
  } else if (sources.noteChunks.length > 0) {
    noteCount = Math.min(remainingSlots, sources.noteChunks.length);
  } else if (sources.pdfChunks.length > 0) {
    pdfCount = Math.min(remainingSlots, sources.pdfChunks.length);
  }

  const selected: Chunk[] = [
    ...summaryChunks.map(chunk => ({
      ...chunk,
      pageNumber: undefined,
      paragraphIndex: undefined,
      startChar: undefined,
      endChar: undefined,
    })),
    ...sources.noteChunks.slice(0, noteCount).map(chunk => ({
      ...chunk,
      pageNumber: undefined,
      paragraphIndex: undefined,
      startChar: undefined,
      endChar: undefined,
    })),
    ...sources.pdfChunks.slice(0, pdfCount).map(chunk => ({ ...chunk })),
  ];

  selected.forEach((chunk, index) => {
    chunk.index = index;
  });

  const indexedPages = new Set<number>();
  for (const chunk of selected) {
    if (chunk.type !== 'summary' && chunk.type !== 'note' && chunk.pageNumber != null) {
      indexedPages.add(chunk.pageNumber);
    }
  }

  return {
    chunks: selected,
    wasTruncated:
      summaryChunks.length < sources.summaryChunks.length ||
      noteCount < sources.noteChunks.length ||
      pdfCount < sources.pdfChunks.length ||
      !!sources.notesWereTruncated ||
      !!sources.pdfWasTruncated,
    pagesIndexed: indexedPages.size,
    pagesTotal: sources.pagesTotal || 0,
  };
}

/**
 * Get chunk options from Zotero preferences
 */
export function getChunkOptionsFromPrefs(Zotero: any): ChunkOptions {
  const maxTokens = Zotero?.Prefs?.get('zotseek.maxTokens', true);
  const maxChunks = Zotero?.Prefs?.get('zotseek.maxChunksPerPaper', true);

  return {
    maxTokens: typeof maxTokens === 'number' ? maxTokens : DEFAULT_OPTIONS.maxTokens,
    maxChunks: typeof maxChunks === 'number' ? maxChunks : DEFAULT_OPTIONS.maxChunks,
    maxChars: DEFAULT_OPTIONS.maxChars,
  };
}

/**
 * Get indexing mode from Zotero preferences
 */
export function getIndexingMode(Zotero: any): IndexingMode {
  const mode = Zotero?.Prefs?.get('zotseek.indexingMode', true);
  if (mode === 'full' || mode === 'notes') return mode;
  return 'abstract';
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE-BY-PAGE CHUNKING (accurate page numbers from PDFWorker)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Input structure for page-by-page text
 */
export interface PageText {
  pageNumber: number;  // 1-based page number
  text: string;        // Text content of this page
}

/**
 * Extract paragraphs from PDF page text
 *
 * Zotero's PDFWorker uses these markers:
 * - \f (form feed, ASCII 12) = page break
 * - \n = paragraph break (detected by pdf-worker's paragraph detection)
 *
 * This function respects these markers for accurate paragraph extraction.
 */
function extractParagraphsFromPage(pageText: string): string[] {
  // Normalize: remove form feeds (page breaks within a page shouldn't exist)
  // and normalize line endings
  const normalized = pageText
    .replace(/\f/g, '\n\n')  // Form feeds become paragraph breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Strategy 1: Try splitting on double newlines (clear paragraph markers)
  let paragraphs = normalized
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // If we got reasonable paragraphs (2+ with decent length), use them
  if (paragraphs.length >= 2 && paragraphs.some(p => p.length > 100)) {
    return paragraphs;
  }

  // Strategy 2: Split on single newlines that look like paragraph breaks
  // Use a simple approach without lookbehind (not supported in all JS engines)
  // Split on newlines, then merge lines that don't end with sentence punctuation
  const lines = normalized.split(/\n/).filter(l => l.trim().length > 0);
  paragraphs = [];
  let currentPara = '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (currentPara === '') {
      currentPara = trimmedLine;
    } else {
      // Check if previous line ended with sentence punctuation
      const endsWithPunctuation = /[.!?:"]$/.test(currentPara);
      // Check if this line starts with capital letter or number (new paragraph indicator)
      const startsWithCapital = /^[A-Z0-9]/.test(trimmedLine);

      if (endsWithPunctuation && startsWithCapital && currentPara.length > 80) {
        // Looks like a paragraph break
        paragraphs.push(currentPara);
        currentPara = trimmedLine;
      } else {
        // Continue the same paragraph
        currentPara += ' ' + trimmedLine;
      }
    }
  }
  if (currentPara.trim().length > 0) {
    paragraphs.push(currentPara.trim());
  }

  if (paragraphs.length >= 2) {
    return paragraphs;
  }

  // Strategy 3: Fixed-size sliding window chunking
  // When text has no clear structure, chunk by ~400 characters at sentence boundaries
  const CHUNK_TARGET = 400;
  const chunks: string[] = [];
  let remaining = normalized.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  while (remaining.length > 0) {
    if (remaining.length <= CHUNK_TARGET * 1.3) {
      chunks.push(remaining);
      break;
    }

    // Find a sentence boundary near the target
    const searchEnd = Math.min(remaining.length, CHUNK_TARGET * 1.5);
    const searchText = remaining.substring(0, searchEnd);

    // Look for sentence end closest to target
    let bestSplit = -1;
    let match;
    const sentenceEndRegex = /[.!?]\s+/g;
    while ((match = sentenceEndRegex.exec(searchText)) !== null) {
      const pos = match.index + match[0].length;
      if (pos >= CHUNK_TARGET * 0.7) {
        bestSplit = pos;
        break;
      }
      bestSplit = pos;
    }

    if (bestSplit > 0) {
      chunks.push(remaining.substring(0, bestSplit).trim());
      remaining = remaining.substring(bestSplit).trim();
    } else {
      const spacePos = remaining.lastIndexOf(' ', CHUNK_TARGET);
      if (spacePos > CHUNK_TARGET * 0.5) {
        chunks.push(remaining.substring(0, spacePos).trim());
        remaining = remaining.substring(spacePos).trim();
      } else {
        chunks.push(remaining.substring(0, CHUNK_TARGET).trim());
        remaining = remaining.substring(CHUNK_TARGET).trim();
      }
    }
  }

  return chunks;
}

/**
 * Chunk document using paragraph-level granularity with exact page numbers
 * Each paragraph becomes its own chunk for maximum precision
 *
 * @param title - Paper title
 * @param abstract - Paper abstract
 * @param pages - Array of {pageNumber, text} from PDFWorker
 * @param mode - 'abstract' or 'full'
 * @param options - Chunking options
 */
export function chunkDocumentWithPages(
  title: string,
  abstract: string | null,
  pages: PageText[] | null,
  mode: IndexingMode,
  options: ChunkOptions = {}
): Chunk[] {
  return chunkDocumentWithPagesEx(title, abstract, pages, mode, options).chunks;
}

/**
 * Extended version of chunkDocumentWithPages that also reports whether the
 * chunk limit was hit (so the caller can warn the user about partial indexing).
 */
export function chunkDocumentWithPagesEx(
  title: string,
  abstract: string | null,
  pages: PageText[] | null,
  mode: IndexingMode,
  options: ChunkOptions = {}
): ChunkResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: Chunk[] = [];
  let wasTruncated = false;
  const totalPagesAvailable = pages ? pages.length : 0;

  // Prepare title prefix (shorter for paragraph chunks)
  const titlePrefix = title.length > 200
    ? title.substring(0, 200) + '...'
    : title;

  const titleTokens = estimateTokens(titlePrefix) + 5;

  // ═══════════════════════════════════════════════════════════════════════
  // CHUNK 1: Summary (always included)
  // ═══════════════════════════════════════════════════════════════════════
  const summaryText = abstract && abstract.trim().length > 0
    ? `${titlePrefix}\n\n${abstract}`
    : titlePrefix;

  chunks.push({
    index: 0,
    text: summaryText,
    type: 'summary',
    tokenCount: estimateTokens(summaryText),
    pageNumber: 1,  // Abstracts are typically on page 1
    paragraphIndex: 0,
  });

  // For abstract mode, we're done
  if (mode === 'abstract') {
    const enforced = enforceCharLimitEx(chunks, opts.maxChars, opts.maxChunks);
    return {
      chunks: enforced.chunks,
      wasTruncated: wasTruncated || enforced.truncatedByCharLimit,
      pagesIndexed: 0,
      pagesTotal: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FULL MODE: Create PARAGRAPH-LEVEL chunks with exact page numbers
  // Each meaningful paragraph gets its own embedding for precise retrieval
  // ═══════════════════════════════════════════════════════════════════════
  if (!pages || pages.length === 0) {
    const enforced = enforceCharLimitEx(chunks, opts.maxChars, opts.maxChunks);
    return {
      chunks: enforced.chunks,
      wasTruncated: wasTruncated || enforced.truncatedByCharLimit,
      pagesIndexed: 0,
      pagesTotal: totalPagesAvailable,
    };
  }

  // Minimum text to be indexed (lowered to capture more content)
  const MIN_PARA_LENGTH = 50;   // ~10 words minimum
  const MIN_PARA_TOKENS = 15;   // Very short segments can still be useful

  // Classify text section based on content patterns
  const classifySection = (text: string): 'methods' | 'findings' | 'content' => {
    const lowerText = text.toLowerCase();
    if (/\b(results?|findings?|discussion|conclusion|analysis|implications)\b/i.test(lowerText.substring(0, 100))) {
      return 'findings';
    }
    if (/\b(method|approach|data|study|sample|participants?|procedure|design)\b/i.test(lowerText.substring(0, 100))) {
      return 'methods';
    }
    return 'content';
  };

  // Detect if we've reached the References/Bibliography section
  const isReferencesHeader = (text: string): boolean => {
    const firstLine = text.split('\n')[0].trim().toLowerCase();
    // Match common reference section headers
    return /^(references?|bibliography|works?\s*cited|literature\s*cited|citations?)$/i.test(firstLine) ||
           /^\d+\.?\s*(references?|bibliography)$/i.test(firstLine);
  };

  // Detect if text looks like a citation/reference entry
  const isReferenceEntry = (text: string): boolean => {
    // References typically have: Author, A. B. (Year). Title...
    // Or numbered: [1] Author...
    const patterns = [
      /^\[\d+\]/,                                    // [1] style
      /^\d+\.\s+[A-Z]/,                             // 1. Author style
      /^[A-Z][a-z]+,\s*[A-Z]\.\s*[A-Z]?\.\s*\(/,   // Smith, J. A. (
      /\(\d{4}[a-z]?\)\./,                          // (2021). or (2021a).
      /doi:\s*10\./i,                               // DOI pattern
      /https?:\/\/doi\.org/i,                       // DOI URL
      /pp\.\s*\d+[-–]\d+/,                          // pp. 123-456
      /Vol\.\s*\d+/i,                               // Vol. 12
    ];
    return patterns.some(p => p.test(text));
  };

  // Track if we've entered the references section
  let inReferencesSection = false;

  // Process each page and extract paragraphs using robust extraction
  for (const page of pages) {
    if (chunks.length >= opts.maxChunks) {
      wasTruncated = true;
      break;
    }
    if (inReferencesSection) break; // Stop processing if we've hit references

    // Skip pages with very little text
    if (page.text.trim().length < 100) continue;

    // Use robust paragraph extraction
    const paragraphs = extractParagraphsFromPage(page.text);

    let paragraphIdx = 0;
    for (const para of paragraphs) {
      if (chunks.length >= opts.maxChunks) {
        wasTruncated = true;
        break;
      }

      // Check if we've hit the references section
      if (!inReferencesSection && isReferencesHeader(para)) {
        inReferencesSection = true;
        // Skip the rest of this document
        break;
      }

      // Skip if we're in references section
      if (inReferencesSection) {
        break; // Skip all remaining pages too
      }

      // Skip reference-like entries (in case header was missed)
      if (isReferenceEntry(para)) {
        paragraphIdx++;
        continue;
      }

      // Skip too short paragraphs
      if (para.length < MIN_PARA_LENGTH) {
        paragraphIdx++;
        continue;
      }

      const paraTokens = estimateTokens(para);

      // Skip very short paragraphs by token count
      if (paraTokens < MIN_PARA_TOKENS) {
        paragraphIdx++;
        continue;
      }

      // Split oversized paragraphs into multiple chunks by sentences (fixes #20)
      // Instead of truncating and losing content, we split at sentence boundaries
      if (paraTokens > opts.maxTokens - titleTokens) {
        const availableTokens = opts.maxTokens - titleTokens;
        const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
        let currentText = '';
        let currentTokens = 0;

        for (const sentence of sentences) {
          const sentTokens = estimateTokens(sentence);

          if (currentTokens + sentTokens > availableTokens && currentText.trim()) {
            // Flush current chunk
            if (chunks.length >= opts.maxChunks) {
              wasTruncated = true;
              break;
            }
            const sectionType = classifySection(currentText);
            chunks.push({
              index: chunks.length,
              text: `${titlePrefix}\n\n${currentText.trim()}`,
              type: sectionType,
              tokenCount: currentTokens + titleTokens,
              pageNumber: page.pageNumber,
              paragraphIndex: paragraphIdx,
            });
            currentText = sentence;
            currentTokens = sentTokens;
          } else {
            currentText += sentence;
            currentTokens += sentTokens;
          }
        }

        // Flush remaining text
        if (currentText.trim()) {
          if (chunks.length < opts.maxChunks) {
            const sectionType = classifySection(currentText);
            chunks.push({
              index: chunks.length,
              text: `${titlePrefix}\n\n${currentText.trim()}`,
              type: sectionType,
              tokenCount: currentTokens + titleTokens,
              pageNumber: page.pageNumber,
              paragraphIndex: paragraphIdx,
            });
          } else {
            // Had content to flush but no room - this is truncation
            wasTruncated = true;
          }
        }
      } else {
        // Normal-sized paragraph: one chunk
        const sectionType = classifySection(para);
        chunks.push({
          index: chunks.length,
          text: `${titlePrefix}\n\n${para}`,
          type: sectionType,
          tokenCount: paraTokens + titleTokens,
          pageNumber: page.pageNumber,
          paragraphIndex: paragraphIdx,
        });
      }

      paragraphIdx++;
    }
  }

  // Enforce character limit as safety net (token estimates can undercount for dense text)
  const enforced = enforceCharLimitEx(chunks, opts.maxChars, opts.maxChunks);

  // pagesIndexed: count distinct pages reflected in surviving chunks (excluding summary on p.1)
  const distinctPages = new Set<number>();
  for (const c of enforced.chunks) {
    if (c.type !== 'summary' && c.pageNumber != null) distinctPages.add(c.pageNumber);
  }

  return {
    chunks: enforced.chunks,
    wasTruncated: wasTruncated || enforced.truncatedByCharLimit,
    pagesIndexed: distinctPages.size,
    pagesTotal: totalPagesAvailable,
  };
}

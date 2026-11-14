/**
 * Text Extractor - Extract text from Zotero items for embedding
 * 
 * Supports three indexing modes:
 * - abstract: Shared Metadata Summary only (fast, good for most uses)
 * - notes: Shared Metadata Summary + Child Notes (no PDF processing)
 * - full: Shared Metadata Summary + Child Notes + PDF sections
 */

import { Logger } from '../utils/logger';
import {
  RequestedPdfLookupErrorCode,
  ZoteroAPI,
  ZoteroItem,
} from '../utils/zotero-api';
import {
  Chunk,
  ChunkOptions,
  IndexingMode,
  chunkDocumentEx,
  chunkDocumentWithPagesEx,
  chunkNoteTexts,
  combineFullModeChunks,
  estimateCloudTokens,
  getChunkOptionsFromPrefs,
  getIndexingMode
} from '../utils/chunker';
import { noteHTMLToStructuredText, StructuredNoteText } from '../utils/note-text';
import { TextSourceType } from './vector-store-sqlite';
import { tokenizerService } from './tokenizer-service';
import { getActiveModel } from './model-registry';
import { resolveModelInputPolicy } from './model-input-policy';
import {
  assertPdfReferencePipelineModes,
  preprocessPdfPages,
} from '../utils/pdf-preprocessor';
import { buildIndexedMetadataSnapshot } from '../utils/indexed-metadata';

declare const Zotero: any;

export interface ExtractedText {
  itemId: number;
  itemKey: string;
  libraryId: number;
  title: string;
  text: string;
  source: TextSourceType;
  contentHash: string;
}

export interface ExtractedChunks {
  itemId: number;
  itemKey: string;
  libraryId: number;
  title: string;
  abstract: string | null;
  chunks: Chunk[];
  contentHash: string;

  // Indexing status — populated from the chunker so callers can detect
  // when the maxChunksPerPaper limit cut off content from a long paper.
  wasTruncated: boolean;
  pagesIndexed: number;
  pagesTotal: number;
}

export interface ExtractionProgress {
  current: number;
  total: number;
  currentTitle: string;
  status: 'extracting' | 'done' | 'error';
  skipped: number;
}

export interface PdfExtractionDiagnostic {
  status: 'selected' | 'abstained' | 'partial' | 'empty' | 'failed';
  attachmentKey?: string;
  reason: string | null;
  pagesIndexed: number;
  pagesTotal: number | null;
}

export interface ExtractionErrorDiagnostic {
  code:
    | 'pdf_mode_required'
    | 'pdf_attachment_invalid'
    | 'pdf_attachment_failed'
    | 'pdf_attachment_empty'
    | 'pdf_no_indexable_content'
    | 'no_extractable_content'
    | 'extraction_failed';
  stage: 'validate' | 'pdf' | 'extract';
  message: string;
}

/** Request-scoped extraction overrides and machine-readable diagnostics. */
export interface ExtractionContext {
  pdfAttachmentKey?: string;
  onDiagnostic?: (diagnostic: PdfExtractionDiagnostic) => void;
  onError?: (error: ExtractionErrorDiagnostic) => void;
}

export type ExtractionProgressCallback = (progress: ExtractionProgress) => void;

const REQUESTED_PDF_ERROR_CODES: Record<RequestedPdfLookupErrorCode, ExtractionErrorDiagnostic['code']> = {
  parent_not_found: 'pdf_attachment_invalid',
  parent_invalid: 'pdf_attachment_invalid',
  attachment_not_found: 'pdf_attachment_invalid',
  attachment_invalid: 'pdf_attachment_invalid',
  attachment_deleted: 'pdf_attachment_invalid',
  pdf_unavailable: 'pdf_attachment_failed',
};

const REQUESTED_PDF_ERROR_MESSAGES: Record<RequestedPdfLookupErrorCode, string> = {
  parent_not_found: 'The parent item is missing or deleted.',
  parent_invalid: 'PDF selection requires a bibliographic parent item.',
  attachment_not_found: 'The requested PDF is not attached to this item.',
  attachment_invalid: 'The requested attachment is not a valid PDF for this item.',
  attachment_deleted: 'The requested PDF has been deleted.',
  pdf_unavailable: 'Zotero could not extract the requested PDF.',
};

export class TextExtractor {
  private zoteroAPI: ZoteroAPI;
  private logger: Logger;

  constructor() {
    this.zoteroAPI = new ZoteroAPI();
    this.logger = new Logger('TextExtractor');
  }

  /** Resolve one immutable model policy snapshot for an extraction batch. */
  private async resolveChunkOptions(
    options: ChunkOptions | undefined,
  ): Promise<ChunkOptions> {
    if (options?.modelIdSnapshot) return options;

    const model = getActiveModel();
    const base = options ?? getChunkOptionsFromPrefs(Zotero);
    const requestedTokens = options?.maxTokens
      ?? Zotero?.Prefs?.get('zotseek.maxTokens', true);
    const policy = resolveModelInputPolicy(model, requestedTokens);
    const tokenCounter = options?.tokenCounter
      ?? (policy.supportsExactTokenCount
        ? await tokenizerService.getDocumentTokenCounter()
        : policy.runtime === 'cloud'
          ? estimateCloudTokens
          : undefined);

    return {
      ...base,
      maxTokens: policy.effectiveChunkTokens,
      modelMaxInputTokens: policy.maxInputTokens ?? undefined,
      maxChars: policy.maxChunkChars,
      tokenCounter,
      noteSoftMinTokens: policy.softMinTokens,
      modelIdSnapshot: model.id,
    };
  }

  /**
   * Extract text from a single item (legacy method for backward compatibility)
   */
  async extractFromItem(item: ZoteroItem): Promise<ExtractedText | null> {
    try {
      const title = item.getField('title') || 'Untitled';
      
      // Extract text using preferred sources
      const { text, source } = await this.zoteroAPI.extractText(item);
      
      if (!text || text.length < 10) {
        this.logger.warn(`Insufficient text for item ${item.id}: ${title}`);
        return null;
      }

      // Generate content hash for change detection
      const contentHash = this.hashContent(text);

      return {
        itemId: item.id,
        itemKey: item.key,
        libraryId: item.libraryID,
        title,
        text,
        source,
        contentHash,
      };
    } catch (error) {
      this.logger.error(`Failed to extract text from item ${item.id}:`, error);
      return null;
    }
  }

  /**
   * Extract chunks from a single item based on indexing mode
   * Uses page-by-page extraction for accurate page numbers in 'full' mode
   */
  async extractChunksFromItem(
    item: ZoteroItem,
    mode?: IndexingMode,
    options?: ChunkOptions,
    context?: ExtractionContext,
  ): Promise<ExtractedChunks | null> {
    try {
      const metadata = buildIndexedMetadataSnapshot(item, 'Untitled');
      const title = metadata.title;
      // Keep the original Zotero abstract in descriptive storage. Only the
      // shared Metadata body applies the 50-character embedding noise guard.
      const abstract = item.getField('abstractNote') || null;
      const metadataBody = metadata.body;

      // Get indexing mode from preference if not specified
      const indexingMode = mode ?? getIndexingMode(Zotero);
      const chunkOptions = await this.resolveChunkOptions(options);

      const reportDiagnostic = (diagnostic: PdfExtractionDiagnostic): void => {
        try { context?.onDiagnostic?.(diagnostic); } catch (error: any) {
          this.logger.warn(`PDF diagnostic callback failed: ${error?.message || error}`);
        }
      };
      const reportError = (diagnostic: ExtractionErrorDiagnostic): void => {
        try { context?.onError?.(diagnostic); } catch (error: any) {
          this.logger.warn(`Extraction error callback failed: ${error?.message || error}`);
        }
      };

      if (context?.pdfAttachmentKey && indexingMode !== 'full') {
        reportError({
          code: 'pdf_mode_required',
          stage: 'validate',
          message: 'Selecting a PDF requires the full indexing mode.',
        });
        return null;
      }

      let chunks: Chunk[];
      let wasTruncated = false;
      let pagesIndexed = 0;
      let pagesTotal = 0;

      if (indexingMode === 'full') {
        let pdfResult;
        let pdfText: import('../utils/pdf-attachment-selector').PdfAttachmentText | null = null;
        let pendingPdfDiagnostic: PdfExtractionDiagnostic | null = null;

        if (context?.pdfAttachmentKey) {
          const requested = await this.zoteroAPI.getRequestedPdfText(
            item.id,
            context.pdfAttachmentKey,
          );
          if (requested.errorCode) {
            const diagnostic = {
              code: REQUESTED_PDF_ERROR_CODES[requested.errorCode],
              stage: requested.errorCode === 'pdf_unavailable' ? 'pdf' : 'validate',
              message: REQUESTED_PDF_ERROR_MESSAGES[requested.errorCode],
            } satisfies ExtractionErrorDiagnostic;
            reportDiagnostic({
              status: 'failed',
              attachmentKey: context.pdfAttachmentKey,
              reason: requested.errorCode,
              pagesIndexed: 0,
              pagesTotal: requested.selectedText?.pagesTotal ?? null,
            });
            reportError(diagnostic);
            return null;
          }
          pdfText = requested.selectedText;
          if (!pdfText || pdfText.status === 'failed') {
            reportDiagnostic({
              status: 'failed',
              attachmentKey: context.pdfAttachmentKey,
              reason: 'pdf_unavailable',
              pagesIndexed: 0,
              pagesTotal: pdfText?.pagesTotal ?? null,
            });
            reportError({
              code: 'pdf_attachment_failed',
              stage: 'pdf',
              message: REQUESTED_PDF_ERROR_MESSAGES.pdf_unavailable,
            });
            return null;
          }
          const hasText = pdfText.pages.some(page => page.text.trim().length > 0);
          if (!hasText && pdfText.status === 'degraded') {
            reportDiagnostic({
              status: 'failed',
              attachmentKey: pdfText.attachmentKey,
              reason: 'pdf_unavailable',
              pagesIndexed: 0,
              pagesTotal: pdfText.pagesTotal,
            });
            reportError({
              code: 'pdf_attachment_failed',
              stage: 'pdf',
              message: REQUESTED_PDF_ERROR_MESSAGES.pdf_unavailable,
            });
            return null;
          }
          if (!hasText) {
            reportDiagnostic({
              status: 'empty',
              attachmentKey: pdfText.attachmentKey,
              reason: 'empty_text',
              pagesIndexed: 0,
              pagesTotal: pdfText.pagesTotal,
            });
            reportError({
              code: 'pdf_attachment_empty',
              stage: 'pdf',
              message: 'The requested PDF yielded no searchable text.',
            });
            return null;
          }
          pendingPdfDiagnostic = {
            status: pdfText.status === 'degraded' ? 'partial' : 'selected',
            attachmentKey: pdfText.attachmentKey,
            reason: pdfText.status === 'degraded' ? 'pdf_partial' : null,
            pagesIndexed: 0,
            pagesTotal: pdfText.pagesTotal,
          };
        } else {
          // The selector consumes each sibling PDFWorker-direct result once and
          // returns only a unique high-confidence main attachment for indexing.
          const selectedPdf = await this.zoteroAPI.getSelectedMainPdfText(item.id);
          pdfText = selectedPdf?.selectedText ?? null;
          const selectionReason = selectedPdf?.selection.abstainReason ?? 'selection-failed';
          if (pdfText) {
            pendingPdfDiagnostic = {
              status: pdfText.status === 'degraded' ? 'partial' : 'selected',
              attachmentKey: pdfText.attachmentKey,
              reason: pdfText.status === 'degraded' ? 'pdf_partial' : null,
              pagesIndexed: 0,
              pagesTotal: pdfText.pagesTotal,
            };
          } else {
            reportDiagnostic({
              status: !selectedPdf || selectedPdf.selection.abstainReason === 'unavailable'
                ? 'failed'
                : 'abstained',
              reason: selectionReason,
              pagesIndexed: 0,
              pagesTotal: null,
            });
          }
        }
        const referenceMode = chunkOptions.pdfReferenceRegionFiltering ?? 'v2';
        const pageFurnitureMode = chunkOptions.pdfPageFurnitureFiltering ?? 'v1';
        const pdfChunkOptions: ChunkOptions = {
          ...chunkOptions,
          pdfReferenceFiltering: 'off',
        };
        assertPdfReferencePipelineModes(
          referenceMode,
          pdfChunkOptions.pdfReferenceFiltering,
        );

        if (pdfText) {
          const preprocessed = preprocessPdfPages(pdfText.pages, {
            documentKey: item.key,
            pdfReferenceRegionFiltering: referenceMode,
            pdfPageFurnitureFiltering: pageFurnitureMode,
          });
          this.logger.debug(
            `PDF main-text preprocessing item=${item.id} attachment=${pdfText.attachmentKey} ` +
            `pages=${preprocessed.pages.length} references=${preprocessed.diagnostics.referenceRegionCount} ` +
            `furnitureLines=${preprocessed.diagnostics.ignoredPageFurnitureLineCount}`
          );
          try {
            pdfResult = chunkDocumentWithPagesEx(
              title,
              metadataBody,
              preprocessed.pages,
              indexingMode,
              pdfChunkOptions
            );
          } catch (chunkError: any) {
            console.error(`[TextExtractor] chunkDocumentWithPagesEx failed for item ${item.id}:`,
              chunkError?.message || chunkError?.toString() || chunkError);
            console.error(`[TextExtractor] Stack:`, chunkError?.stack);
            throw chunkError;
          }
        } else {
          // Abstain is deliberate: supplement/unknown/unavailable PDFs do not
          // re-enter through attachmentText or first-readable legacy fallbacks.
          this.logger.debug(
            `No eligible main PDF for item ${item.id}: ` +
            `${context?.pdfAttachmentKey ? 'requested-pdf-unavailable' : 'selector-abstained'}`
          );
          pdfResult = chunkDocumentWithPagesEx(
            title,
            metadataBody,
            null,
            indexingMode,
            pdfChunkOptions
          );
        }

        const noteTexts = await this.extractChildNoteTexts(item);
        const notesResult = chunkNoteTexts(title, noteTexts, chunkOptions);
        const pdfChunks = pdfResult.chunks.filter(chunk => chunk.type !== 'summary');
        const pdfAttachmentKey = pdfText?.attachmentKey;
        if (pdfAttachmentKey) {
          pdfChunks.forEach(chunk => {
            chunk.pdfAttachmentKey = pdfAttachmentKey;
          });
        }
        const combinedResult = combineFullModeChunks({
          summaryChunks: pdfResult.chunks.filter(chunk => chunk.type === 'summary'),
          noteChunks: notesResult.chunks,
          pdfChunks,
          notesWereTruncated: notesResult.wasTruncated,
          pdfWasTruncated: pdfResult.wasTruncated,
          pagesTotal: pdfResult.pagesTotal,
        }, chunkOptions);

        const indexedPdfChunks = pdfText
          ? combinedResult.chunks.filter(chunk =>
              chunk.pdfAttachmentKey === pdfText!.attachmentKey,
            )
          : [];
        if (pdfText && indexedPdfChunks.length === 0) {
          // An explicit one-shot choice must not replace prior content with metadata alone.
          const reason = pdfChunks.length > 0
            ? 'chunk_limit'
            : 'pdf_no_indexable_content';
          pendingPdfDiagnostic = {
            status: 'partial',
            attachmentKey: pdfText.attachmentKey,
            reason,
            pagesIndexed: 0,
            pagesTotal: pdfText.pagesTotal,
          };
          if (context?.pdfAttachmentKey) {
            reportDiagnostic(pendingPdfDiagnostic);
            reportError({
              code: 'pdf_no_indexable_content',
              stage: 'extract',
              message: 'The selected PDF produced no searchable PDF chunks under current filtering and chunk limits.',
            });
            return null;
          }
        }

        chunks = combinedResult.chunks;
        wasTruncated = combinedResult.wasTruncated;
        pagesIndexed = indexedPdfChunks.length > 0
          ? combinedResult.pagesIndexed
          : 0;
        pagesTotal = combinedResult.pagesTotal;
        if (pendingPdfDiagnostic) {
          pendingPdfDiagnostic.pagesIndexed = pagesIndexed;
          reportDiagnostic(pendingPdfDiagnostic);
        }
      } else if (indexingMode === 'notes') {
        // Metadata + Notes mode never touches PDF APIs. Authors and years
        // remain in hybrid keyword search rather than the shared Summary.

        const summaryResult = chunkDocumentEx(
          title,
          metadataBody || null,
          null,
          indexingMode,
          chunkOptions
        );
        // Metadata and note matches have no PDF location.
        summaryResult.chunks.forEach(chunk => {
          chunk.pageNumber = undefined;
          chunk.paragraphIndex = undefined;
        });

        const noteTexts = await this.extractChildNoteTexts(item);
        const notesResult = chunkNoteTexts(
          title,
          noteTexts,
          chunkOptions,
          summaryResult.chunks.length
        );

        chunks = [...summaryResult.chunks, ...notesResult.chunks];
        wasTruncated = summaryResult.wasTruncated || notesResult.wasTruncated;
        pagesIndexed = 0;
        pagesTotal = 0;
      } else {
        // Abstract mode uses the same Metadata Summary and never touches Notes
        // or PDF APIs.
        const result = chunkDocumentEx(title, metadataBody, null, indexingMode, chunkOptions);
        chunks = result.chunks;
        wasTruncated = result.wasTruncated;
        pagesIndexed = result.pagesIndexed;
        pagesTotal = result.pagesTotal;
      }

      if (chunks.length === 0) {
        this.logger.warn(`No chunks generated for item ${item.id}: ${title}`);
        reportError({
          code: 'no_extractable_content',
          stage: 'extract',
          message: 'No indexable chunks were extracted from the item.',
        });
        return null;
      }

      // Log chunk distribution by page for debugging
      const pageDistribution = new Map<number, number>();
      for (const chunk of chunks) {
        const page = chunk.pageNumber || 0;
        pageDistribution.set(page, (pageDistribution.get(page) || 0) + 1);
      }
      const pageInfo = [...pageDistribution.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([page, count]) => `p${page}:${count}`)
        .join(' ');
      this.logger.debug(`Item ${item.id}: ${chunks.length} chunks across pages [${pageInfo}]`);

      // Generate content hash from all chunk texts
      const allText = chunks.map(c => c.text).join('\n\n');
      const contentHash = this.hashContent(allText);

      return {
        itemId: item.id,
        itemKey: item.key,
        libraryId: item.libraryID,
        title,
        abstract,
        chunks,
        contentHash,
        wasTruncated,
        pagesIndexed,
        pagesTotal,
      };
    } catch (error: any) {
      // Better error logging - Error objects don't serialize well
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      const errorStack = error?.stack || '';
      this.logger.error(`Failed to extract chunks from item ${item.id}: ${errorMessage}`);
      try {
        context?.onError?.({
          code: 'extraction_failed',
          stage: 'extract',
          message: 'Text extraction failed; see the Zotero debug log for details.',
        });
      } catch {
        // Diagnostics must not change the extraction result.
      }
      if (errorStack) {
        console.error(`[TextExtractor] Stack trace for item ${item.id}:`, errorStack);
      }
      return null;
    }
  }

  /**
   * Read and normalize child notes in a stable order. Note IDs are local to a
   * Zotero profile, so item keys provide deterministic ordering across sessions.
   */
  private async extractChildNoteTexts(item: ZoteroItem): Promise<StructuredNoteText[]> {
    const noteIDs = item.getNotes?.() || [];
    if (noteIDs.length === 0) return [];

    const loaded = await Zotero.Items.getAsync(noteIDs);
    const notes: ZoteroItem[] = (Array.isArray(loaded) ? loaded : [loaded])
      .filter((note: ZoteroItem | null | undefined): note is ZoteroItem =>
        !!note && !!note.isNote?.()
      )
      .sort((a: ZoteroItem, b: ZoteroItem) => a.key.localeCompare(b.key));

    const texts: StructuredNoteText[] = [];
    for (const note of notes) {
      const text = noteHTMLToStructuredText(note.getNote?.() || '');
      if (text.indexText.length >= 3) texts.push(text);
    }
    return texts;
  }

  /**
   * Extract text from multiple items with progress callback (legacy)
   */
  async extractFromItems(
    items: ZoteroItem[],
    onProgress?: ExtractionProgressCallback
  ): Promise<ExtractedText[]> {
    const results: ExtractedText[] = [];
    let skipped = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.getField('title') || 'Untitled';

      // Report progress
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: items.length,
          currentTitle: title,
          status: 'extracting',
          skipped,
        });
      }

      const extracted = await this.extractFromItem(item);
      if (extracted) {
        results.push(extracted);
      } else {
        skipped++;
      }

      // Yield to UI thread periodically
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Report completion
    if (onProgress) {
      onProgress({
        current: items.length,
        total: items.length,
        currentTitle: '',
        status: 'done',
        skipped,
      });
    }

    this.logger.info(`Extracted text from ${results.length}/${items.length} items (${skipped} skipped)`);

    return results;
  }

  /**
   * Extract chunks from multiple items with progress callback
   */
  async extractChunksFromItems(
    items: ZoteroItem[],
    mode?: IndexingMode,
    options?: ChunkOptions,
    onProgress?: ExtractionProgressCallback,
    context?: ExtractionContext,
  ): Promise<ExtractedChunks[]> {
    const results: ExtractedChunks[] = [];
    let skipped = 0;
    let totalChunks = 0;

    // Get mode and options once
    const indexingMode = mode ?? getIndexingMode(Zotero);
    const chunkOptions = await this.resolveChunkOptions(options);
    
    this.logger.info(`Extracting chunks with mode: ${indexingMode}`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.getField('title') || 'Untitled';

      // Report progress
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: items.length,
          currentTitle: title,
          status: 'extracting',
          skipped,
        });
      }

      const extracted = await this.extractChunksFromItem(item, indexingMode, chunkOptions, context);
      if (extracted) {
        results.push(extracted);
        totalChunks += extracted.chunks.length;
      } else {
        skipped++;
      }

      // Yield to UI thread periodically
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Report completion
    if (onProgress) {
      onProgress({
        current: items.length,
        total: items.length,
        currentTitle: '',
        status: 'done',
        skipped,
      });
    }

    this.logger.info(`Extracted ${totalChunks} chunks from ${results.length}/${items.length} items (${skipped} skipped)`);

    return results;
  }

  /**
   * Generate a hash for content to detect changes
   */
  private hashContent(content: string): string {
    // Use a simple hash for change detection
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Get regular items (not notes/attachments) from a collection
   */
  async getItemsFromCollection(collectionId: number): Promise<ZoteroItem[]> {
    return this.zoteroAPI.getCollectionItems(collectionId);
  }

  /**
   * Get regular items from a library
   */
  async getItemsFromLibrary(libraryId: number): Promise<ZoteroItem[]> {
    return this.zoteroAPI.getLibraryItems(libraryId);
  }
}

// Singleton instance
export const textExtractor = new TextExtractor();

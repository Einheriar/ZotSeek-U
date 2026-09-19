/**
 * Zotero API wrapper
 * Provides type-safe access to Zotero's internal APIs
 *
 * Reference: https://windingwind.github.io/doc-for-zotero-plugin-dev/main/item-operations.html
 */

import { TextSourceType } from '../core/vector-store-sqlite';
import {
  PdfAttachmentSelection,
  PdfAttachmentText,
  selectMainPdfAttachment,
} from './pdf-attachment-selector';

declare const Zotero: any;

export interface ZoteroItem {
  id: number;
  key: string;
  libraryID: number;
  itemType: string;
  parentID?: number;
  getField(field: string): string;
  setField(field: string, value: string): void;
  getCreators(): ZoteroCreator[];
  getCreatorJSON(index: number): { firstName: string; lastName: string; creatorType: string };
  getBestAttachment(): Promise<ZoteroAttachment | null>;
  getAttachments(): number[];  // Returns attachment IDs
  getNotes(): number[];        // Returns note IDs
  getNote(): string;           // Returns note content as HTML
  getTags(): Array<{ tag: string; type?: number }>;
  isRegularItem(): boolean;
  isAttachment(): boolean;
  isNote(): boolean;
  relatedItems: string[];      // Related item keys
  addRelatedItem(item: ZoteroItem): void;
  saveTx(): Promise<number>;
}

export interface ZoteroCreator {
  firstName: string;
  lastName: string;
  creatorType: string;
}

export interface ZoteroAttachment {
  id: number;
  key: string;
  libraryID?: number;
  parentID?: number;
  attachmentContentType: string;
  attachmentText: Promise<string>;  // Full text from PDF/HTML
  isPDFAttachment(): boolean;
  isSnapshotAttachment(): boolean;
  getFilePath(): Promise<string>;
}

export interface SelectedMainPdfText {
  selection: PdfAttachmentSelection;
  selectedText: PdfAttachmentText | null;
}

export type PdfReadStatus =
  'ok' | 'partial' | 'not_found' | 'missing' | 'unresolved' | 'empty' | 'failed';
export type PdfReadSource = 'zotero-fulltext-cache' | 'pdfworker' | 'cache+pdfworker';
export type PdfReadLimitReason = 'page_limit' | 'character_limit';

export interface PdfFullReadLimits {
  batchPages: number;
  maxPages: number;
  maxCharacters: number;
}

export interface PdfReadPage {
  page: number;
  text: string;
}

export interface PdfReadResult {
  status: PdfReadStatus;
  source?: PdfReadSource;
  attachmentKey?: string;
  indexedPages?: number;
  totalPages?: number;
  complete: boolean;
  pages: PdfReadPage[];
  limitReason?: PdfReadLimitReason;
  nextPage?: number;
  referenceDetection?: {
    strategyId: string;
    strategyVersion: string;
    scannedFromPage: number;
    scannedToPage: number;
  };
  error?: string;
}

/** Map PDFWorker/cache form-feed boundaries back to explicit physical pages. */
export function mapPdfPageText(text: unknown, pageNumbers: number[]): PdfReadPage[] | null {
  if (pageNumbers.length === 0) return [];
  if (typeof text !== 'string') return null;
  const parts = text.split('\f');
  if (parts.length !== pageNumbers.length) return null;
  return parts.map((part, index) => ({ page: pageNumbers[index], text: part }));
}

export interface ZoteroCollection {
  id: number;
  key: string;
  name: string;
  libraryID: number;
  getChildItems(includeDeleted?: boolean): ZoteroItem[];
}

// Helper to log with Zotero.debug
function debug(msg: string): void {
  if (typeof Zotero !== 'undefined' && Zotero.debug) {
    Zotero.debug(`[ZoteroAPI] ${msg}`);
  }
}

/**
 * Wrapper for Zotero API access
 */
export class ZoteroAPI {
  /**
   * Get currently selected items in Zotero
   */
  getSelectedItems(): ZoteroItem[] {
    try {
      const pane = Zotero.getActiveZoteroPane();
      if (!pane) return [];
      return pane.getSelectedItems() || [];
    } catch (error) {
      debug(`Failed to get selected items: ${error}`);
      return [];
    }
  }

  /**
   * Get all items in a collection using Search API
   * Reference: https://windingwind.github.io/doc-for-zotero-plugin-dev/main/search-operations.html
   */
  async getCollectionItems(collectionId: number, libraryId?: number): Promise<ZoteroItem[]> {
    try {
      const s = new Zotero.Search();
      s.libraryID = libraryId || Zotero.Libraries.userLibraryID;
      s.addCondition('collectionID', 'is', collectionId);
      s.addCondition('recursive', 'true');  // Include subcollections
      s.addCondition('itemType', 'isNot', 'attachment');
      s.addCondition('itemType', 'isNot', 'note');

      const itemIDs = await s.search();
      return Zotero.Items.getAsync(itemIDs);
    } catch (error) {
      debug(`Failed to get collection items: ${error}`);
      return [];
    }
  }

  /**
   * Get all regular items in user's library using Search API
   */
  async getLibraryItems(libraryId?: number): Promise<ZoteroItem[]> {
    try {
      const s = new Zotero.Search();
      s.libraryID = libraryId || Zotero.Libraries.userLibraryID;
      s.addCondition('itemType', 'isNot', 'attachment');
      s.addCondition('itemType', 'isNot', 'note');

      const itemIDs = await s.search();
      return Zotero.Items.getAsync(itemIDs);
    } catch (error) {
      debug(`Failed to get library items: ${error}`);
      return [];
    }
  }

  /**
   * Get all indexable libraries (user + groups, excluding feeds).
   */
  getAllLibraries(): Array<{ libraryID: number; name: string; libraryType: string; groupID?: number }> {
    try {
      const libs: any[] = Zotero.Libraries.getAll();
      return libs
        .filter((lib: any) => lib.libraryType === 'user' || lib.libraryType === 'group')
        .map((lib: any) => ({
          libraryID: lib.libraryID,
          name: lib.name,
          libraryType: lib.libraryType,
          groupID: lib.groupID,
        }));
    } catch (error) {
      debug(`Failed to get all libraries: ${error}`);
      return [];
    }
  }

  /**
   * Get all regular items across all indexable libraries (user + groups).
   */
  async getAllLibraryItems(): Promise<ZoteroItem[]> {
    const libraries = this.getAllLibraries();
    const allItems: ZoteroItem[] = [];
    for (const lib of libraries) {
      try {
        const items = await this.getLibraryItems(lib.libraryID);
        debug(`Got ${items.length} items from library ${lib.name} (${lib.libraryType})`);
        allItems.push(...items);
      } catch (error) {
        debug(`Failed to get items for library ${lib.name}: ${error}`);
      }
    }
    return allItems;
  }

  /**
   * Get item by ID
   */
  getItem(itemId: number): ZoteroItem | null {
    try {
      return Zotero.Items.get(itemId);
    } catch (error) {
      debug(`Failed to get item ${itemId}: ${error}`);
      return null;
    }
  }

  /**
   * Get items by IDs
   */
  async getItems(itemIds: number[]): Promise<ZoteroItem[]> {
    try {
      return Zotero.Items.getAsync(itemIds);
    } catch (error) {
      debug(`Failed to get items: ${error}`);
      return [];
    }
  }

  /**
   * Get full text content for an item using attachment.attachmentText
   * Reference: https://windingwind.github.io/doc-for-zotero-plugin-dev/main/item-operations.html
   */
  async getFullText(itemId: number): Promise<string | null> {
    try {
      const item = this.getItem(itemId);
      if (!item || !item.isRegularItem()) return null;

      const attachmentIDs = item.getAttachments();
      const fulltext: string[] = [];

      for (const id of attachmentIDs) {
        const attachment = Zotero.Items.get(id) as ZoteroAttachment;
        if (attachment.isPDFAttachment() || attachment.isSnapshotAttachment()) {
          try {
            const text = await attachment.attachmentText;
            if (text) fulltext.push(text);
          } catch (e) {
            // Some attachments may not have text
          }
        }
      }

      return fulltext.join('\n\n') || null;
    } catch (error) {
      debug(`Failed to get full text for item ${itemId}: ${error}`);
      return null;
    }
  }

  /** Extract one PDF attachment exactly once while preserving physical slots. */
  async getPdfWorkerTextByAttachment(attachment: ZoteroAttachment): Promise<PdfAttachmentText> {
    let fileName: string | undefined;
    try {
      const filePath = await attachment.getFilePath?.();
      fileName = typeof filePath === 'string'
        ? filePath.replace(/\\/g, '/').split('/').pop()
        : undefined;
    } catch {
      // Filename is only one selector signal; missing files remain diagnosable.
    }

    try {
      // PDFWorker is the page-count authority. Zotero.Fulltext may not have a
      // database row yet and therefore cannot gate extraction.
      const firstPageResult = await Zotero.PDFWorker.getFullText(
        attachment.id,
        [0],
        false,
        null,
      );
      const totalPages = Number(firstPageResult?.totalPages ?? 0);
      if (!Number.isInteger(totalPages) || totalPages <= 0) {
        debug(`PDFWorker returned an invalid page count for attachment ${attachment.id}: ${totalPages}`);
        return {
          attachmentId: attachment.id,
          attachmentKey: attachment.key,
          fileName,
          pagesTotal: null,
          pages: [],
          status: 'failed',
        };
      }

      const pages: Array<{ pageNumber: number; text: string }> = [];
      let failedPages = 0;
      let hasText = false;
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        try {
          const pageResult = pageIndex === 0
            ? firstPageResult
            : await Zotero.PDFWorker.getFullText(
              attachment.id,
              [pageIndex],
              false,
              null,
            );
          const text = typeof pageResult?.text === 'string' ? pageResult.text : '';
          if (text.trim().length > 0) hasText = true;
          pages.push({ pageNumber: pageIndex + 1, text });
        } catch (pageError) {
          failedPages++;
          debug(`Error extracting attachment ${attachment.id}, page ${pageIndex + 1}: ${pageError}`);
          pages.push({ pageNumber: pageIndex + 1, text: '' });
        }
      }
      return {
        attachmentId: attachment.id,
        attachmentKey: attachment.key,
        fileName,
        pagesTotal: totalPages,
        pages,
        status: hasText
          ? failedPages > 0 ? 'degraded' : 'ok'
          : failedPages > 0 ? 'degraded' : 'empty',
      };
    } catch (error) {
      debug(`Failed to probe PDF attachment ${attachment.id}: ${error}`);
      return {
        attachmentId: attachment.id,
        attachmentKey: attachment.key,
        fileName,
        pagesTotal: null,
        pages: [],
        status: 'failed',
      };
    }
  }

  /**
   * Read exact attachment pages without running the main-PDF classifier.
   * Zotero's own full-text cache is preferred. Explicit page requests use one
   * PDFWorker batch with single-page recovery for ambiguous boundaries;
   * callers may opt into bounded, sequential full reads.
   */
  async readPdfAttachment(
    attachment: ZoteroAttachment,
    requestedPages: number[] | null,
    fullReadLimits?: PdfFullReadLimits,
  ): Promise<PdfReadResult> {
    const attachmentKey = attachment.key;
    let indexedPages = 0;
    let knownTotal = 0;
    let cachedPages: PdfReadPage[] | null = null;

    try {
      try {
        const info = await Zotero.Fulltext?.getPages?.(attachment.id);
        indexedPages = Number.isInteger(Number(info?.indexedPages))
          ? Math.max(0, Number(info.indexedPages))
          : 0;
        knownTotal = Number.isInteger(Number(info?.total ?? info?.totalPages))
          ? Math.max(0, Number(info.total ?? info.totalPages))
          : 0;
      } catch {
        // Missing fulltextItems state is normal; PDFWorker remains the fallback.
      }

      if (indexedPages > 0) {
        try {
          const cacheFile = Zotero.Fulltext?.getItemCacheFile?.(attachment);
          if (cacheFile?.exists?.()) {
            const cacheText = await Zotero.File.getContentsAsync(cacheFile.path, 'utf-8');
            const cacheCount = knownTotal > 0
              ? Math.min(indexedPages, knownTotal)
              : indexedPages;
            cachedPages = mapPdfPageText(
              cacheText,
              Array.from({ length: cacheCount }, (_, index) => index + 1),
            );
          }
        } catch (error) {
          debug(`Failed to read Zotero full-text cache for ${attachment.id}: ${error}`);
          cachedPages = null;
        }
      }

      if (requestedPages && knownTotal > 0 && requestedPages.some(page => page > knownTotal)) {
        throw new Error(`Requested PDF page exceeds total page count (${knownTotal})`);
      }

      const cachedByPage = new Map((cachedPages || []).map(page => [page.page, page]));

      if (requestedPages === null && fullReadLimits) {
        return await this.readBoundedPdfAttachment(
          attachment,
          attachmentKey,
          indexedPages,
          knownTotal,
          cachedByPage,
          fullReadLimits,
        );
      }

      if (requestedPages === null && cachedPages && knownTotal > 0 && cachedPages.length >= knownTotal) {
        return this.finishPdfRead(
          attachmentKey,
          cachedPages.slice(0, knownTotal),
          indexedPages,
          knownTotal,
          'zotero-fulltext-cache',
          true,
        );
      }

      let pagesToRead: number[] | null;
      if (requestedPages === null) {
        pagesToRead = cachedPages && knownTotal > 0
          ? Array.from(
              { length: Math.max(0, knownTotal - cachedPages.length) },
              (_, index) => cachedPages!.length + index + 1,
            )
          : null;
      } else {
        pagesToRead = requestedPages.filter(page => !cachedByPage.has(page));
      }

      if (Array.isArray(pagesToRead) && pagesToRead.length === 0) {
        const pages = requestedPages!.map(page => cachedByPage.get(page)!).filter(Boolean);
        return this.finishPdfRead(
          attachmentKey,
          pages,
          indexedPages,
          knownTotal,
          'zotero-fulltext-cache',
          pages.length === requestedPages!.length,
        );
      }

      const workerArg = pagesToRead === null
        ? null
        : pagesToRead.map(page => page - 1);
      const worker = await Zotero.PDFWorker.getFullText(
        attachment.id,
        workerArg,
        false,
        null,
      );
      const workerTotal = Number(worker?.totalPages ?? 0);
      if (!Number.isInteger(workerTotal) || workerTotal <= 0) {
        throw new Error('PDFWorker returned an invalid total page count');
      }
      if (requestedPages && requestedPages.some(page => page > workerTotal)) {
        throw new Error(`Requested PDF page exceeds total page count (${workerTotal})`);
      }

      const workerPageNumbers = pagesToRead === null
        ? Array.from({ length: workerTotal }, (_, index) => index + 1)
        : pagesToRead;
      const workerPages = await this.mapWorkerPages(attachment.id, worker, workerPageNumbers, workerTotal);

      let pages: PdfReadPage[];
      let complete: boolean;
      if (requestedPages === null) {
        const merged = new Map<number, PdfReadPage>(cachedByPage);
        workerPages.forEach(page => merged.set(page.page, page));
        pages = Array.from({ length: workerTotal }, (_, index) => merged.get(index + 1))
          .filter((page): page is PdfReadPage => !!page);
        complete = pages.length === workerTotal;
      } else {
        const merged = new Map<number, PdfReadPage>(cachedByPage);
        workerPages.forEach(page => merged.set(page.page, page));
        pages = requestedPages.map(page => merged.get(page)).filter((page): page is PdfReadPage => !!page);
        complete = pages.length === requestedPages.length;
      }

      return this.finishPdfRead(
        attachmentKey,
        pages,
        indexedPages,
        workerTotal,
        cachedByPage.size > 0 ? 'cache+pdfworker' : 'pdfworker',
        complete,
      );
    } catch (error: any) {
      return {
        status: 'failed',
        attachmentKey,
        indexedPages,
        totalPages: knownTotal || undefined,
        complete: false,
        pages: [],
        error: error?.message || String(error),
      };
    }
  }

  /**
   * Read a leading, page-aligned prefix in bounded PDFWorker batches. The
   * character threshold never splits a physical page; a single unusually
   * large page may therefore exceed it, but later pages are not requested.
   */
  private async readBoundedPdfAttachment(
    attachment: ZoteroAttachment,
    attachmentKey: string,
    indexedPages: number,
    knownTotal: number,
    cachedByPage: Map<number, PdfReadPage>,
    limits: PdfFullReadLimits,
  ): Promise<PdfReadResult> {
    const batchPages = this.requirePositiveInteger(limits.batchPages, 'PDF full-read batch size');
    const maxPages = this.requirePositiveInteger(limits.maxPages, 'PDF full-read page limit');
    const maxCharacters = this.requirePositiveInteger(
      limits.maxCharacters,
      'PDF full-read character limit',
    );
    const originallyCached = new Set(cachedByPage.keys());
    let totalPages = knownTotal;
    let usedWorker = false;

    if (totalPages <= 0) {
      // PDFWorker is the page-count authority when Zotero has no full-text row.
      // Probe only page 1 rather than enqueueing an unbounded whole-document job.
      const probe = await Zotero.PDFWorker.getFullText(attachment.id, [0], false, null);
      totalPages = Number(probe?.totalPages ?? 0);
      if (!Number.isInteger(totalPages) || totalPages <= 0) {
        throw new Error('PDFWorker returned an invalid total page count');
      }
      const probePages = await this.mapWorkerPages(attachment.id, probe, [1], totalPages);
      if (!cachedByPage.has(1)) cachedByPage.set(1, probePages[0]);
      usedWorker = true;
    }

    const pages: PdfReadPage[] = [];
    let characterCount = 0;
    let nextPage = 1;
    let limitReason: PdfReadLimitReason | undefined;

    while (nextPage <= totalPages) {
      if (pages.length >= maxPages) {
        limitReason = 'page_limit';
        break;
      }

      if (!cachedByPage.has(nextPage)) {
        const remainingSlots = maxPages - pages.length;
        const batchEnd = Math.min(
          totalPages,
          nextPage + batchPages - 1,
          nextPage + remainingSlots - 1,
        );
        const missingPages = Array.from(
          { length: batchEnd - nextPage + 1 },
          (_, index) => nextPage + index,
        ).filter(page => !cachedByPage.has(page));
        const worker = await Zotero.PDFWorker.getFullText(
          attachment.id,
          missingPages.map(page => page - 1),
          false,
          null,
        );
        const workerTotal = Number(worker?.totalPages ?? 0);
        if (!Number.isInteger(workerTotal) || workerTotal <= 0) {
          throw new Error('PDFWorker returned an invalid total page count');
        }
        if (missingPages.some(page => page > workerTotal)) {
          throw new Error(`Requested PDF page exceeds total page count (${workerTotal})`);
        }
        totalPages = workerTotal;
        const workerPages = await this.mapWorkerPages(attachment.id, worker, missingPages, workerTotal);
        workerPages.forEach(page => cachedByPage.set(page.page, page));
        usedWorker = true;
      }

      const page = cachedByPage.get(nextPage);
      if (!page) {
        throw new Error(`PDFWorker did not return requested physical page ${nextPage}`);
      }
      if (pages.length > 0 && characterCount + page.text.length > maxCharacters) {
        limitReason = 'character_limit';
        break;
      }
      pages.push(page);
      characterCount += page.text.length;
      nextPage++;
      if (characterCount >= maxCharacters && nextPage <= totalPages) {
        limitReason = 'character_limit';
        break;
      }
    }

    const complete = nextPage > totalPages;
    const usedCache = pages.some(page => originallyCached.has(page.page));
    const source: PdfReadSource = usedCache && usedWorker
      ? 'cache+pdfworker'
      : usedCache ? 'zotero-fulltext-cache' : 'pdfworker';
    return this.finishPdfRead(
      attachmentKey,
      pages,
      indexedPages,
      totalPages,
      source,
      complete,
      limitReason,
      complete ? undefined : nextPage,
    );
  }

  private async mapWorkerPages(
    attachmentId: number,
    worker: any,
    pageNumbers: number[],
    totalPages: number,
  ): Promise<PdfReadPage[]> {
    if (typeof worker?.text !== 'string'
      || (worker.extractedPages !== undefined && worker.extractedPages !== pageNumbers.length)) {
      throw new Error('PDFWorker returned invalid page text or extracted page count');
    }
    // A single-page request is authoritative even when its text contains form feeds.
    if (pageNumbers.length === 1) return [{ page: pageNumbers[0], text: worker.text }];
    const mapped = mapPdfPageText(worker.text, pageNumbers);
    if (mapped) return mapped;

    // Zotero trims the joined text, including form feeds around empty edge pages.
    // Lost boundaries cannot be reconstructed safely. Reread only this batch,
    // serially, without padding, guessing boundaries, or enqueueing retry jobs.
    const pages: PdfReadPage[] = [];
    for (const page of pageNumbers) {
      const single = await Zotero.PDFWorker.getFullText(attachmentId, [page - 1], false, null);
      if (Number(single?.totalPages) !== totalPages || typeof single?.text !== 'string'
        || (single.extractedPages !== undefined && single.extractedPages !== 1)) {
        throw new Error('PDFWorker returned inconsistent single-page fallback data');
      }
      pages.push({ page, text: single.text });
    }
    return pages;
  }

  private requirePositiveInteger(value: number, label: string): number {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${label} must be a positive integer`);
    }
    return value;
  }

  private finishPdfRead(
    attachmentKey: string,
    pages: PdfReadPage[],
    indexedPages: number,
    totalPages: number,
    source: PdfReadSource,
    complete: boolean,
    limitReason?: PdfReadLimitReason,
    nextPage?: number,
  ): PdfReadResult {
    const hasText = pages.some(page => page.text.trim().length > 0);
    return {
      status: complete ? (hasText ? 'ok' : 'empty') : 'partial',
      source,
      attachmentKey,
      indexedPages,
      totalPages,
      complete,
      pages,
      ...(limitReason ? { limitReason } : {}),
      ...(nextPage ? { nextPage } : {}),
    };
  }

  /**
   * Extract every sibling PDF once, select one high-confidence main document,
   * and reuse its direct pages. Supplement and unknown attachments never fall
   * back to attachment order or Zotero's best-attachment heuristic.
   */
  async getSelectedMainPdfText(itemId: number): Promise<SelectedMainPdfText | null> {
    try {
      const item = this.getItem(itemId);
      if (!item || !item.isRegularItem()) return null;
      const attachments: PdfAttachmentText[] = [];
      for (const attachmentId of item.getAttachments()) {
        const attachment = Zotero.Items.get(attachmentId) as ZoteroAttachment | null;
        if (!attachment?.isPDFAttachment?.()) continue;
        attachments.push(await this.getPdfWorkerTextByAttachment(attachment));
      }
      const selection = selectMainPdfAttachment(
        item.getField('title') || '',
        attachments,
      );
      const selectedText = selection.selectedAttachmentId == null
        ? null
        : attachments.find(candidate =>
          candidate.attachmentId === selection.selectedAttachmentId
        ) ?? null;
      debug(
        `PDF selector ${selection.selectorId}@${selection.selectorVersion} item=${itemId} ` +
        `decision=${selection.decision} selected=${selection.selectedAttachmentKey ?? 'none'} ` +
        `abstain=${selection.abstainReason ?? 'none'}`
      );
      return { selection, selectedText };
    } catch (error) {
      debug(`Failed to select main PDF for item ${itemId}: ${error}`);
      return null;
    }
  }

  /** Compatibility wrapper returning only the selected main PDF pages. */
  async getFullTextByPage(itemId: number): Promise<Array<{ pageNumber: number; text: string }> | null> {
    const selected = await this.getSelectedMainPdfText(itemId);
    return selected?.selectedText?.pages ?? null;
  }

  /**
   * Extract text from item (title + abstract, with fulltext fallback)
   */
  async extractText(item: ZoteroItem): Promise<{ text: string; source: TextSourceType }> {
    const title = item.getField('title') || '';
    const abstract = item.getField('abstractNote') || '';

    // Prefer title + abstract
    if (abstract.length > 50) {
      return {
        text: `${title}\n\n${abstract}`,
        source: 'abstract'
      };
    }

    // Try full text from attachments
    const fullText = await this.getFullText(item.id);
    if (fullText && fullText.length > 100) {
      // Use first 500 words of full text
      const words = fullText.split(/\s+/).slice(0, 500);
      return {
        text: `${title}\n\n${words.join(' ')}`,
        source: 'fulltext'
      };
    }

    // Fall back to title only
    return {
      text: title,
      source: 'title_only'
    };
  }

  /**
   * Set two items as related to each other
   */
  async setRelated(itemA: ZoteroItem, itemB: ZoteroItem): Promise<void> {
    itemA.addRelatedItem(itemB);
    await itemA.saveTx();
    itemB.addRelatedItem(itemA);
    await itemB.saveTx();
    debug(`Set items ${itemA.id} and ${itemB.id} as related`);
  }

  /**
   * Format authors for display
   */
  formatAuthors(item: ZoteroItem): string {
    const creators = item.getCreators();
    const authors = creators.filter(c => c.creatorType === 'author');

    if (authors.length === 0) return '';
    if (authors.length === 1) return authors[0].lastName;
    if (authors.length === 2) return `${authors[0].lastName} & ${authors[1].lastName}`;
    return `${authors[0].lastName} et al.`;
  }

  /**
   * Get year from item
   */
  getYear(item: ZoteroItem): number | null {
    const date = item.getField('date');
    if (!date) return null;
    const year = parseInt(date.substring(0, 4), 10);
    return isNaN(year) ? null : year;
  }

  /**
   * Select an item in Zotero
   */
  selectItem(itemId: number): void {
    try {
      const pane = Zotero.getActiveZoteroPane();
      if (pane) {
        pane.selectItem(itemId);
      }
    } catch (error) {
      debug(`Failed to select item ${itemId}: ${error}`);
    }
  }

  /**
   * Select multiple items in Zotero
   */
  selectItems(itemIds: number[]): void {
    try {
      const pane = Zotero.getActiveZoteroPane();
      if (pane && itemIds.length > 0) {
        pane.selectItems(itemIds);
      }
    } catch (error) {
      debug(`Failed to select items: ${error}`);
    }
  }

  /**
   * Get total page count for an item's PDF attachment
   * Uses Zotero.Fulltext.getPages() for accurate page counts
   */
  async getPageCount(itemId: number): Promise<number | null> {
    try {
      const item = this.getItem(itemId);
      if (!item || !item.isRegularItem()) return null;

      const attachmentIDs = item.getAttachments();
      for (const id of attachmentIDs) {
        const attachment = Zotero.Items.get(id);
        if (attachment && attachment.isPDFAttachment()) {
          // Use Zotero's Fulltext API to get page count
          const pages = await Zotero.Fulltext.getPages(id);
          if (pages && pages.total > 0) {
            debug(`Item ${itemId}: ${pages.total} pages (${pages.indexedPages} indexed)`);
            return pages.total;
          }
        }
      }
      return null;
    } catch (error) {
      debug(`Failed to get page count for item ${itemId}: ${error}`);
      return null;
    }
  }

  /**
   * Find exact page number for a text snippet using PDFWorker
   * Searches each page until the snippet is found
   *
   * @param itemId - The parent item ID
   * @param snippet - Text snippet to search for (first ~100 chars of chunk)
   * @returns The 1-based page number, or null if not found
   */
  async findExactPage(itemId: number, snippet: string): Promise<number | null> {
    try {
      const item = this.getItem(itemId);
      if (!item || !item.isRegularItem()) return null;

      const attachmentIDs = item.getAttachments();
      for (const id of attachmentIDs) {
        const attachment = Zotero.Items.get(id);
        if (!attachment || !attachment.isPDFAttachment()) continue;

        // Get total pages first
        const pageInfo = await Zotero.Fulltext.getPages(id);
        if (!pageInfo || pageInfo.total <= 0) continue;

        const totalPages = pageInfo.total;

        // Normalize snippet for matching (remove extra whitespace, lowercase)
        const normalizedSnippet = snippet
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 100); // Use first 100 chars for matching

        debug(`Searching for a snippet across ${totalPages} pages`);

        // Search each page using PDFWorker with specific page indices
        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
          try {
            // Get text for this specific page (0-indexed array)
            const pageResult = await Zotero.PDFWorker.getFullText(id, [pageIndex], false, null);

            if (pageResult && pageResult.text) {
              const normalizedPageText = pageResult.text
                .toLowerCase()
                .replace(/\s+/g, ' ');

              if (normalizedPageText.includes(normalizedSnippet)) {
                debug(`Found snippet on page ${pageIndex + 1}`);
                return pageIndex + 1; // Return 1-based page number
              }
            }
          } catch (pageError) {
            debug(`Error extracting page ${pageIndex}: ${pageError}`);
          }
        }

        debug(`Snippet not found in any page`);
        return null;
      }
      return null;
    } catch (error) {
      debug(`Failed to find exact page for item ${itemId}: ${error}`);
      return null;
    }
  }

  /**
   * Open PDF attachment for an item
   */
  async openPDF(itemId: number): Promise<void> {
    try {
      const item = this.getItem(itemId);
      if (!item) return;

      const attachment = await item.getBestAttachment();
      if (!attachment) return;

      await Zotero.Reader.open(attachment.id);
    } catch (error) {
      debug(`Failed to open PDF for item ${itemId}: ${error}`);
    }
  }

  /**
   * Open PDF to a specific page
   * @param itemId - The parent item ID
   * @param pageNumber - 1-based page number to navigate to
   * @param attachmentKey - Exact PDF provenance; omitted only for legacy results
   */
  async openPDFToPage(itemId: number, pageNumber: number, attachmentKey?: string): Promise<void> {
    try {
      const item = this.getItem(itemId);
      if (!item) return;

      let attachment: ZoteroAttachment | null = null;
      if (attachmentKey) {
        const attachmentId = Zotero.Items.getIDFromLibraryAndKey(item.libraryID, attachmentKey);
        const exact = attachmentId ? Zotero.Items.get(attachmentId) : null;
        if (exact?.parentID !== item.id || !exact?.isPDFAttachment?.()) {
          debug(`Exact PDF attachment ${attachmentKey} is unavailable for item ${itemId}`);
          return;
        }
        attachment = exact;
      } else {
        attachment = await item.getBestAttachment();
      }
      if (!attachment) return;

      // Convert 1-based page to 0-based pageIndex
      const location = { pageIndex: pageNumber - 1 };

      debug(`Opening PDF ${attachment.key || attachment.id} for item ${itemId} to page ${pageNumber}`);
      await Zotero.Reader.open(attachment.id, location);
    } catch (error) {
      debug(`Failed to open PDF to page for item ${itemId}: ${error}`);
    }
  }

  /**
   * Get user library ID
   */
  getUserLibraryID(): number {
    return Zotero.Libraries.userLibraryID;
  }
}


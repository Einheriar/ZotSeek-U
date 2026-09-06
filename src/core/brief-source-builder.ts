/** Build the complete, page-addressable evidence sent to the brief model. */

import { preprocessPdfPages, type PdfPreprocessResult } from '../utils/pdf-preprocessor';
import type { PdfReadPage, PdfReadResult } from '../utils/zotero-api';
import type { StableIdentity } from './identity-resolver';

export const BRIEF_MIN_TEXT_CODE_POINTS = 100;

export interface BriefSourcePage {
  page: number;
  text: string;
}

export interface BriefSourceParent {
  title: string;
  abstract: string;
  identity: StableIdentity;
  itemKey: string;
  libraryKey: string;
  value: unknown;
}

export interface BriefSourceEvidence {
  parent: BriefSourceParent;
  attachment: unknown;
  attachmentKey: string;
  pages: BriefSourcePage[];
  formattedText: string;
  textCodePoints: number;
  pageCount: number;
  indexedPages: number;
  totalPages: number;
  coverage: 'complete' | 'partial';
  readStatus: string;
  readSource?: string;
  preprocess?: PdfPreprocessResult['diagnostics'];
}

export type BriefSourceBuildResult =
  | { status: 'ready'; evidence: BriefSourceEvidence }
  | { status: 'insufficient_text'; reason: 'insufficient_text'; evidence?: BriefSourceEvidence }
  | { status: 'failed'; reason: string; error?: unknown };

export interface BriefSourceTarget {
  /** A regular Zotero parent. Exactly one of parent/attachment is required. */
  parent?: unknown;
  /** A PDF attachment. It is read directly, never passed through main-PDF selection. */
  attachment?: unknown;
}

export interface BriefSourceBuilderDependencies {
  identityOf?: (parent: unknown) => StableIdentity | null | undefined;
  parentOfAttachment?: (attachment: unknown) => unknown | null | Promise<unknown | null>;
  selectMainPdf?: (parent: unknown) => unknown | null | Promise<unknown | null>;
  readPdf: (attachment: unknown) => PdfReadResult | Promise<PdfReadResult>;
  preprocess?: typeof preprocessPdfPages;
}

export class BriefSourceBuilderError extends Error {
  readonly code = 'BRIEF_SOURCE_BUILDER_ERROR' as const;
  constructor(message: string) {
    super(message);
    this.name = 'BriefSourceBuilderError';
  }
}

function field(item: any, name: string): string {
  try {
    const value = typeof item?.getField === 'function' ? item.getField(name) : item?.[name];
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  } catch { return ''; }
}

function isRegular(item: any): boolean {
  if (typeof item?.isRegularItem === 'function') return item.isRegularItem() === true;
  return item?.itemType === 'journalArticle' || item?.itemType === 'book' || item?.itemType === 'report' ||
    (item && !item.isAttachment && !item.isNote && item.parentID == null);
}

function isPdf(attachment: any): boolean {
  if (typeof attachment?.isPDFAttachment === 'function') return attachment.isPDFAttachment() === true;
  return String(attachment?.attachmentContentType || attachment?.contentType || '').toLowerCase() === 'application/pdf';
}

function identityFromRecord(item: any, dependency?: BriefSourceBuilderDependencies['identityOf']): StableIdentity | null {
  const value = dependency?.(item) || item?.identity;
  const libraryKey = value?.libraryKey ?? item?.libraryKey;
  const itemKey = value?.itemKey ?? item?.key;
  return typeof libraryKey === 'string' && libraryKey.trim() &&
    typeof itemKey === 'string' && itemKey.trim()
    ? { libraryKey: libraryKey.trim(), itemKey: itemKey.trim() }
    : null;
}

function cleanPageText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '')
    .replace(/[ \t]+\n/gu, '\n')
    .trim();
}

function countNonWhitespaceCodePoints(text: string): number {
  let count = 0;
  for (const character of text) if (!/\s/u.test(character)) count++;
  return count;
}

function normalizeReadPages(result: PdfReadResult): { pages: BriefSourcePage[]; totalPages: number } | null {
  if (!result || !Array.isArray(result.pages)) return null;
  const pages = result.pages.map((page: PdfReadPage | any) => ({
    page: Number(page?.page ?? page?.pageNumber),
    text: cleanPageText(page?.text),
  }));
  if (pages.some(page => !Number.isSafeInteger(page.page) || page.page <= 0)) return null;
  const unique = new Set(pages.map(page => page.page));
  if (unique.size !== pages.length) return null;
  const declared = Number(result.totalPages ?? 0);
  const totalPages = Number.isSafeInteger(declared) && declared > 0
    ? declared
    : pages.reduce((max, page) => Math.max(max, page.page), 0);
  if (totalPages <= 0 || pages.some(page => page.page > totalPages)) return null;
  const byPage = new Map(pages.map(page => [page.page, page.text]));
  return {
    pages: Array.from({ length: totalPages }, (_, index) => ({
      page: index + 1,
      text: byPage.get(index + 1) || '',
    })),
    totalPages,
  };
}

export class BriefSourceBuilder {
  constructor(private readonly dependencies: BriefSourceBuilderDependencies) {
    if (!dependencies || typeof dependencies.readPdf !== 'function') {
      throw new BriefSourceBuilderError('A PDF reader dependency is required.');
    }
  }

  async build(target: BriefSourceTarget): Promise<BriefSourceBuildResult> {
    if (!target || (!!target.parent === !!target.attachment)) {
      return { status: 'failed', reason: 'invalid_target' };
    }
    let parent: any = target.parent;
    let attachment: any = target.attachment;
    let selectedRead: PdfReadResult | null = null;
    if (attachment !== undefined) {
      if (!isPdf(attachment)) return { status: 'failed', reason: 'not_pdf' };
      parent = parent ?? await this.dependencies.parentOfAttachment?.(attachment);
      if (!parent) return { status: 'failed', reason: 'orphan_attachment' };
    } else {
      if (!isRegular(parent)) return { status: 'failed', reason: 'invalid_parent' };
      attachment = await this.dependencies.selectMainPdf?.(parent);
      // ZoteroAPI's selection result carries both the decision and selected
      // text. The builder intentionally accepts either that object or a raw
      // attachment, keeping the extraction contract narrow for tests/UI.
      if (attachment && 'selectedText' in Object(attachment)) {
        const selected = (attachment as any).selectedText;
        if (!selected) return { status: 'failed', reason: 'no_main_pdf' };
        // ZoteroAPI already extracted the selected attachment in this shape;
        // consuming it avoids a second read and preserves its exact pages.
        if (Array.isArray(selected.pages)) {
          selectedRead = {
            status: selected.status === 'ok'
              ? 'ok'
              : selected.status === 'empty'
                ? 'empty'
                : selected.status === 'failed' ? 'failed' : 'partial',
            attachmentKey: selected.attachmentKey,
            totalPages: selected.pagesTotal ?? undefined,
            complete: selected.status === 'ok',
            pages: selected.pages.map((page: any) => ({
              page: Number(page.page ?? page.pageNumber),
              text: typeof page.text === 'string' ? page.text : '',
            })),
          };
        }
        attachment = (attachment as any).attachment || selected.attachment || { key: selected.attachmentKey };
      }
      if (!attachment) return { status: 'failed', reason: 'no_main_pdf' };
      if (!isPdf(attachment) && !selectedRead) return { status: 'failed', reason: 'no_main_pdf' };
    }
    const identity = identityFromRecord(parent, this.dependencies.identityOf);
    if (!identity) return { status: 'failed', reason: 'unstable_identity' };
    let read: PdfReadResult;
    try { read = selectedRead || await this.dependencies.readPdf(attachment); } catch (error) {
      return { status: 'failed', reason: 'pdf_read_failed', error };
    }
    if (!read || read.status === 'failed' || read.status === 'missing' || read.status === 'unresolved') {
      return { status: 'failed', reason: 'pdf_read_failed', error: read?.error };
    }
    const normalized = normalizeReadPages(read);
    if (!normalized) return { status: 'failed', reason: 'invalid_page_mapping' };

    let pages = normalized.pages;
    let diagnostics: PdfPreprocessResult['diagnostics'] | undefined;
    try {
      const preprocessed = (this.dependencies.preprocess || preprocessPdfPages)(
        pages.map(page => ({ pageNumber: page.page, text: page.text })),
        { documentKey: identity.itemKey },
      );
      pages = preprocessed.pages.map(page => ({ page: page.pageNumber, text: cleanPageText(page.text) }));
      diagnostics = preprocessed.diagnostics;
    } catch (error) {
      return { status: 'failed', reason: 'pdf_preprocess_failed', error };
    }
    const formattedText = pages.map(page => `[PDF p.${page.page}]\n${page.text}`).join('\n\n');
    const textCodePoints = countNonWhitespaceCodePoints(pages.map(page => page.text).join('\n'));
    const totalPages = normalized.totalPages;
    const indexedPages = Number.isSafeInteger(read.indexedPages)
      ? Math.max(0, Number(read.indexedPages))
      : pages.filter(page => page.text.length > 0).length;
    const complete = read.complete === true && pages.length === totalPages;
    const evidence: BriefSourceEvidence = {
      parent: {
        title: field(parent, 'title'),
        abstract: field(parent, 'abstractNote') || field(parent, 'abstract'),
        identity,
        itemKey: identity.itemKey,
        libraryKey: identity.libraryKey,
        value: parent,
      },
      attachment,
      attachmentKey: String((attachment as any)?.key || read.attachmentKey || ''),
      pages,
      formattedText,
      textCodePoints,
      pageCount: pages.length,
      indexedPages,
      totalPages,
      coverage: complete ? 'complete' : 'partial',
      readStatus: String(read.status),
      ...(read.source ? { readSource: read.source } : {}),
      ...(diagnostics ? { preprocess: diagnostics } : {}),
    };
    if (!evidence.attachmentKey.trim()) return { status: 'failed', reason: 'missing_attachment_key' };
    if (textCodePoints < BRIEF_MIN_TEXT_CODE_POINTS) {
      return { status: 'insufficient_text', reason: 'insufficient_text', evidence };
    }
    return { status: 'ready', evidence };
  }
}

export async function buildBriefSource(
  target: BriefSourceTarget,
  dependencies: BriefSourceBuilderDependencies,
): Promise<BriefSourceBuildResult> {
  return new BriefSourceBuilder(dependencies).build(target);
}

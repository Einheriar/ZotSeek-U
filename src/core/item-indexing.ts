import type { IndexingMode } from '../utils/chunker';
import type { PdfExtractionDiagnostic } from './text-extractor';
import type { FreshnessDisplayState } from './index-freshness';
import type { PdfIndexTextSource } from '../utils/zotero-api';

export interface ItemIndexRequest {
  libraryKey: string;
  itemKey: string;
  force?: boolean;
  pdfAttachmentKey?: string;
  /** One-call override for an exact PDF; history never becomes a future default. */
  pdfTextSource?: PdfIndexTextSource;
}

export type ItemIndexOutcome =
  | 'indexed'
  | 'updated'
  | 'unchanged'
  | 'skipped'
  | 'failed'
  | 'busy';

export interface ItemIndexReason {
  code: string;
  message: string;
}

export interface ItemIndexAttempt {
  libraryKey: string;
  itemKey: string;
  modelId: string;
  indexingMode: IndexingMode;
  force: boolean;
  pdfAttachmentKey?: string;
  pdfTextSource?: PdfIndexTextSource;
  outcome: Exclude<ItemIndexOutcome, 'busy'>;
  attemptedAt: string;
  reason?: ItemIndexReason;
  checked: number;
  indexedNew: number;
  rebuilt: number;
  notesUpdated: number;
  unchangedCount: number;
  failedCount: number;
  removed: number;
  pdfDiagnostic?: PdfExtractionDiagnostic;
}

/** Transient response; busy operations are deliberately not persisted. */
export type ItemIndexResult = ItemIndexAttempt | (Omit<ItemIndexAttempt, 'outcome'> & { outcome: 'busy' });

export interface ItemIndexStatus {
  libraryKey: string;
  itemKey: string;
  modelId: string;
  configurationError?: string;
  currentMode: IndexingMode;
  indexedMode: IndexingMode | null;
  indexed: boolean;
  indexedAt: string | null;
  checkedAt: string | null;
  chunkCount: number;
  pagesIndexed: number;
  pagesTotal: number;
  wasTruncated: boolean;
  state: FreshnessDisplayState;
  sources: string[];
  pdfAttachmentKey?: string;
  pdfFreshness: 'not_checked';
  lastAttempt: ItemIndexAttempt | null;
  lastPdfAttempt: ItemPdfAttemptDiagnostic | null;
}

export interface ItemIndexAttemptHistory {
  lastAttempt: ItemIndexAttempt | null;
  lastPdfAttempt: ItemPdfAttemptDiagnostic | null;
}

export interface ItemPdfAttemptDiagnostic {
  libraryKey: string;
  itemKey: string;
  modelId: string;
  indexingMode: IndexingMode;
  attemptedAt: string;
  pdfAttachmentKey?: string;
  pdfTextSource?: PdfIndexTextSource;
  outcome: ItemIndexAttempt['outcome'];
  reason?: ItemIndexReason;
  pdfDiagnostic: PdfExtractionDiagnostic;
}

export interface ItemAttemptMetadataStore {
  getMetadata(key: string): Promise<unknown>;
  setMetadata(key: string, value: unknown): Promise<void>;
}

const ITEM_ATTEMPT_KEY_PREFIX = 'item_index_attempt_v1';

export function itemIndexAttemptMetadataKey(
  libraryKey: string,
  itemKey: string,
  modelId: string,
): string {
  return [ITEM_ATTEMPT_KEY_PREFIX, libraryKey, itemKey, modelId]
    .map(part => encodeURIComponent(part))
    .join(':');
}

export async function readItemIndexAttempt(
  store: ItemAttemptMetadataStore,
  libraryKey: string,
  itemKey: string,
  modelId: string,
): Promise<ItemIndexAttemptHistory> {
  const value = await store.getMetadata(itemIndexAttemptMetadataKey(libraryKey, itemKey, modelId));
  if (!value || typeof value !== 'object') return { lastAttempt: null, lastPdfAttempt: null };
  const history = value as ItemIndexAttemptHistory;
  const isMatchingAttempt = (attempt: ItemIndexAttempt | null | undefined): attempt is ItemIndexAttempt =>
    !!attempt && attempt.libraryKey === libraryKey && attempt.itemKey === itemKey && attempt.modelId === modelId;
  const pdfAttempt = history.lastPdfAttempt as ItemPdfAttemptDiagnostic | null | undefined;
  return {
    lastAttempt: isMatchingAttempt(history.lastAttempt) ? history.lastAttempt : null,
    lastPdfAttempt: pdfAttempt && pdfAttempt.libraryKey === libraryKey &&
        pdfAttempt.itemKey === itemKey && pdfAttempt.modelId === modelId && pdfAttempt.pdfDiagnostic
      ? pdfAttempt
      : null,
  };
}

export async function writeItemIndexAttempt(
  store: ItemAttemptMetadataStore,
  attempt: ItemIndexAttempt,
): Promise<void> {
  const key = itemIndexAttemptMetadataKey(attempt.libraryKey, attempt.itemKey, attempt.modelId);
  const previous = await readItemIndexAttempt(store, attempt.libraryKey, attempt.itemKey, attempt.modelId);
  const lastPdfAttempt = attempt.pdfDiagnostic ? {
    libraryKey: attempt.libraryKey,
    itemKey: attempt.itemKey,
    modelId: attempt.modelId,
    indexingMode: attempt.indexingMode,
    attemptedAt: attempt.attemptedAt,
    ...(attempt.pdfAttachmentKey ? { pdfAttachmentKey: attempt.pdfAttachmentKey } : {}),
    ...(attempt.pdfTextSource ? { pdfTextSource: attempt.pdfTextSource } : {}),
    outcome: attempt.outcome,
    ...(attempt.reason ? { reason: attempt.reason } : {}),
    pdfDiagnostic: attempt.pdfDiagnostic,
  } satisfies ItemPdfAttemptDiagnostic : previous.lastPdfAttempt;
  await store.setMetadata(key, {
    lastAttempt: attempt,
    lastPdfAttempt,
  } satisfies ItemIndexAttemptHistory);
}

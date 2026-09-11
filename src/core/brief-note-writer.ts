/** Transactional, write-only Child Note boundary for literature briefs. */

import {
  appendBriefNoteProvenance,
  type BriefNoteProvenanceInput,
} from './brief-note-provenance';
import { markdownToSafeHtml } from './brief-markdown';
import type { BriefSourceEvidence } from './brief-source-builder';
import type { StableIdentity } from './identity-resolver';

export const BRIEF_NOTE_TITLE = '简报';

export interface BriefNoteHandle {
  /** Zotero Note wrappers expose additional runtime fields used by tests/UI. */
  [key: string]: unknown;
  id?: number;
  setNote?: (html: string) => void;
  saveTx?: () => Promise<unknown>;
  note?: string;
}

export interface BriefNoteWriteCheck {
  parent?: unknown;
  identity?: StableIdentity | null;
  writable?: boolean;
  attachmentBelongs?: boolean;
  hasChildNotes?: boolean;
}

export interface BriefNoteWriterDependencies {
  /** Must allocate an uncommitted new Child Note; it must never update a Note. */
  createChildNote: (parent: unknown) => BriefNoteHandle | Promise<BriefNoteHandle>;
  commitNote?: (note: BriefNoteHandle) => Promise<unknown>;
  setNoteContent?: (note: BriefNoteHandle, html: string) => void;
  /** Runs against current Zotero state immediately before allocation/commit. */
  recheck?: (input: BriefNoteWriteInput, phase: 'before-create' | 'before-commit') => BriefNoteWriteCheck | Promise<BriefNoteWriteCheck>;
  identityOf?: (parent: unknown) => StableIdentity | null | undefined;
  hasAnyChildNotes?: (parent: unknown) => boolean | Promise<boolean>;
  canWrite?: (parent: unknown) => boolean | Promise<boolean>;
  rollbackNote?: (note: BriefNoteHandle) => void | Promise<void>;
}

export interface BriefNoteWriteInput {
  parent: unknown;
  evidence: BriefSourceEvidence;
  markdown: string;
  provider: string;
  model: string;
  classification: 'review' | 'standard';
  promptSlot: 'review' | 'standard';
  promptHash: string;
  pipelineVersion: number;
  generatedAt?: string;
  signal?: AbortSignal;
  cancellation?: { aborted: boolean };
  /** Collection jobs set this false; single-item jobs may set it true after confirmation. */
  allowExistingNotes?: boolean;
}

export class BriefNoteWriterError extends Error {
  readonly code = 'BRIEF_NOTE_WRITER_ERROR' as const;
  constructor(message: string) {
    super(message);
    this.name = 'BriefNoteWriterError';
  }
}

export class BriefNoteWriteCancelledError extends Error {
  readonly code = 'BRIEF_GENERATION_CANCELLED' as const;
  constructor() {
    super('Brief Note writing was cancelled.');
    this.name = 'BriefNoteWriteCancelledError';
  }
}

function cancelled(input: BriefNoteWriteInput): boolean {
  return input.signal?.aborted === true || input.cancellation?.aborted === true;
}

function checkCancelled(input: BriefNoteWriteInput): void {
  if (cancelled(input)) throw new BriefNoteWriteCancelledError();
}

function sameIdentity(left: StableIdentity | null | undefined, right: StableIdentity): boolean {
  return !!left && left.libraryKey === right.libraryKey && left.itemKey === right.itemKey;
}

function localParentIsUsable(parent: any): boolean {
  if (!parent || parent.deleted === true || parent.isDeleted?.() === true) return false;
  if (typeof parent.isRegularItem === 'function') return parent.isRegularItem() === true;
  return parent.itemType !== 'attachment' && parent.itemType !== 'note' && parent.parentID == null;
}

function attachmentBelongsToParent(evidence: BriefSourceEvidence, parent: any): boolean {
  const attachment: any = evidence.attachment;
  if (!attachment) return false;
  if (attachment.parentID != null && parent?.id != null) return Number(attachment.parentID) === Number(parent.id);
  if (attachment.parentKey && parent?.key) return attachment.parentKey === parent.key;
  // A production recheck should provide an ownership check. Structural fakes
  // often do not expose parentID, so absence of both fields is inconclusive.
  return true;
}

export class BriefNoteWriter {
  constructor(private readonly dependencies: BriefNoteWriterDependencies) {
    if (!dependencies || typeof dependencies.createChildNote !== 'function') {
      throw new BriefNoteWriterError('A Child Note factory dependency is required.');
    }
  }

  private async check(input: BriefNoteWriteInput, phase: 'before-create' | 'before-commit'): Promise<BriefNoteWriteCheck> {
    const result = await this.dependencies.recheck?.(input, phase) || {};
    const parent = result.parent ?? input.parent;
    if (!localParentIsUsable(parent)) throw new BriefNoteWriterError('The brief parent item is no longer writable.');
    const expected = input.evidence.parent.identity;
    const actual = result.identity ?? this.dependencies.identityOf?.(parent) ?? (parent as any)?.identity;
    if (actual && !sameIdentity(actual, expected)) throw new BriefNoteWriterError('The brief parent identity changed.');
    if (result.writable === false) throw new BriefNoteWriterError('The brief parent library is not writable.');
    if (this.dependencies.canWrite && !(await this.dependencies.canWrite(parent))) {
      throw new BriefNoteWriterError('The brief parent library is not writable.');
    }
    if (result.attachmentBelongs === false || !attachmentBelongsToParent(input.evidence, parent)) {
      throw new BriefNoteWriterError('The selected PDF no longer belongs to the brief parent.');
    }
    const hasNotes = result.hasChildNotes ?? await this.dependencies.hasAnyChildNotes?.(parent);
    if (hasNotes === true && input.allowExistingNotes !== true) {
      throw new BriefNoteWriterError('The brief parent already has a Child Note.');
    }
    return { ...result, parent, identity: actual || expected, hasChildNotes: hasNotes };
  }

  async write(input: BriefNoteWriteInput): Promise<BriefNoteHandle> {
    if (!input || !input.evidence?.parent?.identity || input.classification !== input.promptSlot) {
      throw new BriefNoteWriterError('Brief Note write input is invalid.');
    }
    checkCancelled(input);
    const body = markdownToSafeHtml(input.markdown);
    const provenance: BriefNoteProvenanceInput = {
      generatedAt: input.generatedAt || new Date().toISOString(),
      provider: input.provider,
      model: input.model,
      classification: input.classification,
      promptHash: input.promptHash,
      pipelineVersion: input.pipelineVersion,
      pdfAttachmentKey: input.evidence.attachmentKey,
      pageCount: input.evidence.pageCount,
      libraryKey: input.evidence.parent.libraryKey,
      totalPages: input.evidence.totalPages,
      indexedPages: input.evidence.indexedPages,
      coverage: input.evidence.coverage,
      promptSlot: input.promptSlot,
    };
    const html = appendBriefNoteProvenance(`<h1>${BRIEF_NOTE_TITLE}</h1>\n${body}`, provenance);
    const first = await this.check(input, 'before-create');
    checkCancelled(input);
    let note: BriefNoteHandle | null = null;
    try {
      note = await this.dependencies.createChildNote(first.parent);
      if (!note || typeof note !== 'object') throw new BriefNoteWriterError('Child Note factory returned no Note.');
      // Recheck after allocation closes the race where a PDF is reparented or
      // another process creates a Child Note while this transaction is open.
      await this.check(input, 'before-commit');
      checkCancelled(input);
      if (this.dependencies.setNoteContent) this.dependencies.setNoteContent(note, html);
      else if (typeof note.setNote === 'function') note.setNote(html);
      else note.note = html;
      checkCancelled(input);
      const commit = this.dependencies.commitNote || (async (value: BriefNoteHandle) => {
        if (typeof value.saveTx !== 'function') throw new BriefNoteWriterError('Note commit dependency is unavailable.');
        return value.saveTx();
      });
      // There is no cancellable gap between this check and commit invocation;
      // once commit starts, a successful transaction is counted as success.
      checkCancelled(input);
      await commit(note);
      return note;
    } catch (error) {
      if (note && this.dependencies.rollbackNote) {
        try { await this.dependencies.rollbackNote(note); } catch { /* best effort */ }
      }
      throw error;
    }
  }
}

export async function writeBriefNote(
  input: BriefNoteWriteInput,
  dependencies: BriefNoteWriterDependencies,
): Promise<BriefNoteHandle> {
  return new BriefNoteWriter(dependencies).write(input);
}

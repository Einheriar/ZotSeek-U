/** Machine-readable audit metadata embedded in a generated Child Note. */

import type { BriefPaperKind } from './brief-paper-classifier';

export const BRIEF_NOTE_PROVENANCE_SCHEMA_VERSION = 1;
export const BRIEF_NOTE_PROVENANCE_MARKER = 'zotseek-brief-provenance';

export interface BriefNoteProvenance {
  schemaVersion: typeof BRIEF_NOTE_PROVENANCE_SCHEMA_VERSION;
  generator: 'zotseek';
  generatedAt: string;
  provider: string;
  model: string;
  classification: BriefPaperKind;
  promptHash: string;
  pipelineVersion: number;
  pdfAttachmentKey: string;
  pageCount: number;
}

export type BriefNoteProvenanceInput = Omit<
  BriefNoteProvenance,
  'schemaVersion' | 'generator'
>;

export class BriefNoteProvenanceError extends Error {
  readonly code = 'BRIEF_NOTE_PROVENANCE_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'BriefNoteProvenanceError';
  }
}

function validate(value: any): BriefNoteProvenance {
  if (!value || value.schemaVersion !== BRIEF_NOTE_PROVENANCE_SCHEMA_VERSION ||
      value.generator !== 'zotseek' ||
      typeof value.generatedAt !== 'string' || !Number.isFinite(Date.parse(value.generatedAt)) ||
      typeof value.provider !== 'string' || !value.provider.trim() ||
      typeof value.model !== 'string' || !value.model.trim() ||
      (value.classification !== 'review' && value.classification !== 'standard') ||
      typeof value.promptHash !== 'string' || !/^[0-9a-f]{64}$/.test(value.promptHash) ||
      !Number.isSafeInteger(value.pipelineVersion) || value.pipelineVersion <= 0 ||
      typeof value.pdfAttachmentKey !== 'string' || !value.pdfAttachmentKey.trim() ||
      !Number.isSafeInteger(value.pageCount) || value.pageCount <= 0) {
    throw new BriefNoteProvenanceError('Literature-brief provenance is invalid.');
  }
  return {
    schemaVersion: BRIEF_NOTE_PROVENANCE_SCHEMA_VERSION,
    generator: 'zotseek',
    generatedAt: value.generatedAt,
    provider: value.provider,
    model: value.model,
    classification: value.classification,
    promptHash: value.promptHash,
    pipelineVersion: value.pipelineVersion,
    pdfAttachmentKey: value.pdfAttachmentKey,
    pageCount: value.pageCount,
  };
}

function commentSafeJson(value: BriefNoteProvenance): string {
  // HTML comments cannot contain "--". JSON escapes preserve the original
  // value after parsing while keeping article/model text out of comment syntax.
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/--/g, '\\u002d\\u002d');
}

export function createBriefNoteProvenance(
  input: BriefNoteProvenanceInput,
): BriefNoteProvenance {
  return validate({
    schemaVersion: BRIEF_NOTE_PROVENANCE_SCHEMA_VERSION,
    generator: 'zotseek',
    ...input,
  });
}

export function serializeBriefNoteProvenance(input: BriefNoteProvenanceInput): string {
  const provenance = createBriefNoteProvenance(input);
  return `<!-- ${BRIEF_NOTE_PROVENANCE_MARKER} ${commentSafeJson(provenance)} -->`;
}

/** Append provenance after already-sanitized Note HTML. */
export function appendBriefNoteProvenance(
  noteHtml: string,
  input: BriefNoteProvenanceInput,
): string {
  if (!noteHtml.trim()) {
    throw new BriefNoteProvenanceError('Literature-brief Note HTML must not be empty.');
  }
  return `${noteHtml.trim()}\n${serializeBriefNoteProvenance(input)}`;
}

export function parseBriefNoteProvenance(noteHtml: string): BriefNoteProvenance | null {
  const marker = `<!-- ${BRIEF_NOTE_PROVENANCE_MARKER} `;
  const start = noteHtml.lastIndexOf(marker);
  if (start < 0) return null;
  const jsonStart = start + marker.length;
  const end = noteHtml.indexOf(' -->', jsonStart);
  if (end < 0) return null;
  try {
    return validate(JSON.parse(noteHtml.slice(jsonStart, end)));
  } catch {
    return null;
  }
}

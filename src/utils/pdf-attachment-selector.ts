import type { PageText } from './chunker';

export const PDF_ATTACHMENT_SELECTOR_ID = 'plan11c-attachment-selector-v1';
export const PDF_ATTACHMENT_SELECTOR_VERSION = '1.0.1';
export const PDF_ATTACHMENT_SELECTOR_FEATURES =
  'filename-boundaries+first-two-pages+title-overlap+group-page-containment';

export type PdfAttachmentRole = 'main' | 'supplement' | 'unknown';
export type PdfAttachmentTextStatus = 'ok' | 'degraded' | 'empty' | 'failed';
export type PdfAttachmentComposition =
  | 'main'
  | 'supplement'
  | 'correction'
  | 'main-with-commentaries'
  | 'main-with-annex'
  | 'unresolved'
  | 'unavailable';

export interface PdfAttachmentText {
  attachmentId: number;
  attachmentKey: string;
  fileName?: string;
  pagesTotal: number | null;
  pages: PageText[];
  status: PdfAttachmentTextStatus;
}
export interface PdfAttachmentPrediction {
  attachmentId: number;
  attachmentKey: string;
  pagesTotal: number | null;
  parserStatus: PdfAttachmentTextStatus;
  role: PdfAttachmentRole;
  confidence: number;
  documentComposition: PdfAttachmentComposition;
  reasons: string[];
  indexPolicy: 'eligible' | 'exclude';
}

export type PdfAttachmentAbstainReason =
  | 'multiple-main'
  | 'missing-pdf'
  | 'unavailable'
  | 'no-main';

export interface PdfAttachmentSelection {
  selectorId: typeof PDF_ATTACHMENT_SELECTOR_ID;
  selectorVersion: typeof PDF_ATTACHMENT_SELECTOR_VERSION;
  featuresRevision: typeof PDF_ATTACHMENT_SELECTOR_FEATURES;
  decision: 'selected-main' | 'abstain';
  selectedAttachmentId: number | null;
  selectedAttachmentKey: string | null;
  selectedBy: 'role-and-confidence' | null;
  abstainReason: PdfAttachmentAbstainReason | null;
  predictions: PdfAttachmentPrediction[];
}

const supplementFilename =
  /(?:^|[._-])(?:supp(?:lement(?:ary|al)?)?|sm|som|moesm\d*|esm|mmc\d*|additional[._ -]?file)(?:[._ -]|$)/iu;
const supplementText =
  /(?:^|\n)\s*(?:supplementary|supplemental|supporting\s+(?:online\s+)?(?:material|materials|information))(?:\s+(?:information|materials?|methods?|figures?|tables?|text))?\b/imu;
const mainText =
  /(?:^|\n)\s*(?:research\s+article|original\s+research|empirical\s+article|article|articles|report|abstract|introduction)\b/imu;
const correctionText = /(?:^|\n)\s*(?:correction|erratum|retraction)(?:\s+to)?\b/imu;
const commentaryText = /\b(?:open\s+peer\s+commentary|authors?[’']?\s+response)\b/iu;

function normalizeSelectorText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\u00ad]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function textTokens(text: string): Set<string> {
  return new Set(normalizeSelectorText(text).match(/[\p{L}\p{N}]{3,}/gu) ?? []);
}

function titleCoverage(parentTitle: string, sample: string): number {
  const titleTokens = textTokens(parentTitle);
  if (titleTokens.size === 0) return 0;
  const sampleTokens = textTokens(sample);
  return [...titleTokens].filter(token => sampleTokens.has(token)).length / titleTokens.size;
}

function pageTexts(attachment: PdfAttachmentText): string[] {
  return attachment.pages.map(page => normalizeSelectorText(page.text));
}

function equalsPageConcatenation(
  candidate: PdfAttachmentText,
  first: PdfAttachmentText,
  second: PdfAttachmentText,
): boolean {
  const all = pageTexts(candidate);
  const left = pageTexts(first);
  const right = pageTexts(second);
  return all.length === left.length + right.length &&
    all.every((value, index) => value === (
      index < left.length ? left[index] : right[index - left.length]
    ));
}

function classifyPdfAttachment(
  parentTitle: string,
  attachment: PdfAttachmentText,
  siblings: PdfAttachmentText[],
): Omit<PdfAttachmentPrediction, 'attachmentId' | 'attachmentKey' | 'pagesTotal' | 'parserStatus' | 'indexPolicy'> {
  const firstTwoPages = attachment.pages.slice(0, 2).map(page => page.text);
  const firstTwo = firstTwoPages.join('\n');
  const fullText = attachment.pages.map(page => page.text).join('\n');
  const reasons: string[] = [];

  if (firstTwoPages.some(text => correctionText.test(text.slice(0, 800)))) {
    return {
      role: 'unknown',
      confidence: 0.99,
      documentComposition: 'correction',
      reasons: ['first-pages:correction'],
    };
  }
  if (commentaryText.test(fullText)) {
    return {
      role: 'unknown',
      confidence: 0.99,
      documentComposition: 'main-with-commentaries',
      reasons: ['full-text:commentary-or-author-response'],
    };
  }
  for (const left of siblings) {
    for (const right of siblings) {
      if (left.attachmentKey === right.attachmentKey) continue;
      if (equalsPageConcatenation(attachment, left, right)) {
        return {
          role: 'unknown',
          confidence: 0.99,
          documentComposition: 'main-with-annex',
          reasons: [`page-containment:${left.attachmentKey}+${right.attachmentKey}`],
        };
      }
    }
  }

  const fileName = attachment.fileName ?? '';
  const filenameSupplement = supplementFilename.test(fileName);
  const textSupplement = firstTwoPages.some(text => supplementText.test(text.slice(0, 1000)));
  const coverage = titleCoverage(parentTitle, firstTwo);
  const articleStructure = mainText.test(firstTwo);
  if (filenameSupplement) reasons.push('filename:supplement-token');
  if (textSupplement) reasons.push('first-pages:supplement-heading');
  if (coverage >= 0.55) reasons.push(`title-overlap:${coverage.toFixed(2)}`);
  if (articleStructure) reasons.push('first-pages:article-structure');

  if (textSupplement && !(coverage >= 0.7 && articleStructure)) {
    return { role: 'supplement', confidence: 0.99, documentComposition: 'supplement', reasons };
  }
  if (filenameSupplement && textSupplement) {
    return { role: 'supplement', confidence: 0.99, documentComposition: 'supplement', reasons };
  }
  if ((coverage >= 0.55 && articleStructure) || (coverage >= 0.75 && !textSupplement)) {
    return {
      role: 'main',
      confidence: coverage >= 0.8 ? 0.99 : 0.9,
      documentComposition: 'main',
      reasons,
    };
  }
  if (articleStructure && !textSupplement) {
    return { role: 'main', confidence: 0.8, documentComposition: 'main', reasons };
  }
  return {
    role: 'unknown',
    confidence: 0.55,
    documentComposition: 'unresolved',
    reasons: reasons.length > 0 ? reasons : ['insufficient-evidence'],
  };
}

/**
 * Select exactly one high-confidence main PDF using the frozen Plan 11C rules.
 * Every attachment is already a PDFWorker-direct result, so callers can reuse
 * the selected pages instead of extracting the chosen PDF a second time.
 */
export function selectMainPdfAttachment(
  parentTitle: string,
  attachments: readonly PdfAttachmentText[],
): PdfAttachmentSelection {
  const available = attachments.filter(attachment => attachment.status !== 'failed');
  const predictions = attachments.map((attachment): PdfAttachmentPrediction => {
    if (attachment.status === 'failed') {
      return {
        attachmentId: attachment.attachmentId,
        attachmentKey: attachment.attachmentKey,
        pagesTotal: attachment.pagesTotal,
        parserStatus: attachment.status,
        role: 'unknown',
        confidence: 0,
        documentComposition: 'unavailable',
        reasons: ['direct-artifact:missing-or-failed'],
        indexPolicy: 'exclude',
      };
    }
    const classification = classifyPdfAttachment(parentTitle, attachment, available);
    return {
      attachmentId: attachment.attachmentId,
      attachmentKey: attachment.attachmentKey,
      pagesTotal: attachment.pagesTotal,
      parserStatus: attachment.status,
      ...classification,
      indexPolicy: classification.role === 'main' ? 'eligible' : 'exclude',
    };
  });
  const mains = predictions.filter(prediction =>
    prediction.role === 'main' && prediction.confidence >= 0.8
  );
  const selected = mains.length === 1 ? mains[0] : null;
  const abstainReason: PdfAttachmentAbstainReason | null = selected
    ? null
    : mains.length > 1
      ? 'multiple-main'
      : attachments.length === 0
        ? 'missing-pdf'
        : predictions.every(prediction => prediction.parserStatus === 'failed')
          ? 'unavailable'
          : 'no-main';

  return {
    selectorId: PDF_ATTACHMENT_SELECTOR_ID,
    selectorVersion: PDF_ATTACHMENT_SELECTOR_VERSION,
    featuresRevision: PDF_ATTACHMENT_SELECTOR_FEATURES,
    decision: selected ? 'selected-main' : 'abstain',
    selectedAttachmentId: selected?.attachmentId ?? null,
    selectedAttachmentKey: selected?.attachmentKey ?? null,
    selectedBy: selected ? 'role-and-confidence' : null,
    abstainReason,
    predictions,
  };
}

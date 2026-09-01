import type { PageText } from './chunker';

export const PDF_REFERENCE_REGION_STRATEGY_ID =
  'zotseek-pdfworker-direct-reference-regions-v2';
export const PDF_REFERENCE_REGION_STRATEGY_VERSION = '2.0.0-rc.1';
export const PDF_PAGE_FURNITURE_STRATEGY_ID = 'pdf-repeated-page-furniture-v1';
export const PDF_PAGE_FURNITURE_STRATEGY_VERSION = '1.0.0';

export type PdfReferenceRegionFiltering = 'v2' | 'off';
export type PdfPageFurnitureFiltering = 'v1' | 'off';

export interface PdfPreprocessOptions {
  pdfReferenceRegionFiltering?: PdfReferenceRegionFiltering;
  pdfPageFurnitureFiltering?: PdfPageFurnitureFiltering;
  /** Stable parent item key used only for deterministic diagnostic group IDs. */
  documentKey?: string;
}

export interface PdfPreprocessedPage extends PageText {
  pdfReferenceRegionStrategyId?: string;
  pdfPageFurnitureStrategyId?: string;
}

export interface PdfIgnoredBlock {
  pageNumber: number;
  /** Zero-based source line in the component input page. */
  sourceLine: number;
  sourceLineEnd?: number;
  text: string;
  role: 'reference-heading' | 'reference' | 'page-furniture';
  strategyId: string;
  strategyVersion: string;
  reason: string;
  groupId?: string;
  band?: 'top' | 'bottom';
}

export interface PdfReferenceRegionDiagnostic {
  regionId: string;
  startPage: number;
  startLine: number;
  startHeading: string;
  startEvidenceScore: number;
  endPage: number | null;
  endLine: number | null;
  endReason: 'eof' | 'post-reference-heading' | 'figure-or-table-heading';
}

export interface PdfPageFurnitureGroupDiagnostic {
  groupId: string;
  band: 'top' | 'bottom';
  signature: string;
  signatureKind: 'page-number' | 'text';
  distinctPages: number[];
  distinctPageCount: number;
  evaluablePageCount: number;
  coverage: number;
  variants: string[];
  maxChars: number;
  maxWords: number;
  sequenceVerified: boolean;
  bandOverlap: boolean;
  tableContext: boolean;
  numericSymbolDense: boolean;
  ignoredByDefault: boolean;
  decisionReason: string;
}

export interface PdfPreprocessDiagnostics {
  referenceMode: PdfReferenceRegionFiltering;
  pageFurnitureMode: PdfPageFurnitureFiltering;
  referenceStrategyId: typeof PDF_REFERENCE_REGION_STRATEGY_ID;
  referenceStrategyVersion: typeof PDF_REFERENCE_REGION_STRATEGY_VERSION;
  pageFurnitureStrategyId: typeof PDF_PAGE_FURNITURE_STRATEGY_ID;
  pageFurnitureStrategyVersion: typeof PDF_PAGE_FURNITURE_STRATEGY_VERSION;
  referenceRegions: PdfReferenceRegionDiagnostic[];
  referenceRegionCount: number;
  ignoredReferenceBlockCount: number;
  referencePageFurnitureBlockCount: number;
  pageFurnitureGroups: PdfPageFurnitureGroupDiagnostic[];
  pageFurnitureCandidateGroupCount: number;
  ignoredPageFurnitureGroupCount: number;
  protectedPageFurnitureGroupCount: number;
  ignoredPageFurnitureLineCount: number;
  pageOneProtectedLineCount: number;
  affectedPageCount: number;
  ignoredPageFurnitureChars: number;
  pageSlotsPreserved: boolean;
}

export interface PdfPreprocessResult {
  pages: PdfPreprocessedPage[];
  ignoredBlocks: PdfIgnoredBlock[];
  diagnostics: PdfPreprocessDiagnostics;
}

/** Prevent References v2 output from being filtered again by legacy chunker rules. */
export function assertPdfReferencePipelineModes(
  referenceMode: PdfReferenceRegionFiltering,
  legacyMode: 'legacy' | 'off' | undefined,
): void {
  if (referenceMode === 'v2' && legacyMode !== 'off') {
    throw new Error('References v2 requires pdfReferenceFiltering=off');
  }
}

interface ClassifiedLine {
  pageNumber: number;
  lineIndex: number;
  text: string;
  role: 'body' | 'reference-heading' | 'reference' | 'page-furniture';
  ignoredByDefault: boolean;
  regionId: string | null;
}

interface ReferenceBlock {
  text: string;
  role: ClassifiedLine['role'];
  ignoredByDefault: boolean;
  sourceLineStart: number;
  sourceLineEnd: number;
  regionId: string | null;
}

interface FurnitureLineRecord {
  raw: string;
  trimmed: string;
  rawLineIndex: number;
  nonEmptyIndex: number;
}

interface FurnitureOccurrence extends FurnitureLineRecord {
  pageNumber: number;
  band: 'top' | 'bottom';
  bandIndex: number;
  signature: string;
  signatureKind: 'page-number' | 'text';
}

interface FurniturePage extends PdfPreprocessedPage {
  lines: {
    rawLines: string[];
    nonEmpty: FurnitureLineRecord[];
  };
}

interface FurnitureGroup extends PdfPageFurnitureGroupDiagnostic {
  occurrences: FurnitureOccurrence[];
}

const DEFAULT_FURNITURE_OPTIONS = Object.freeze({
  topBottomLineCount: 3,
  minRepeatPages: 3,
  minPageCoverage: 0.5,
  maxTextChars: 120,
  maxTextWords: 16,
  tableContextRadius: 3,
  protectPageOneText: true,
});

function splitLines(text: string): string[] {
  return String(text ?? '').replace(/\r\n?/gu, '\n').split('\n');
}

function isReferenceHeading(line: string): boolean {
  return /^(?:(?:(?:supplemental|supplementary|supporting)\s+)?(?:references|bibliography)|参考文献)\s*[:：]?$/iu
    .test(line.trim());
}

function isPostReferenceHeading(line: string): boolean {
  return /^(?:abstract|supplemental experimental procedures|supplementary (?:methods?|materials?|results?|information)|appendix(?:\s+[a-z\d]+)?|acknowledg(?:e)?ments?|funding(?: sources)?|author contributions?|additional information|competing interests?|conflict of interest(?: statement)?|data availability|code availability|publisher['’]s note|open access|copyright)\s*[:：]?$/iu
    .test(line.trim());
}

function isCaptionHeading(line: string): boolean {
  return /^(?:fig(?:ure)?\.?\s*[s\d]+|table\s*[s\d]+|图\s*[s\d一二三四五六七八九十]+|表\s*[s\d一二三四五六七八九十]+)\b/iu
    .test(line.trim());
}

function isStrongReferencePageFurniture(line: string): boolean {
  const text = line.trim();
  return /Downloaded from .*Wiley Online Library/iu.test(text) ||
    /ProQuest Terms and Conditions/iu.test(text) ||
    /Creative Commons Licen[cs]e/iu.test(text) ||
    /^\|\s*\d{1,4}\s*\|?$/u.test(text) ||
    /^(?:doi\s*:|https?:\/\/doi\.org\/).*(?:published|received|accepted|open)/iu.test(text);
}

function referenceEvidence(line: string): { score: number; hasCitationCore: boolean } {
  const text = line.trim();
  if (!text) return { score: 0, hasCitationCore: false };
  const years = text.match(/\b(?:18|19|20)\d{2}[a-z]?\b/giu) ?? [];
  const numbered = /^\s*(?:\[?\d{1,4}\]?\s*[.)]|\d{1,4}\s+)/u.test(text);
  const doi = /\b(?:doi\s*:|https?:\/\/(?:dx\.)?doi\.org\/|10\.\d{4,9}\/)/iu.test(text);
  const author = /(?:\bet\s+al\.|\b(?:and|&)\s+[\p{L}'’.-]+(?:,|\s*\())/iu.test(text);
  const journal = /\b(?:vol\.?|volume|journal|proceedings|press|university|pp?\.?\s*\d|\d+\s*\(\d+\)\s*,\s*\d)/iu.test(text);
  const score = Math.min(2, years.length) + Number(numbered) + Number(doi) +
    Number(author) + Number(journal);
  return { score, hasCitationCore: years.length > 0 || numbered || doi };
}

function followingEvidence(
  flatLines: Array<{ text: string }>,
  at: number,
  limit = 10,
): { score: number; citationLines: number } {
  const evidence: Array<{ score: number; hasCitationCore: boolean }> = [];
  for (let index = at + 1; index < flatLines.length && evidence.length < limit; index++) {
    const text = flatLines[index].text.trim();
    if (!text) continue;
    evidence.push(referenceEvidence(text));
  }
  return {
    score: evidence.reduce((sum, item) => sum + item.score, 0),
    citationLines: evidence.filter(item => item.hasCitationCore).length,
  };
}

function coalesceReferenceLines(classified: ClassifiedLine[]): ReferenceBlock[] {
  const blocks: ReferenceBlock[] = [];
  for (const item of classified) {
    if (!item.text.trim()) continue;
    const previous = blocks[blocks.length - 1];
    if (previous && previous.role === item.role &&
        previous.ignoredByDefault === item.ignoredByDefault &&
        previous.regionId === item.regionId) {
      previous.text += `\n${item.text}`;
      previous.sourceLineEnd = item.lineIndex;
      continue;
    }
    blocks.push({
      text: item.text,
      role: item.role,
      ignoredByDefault: item.ignoredByDefault,
      sourceLineStart: item.lineIndex,
      sourceLineEnd: item.lineIndex,
      regionId: item.regionId,
    });
  }
  return blocks;
}

function applyReferenceRegionsV2(pages: readonly PdfPreprocessedPage[]): {
  pages: PdfPreprocessedPage[];
  ignoredBlocks: PdfIgnoredBlock[];
  regions: PdfReferenceRegionDiagnostic[];
  ignoredReferenceBlockCount: number;
  referencePageFurnitureBlockCount: number;
} {
  if (pages.length > 0 && pages.every(page =>
    page.pdfReferenceRegionStrategyId === PDF_REFERENCE_REGION_STRATEGY_ID
  )) {
    return {
      pages: pages.map(page => ({ ...page })),
      ignoredBlocks: [],
      regions: [],
      ignoredReferenceBlockCount: 0,
      referencePageFurnitureBlockCount: 0,
    };
  }

  const flatLines = pages.flatMap(page => splitLines(page.text).map((text, lineIndex) => ({
    pageNumber: page.pageNumber,
    lineIndex,
    text,
  })));
  const classifiedByPage = new Map<number, ClassifiedLine[]>(
    pages.map(page => [page.pageNumber, []])
  );
  const regions: PdfReferenceRegionDiagnostic[] = [];
  let activeRegion: PdfReferenceRegionDiagnostic | null = null;

  for (let index = 0; index < flatLines.length; index++) {
    const item = flatLines[index];
    const text = item.text.trim();
    let classified: ClassifiedLine = {
      ...item,
      role: 'body',
      ignoredByDefault: false,
      regionId: null,
    };
    if (!activeRegion && isReferenceHeading(text)) {
      const evidence = followingEvidence(flatLines, index);
      const pageFraction = item.pageNumber / Math.max(1, pages.length);
      if (pageFraction >= 0.35 && evidence.score >= 3 && evidence.citationLines >= 1) {
        activeRegion = {
          regionId: `r${regions.length + 1}`,
          startPage: item.pageNumber,
          startLine: item.lineIndex,
          startHeading: text,
          startEvidenceScore: evidence.score,
          endPage: null,
          endLine: null,
          endReason: 'eof',
        };
        regions.push(activeRegion);
        classified = {
          ...item,
          role: 'reference-heading',
          ignoredByDefault: true,
          regionId: activeRegion.regionId,
        };
      }
    } else if (activeRegion) {
      const exitReason = isPostReferenceHeading(text)
        ? 'post-reference-heading' as const
        : isCaptionHeading(text) && followingEvidence(flatLines, index, 5).score < 3
          ? 'figure-or-table-heading' as const
          : null;
      if (exitReason) {
        activeRegion.endPage = item.pageNumber;
        activeRegion.endLine = item.lineIndex;
        activeRegion.endReason = exitReason;
        activeRegion = null;
      } else if (isStrongReferencePageFurniture(text)) {
        classified = {
          ...item,
          role: 'page-furniture',
          ignoredByDefault: true,
          regionId: activeRegion.regionId,
        };
      } else {
        classified = {
          ...item,
          role: 'reference',
          ignoredByDefault: true,
          regionId: activeRegion.regionId,
        };
      }
    }
    classifiedByPage.get(item.pageNumber)?.push(classified);
  }

  const ignoredBlocks: PdfIgnoredBlock[] = [];
  let ignoredReferenceBlockCount = 0;
  let referencePageFurnitureBlockCount = 0;
  const outputPages = pages.map(page => {
    const blocks = coalesceReferenceLines(classifiedByPage.get(page.pageNumber) ?? []);
    for (const block of blocks) {
      if (!block.ignoredByDefault || block.role === 'body') continue;
      if (block.role === 'page-furniture') referencePageFurnitureBlockCount++;
      else ignoredReferenceBlockCount++;
      ignoredBlocks.push({
        pageNumber: page.pageNumber,
        sourceLine: block.sourceLineStart,
        sourceLineEnd: block.sourceLineEnd,
        text: block.text,
        role: block.role,
        strategyId: PDF_REFERENCE_REGION_STRATEGY_ID,
        strategyVersion: PDF_REFERENCE_REGION_STRATEGY_VERSION,
        reason: block.role === 'reference-heading'
          ? 'evidence-gated-reference-heading'
          : block.role === 'page-furniture'
            ? 'strong-page-furniture-inside-reference-region'
            : 'inside-reference-region',
      });
    }
    return {
      ...page,
      text: blocks
        .filter(block => !block.ignoredByDefault)
        .map(block => block.text)
        .join('\n\n'),
      pdfReferenceRegionStrategyId: PDF_REFERENCE_REGION_STRATEGY_ID,
    };
  });

  return {
    pages: outputPages,
    ignoredBlocks,
    regions,
    ignoredReferenceBlockCount,
    referencePageFurnitureBlockCount,
  };
}

function furnitureLineRecords(text: string): {
  rawLines: string[];
  nonEmpty: FurnitureLineRecord[];
} {
  const rawLines = String(text ?? '').split(/\r?\n/u);
  const nonEmpty: FurnitureLineRecord[] = [];
  for (let rawLineIndex = 0; rawLineIndex < rawLines.length; rawLineIndex++) {
    const raw = rawLines[rawLineIndex];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    nonEmpty.push({ raw, trimmed, rawLineIndex, nonEmptyIndex: nonEmpty.length });
  }
  return { rawLines, nonEmpty };
}

function pageNumberSignature(text: string): string | null {
  const compact = text.trim().replace(/\s+/gu, ' ');
  if (/^(?:page\s*)?\d+(?:\s*(?:of|\/)\s*\d+)?$/iu.test(compact)) return '<page-number>';
  if (/^(?:page\s*)?[ivxlcdm]+$/iu.test(compact)) return '<page-number>';
  return null;
}

export function pageFurnitureSignature(text: string): string {
  return pageNumberSignature(text) ?? text.trim().normalize('NFC').replace(/\s+/gu, ' ').toLowerCase();
}

function romanValue(value: string): number | null {
  const values: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  const input = value.toLowerCase();
  let total = 0;
  for (let index = 0; index < input.length; index++) {
    const current = values[input[index]];
    const next = values[input[index + 1]] ?? 0;
    if (!current) return null;
    total += current < next ? -current : current;
  }
  return total > 0 ? total : null;
}

function parsePageLabel(text: string): {
  value: number | null;
  total: number | null;
  kind: 'arabic' | 'roman';
} | null {
  const compact = text.trim().replace(/\s+/gu, ' ');
  const arabic = compact.match(/^(?:page\s*)?(\d+)(?:\s*(?:of|\/)\s*(\d+))?$/iu);
  if (arabic) {
    return {
      value: Number(arabic[1]),
      total: arabic[2] ? Number(arabic[2]) : null,
      kind: 'arabic',
    };
  }
  const roman = compact.match(/^(?:page\s*)?([ivxlcdm]+)$/iu);
  if (roman) return { value: romanValue(roman[1]), total: null, kind: 'roman' };
  return null;
}

function hasStablePageSequence(occurrences: FurnitureOccurrence[]): boolean {
  const byPage = new Map<number, { value: number | null; total: number | null }>();
  for (const occurrence of occurrences) {
    const parsed = parsePageLabel(occurrence.trimmed);
    if (!parsed || !Number.isInteger(parsed.value)) return false;
    if (byPage.has(occurrence.pageNumber) &&
        byPage.get(occurrence.pageNumber)?.value !== parsed.value) return false;
    byPage.set(occurrence.pageNumber, parsed);
  }
  const values = [...byPage.entries()].sort((left, right) => left[0] - right[0]);
  if (new Set(values.map(([, item]) => item.value)).size !== values.length) return false;
  const offsets = new Set(values.map(([pageNumber, item]) => Number(item.value) - pageNumber));
  if (offsets.size !== 1) return false;
  const totals = new Set(values.map(([, item]) => item.total).filter(value => value !== null));
  return totals.size <= 1;
}

function hasTableContext(
  occurrences: FurnitureOccurrence[],
  pagesByNumber: Map<number, FurniturePage>,
  radius: number,
): boolean {
  const tablePattern = /^\s*(?:supplement(?:ary)?\s+)?table\s*(?:\d+|[ivxlcdm]+)?(?:\.|\b)/iu;
  return occurrences.some(occurrence => {
    const page = pagesByNumber.get(occurrence.pageNumber);
    if (!page) return false;
    const start = Math.max(0, occurrence.nonEmptyIndex - radius);
    const end = Math.min(page.lines.nonEmpty.length, occurrence.nonEmptyIndex + radius + 1);
    return page.lines.nonEmpty.slice(start, end).some(line => tablePattern.test(line.trimmed));
  });
}

function isNumericSymbolDense(signature: string): boolean {
  return /^[\d\s();:.,+\-–—]+$/u.test(signature) && /\d/u.test(signature);
}

// Synchronous UTF-8 SHA-256 keeps diagnostic group IDs byte-compatible with
// the frozen Node benchmark without depending on Node or asynchronous WebCrypto.
function sha256(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const constants = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  const rotateRight = (word: number, amount: number): number =>
    (word >>> amount) | (word << (32 - amount));

  for (let offset = 0; offset < data.length; offset += 64) {
    for (let index = 0; index < 16; index++) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index++) {
      const s0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^
        (words[index - 15] >>> 3);
      const s1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^
        (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index++) {
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sigma1 + choice + constants[index] + words[index]) >>> 0;
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }
  return [...state].map(word => word.toString(16).padStart(8, '0')).join('');
}

function analyzeRepeatedPageFurniture(
  pages: readonly PdfPreprocessedPage[],
  documentKey: string,
): { pages: FurniturePage[]; groups: FurnitureGroup[] } {
  const options = DEFAULT_FURNITURE_OPTIONS;
  const normalizedPages: FurniturePage[] = pages.map(page => ({
    ...page,
    text: String(page.text ?? ''),
    lines: furnitureLineRecords(page.text),
  }));
  const evaluablePages = normalizedPages.filter(page => page.lines.nonEmpty.length > 0);
  const pagesByNumber = new Map(normalizedPages.map(page => [page.pageNumber, page]));
  const occurrences: FurnitureOccurrence[] = [];

  for (const page of evaluablePages) {
    const bands: Array<['top' | 'bottom', FurnitureLineRecord[]]> = [
      ['top', page.lines.nonEmpty.slice(0, options.topBottomLineCount)],
      ['bottom', page.lines.nonEmpty.slice(-options.topBottomLineCount)],
    ];
    for (const [band, lines] of bands) {
      for (let bandIndex = 0; bandIndex < lines.length; bandIndex++) {
        const line = lines[bandIndex];
        const signature = pageFurnitureSignature(line.trimmed);
        occurrences.push({
          ...line,
          pageNumber: page.pageNumber,
          band,
          bandIndex,
          signature,
          signatureKind: signature === '<page-number>' ? 'page-number' : 'text',
        });
      }
    }
  }

  const grouped = new Map<string, FurnitureOccurrence[]>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.band}\u0000${occurrence.signature}`;
    const group = grouped.get(key) ?? [];
    group.push(occurrence);
    grouped.set(key, group);
  }

  const groups: FurnitureGroup[] = [];
  for (const [key, groupOccurrences] of grouped) {
    const distinctPages = [...new Set(groupOccurrences.map(item => item.pageNumber))]
      .sort((left, right) => left - right);
    const coverage = evaluablePages.length > 0
      ? distinctPages.length / evaluablePages.length
      : 0;
    if (distinctPages.length < options.minRepeatPages || coverage < options.minPageCoverage) continue;
    const [band, signature] = key.split('\u0000') as ['top' | 'bottom', string];
    const variants = [...new Set(groupOccurrences.map(item => item.trimmed))];
    groups.push({
      groupId: sha256(`${documentKey}\u0000${band}\u0000${signature}`).slice(0, 16),
      band,
      signature,
      signatureKind: groupOccurrences[0].signatureKind,
      occurrences: groupOccurrences,
      distinctPages,
      distinctPageCount: distinctPages.length,
      evaluablePageCount: evaluablePages.length,
      coverage: Number(coverage.toFixed(4)),
      variants,
      maxChars: Math.max(...groupOccurrences.map(item => item.trimmed.length)),
      maxWords: Math.max(...groupOccurrences.map(item => item.trimmed.split(/\s+/u).filter(Boolean).length)),
      sequenceVerified: false,
      bandOverlap: false,
      tableContext: false,
      numericSymbolDense: false,
      ignoredByDefault: true,
      decisionReason: '',
    });
  }

  const bandsBySignature = new Map<string, Set<'top' | 'bottom'>>();
  for (const group of groups) {
    const bands = bandsBySignature.get(group.signature) ?? new Set<'top' | 'bottom'>();
    bands.add(group.band);
    bandsBySignature.set(group.signature, bands);
  }
  for (const group of groups) {
    const sequenceVerified = group.signatureKind === 'page-number' &&
      hasStablePageSequence(group.occurrences);
    const bandOverlap = (bandsBySignature.get(group.signature)?.size ?? 0) > 1;
    const tableContext = hasTableContext(
      group.occurrences,
      pagesByNumber,
      options.tableContextRadius,
    );
    const numericSymbols = group.signatureKind === 'text' && isNumericSymbolDense(group.signature);
    let ignoredByDefault = true;
    let decisionReason = group.signatureKind === 'page-number'
      ? 'stable-page-number-sequence'
      : 'repeated-short-band-text';
    if (group.signatureKind === 'page-number' && !sequenceVerified) {
      ignoredByDefault = false;
      decisionReason = 'unverified-page-number-sequence';
    } else if (group.signatureKind === 'text' &&
      (group.maxChars > options.maxTextChars || group.maxWords > options.maxTextWords)) {
      ignoredByDefault = false;
      decisionReason = 'long-text-protected';
    } else if (bandOverlap) {
      ignoredByDefault = false;
      decisionReason = 'top-bottom-overlap-protected';
    } else if (tableContext) {
      ignoredByDefault = false;
      decisionReason = 'table-context-protected';
    } else if (numericSymbols) {
      ignoredByDefault = false;
      decisionReason = 'numeric-symbol-text-protected';
    }
    Object.assign(group, {
      sequenceVerified,
      bandOverlap,
      tableContext,
      numericSymbolDense: numericSymbols,
      ignoredByDefault,
      decisionReason,
    });
  }
  return { pages: normalizedPages, groups };
}

function applyRepeatedPageFurnitureV1(
  pages: readonly PdfPreprocessedPage[],
  documentKey: string,
): {
  pages: PdfPreprocessedPage[];
  ignoredBlocks: PdfIgnoredBlock[];
  groups: PdfPageFurnitureGroupDiagnostic[];
  ignoredGroupCount: number;
  protectedGroupCount: number;
  pageOneProtectedLineCount: number;
} {
  if (pages.length > 0 && pages.every(page =>
    page.pdfPageFurnitureStrategyId === PDF_PAGE_FURNITURE_STRATEGY_ID
  )) {
    return {
      pages: pages.map(page => ({ ...page })),
      ignoredBlocks: [],
      groups: [],
      ignoredGroupCount: 0,
      protectedGroupCount: 0,
      pageOneProtectedLineCount: 0,
    };
  }
  const analysis = analyzeRepeatedPageFurniture(pages, documentKey);
  const removalsByPage = new Map<number, Set<number>>();
  const ignoredBlocks: PdfIgnoredBlock[] = [];
  let pageOneProtectedLineCount = 0;
  for (const group of analysis.groups.filter(item => item.ignoredByDefault)) {
    for (const occurrence of group.occurrences) {
      if (DEFAULT_FURNITURE_OPTIONS.protectPageOneText &&
          occurrence.pageNumber === 1 && group.signatureKind === 'text') {
        pageOneProtectedLineCount++;
        continue;
      }
      const removals = removalsByPage.get(occurrence.pageNumber) ?? new Set<number>();
      removals.add(occurrence.rawLineIndex);
      removalsByPage.set(occurrence.pageNumber, removals);
      ignoredBlocks.push({
        pageNumber: occurrence.pageNumber,
        sourceLine: occurrence.rawLineIndex,
        text: occurrence.raw,
        role: 'page-furniture',
        strategyId: PDF_PAGE_FURNITURE_STRATEGY_ID,
        strategyVersion: PDF_PAGE_FURNITURE_STRATEGY_VERSION,
        reason: group.decisionReason,
        groupId: group.groupId,
        band: occurrence.band,
      });
    }
  }
  const outputPages = analysis.pages.map(page => {
    const removals = removalsByPage.get(page.pageNumber) ?? new Set<number>();
    const { lines, ...outputPage } = page;
    return {
      ...outputPage,
      text: lines.rawLines.filter((_, index) => !removals.has(index)).join('\n'),
      pdfPageFurnitureStrategyId: PDF_PAGE_FURNITURE_STRATEGY_ID,
    };
  });
  return {
    pages: outputPages,
    ignoredBlocks,
    groups: analysis.groups.map(({ occurrences: _occurrences, ...group }) => group),
    ignoredGroupCount: analysis.groups.filter(item => item.ignoredByDefault).length,
    protectedGroupCount: analysis.groups.filter(item => !item.ignoredByDefault).length,
    pageOneProtectedLineCount,
  };
}

/**
 * Run the frozen PDF main-text preprocessors in their production order.
 * Defaults are References v2 followed by F v1; each component can be disabled
 * explicitly for tests and historical benchmark replay only.
 */
export function preprocessPdfPages(
  inputPages: readonly PageText[],
  options: PdfPreprocessOptions = {},
): PdfPreprocessResult {
  const referenceMode = options.pdfReferenceRegionFiltering ?? 'v2';
  const pageFurnitureMode = options.pdfPageFurnitureFiltering ?? 'v1';
  const originalSlots = inputPages.map(page => page.pageNumber);
  const rawPages: PdfPreprocessedPage[] = inputPages.map(page => ({ ...page }));
  const referenceResult = referenceMode === 'v2'
    ? applyReferenceRegionsV2(rawPages)
    : {
      pages: rawPages,
      ignoredBlocks: [] as PdfIgnoredBlock[],
      regions: [] as PdfReferenceRegionDiagnostic[],
      ignoredReferenceBlockCount: 0,
      referencePageFurnitureBlockCount: 0,
    };
  const furnitureResult = pageFurnitureMode === 'v1'
    ? applyRepeatedPageFurnitureV1(referenceResult.pages, options.documentKey ?? '')
    : {
      pages: referenceResult.pages.map(page => ({ ...page })),
      ignoredBlocks: [] as PdfIgnoredBlock[],
      groups: [] as PdfPageFurnitureGroupDiagnostic[],
      ignoredGroupCount: 0,
      protectedGroupCount: 0,
      pageOneProtectedLineCount: 0,
    };
  const pageSlotsPreserved = furnitureResult.pages.length === originalSlots.length &&
    furnitureResult.pages.every((page, index) => page.pageNumber === originalSlots[index]);
  if (!pageSlotsPreserved) {
    throw new Error('PDF preprocessing changed physical page slots');
  }
  const ignoredFurnitureLines = furnitureResult.ignoredBlocks.length;
  return {
    pages: furnitureResult.pages,
    ignoredBlocks: [...referenceResult.ignoredBlocks, ...furnitureResult.ignoredBlocks],
    diagnostics: {
      referenceMode,
      pageFurnitureMode,
      referenceStrategyId: PDF_REFERENCE_REGION_STRATEGY_ID,
      referenceStrategyVersion: PDF_REFERENCE_REGION_STRATEGY_VERSION,
      pageFurnitureStrategyId: PDF_PAGE_FURNITURE_STRATEGY_ID,
      pageFurnitureStrategyVersion: PDF_PAGE_FURNITURE_STRATEGY_VERSION,
      referenceRegions: referenceResult.regions,
      referenceRegionCount: referenceResult.regions.length,
      ignoredReferenceBlockCount: referenceResult.ignoredReferenceBlockCount,
      referencePageFurnitureBlockCount: referenceResult.referencePageFurnitureBlockCount,
      pageFurnitureGroups: furnitureResult.groups,
      pageFurnitureCandidateGroupCount: furnitureResult.groups.length,
      ignoredPageFurnitureGroupCount: furnitureResult.ignoredGroupCount,
      protectedPageFurnitureGroupCount: furnitureResult.protectedGroupCount,
      ignoredPageFurnitureLineCount: ignoredFurnitureLines,
      pageOneProtectedLineCount: furnitureResult.pageOneProtectedLineCount,
      affectedPageCount: new Set(furnitureResult.ignoredBlocks.map(item => item.pageNumber)).size,
      ignoredPageFurnitureChars: furnitureResult.ignoredBlocks
        .reduce((sum, item) => sum + item.text.length, 0),
      pageSlotsPreserved,
    },
  };
}

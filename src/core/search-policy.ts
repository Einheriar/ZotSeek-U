import type { TextSourceType } from './vector-store-sqlite';

export type ProductIndexingMode = 'abstract' | 'notes' | 'full';
export type ProductHybridPolicy = 'explicit-semantic' | 'explicit-keyword' |
  'abstract-identity-semantic' | 'notes-identity-h1' | 'full-identity-notes2-pdf';

export const METADATA_NOTE_SOURCES: TextSourceType[] = [
  'summary', 'abstract', 'title_only', 'note',
];
export const PDF_SOURCES: TextSourceType[] = [
  'fulltext', 'methods', 'findings', 'content',
];
export const FULL_NOTES_HEAD_SLOTS = 2;

export function normalizeProductIndexingMode(value: unknown): ProductIndexingMode {
  return value === 'notes' || value === 'full' ? value : 'abstract';
}

export function resolveProductHybridPolicy(
  indexingMode: unknown,
  searchMode: 'hybrid' | 'semantic' | 'keyword' = 'hybrid',
): ProductHybridPolicy {
  if (searchMode === 'semantic') return 'explicit-semantic';
  if (searchMode === 'keyword') return 'explicit-keyword';
  const mode = normalizeProductIndexingMode(indexingMode);
  if (mode === 'notes') return 'notes-identity-h1';
  if (mode === 'full') return 'full-identity-notes2-pdf';
  return 'abstract-identity-semantic';
}

export function allocatePrimaryWithAlternateTail<T>(
  primary: T[],
  alternate: T[],
  finalTopK: number,
  primarySlots: number,
  identity: (value: T) => string,
): T[] {
  const limit = Math.max(0, Math.floor(finalTopK));
  const headSlots = Math.max(0, Math.min(limit, Math.floor(primarySlots)));
  const selected: T[] = [];
  const seen = new Set<string>();
  const append = (value: T) => {
    const key = identity(value);
    if (!key || seen.has(key) || selected.length >= limit) return;
    seen.add(key);
    selected.push(value);
  };
  primary.slice(0, headSlots).forEach(append);
  alternate.forEach(append);
  primary.slice(headSlots).forEach(append);
  return selected;
}

export interface MetadataIdentityCandidate {
  id: string;
  title: string;
  doi?: string;
  year?: string;
  creators: Array<{ firstName?: string; lastName?: string; name?: string }>;
}

export type MetadataIdentityKind = 'doi' | 'exact-title' | 'title-fragment' |
  'author-set' | 'author-year-set';

export interface MetadataIdentityMatch<T extends MetadataIdentityCandidate> {
  kind: MetadataIdentityKind;
  candidates: T[];
}

export interface MetadataIdentityAnalysis<T extends MetadataIdentityCandidate> {
  match: MetadataIdentityMatch<T> | null;
  /** True when some subset of candidates could receive identity permission. */
  hasPotentialMatch: boolean;
}

function normalizeIdentityText(value: string): string {
  return String(value ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('und')
    .replace(/[\u2018\u2019\u201c\u201d]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDoi(value: string): string {
  return normalizeIdentityText(value)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '')
    .replace(/^doi\s*:\s*/, '')
    .replace(/[\s.,;]+$/g, '');
}

function creatorSurfaces(candidate: MetadataIdentityCandidate): Set<string> {
  const surfaces = new Set<string>();
  for (const creator of candidate.creators) {
    const first = normalizeIdentityText(creator.firstName ?? '');
    const last = normalizeIdentityText(creator.lastName ?? creator.name ?? '');
    const lastCjkLength = Array.from(last).filter(character =>
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(character)).length;
    // Preserve Plan 29's weak-author guard: a short Latin surname such as
    // "Li" is too ambiguous to replace concept search on its own.
    if (last && (lastCjkLength >= 2 || last.length >= 5)) surfaces.add(last);
    if (first && last) {
      surfaces.add(`${first} ${last}`);
      surfaces.add(`${last} ${first}`);
      surfaces.add(`${first}${last}`);
      surfaces.add(`${last}${first}`);
    }
  }
  return surfaces;
}

function isDistinctiveTitleFragment(query: string): boolean {
  const cjkLength = Array.from(query).filter(character =>
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(character)).length;
  if (cjkLength >= 6) return true;
  const terms = query.match(/[\p{L}\p{N}]+/gu) ?? [];
  return query.length >= 12 && terms.length >= 3;
}

/**
 * Analyze metadata-only identity permission and whether a narrower candidate
 * gate could change the answer. The latter lets cache callers preserve
 * Zotero's query-specific candidate semantics without paying for that gate on
 * ordinary concept queries that cannot match any identity surface.
 */
export function analyzeMetadataIdentity<T extends MetadataIdentityCandidate>(
  queryValue: string,
  candidates: T[],
): MetadataIdentityAnalysis<T> {
  const query = normalizeIdentityText(queryValue);
  if (!query || candidates.length === 0 || /^\d{4}$/.test(query)) {
    return { match: null, hasPotentialMatch: false };
  }

  const queryDoi = normalizeDoi(query);
  if (/^10\.\d{4,9}\//.test(queryDoi)) {
    const matches = candidates.filter(candidate => normalizeDoi(candidate.doi ?? '') === queryDoi);
    if (matches.length > 0) {
      return { match: { kind: 'doi', candidates: matches }, hasPotentialMatch: true };
    }
  }

  const exactTitles = candidates.filter(candidate => normalizeIdentityText(candidate.title) === query);
  if (exactTitles.length > 0) {
    return { match: { kind: 'exact-title', candidates: exactTitles }, hasPotentialMatch: true };
  }

  const yearMatch = query.match(/(?:^|\s)((?:19|20)\d{2})(?:$|\s)/);
  const queryYear = yearMatch?.[1];
  const authorQuery = queryYear
    ? query.replace(new RegExp(`(?:^|\\s)${queryYear}(?:$|\\s)`), ' ').replace(/\s+/g, ' ').trim()
    : query;
  if (authorQuery) {
    const authorMatches = candidates.filter(candidate =>
      creatorSurfaces(candidate).has(authorQuery) &&
      (!queryYear || String(candidate.year ?? '').includes(queryYear)));
    if (authorMatches.length > 0) {
      return {
        match: {
          kind: queryYear ? 'author-year-set' : 'author-set',
          candidates: authorMatches,
        },
        hasPotentialMatch: true,
      };
    }
  }

  if (isDistinctiveTitleFragment(query)) {
    const fragments = candidates.filter(candidate => normalizeIdentityText(candidate.title).includes(query));
    // Ambiguous fragments do not get identity permission. They fall through to
    // the normal content strategy instead of manufacturing a privileged set.
    if (fragments.length === 1) {
      return { match: { kind: 'title-fragment', candidates: fragments }, hasPotentialMatch: true };
    }
    if (fragments.length > 1) return { match: null, hasPotentialMatch: true };
  }

  return { match: null, hasPotentialMatch: false };
}

/** Metadata-only identity permission. Weak fragments and year-only queries abstain. */
export function classifyMetadataIdentity<T extends MetadataIdentityCandidate>(
  queryValue: string,
  candidates: T[],
): MetadataIdentityMatch<T> | null {
  return analyzeMetadataIdentity(queryValue, candidates).match;
}

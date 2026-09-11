/**
 * Best-effort read-only adapter for Zotero Style's cached journal data.
 *
 * Zotero Style does not expose a documented inter-plugin API. Keep all access
 * to its current runtime shape here, never trigger a refresh, and degrade to
 * no enrichment whenever the addon is absent, unready, or incompatible.
 */

declare const Zotero: any;
declare const ChromeUtils: any;
declare const PathUtils: any;

const STYLE_CACHE_TTL_MS = 5_000;
const STYLE_ADDON_ID = 'zoterostyle@polygon.org';

type StyleRankCache = Record<string, { rank?: unknown }>;

let cachedStyleAddon: any;
let cachedRankData: StyleRankCache | undefined;
let cachedRankDataAt = 0;
let rankDataLoad: Promise<StyleRankCache | undefined> | undefined;
let cachedStyleActive = false;
let cachedStyleActiveAt = 0;
let styleActiveLoad: Promise<boolean> | undefined;
let cachedZoteroHost: any;

export interface JournalMetrics {
  provider: 'zotero-style';
  impactFactor?: number;
  sciQuartile?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
}

function normalizeImpactFactor(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function normalizeSciQuartile(value: unknown): JournalMetrics['sciQuartile'] | undefined {
  if (typeof value !== 'string') return undefined;
  const quartile = value.trim().toUpperCase();
  return /^(?:Q1|Q2|Q3|Q4)$/u.test(quartile)
    ? quartile as JournalMetrics['sciQuartile']
    : undefined;
}

function metricsFromPublication(publication: unknown): JournalMetrics | undefined {
  if (!publication || typeof publication !== 'object' || Array.isArray(publication)) {
    return undefined;
  }

  const values = publication as Record<string, unknown>;
  const impactFactor = normalizeImpactFactor(values.sciif);
  const sciQuartile = normalizeSciQuartile(values.sci);
  if (impactFactor === undefined && sciQuartile === undefined) return undefined;

  return {
    provider: 'zotero-style',
    ...(impactFactor !== undefined ? { impactFactor } : {}),
    ...(sciQuartile !== undefined ? { sciQuartile } : {}),
  };
}

function readLegacyRuntimeCache(styleAddon: any, item: any): JournalMetrics | undefined {
  const storage = styleAddon?.data?.views?.localStorage;
  // Older Style versions exposed the item-tree cache through data.views.
  if (!storage || storage.cache === undefined || typeof storage.get !== 'function') {
    return undefined;
  }
  return metricsFromPublication(storage.get(item, 'publication'));
}

function publicationTitleForItem(item: any): string {
  let fields = '';
  try {
    const configured = Zotero?.Prefs?.get?.('zoterostyle.publicationColumn.fields');
    fields = typeof configured === 'string' ? configured : '';
  } catch {
    // Fall through to Style's own default field order.
  }
  if (!fields.includes('publicationTitle')) {
    fields = 'publicationTitle, conferenceName, university, publisher';
  }

  for (const field of fields.split(/,\s*/u)) {
    try {
      const value = item?.getField?.(field);
      if (typeof value === 'string' && value.length > 0) return value;
    } catch {
      // Ignore unsupported fields and continue with the next configured field.
    }
  }
  return '';
}

function styleCachePath(): string {
  const dataDir = String(Zotero?.DataDirectory?.dir || '').replace(/[\\/]+$/u, '');
  if (!dataDir) return '';
  try {
    return PathUtils.join(dataDir, 'zoterostyle.json');
  } catch {
    const separator = dataDir.includes('\\') ? '\\' : '/';
    return `${dataDir}${separator}zoterostyle.json`;
  }
}

async function activeStyleIdentity(): Promise<any | undefined> {
  if (cachedZoteroHost !== Zotero) {
    cachedZoteroHost = Zotero;
    cachedStyleActive = false;
    cachedStyleActiveAt = 0;
    styleActiveLoad = undefined;
  }
  const runtimeAddon = Zotero?.ZoteroStyle;
  if (runtimeAddon) return runtimeAddon;

  const now = Date.now();
  if (cachedStyleActiveAt && now - cachedStyleActiveAt < STYLE_CACHE_TTL_MS) {
    return cachedStyleActive ? STYLE_ADDON_ID : undefined;
  }
  if (!styleActiveLoad) {
    styleActiveLoad = (async () => {
      try {
        const module = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
        const addon = await module?.AddonManager?.getAddonByID?.(STYLE_ADDON_ID);
        return addon?.isActive === true;
      } catch {
        return false;
      }
    })();
  }
  try {
    cachedStyleActive = await styleActiveLoad;
    cachedStyleActiveAt = Date.now();
    return cachedStyleActive ? STYLE_ADDON_ID : undefined;
  } finally {
    styleActiveLoad = undefined;
  }
}

async function loadModernRankCache(styleAddon: any): Promise<StyleRankCache | undefined> {
  if (cachedStyleAddon !== styleAddon) {
    cachedStyleAddon = styleAddon;
    cachedRankData = undefined;
    cachedRankDataAt = 0;
    rankDataLoad = undefined;
  }

  const now = Date.now();
  if (cachedRankData && now - cachedRankDataAt < STYLE_CACHE_TTL_MS) {
    return cachedRankData;
  }
  if (rankDataLoad) return rankDataLoad;

  rankDataLoad = (async () => {
    try {
      const path = styleCachePath();
      if (!path || typeof Zotero?.File?.getContentsAsync !== 'function') return undefined;
      const raw = await Zotero.File.getContentsAsync(path, 'utf-8');
      const parsed = JSON.parse(String(raw));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
      cachedRankData = parsed as StyleRankCache;
      cachedRankDataAt = Date.now();
      return cachedRankData;
    } catch {
      return undefined;
    } finally {
      rankDataLoad = undefined;
    }
  })();
  return rankDataLoad;
}

export async function readZoteroStyleJournalMetrics(item: any): Promise<JournalMetrics | undefined> {
  if (!item) return undefined;
  try {
    const styleAddon = await activeStyleIdentity();
    if (!styleAddon) return undefined;

    const legacyMetrics = typeof styleAddon === 'object'
      ? readLegacyRuntimeCache(styleAddon, item)
      : undefined;
    if (legacyMetrics) return legacyMetrics;

    // Style 6.x keeps publication metrics in zoterostyle.json under
    // cache[publicationTitle].rank. Read that file directly so a cache miss
    // cannot invoke Style's data provider and schedule a network refresh.
    const publicationTitle = publicationTitleForItem(item);
    if (!publicationTitle) return undefined;
    const cache = await loadModernRankCache(styleAddon);
    return metricsFromPublication(cache?.[publicationTitle]?.rank);
  } catch {
    // Optional enrichment must never make MCP/REST item reads fail.
    return undefined;
  }
}

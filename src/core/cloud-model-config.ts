/** Stable, non-secret configuration for the Cloud embedding slot (multi-provider catalog). */

import { BRIEF_CONNECTION_VERIFIED_PREF } from './brief-generation-config';
import {
  calculateRecommendedChunkTokens,
  fixedChunkProfile,
  type ModelChunkProfile,
} from './model-chunk-profile';

declare const Zotero: any;

// ---------------------------------------------------------------------------
// Provider catalog
// ---------------------------------------------------------------------------

export type CloudProviderId =
  | 'alibaba-bailian'
  | 'openai'
  | 'google-gemini-api'
  | 'custom-openai-compatible';

/** Region machine values for the fixed official Bailian endpoints. */
export type BailianRegion = 'cn' | 'intl';

/** How a provider distinguishes query from document embeddings. */
export type CloudRoleContract = 'text_type' | 'none' | 'taskType';

export const CLOUD_PROVIDER_ID: CloudProviderId = 'alibaba-bailian';
export const CLOUD_PROVIDER_LABEL = 'Alibaba Cloud Model Studio (Bailian)';
/**
 * Legacy single-provider Base URL (Bailian mainland). New code derives the
 * Bailian URL from the region selection; this constant remains the default
 * and the brief-generation fallback surface.
 */
export const CLOUD_DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
export const BAILIAN_REGION_INTL_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

export const CLOUD_MODEL_NAME = 'qwen3.7-text-embedding';
export const CLOUD_MODEL_DIMENSIONS = 1024;
export const CLOUD_MODEL_ID =
  `cloud:${CLOUD_PROVIDER_ID}:${CLOUD_MODEL_NAME}:${CLOUD_MODEL_DIMENSIONS}`;
export const CLOUD_BATCH_SIZE = 10;
export const CLOUD_MAX_INPUT_TOKENS = 128000;
export const CLOUD_RECOMMENDED_CHUNK_CAP = 4000;
export const CLOUD_CHUNK_PROFILE: ModelChunkProfile = Object.freeze({
  defaultChunkTokens: 4000,
  recommendation: Object.freeze({ kind: 'ratio-cap', ratio: 0.85, cap: CLOUD_RECOMMENDED_CHUNK_CAP }),
  softMinRatio: 0.25,
});
export const CLOUD_DEFAULT_QUERY_ROLE = 'query';
export const CLOUD_DEFAULT_DOCUMENT_ROLE = 'document';
export const CLOUD_OUTPUT_TYPE = 'dense' as const;
export const CLOUD_API_ADAPTER_VERSION = 'dashscope-native-text-type-v1';
export const CLOUD_CONNECTION_CONTRACT_VERSION = 2;
export const CLOUD_CONSENT_VERSION = 1;

export interface CloudProviderOption {
  id: CloudProviderId;
  label: string;
  /** Built-in providers only: the model selected when the provider is chosen. */
  defaultModelName: string;
  roleContract: CloudRoleContract;
}

export const CLOUD_PROVIDER_OPTIONS: readonly CloudProviderOption[] = Object.freeze([
  {
    id: 'alibaba-bailian',
    label: 'Alibaba Bailian',
    defaultModelName: CLOUD_MODEL_NAME,
    roleContract: 'text_type',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    defaultModelName: 'text-embedding-3-small',
    roleContract: 'none',
  },
  {
    id: 'google-gemini-api',
    label: 'Google Gemini API',
    defaultModelName: 'gemini-embedding-001',
    roleContract: 'taskType',
  },
  {
    id: 'custom-openai-compatible',
    label: 'Custom (OpenAI-compatible)',
    defaultModelName: '',
    roleContract: 'none',
  },
]);

function isCloudProviderId(value: unknown): value is CloudProviderId {
  return CLOUD_PROVIDER_OPTIONS.some(option => option.id === value);
}

export function getCloudProviderLabel(provider: CloudProviderId): string {
  return CLOUD_PROVIDER_OPTIONS.find(option => option.id === provider)?.label || provider;
}

// ---------------------------------------------------------------------------
// Built-in model catalog
//
// The catalog is the only source of built-in model facts. Users cannot create
// a vector space by typing an arbitrary model name: dimensions, input limits,
// role contracts, batch defaults and chunk profiles all come from here. The
// Custom (OpenAI-compatible) provider is the single documented escape hatch
// and never appears in this catalog.
// ---------------------------------------------------------------------------

export interface CloudModelCatalogEntry {
  provider: CloudProviderId;
  modelName: string;
  dimensions: number;
  maxInputTokens: number;
  queryRole: string;
  documentRole: string;
  batchSize: number;
  chunkProfile: ModelChunkProfile;
  adapterVersion: string;
  /** Provider-specific value persisted into the input-policy fingerprint. */
  outputContract: string;
  roleContract: CloudRoleContract;
}

const OPENAI_CHUNK_PROFILE = fixedChunkProfile(2000);
const GEMINI_CHUNK_PROFILE: ModelChunkProfile = Object.freeze({
  defaultChunkTokens: 1740,
  recommendation: Object.freeze({ kind: 'ratio-cap', ratio: 0.85, cap: 1740 }),
  softMinRatio: 0.25,
});

export const CLOUD_MODEL_CATALOG: readonly CloudModelCatalogEntry[] = Object.freeze([
  {
    provider: 'alibaba-bailian',
    modelName: CLOUD_MODEL_NAME,
    dimensions: CLOUD_MODEL_DIMENSIONS,
    maxInputTokens: CLOUD_MAX_INPUT_TOKENS,
    queryRole: CLOUD_DEFAULT_QUERY_ROLE,
    documentRole: CLOUD_DEFAULT_DOCUMENT_ROLE,
    batchSize: CLOUD_BATCH_SIZE,
    chunkProfile: CLOUD_CHUNK_PROFILE,
    adapterVersion: CLOUD_API_ADAPTER_VERSION,
    outputContract: CLOUD_OUTPUT_TYPE,
    roleContract: 'text_type',
  },
  {
    provider: 'openai',
    modelName: 'text-embedding-3-small',
    dimensions: 1536,
    maxInputTokens: 8192,
    queryRole: '',
    documentRole: '',
    batchSize: CLOUD_BATCH_SIZE,
    chunkProfile: OPENAI_CHUNK_PROFILE,
    adapterVersion: 'openai-embeddings-v1',
    outputContract: 'none',
    roleContract: 'none',
  },
  {
    provider: 'openai',
    modelName: 'text-embedding-3-large',
    dimensions: 3072,
    maxInputTokens: 8192,
    queryRole: '',
    documentRole: '',
    batchSize: CLOUD_BATCH_SIZE,
    chunkProfile: OPENAI_CHUNK_PROFILE,
    adapterVersion: 'openai-embeddings-v1',
    outputContract: 'none',
    roleContract: 'none',
  },
  {
    provider: 'google-gemini-api',
    modelName: 'gemini-embedding-001',
    dimensions: 768,
    maxInputTokens: 2048,
    queryRole: 'RETRIEVAL_QUERY',
    documentRole: 'RETRIEVAL_DOCUMENT',
    batchSize: CLOUD_BATCH_SIZE,
    chunkProfile: GEMINI_CHUNK_PROFILE,
    adapterVersion: 'gemini-embedcontent-v1',
    outputContract: 'none',
    roleContract: 'taskType',
  },
]);

export const CUSTOM_OPENAI_COMPATIBLE_ADAPTER_VERSION = 'openai-compatible-v1';
export const CUSTOM_OPENAI_COMPATIBLE_DEFAULT_MAX_INPUT_TOKENS = 8192;

export function getProviderCatalogEntries(provider: CloudProviderId): CloudModelCatalogEntry[] {
  return CLOUD_MODEL_CATALOG.filter(entry => entry.provider === provider);
}

export function getProviderDefaultCatalogEntry(
  provider: CloudProviderId,
): CloudModelCatalogEntry | undefined {
  return getProviderCatalogEntries(provider)[0];
}

export function findCloudCatalogEntry(
  provider: CloudProviderId,
  modelName: string,
  dimensions: number,
): CloudModelCatalogEntry | undefined {
  return CLOUD_MODEL_CATALOG.find(entry =>
    entry.provider === provider
    && entry.modelName === modelName
    && entry.dimensions === dimensions
  );
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CloudConfigRejectedError extends Error {
  readonly code = 'CLOUD_CONFIG_REJECTED' as const;

  constructor(message: string) {
    super(message);
    this.name = 'CloudConfigRejectedError';
  }
}

export class CloudBaseUrlRejectedError extends CloudConfigRejectedError {
  constructor(message: string) {
    super(message);
    this.name = 'CloudBaseUrlRejectedError';
  }
}

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

function isAllowedBailianHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'dashscope.aliyuncs.com'
    || host === 'dashscope-intl.aliyuncs.com'
    || host === 'dashscope-us.aliyuncs.com'
    || host.endsWith('.maas.aliyuncs.com');
}

/** Validate and normalize the shared Bailian OpenAI-compatible Base URL. */
export function assertCloudBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CloudBaseUrlRejectedError('Cloud Base URL is not a valid URL.');
  }
  if (url.protocol !== 'https:') {
    throw new CloudBaseUrlRejectedError('Cloud Base URL must use HTTPS.');
  }
  if (url.username || url.password) {
    throw new CloudBaseUrlRejectedError('Cloud Base URL must not contain credentials.');
  }
  if (url.search || url.hash) {
    throw new CloudBaseUrlRejectedError('Cloud Base URL must not contain a query or fragment.');
  }
  if (!isAllowedBailianHost(url.hostname)) {
    throw new CloudBaseUrlRejectedError('Cloud Base URL must be an Alibaba Bailian endpoint.');
  }
  const normalizedPath = url.pathname.replace(/\/+$/, '');
  if (normalizedPath !== '/compatible-mode/v1') {
    throw new CloudBaseUrlRejectedError(
      'Cloud Base URL must end with /compatible-mode/v1.',
    );
  }
  url.pathname = normalizedPath;
  return url;
}

/**
 * Validate the Custom (OpenAI-compatible) provider Base URL and return the
 * normalized value (trimmed, without a trailing slash). Only HTTPS remote
 * endpoints are accepted; loopback local servers belong to the Local Server
 * slot, which enforces its own loopback rule.
 */
export function assertCustomProviderBaseUrl(value: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new CloudBaseUrlRejectedError(
      'The Custom (OpenAI-compatible) Base URL is not a valid URL.',
    );
  }
  if (url.protocol !== 'https:') {
    throw new CloudBaseUrlRejectedError('The Custom Base URL must use HTTPS.');
  }
  if (url.username || url.password) {
    throw new CloudBaseUrlRejectedError('The Custom Base URL must not contain credentials.');
  }
  if (url.search || url.hash) {
    throw new CloudBaseUrlRejectedError('The Custom Base URL must not contain a query or fragment.');
  }
  if (!url.hostname) {
    throw new CloudBaseUrlRejectedError('The Custom Base URL must include a host.');
  }
  return trimmed.replace(/\/+$/, '');
}

/** The Custom provider follows the OpenAI SDK convention: base URL + /embeddings. */
export function customEmbeddingEndpoint(baseUrl: string): string {
  return `${assertCustomProviderBaseUrl(baseUrl)}/embeddings`;
}

// ---------------------------------------------------------------------------
// Settings resolution
// ---------------------------------------------------------------------------

export interface CloudModelSettings {
  provider: CloudProviderId;
  /**
   * False when the stored model name/dimensions do not match the catalog
   * (built-in providers) or the custom fields are incomplete. An unconfigured
   * Cloud model must never send requests: the pipeline refuses to initialize
   * and the UI requires a new selection.
   */
  configured: boolean;
  /**
   * Bailian shared base URL derived from the region selection; empty for
   * every other provider. The literature-brief client shares this
   * Bailian-compatible surface.
   */
  baseUrl: string;
  bailianRegion: BailianRegion;
  modelName: string;
  dimensions: number;
  maxInputTokens: number;
  recommendedChunkTokens: number;
  queryRole: string;
  documentRole: string;
  batchSize: number;
  roleContract: CloudRoleContract;
  adapterVersion: string;
  outputContract: string;
  chunkProfile: ModelChunkProfile;
  /** Custom provider base URL (normalized); empty for every other provider. */
  customBaseUrl: string;
}

const PROVIDER_PREF = 'zotseek.cloud.provider';
const BASE_URL_PREF = 'zotseek.cloud.baseUrl'; // legacy, migration source only
const BAILIAN_REGION_PREF = 'zotseek.cloud.bailianRegion';
const MODEL_NAME_PREF = 'zotseek.cloud.modelName';
const DIMENSIONS_PREF = 'zotseek.cloud.dimensions';
const MAX_INPUT_TOKENS_PREF = 'zotseek.cloud.maxInputTokens';
const QUERY_ROLE_PREF = 'zotseek.cloud.queryRole';
const DOCUMENT_ROLE_PREF = 'zotseek.cloud.documentRole';
const BATCH_SIZE_PREF = 'zotseek.cloud.batchSize';
const CUSTOM_BASE_URL_PREF = 'zotseek.cloud.custom.baseUrl';
const CUSTOM_MODEL_NAME_PREF = 'zotseek.cloud.custom.modelName';
const CUSTOM_DIMENSIONS_PREF = 'zotseek.cloud.custom.dimensions';
const CUSTOM_MAX_INPUT_TOKENS_PREF = 'zotseek.cloud.custom.maxInputTokens';
const CUSTOM_BATCH_SIZE_PREF = 'zotseek.cloud.custom.batchSize';
const VERIFIED_PREF = 'zotseek.cloud.connectionVerified';
const VERIFIED_CONTRACT_PREF = 'zotseek.cloud.connectionVerifiedContract';
const AUTO_INDEX_PREF = 'zotseek.cloud.autoIndex';
const CONSENT_VERSION_PREF = 'zotseek.cloud.consentVersion';

function providerStatePref(base: string, provider: CloudProviderId): string {
  return `${base}.${provider}`;
}

function readPref(key: string): unknown {
  try { return Zotero.Prefs.get(key, true); } catch { return undefined; }
}

function storedString(key: string, fallback: string, trim = true): string {
  const value = readPref(key);
  if (typeof value !== 'string') return fallback;
  const normalized = trim ? value.trim() : value;
  return normalized || (trim ? fallback : normalized);
}

function storedPositiveInteger(key: string, fallback: number): number {
  const value = Number(readPref(key));
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function normalizeApiRole(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new CloudConfigRejectedError(`${label} must be a string.`);
  }
  const role = value.trim();
  if (role.length > 128 || /[\u0000-\u001f\u007f]/.test(role)) {
    throw new CloudConfigRejectedError(`${label} contains unsupported characters or is too long.`);
  }
  return role;
}

export function calculateCloudRecommendedChunkTokens(maxInputTokens: number): number {
  if (!Number.isSafeInteger(maxInputTokens) || maxInputTokens <= 0) {
    throw new CloudConfigRejectedError('Maximum input tokens must be a positive integer.');
  }
  const recommendation = CLOUD_CHUNK_PROFILE.recommendation;
  const calculated = recommendation.kind === 'ratio-cap'
    ? Math.min(recommendation.cap, Math.floor(maxInputTokens * recommendation.ratio))
    : recommendation.defaultTokens;
  return Math.max(1, Math.min(calculated, maxInputTokens));
}

export function cloudModelId(settings: Pick<CloudModelSettings, 'provider' | 'modelName' | 'dimensions'>): string {
  return `cloud:${settings.provider}:${encodeURIComponent(settings.modelName)}:${settings.dimensions}`;
}

/** Resolve the active provider; unknown or missing values fall back to Bailian. */
export function getCloudProvider(): CloudProviderId {
  const value = readPref(PROVIDER_PREF);
  return isCloudProviderId(value) ? value : CLOUD_PROVIDER_ID;
}

/**
 * Bailian region selection. Falls back to a read-only migration from the
 * legacy `zotseek.cloud.baseUrl` pref: only an exact international endpoint
 * selects `intl`; every other legacy value (including enterprise hosts that
 * are no longer reachable) selects the mainland endpoint.
 */
export function getBailianRegion(): BailianRegion {
  const stored = readPref(BAILIAN_REGION_PREF);
  if (stored === 'cn' || stored === 'intl') return stored;
  const legacy = readPref(BASE_URL_PREF);
  if (typeof legacy === 'string'
    && legacy.trim().replace(/\/+$/, '') === BAILIAN_REGION_INTL_BASE_URL) {
    return 'intl';
  }
  return 'cn';
}

function bailianSettingsFromCatalog(
  entry: CloudModelCatalogEntry | undefined,
  storedModelName: string,
  storedDimensions: number,
): CloudModelSettings {
  const resolved = entry || getProviderDefaultCatalogEntry('alibaba-bailian')!;
  const region = getBailianRegion();
  const maxInputTokens = storedPositiveInteger(MAX_INPUT_TOKENS_PREF, resolved.maxInputTokens);
  return {
    provider: 'alibaba-bailian',
    configured: !!entry,
    baseUrl: region === 'intl' ? BAILIAN_REGION_INTL_BASE_URL : CLOUD_DEFAULT_BASE_URL,
    bailianRegion: region,
    modelName: storedModelName,
    dimensions: storedDimensions,
    maxInputTokens,
    recommendedChunkTokens: calculateRecommendedChunkTokens(resolved.chunkProfile, maxInputTokens),
    queryRole: storedString(QUERY_ROLE_PREF, resolved.queryRole, false).trim(),
    documentRole: storedString(DOCUMENT_ROLE_PREF, resolved.documentRole, false).trim(),
    batchSize: storedPositiveInteger(BATCH_SIZE_PREF, resolved.batchSize),
    roleContract: resolved.roleContract,
    adapterVersion: resolved.adapterVersion,
    outputContract: resolved.outputContract,
    chunkProfile: resolved.chunkProfile,
    customBaseUrl: '',
  };
}

function resolveBailianSettings(): CloudModelSettings {
  const storedModelName = storedString(MODEL_NAME_PREF, CLOUD_MODEL_NAME);
  const storedDimensions = storedPositiveInteger(DIMENSIONS_PREF, CLOUD_MODEL_DIMENSIONS);
  const entry = findCloudCatalogEntry('alibaba-bailian', storedModelName, storedDimensions);
  return bailianSettingsFromCatalog(entry, storedModelName, storedDimensions);
}

function resolveBuiltinSettings(provider: 'openai' | 'google-gemini-api'): CloudModelSettings {
  const entries = getProviderCatalogEntries(provider);
  const fallback = entries[0];
  const storedModelName = storedString(MODEL_NAME_PREF, fallback.modelName);
  const storedDimensions = storedPositiveInteger(DIMENSIONS_PREF, fallback.dimensions);
  const entry = findCloudCatalogEntry(provider, storedModelName, storedDimensions);
  const resolved = entry || fallback;
  return {
    provider,
    configured: !!entry,
    baseUrl: '',
    bailianRegion: 'cn',
    modelName: storedModelName,
    dimensions: storedDimensions,
    maxInputTokens: resolved.maxInputTokens,
    recommendedChunkTokens: calculateRecommendedChunkTokens(resolved.chunkProfile, resolved.maxInputTokens),
    queryRole: resolved.queryRole,
    documentRole: resolved.documentRole,
    batchSize: resolved.batchSize,
    roleContract: resolved.roleContract,
    adapterVersion: resolved.adapterVersion,
    outputContract: resolved.outputContract,
    chunkProfile: resolved.chunkProfile,
    customBaseUrl: '',
  };
}

function resolveCustomSettings(): CloudModelSettings {
  const customBaseUrl = storedString(CUSTOM_BASE_URL_PREF, '');
  const modelName = storedString(CUSTOM_MODEL_NAME_PREF, '');
  const dimensions = storedPositiveInteger(CUSTOM_DIMENSIONS_PREF, 0);
  const maxInputTokens = storedPositiveInteger(
    CUSTOM_MAX_INPUT_TOKENS_PREF,
    CUSTOM_OPENAI_COMPATIBLE_DEFAULT_MAX_INPUT_TOKENS,
  );
  let urlValid = false;
  try { assertCustomProviderBaseUrl(customBaseUrl); urlValid = true; } catch { /* unconfigured */ }
  const configured = urlValid && !!modelName && dimensions > 0;
  return {
    provider: 'custom-openai-compatible',
    configured,
    baseUrl: '',
    bailianRegion: 'cn',
    modelName,
    dimensions: dimensions > 0 ? dimensions : 1,
    maxInputTokens,
    recommendedChunkTokens: calculateRecommendedChunkTokens(CLOUD_CHUNK_PROFILE, maxInputTokens),
    queryRole: '',
    documentRole: '',
    batchSize: storedPositiveInteger(CUSTOM_BATCH_SIZE_PREF, CLOUD_BATCH_SIZE),
    roleContract: 'none',
    adapterVersion: CUSTOM_OPENAI_COMPATIBLE_ADAPTER_VERSION,
    outputContract: 'none',
    chunkProfile: CLOUD_CHUNK_PROFILE,
    customBaseUrl,
  };
}

export function getCloudModelSettings(): CloudModelSettings {
  const provider = getCloudProvider();
  if (provider === 'alibaba-bailian') return resolveBailianSettings();
  if (provider === 'openai' || provider === 'google-gemini-api') {
    return resolveBuiltinSettings(provider);
  }
  return resolveCustomSettings();
}

export function isCloudModelConfigured(settings = getCloudModelSettings()): boolean {
  return settings.configured;
}

/**
 * Stored Custom (OpenAI-compatible) configuration regardless of the active
 * provider. The settings page uses this to show the user's saved custom
 * fields when they switch the provider dropdown to Custom.
 */
export function getStoredCustomProviderSettings(): CloudModelSettings {
  return resolveCustomSettings();
}

// ---------------------------------------------------------------------------
// Settings input and persistence
// ---------------------------------------------------------------------------

export type CloudModelSettingsInput =
  | {
    provider: 'alibaba-bailian';
    bailianRegion: BailianRegion;
    modelName: string;
    dimensions: number;
    maxInputTokens: number;
    queryRole: string;
    documentRole: string;
    batchSize: number;
  }
  | {
    provider: 'openai' | 'google-gemini-api';
    modelName: string;
    dimensions: number;
  }
  | {
    provider: 'custom-openai-compatible';
    baseUrl: string;
    modelName: string;
    dimensions: number;
    maxInputTokens: number;
    batchSize: number;
  };

function requireCatalogEntry(
  provider: CloudProviderId,
  modelName: string,
  dimensions: number,
): CloudModelCatalogEntry {
  const entry = findCloudCatalogEntry(provider, modelName, dimensions);
  if (!entry) {
    throw new CloudConfigRejectedError(
      `Unknown ${getCloudProviderLabel(provider)} model or dimensions. Select a model from the list.`,
    );
  }
  return entry;
}

function validateBatchSize(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 256) {
    throw new CloudConfigRejectedError('Cloud batch size must be an integer from 1 to 256.');
  }
  return value;
}

function validateMaxInputTokens(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new CloudConfigRejectedError('Maximum input tokens must be a positive integer.');
  }
  return value;
}

export function validateCloudModelSettings(input: CloudModelSettingsInput): CloudModelSettings {
  if (input.provider === 'alibaba-bailian') {
    const entry = requireCatalogEntry(input.provider, input.modelName, input.dimensions);
    if (input.bailianRegion !== 'cn' && input.bailianRegion !== 'intl') {
      throw new CloudConfigRejectedError('The Bailian region must be "cn" or "intl".');
    }
    const maxInputTokens = validateMaxInputTokens(input.maxInputTokens);
    const batchSize = validateBatchSize(input.batchSize);
    return {
      provider: input.provider,
      configured: true,
      baseUrl: input.bailianRegion === 'intl'
        ? BAILIAN_REGION_INTL_BASE_URL
        : CLOUD_DEFAULT_BASE_URL,
      bailianRegion: input.bailianRegion,
      modelName: entry.modelName,
      dimensions: entry.dimensions,
      maxInputTokens,
      recommendedChunkTokens: calculateRecommendedChunkTokens(entry.chunkProfile, maxInputTokens),
      queryRole: normalizeApiRole(input.queryRole, 'Query API role'),
      documentRole: normalizeApiRole(input.documentRole, 'Document API role'),
      batchSize,
      roleContract: entry.roleContract,
      adapterVersion: entry.adapterVersion,
      outputContract: entry.outputContract,
      chunkProfile: entry.chunkProfile,
      customBaseUrl: '',
    };
  }
  if (input.provider === 'custom-openai-compatible') {
    const customBaseUrl = assertCustomProviderBaseUrl(input.baseUrl);
    const modelName = input.modelName.trim();
    if (!modelName) {
      throw new CloudConfigRejectedError('Cloud model name must not be empty.');
    }
    if (!Number.isSafeInteger(input.dimensions) || input.dimensions <= 0) {
      throw new CloudConfigRejectedError('Cloud embedding dimensions must be a positive integer.');
    }
    const maxInputTokens = validateMaxInputTokens(input.maxInputTokens);
    const batchSize = validateBatchSize(input.batchSize);
    return {
      provider: 'custom-openai-compatible',
      configured: true,
      baseUrl: '',
      bailianRegion: 'cn',
      modelName,
      dimensions: input.dimensions,
      maxInputTokens,
      recommendedChunkTokens: calculateRecommendedChunkTokens(CLOUD_CHUNK_PROFILE, maxInputTokens),
      queryRole: '',
      documentRole: '',
      batchSize,
      roleContract: 'none',
      adapterVersion: CUSTOM_OPENAI_COMPATIBLE_ADAPTER_VERSION,
      outputContract: 'none',
      chunkProfile: CLOUD_CHUNK_PROFILE,
      customBaseUrl,
    };
  }
  // Remaining variants: the built-in OpenAI and Google Gemini catalogs.
  const entry = requireCatalogEntry(input.provider, input.modelName, input.dimensions);
  return {
    provider: input.provider,
    configured: true,
    baseUrl: '',
    bailianRegion: 'cn',
    modelName: entry.modelName,
    dimensions: entry.dimensions,
    maxInputTokens: entry.maxInputTokens,
    recommendedChunkTokens: calculateRecommendedChunkTokens(entry.chunkProfile, entry.maxInputTokens),
    queryRole: entry.queryRole,
    documentRole: entry.documentRole,
    batchSize: entry.batchSize,
    roleContract: entry.roleContract,
    adapterVersion: entry.adapterVersion,
    outputContract: entry.outputContract,
    chunkProfile: entry.chunkProfile,
    customBaseUrl: '',
  };
}

/** Model-relevant fields; any change invalidates the provider's verified state. */
function cloudSettingsChangeKey(settings: CloudModelSettings): string {
  return JSON.stringify({
    modelName: settings.modelName,
    dimensions: settings.dimensions,
    maxInputTokens: settings.maxInputTokens,
    queryRole: settings.queryRole,
    documentRole: settings.documentRole,
    batchSize: settings.batchSize,
    bailianRegion: settings.bailianRegion,
    customBaseUrl: settings.customBaseUrl,
  });
}

export function setCloudModelSettings(input: CloudModelSettingsInput): CloudModelSettings {
  const previous = getCloudModelSettings();
  const settings = validateCloudModelSettings(input);
  Zotero.Prefs.set(PROVIDER_PREF, settings.provider, true);
  if (settings.provider === 'alibaba-bailian') {
    Zotero.Prefs.set(BAILIAN_REGION_PREF, settings.bailianRegion, true);
    Zotero.Prefs.set(MODEL_NAME_PREF, settings.modelName, true);
    Zotero.Prefs.set(DIMENSIONS_PREF, settings.dimensions, true);
    Zotero.Prefs.set(MAX_INPUT_TOKENS_PREF, settings.maxInputTokens, true);
    Zotero.Prefs.set(QUERY_ROLE_PREF, settings.queryRole, true);
    Zotero.Prefs.set(DOCUMENT_ROLE_PREF, settings.documentRole, true);
    Zotero.Prefs.set(BATCH_SIZE_PREF, settings.batchSize, true);
  } else if (settings.provider === 'openai' || settings.provider === 'google-gemini-api') {
    Zotero.Prefs.set(MODEL_NAME_PREF, settings.modelName, true);
    Zotero.Prefs.set(DIMENSIONS_PREF, settings.dimensions, true);
  } else {
    Zotero.Prefs.set(CUSTOM_BASE_URL_PREF, settings.customBaseUrl, true);
    Zotero.Prefs.set(CUSTOM_MODEL_NAME_PREF, settings.modelName, true);
    Zotero.Prefs.set(CUSTOM_DIMENSIONS_PREF, settings.dimensions, true);
    Zotero.Prefs.set(CUSTOM_MAX_INPUT_TOKENS_PREF, settings.maxInputTokens, true);
    Zotero.Prefs.set(CUSTOM_BATCH_SIZE_PREF, settings.batchSize, true);
  }
  if (previous.provider === settings.provider
    && cloudSettingsChangeKey(previous) !== cloudSettingsChangeKey(settings)) {
    setCloudConnectionVerified(false, settings.provider);
  }
  // The literature-brief client only works against Bailian. Switching away
  // from Bailian, or moving Bailian to another regional endpoint, invalidates
  // the brief connection state; its model settings are intentionally kept.
  const briefAffected = previous.provider === 'alibaba-bailian'
    !== (settings.provider === 'alibaba-bailian')
    || (settings.provider === 'alibaba-bailian'
      && previous.bailianRegion !== settings.bailianRegion);
  if (briefAffected) {
    Zotero.Prefs.set(BRIEF_CONNECTION_VERIFIED_PREF, false, true);
  }
  return settings;
}

// ---------------------------------------------------------------------------
// Per-provider connection verification and consent
//
// Each provider stores its own verification and consent state. The legacy
// global prefs remain a read-only fallback for Bailian so existing users keep
// their verified/consented state without a data migration; for every other
// provider the legacy values never apply (they were given for Bailian's
// destination only).
// ---------------------------------------------------------------------------

export function isCloudConnectionVerified(provider: CloudProviderId = getCloudProvider()): boolean {
  try {
    const perProvider = Zotero.Prefs.get(providerStatePref(VERIFIED_PREF, provider), true);
    if (perProvider === true || perProvider === false) {
      return perProvider === true
        && Zotero.Prefs.get(providerStatePref(VERIFIED_CONTRACT_PREF, provider), true)
          === CLOUD_CONNECTION_CONTRACT_VERSION;
    }
    if (provider !== CLOUD_PROVIDER_ID) return false;
    return Zotero.Prefs.get(VERIFIED_PREF, true) === true
      && Zotero.Prefs.get(VERIFIED_CONTRACT_PREF, true) === CLOUD_CONNECTION_CONTRACT_VERSION;
  } catch { return false; }
}

export function setCloudConnectionVerified(
  verified: boolean,
  provider: CloudProviderId = getCloudProvider(),
): void {
  Zotero.Prefs.set(providerStatePref(VERIFIED_PREF, provider), verified === true, true);
  Zotero.Prefs.set(
    providerStatePref(VERIFIED_CONTRACT_PREF, provider),
    verified ? CLOUD_CONNECTION_CONTRACT_VERSION : 0,
    true,
  );
}

export function hasCurrentCloudConsent(provider: CloudProviderId = getCloudProvider()): boolean {
  try {
    const perProvider = Zotero.Prefs.get(providerStatePref(CONSENT_VERSION_PREF, provider), true);
    if (typeof perProvider === 'number') return perProvider === CLOUD_CONSENT_VERSION;
    if (provider !== CLOUD_PROVIDER_ID) return false;
    return Zotero.Prefs.get(CONSENT_VERSION_PREF, true) === CLOUD_CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function recordCurrentCloudConsent(provider: CloudProviderId = getCloudProvider()): void {
  Zotero.Prefs.set(providerStatePref(CONSENT_VERSION_PREF, provider), CLOUD_CONSENT_VERSION, true);
}

export function isCloudAutoIndexAllowed(): boolean {
  try { return Zotero.Prefs.get(AUTO_INDEX_PREF, true) === true; } catch { return false; }
}

/** Pure startup gate used by AutoIndexManager and unit tests. */
export function allowsStartupAutoIndex(
  globalEnabled: boolean,
  cloudSelected: boolean,
  cloudAllowed: boolean,
  cloudReady = true,
): boolean {
  return globalEnabled && (!cloudSelected || (cloudAllowed && cloudReady));
}

export function setCloudAutoIndexAllowed(allowed: boolean): void {
  Zotero.Prefs.set(AUTO_INDEX_PREF, allowed === true, true);
}

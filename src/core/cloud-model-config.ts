/** Stable, non-secret configuration for the fixed Cloud embedding slot. */

import { BRIEF_CONNECTION_VERIFIED_PREF } from './brief-generation-config';
import type { ModelChunkProfile } from './model-chunk-profile';

declare const Zotero: any;

export const CLOUD_PROVIDER_ID = 'alibaba-bailian';
export const CLOUD_PROVIDER_LABEL = 'Alibaba Cloud Model Studio (Bailian)';
// The Cloud Base URL is also shared by the literature-brief client, which uses
// Bailian's OpenAI-compatible chat endpoint. The embedding adapter derives the
// provider-native /api/v1 URL without changing this persisted value.
export const CLOUD_DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
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

export const CLOUD_PROVIDER_OPTIONS = Object.freeze([{
  id: CLOUD_PROVIDER_ID,
  label: CLOUD_PROVIDER_LABEL,
  defaultBaseUrl: CLOUD_DEFAULT_BASE_URL,
  defaultQueryRole: CLOUD_DEFAULT_QUERY_ROLE,
  defaultDocumentRole: CLOUD_DEFAULT_DOCUMENT_ROLE,
}]);

const PROVIDER_PREF = 'zotseek.cloud.provider';
const BASE_URL_PREF = 'zotseek.cloud.baseUrl';
const MODEL_NAME_PREF = 'zotseek.cloud.modelName';
const DIMENSIONS_PREF = 'zotseek.cloud.dimensions';
const MAX_INPUT_TOKENS_PREF = 'zotseek.cloud.maxInputTokens';
const QUERY_ROLE_PREF = 'zotseek.cloud.queryRole';
const DOCUMENT_ROLE_PREF = 'zotseek.cloud.documentRole';
const BATCH_SIZE_PREF = 'zotseek.cloud.batchSize';
const VERIFIED_PREF = 'zotseek.cloud.connectionVerified';
const VERIFIED_CONTRACT_PREF = 'zotseek.cloud.connectionVerifiedContract';
const AUTO_INDEX_PREF = 'zotseek.cloud.autoIndex';
const CONSENT_VERSION_PREF = 'zotseek.cloud.consentVersion';

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

export interface CloudModelSettings {
  provider: typeof CLOUD_PROVIDER_ID;
  baseUrl: string;
  modelName: string;
  dimensions: number;
  maxInputTokens: number;
  recommendedChunkTokens: number;
  queryRole: string;
  documentRole: string;
  batchSize: number;
}

export interface CloudModelSettingsInput {
  provider: string;
  baseUrl: string;
  modelName: string;
  dimensions: number;
  maxInputTokens: number;
  queryRole: string;
  documentRole: string;
  batchSize: number;
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

export function getCloudModelSettings(): CloudModelSettings {
  // The preference remains explicit so adding another approved provider later
  // does not change the persisted schema. The first release allowlists Bailian.
  const provider = CLOUD_PROVIDER_ID;
  const candidate = storedString(BASE_URL_PREF, CLOUD_DEFAULT_BASE_URL);
  let baseUrl = CLOUD_DEFAULT_BASE_URL;
  try { baseUrl = assertCloudBaseUrl(candidate).href.replace(/\/$/, ''); } catch { /* safe default */ }
  const maxInputTokens = storedPositiveInteger(MAX_INPUT_TOKENS_PREF, CLOUD_MAX_INPUT_TOKENS);
  return {
    provider,
    baseUrl,
    modelName: storedString(MODEL_NAME_PREF, CLOUD_MODEL_NAME),
    dimensions: storedPositiveInteger(DIMENSIONS_PREF, CLOUD_MODEL_DIMENSIONS),
    maxInputTokens,
    recommendedChunkTokens: calculateCloudRecommendedChunkTokens(maxInputTokens),
    queryRole: storedString(QUERY_ROLE_PREF, CLOUD_DEFAULT_QUERY_ROLE, false).trim(),
    documentRole: storedString(DOCUMENT_ROLE_PREF, CLOUD_DEFAULT_DOCUMENT_ROLE, false).trim(),
    batchSize: storedPositiveInteger(BATCH_SIZE_PREF, CLOUD_BATCH_SIZE),
  };
}

export function validateCloudModelSettings(input: CloudModelSettingsInput): CloudModelSettings {
  if (input.provider !== CLOUD_PROVIDER_ID) {
    throw new CloudConfigRejectedError('Unsupported Cloud provider.');
  }
  const modelName = input.modelName.trim();
  if (!modelName) throw new CloudConfigRejectedError('Cloud model name must not be empty.');
  if (!Number.isSafeInteger(input.dimensions) || input.dimensions <= 0) {
    throw new CloudConfigRejectedError('Cloud embedding dimensions must be a positive integer.');
  }
  if (!Number.isSafeInteger(input.batchSize) || input.batchSize <= 0 || input.batchSize > 256) {
    throw new CloudConfigRejectedError('Cloud batch size must be an integer from 1 to 256.');
  }
  const baseUrl = assertCloudBaseUrl(input.baseUrl).href.replace(/\/$/, '');
  return {
    provider: CLOUD_PROVIDER_ID,
    baseUrl,
    modelName,
    dimensions: input.dimensions,
    maxInputTokens: input.maxInputTokens,
    recommendedChunkTokens: calculateCloudRecommendedChunkTokens(input.maxInputTokens),
    queryRole: normalizeApiRole(input.queryRole, 'Query API role'),
    documentRole: normalizeApiRole(input.documentRole, 'Document API role'),
    batchSize: input.batchSize,
  };
}

export function setCloudModelSettings(input: CloudModelSettingsInput): CloudModelSettings {
  const previous = getCloudModelSettings();
  const settings = validateCloudModelSettings(input);
  Zotero.Prefs.set(PROVIDER_PREF, settings.provider, true);
  Zotero.Prefs.set(BASE_URL_PREF, settings.baseUrl, true);
  Zotero.Prefs.set(MODEL_NAME_PREF, settings.modelName, true);
  Zotero.Prefs.set(DIMENSIONS_PREF, settings.dimensions, true);
  Zotero.Prefs.set(MAX_INPUT_TOKENS_PREF, settings.maxInputTokens, true);
  Zotero.Prefs.set(QUERY_ROLE_PREF, settings.queryRole, true);
  Zotero.Prefs.set(DOCUMENT_ROLE_PREF, settings.documentRole, true);
  Zotero.Prefs.set(BATCH_SIZE_PREF, settings.batchSize, true);
  if (JSON.stringify(previous) !== JSON.stringify(settings)) {
    Zotero.Prefs.set(VERIFIED_PREF, false, true);
    Zotero.Prefs.set(VERIFIED_CONTRACT_PREF, 0, true);
    if (previous.provider !== settings.provider || previous.baseUrl !== settings.baseUrl) {
      Zotero.Prefs.set(BRIEF_CONNECTION_VERIFIED_PREF, false, true);
    }
  }
  return settings;
}

/** Kept as a narrow compatibility helper for existing callers and tests. */
export function setCloudBaseUrl(value: string): string {
  return setCloudModelSettings({ ...getCloudModelSettings(), baseUrl: value }).baseUrl;
}

export function isCloudConnectionVerified(): boolean {
  try {
    return Zotero.Prefs.get(VERIFIED_PREF, true) === true
      && Zotero.Prefs.get(VERIFIED_CONTRACT_PREF, true) === CLOUD_CONNECTION_CONTRACT_VERSION;
  } catch { return false; }
}

export function setCloudConnectionVerified(verified: boolean): void {
  Zotero.Prefs.set(VERIFIED_PREF, verified === true, true);
  Zotero.Prefs.set(
    VERIFIED_CONTRACT_PREF,
    verified ? CLOUD_CONNECTION_CONTRACT_VERSION : 0,
    true,
  );
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

export function hasCurrentCloudConsent(): boolean {
  try {
    return Zotero.Prefs.get(CONSENT_VERSION_PREF, true) === CLOUD_CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function recordCurrentCloudConsent(): void {
  Zotero.Prefs.set(CONSENT_VERSION_PREF, CLOUD_CONSENT_VERSION, true);
}

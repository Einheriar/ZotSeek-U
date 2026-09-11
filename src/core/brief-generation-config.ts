/** Stable configuration for the provider-following literature-brief slot. */

import type { CloudProviderId } from './cloud-model-config';

declare const Zotero: any;

export const BRIEF_MODEL_NAME = 'deepseek-v4-flash-0731';
export const BRIEF_MAX_INPUT_TOKENS = 1_000_000;
export const BRIEF_MAX_OUTPUT_TOKENS = 16_384;
export const BRIEF_CLASSIFIER_MAX_COMPLETION_TOKENS = 4096;
export const BRIEF_THINKING_ENABLED = true;
export const BRIEF_PIPELINE_VERSION = 2;
export const BRIEF_CONSENT_VERSION = 1;

export const BRIEF_CONNECTION_VERIFIED_PREF =
  'zotseek.cloud.brief.connectionVerified';
export const BRIEF_CONFIG_FINGERPRINT_PREF =
  'zotseek.cloud.brief.configFingerprint';
export const BRIEF_CONFIG_REVISION_PREF =
  'zotseek.cloud.brief.configRevision';

const MODEL_NAME_PREF = 'zotseek.cloud.brief.modelName';
const MAX_INPUT_TOKENS_PREF = 'zotseek.cloud.brief.maxInputTokens';
const MAX_OUTPUT_TOKENS_PREF = 'zotseek.cloud.brief.maxOutputTokens';
const THINKING_ENABLED_PREF = 'zotseek.cloud.brief.thinkingEnabled';
const CONSENT_VERSION_PREF = 'zotseek.cloud.brief.consentVersion';

const PROVIDERS: readonly CloudProviderId[] = [
  'alibaba-bailian',
  'openai',
  'google-gemini-api',
  'custom-openai-compatible',
];

export interface BriefGenerationSettings {
  modelName: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  thinkingEnabled: boolean;
}

export interface BriefGenerationSettingsInput extends BriefGenerationSettings {}

export type BriefGenerationConfigStatus = 'default' | 'valid' | 'invalid';

export interface BriefGenerationConfigSnapshot {
  provider: CloudProviderId;
  settings: BriefGenerationSettings;
  status: BriefGenerationConfigStatus;
  fingerprint: string;
  revision: number;
  error?: string;
}

export interface BriefConnectionVerificationBinding {
  configFingerprint: string;
  configRevision: number;
  credentialRevision?: string | number;
  endpointFingerprint?: string;
}

export class BriefGenerationConfigError extends Error {
  readonly code = 'BRIEF_GENERATION_CONFIG_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'BriefGenerationConfigError';
  }
}

function readPref(key: string): unknown {
  try { return Zotero.Prefs.get(key, true); } catch { return undefined; }
}

function activeProvider(): CloudProviderId {
  const value = readPref('zotseek.cloud.provider');
  return PROVIDERS.includes(value as CloudProviderId)
    ? value as CloudProviderId
    : 'alibaba-bailian';
}

function scoped(base: string, provider: CloudProviderId): string {
  return `${base}.${provider}`;
}

/** Bailian keeps a read-only fallback to the pre-P7 unscoped preferences. */
function providerPref(base: string, provider: CloudProviderId): unknown {
  const value = readPref(scoped(base, provider));
  if (value !== undefined && value !== null) return value;
  return provider === 'alibaba-bailian' ? readPref(base) : undefined;
}

function defaultSettings(provider: CloudProviderId): BriefGenerationSettings {
  if (provider === 'alibaba-bailian') {
    return {
      modelName: BRIEF_MODEL_NAME,
      maxInputTokens: BRIEF_MAX_INPUT_TOKENS,
      maxOutputTokens: BRIEF_MAX_OUTPUT_TOKENS,
      thinkingEnabled: BRIEF_THINKING_ENABLED,
    };
  }
  return {
    modelName: '',
    maxInputTokens: 32_000,
    maxOutputTokens: 8192,
    thinkingEnabled: false,
  };
}

export function validateBriefGenerationSettings(
  input: BriefGenerationSettingsInput,
): BriefGenerationSettings {
  const modelName = typeof input.modelName === 'string' ? input.modelName.trim() : '';
  if (!modelName) {
    throw new BriefGenerationConfigError('Brief generation model name must not be empty.');
  }
  if (!Number.isSafeInteger(input.maxInputTokens) || input.maxInputTokens <= 0) {
    throw new BriefGenerationConfigError(
      'Brief generation maximum input tokens must be a positive integer.',
    );
  }
  if (!Number.isSafeInteger(input.maxOutputTokens) || input.maxOutputTokens <= 0) {
    throw new BriefGenerationConfigError(
      'Brief generation maximum output tokens must be a positive integer.',
    );
  }
  if (input.maxOutputTokens < BRIEF_CLASSIFIER_MAX_COMPLETION_TOKENS) {
    throw new BriefGenerationConfigError(
      `Brief generation maximum output tokens must be at least ${BRIEF_CLASSIFIER_MAX_COMPLETION_TOKENS}.`,
    );
  }
  if (typeof input.thinkingEnabled !== 'boolean') {
    throw new BriefGenerationConfigError('Brief generation thinking mode must be a boolean.');
  }
  return {
    modelName,
    maxInputTokens: input.maxInputTokens,
    maxOutputTokens: input.maxOutputTokens,
    thinkingEnabled: input.thinkingEnabled,
  };
}

function briefFingerprint(provider: CloudProviderId, settings: BriefGenerationSettings): string {
  const input = `brief-config-v${BRIEF_PIPELINE_VERSION}:${provider}:${JSON.stringify(settings)}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function storedRevision(provider: CloudProviderId): number {
  const value = Number(providerPref(BRIEF_CONFIG_REVISION_PREF, provider));
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function nextRevision(provider: CloudProviderId): number {
  const revision = storedRevision(provider) + 1;
  Zotero.Prefs.set(scoped(BRIEF_CONFIG_REVISION_PREF, provider), revision, true);
  return revision;
}

export function getBriefGenerationConfigSnapshot(
  provider: CloudProviderId = activeProvider(),
): BriefGenerationConfigSnapshot {
  const defaults = defaultSettings(provider);
  const values = [
    MODEL_NAME_PREF,
    MAX_INPUT_TOKENS_PREF,
    MAX_OUTPUT_TOKENS_PREF,
    THINKING_ENABLED_PREF,
  ].map(key => providerPref(key, provider));
  const anyStored = values.some(value => value !== undefined);
  if (!anyStored) {
    return {
      provider,
      settings: defaults,
      status: 'default',
      fingerprint: briefFingerprint(provider, defaults),
      revision: storedRevision(provider),
    };
  }
  const raw: BriefGenerationSettingsInput = {
    modelName: typeof values[0] === 'string' ? values[0] : defaults.modelName,
    maxInputTokens: values[1] === undefined ? defaults.maxInputTokens : Number(values[1]),
    maxOutputTokens: values[2] === undefined ? defaults.maxOutputTokens : Number(values[2]),
    thinkingEnabled: values[3] === undefined ? defaults.thinkingEnabled : values[3] === true,
  };
  try {
    const settings = validateBriefGenerationSettings(raw);
    return {
      provider,
      settings,
      status: 'valid',
      fingerprint: briefFingerprint(provider, settings),
      revision: storedRevision(provider),
    };
  } catch (error: any) {
    const errorMessage = error instanceof BriefGenerationConfigError
      ? error.message
      : 'Stored brief generation configuration is invalid.';
    setBriefConnectionVerified(false, undefined, provider);
    return {
      provider,
      settings: raw,
      status: 'invalid',
      fingerprint: briefFingerprint(provider, raw),
      revision: storedRevision(provider),
      error: errorMessage,
    };
  }
}

export function getBriefGenerationSettings(
  provider: CloudProviderId = activeProvider(),
): BriefGenerationSettings {
  return getBriefGenerationConfigSnapshot(provider).settings;
}

export function setBriefGenerationSettings(
  input: BriefGenerationSettingsInput,
  provider: CloudProviderId = activeProvider(),
): BriefGenerationSettings {
  const previous = getBriefGenerationConfigSnapshot(provider);
  const settings = validateBriefGenerationSettings(input);
  Zotero.Prefs.set(scoped(MODEL_NAME_PREF, provider), settings.modelName, true);
  Zotero.Prefs.set(scoped(MAX_INPUT_TOKENS_PREF, provider), settings.maxInputTokens, true);
  Zotero.Prefs.set(scoped(MAX_OUTPUT_TOKENS_PREF, provider), settings.maxOutputTokens, true);
  Zotero.Prefs.set(scoped(THINKING_ENABLED_PREF, provider), settings.thinkingEnabled, true);
  if (previous.status !== 'valid'
      || JSON.stringify(previous.settings) !== JSON.stringify(settings)) {
    nextRevision(provider);
    setBriefConnectionVerified(false, undefined, provider);
  }
  return settings;
}

export function getBriefGenerationConfigFingerprint(
  provider: CloudProviderId = activeProvider(),
): string {
  return getBriefGenerationConfigSnapshot(provider).fingerprint;
}

export function getBriefGenerationConfigRevision(
  provider: CloudProviderId = activeProvider(),
): number {
  return getBriefGenerationConfigSnapshot(provider).revision;
}

function readVerificationBinding(provider: CloudProviderId): BriefConnectionVerificationBinding | null {
  const value = providerPref(`${BRIEF_CONNECTION_VERIFIED_PREF}.binding`, provider);
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object'
      ? parsed as BriefConnectionVerificationBinding
      : null;
  } catch { return null; }
}

export function isBriefConnectionVerified(
  expected?: Partial<BriefConnectionVerificationBinding>,
  provider: CloudProviderId = activeProvider(),
): boolean {
  try {
    if (providerPref(BRIEF_CONNECTION_VERIFIED_PREF, provider) !== true) return false;
    const snapshot = getBriefGenerationConfigSnapshot(provider);
    if (snapshot.status === 'invalid' || !snapshot.settings.modelName) return false;
    if (providerPref(BRIEF_CONFIG_FINGERPRINT_PREF, provider) !== snapshot.fingerprint) return false;
    const binding = readVerificationBinding(provider);
    if (!binding || binding.configFingerprint !== snapshot.fingerprint
        || binding.configRevision !== snapshot.revision) return false;
    if (expected?.configFingerprint !== undefined
        && binding.configFingerprint !== expected.configFingerprint) return false;
    if (expected?.configRevision !== undefined
        && binding.configRevision !== expected.configRevision) return false;
    if (expected?.credentialRevision !== undefined
        && binding.credentialRevision !== expected.credentialRevision) return false;
    if (expected?.endpointFingerprint !== undefined
        && binding.endpointFingerprint !== expected.endpointFingerprint) return false;
    return true;
  } catch { return false; }
}

export function getBriefConnectionVerificationBinding(
  provider: CloudProviderId = activeProvider(),
): BriefConnectionVerificationBinding | null {
  return readVerificationBinding(provider);
}

export function setBriefConnectionVerified(
  verified: boolean,
  binding?: Partial<BriefConnectionVerificationBinding>,
  provider: CloudProviderId = activeProvider(),
): void {
  const verifiedPref = scoped(BRIEF_CONNECTION_VERIFIED_PREF, provider);
  const fingerprintPref = scoped(BRIEF_CONFIG_FINGERPRINT_PREF, provider);
  const bindingPref = scoped(`${BRIEF_CONNECTION_VERIFIED_PREF}.binding`, provider);
  Zotero.Prefs.set(verifiedPref, verified === true, true);
  if (provider === 'alibaba-bailian') {
    Zotero.Prefs.set(BRIEF_CONNECTION_VERIFIED_PREF, verified === true, true);
  }
  if (verified) {
    const snapshot = getBriefGenerationConfigSnapshot(provider);
    const complete: BriefConnectionVerificationBinding = {
      configFingerprint: binding?.configFingerprint || snapshot.fingerprint,
      configRevision: binding?.configRevision ?? snapshot.revision,
      ...(binding?.credentialRevision !== undefined
        ? { credentialRevision: binding.credentialRevision } : {}),
      ...(binding?.endpointFingerprint !== undefined
        ? { endpointFingerprint: binding.endpointFingerprint } : {}),
    };
    Zotero.Prefs.set(fingerprintPref, complete.configFingerprint, true);
    Zotero.Prefs.set(bindingPref, JSON.stringify(complete), true);
    if (provider === 'alibaba-bailian') {
      Zotero.Prefs.set(BRIEF_CONFIG_FINGERPRINT_PREF, complete.configFingerprint, true);
      Zotero.Prefs.set(
        `${BRIEF_CONNECTION_VERIFIED_PREF}.binding`,
        JSON.stringify(complete),
        true,
      );
    }
  } else {
    Zotero.Prefs.set(fingerprintPref, '', true);
    Zotero.Prefs.set(bindingPref, '', true);
    if (provider === 'alibaba-bailian') {
      Zotero.Prefs.set(BRIEF_CONFIG_FINGERPRINT_PREF, '', true);
      Zotero.Prefs.set(`${BRIEF_CONNECTION_VERIFIED_PREF}.binding`, '', true);
    }
  }
}

export function invalidateBriefConnectionVerification(
  provider: CloudProviderId = activeProvider(),
): void {
  setBriefConnectionVerified(false, undefined, provider);
}

/** @deprecated Read-only compatibility for profiles written before per-operation confirmation. */
export function hasCurrentBriefConsent(
  provider: CloudProviderId = activeProvider(),
): boolean {
  try { return providerPref(CONSENT_VERSION_PREF, provider) === BRIEF_CONSENT_VERSION; }
  catch { return false; }
}

/** @deprecated Production generation and setup flows must not persist paper consent. */
export function recordCurrentBriefConsent(
  provider: CloudProviderId = activeProvider(),
): void {
  Zotero.Prefs.set(scoped(CONSENT_VERSION_PREF, provider), BRIEF_CONSENT_VERSION, true);
  // Keep the pre-P7 Bailian value readable by older builds without allowing
  // consent for one provider to authorize a different data recipient.
  if (provider === 'alibaba-bailian') {
    Zotero.Prefs.set(CONSENT_VERSION_PREF, BRIEF_CONSENT_VERSION, true);
  }
}

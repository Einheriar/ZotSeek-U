/** Stable configuration for the Cloud literature-brief generation slot. */

declare const Zotero: any;

export const BRIEF_MODEL_NAME = 'deepseek-v4-flash-0731';
export const BRIEF_MAX_INPUT_TOKENS = 1_000_000;
export const BRIEF_MAX_OUTPUT_TOKENS = 16_384;
export const BRIEF_CLASSIFIER_MAX_COMPLETION_TOKENS = 4096;
export const BRIEF_THINKING_ENABLED = true;
export const BRIEF_PIPELINE_VERSION = 1;
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

export interface BriefGenerationSettings {
  modelName: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  thinkingEnabled: boolean;
}

export interface BriefGenerationSettingsInput {
  modelName: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  thinkingEnabled: boolean;
}

export type BriefGenerationConfigStatus = 'default' | 'valid' | 'invalid';

export interface BriefGenerationConfigSnapshot {
  settings: BriefGenerationSettings;
  status: BriefGenerationConfigStatus;
  /** A non-secret digest of the generation settings and protocol version. */
  fingerprint: string;
  /** Monotonic local revision; callers may bind async verification to it. */
  revision: number;
  error?: string;
}

export interface BriefConnectionVerificationBinding {
  configFingerprint: string;
  configRevision: number;
  /** Optional caller-owned, non-secret credential/endpoint revision. */
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

function hasPref(key: string): boolean {
  return readPref(key) !== undefined;
}

export function validateBriefGenerationSettings(
  input: BriefGenerationSettingsInput,
): BriefGenerationSettings {
  const modelName = input.modelName.trim();
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
  // Provider contracts may publish separate prompt-input and completion
  // ceilings. Their relative sizes are not a reliable context-window check.
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

const DEFAULT_BRIEF_SETTINGS: BriefGenerationSettings = Object.freeze({
  modelName: BRIEF_MODEL_NAME,
  maxInputTokens: BRIEF_MAX_INPUT_TOKENS,
  maxOutputTokens: BRIEF_MAX_OUTPUT_TOKENS,
  thinkingEnabled: BRIEF_THINKING_ENABLED,
});

function briefFingerprint(settings: BriefGenerationSettings): string {
  // FNV-1a is sufficient here: this is an equality binding, not a secret hash.
  const input = `brief-config-v${BRIEF_PIPELINE_VERSION}:${JSON.stringify(settings)}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function storedRevision(): number {
  const value = Number(readPref(BRIEF_CONFIG_REVISION_PREF));
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function nextRevision(): number {
  const revision = storedRevision() + 1;
  Zotero.Prefs.set(BRIEF_CONFIG_REVISION_PREF, revision, true);
  return revision;
}

export function getBriefGenerationConfigSnapshot(): BriefGenerationConfigSnapshot {
  const anyStored = [
    MODEL_NAME_PREF,
    MAX_INPUT_TOKENS_PREF,
    MAX_OUTPUT_TOKENS_PREF,
    THINKING_ENABLED_PREF,
  ].some(hasPref);
  const raw = {
    modelName: readPref(MODEL_NAME_PREF),
    maxInputTokens: readPref(MAX_INPUT_TOKENS_PREF),
    maxOutputTokens: readPref(MAX_OUTPUT_TOKENS_PREF),
    thinkingEnabled: readPref(THINKING_ENABLED_PREF),
  };
  if (!anyStored) {
    return {
      settings: DEFAULT_BRIEF_SETTINGS,
      status: 'default',
      fingerprint: briefFingerprint(DEFAULT_BRIEF_SETTINGS),
      revision: storedRevision(),
    };
  }
  try {
    const settings = validateBriefGenerationSettings(raw as BriefGenerationSettingsInput);
    return {
      settings,
      status: 'valid',
      fingerprint: briefFingerprint(settings),
      revision: storedRevision(),
    };
  } catch (error: any) {
    const message = error instanceof BriefGenerationConfigError
      ? error.message
      : 'Stored brief generation configuration is invalid.';
    // A damaged value must never preserve an earlier successful verification.
    setBriefConnectionVerified(false);
    return {
      settings: DEFAULT_BRIEF_SETTINGS,
      status: 'invalid',
      fingerprint: briefFingerprint(DEFAULT_BRIEF_SETTINGS),
      revision: storedRevision(),
      error: message,
    };
  }
}

export function getBriefGenerationSettings(): BriefGenerationSettings {
  return getBriefGenerationConfigSnapshot().settings;
}

export function setBriefGenerationSettings(
  input: BriefGenerationSettingsInput,
): BriefGenerationSettings {
  const previousSnapshot = getBriefGenerationConfigSnapshot();
  const settings = validateBriefGenerationSettings(input);
  Zotero.Prefs.set(MODEL_NAME_PREF, settings.modelName, true);
  Zotero.Prefs.set(MAX_INPUT_TOKENS_PREF, settings.maxInputTokens, true);
  Zotero.Prefs.set(MAX_OUTPUT_TOKENS_PREF, settings.maxOutputTokens, true);
  Zotero.Prefs.set(THINKING_ENABLED_PREF, settings.thinkingEnabled, true);
  if (previousSnapshot.status !== 'valid'
      || JSON.stringify(previousSnapshot.settings) !== JSON.stringify(settings)) {
    nextRevision();
    setBriefConnectionVerified(false);
  }
  return settings;
}

export function getBriefGenerationConfigFingerprint(): string {
  return getBriefGenerationConfigSnapshot().fingerprint;
}

export function getBriefGenerationConfigRevision(): number {
  return getBriefGenerationConfigSnapshot().revision;
}

export function isBriefConnectionVerified(
  expected?: Partial<BriefConnectionVerificationBinding>,
): boolean {
  try {
    if (Zotero.Prefs.get(BRIEF_CONNECTION_VERIFIED_PREF, true) !== true) return false;
    const snapshot = getBriefGenerationConfigSnapshot();
    if (snapshot.status === 'invalid') return false;
    const storedFingerprint = Zotero.Prefs.get(BRIEF_CONFIG_FINGERPRINT_PREF, true);
    const storedConfigRevisionRaw = Number(Zotero.Prefs.get(BRIEF_CONFIG_REVISION_PREF, true));
    const storedConfigRevision = Number.isSafeInteger(storedConfigRevisionRaw)
      ? storedConfigRevisionRaw : snapshot.revision;
    if (storedFingerprint !== snapshot.fingerprint || storedConfigRevision !== snapshot.revision) {
      return false;
    }
    const binding = readVerificationBinding();
    if (!binding || binding.configFingerprint !== snapshot.fingerprint
        || binding.configRevision !== snapshot.revision) return false;
    if (expected?.configFingerprint !== undefined && binding?.configFingerprint !== expected.configFingerprint) return false;
    if (expected?.configRevision !== undefined && binding?.configRevision !== expected.configRevision) return false;
    if (expected?.credentialRevision !== undefined && binding?.credentialRevision !== expected.credentialRevision) return false;
    if (expected?.endpointFingerprint !== undefined && binding?.endpointFingerprint !== expected.endpointFingerprint) return false;
    return true;
  } catch { return false; }
}

function readVerificationBinding(): BriefConnectionVerificationBinding | null {
  const value = readPref(`${BRIEF_CONNECTION_VERIFIED_PREF}.binding`);
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object'
      ? parsed as BriefConnectionVerificationBinding
      : null;
  } catch {
    return null;
  }
}

export function getBriefConnectionVerificationBinding(): BriefConnectionVerificationBinding | null {
  return readVerificationBinding();
}

export function setBriefConnectionVerified(
  verified: boolean,
  binding?: Partial<BriefConnectionVerificationBinding>,
): void {
  Zotero.Prefs.set(BRIEF_CONNECTION_VERIFIED_PREF, verified === true, true);
  if (verified) {
    const snapshot = getBriefGenerationConfigSnapshot();
    const complete: BriefConnectionVerificationBinding = {
      configFingerprint: binding?.configFingerprint || snapshot.fingerprint,
      configRevision: binding?.configRevision ?? snapshot.revision,
      ...(binding?.credentialRevision !== undefined
        ? { credentialRevision: binding.credentialRevision } : {}),
      ...(binding?.endpointFingerprint !== undefined
        ? { endpointFingerprint: binding.endpointFingerprint } : {}),
    };
    Zotero.Prefs.set(BRIEF_CONFIG_FINGERPRINT_PREF, complete.configFingerprint, true);
    if (!Number.isSafeInteger(Number(readPref(BRIEF_CONFIG_REVISION_PREF)))) {
      Zotero.Prefs.set(BRIEF_CONFIG_REVISION_PREF, snapshot.revision, true);
    }
    Zotero.Prefs.set(
      `${BRIEF_CONNECTION_VERIFIED_PREF}.binding`,
      JSON.stringify(complete),
      true,
    );
  } else {
    Zotero.Prefs.set(BRIEF_CONFIG_FINGERPRINT_PREF, '', true);
    Zotero.Prefs.set(`${BRIEF_CONNECTION_VERIFIED_PREF}.binding`, '', true);
  }
}

/** Invalidate verification when a caller-owned credential or endpoint changes. */
export function invalidateBriefConnectionVerification(): void {
  setBriefConnectionVerified(false);
}

export function hasCurrentBriefConsent(): boolean {
  try {
    return Zotero.Prefs.get(CONSENT_VERSION_PREF, true) === BRIEF_CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function recordCurrentBriefConsent(): void {
  Zotero.Prefs.set(CONSENT_VERSION_PREF, BRIEF_CONSENT_VERSION, true);
}

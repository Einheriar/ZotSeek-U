/** Stable configuration for the Cloud literature-brief generation slot. */

declare const Zotero: any;

export const BRIEF_MODEL_NAME = 'deepseek-v4-flash-0731';
export const BRIEF_MAX_INPUT_TOKENS = 1_000_000;
export const BRIEF_MAX_OUTPUT_TOKENS = 16_384;
export const BRIEF_THINKING_ENABLED = true;
export const BRIEF_PIPELINE_VERSION = 1;
export const BRIEF_CONSENT_VERSION = 1;

export const BRIEF_CONNECTION_VERIFIED_PREF =
  'zotseek.cloud.brief.connectionVerified';

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

function storedString(key: string, fallback: string): string {
  const value = readPref(key);
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function storedPositiveInteger(key: string, fallback: number): number {
  const value = Number(readPref(key));
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function storedBoolean(key: string, fallback: boolean): boolean {
  const value = readPref(key);
  return typeof value === 'boolean' ? value : fallback;
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
  if (input.maxOutputTokens >= input.maxInputTokens) {
    throw new BriefGenerationConfigError(
      'Brief generation maximum output tokens must be smaller than the input budget.',
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

export function getBriefGenerationSettings(): BriefGenerationSettings {
  const stored = {
    modelName: storedString(MODEL_NAME_PREF, BRIEF_MODEL_NAME),
    maxInputTokens: storedPositiveInteger(MAX_INPUT_TOKENS_PREF, BRIEF_MAX_INPUT_TOKENS),
    maxOutputTokens: storedPositiveInteger(MAX_OUTPUT_TOKENS_PREF, BRIEF_MAX_OUTPUT_TOKENS),
    thinkingEnabled: storedBoolean(THINKING_ENABLED_PREF, BRIEF_THINKING_ENABLED),
  };
  try {
    return validateBriefGenerationSettings(stored);
  } catch {
    return {
      modelName: BRIEF_MODEL_NAME,
      maxInputTokens: BRIEF_MAX_INPUT_TOKENS,
      maxOutputTokens: BRIEF_MAX_OUTPUT_TOKENS,
      thinkingEnabled: BRIEF_THINKING_ENABLED,
    };
  }
}

export function setBriefGenerationSettings(
  input: BriefGenerationSettingsInput,
): BriefGenerationSettings {
  const previous = getBriefGenerationSettings();
  const settings = validateBriefGenerationSettings(input);
  Zotero.Prefs.set(MODEL_NAME_PREF, settings.modelName, true);
  Zotero.Prefs.set(MAX_INPUT_TOKENS_PREF, settings.maxInputTokens, true);
  Zotero.Prefs.set(MAX_OUTPUT_TOKENS_PREF, settings.maxOutputTokens, true);
  Zotero.Prefs.set(THINKING_ENABLED_PREF, settings.thinkingEnabled, true);
  if (JSON.stringify(previous) !== JSON.stringify(settings)) {
    setBriefConnectionVerified(false);
  }
  return settings;
}

export function isBriefConnectionVerified(): boolean {
  try { return Zotero.Prefs.get(BRIEF_CONNECTION_VERIFIED_PREF, true) === true; } catch { return false; }
}

export function setBriefConnectionVerified(verified: boolean): void {
  Zotero.Prefs.set(BRIEF_CONNECTION_VERIFIED_PREF, verified === true, true);
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

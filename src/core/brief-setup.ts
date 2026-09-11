/** Versioned first-use state for the literature-brief guide. */

declare const Zotero: any;

export const BRIEF_SETUP_VERSION = 1;
export const BRIEF_SETUP_VERSION_PREF = 'zotseek.brief.setup.version';
export const BRIEF_SETUP_CHOICE_PREF = 'zotseek.brief.setup.choice';

export type BriefSetupChoice = 'bundled' | 'customized' | 'imported';
export type BriefSetupStatus =
  | 'disabled'
  | 'service_required'
  | 'prompts_required'
  | 'ready'
  | 'damaged';
export type BriefSetupDamageReason = 'choice' | 'version' | 'prompts';

export interface BriefSetupSnapshot {
  status: BriefSetupStatus;
  choice: BriefSetupChoice | null;
  version: number;
  damageReason?: BriefSetupDamageReason;
}

function readPref(key: string): unknown {
  try { return Zotero.Prefs.get(key, true); } catch { return undefined; }
}

function storedChoice(): BriefSetupChoice | null | 'damaged' {
  const choice = readPref(BRIEF_SETUP_CHOICE_PREF);
  if (choice === undefined || choice === null || choice === '') return null;
  return choice === 'bundled' || choice === 'customized' || choice === 'imported'
    ? choice
    : 'damaged';
}

export function getBriefSetupSnapshot(input: {
  enabled: boolean;
  connectionVerified: boolean;
  promptsAvailable: boolean;
  promptsDamaged?: boolean;
}): BriefSetupSnapshot {
  const storedVersion = readPref(BRIEF_SETUP_VERSION_PREF);
  const hasStoredVersion = storedVersion !== undefined
    && storedVersion !== null
    && storedVersion !== '';
  const parsedVersion = Number(storedVersion);
  const versionIsValid = Number.isSafeInteger(parsedVersion) && parsedVersion >= 0;
  const version = versionIsValid ? parsedVersion : 0;
  const choice = storedChoice();
  if (!input.enabled) {
    return { status: 'disabled', choice: choice === 'damaged' ? null : choice, version };
  }
  if (choice === 'damaged') {
    return { status: 'damaged', choice: null, version, damageReason: 'choice' };
  }
  if ((hasStoredVersion && !versionIsValid)
      || (version !== 0 && version !== BRIEF_SETUP_VERSION)) {
    return { status: 'damaged', choice, version, damageReason: 'version' };
  }
  if (input.promptsDamaged) {
    return { status: 'damaged', choice, version, damageReason: 'prompts' };
  }
  if (!input.connectionVerified) {
    return { status: 'service_required', choice, version };
  }
  if (!input.promptsAvailable || !choice || version !== BRIEF_SETUP_VERSION) {
    return { status: 'prompts_required', choice, version };
  }
  return { status: 'ready', choice, version };
}

export function markBriefSetupChoice(choice: BriefSetupChoice): void {
  if (choice !== 'bundled' && choice !== 'customized' && choice !== 'imported') {
    throw new Error('Unknown literature-brief setup choice.');
  }
  Zotero.Prefs.set(BRIEF_SETUP_CHOICE_PREF, choice, true);
  Zotero.Prefs.set(BRIEF_SETUP_VERSION_PREF, BRIEF_SETUP_VERSION, true);
}

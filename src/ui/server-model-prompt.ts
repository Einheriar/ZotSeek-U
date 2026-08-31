/** Shared modal prompt for explicit UI actions that require a ready Server model. */

import { getString } from '../utils/locale';
import {
  getSelectedServerModelConfigurationIssue,
  ServerModelConfigurationIssue,
} from '../core/server-model-config';

declare const Components: any;
declare const Services: any;
declare const Zotero: any;

interface PromptServiceLike {
  BUTTON_POS_0?: number;
  BUTTON_POS_1?: number;
  BUTTON_TITLE_IS_STRING?: number;
  alert?: (parent: unknown, title: string, message: string) => void;
  confirm?: (parent: unknown, title: string, message: string) => boolean;
  confirmEx?: (
    parent: unknown,
    title: string,
    message: string,
    buttonFlags: number,
    button0Title: string,
    button1Title: string,
    button2Title: string | null,
    checkMessage: string | null,
    checkState: { value: boolean },
  ) => number;
}

interface ComponentsLike {
  classes: Record<string, { createInstance: (interfaceType: unknown) => any }>;
  interfaces: { nsIFile: unknown };
}

/** UI text intentionally summarizes validation errors instead of exposing raw English details. */
export function getServerModelConfigurationGuidance(
  issue: ServerModelConfigurationIssue,
): { key: string; args?: Record<string, string | number> } {
  return issue.state === 'NONE'
    ? { key: 'serverConfigMissingEntry' }
    : { key: 'serverConfigInvalidEntry', args: { errors: issue.errors.length } };
}

/** Ask the OS file manager to select the template, or open its parent if it is missing. */
export function revealFileLocation(
  path: string,
  components: ComponentsLike | null | undefined =
    typeof Components !== 'undefined' ? Components : undefined,
): boolean {
  try {
    const file = components?.classes?.['@mozilla.org/file/local;1']
      ?.createInstance(components.interfaces.nsIFile);
    if (!file) return false;
    file.initWithPath(path);
    if (file.exists()) {
      file.reveal();
      return true;
    }
    const parent = file.parent;
    if (parent?.exists()) {
      parent.reveal();
      return true;
    }
  } catch {
    // The caller shows a localized error; raw platform details belong in logs.
  }
  return false;
}

/**
 * Open a two-button prompt. Only an explicit first-button result may reveal the file;
 * Close, Escape, and the title-bar close path are inert.
 */
export function openServerModelConfigurationPrompt(
  promptService: PromptServiceLike | null | undefined,
  win: unknown,
  title: string,
  message: string,
  openLocationLabel: string,
  closeLabel: string,
  reveal: () => void,
): boolean {
  if (typeof promptService?.confirmEx === 'function') {
    const position0 = promptService.BUTTON_POS_0 ?? 1;
    const position1 = promptService.BUTTON_POS_1 ?? 256;
    const stringTitle = promptService.BUTTON_TITLE_IS_STRING ?? 127;
    const flags = position0 * stringTitle + position1 * stringTitle;
    const result = promptService.confirmEx(
      win,
      title,
      message,
      flags,
      openLocationLabel,
      closeLabel,
      null,
      null,
      { value: false },
    );
    if (result === 0) reveal();
    return true;
  }

  if (typeof promptService?.confirm === 'function') {
    if (promptService.confirm(win, title, message)) reveal();
    return true;
  }

  return false;
}

export function revealServerModelConfigLocation(path: string, win?: unknown): boolean {
  const parent = win ?? (typeof Zotero !== 'undefined' ? Zotero.getMainWindow?.() : null);
  if (revealFileLocation(path)) return true;
  const promptService: PromptServiceLike | undefined =
    typeof Services !== 'undefined' ? Services.prompt : undefined;
  promptService?.alert?.(
    parent || null,
    getString('serverConfigRevealFailedTitle'),
    getString('serverConfigRevealFailedMessage', { path }),
  );
  return false;
}

export function showServerModelConfigurationPromptIfNeeded(): boolean {
  const issue = getSelectedServerModelConfigurationIssue();
  if (!issue) return false;
  const win = typeof Zotero !== 'undefined' ? Zotero.getMainWindow?.() : null;
  const guidance = getServerModelConfigurationGuidance(issue);
  const promptService: PromptServiceLike | undefined =
    typeof Services !== 'undefined' ? Services.prompt : undefined;
  openServerModelConfigurationPrompt(
    promptService,
    win || null,
    getString('serverConfigRequiredTitle'),
    getString('serverConfigRequiredMessage', {
      state: issue.state,
      path: issue.path,
      guidance: getString(guidance.key, guidance.args),
    }),
    getString('serverConfigOpenLocation'),
    getString('serverConfigClose'),
    () => revealServerModelConfigLocation(issue.path, win || null),
  );
  return true;
}

/** Minimal prompt shapes shared by Zotero runtime code and Node tests. */
export interface ConfirmPromptService {
  confirm(parent: unknown, title: string, message: string): boolean;
}

export interface ConfirmWindow {
  confirm(message: string): boolean;
}

/**
 * Open an informational notice with a real cancel/close path.
 *
 * The return value of confirm is intentionally ignored: OK, Cancel, Escape,
 * and the title-bar close button all mean "dismiss this notice". No indexing
 * action is coupled to the user's choice.
 */
export function openDismissibleNotice(
  promptService: ConfirmPromptService | null | undefined,
  win: ConfirmWindow | null | undefined,
  title: string,
  message: string,
): boolean {
  if (!win) return false;

  if (typeof promptService?.confirm === 'function') {
    promptService.confirm(win, title, message);
    return true;
  }

  if (typeof win.confirm === 'function') {
    win.confirm(message);
    return true;
  }

  return false;
}

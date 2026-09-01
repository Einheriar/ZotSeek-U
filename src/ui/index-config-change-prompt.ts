export type IndexConfigChangeChoice = 'update' | 'rebuild' | 'cancel';

interface PromptServiceLike {
  BUTTON_POS_0?: number;
  BUTTON_POS_1?: number;
  BUTTON_POS_2?: number;
  BUTTON_TITLE_IS_STRING?: number;
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

function threeButtonFlags(promptService: PromptServiceLike): number {
  const position0 = promptService.BUTTON_POS_0 ?? 1;
  const position1 = promptService.BUTTON_POS_1 ?? 256;
  const position2 = promptService.BUTTON_POS_2 ?? 65536;
  const stringTitle = promptService.BUTTON_TITLE_IS_STRING ?? 127;
  return position0 * stringTitle + position1 * stringTitle + position2 * stringTitle;
}

/** Close, Escape, and unknown results are always the zero-write cancel choice. */
export function openIndexConfigChangePrompt(
  promptService: PromptServiceLike | null | undefined,
  win: unknown,
  title: string,
  message: string,
  updateLabel: string,
  rebuildLabel: string,
  cancelLabel: string,
): IndexConfigChangeChoice {
  if (typeof promptService?.confirmEx === 'function') {
    const result = promptService.confirmEx(
      win,
      title,
      message,
      threeButtonFlags(promptService),
      updateLabel,
      rebuildLabel,
      cancelLabel,
      null,
      { value: false },
    );
    if (result === 0) return 'update';
    if (result === 1) return 'rebuild';
    return 'cancel';
  }

  // Older prompt implementations cannot present three choices. Preserve the
  // safe daily action and cancellation, but never infer destructive rebuild.
  if (typeof promptService?.confirm === 'function') {
    return promptService.confirm(win, title, message) ? 'update' : 'cancel';
  }

  return 'cancel';
}

import type { ModelConfig } from '../core/model-registry';

export type LocalModelMenuState = 'bundled' | 'installed' | 'download';
export type ModelDownloadChoice = 'automatic' | 'manual' | 'cancel';

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

export function getLocalModelMenuState(
  model: Pick<ModelConfig, 'bundled'>,
  onDisk: boolean,
): LocalModelMenuState {
  if (model.bundled) return 'bundled';
  return onDisk ? 'installed' : 'download';
}

export function getModelDownloadPageUrl(model: Pick<ModelConfig, 'hfPath'>): string {
  const path = model.hfPath.split('/').map(encodeURIComponent).join('/');
  return `https://huggingface.co/${path}/tree/main`;
}

function threeButtonFlags(promptService: PromptServiceLike): number {
  const position0 = promptService.BUTTON_POS_0 ?? 1;
  const position1 = promptService.BUTTON_POS_1 ?? 256;
  const position2 = promptService.BUTTON_POS_2 ?? 65536;
  const stringTitle = promptService.BUTTON_TITLE_IS_STRING ?? 127;
  return position0 * stringTitle + position1 * stringTitle + position2 * stringTitle;
}

/** Close, Escape and every result other than the first two buttons mean cancel. */
export function openModelDownloadChoicePrompt(
  promptService: PromptServiceLike | null | undefined,
  win: unknown,
  title: string,
  message: string,
  automaticLabel: string,
  manualLabel: string,
  cancelLabel: string,
): ModelDownloadChoice {
  if (typeof promptService?.confirmEx === 'function') {
    const result = promptService.confirmEx(
      win,
      title,
      message,
      threeButtonFlags(promptService),
      automaticLabel,
      manualLabel,
      cancelLabel,
      null,
      { value: false },
    );
    if (result === 0) return 'automatic';
    if (result === 1) return 'manual';
    return 'cancel';
  }

  if (typeof promptService?.confirm === 'function') {
    return promptService.confirm(win, title, message) ? 'automatic' : 'cancel';
  }

  return 'cancel';
}

/** Only explicit button results may open the model page or installation location. */
export function openManualModelDownloadGuide(
  promptService: PromptServiceLike | null | undefined,
  win: unknown,
  title: string,
  message: string,
  openPageLabel: string,
  openLocationLabel: string,
  closeLabel: string,
  openPage: () => void,
  openLocation: () => void,
): boolean {
  if (typeof promptService?.confirmEx === 'function') {
    const result = promptService.confirmEx(
      win,
      title,
      message,
      threeButtonFlags(promptService),
      openPageLabel,
      openLocationLabel,
      closeLabel,
      null,
      { value: false },
    );
    if (result === 0) openPage();
    if (result === 1) openLocation();
    return true;
  }

  if (typeof promptService?.confirm === 'function') {
    if (promptService.confirm(win, title, message)) openPage();
    return true;
  }

  return false;
}

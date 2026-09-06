/**
 * Standalone prompt customisation dialog for the experimental Brief feature.
 *
 * The dialog deliberately renders status and output paths only.  The generated
 * prompt bodies remain in the managed files and are never shown in this window.
 */

declare const Zotero: any;

import { getString } from '../utils/locale';

export interface BriefPromptCustomizationForm {
  domain: string;
  outputLanguage: string;
  readingHabits: string;
}

type BriefPromptFile = { path?: string; filePath?: string };

export interface BriefPromptCustomizationResult {
  outputPath?: string;
  downloadPath?: string;
  path?: string;
  files?: Array<BriefPromptFile> | Record<string, string | BriefPromptFile>;
  save?: {
    status?: 'enabled' | 'downloaded_not_enabled' | 'failed' | 'cancelled';
    downloads?: {
      directory?: string;
      files?: Array<BriefPromptFile> | Record<string, string | BriefPromptFile>;
    };
  };
  [key: string]: unknown;
}

export interface BriefPromptWizardArgs {
  input: {
    initialLanguage?: string;
  };
  output: BriefPromptCustomizationResult | null;
}

interface BriefApi {
  customizeBriefPrompts?: (
    form: BriefPromptCustomizationForm,
  ) => Promise<BriefPromptCustomizationResult> | BriefPromptCustomizationResult;
  cancelBriefPromptCustomization?: () => Promise<void> | void;
  openBriefPromptDownloadLocation?: (path: string) => Promise<void> | void;
}

type WizardState = 'idle' | 'running' | 'succeeded' | 'canceled' | 'failed' | 'closed';

function debug(message: string, error?: unknown): void {
  try {
    Zotero?.debug?.(`[ZotSeek] Brief prompt wizard: ${message}`);
    if (error instanceof Error && error.stack) Zotero?.debug?.(error.stack);
  } catch {
    // Dialog logging must never make an error path fail again.
  }
}

function getArgs(): BriefPromptWizardArgs | null {
  let args: any = (window as any).arguments?.[0];
  if (args && !args.input && args.wrappedJSObject) args = args.wrappedJSObject;
  if (!args || !args.input || typeof args.input !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(args, 'output')) args.output = null;
  return args as BriefPromptWizardArgs;
}

function getApi(): BriefApi | null {
  const api = Zotero?.ZotSeek?.api;
  return api && typeof api === 'object' ? api as BriefApi : null;
}

function element<T extends Element>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing dialog element: ${id}`);
  return value as unknown as T;
}

function setLabel(id: string, value: string): void {
  const node = element<HTMLElement>(id);
  // XUL labels use `value`; HTML fallback uses textContent.  Set both so the
  // dialog remains readable across Zotero/Firefox UI implementations.
  node.setAttribute('value', value);
  node.textContent = value;
}

function setVisible(node: Element, visible: boolean): void {
  if (visible) node.removeAttribute('hidden');
  else node.setAttribute('hidden', 'true');
}

function getOutputPath(result: BriefPromptCustomizationResult): string | null {
  const candidates = [
    result.outputPath,
    result.downloadPath,
    result.path,
    result.save?.downloads?.directory,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  const fileSources = [result.files, result.save?.downloads?.files].filter(Boolean);
  const fileValues = fileSources.flatMap(files =>
    Array.isArray(files) ? files : Object.values(files as Record<string, string | BriefPromptFile>),
  );
  for (const file of fileValues) {
    const path = typeof file === 'string' ? file : file?.path || file?.filePath;
    if (typeof path === 'string' && path.trim()) return path.trim();
  }
  return null;
}

class BriefPromptWizardController {
  private state: WizardState = 'idle';
  private cancelSent = false;
  private cancelPromise: Promise<void> | null = null;
  private closeRequested = false;
  private args: BriefPromptWizardArgs | null = null;
  private api: BriefApi | null = null;

  init(): void {
    this.args = getArgs();
    this.api = getApi();
    if (!this.args || !this.api) {
      debug(!this.args ? 'missing window arguments' : 'Brief API is unavailable');
      setLabel('zotseek-brief-wizard-status', getString('brief-wizard-unavailable'));
      element<any>('zotseek-brief-wizard-generate').setAttribute('disabled', 'true');
      return;
    }

    const language = element<HTMLInputElement>('zotseek-brief-wizard-language');
    language.value = typeof this.args.input.initialLanguage === 'string'
      ? this.args.input.initialLanguage
      : '';

    element<any>('zotseek-brief-wizard-generate').addEventListener('command', () => {
      void this.generate();
    });
    element<any>('zotseek-brief-wizard-cancel').addEventListener('command', () => {
      void this.cancelAndClose();
    });
    element<any>('zotseek-brief-wizard-open-location').addEventListener('command', () => {
      void this.openLocation();
    });

    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape') void this.cancelAndClose();
    });
    // Native title-bar closing does not wait for a Promise.  Send cancellation
    // exactly once before the window disappears, so an in-flight request is not
    // left billing in the background.
    window.addEventListener('beforeunload', () => {
      this.closeRequested = true;
      if (this.state === 'running') void this.sendCancelOnce();
      this.state = this.state === 'running' ? 'closed' : this.state;
    });
  }

  private setRunning(running: boolean): void {
    const generate = element<any>('zotseek-brief-wizard-generate');
    const cancel = element<any>('zotseek-brief-wizard-cancel');
    const open = element<any>('zotseek-brief-wizard-open-location');
    const fields = [
      element<HTMLInputElement>('zotseek-brief-wizard-domain'),
      element<HTMLInputElement>('zotseek-brief-wizard-language'),
      element<HTMLTextAreaElement>('zotseek-brief-wizard-habits'),
    ];
    if (running) {
      generate.setAttribute('disabled', 'true');
      cancel.removeAttribute('disabled');
      open.setAttribute('disabled', 'true');
      for (const field of fields) field.setAttribute('disabled', 'true');
      setLabel('zotseek-brief-wizard-status', getString('brief-wizard-generating'));
    } else {
      generate.removeAttribute('disabled');
      cancel.removeAttribute('disabled');
      for (const field of fields) field.removeAttribute('disabled');
    }
  }

  private readForm(): BriefPromptCustomizationForm | null {
    const domain = element<HTMLInputElement>('zotseek-brief-wizard-domain').value.trim();
    const outputLanguage = element<HTMLInputElement>('zotseek-brief-wizard-language').value.trim();
    const readingHabits = element<HTMLTextAreaElement>('zotseek-brief-wizard-habits').value.trim();
    if (!domain || !outputLanguage) {
      setLabel('zotseek-brief-wizard-status', getString('brief-wizard-required'));
      return null;
    }
    return { domain, outputLanguage, readingHabits };
  }

  private async generate(): Promise<void> {
    if (this.state !== 'idle' && this.state !== 'failed') return;
    const form = this.readForm();
    if (!form || !this.api?.customizeBriefPrompts) return;

    this.state = 'running';
    this.cancelSent = false;
    this.setRunning(true);
    setVisible(element('zotseek-brief-wizard-result'), false);
    try {
      const result = await this.api.customizeBriefPrompts(form);
      if (this.closeRequested) return;
      if (!result || typeof result !== 'object') {
        throw new Error(getString('brief-wizard-invalid-result'));
      }
      if (this.args) this.args.output = result;
      const outputPath = getOutputPath(result);
      if (outputPath) {
        const pathNode = element<any>('zotseek-brief-wizard-path');
        pathNode.setAttribute('value', outputPath);
        pathNode.textContent = outputPath;
        pathNode.setAttribute('data-path', outputPath);
        element<any>('zotseek-brief-wizard-open-location').removeAttribute('disabled');
        setVisible(element('zotseek-brief-wizard-result'), true);
      }
      if (result.save?.status === 'cancelled') {
        this.state = 'canceled';
        setLabel('zotseek-brief-wizard-status', getString('brief-wizard-canceled'));
        this.setRunning(false);
        return;
      }
      if (result.save?.status === 'downloaded_not_enabled') {
        this.state = 'failed';
        setLabel('zotseek-brief-wizard-status', getString('brief-wizard-downloaded-not-enabled'));
        this.setRunning(false);
        return;
      }
      if (result.save?.status !== 'enabled') {
        this.state = 'failed';
        setLabel('zotseek-brief-wizard-status', getString('brief-wizard-failed'));
        this.setRunning(false);
        return;
      }
      this.state = 'succeeded';
      setLabel('zotseek-brief-wizard-status', outputPath
        ? getString('brief-wizard-success')
        : getString('brief-wizard-success-no-path'));
      this.setRunning(false);
    } catch (error) {
      if (this.closeRequested) return;
      if (this.cancelSent) {
        this.state = 'canceled';
        setLabel('zotseek-brief-wizard-status', getString('brief-wizard-canceled'));
      } else {
        this.state = 'failed';
        debug('generation failed', error);
        setLabel('zotseek-brief-wizard-status', getString('brief-wizard-failed'));
      }
      this.setRunning(false);
    }
  }

  private sendCancelOnce(): Promise<void> {
    if (this.cancelPromise) return this.cancelPromise;
    if (this.cancelSent || this.state !== 'running') return Promise.resolve();
    this.cancelSent = true;
    try {
      this.cancelPromise = Promise.resolve(this.api?.cancelBriefPromptCustomization?.()).then(() => undefined);
    } catch (error) {
      debug('cancel request failed', error);
      this.cancelPromise = Promise.resolve();
    }
    return this.cancelPromise;
  }

  private async cancelAndClose(): Promise<void> {
    if (this.state !== 'running') {
      window.close();
      return;
    }
    const cancelPromise = this.sendCancelOnce();
    this.state = 'canceled';
    setLabel('zotseek-brief-wizard-status', getString('brief-wizard-canceling'));
    element<any>('zotseek-brief-wizard-cancel').setAttribute('disabled', 'true');
    try {
      // Give an async API implementation a chance to revoke the request before
      // closing.  A synchronous implementation resolves immediately.
      await cancelPromise;
    } catch (error) {
      debug('cancel request failed', error);
    } finally {
      window.close();
    }
  }

  private async openLocation(): Promise<void> {
    const path = element<any>('zotseek-brief-wizard-path').getAttribute('data-path')
      || element<any>('zotseek-brief-wizard-path').getAttribute('value');
    if (!path || !this.api?.openBriefPromptDownloadLocation) return;
    try {
      await Promise.resolve(this.api.openBriefPromptDownloadLocation(path));
    } catch (error) {
      debug('opening prompt location failed', error);
      setLabel('zotseek-brief-wizard-status', getString('brief-wizard-open-failed'));
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    new BriefPromptWizardController().init();
  } catch (error) {
    debug('initialization failed', error);
    try {
      setLabel('zotseek-brief-wizard-status', getString('brief-wizard-init-failed'));
    } catch {
      // The document may be incomplete; there is nowhere else to report it.
    }
  }
});

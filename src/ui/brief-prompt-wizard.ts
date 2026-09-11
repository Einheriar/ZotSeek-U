/** First-use guide for provider setup and constrained brief-prompt personalization. */

declare const Zotero: any;

import { getString } from '../utils/locale';
import {
  type BriefModelSuggestion,
} from '../core/brief-model-discovery';
import { attachBriefModelAutocomplete, type BriefModelAutocomplete } from './brief-model-autocomplete';

interface BriefPromptCustomizationForm {
  domain: string;
  outputLanguage: string;
  readingHabits: string;
}

type BriefPromptFile = { path?: string; filePath?: string };
interface BriefPromptCustomizationResult {
  setup?: 'bundled';
  status?: 'enabled';
  outputPath?: string;
  files?: Array<BriefPromptFile> | Record<string, string | BriefPromptFile>;
  downloads?: {
    directory?: string;
    files?: Array<BriefPromptFile> | Record<string, string | BriefPromptFile>;
  };
  save?: {
    status?: 'enabled' | 'downloaded_not_enabled' | 'failed' | 'cancelled';
    downloads?: {
      directory?: string;
      files?: Array<BriefPromptFile> | Record<string, string | BriefPromptFile>;
    };
  };
}

interface BriefStatus {
  provider: string;
  providerLabel: string;
  hasCredential: boolean;
  connectionVerified: boolean;
  consentCurrent: boolean;
  config: {
    settings: {
      modelName: string;
      maxInputTokens: number;
      maxOutputTokens: number;
      thinkingEnabled: boolean;
    };
  };
  setup: { status: string; choice: string | null; damageReason?: string };
}

interface BriefPromptWizardArgs {
  input: { initialLanguage?: string; reconfigurePrompts?: boolean };
  output: BriefPromptCustomizationResult | { setup: string } | null;
}

interface BriefApi {
  getBriefStatus(): Promise<BriefStatus>;
  updateBriefSettings(input: BriefStatus['config']['settings']): Promise<void> | void;
  discoverBriefModels(force?: boolean): Promise<BriefModelSuggestion[]>;
  testBriefConnection(): Promise<boolean>;
  useBundledBriefPrompts(): Promise<BriefPromptCustomizationResult>;
  customizeBriefPrompts(form: BriefPromptCustomizationForm): Promise<BriefPromptCustomizationResult>;
  cancelBriefPromptCustomization?(): Promise<void> | void;
  openBriefPromptDownloadLocation?(path: string): Promise<void> | void;
}

type Page = 'intro' | 'service' | 'template' | 'questions' | 'confirm' | 'result';
type Operation = 'idle' | 'testing' | 'generating';
const PAGE_ORDER: readonly Page[] = ['intro', 'service', 'template', 'questions', 'confirm', 'result'];
// Banner step indicator entries in display order. The result page counts as
// "confirm done" so every step shows completed there.
const STEP_ORDER: readonly Exclude<Page, 'result'>[] =
  ['intro', 'service', 'template', 'questions', 'confirm'];

function debug(message: string, error?: unknown): void {
  try {
    Zotero?.debug?.('[ZotSeek] Brief prompt wizard: ' + message);
    if (error instanceof Error && error.stack) Zotero?.debug?.(error.stack);
  } catch { /* logging must not break the guide */ }
}

function getArgs(): BriefPromptWizardArgs | null {
  let args: any = (window as any).arguments?.[0];
  if (args && !args.input && args.wrappedJSObject) args = args.wrappedJSObject;
  if (!args || !args.input || typeof args.input !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(args, 'output')) args.output = null;
  return args;
}

function getApi(): BriefApi | null {
  const api = Zotero?.ZotSeek?.api;
  return api && typeof api === 'object' ? api as BriefApi : null;
}

function element<T extends Element>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error('Missing dialog element: ' + id);
  return node as unknown as T;
}

function setText(id: string, value: string): void {
  const node = element<HTMLElement>(id);
  // XUL labels render their value as well as child text; buttons use label.
  if (node.namespaceURI === 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul') {
    node.removeAttribute('data-l10n-id');
    // A native button owns child elements; clearing them removes its caption.
    if (node.localName !== 'button') node.textContent = '';
    node.setAttribute(node.localName === 'button' ? 'label' : 'value', value);
    return;
  }
  node.textContent = value;
}

function visible(id: string, show: boolean): void {
  if (show) element(id).removeAttribute('hidden');
  else element(id).setAttribute('hidden', 'true');
}

function outputPath(result: BriefPromptCustomizationResult): string | null {
  if (typeof result.outputPath === 'string' && result.outputPath.trim()) {
    return result.outputPath.trim();
  }
  const sources = [result.files, result.downloads?.files, result.save?.downloads?.files].filter(Boolean);
  for (const files of sources) {
    const values = Array.isArray(files)
      ? files
      : Object.values(files as Record<string, string | BriefPromptFile>);
    for (const file of values) {
      const value = typeof file === 'string' ? file : file?.path || file?.filePath;
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  const directories = [result.downloads?.directory, result.save?.downloads?.directory];
  for (const value of directories) if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

class BriefPromptWizardController {
  private args: BriefPromptWizardArgs | null = null;
  private api: BriefApi | null = null;
  private status: BriefStatus | null = null;
  private page: Page = 'service';
  private operation: Operation = 'idle';
  private closed = false;
  private suggestions: BriefModelSuggestion[] = [];
  private autocomplete: BriefModelAutocomplete | null = null;

  async init(): Promise<void> {
    // A Fluent text value on the root window replaces all of its child controls.
    document.title = getString('brief-prompt-wizard-title');
    for (const button of Array.from(document.querySelectorAll('button[data-zotseek-label]'))) {
      button.setAttribute('label', getString(button.getAttribute('data-zotseek-label')!.replace(/^zotseek-/, '')));
    }
    this.args = getArgs();
    this.api = getApi();
    if (!this.args || !this.api) {
      setText('zotseek-brief-wizard-status', getString('brief-wizard-unavailable'));
      return;
    }
    this.autocomplete = attachBriefModelAutocomplete(document,
      'zotseek-brief-wizard-model', () => this.suggestions);
    element<HTMLInputElement>('zotseek-brief-wizard-language').value =
      typeof this.args.input.initialLanguage === 'string' ? this.args.input.initialLanguage : '';
    element('zotseek-brief-wizard-cancel').addEventListener('command', () => void this.close());
    element('zotseek-brief-wizard-back').addEventListener('command', () => void this.back());
    element('zotseek-brief-wizard-next').addEventListener('command', () => void this.next());
    element('zotseek-brief-wizard-test').addEventListener('command', () => void this.testConnection());
    element('zotseek-brief-wizard-refresh-models').addEventListener('command', () => void this.loadModels(true));
    element<HTMLInputElement>('zotseek-brief-wizard-model')
      .addEventListener('focus', () => void this.loadModels(false));
    element('zotseek-brief-wizard-open-location').addEventListener('command', () => void this.openLocation());
    document.addEventListener('keydown', event => {
      if ((event as KeyboardEvent).key === 'Escape' && !event.defaultPrevented) void this.close();
    });
    window.addEventListener('beforeunload', () => {
      this.closed = true;
      if (this.operation === 'generating') void this.api?.cancelBriefPromptCustomization?.();
    });
    await this.refreshStatus();
    if (!this.status) return;
    element<HTMLInputElement>('zotseek-brief-wizard-model').value =
      this.status.config.settings.modelName;
    // This checkbox authorizes only this window's narrow test/customization
    // disclosure and must not inherit legacy paper-generation consent.
    element<any>('zotseek-brief-wizard-consent').checked = false;
    this.initChoiceCards();
    // The guide always opens on the intro page; it carries no form or request.
    this.setPage('intro');
  }

  // Radio inputs inside choice labels do not toggle a card class on their own;
  // keep the selected-card highlight in sync with the checked radio.
  private initChoiceCards(): void {
    for (const id of ['zotseek-brief-wizard-template-personalized', 'zotseek-brief-wizard-template-bundled']) {
      element<HTMLInputElement>(id).addEventListener('change', () => {
        element('zotseek-brief-wizard-choice-personalized').classList
          .toggle('zs-selected', element<HTMLInputElement>('zotseek-brief-wizard-template-personalized').checked);
        element('zotseek-brief-wizard-choice-bundled').classList
          .toggle('zs-selected', element<HTMLInputElement>('zotseek-brief-wizard-template-bundled').checked);
      });
    }
  }

  private async refreshStatus(): Promise<void> {
    try {
      this.status = await this.api!.getBriefStatus();
      setText('zotseek-brief-wizard-provider', getString('brief-wizard-provider-summary', {
        provider: this.status.providerLabel,
        credential: this.status.hasCredential
          ? getString('pref-brief-key-configured')
          : getString('pref-brief-key-missing'),
      }));
      setText('zotseek-brief-wizard-service-status', this.status.connectionVerified
        ? getString('pref-brief-connection-verified')
        : this.status.hasCredential
          ? getString('pref-brief-connection-not-verified')
          : getString('pref-brief-key-required'));
    } catch (error) {
      debug('status failed', error);
      setText('zotseek-brief-wizard-status', getString('brief-wizard-unavailable'));
    }
  }

  private setPage(page: Page): void {
    this.page = page;
    for (const candidate of PAGE_ORDER) {
      visible('zotseek-brief-wizard-' + candidate + '-page', candidate === page);
    }
    // Keep the user's window size; each newly selected page starts at its top.
    const pages = document.querySelector<HTMLElement>('.zs-wizard-pages');
    if (pages) pages.scrollTop = 0;
    this.renderSteps(page);
    const back = element<any>('zotseek-brief-wizard-back');
    if (page === 'intro' || page === 'result') back.setAttribute('disabled', 'true');
    else back.removeAttribute('disabled');
    setText('zotseek-brief-wizard-next', getString(page === 'confirm'
      ? 'brief-wizard-generate'
      : page === 'result' ? 'brief-wizard-finish' : 'brief-wizard-next'));
    setText('zotseek-brief-wizard-status',
      page !== 'result' && page !== 'intro' && this.status?.setup.status === 'damaged'
        ? getString('brief-wizard-setup-damaged')
        : '');
  }

  private renderSteps(page: Page): void {
    const stepsBox = document.getElementById('zotseek-brief-wizard-steps');
    if (!stepsBox) return;
    const activeIndex = page === 'result' ? STEP_ORDER.length : STEP_ORDER.indexOf(page);
    for (const step of Array.from(stepsBox.querySelectorAll<HTMLElement>('.zs-wizard-step'))) {
      const index = STEP_ORDER.indexOf(step.dataset.step as typeof STEP_ORDER[number]);
      const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : '';
      if (state) step.dataset.state = state;
      else delete step.dataset.state;
      const dot = step.querySelector<HTMLElement>('.zs-step-dot');
      if (dot) dot.textContent = state === 'done' ? '✓' : String(index + 1);
    }
  }

  private setBusy(busy: boolean): void {
    for (const id of [
      'zotseek-brief-wizard-next',
      'zotseek-brief-wizard-back',
      'zotseek-brief-wizard-test',
      'zotseek-brief-wizard-refresh-models',
    ]) {
      const node = element<any>(id);
      if (busy) node.setAttribute('disabled', 'true');
      else if (id === 'zotseek-brief-wizard-back'
          && (this.page === 'intro' || this.page === 'result')) {
        node.setAttribute('disabled', 'true');
      } else node.removeAttribute('disabled');
    }
  }

  private renderSuggestions(): void {
    this.autocomplete?.refresh();
  }

  private async loadModels(force: boolean): Promise<void> {
    if (!this.api || this.operation !== 'idle') return;
    setText('zotseek-brief-wizard-service-status', getString('pref-brief-models-loading'));
    try {
      this.suggestions = await this.api.discoverBriefModels(force);
      this.renderSuggestions();
      setText('zotseek-brief-wizard-service-status', this.suggestions.length
        ? getString('pref-brief-models-loaded', { count: this.suggestions.length })
        : getString('pref-brief-models-empty'));
    } catch (error: any) {
      setText('zotseek-brief-wizard-service-status', getString('pref-brief-models-failed', {
        error: error?.message || error,
      }));
    }
  }

  private selectedSettings(): BriefStatus['config']['settings'] | null {
    if (!this.status) return null;
    const modelName = element<HTMLInputElement>('zotseek-brief-wizard-model').value.trim();
    if (!modelName) {
      setText('zotseek-brief-wizard-status', getString('brief-wizard-model-required'));
      return null;
    }
    const suggestion = this.suggestions.find(value => value.id === modelName);
    return {
      ...this.status.config.settings,
      modelName,
      ...(suggestion?.inputTokenLimit ? { maxInputTokens: suggestion.inputTokenLimit } : {}),
      ...(suggestion?.outputTokenLimit && suggestion.outputTokenLimit >= 4096
        ? { maxOutputTokens: suggestion.outputTokenLimit } : {}),
      thinkingEnabled: this.status.provider === 'alibaba-bailian'
        ? this.status.config.settings.thinkingEnabled
        : false,
    };
  }

  private async testConnection(): Promise<void> {
    if (!this.api || this.operation !== 'idle') return;
    const settings = this.selectedSettings();
    if (!settings) return;
    if (!element<any>('zotseek-brief-wizard-consent').checked) {
      setText('zotseek-brief-wizard-status', getString('brief-wizard-consent-required'));
      return;
    }
    this.operation = 'testing';
    this.setBusy(true);
    setText('zotseek-brief-wizard-service-status', getString('pref-brief-testing'));
    try {
      await this.api.updateBriefSettings(settings);
      await this.api.testBriefConnection();
      await this.refreshStatus();
      setText('zotseek-brief-wizard-service-status', getString('pref-brief-connection-verified'));
      if (this.status?.setup.status === 'ready'
          && this.args?.input.reconfigurePrompts !== true) {
        if (this.args) this.args.output = { setup: this.status.setup.choice || 'ready' };
        setText('zotseek-brief-wizard-result-message', getString('brief-wizard-service-restored'));
        this.setPage('result');
      }
    } catch (error: any) {
      setText('zotseek-brief-wizard-service-status', getString('pref-brief-test-failed', {
        error: error?.message || error,
      }));
    } finally {
      this.operation = 'idle';
      this.setBusy(false);
    }
  }

  private readForm(): BriefPromptCustomizationForm | null {
    const domain = element<HTMLInputElement>('zotseek-brief-wizard-domain').value.trim();
    const outputLanguage = element<HTMLInputElement>('zotseek-brief-wizard-language').value.trim();
    const readingHabits = element<HTMLTextAreaElement>('zotseek-brief-wizard-habits').value.trim();
    if (!domain || !outputLanguage) {
      setText('zotseek-brief-wizard-status', getString('brief-wizard-required'));
      return null;
    }
    return { domain, outputLanguage, readingHabits };
  }

  private renderSummary(form: BriefPromptCustomizationForm): void {
    element<HTMLElement>('zotseek-brief-wizard-summary').textContent =
      getString('brief-wizard-summary', {
        provider: this.status?.providerLabel || '',
        model: this.status?.config.settings.modelName || '',
        domain: form.domain,
        language: form.outputLanguage,
        focus: form.readingHabits || getString('brief-wizard-summary-none'),
      });
  }

  private async next(): Promise<void> {
    if (!this.api || this.operation !== 'idle') return;
    if (this.page === 'intro') {
      this.setPage('service');
      return;
    }
    if (this.page === 'result') {
      window.close();
      return;
    }
    if (this.page === 'service') {
      await this.refreshStatus();
      if (!this.status?.connectionVerified) {
        setText('zotseek-brief-wizard-status', getString('brief-wizard-test-required'));
        return;
      }
      if (this.status.setup.status === 'ready'
          && this.args?.input.reconfigurePrompts !== true) {
        setText('zotseek-brief-wizard-result-message', getString('brief-wizard-service-restored'));
        this.setPage('result');
        return;
      }
      this.setPage('template');
      return;
    }
    if (this.page === 'template') {
      if (element<HTMLInputElement>('zotseek-brief-wizard-template-bundled').checked) {
        this.operation = 'generating';
        this.setBusy(true);
        try {
          const result = await this.api.useBundledBriefPrompts();
          if (result.setup !== 'bundled' || result.status !== 'enabled') {
            throw new Error(result.status || 'invalid_result');
          }
          if (this.args) this.args.output = result;
          const path = outputPath(result);
          if (path) {
            const pathNode = element<any>('zotseek-brief-wizard-path');
            pathNode.setAttribute('value', path);
            pathNode.setAttribute('data-path', path);
            pathNode.textContent = path;
            visible('zotseek-brief-wizard-result-path-box', true);
          }
          setText('zotseek-brief-wizard-result-message', getString('brief-wizard-bundled-success'));
          this.setPage('result');
        } catch (error) {
          debug('built-in choice failed', error);
          setText('zotseek-brief-wizard-status', getString('brief-wizard-bundled-failed'));
        } finally {
          this.operation = 'idle';
          this.setBusy(false);
        }
        return;
      }
      this.setPage('questions');
      return;
    }
    if (this.page === 'questions') {
      const form = this.readForm();
      if (!form) return;
      this.renderSummary(form);
      this.setPage('confirm');
      return;
    }
    const form = this.readForm();
    if (!form) return;
    await this.generate(form);
  }

  private back(): void {
    if (this.operation !== 'idle') return;
    if (this.page === 'service') this.setPage('intro');
    else if (this.page === 'template') this.setPage('service');
    else if (this.page === 'questions') this.setPage('template');
    else if (this.page === 'confirm') this.setPage('questions');
  }

  private async generate(form: BriefPromptCustomizationForm): Promise<void> {
    if (!element<any>('zotseek-brief-wizard-consent').checked) {
      this.setPage('service');
      setText('zotseek-brief-wizard-status', getString('brief-wizard-consent-required'));
      return;
    }
    this.operation = 'generating';
    this.setBusy(true);
    setText('zotseek-brief-wizard-status', getString('brief-wizard-generating'));
    try {
      const result = await this.api!.customizeBriefPrompts(form);
      if (this.closed) return;
      if (result.save?.status !== 'enabled') throw new Error(result.save?.status || 'invalid_result');
      if (this.args) this.args.output = result;
      const path = outputPath(result);
      if (path) {
        const pathNode = element<any>('zotseek-brief-wizard-path');
        pathNode.setAttribute('value', path);
        pathNode.setAttribute('data-path', path);
        pathNode.textContent = path;
        visible('zotseek-brief-wizard-result-path-box', true);
      }
      setText('zotseek-brief-wizard-result-message', getString('brief-wizard-success'));
      this.setPage('result');
    } catch (error) {
      if (!this.closed) {
        debug('customization failed', error);
        setText('zotseek-brief-wizard-status', getString('brief-wizard-failed'));
      }
    } finally {
      this.operation = 'idle';
      this.setBusy(false);
    }
  }

  private async close(): Promise<void> {
    if (this.operation === 'generating') {
      try { await this.api?.cancelBriefPromptCustomization?.(); } catch { /* best effort */ }
    }
    window.close();
  }

  private async openLocation(): Promise<void> {
    const node = element<any>('zotseek-brief-wizard-path');
    const path = node.getAttribute('data-path') || node.getAttribute('value');
    if (!path || !this.api?.openBriefPromptDownloadLocation) return;
    try { await this.api.openBriefPromptDownloadLocation(path); }
    catch { setText('zotseek-brief-wizard-status', getString('brief-wizard-open-failed')); }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void new BriefPromptWizardController().init().catch(error => {
    debug('initialization failed', error);
    try { setText('zotseek-brief-wizard-status', getString('brief-wizard-init-failed')); }
    catch { /* incomplete document */ }
  });
});

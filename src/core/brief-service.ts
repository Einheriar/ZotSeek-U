/** Runtime orchestration boundary for literature-brief generation. */

import { getZotero } from '../utils/zotero-helper';
import { ZoteroAPI } from '../utils/zotero-api';
import { identityFromItem, localItemIDFromIdentity } from './identity-resolver';
import { getCloudModelSettings } from './cloud-model-config';
import {
  cloudCredentialStore,
  getCloudCredentialRevision,
} from './cloud-credential-store';
import {
  getBriefGenerationConfigSnapshot,
  hasCurrentBriefConsent,
  isBriefConnectionVerified,
  recordCurrentBriefConsent,
  setBriefConnectionVerified,
  setBriefGenerationSettings,
  type BriefGenerationSettingsInput,
} from './brief-generation-config';
import {
  BriefGenerationClient,
  createBriefGenerationTaskContext,
  type BriefGenerationTaskContext,
} from './brief-generation-client';
import {
  BriefGenerationScheduler,
  type BriefGenerationTask,
  type BriefSchedulerProgress,
  type BriefTaskOutcome,
} from './brief-generation-scheduler';
import { BriefSourceBuilder, type BriefSourceTarget } from './brief-source-builder';
import {
  BriefGenerationRunner,
  type BriefGenerationRunnerResult,
} from './brief-generation-runner';
import { BriefNoteWriter } from './brief-note-writer';
import {
  briefPromptStore,
  type BriefPromptSlot,
  type StoredBriefPrompt,
} from './brief-prompt-store';
import {
  BriefPromptCustomizer,
  type BriefPromptCustomizationForm,
  type BriefPromptCustomizationResult,
} from './brief-prompt-customizer';

declare const IOUtils: any;

export const BRIEF_ENABLED_PREF = 'zotseek.brief.enabled';
export type BriefJobMode = 'manual' | 'collection' | 'prompt';

export interface BriefRuntimePromptStatus {
  slot: BriefPromptSlot;
  source: StoredBriefPrompt['source'];
  filename: string;
  updatedAt?: string;
  hash: string;
}

export interface BriefRuntimeStatus {
  enabled: boolean;
  busy: boolean;
  busyMode: BriefJobMode | null;
  provider: string;
  providerSupported: boolean;
  providerLabel: string;
  baseUrl: string;
  hasCredential: boolean;
  connectionVerified: boolean;
  consentCurrent: boolean;
  config: ReturnType<typeof getBriefGenerationConfigSnapshot>;
  prompts: Record<BriefPromptSlot, BriefRuntimePromptStatus>;
}

export interface BriefGenerationRequest {
  key: string;
  target: BriefSourceTarget;
  allowExistingNotes?: boolean;
  skipReason?: string;
}

export interface BriefJobResult {
  key: string;
  status: 'success' | 'failed' | 'skipped' | 'cancelled';
  reason?: string;
  result?: BriefGenerationRunnerResult;
  error?: unknown;
}

type ProgressListener = (progress: BriefSchedulerProgress) => void;

const SAFE_ERROR_CODES = new Set([
  'BRIEF_GENERATION_CANCELLED',
  'BRIEF_GENERATION_REQUEST_ERROR',
  'BRIEF_GENERATION_UNAVAILABLE',
  'BRIEF_GENERATION_TRUNCATED',
  'BRIEF_NOTE_WRITER_ERROR',
  'BRIEF_SOURCE_BUILDER_ERROR',
  'BRIEF_GENERATION_RUNNER_ERROR',
]);
const SAFE_ERROR_CATEGORIES = new Set([
  'authentication', 'permission', 'invalid-request', 'rate-limited',
  'context-limit', 'server', 'upstream', 'protocol', 'timeout',
]);

/** Keep provider/file/transport details out of the job result boundary. */
function safeBriefError(error: unknown): Record<string, unknown> {
  const value = error as any;
  const code = typeof value?.code === 'string' && SAFE_ERROR_CODES.has(value.code)
    ? value.code
    : undefined;
  const category = typeof value?.category === 'string' && SAFE_ERROR_CATEGORIES.has(value.category)
    ? value.category
    : undefined;
  const status = Number.isSafeInteger(value?.status) && value.status >= 400 && value.status <= 599
    ? value.status
    : undefined;
  let message = 'Literature-brief generation failed.';
  if (code === 'BRIEF_GENERATION_CANCELLED') message = 'Literature-brief generation was cancelled.';
  else if (code === 'BRIEF_GENERATION_TRUNCATED') message = 'The brief response was truncated and was not accepted.';
  else if (code === 'BRIEF_GENERATION_UNAVAILABLE') message = 'The brief generation service is temporarily unavailable.';
  else if (code === 'BRIEF_NOTE_WRITER_ERROR') message = 'The literature brief could not be saved as a Child Note.';
  else if (code === 'BRIEF_GENERATION_REQUEST_ERROR') message = 'The brief generation service rejected the request.';
  return {
    ...(code ? { code } : {}),
    ...(category ? { category } : {}),
    ...(status !== undefined ? { status } : {}),
    message,
  };
}

function basename(path: string): string {
  return path.split(/[\\/]/u).pop() || path;
}

function endpointFingerprint(provider: string, baseUrl: string): string {
  const input = `brief-endpoint-v1:${provider}:${baseUrl.replace(/\/+$/u, '')}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

async function promptStatus(prompt: StoredBriefPrompt): Promise<BriefRuntimePromptStatus> {
  let updatedAt: string | undefined;
  if (prompt.source === 'custom' && typeof IOUtils !== 'undefined') {
    try {
      const stat = await IOUtils.stat(prompt.path);
      const modified = Number(stat?.lastModified ?? stat?.lastModificationDate);
      if (Number.isFinite(modified) && modified > 0) updatedAt = new Date(modified).toISOString();
    } catch { /* status remains useful without a timestamp */ }
  }
  return {
    slot: prompt.slot,
    source: prompt.source,
    filename: basename(prompt.path),
    ...(updatedAt ? { updatedAt } : {}),
    hash: prompt.hash,
  };
}

function hasAnyChildNotes(parent: any): boolean {
  if (!parent || typeof parent.getNotes !== 'function') return false;
  const ids = parent.getNotes();
  if (!Array.isArray(ids)) throw new Error('Zotero returned an invalid Child Note list.');
  const items = getZotero()?.Items;
  if (!items || typeof items.get !== 'function') {
    throw new Error('Zotero Note lookup is unavailable.');
  }
  return ids.some((id: number) => {
    const note = items.get(id);
    return !!note && note.deleted !== true && note.isDeleted?.() !== true;
  });
}

export class BriefService {
  private readonly zoteroAPI = new ZoteroAPI();
  private readonly activeClients = new Set<BriefGenerationClient>();
  private readonly scheduler: BriefGenerationScheduler<BriefGenerationRunnerResult>;
  private progressListener: ProgressListener | null = null;
  private promptContext: BriefGenerationTaskContext | null = null;
  private idleWaiters = new Set<() => void>();

  constructor() {
    this.scheduler = new BriefGenerationScheduler({
      onProgress: progress => {
        try { this.progressListener?.(progress); } catch { /* UI must not poison jobs */ }
        this.resolveIdleWaiters();
      },
      cancelInFlight: () => this.cancelClients(),
    });
  }

  isEnabled(): boolean {
    // Missing preferences must be safe-by-default: a fresh profile must not
    // be able to send article text merely because startup has not registered
    // the plugin defaults yet.
    try { return getZotero()?.Prefs?.get?.(BRIEF_ENABLED_PREF, false) === true; }
    catch { return false; }
  }

  isBusy(): boolean {
    return this.promptContext !== null
      || this.scheduler.isManualActive()
      || this.scheduler.isCollectionActive();
  }

  getBusyMode(): BriefJobMode | null {
    if (this.promptContext) return 'prompt';
    if (this.scheduler.isCollectionActive()) return 'collection';
    if (this.scheduler.isManualActive()) return 'manual';
    return null;
  }

  setProgressListener(listener: ProgressListener | null): void {
    this.progressListener = listener;
  }

  setEnabled(enabled: boolean): void {
    getZotero()?.Prefs?.set?.(BRIEF_ENABLED_PREF, enabled === true, true);
    if (!enabled) this.cancelAll();
  }

  updateSettings(input: BriefGenerationSettingsInput): void {
    this.cancelAll();
    setBriefGenerationSettings(input);
  }

  private connectionBinding() {
    const cloud = getCloudModelSettings();
    const config = getBriefGenerationConfigSnapshot();
    return {
      configFingerprint: config.fingerprint,
      configRevision: config.revision,
      credentialRevision: getCloudCredentialRevision('alibaba-bailian'),
      endpointFingerprint: endpointFingerprint(cloud.provider, cloud.baseUrl),
    };
  }

  private async createClient(): Promise<BriefGenerationClient> {
    const cloud = getCloudModelSettings();
    if (cloud.provider !== 'alibaba-bailian' || !cloud.baseUrl) {
      throw new Error('Literature briefs currently require Alibaba Cloud Model Studio (Bailian).');
    }
    const config = getBriefGenerationConfigSnapshot();
    if (config.status === 'invalid') {
      throw new Error(config.error || 'The literature-brief generation configuration is invalid.');
    }
    const apiKey = await cloudCredentialStore.get('alibaba-bailian');
    if (!apiKey) throw new Error('The shared Bailian API key is missing.');
    return new BriefGenerationClient({
      baseUrl: cloud.baseUrl,
      apiKey,
      modelName: config.settings.modelName,
      maxOutputTokens: config.settings.maxOutputTokens,
      thinkingEnabled: config.settings.thinkingEnabled,
    });
  }

  private cancelClients(): void {
    for (const client of this.activeClients) client.cancelPending();
  }

  cancelAll(): void {
    this.promptContext?.cancel();
    this.scheduler.cancelManual();
    this.scheduler.cancelCollection();
    this.cancelClients();
  }

  cancelPromptCustomization(): void {
    this.promptContext?.cancel();
    this.cancelClients();
  }

  async waitForIdle(): Promise<void> {
    if (!this.isBusy()) return;
    await new Promise<void>(resolve => this.idleWaiters.add(resolve));
  }

  private resolveIdleWaiters(): void {
    if (this.isBusy()) return;
    for (const resolve of this.idleWaiters) resolve();
    this.idleWaiters.clear();
  }

  async testConnection(): Promise<boolean> {
    if (this.isBusy()) throw new Error('Another literature-brief task is still running.');
    const before = this.connectionBinding();
    const client = await this.createClient();
    const context = createBriefGenerationTaskContext();
    this.promptContext = context;
    this.activeClients.add(client);
    try {
      const result = await client.generate([
        {
          role: 'system',
          content: 'You are a connectivity probe. Follow the user request exactly.',
        },
        { role: 'user', content: 'Reply with exactly ZOTSEEK_BRIEF_OK' },
      ], { retries: 0, maxCompletionTokens: 128, signal: context.signal });
      if (result.content.trim() !== 'ZOTSEEK_BRIEF_OK') {
        throw new Error('The generation model did not satisfy the brief response contract.');
      }
      const after = this.connectionBinding();
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        throw new Error('The shared credential or brief configuration changed during testing.');
      }
      setBriefConnectionVerified(true, before);
      return true;
    } catch (error) {
      setBriefConnectionVerified(false);
      throw error;
    } finally {
      this.activeClients.delete(client);
      if (this.promptContext === context) this.promptContext = null;
      this.resolveIdleWaiters();
    }
  }

  recordConsent(): void {
    recordCurrentBriefConsent();
  }

  hasCurrentConsent(): boolean {
    return hasCurrentBriefConsent();
  }

  private assertGenerationReady(requireLiteratureConsent = false): void {
    if (!this.isEnabled()) throw new Error('Literature briefs are disabled in ZotSeek settings.');
    const cloud = getCloudModelSettings();
    if (cloud.provider !== 'alibaba-bailian') {
      throw new Error('Literature briefs currently require Alibaba Cloud Model Studio (Bailian).');
    }
    if (!isBriefConnectionVerified(this.connectionBinding())) {
      throw new Error('Test the literature-brief connection in ZotSeek settings first.');
    }
    if (requireLiteratureConsent && !hasCurrentBriefConsent()) {
      throw new Error('Confirm the literature-brief external-data authorization first.');
    }
  }

  async getStatus(): Promise<BriefRuntimeStatus> {
    const cloud = getCloudModelSettings();
    const prompts = await briefPromptStore.loadRequired();
    let hasCredential = false;
    try { hasCredential = await cloudCredentialStore.has('alibaba-bailian'); } catch { /* surfaced by status */ }
    return {
      enabled: this.isEnabled(),
      busy: this.isBusy(),
      busyMode: this.getBusyMode(),
      provider: cloud.provider,
      providerSupported: cloud.provider === 'alibaba-bailian',
      providerLabel: cloud.provider === 'alibaba-bailian'
        ? 'Alibaba Cloud Model Studio (Bailian)'
        : cloud.provider,
      baseUrl: cloud.baseUrl,
      hasCredential,
      connectionVerified: cloud.provider === 'alibaba-bailian'
        && isBriefConnectionVerified(this.connectionBinding()),
      consentCurrent: hasCurrentBriefConsent(),
      config: getBriefGenerationConfigSnapshot(),
      prompts: {
        standard: await promptStatus(prompts.standard),
        review: await promptStatus(prompts.review),
      },
    };
  }

  async customizePrompts(form: BriefPromptCustomizationForm): Promise<BriefPromptCustomizationResult> {
    this.assertGenerationReady();
    if (this.isBusy()) throw new Error('Another literature-brief task is still running.');
    const context = createBriefGenerationTaskContext();
    this.promptContext = context;
    let client: BriefGenerationClient | null = null;
    try {
      client = await this.createClient();
      context.throwIfCancelled();
      this.activeClients.add(client);
      return await new BriefPromptCustomizer(client).customize(form, { signal: context.signal });
    } finally {
      if (client) this.activeClients.delete(client);
      if (this.promptContext === context) this.promptContext = null;
      this.resolveIdleWaiters();
    }
  }

  async importPrompt(slot: BriefPromptSlot, path: string): Promise<StoredBriefPrompt> {
    if (this.isBusy()) throw new Error('Another literature-brief task is still running.');
    return await briefPromptStore.importFromFile(slot, path);
  }

  async resetPrompts(): Promise<Record<BriefPromptSlot, StoredBriefPrompt>> {
    if (this.isBusy()) throw new Error('Another literature-brief task is still running.');
    return await briefPromptStore.resetToBundled();
  }

  private sourceBuilder(): BriefSourceBuilder {
    const Z = getZotero();
    return new BriefSourceBuilder({
      identityOf: item => identityFromItem(item as any),
      parentOfAttachment: attachment => {
        const parentID = Number((attachment as any)?.parentID ?? (attachment as any)?.parentItemID);
        return Number.isSafeInteger(parentID) && parentID > 0 ? Z?.Items?.get?.(parentID) : null;
      },
      selectMainPdf: async parent => {
        const selected = await this.zoteroAPI.getSelectedMainPdfText(Number((parent as any)?.id));
        if (!selected?.selectedText) return selected;
        const attachment = Z?.Items?.get?.(selected.selectedText.attachmentId);
        // Keep the selected pages and the live Zotero attachment coupled.  If
        // the attachment disappeared between extraction and write, reporting a
        // fake `{ key }` record would bypass the ownership recheck.
        if (!attachment) return { ...selected, selectedText: null };
        return {
          ...selected,
          attachment,
        };
      },
      readPdf: attachment => this.zoteroAPI.readPdfAttachment(attachment as any, null),
    });
  }

  private noteWriter(): BriefNoteWriter {
    const Z = getZotero();
    return new BriefNoteWriter({
      identityOf: item => identityFromItem(item as any),
      hasAnyChildNotes,
      canWrite: parent => {
        const library = Z?.Libraries?.get?.((parent as any)?.libraryID);
        return !!library && library.editable !== false;
      },
      createChildNote: parent => {
        if (typeof Z?.Item !== 'function') throw new Error('Zotero Child Note creation is unavailable.');
        const note = new Z.Item('note');
        note.libraryID = (parent as any).libraryID;
        note.parentID = (parent as any).id;
        return note;
      },
      setNoteContent: (note, html) => {
        if (typeof note.setNote !== 'function') throw new Error('Zotero Note editing is unavailable.');
        note.setNote(html);
      },
      commitNote: async note => {
        if (typeof note.saveTx !== 'function') throw new Error('Zotero Note transactions are unavailable.');
        return await note.saveTx();
      },
      recheck: input => {
        const expected = input.evidence.parent.identity;
        const parentID = localItemIDFromIdentity(expected);
        const parent = parentID == null ? null : Z?.Items?.get?.(parentID);
        const attachment: any = input.evidence.attachment;
        const actualAttachment = attachment?.id ? Z?.Items?.get?.(attachment.id) : attachment;
        const attachmentParentID = Number(actualAttachment?.parentID ?? actualAttachment?.parentItemID);
        const library = parent ? Z?.Libraries?.get?.(parent.libraryID) : null;
        return {
          parent,
          identity: parent ? identityFromItem(parent) : null,
          writable: !!parent && !!library && library.editable !== false,
          attachmentBelongs: !!parent && Number.isSafeInteger(attachmentParentID)
            && attachmentParentID === Number(parent.id),
          hasChildNotes: !!parent && hasAnyChildNotes(parent),
        };
      },
    });
  }

  private async runOne(
    request: BriefGenerationRequest,
    context: BriefGenerationTaskContext,
  ): Promise<BriefGenerationRunnerResult> {
    const client = await this.createClient();
    this.activeClients.add(client);
    try {
      const prompts = await briefPromptStore.loadRequired();
      context.throwIfCancelled();
      const config = getBriefGenerationConfigSnapshot();
      const runner = new BriefGenerationRunner({
        sourceBuilder: this.sourceBuilder(),
        client,
        noteWriter: this.noteWriter(),
      });
      const result = await runner.run({
        target: request.target,
        signal: context.signal,
        settings: {
          provider: 'alibaba-bailian',
          model: config.settings.modelName,
          maxInputTokens: config.settings.maxInputTokens,
          maxOutputTokens: config.settings.maxOutputTokens,
          thinkingEnabled: config.settings.thinkingEnabled,
          promptPair: {
            standard: prompts.standard.content,
            review: prompts.review.content,
            standardHash: prompts.standard.hash,
            reviewHash: prompts.review.hash,
          },
        },
        ...(request.allowExistingNotes ? { allowExistingNotes: true } : {}),
      });
      if (result.status === 'skipped') return result;
      if (result.status === 'cancelled') throw result.error || new Error('Brief generation was cancelled.');
      if (result.status === 'failed') throw result.error || new Error(result.reason);
      return result;
    } finally {
      this.activeClients.delete(client);
    }
  }

  private task(request: BriefGenerationRequest): BriefGenerationTask<BriefGenerationRunnerResult> {
    return {
      key: request.key,
      ...(request.skipReason ? { skipReason: request.skipReason } : {}),
      run: async context => {
        if (!context) throw new Error('Literature-brief task context is unavailable.');
        return await this.runOne(request, context);
      },
    };
  }

  async enqueueManual(request: BriefGenerationRequest): Promise<BriefJobResult> {
    this.assertGenerationReady(true);
    if (this.promptContext || this.scheduler.isCollectionActive()) {
      throw new Error('Another literature-brief task is still running.');
    }
    const outcome = await this.scheduler.enqueueManual(this.task(request));
    this.resolveIdleWaiters();
    return this.outcome(outcome);
  }

  async runCollection(requests: readonly BriefGenerationRequest[]): Promise<BriefJobResult[]> {
    this.assertGenerationReady(true);
    if (this.promptContext) throw new Error('Prompt customization is still running.');
    const outcomes = await this.scheduler.runCollection(requests.map(request => this.task(request)));
    this.resolveIdleWaiters();
    return outcomes.map(outcome => this.outcome(outcome));
  }

  private outcome(outcome: BriefTaskOutcome<BriefGenerationRunnerResult>): BriefJobResult {
    return {
      key: outcome.key,
      status: outcome.status,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
      ...(outcome.value ? { result: outcome.value } : {}),
      ...(outcome.error ? { error: safeBriefError(outcome.error) } : {}),
    };
  }
}

export const briefService = new BriefService();

/** Runtime orchestration boundary for literature-brief generation. */

import { getZotero } from '../utils/zotero-helper';
import { ZoteroAPI } from '../utils/zotero-api';
import { identityFromItem, localItemIDFromIdentity } from './identity-resolver';
import { getCloudModelSettings, getCloudProviderLabel } from './cloud-model-config';
import {
  cloudCredentialStore,
  getCloudCredentialRevision,
} from './cloud-credential-store';
import {
  getBriefGenerationConfigSnapshot,
  hasCurrentBriefConsent,
  isBriefConnectionVerified,
  setBriefConnectionVerified,
  setBriefGenerationSettings,
  validateBriefGenerationSettings,
  type BriefGenerationSettingsInput,
} from './brief-generation-config';
import {
  BriefGenerationClient,
  createBriefGenerationTaskContext,
  type BriefGenerationTaskContext,
} from './brief-generation-client';
import {
  BriefModelDiscoveryClient,
  briefProviderBaseUrl,
  type BriefModelSuggestion,
} from './brief-model-discovery';
import {
  BriefGenerationScheduler,
  type BriefGenerationTask,
  type BriefSchedulerProgress,
  type BriefTaskOutcome,
} from './brief-generation-scheduler';
import {
  BriefSourceBuilder,
  type BriefSourceEvidence,
  type BriefSourceTarget,
} from './brief-source-builder';
import {
  BriefGenerationRunner,
  estimateBriefGeneration,
  type BriefGenerationEstimate,
  type BriefGenerationRunnerResult,
  type BriefGenerationUsageSummary,
  type BriefRunnerSettings,
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
import {
  getBriefSetupSnapshot,
  markBriefSetupChoice,
  type BriefSetupSnapshot,
} from './brief-setup';

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
  /** @deprecated Generation now requires a fresh per-operation confirmation. */
  consentCurrent: boolean;
  config: ReturnType<typeof getBriefGenerationConfigSnapshot>;
  setup: BriefSetupSnapshot;
  prompts: Record<BriefPromptSlot, BriefRuntimePromptStatus>;
}

interface BriefModelCacheEntry {
  key: string;
  expiresAt: number;
  suggestions: BriefModelSuggestion[];
}

export interface BriefGenerationRequest {
  key: string;
  target: BriefSourceTarget;
  allowExistingNotes?: boolean;
  skipReason?: string;
}

export interface BriefPreparedGenerationRequest extends BriefGenerationRequest {
  source: BriefSourceEvidence;
  preparationBinding: string;
}

export type BriefGenerationPreparation =
  | {
      status: 'ready';
      request: BriefPreparedGenerationRequest;
      estimate: BriefGenerationEstimate;
      provider: string;
      providerLabel: string;
      model: string;
    }
  | { status: 'skipped' | 'failed'; result: BriefJobResult };

export interface BriefJobResult {
  key: string;
  status: 'success' | 'failed' | 'skipped' | 'cancelled';
  reason?: string;
  result?: BriefGenerationRunnerResult;
  error?: unknown;
}

export interface BriefJobUsageSummary extends BriefGenerationUsageSummary {}

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

export function summarizeBriefJobUsage(
  results: readonly BriefJobResult[],
): BriefJobUsageSummary | undefined {
  let requestCount = 0;
  let reportedRequests = 0;
  let unreportedRequests = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let reasoningTokens = 0;
  let hasPrompt = false;
  let hasCompletion = false;
  let hasTotal = false;
  let hasReasoning = false;
  let promptComplete = true;
  let completionComplete = true;
  for (const job of results) {
    const usage = job.result?.usage;
    if (!usage) continue;
    requestCount += usage.requestCount;
    reportedRequests += usage.reportedRequests;
    unreportedRequests += usage.unreportedRequests;
    if (usage.promptTokens === undefined) promptComplete = false;
    if (usage.completionTokens === undefined) completionComplete = false;
    if (usage.promptTokens !== undefined) {
      promptTokens += usage.promptTokens;
      hasPrompt = true;
    }
    if (usage.completionTokens !== undefined) {
      completionTokens += usage.completionTokens;
      hasCompletion = true;
    }
    if (usage.totalTokens !== undefined) {
      totalTokens += usage.totalTokens;
      hasTotal = true;
    }
    if (usage.reasoningTokens !== undefined) {
      reasoningTokens += usage.reasoningTokens;
      hasReasoning = true;
    }
  }
  if (requestCount === 0) return undefined;
  return {
    requestCount,
    reportedRequests,
    unreportedRequests,
    ...(hasPrompt && promptComplete ? { promptTokens } : {}),
    ...(hasCompletion && completionComplete ? { completionTokens } : {}),
    ...(hasTotal ? { totalTokens } : {}),
    ...(hasReasoning ? { reasoningTokens } : {}),
    complete: unreportedRequests === 0,
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
  private modelCache: BriefModelCacheEntry | null = null;

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
    // Read the same absolute preference branch used by setEnabled.
    try { return getZotero()?.Prefs?.get?.(BRIEF_ENABLED_PREF, true) === true; }
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
    const settings = validateBriefGenerationSettings(input);
    this.cancelAll();
    setBriefGenerationSettings(settings, getCloudModelSettings().provider);
  }

  private providerBaseUrl(): string {
    const cloud = getCloudModelSettings();
    const configured = cloud.provider === 'custom-openai-compatible'
      ? cloud.customBaseUrl
      : cloud.baseUrl;
    return briefProviderBaseUrl(cloud.provider, configured);
  }

  private connectionBinding() {
    const cloud = getCloudModelSettings();
    const config = getBriefGenerationConfigSnapshot(cloud.provider);
    return {
      configFingerprint: config.fingerprint,
      configRevision: config.revision,
      credentialRevision: getCloudCredentialRevision(cloud.provider),
      endpointFingerprint: endpointFingerprint(cloud.provider, this.providerBaseUrl()),
    };
  }

  private async createClient(): Promise<BriefGenerationClient> {
    const cloud = getCloudModelSettings();
    const config = getBriefGenerationConfigSnapshot(cloud.provider);
    if (config.status === 'invalid' || !config.settings.modelName) {
      throw new Error(config.error || 'The literature-brief generation configuration is invalid.');
    }
    const apiKey = await cloudCredentialStore.get(cloud.provider);
    if (!apiKey) throw new Error('The shared Cloud provider API key is missing.');
    return new BriefGenerationClient({
      provider: cloud.provider,
      baseUrl: this.providerBaseUrl(),
      apiKey,
      modelName: config.settings.modelName,
      maxOutputTokens: config.settings.maxOutputTokens,
      thinkingEnabled: config.settings.thinkingEnabled,
    });
  }

  async discoverModels(force = false): Promise<BriefModelSuggestion[]> {
    const cloud = getCloudModelSettings();
    const apiKey = await cloudCredentialStore.get(cloud.provider);
    if (!apiKey) throw new Error('The shared Cloud provider API key is missing.');
    const baseUrl = this.providerBaseUrl();
    const cacheKey = JSON.stringify({
      provider: cloud.provider,
      baseUrl,
      credentialRevision: getCloudCredentialRevision(cloud.provider),
    });
    const now = Date.now();
    if (!force && this.modelCache?.key === cacheKey && this.modelCache.expiresAt > now) {
      return this.modelCache.suggestions.map(item => ({ ...item }));
    }
    const suggestions = await new BriefModelDiscoveryClient({
      provider: cloud.provider,
      baseUrl,
      apiKey,
    }).discover();
    this.modelCache = {
      key: cacheKey,
      expiresAt: now + 10 * 60 * 1000,
      suggestions: suggestions.map(item => ({ ...item })),
    };
    return suggestions;
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
    const provider = getCloudModelSettings().provider;
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
      setBriefConnectionVerified(true, before, provider);
      return true;
    } catch (error) {
      setBriefConnectionVerified(false, undefined, provider);
      throw error;
    } finally {
      this.activeClients.delete(client);
      if (this.promptContext === context) this.promptContext = null;
      this.resolveIdleWaiters();
    }
  }

  private assertGenerationReady(requireSetup = false): void {
    if (!this.isEnabled()) throw new Error('Literature briefs are disabled in ZotSeek settings.');
    const cloud = getCloudModelSettings();
    if (!isBriefConnectionVerified(this.connectionBinding(), cloud.provider)) {
      throw new Error('Test the literature-brief connection in ZotSeek settings first.');
    }
    if (requireSetup && getBriefSetupSnapshot({
      enabled: true,
      connectionVerified: true,
      promptsAvailable: true,
    }).status !== 'ready') {
      throw new Error('Complete the literature-brief prompt guide first.');
    }
  }

  async getStatus(): Promise<BriefRuntimeStatus> {
    const cloud = getCloudModelSettings();
    let promptsDamaged = false;
    let prompts: Record<BriefPromptSlot, StoredBriefPrompt>;
    try {
      prompts = await briefPromptStore.loadRequired();
    } catch {
      // A broken active/custom profile must remain recoverable through the
      // guide. Bundled prompts are display-only until the user explicitly
      // chooses them or publishes a new personalized pair.
      promptsDamaged = true;
      prompts = await briefPromptStore.loadBundledRequired();
    }
    let hasCredential = false;
    try { hasCredential = await cloudCredentialStore.has(cloud.provider); } catch { /* surfaced by status */ }
    let providerSupported = true;
    let baseUrl = '';
    try { baseUrl = this.providerBaseUrl(); }
    catch { providerSupported = false; }
    const connectionVerified = providerSupported
      && isBriefConnectionVerified(this.connectionBinding(), cloud.provider);
    const setup = getBriefSetupSnapshot({
      enabled: this.isEnabled(),
      connectionVerified,
      promptsAvailable: !!prompts.standard && !!prompts.review,
      promptsDamaged,
    });
    return {
      enabled: this.isEnabled(),
      busy: this.isBusy(),
      busyMode: this.getBusyMode(),
      provider: cloud.provider,
      providerSupported,
      providerLabel: getCloudProviderLabel(cloud.provider),
      baseUrl,
      hasCredential,
      connectionVerified,
      consentCurrent: hasCurrentBriefConsent(),
      config: getBriefGenerationConfigSnapshot(cloud.provider),
      setup,
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
      const result = await new BriefPromptCustomizer(client).customize(form, { signal: context.signal });
      if (result.save?.status === 'enabled') markBriefSetupChoice('customized');
      return result;
    } finally {
      if (client) this.activeClients.delete(client);
      if (this.promptContext === context) this.promptContext = null;
      this.resolveIdleWaiters();
    }
  }

  async importPrompt(slot: BriefPromptSlot, path: string): Promise<StoredBriefPrompt> {
    if (this.isBusy()) throw new Error('Another literature-brief task is still running.');
    const prompt = await briefPromptStore.importFromFile(slot, path);
    markBriefSetupChoice('imported');
    return prompt;
  }

  async resetPrompts(): Promise<Record<BriefPromptSlot, StoredBriefPrompt>> {
    if (this.isBusy()) throw new Error('Another literature-brief task is still running.');
    const prompts = await briefPromptStore.resetToBundled();
    markBriefSetupChoice('bundled');
    return prompts;
  }

  async useBundledPrompts(): Promise<Record<BriefPromptSlot, StoredBriefPrompt>> {
    return await this.resetPrompts();
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

  private runnerSettings(
    prompts: Record<BriefPromptSlot, StoredBriefPrompt>,
  ): BriefRunnerSettings {
    const cloud = getCloudModelSettings();
    const config = getBriefGenerationConfigSnapshot(cloud.provider);
    return {
      provider: cloud.provider,
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
    };
  }

  private preparationBinding(
    prompts: Record<BriefPromptSlot, StoredBriefPrompt>,
  ): string {
    const cloud = getCloudModelSettings();
    return JSON.stringify({
      provider: cloud.provider,
      ...this.connectionBinding(),
      standardPromptHash: prompts.standard.hash,
      reviewPromptHash: prompts.review.hash,
    });
  }

  /** Read and estimate locally. No provider client or HTTP request is created. */
  async prepareGeneration(
    request: BriefGenerationRequest,
  ): Promise<BriefGenerationPreparation> {
    this.assertGenerationReady(true);
    if (this.promptContext || this.scheduler.isCollectionActive()) {
      throw new Error('Another literature-brief task is still running.');
    }
    const built = await this.sourceBuilder().build(request.target);
    if (built.status === 'insufficient_text') {
      const runnerResult: BriefGenerationRunnerResult = {
        status: 'skipped',
        reason: 'insufficient_text',
        ...(built.evidence ? { evidence: built.evidence } : {}),
      };
      return {
        status: 'skipped',
        result: { key: request.key, status: 'skipped', reason: runnerResult.reason, result: runnerResult },
      };
    }
    if (built.status === 'failed') {
      const skipped = built.reason === 'no_main_pdf';
      const runnerResult: BriefGenerationRunnerResult = skipped
        ? { status: 'skipped', reason: 'no_main_pdf', error: built.error }
        : { status: 'failed', reason: built.reason, error: built.error };
      return {
        status: skipped ? 'skipped' : 'failed',
        result: {
          key: request.key,
          status: skipped ? 'skipped' : 'failed',
          reason: runnerResult.reason,
          result: runnerResult,
        },
      };
    }
    const source = built.evidence;
    if (!source.parent.title && !source.parent.abstract) {
      const runnerResult: BriefGenerationRunnerResult = {
        status: 'failed',
        reason: 'missing_metadata',
      };
      return {
        status: 'failed',
        result: { key: request.key, status: 'failed', reason: runnerResult.reason, result: runnerResult },
      };
    }
    // Re-read all mutable settings after local PDF extraction. The resulting
    // binding is checked again immediately before a provider client is made.
    this.assertGenerationReady(true);
    const prompts = await briefPromptStore.loadRequired();
    const settings = this.runnerSettings(prompts);
    const estimate = estimateBriefGeneration(source, settings);
    const cloud = getCloudModelSettings();
    return {
      status: 'ready',
      request: {
        ...request,
        source,
        preparationBinding: this.preparationBinding(prompts),
      },
      estimate,
      provider: cloud.provider,
      providerLabel: getCloudProviderLabel(cloud.provider),
      model: settings.model,
    };
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
    this.assertGenerationReady(true);
    const prepared = request as Partial<BriefPreparedGenerationRequest>;
    if (!prepared.source || !prepared.preparationBinding) {
      return { status: 'failed', reason: 'confirmation_required' };
    }
    const prompts = await briefPromptStore.loadRequired();
    if (prepared.preparationBinding !== this.preparationBinding(prompts)) {
      return { status: 'failed', reason: 'preparation_changed' };
    }
    context.throwIfCancelled();
    const client = await this.createClient();
    const confirmedPrompts = await briefPromptStore.loadRequired();
    if (prepared.preparationBinding !== this.preparationBinding(confirmedPrompts)) {
      return { status: 'failed', reason: 'preparation_changed' };
    }
    this.activeClients.add(client);
    try {
      context.throwIfCancelled();
      const runner = new BriefGenerationRunner({
        sourceBuilder: this.sourceBuilder(),
        client,
        noteWriter: this.noteWriter(),
      });
      const result = await runner.run({
        source: prepared.source,
        signal: context.signal,
        settings: this.runnerSettings(confirmedPrompts),
        ...(request.allowExistingNotes ? { allowExistingNotes: true } : {}),
      });
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
    if (outcome.status === 'success' && outcome.value?.status === 'skipped') {
      return {
        key: outcome.key,
        status: 'skipped',
        reason: outcome.value.reason,
        result: outcome.value,
      };
    }
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

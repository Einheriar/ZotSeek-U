/** Provider-aware Cloud client dedicated to literature-brief generation. */

import type { CloudProviderId } from './cloud-model-config';
import {
  briefProviderBaseUrl,
} from './brief-model-discovery';

declare const Zotero: any;

type FetchLike = (input: string, init?: any) => Promise<any>;
type SleepLike = (milliseconds: number) => Promise<void>;

export type BriefMessageRole = 'system' | 'user' | 'assistant';

export interface BriefGenerationMessage {
  role: BriefMessageRole;
  content: string;
}

export interface BriefGenerationClientConfig {
  provider: CloudProviderId;
  baseUrl: string;
  modelName: string;
  apiKey: string;
  maxOutputTokens: number;
  thinkingEnabled: boolean;
  requestTimeoutMs?: number;
  maxResponseChars?: number;
}

export interface BriefGenerationClientDependencies {
  fetch?: FetchLike;
  sleep?: SleepLike;
  now?: () => number;
  abortController?: any;
}

export interface BriefGenerationRequestOptions {
  /** Retry count after the initial attempt. The default of 3 means 4 attempts total. */
  retries?: number;
  /** Per-request ceiling for reasoning plus visible output. */
  maxCompletionTokens?: number;
  /** Shared task cancellation signal. */
  signal?: AbortSignal;
  /** One event for every HTTP attempt after it may have reached the provider. */
  onUsage?: (usage: BriefGenerationUsage | undefined) => void;
}

export type BriefProviderErrorCategory =
  | 'authentication'
  | 'permission'
  | 'invalid-request'
  | 'rate-limited'
  | 'context-limit'
  | 'server'
  | 'upstream'
  | 'protocol'
  | 'timeout';

export interface BriefGenerationTaskContext {
  readonly signal: AbortSignal;
  readonly cancelled: boolean;
  cancel(): void;
  throwIfCancelled(): void;
}

/** One cancellation object shared by extraction, classification, generation and commit. */
export function createBriefGenerationTaskContext(): BriefGenerationTaskContext {
  // Zotero's plugin sandbox may only expose this DOM constructor on its window.
  const Controller = abortControllerCtor();
  if (!Controller) throw new Error('Brief task cancellation is unavailable in this runtime.');
  const controller = new Controller();
  return {
    get signal() { return controller.signal; },
    get cancelled() { return controller.signal.aborted; },
    cancel: () => controller.abort(),
    throwIfCancelled: () => {
      if (controller.signal.aborted) throw new BriefGenerationCancelledError();
    },
  };
}

export interface BriefGenerationUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
}

export interface BriefGenerationResult {
  content: string;
  reasoningContent?: string;
  model: string;
  finishReason: 'stop';
  usage?: BriefGenerationUsage;
  requestId?: string;
}

export class BriefGenerationRequestError extends Error {
  readonly code = 'BRIEF_GENERATION_REQUEST_ERROR' as const;

  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
    public readonly retryable = false,
    public readonly category: BriefProviderErrorCategory = 'protocol',
  ) {
    super(message);
    this.name = 'BriefGenerationRequestError';
  }
}

export class BriefGenerationUnavailableError extends Error {
  readonly code = 'BRIEF_GENERATION_UNAVAILABLE' as const;

  constructor() {
    super('The brief generation service is temporarily unavailable. Try again later.');
    this.name = 'BriefGenerationUnavailableError';
  }
}

export class BriefGenerationCancelledError extends Error {
  readonly code = 'BRIEF_GENERATION_CANCELLED' as const;

  constructor() {
    super('Brief generation was cancelled.');
    this.name = 'BriefGenerationCancelledError';
  }
}

export class BriefGenerationTruncatedError extends Error {
  readonly code = 'BRIEF_GENERATION_TRUNCATED' as const;

  constructor() {
    super('The brief generation response was truncated and was not accepted.');
    this.name = 'BriefGenerationTruncatedError';
  }
}

const DEFAULT_TIMEOUT_MS = 120_000;
const RETRY_DELAYS_MS = [1000, 3000, 8000];
const MAX_RETRY_AFTER_MS = 60_000;

export function parseBriefRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.ceil(seconds * 1000), MAX_RETRY_AFTER_MS);
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.min(Math.max(0, date - now), MAX_RETRY_AFTER_MS);
}

function safeProviderCode(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body);
    const candidate = parsed?.error?.code ?? parsed?.code ?? parsed?.error?.type;
    if (typeof candidate !== 'string') return undefined;
    // Only stable, documented provider labels may cross the error boundary.
    // Sanitizing arbitrary provider text is not a reliable redaction method.
    const allowed = new Set([
      'invalid_api_key', 'permission_denied', 'rate_limit', 'context_length_exceeded',
      'invalid_request_error', 'server_error', 'insufficient_quota',
    ]);
    return allowed.has(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function providerCategory(status: number): BriefProviderErrorCategory {
  if (status === 401) return 'authentication';
  if (status === 403) return 'permission';
  if (status === 413 || status === 422) return 'context-limit';
  if (status === 400) return 'invalid-request';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'server';
  return 'upstream';
}

function abortControllerCtor(explicit?: any): any | null {
  if (explicit) return explicit;
  if (typeof AbortController !== 'undefined') return AbortController;
  try { return Zotero.getMainWindow?.()?.AbortController || null; } catch { return null; }
}

function optionalTokenCount(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function parseUsage(value: any): BriefGenerationUsage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const usage: BriefGenerationUsage = {
    promptTokens: optionalTokenCount(value.prompt_tokens),
    completionTokens: optionalTokenCount(value.completion_tokens),
    totalTokens: optionalTokenCount(value.total_tokens),
    reasoningTokens: optionalTokenCount(value.completion_tokens_details?.reasoning_tokens),
  };
  return Object.values(usage).some(item => item !== undefined) ? usage : undefined;
}

export class BriefGenerationClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly sleepImpl: SleepLike;
  private readonly now: () => number;
  private readonly abortController: any;
  private readonly activeControllers = new Set<any>();
  private readonly cancelledControllers = new Set<any>();
  private readonly timedOutControllers = new Set<any>();
  private cancellationGeneration = 0;
  private readonly retryWaiters = new Set<() => void>();

  constructor(
    private readonly config: BriefGenerationClientConfig,
    dependencies: BriefGenerationClientDependencies = {},
  ) {
    this.baseUrl = briefProviderBaseUrl(config.provider, config.baseUrl);
    if (!config.apiKey.trim()) throw new Error('Cloud API key is missing.');
    if (!config.modelName.trim()) throw new Error('Brief generation model name is missing.');
    if (!Number.isSafeInteger(config.maxOutputTokens) || config.maxOutputTokens <= 0) {
      throw new Error('Brief generation maximum output tokens must be a positive integer.');
    }
    if (typeof config.thinkingEnabled !== 'boolean') {
      throw new Error('Brief generation thinking mode must be a boolean.');
    }
    this.fetchImpl = dependencies.fetch || fetch.bind(globalThis);
    this.sleepImpl = dependencies.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.now = dependencies.now || Date.now;
    this.abortController = abortControllerCtor(dependencies.abortController);
  }

  private endpoint(): string {
    if (this.config.provider === 'openai') return `${this.baseUrl}/responses`;
    if (this.config.provider === 'google-gemini-api') {
      return `${this.baseUrl}/models/${encodeURIComponent(this.config.modelName)}:generateContent`;
    }
    return `${this.baseUrl}/chat/completions`;
  }

  private headers(): Record<string, string> {
    if (this.config.provider === 'google-gemini-api') {
      return { 'x-goog-api-key': this.config.apiKey, 'Content-Type': 'application/json' };
    }
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private requestBody(
    messages: BriefGenerationMessage[],
    maxCompletionTokens: number,
  ): Record<string, unknown> {
    if (this.config.provider === 'openai') {
      return {
        model: this.config.modelName,
        input: messages.map(message => ({
          role: message.role,
          content: [{ type: 'input_text', text: message.content }],
        })),
        max_output_tokens: maxCompletionTokens,
      };
    }
    if (this.config.provider === 'google-gemini-api') {
      const systemText = messages
        .filter(message => message.role === 'system')
        .map(message => message.content)
        .join('\n\n');
      const contents = messages.filter(message => message.role !== 'system').map(message => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }));
      return {
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        contents,
        generationConfig: { maxOutputTokens: maxCompletionTokens },
      };
    }
    return {
      model: this.config.modelName,
      messages,
      max_completion_tokens: maxCompletionTokens,
      ...(this.config.provider === 'alibaba-bailian'
        ? { enable_thinking: this.config.thinkingEnabled }
        : {}),
      stream: false,
    };
  }

  private responseUsage(json: any): BriefGenerationUsage | undefined {
    if (this.config.provider === 'openai') {
      const usage: BriefGenerationUsage = {
        promptTokens: optionalTokenCount(json?.usage?.input_tokens),
        completionTokens: optionalTokenCount(json?.usage?.output_tokens),
        totalTokens: optionalTokenCount(json?.usage?.total_tokens),
        reasoningTokens: optionalTokenCount(json?.usage?.output_tokens_details?.reasoning_tokens),
      };
      return Object.values(usage).some(value => value !== undefined) ? usage : undefined;
    }
    if (this.config.provider === 'google-gemini-api') {
      const usage: BriefGenerationUsage = {
        promptTokens: optionalTokenCount(json?.usageMetadata?.promptTokenCount),
        completionTokens: optionalTokenCount(json?.usageMetadata?.candidatesTokenCount),
        totalTokens: optionalTokenCount(json?.usageMetadata?.totalTokenCount),
        reasoningTokens: optionalTokenCount(json?.usageMetadata?.thoughtsTokenCount),
      };
      return Object.values(usage).some(value => value !== undefined) ? usage : undefined;
    }
    return parseUsage(json?.usage);
  }

  private parseSuccess(json: any): BriefGenerationResult {
    if (this.config.provider === 'openai') {
      if (json?.status === 'incomplete' || json?.incomplete_details?.reason === 'max_output_tokens') {
        throw new BriefGenerationTruncatedError();
      }
      if (json?.status !== 'completed') {
        throw new BriefGenerationRequestError(
          'Cloud provider did not complete the brief generation response.',
          502, undefined, false, 'protocol',
        );
      }
      const content = Array.isArray(json?.output)
        ? json.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
          .filter((item: any) => item?.type === 'output_text' && typeof item.text === 'string')
          .map((item: any) => item.text)
          .join('\n')
          .trim()
        : '';
      if (!content) {
        throw new BriefGenerationRequestError(
          'Cloud provider returned an empty brief generation response.',
          502, undefined, false, 'protocol',
        );
      }
      return {
        content,
        model: typeof json.model === 'string' ? json.model : this.config.modelName,
        finishReason: 'stop',
        usage: this.responseUsage(json),
        requestId: typeof json.id === 'string' ? json.id : undefined,
      };
    }

    if (this.config.provider === 'google-gemini-api') {
      const candidate = Array.isArray(json?.candidates) && json.candidates.length === 1
        ? json.candidates[0]
        : null;
      if (candidate?.finishReason === 'MAX_TOKENS') throw new BriefGenerationTruncatedError();
      if (!candidate || candidate.finishReason !== 'STOP') {
        throw new BriefGenerationRequestError(
          'Cloud provider did not complete the brief generation response.',
          502, undefined, false, 'protocol',
        );
      }
      const content = Array.isArray(candidate?.content?.parts)
        ? candidate.content.parts
          .filter((part: any) => typeof part?.text === 'string')
          .map((part: any) => part.text)
          .join('\n')
          .trim()
        : '';
      if (!content) {
        throw new BriefGenerationRequestError(
          'Cloud provider returned an empty brief generation response.',
          502, undefined, false, 'protocol',
        );
      }
      return {
        content,
        model: typeof json.modelVersion === 'string' ? json.modelVersion : this.config.modelName,
        finishReason: 'stop',
        usage: this.responseUsage(json),
      };
    }

    const choice = Array.isArray(json?.choices) && json.choices.length === 1
      ? json.choices[0]
      : null;
    if (!choice || typeof choice !== 'object' || choice === null
        || typeof choice.message !== 'object' || choice.message === null) {
      throw new BriefGenerationRequestError(
        'Cloud provider returned an invalid brief generation response.',
        502, undefined, false, 'protocol',
      );
    }
    if (choice.finish_reason === 'length') throw new BriefGenerationTruncatedError();
    if (choice.finish_reason !== 'stop') {
      throw new BriefGenerationRequestError(
        'Cloud provider did not complete the brief generation response.',
        502, undefined, false, 'protocol',
      );
    }
    const content = typeof choice.message.content === 'string'
      ? choice.message.content.trim()
      : '';
    if (!content) {
      throw new BriefGenerationRequestError(
        'Cloud provider returned an empty brief generation response.',
        502, undefined, false, 'protocol',
      );
    }
    const reasoningContent = typeof choice.message.reasoning_content === 'string'
      && choice.message.reasoning_content.trim()
      ? choice.message.reasoning_content
      : undefined;
    const requestId = typeof json.id === 'string'
      ? json.id
      : typeof json.request_id === 'string' ? json.request_id : undefined;
    return {
      content,
      reasoningContent,
      model: typeof json.model === 'string' ? json.model : this.config.modelName,
      finishReason: 'stop',
      usage: this.responseUsage(json),
      requestId,
    };
  }

  private async request(
    messages: BriefGenerationMessage[],
    maxCompletionTokens: number,
    signal?: AbortSignal,
    onUsage?: (usage: BriefGenerationUsage | undefined) => void,
  ): Promise<BriefGenerationResult> {
    const endpoint = this.endpoint();
    const Controller = this.abortController;
    const controller = Controller ? new Controller() : null;
    if (controller) this.activeControllers.add(controller);
    const timeoutMs = this.config.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let attemptStarted = false;
    let usageReported = false;
    const reportUsage = (usage: BriefGenerationUsage | undefined) => {
      if (usageReported) return;
      usageReported = true;
      try { onUsage?.(usage); } catch { /* accounting must not break generation */ }
    };
    const timer = controller ? setTimeout(() => {
      this.timedOutControllers.add(controller);
      controller.abort();
    }, timeoutMs) : null;
    timeoutTimer = timer;
    let removeAbortListener: (() => void) | null = null;
    try {
      if (signal?.aborted) throw new BriefGenerationCancelledError();
      if (signal && controller) {
        const abort = () => {
          this.cancelledControllers.add(controller);
          try { controller.abort(); } catch { /* request completion handles cleanup */ }
        };
        signal.addEventListener('abort', abort, { once: true });
        removeAbortListener = () => signal.removeEventListener('abort', abort);
      }
      attemptStarted = true;
      const request = this.fetchImpl(endpoint, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.requestBody(messages, maxCompletionTokens)),
        redirect: 'error',
        ...(controller ? { signal: controller.signal } : signal ? { signal } : {}),
      });
      const response = controller
        ? await request
        : await Promise.race([
            request,
            new Promise<never>((_, reject) => {
              timeoutTimer = setTimeout(
                () => reject(new BriefGenerationRequestError(
                  'Brief generation request timed out.', undefined, undefined, true, 'timeout',
                )),
                timeoutMs,
              );
            }),
          ]);
      if (signal?.aborted) throw new BriefGenerationCancelledError();
      if (!response || typeof response !== 'object' ||
          typeof response.ok !== 'boolean' || !Number.isSafeInteger(response.status)) {
        throw new BriefGenerationRequestError(
          'Cloud provider returned an invalid HTTP response.', 502, undefined, false, 'upstream',
        );
      }
      const body = await response.text().catch(() => '');
      if (!response.ok) {
        try { reportUsage(this.responseUsage(JSON.parse(body))); }
        catch { reportUsage(undefined); }
        const providerCode = safeProviderCode(body);
        const suffix = providerCode ? ` (${providerCode})` : '';
        throw new BriefGenerationRequestError(
          `Cloud provider rejected brief generation with HTTP ${response.status}${suffix}.`,
          response.status,
          response.status === 429
            ? parseBriefRetryAfter(response.headers?.get?.('Retry-After') || null, this.now())
            : undefined,
          response.status === 429 || response.status >= 500,
          providerCategory(response.status),
        );
      }
      const maxResponseChars = this.config.maxResponseChars
        ?? Math.max(16_384, maxCompletionTokens * 8);
      if (body.length > maxResponseChars) {
        throw new BriefGenerationRequestError(
          'Cloud provider returned an unexpectedly large brief generation response.',
          502,
          undefined,
          false,
          'protocol',
        );
      }
      let json: any;
      try {
        json = JSON.parse(body);
      } catch {
        throw new BriefGenerationRequestError(
          'Cloud provider returned invalid JSON for brief generation.',
          502,
          undefined,
          false,
          'protocol',
        );
      }
      try {
        const result = this.parseSuccess(json);
        reportUsage(result.usage);
        return result;
      } catch (error) {
        // Truncated and otherwise rejected responses may still carry billable
        // usage. Preserve it even though their content is not accepted.
        reportUsage(this.responseUsage(json));
        throw error;
      }
    } catch (error) {
      if (attemptStarted && !usageReported) reportUsage(undefined);
      if (controller && this.cancelledControllers.has(controller)) {
        throw new BriefGenerationCancelledError();
      }
      if (controller && this.timedOutControllers.has(controller)) {
        throw new BriefGenerationRequestError(
          'Brief generation request timed out.',
          undefined,
          undefined,
          true,
          'timeout',
        );
      }
      throw error;
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (removeAbortListener) removeAbortListener();
      if (controller) {
        this.activeControllers.delete(controller);
        this.cancelledControllers.delete(controller);
        this.timedOutControllers.delete(controller);
      }
    }
  }

  private async requestWithRetry(
    messages: BriefGenerationMessage[],
    retries: number,
    maxCompletionTokens: number,
    cancellationGeneration: number,
    signal?: AbortSignal,
    onUsage?: (usage: BriefGenerationUsage | undefined) => void,
  ): Promise<BriefGenerationResult> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (cancellationGeneration !== this.cancellationGeneration || signal?.aborted) {
        throw new BriefGenerationCancelledError();
      }
      try {
        return await this.request(messages, maxCompletionTokens, signal, onUsage);
      } catch (error: any) {
        if (error instanceof BriefGenerationCancelledError ||
            error instanceof BriefGenerationTruncatedError) throw error;
        const retryable = error instanceof BriefGenerationRequestError
          ? error.retryable
          : !(signal?.aborted || cancellationGeneration !== this.cancellationGeneration);
        if (!retryable) throw error;
        if (attempt >= retries) break;
        const delay = error instanceof BriefGenerationRequestError
          && error.retryAfterMs !== undefined
          ? error.retryAfterMs
          : RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
        await this.waitForRetryDelay(delay, cancellationGeneration, signal);
      }
    }
    throw new BriefGenerationUnavailableError();
  }

  private async waitForRetryDelay(
    delayMs: number,
    cancellationGeneration: number,
    signal?: AbortSignal,
  ): Promise<void> {
    if (cancellationGeneration !== this.cancellationGeneration || signal?.aborted) {
      throw new BriefGenerationCancelledError();
    }
    let wakeForCancellation: () => void = () => {};
    const cancelled = new Promise<void>(resolve => { wakeForCancellation = resolve; });
    let removeAbortListener: (() => void) | null = null;
    if (signal) {
      const abort = () => wakeForCancellation();
      signal.addEventListener('abort', abort, { once: true });
      removeAbortListener = () => signal.removeEventListener('abort', abort);
    }
    this.retryWaiters.add(wakeForCancellation);
    try {
      await Promise.race([this.sleepImpl(delayMs), cancelled]);
    } finally {
      this.retryWaiters.delete(wakeForCancellation);
      if (removeAbortListener) removeAbortListener();
    }
    if (cancellationGeneration !== this.cancellationGeneration || signal?.aborted) {
      throw new BriefGenerationCancelledError();
    }
  }

  async generate(
    messages: BriefGenerationMessage[],
    options: BriefGenerationRequestOptions | number = {},
  ): Promise<BriefGenerationResult> {
    if (!Array.isArray(messages) || messages.length === 0 ||
        messages.some(message => !message ||
          !['system', 'user', 'assistant'].includes(message.role) ||
          typeof message.content !== 'string' || !message.content.trim())) {
      throw new Error('Brief generation messages must contain a role and non-empty text.');
    }
    // Keep numeric arguments compatible with the D0 client while callers move
    // to named options that make "retries" and total attempts unambiguous.
    const normalized = typeof options === 'number' ? { retries: options } : options;
    const retries = normalized.retries ?? 3;
    const maxCompletionTokens = normalized.maxCompletionTokens
      ?? this.config.maxOutputTokens;
    if (!Number.isSafeInteger(retries) || retries < 0) {
      throw new Error('Brief generation retry count must be a non-negative integer.');
    }
    if (!Number.isSafeInteger(maxCompletionTokens) || maxCompletionTokens <= 0 ||
        maxCompletionTokens > this.config.maxOutputTokens) {
      throw new Error(
        'Brief generation request maximum completion tokens must be a positive integer ' +
        'within the configured output budget.',
      );
    }
    return await this.requestWithRetry(
      messages,
      retries,
      maxCompletionTokens,
      this.cancellationGeneration,
      normalized.signal,
      normalized.onUsage,
    );
  }

  async probe(): Promise<BriefGenerationResult> {
    return await this.generate([
      {
        role: 'system',
        content: 'You are a connectivity probe. Think briefly, then follow the user request exactly.',
      },
      { role: 'user', content: 'Reply with exactly ZOTSEEK_BRIEF_THINKING_OK' },
    ], { retries: 0, maxCompletionTokens: Math.min(1024, this.config.maxOutputTokens) });
  }

  /** Abort in-flight HTTP calls. A later generate() call starts normally. */
  cancelPending(): void {
    this.cancellationGeneration++;
    for (const wake of this.retryWaiters) wake();
    this.retryWaiters.clear();
    for (const controller of this.activeControllers) {
      this.cancelledControllers.add(controller);
      try { controller.abort(); } catch { /* request completion handles cleanup */ }
    }
  }
}

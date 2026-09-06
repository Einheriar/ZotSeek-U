/** OpenAI-compatible Cloud client dedicated to literature-brief generation. */

import { assertCloudBaseUrl } from './cloud-model-config';

declare const Zotero: any;

type FetchLike = (input: string, init?: any) => Promise<any>;
type SleepLike = (milliseconds: number) => Promise<void>;

export type BriefMessageRole = 'system' | 'user' | 'assistant';

export interface BriefGenerationMessage {
  role: BriefMessageRole;
  content: string;
}

export interface BriefGenerationClientConfig {
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
  const controller = new AbortController();
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
    this.baseUrl = assertCloudBaseUrl(config.baseUrl).href.replace(/\/$/, '');
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

  private async request(
    messages: BriefGenerationMessage[],
    maxCompletionTokens: number,
    signal?: AbortSignal,
  ): Promise<BriefGenerationResult> {
    const endpoint = `${this.baseUrl}/chat/completions`;
    const Controller = this.abortController;
    const controller = Controller ? new Controller() : null;
    if (controller) this.activeControllers.add(controller);
    const timeoutMs = this.config.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
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
      const request = this.fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.modelName,
          messages,
          max_completion_tokens: maxCompletionTokens,
          enable_thinking: this.config.thinkingEnabled,
          stream: false,
        }),
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
      const choice = Array.isArray(json?.choices) && json.choices.length === 1
        ? json.choices[0]
        : null;
      if (!choice || typeof choice !== 'object' || choice === null ||
          typeof choice.message !== 'object' || choice.message === null) {
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
      if (typeof json.model !== 'string' || json.model !== this.config.modelName) {
        throw new BriefGenerationRequestError(
          'Cloud provider returned an unexpected brief generation model.',
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
        model: json.model,
        finishReason: 'stop',
        usage: parseUsage(json.usage),
        requestId,
      };
    } catch (error) {
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
  ): Promise<BriefGenerationResult> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (cancellationGeneration !== this.cancellationGeneration || signal?.aborted) {
        throw new BriefGenerationCancelledError();
      }
      try {
        return await this.request(messages, maxCompletionTokens, signal);
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

/**
 * Transport layer for Cloud embedding providers.
 *
 * The client owns everything that is provider-independent: batching, timeouts,
 * cancellation, retry/backoff, HTTP error classification and per-vector
 * validation. Everything provider-specific (endpoint, auth header, request
 * body and response shape) is delegated to a CloudEmbeddingRequestAdapter so
 * Bailian, OpenAI, Gemini and Custom (OpenAI-compatible) share one code path.
 */

import { embeddingVectorValidationError } from './embedding-validation';

declare const Zotero: any;

export type CloudEmbeddingKind = 'query' | 'document';

export interface CloudEmbeddingHttpRequest {
  endpoint: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface CloudEmbeddingParseResult {
  /** Embeddings ordered to match the request input. */
  embeddings: number[][];
  requestId?: string;
  totalTokens?: number;
}

export interface CloudEmbeddingRequestAdapter {
  buildRequest(texts: string[], kind: CloudEmbeddingKind): CloudEmbeddingHttpRequest;
  parseResponse(json: unknown, expectedCount: number): CloudEmbeddingParseResult;
}

export interface CloudEmbeddingClientConfig {
  adapter: CloudEmbeddingRequestAdapter;
  dimensions: number;
  apiKey: string;
  batchSize: number;
  requestTimeoutMs?: number;
}

export interface CloudEmbeddingBatchReceipt {
  requestId?: string;
  totalTokens?: number;
  inputCount: number;
  kind: CloudEmbeddingKind;
}

export interface CloudEmbeddingRequestOptions {
  kind?: CloudEmbeddingKind;
  retries?: number;
}

export interface CloudEmbeddingClientDependencies {
  fetch?: FetchLike;
  sleep?: SleepLike;
  now?: () => number;
  abortController?: any;
  onBatchSuccess?: (receipt: CloudEmbeddingBatchReceipt) => void;
}

type FetchLike = (input: string, init?: any) => Promise<any>;
type SleepLike = (milliseconds: number) => Promise<void>;

export class CloudEmbeddingRequestError extends Error {
  readonly code = 'CLOUD_EMBEDDING_REQUEST_ERROR' as const;

  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'CloudEmbeddingRequestError';
  }
}

export class CloudEmbeddingUnavailableError extends Error {
  readonly code = 'CLOUD_EMBEDDING_UNAVAILABLE' as const;

  constructor() {
    super('The Cloud embedding service is temporarily unavailable. Try again later or switch models.');
    this.name = 'CloudEmbeddingUnavailableError';
  }
}

export class CloudEmbeddingCancelledError extends Error {
  readonly code = 'CLOUD_EMBEDDING_CANCELLED' as const;

  constructor() {
    super('Cloud embedding request was cancelled.');
    this.name = 'CloudEmbeddingCancelledError';
  }
}

const DEFAULT_TIMEOUT_MS = 30000;
const RETRY_DELAYS_MS = [1000, 3000, 8000];
const MAX_RETRY_AFTER_MS = 60000;

export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
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
    const safe = candidate.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64);
    return safe || undefined;
  } catch {
    return undefined;
  }
}

function abortControllerCtor(explicit?: any): any | null {
  if (explicit) return explicit;
  if (typeof AbortController !== 'undefined') return AbortController;
  try { return Zotero.getMainWindow?.()?.AbortController || null; } catch { return null; }
}

/** Shared vector validation: every provider's output passes the same gate. */
function assertValidEmbeddingVector(embedding: unknown, dimensions: number): void {
  const detail = embeddingVectorValidationError(embedding, dimensions);
  if (detail) {
    throw new CloudEmbeddingRequestError(
      `Cloud provider returned an invalid embedding; expected ${dimensions} finite values (${detail}).`,
      502,
    );
  }
}

export class CloudEmbeddingClient {
  private readonly adapter: CloudEmbeddingRequestAdapter;
  private readonly dimensions: number;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly sleepImpl: SleepLike;
  private readonly now: () => number;
  private readonly abortController: any;
  private readonly onBatchSuccess?: (receipt: CloudEmbeddingBatchReceipt) => void;
  private readonly activeControllers = new Set<any>();
  private readonly cancelledControllers = new Set<any>();

  constructor(
    private readonly config: CloudEmbeddingClientConfig,
    dependencies: CloudEmbeddingClientDependencies = {},
  ) {
    this.adapter = config.adapter;
    this.dimensions = config.dimensions;
    this.apiKey = config.apiKey;
    if (!this.adapter || typeof this.adapter.buildRequest !== 'function'
      || typeof this.adapter.parseResponse !== 'function') {
      throw new Error('Cloud embedding client requires a request adapter.');
    }
    if (!config.apiKey.trim()) throw new Error('Cloud API key is missing.');
    if (!Number.isInteger(config.dimensions) || config.dimensions <= 0) {
      throw new Error('Cloud embedding dimensions must be a positive integer.');
    }
    if (!Number.isInteger(config.batchSize) || config.batchSize <= 0) {
      throw new Error('Cloud batch size must be a positive integer.');
    }
    this.fetchImpl = dependencies.fetch || fetch.bind(globalThis);
    this.sleepImpl = dependencies.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.now = dependencies.now || Date.now;
    this.abortController = abortControllerCtor(dependencies.abortController);
    this.onBatchSuccess = dependencies.onBatchSuccess;
  }

  private async requestBatch(texts: string[], kind: CloudEmbeddingKind): Promise<number[][]> {
    const request = this.adapter.buildRequest(texts, kind);
    const Controller = this.abortController;
    const controller = Controller ? new Controller() : null;
    if (controller) this.activeControllers.add(controller);
    const timeoutMs = this.config.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const fetchPromise = this.fetchImpl(request.endpoint, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
        redirect: 'error',
        ...(controller ? { signal: controller.signal } : {}),
      });
      const response = controller
        ? await fetchPromise
        : await Promise.race([
            fetchPromise,
            new Promise<never>((_, reject) => setTimeout(
              () => reject(new Error('Cloud request timed out.')),
              timeoutMs,
            )),
          ]);
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const providerCode = safeProviderCode(body);
        const suffix = providerCode ? ` (${providerCode})` : '';
        throw new CloudEmbeddingRequestError(
          `Cloud provider rejected the request with HTTP ${response.status}${suffix}.`,
          response.status,
          response.status === 429
            ? parseRetryAfter(response.headers?.get?.('Retry-After') || null, this.now())
            : undefined,
          response.status === 429 || response.status >= 500,
        );
      }
      const json = await response.json();
      const parsed = this.adapter.parseResponse(json, texts.length);
      for (const embedding of parsed.embeddings) {
        assertValidEmbeddingVector(embedding, this.config.dimensions);
      }
      this.onBatchSuccess?.({
        requestId: parsed.requestId,
        totalTokens: parsed.totalTokens,
        inputCount: texts.length,
        kind,
      });
      return parsed.embeddings;
    } catch (error) {
      if (controller && this.cancelledControllers.has(controller)) {
        throw new CloudEmbeddingCancelledError();
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
      if (controller) {
        this.activeControllers.delete(controller);
        this.cancelledControllers.delete(controller);
      }
    }
  }

  private async requestBatchWithRetry(
    texts: string[],
    kind: CloudEmbeddingKind,
    retries: number,
  ): Promise<number[][]> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.requestBatch(texts, kind);
      } catch (error: any) {
        if (error instanceof CloudEmbeddingCancelledError) throw error;
        const status = error instanceof CloudEmbeddingRequestError ? error.status : undefined;
        const retryable = error instanceof CloudEmbeddingRequestError
          ? error.retryable
          : status === undefined;
        if (!retryable || attempt >= retries) {
          if (error instanceof CloudEmbeddingRequestError && !error.retryable) {
            throw error;
          }
          lastError = error;
          break;
        }
        lastError = error;
        const delay = error instanceof CloudEmbeddingRequestError && error.retryAfterMs !== undefined
          ? error.retryAfterMs
          : RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
        await this.sleepImpl(delay);
      }
    }
    void lastError;
    throw new CloudEmbeddingUnavailableError();
  }

  async embed(
    texts: string[],
    options: CloudEmbeddingRequestOptions = {},
  ): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.some(text => typeof text !== 'string' || text.length === 0)) {
      throw new Error('Cloud embedding inputs must be non-empty strings.');
    }
    const kind = options.kind || 'document';
    const retries = options.retries ?? 3;
    const results: number[][] = [];
    for (let start = 0; start < texts.length; start += this.config.batchSize) {
      const batch = texts.slice(start, start + this.config.batchSize);
      results.push(...await this.requestBatchWithRetry(batch, kind, retries));
    }
    return results;
  }

  async probe(): Promise<number> {
    // Test query and document paths separately without sending user data.
    const [documentEmbedding] = await this.embed(
      ['zotseek cloud document role probe'],
      { kind: 'document', retries: 0 },
    );
    const [queryEmbedding] = await this.embed(
      ['zotseek cloud query role probe'],
      { kind: 'query', retries: 0 },
    );
    if (documentEmbedding?.length !== queryEmbedding?.length) {
      throw new CloudEmbeddingRequestError('Cloud provider returned inconsistent role dimensions.', 502);
    }
    return documentEmbedding?.length || 0;
  }

  /** Abort in-flight HTTP calls. A later embed() call starts normally. */
  cancelPending(): void {
    for (const controller of this.activeControllers) {
      this.cancelledControllers.add(controller);
      try { controller.abort(); } catch { /* request completion handles cleanup */ }
    }
  }
}

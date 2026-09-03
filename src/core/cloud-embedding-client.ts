/** OpenAI-compatible Cloud embedding client with Bailian-specific safety limits. */

import { assertCloudBaseUrl } from './cloud-model-config';

declare const Zotero: any;

type FetchLike = (input: string, init?: any) => Promise<any>;
type SleepLike = (milliseconds: number) => Promise<void>;

export interface CloudEmbeddingClientConfig {
  baseUrl: string;
  modelName: string;
  dimensions: number;
  apiKey: string;
  batchSize: number;
  requestTimeoutMs?: number;
}

export interface CloudEmbeddingClientDependencies {
  fetch?: FetchLike;
  sleep?: SleepLike;
  now?: () => number;
  abortController?: any;
}

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

export class CloudEmbeddingClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly sleepImpl: SleepLike;
  private readonly now: () => number;
  private readonly abortController: any;
  private readonly activeControllers = new Set<any>();
  private readonly cancelledControllers = new Set<any>();

  constructor(
    private readonly config: CloudEmbeddingClientConfig,
    dependencies: CloudEmbeddingClientDependencies = {},
  ) {
    this.baseUrl = assertCloudBaseUrl(config.baseUrl).href.replace(/\/$/, '');
    if (!config.apiKey.trim()) throw new Error('Cloud API key is missing.');
    if (!Number.isInteger(config.dimensions) || config.dimensions <= 0) {
      throw new Error('Cloud embedding dimensions must be a positive integer.');
    }
    if (!Number.isInteger(config.batchSize) || config.batchSize <= 0) {
      throw new Error('Cloud embedding batch size must be a positive integer.');
    }
    this.fetchImpl = dependencies.fetch || fetch.bind(globalThis);
    this.sleepImpl = dependencies.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.now = dependencies.now || Date.now;
    this.abortController = abortControllerCtor(dependencies.abortController);
  }

  private async requestBatch(texts: string[]): Promise<number[][]> {
    const endpoint = `${this.baseUrl}/embeddings`;
    const Controller = this.abortController;
    const controller = Controller ? new Controller() : null;
    if (controller) this.activeControllers.add(controller);
    const timeoutMs = this.config.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const request = this.fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.modelName,
          input: texts,
          dimensions: this.config.dimensions,
        }),
        redirect: 'error',
        ...(controller ? { signal: controller.signal } : {}),
      });
      const response = controller
        ? await request
        : await Promise.race([
            request,
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
      const data = Array.isArray(json?.data) ? json.data : [];
      if (data.length !== texts.length) {
        throw new CloudEmbeddingRequestError(
          `Cloud provider returned ${data.length} embeddings for ${texts.length} inputs.`,
          502,
        );
      }
      const ordered: number[][] = new Array(texts.length);
      const seen = new Set<number>();
      for (const entry of data) {
        const index = entry?.index;
        const embedding = entry?.embedding;
        if (!Number.isInteger(index) || index < 0 || index >= texts.length || seen.has(index)) {
          throw new CloudEmbeddingRequestError('Cloud provider returned invalid embedding indexes.', 502);
        }
        if (!Array.isArray(embedding) || embedding.length !== this.config.dimensions ||
            embedding.some((value: unknown) => typeof value !== 'number' || !Number.isFinite(value))) {
          throw new CloudEmbeddingRequestError(
            `Cloud provider returned an invalid embedding; expected ${this.config.dimensions} finite values.`,
            502,
          );
        }
        seen.add(index);
        ordered[index] = embedding;
      }
      return ordered;
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

  private async requestBatchWithRetry(texts: string[], retries: number): Promise<number[][]> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.requestBatch(texts);
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

  async embed(texts: string[], retries = 3): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.some(text => typeof text !== 'string' || text.length === 0)) {
      throw new Error('Cloud embedding inputs must be non-empty strings.');
    }
    const results: number[][] = [];
    for (let start = 0; start < texts.length; start += this.config.batchSize) {
      const batch = texts.slice(start, start + this.config.batchSize);
      results.push(...await this.requestBatchWithRetry(batch, retries));
    }
    return results;
  }

  async probe(): Promise<number> {
    // The explicit Settings test validates both the configured batch size and
    // vector dimensions using fixed text, never library or query content.
    const probes = Array.from(
      { length: this.config.batchSize },
      (_, index) => `zotseek cloud connection probe ${index + 1}`,
    );
    const [embedding] = await this.embed(probes, 0);
    return embedding?.length || 0;
  }

  /** Abort in-flight HTTP calls. A later embed() call starts normally. */
  cancelPending(): void {
    for (const controller of this.activeControllers) {
      this.cancelledControllers.add(controller);
      try { controller.abort(); } catch { /* request completion handles cleanup */ }
    }
  }
}

/**
 * Embedding Pipeline - Generate embeddings for semantic search
 *
 * Uses ChromeWorker + Transformers.js for high quality neural embeddings.
 */

import { Logger } from '../utils/logger';
import { DEFAULT_MODEL_ID, getActiveModel, getModel, ModelConfig, modelBasePath, setActiveModelId,
  requiresLocalFiles, missingModelMessage, brokenSubstitutionMessage, legacyLocationMessage,
  ModelLocation } from './model-registry';
import { findModelLocation, ensureModelsResourceSubstitution } from './model-download';
import { ServerEmbeddingClient } from './server-embedding-client';
import { CloudEmbeddingClient } from './cloud-embedding-client';
import { cloudCredentialStore } from './cloud-credential-store';
import {
  createCloudEmbeddingRequestAdapter,
} from './cloud-embedding-adapter';
import {
  getCloudModelSettings,
  hasCurrentCloudConsent,
  isCloudConnectionVerified,
  isCloudModelConfigured,
} from './cloud-model-config';
import { getModelInputConfig, type ModelInputConfig } from './model-input-config';
import {
  resolveModelInputPolicy,
  type ResolvedModelInputPolicy,
} from './model-input-policy';
import { tokenizerService } from './tokenizer-service';
import { prepareWorkerInput } from './worker-input';

declare const ChromeWorker: any;
declare const Zotero: any;

export interface EmbeddingResult {
  embedding: number[];
  modelId: string;
  processingTimeMs: number;
}

export interface EmbeddingProgress {
  current: number;
  total: number;
  currentTitle: string;
  status: 'loading' | 'processing' | 'done' | 'error';
}

export type ProgressCallback = (progress: EmbeddingProgress) => void;

type PendingWorkerJob = {
  resolve: (result: EmbeddingResult) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

/**
 * Embedding Pipeline with ChromeWorker support
 */
export class EmbeddingPipeline {
  private logger: Logger;
  // Keep module construction safe when the user has persisted an incomplete
  // Server slot. init() resolves the actual operational model on first use.
  private model: ModelConfig = getModel(DEFAULT_MODEL_ID)!;
  private inputConfig: ModelInputConfig = getModelInputConfig(this.model);
  private inputPolicy: ResolvedModelInputPolicy = resolveModelInputPolicy(this.model);
  private worker: any = null;
  private serverClient: ServerEmbeddingClient | null = null;
  private cloudClient: CloudEmbeddingClient | null = null;
  private workerReady = false;
  private pendingJobs = new Map<string, PendingWorkerJob>();
  private ready = false;
  // In-flight init() promise so N concurrent cold-start callers share a single
  // worker creation instead of each spawning (and leaking) their own. Cleared
  // on failure so a later call can retry.
  private initPromise: Promise<void> | null = null;
  // Bounded recovery attempts so a permanently-broken worker doesn't loop forever
  // within a single embed() call. Resets on every successful embed.
  private consecutiveRecoveries = 0;
  private static MAX_RECOVERIES_PER_EMBED = 2;

  // Concurrent Full-mode semantic branches can ask for the same query
  // embedding. Share only the in-flight work; completed results are removed
  // immediately so this does not become a persistent query cache.
  private queryEmbeddingsInFlight = new Map<string, Promise<EmbeddingResult>>();
  // Distinguishes calls that started before a reset/model switch from the
  // current lifecycle, including calls still waiting for init() to finish.
  private queryEmbeddingLifecycle = 0;

  // Time allowed for the worker to report ready. Covers reading the model
  // off disk and initialising the WASM runtime, both of which scale with
  // model size and disk speed.
  private static WORKER_INIT_TIMEOUT_MS = 30000;

  // Which of the two download directories the active model was found in, so the
  // worker is pointed at the matching resource:// host. Null for bundled and
  // server models, which are not in either.
  private modelLocation: ModelLocation | null = null;

  constructor() {
    this.logger = new Logger('EmbeddingPipeline');
  }

  /**
   * Initialize the embedding pipeline
   */
  async init(): Promise<void> {
    if (this.ready) return;
    if (this.initPromise) return this.initPromise;
    this.model = getActiveModel();
    this.inputConfig = getModelInputConfig(this.model);
    const requestedTokens = typeof Zotero !== 'undefined'
      ? Zotero?.Prefs?.get('zotseek.maxTokens', true)
      : undefined;
    this.inputPolicy = resolveModelInputPolicy(this.model, requestedTokens);

    this.initPromise = (async () => {
      if (this.model.runtime === 'server') {
        this.logger.info(`Initializing server-backed embedding pipeline (${this.model.baseUrl})`);
        await this.initServerClient();  // Will throw on failure (unreachable / dimension mismatch)
      } else if (this.model.runtime === 'cloud') {
        this.logger.info(`Initializing Cloud embedding pipeline (${this.model.cloudProvider})`);
        await this.initCloudClient();
      } else {
        // Downloaded models resolve over resource://zotseek-models/. If the
        // files are absent, Transformers.js fails with its own wording naming
        // that URL. Check first so the error can point to the automatic and
        // guided manual installation actions in Settings.
        if (requiresLocalFiles(this.model)) {
          // Files first: absent weights are both the likelier problem and the
          // one with clear advice. Only if they ARE present does an unusable
          // mapping become the explanation worth reporting -- telling someone
          // to re-download a model that is already on disk is a dead end.
          this.modelLocation = await findModelLocation(this.model);
          if (this.modelLocation === null) {
            this.logger.error(`Model files missing for "${this.model.id}"; refusing to start the worker`);
            throw new Error(missingModelMessage(this.model));
          }
          if (this.modelLocation === 'legacy') {
            // Loads fine from a local data folder, hangs from a network one
            // (issue #24). Not fatal, so say it once rather than refuse.
            this.logger.warn(legacyLocationMessage(this.model));
          }
          const reason = ensureModelsResourceSubstitution();
          if (reason !== null) {
            this.logger.error(`resource:// mapping unusable for "${this.model.id}": ${reason}`);
            throw new Error(brokenSubstitutionMessage(this.model, reason));
          }
        }
        this.logger.info('Initializing embedding pipeline with Transformers.js');
        await this.initWorker();  // Will throw on failure
        this.logger.info('Using Transformers.js via ChromeWorker');
      }
      this.ready = true;
    })();
    const thisAttempt = this.initPromise;
    try {
      await thisAttempt;
    } catch (e) {
      // Reset so a later call can retry; a failed init must not poison retries.
      if (this.initPromise === thisAttempt) this.initPromise = null;
      throw e;
    }
  }

  /**
   * Initialize ChromeWorker for Transformers.js
   */
  private async initWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Get worker script path
        const workerPath = 'chrome://zotseek/content/scripts/embedding-worker.js';

        this.logger.info(`Creating ChromeWorker: ${workerPath}`);
        this.worker = new ChromeWorker(workerPath);

        const timeout = setTimeout(() => {
          // Name the model and its size: a timeout on a 570 MB model on a slow
          // disk means something different from one on a bundled model, and the
          // bare message made issue #24 impossible to triage from the report.
          reject(new Error(
            `Worker initialization timeout after ${EmbeddingPipeline.WORKER_INIT_TIMEOUT_MS / 1000}s ` +
            `loading "${this.model.label}" (${this.model.approxSizeMB} MB, ${this.model.bundled ? 'bundled' : 'downloaded'})`,
          ));
        }, EmbeddingPipeline.WORKER_INIT_TIMEOUT_MS);

        this.worker.onmessage = (event: any) => {
          const { type, status, jobId, error, embedding, modelId, processingTimeMs, message, level, data } = event.data;

          if (type === 'log') {
            // Handle log messages from worker
            const logMessage = data ? `${message} - ${JSON.stringify(data)}` : message;
            switch(level) {
              case 'error':
                this.logger.error(logMessage);
                break;
              case 'warn':
                this.logger.warn(logMessage);
                break;
              case 'info':
              default:
                this.logger.info(logMessage);
                break;
            }
          } else if (type === 'status') {
            // Only log important status updates, suppress repetitive loading progress
            if (status !== 'loading' || !message?.includes('Loading model:')) {
              this.logger.info(`Worker status: ${status} - ${message}`);
            }
            if (status === 'ready') {
              clearTimeout(timeout);
              this.workerReady = true;
              resolve();
            }
          } else if (type === 'error') {
            this.logger.error(`Worker error: ${error}`);
            const job = jobId ? this.takePendingJob(jobId) : undefined;
            if (job) {
              job.reject(new Error(error));
            } else {
              clearTimeout(timeout);
              reject(new Error(error));
            }
          } else if (type === 'embedding' && jobId) {
            const job = this.takePendingJob(jobId);
            if (job) {
              job.resolve({ embedding, modelId, processingTimeMs });
            }
          }
        };

        this.worker.onerror = (event: any) => {
          // Extract detailed error info from ErrorEvent
          const errorInfo = {
            message: event.message || 'Unknown error',
            filename: event.filename || 'unknown',
            lineno: event.lineno || 0,
            colno: event.colno || 0,
            error: event.error?.toString() || event.error?.message || 'No error details',
          };
          this.logger.error(`Worker error: ${errorInfo.message} at ${errorInfo.filename}:${errorInfo.lineno}:${errorInfo.colno}`);
          this.logger.error(`Error details: ${errorInfo.error}`);
          clearTimeout(timeout);

          // Mark the worker as dead so embed() will trigger recovery.
          // Reject any in-flight jobs with a recoverable error code so the
          // caller knows to retry rather than treat as permanent failure.
          this.workerReady = false;
          this.rejectPendingJobs(new Error('WORKER_DIED'));

          reject(new Error(`Worker failed: ${errorInfo.message}`));
        };

        this.worker.postMessage({
          type: 'init',
          model: {
            modelId: this.model.id,
            hfPath: this.model.hfPath,
            pooling: this.model.pooling,
            normalize: this.model.normalize,
            queryPrefix: this.model.queryPrefix,
            docPrefix: this.model.docPrefix,
            basePath: modelBasePath(this.model, this.modelLocation ?? 'profile'),
            quantization: this.inputConfig.quantization,
            // Worker threads cannot read Zotero prefs; resolve the WebGPU
            // opt-in here and ship it with the init message.
            webgpu: this.isWebGPUEnabled(),
          },
        });

      } catch (error) {
        this.logger.error('Failed to create ChromeWorker:', error);
        reject(error);
      }
    });
  }

  /**
   * Initialize the server-backed branch: verify the configured model is listed,
   * then probe once to confirm the dimensions still match. A mismatch means
   * the user swapped the model behind the same name: indexing under the stored
   * model_id would corrupt the vector space, so we refuse.
   */
  private async initServerClient(): Promise<void> {
    const { baseUrl, serverModelName, apiKey } = this.model;
    if (!baseUrl || !serverModelName) {
      throw new Error(`Local Server model '${this.model.id}' is missing its server configuration`);
    }
    const client = new ServerEmbeddingClient({ baseUrl, serverModelName, apiKey });
    const availableModels = await client.listModels();
    if (!availableModels.includes(serverModelName)) {
      throw new Error(
        `Local Server model '${serverModelName}' is not listed by ${baseUrl}. ` +
        'Load that model in the inference server or correct zotseek-server-models.json.'
      );
    }
    const dims = await client.probe();
    if (dims !== this.model.dimensions) {
      throw new Error(
        `Local Server model '${serverModelName}' now returns ${dims}-dimensional embeddings, ` +
        `but this ZotSeek model was added with ${this.model.dimensions}. ` +
        `The model behind this name has changed: update zotseek-server-models.json ` +
        `with a new model id (a re-index will be required).`
      );
    }
    this.serverClient = client;
  }

  /** Create the Cloud client without a paid probe; Settings owns explicit connection testing. */
  private async initCloudClient(): Promise<void> {
    const { cloudProvider, cloudModelName, cloudBatchSize, cloudQueryRole, cloudDocumentRole } = this.model;
    if (!cloudProvider || !cloudModelName || !cloudBatchSize ||
        cloudQueryRole === undefined || cloudDocumentRole === undefined) {
      throw new Error(`Cloud model '${this.model.id}' is missing its provider configuration.`);
    }
    if (!isCloudModelConfigured()) {
      throw new Error(
        'Cloud model configuration is incomplete. Open ZotSeek Settings and select a Cloud model.',
      );
    }
    if (!hasCurrentCloudConsent(cloudProvider)) {
      throw new Error('Cloud disclosure has not been accepted. Open ZotSeek Settings and select Cloud again.');
    }
    if (!isCloudConnectionVerified(cloudProvider)) {
      throw new Error('Cloud connection is not verified. Test it in ZotSeek Settings before use.');
    }
    const apiKey = await cloudCredentialStore.get(cloudProvider);
    if (!apiKey) {
      throw new Error('Cloud API key is missing. Open ZotSeek Settings and configure Cloud Model.');
    }
    const adapter = createCloudEmbeddingRequestAdapter(getCloudModelSettings(), apiKey);
    this.cloudClient = new CloudEmbeddingClient({
      adapter,
      dimensions: this.model.dimensions,
      apiKey,
      batchSize: cloudBatchSize,
    });
  }

  /**
   * Generate embedding for text using worker
   * @param text - Text to embed
   * @param kind - 'query' for search queries, 'doc' for documents
   */
  private async embedWithWorker(text: string, kind: 'query' | 'doc' = 'doc'): Promise<EmbeddingResult> {
    return new Promise((resolve, reject) => {
      const jobId = Math.random().toString(36).substring(2, 15);

      // Timeout for individual embedding
      // With smaller chunks (~2000 tokens), embeddings should take ~3-10 seconds
      // First embedding may be slower due to WASM compilation
      const timeoutId = setTimeout(() => {
        const job = this.takePendingJob(jobId);
        if (job) job.reject(new Error('Embedding timeout'));
      }, 60000); // 60 seconds - enough for first-run WASM compilation

      this.pendingJobs.set(jobId, { resolve, reject, timeoutId });

      try {
        this.worker.postMessage({
          type: 'embed',
          jobId,
          data: { text, kind },
        });
      } catch (error: any) {
        const job = this.takePendingJob(jobId);
        job?.reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /** Remove one pending job and release its timer before settling its promise. */
  private takePendingJob(jobId: string): PendingWorkerJob | undefined {
    const job = this.pendingJobs.get(jobId);
    if (!job) return undefined;
    this.pendingJobs.delete(jobId);
    clearTimeout(job.timeoutId);
    return job;
  }

  /** Reject every in-flight job without leaving dormant timeout callbacks behind. */
  private rejectPendingJobs(error: Error): void {
    for (const [jobId, job] of this.pendingJobs) {
      this.pendingJobs.delete(jobId);
      clearTimeout(job.timeoutId);
      job.reject(error);
    }
  }

  private async diagnoseExactInput(text: string, kind: 'query' | 'doc'): Promise<void> {
    const maxInputTokens = this.inputPolicy.maxInputTokens;
    if (!this.inputPolicy.supportsExactTokenCount || maxInputTokens === null) return;
    try {
      const counter = kind === 'query'
        ? await tokenizerService.getQueryTokenCounter()
        : await tokenizerService.getDocumentTokenCounter();
      if (!counter) return;
      const tokenCount = counter(text);
      if (tokenCount > maxInputTokens) {
        // This is diagnostic only. Transformers.js feature extraction enables
        // tokenizer truncation, so preserving the full source input here avoids
        // an additional character-based cut with different semantics.
        this.logger.warn(
          `${this.model.label} ${kind} input is ${tokenCount} tokens after its prefix; ` +
          `the model tokenizer will truncate it to ${maxInputTokens} tokens.`
        );
      }
    } catch (error: any) {
      // Chunk extraction still requires the exact tokenizer for supported
      // multilingual models. This inference preflight must not replace the
      // model's own tokenizer or turn its automatic truncation into an error.
      this.logger.warn(
        `Exact ${kind} input diagnostic unavailable for ${this.model.label}: ${error?.message || error}`
      );
    }
  }

  /**
   * Generate embedding for a single text
   * @param text - Text to embed
   * @param kind - 'query' for search queries, 'doc' for documents
   *
   * Resilient against worker death: if the ChromeWorker has crashed (sleep,
   * OOM, parent process recycled the worker process), this method silently
   * tears it down and re-initialises before retrying. Bounded by
   * MAX_RECOVERIES_PER_EMBED to prevent an infinite loop on a permanently
   * broken state.
   */
  async embed(text: string, kind: 'query' | 'doc' = 'doc'): Promise<EmbeddingResult> {
    if (!this.ready) {
      await this.init();
    }
    await this.diagnoseExactInput(text, kind);
    if (this.model.runtime === 'server') {
      if (!this.serverClient) await this.init();
      const start = Date.now();
      const prepared = prepareWorkerInput(text, kind, {
        queryPrefix: this.model.queryPrefix,
        docPrefix: this.model.docPrefix,
      });
      // Search queries fail fast (1 retry); documents get the full backoff (3).
      const retries = kind === 'query' ? 1 : 3;
      const [embedding] = await this.serverClient!.embed([prepared], retries);
      return { embedding, modelId: this.model.id, processingTimeMs: Date.now() - start };
    }
    if (this.model.runtime === 'cloud') {
      if (!this.cloudClient) await this.init();
      const start = Date.now();
      const retries = kind === 'query' ? 1 : 3;
      const [embedding] = await this.cloudClient!.embed([text], {
        kind: kind === 'query' ? 'query' : 'document',
        retries,
      });
      return { embedding, modelId: this.model.id, processingTimeMs: Date.now() - start };
    }
    for (let attempt = 0; ; attempt++) {
      if (!this.ready || !this.workerReady) {
        await this.recoverWorker();
      }
      try {
        const result = await this.embedWithWorker(text, kind);
        this.consecutiveRecoveries = 0;
        return result;
      } catch (e: any) {
        const isWorkerDeath = e?.message === 'WORKER_DIED' || !this.workerReady;
        if (!isWorkerDeath) throw e;
        if (attempt >= EmbeddingPipeline.MAX_RECOVERIES_PER_EMBED) {
          throw new Error(
            `Embedding worker died and could not be recovered after ${attempt + 1} attempts`
          );
        }
        this.consecutiveRecoveries++;
        this.logger.warn(
          `Embedding worker died - attempting recovery (${this.consecutiveRecoveries} total)`
        );
        // Loop: recoverWorker() will run at the top of the next iteration.
      }
    }
  }

  /**
   * Tear down the current worker (if any) and re-initialise. Used both for
   * the first init and for recovery after a worker crash.
   */
  private async recoverWorker(): Promise<void> {
    if (this.worker) {
      try { this.worker.terminate(); } catch { /* ignore */ }
      this.worker = null;
    }
    this.serverClient = null;
    this.cloudClient = null;
    this.workerReady = false;
    this.ready = false;
    this.initPromise = null;
    this.rejectPendingJobs(new Error('WORKER_DIED'));
    await this.init();
  }

  /**
   * Convenience method for embedding search queries
   * Uses the model's query prefix for better retrieval
   */
  async embedQuery(query: string): Promise<EmbeddingResult> {
    const lifecycle = this.queryEmbeddingLifecycle;
    // Resolve the actual runtime model before constructing the key. The
    // persisted selection may differ from the constructor default on a cold
    // start, and the key must describe the vector space doing the work.
    await this.init();
    if (lifecycle !== this.queryEmbeddingLifecycle) {
      // A reset while init() was pending invalidated this caller's pre-reset
      // state. Re-enter under the current model instead of registering a
      // flight from the old lifecycle.
      return this.embedQuery(query);
    }
    const key = `${this.model.id}\u0000${query}`;
    const existing = this.queryEmbeddingsInFlight.get(key);
    if (existing) return existing;

    const flight = this.embed(query, 'query');
    this.queryEmbeddingsInFlight.set(key, flight);
    try {
      return await flight;
    } finally {
      // A reset/model switch can start a newer flight for the same key after
      // clearing this map. Never let the old promise remove that newer entry.
      if (this.queryEmbeddingsInFlight.get(key) === flight) {
        this.queryEmbeddingsInFlight.delete(key);
      }
    }
  }

  /**
   * Convenience method for embedding documents
   * Uses the model's document prefix for better retrieval
   */
  async embedDocument(text: string): Promise<EmbeddingResult> {
    return this.embed(text, 'doc');
  }

  /** True when the active model runs on a local inference server. */
  isServerBacked(): boolean {
    return getActiveModel().runtime === 'server';
  }

  /** True for HTTP runtimes that can embed multiple document chunks per call. */
  supportsBatchEmbedding(): boolean {
    const runtime = getActiveModel().runtime;
    return runtime === 'server' || runtime === 'cloud';
  }

  /** Abort only remote Cloud requests; local runtimes keep their existing lifecycle. */
  cancelPendingRequests(): void {
    this.cloudClient?.cancelPending();
  }

  /**
   * Batched document embedding for Local Server and Cloud HTTP runtimes.
   * Local Server applies its declared text prefix; Cloud sends raw text with an API role.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (!this.ready) await this.init();
    if (this.model.runtime === 'server' && this.serverClient) {
      const prepared = texts.map(text => prepareWorkerInput(text, 'doc', {
        queryPrefix: this.model.queryPrefix,
        docPrefix: this.model.docPrefix,
      }));
      return this.serverClient.embed(prepared);
    }
    if (this.model.runtime === 'cloud' && this.cloudClient) {
      return this.cloudClient.embed(texts, { kind: 'document' });
    }
    throw new Error('embedDocuments is only available with an HTTP-backed model');
  }

  /**
   * Check if pipeline is ready
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Whether the user opted into the experimental WebGPU path.
   * Default false: on Firefox 153 (Zotero 11) WebGPU is measurably slower
   * than the multithreaded WASM path for embedding workloads, and the GPU
   * path additionally requires fp16 weights that are not bundled.
   */
  private isWebGPUEnabled(): boolean {
    try {
      const Z = (globalThis as any).Zotero;
      return Z?.Prefs?.get('zotseek.webgpu.enabled', true) === true;
    } catch {
      return false;
    }
  }

  /**
   * Reset pipeline to force re-initialization with new settings
   */
  reset(): void {
    this.logger.info('Resetting embedding pipeline');
    this.queryEmbeddingLifecycle++;
    this.queryEmbeddingsInFlight.clear();
    if (this.worker) {
      try { this.worker.terminate(); } catch { /* ignore */ }
      this.worker = null;
    }
    this.serverClient = null;
    this.cloudClient = null;
    this.workerReady = false;
    this.ready = false;
    this.initPromise = null;
    this.consecutiveRecoveries = 0;
    this.rejectPendingJobs(new Error('Pipeline reset'));
    tokenizerService.reset();
  }

  /**
   * Switch to a different embedding model, tearing down and re-initialising
   * the worker. If modelId is unknown, falls back to the active model from prefs.
   */
  async setModel(modelId: string): Promise<void> {
    const found = getModel(modelId);
    if (!found) {
      this.logger.warn(`setModel: unknown model id '${modelId}', keeping active model`);
      return;
    }
    if (found.id === this.model.id && this.ready &&
        (found.runtime !== 'onnx' || this.workerReady)) return;
    this.logger.info(`Switching embedding model to ${found.id}`);
    // The active model is defined by the pref; init() reads it via getActiveModel().
    // Persist it here so the worker reload picks up the requested model.
    setActiveModelId(found.id);
    this.reset();
    await this.init();
  }

  /**
   * Get current model ID
   */
  getModelId(): string {
    return this.model.id;
  }

  /**
   * Get model info
   */
  getModelInfo(): { id: string; dimensions: number; description: string } {
    return {
      id: this.model.id,
      dimensions: this.model.dimensions,
      description: `${this.model.label} (${this.model.dimensions} dims)`,
    };
  }

  /**
   * Cleanup worker
   */
  destroy(): void {
    this.queryEmbeddingLifecycle++;
    this.queryEmbeddingsInFlight.clear();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.serverClient = null;
    this.cloudClient = null;
    this.rejectPendingJobs(new Error('Pipeline destroyed'));
    tokenizerService.reset();
  }
}

// Singleton instance
export const embeddingPipeline = new EmbeddingPipeline();

/**
 * Lazy exact tokenizer for document chunking.
 *
 * The embedding worker owns its own Transformers.js instance. Chunking happens
 * on the main thread before text is sent to that worker, so the two supported
 * multilingual models use a tokenizer-only instance here to enforce their
 * real context limits. It is loaded lazily, then reused for the active model.
 */

import { AutoTokenizer, env } from '@huggingface/transformers';
import type { TokenCounter } from '../utils/chunker';
import { Logger } from '../utils/logger';
import {
  applyPrefix,
  getActiveModel,
  modelBasePath,
  requiresLocalFiles,
  type ModelConfig,
} from './model-registry';
import { getModelInputConfig } from './model-input-config';
import { findModelLocation } from './model-download';

declare const Zotero: any;
declare const ChromeWorker: any;

const TOKEN_CACHE_LIMIT = 4096;

export class TokenizerService {
  private logger = new Logger('TokenizerService');
  private tokenizer: any = null;
  private loadedModel: ModelConfig | null = null;
  private initPromise: Promise<boolean> | null = null;
  private failedModelId: string | null = null;
  private tokenCache = new Map<string, number>();

  async getDocumentTokenCounter(): Promise<TokenCounter | undefined> {
    return this.getTokenCounter('doc');
  }

  async getQueryTokenCounter(): Promise<TokenCounter | undefined> {
    return this.getTokenCounter('query');
  }

  /** Return a synchronous counter after one model-aware lazy load. */
  private async getTokenCounter(kind: 'query' | 'doc'): Promise<TokenCounter | undefined> {
    const model = getActiveModel();
    const inputConfig = getModelInputConfig(model);

    if (model.runtime !== 'onnx' || !inputConfig.supportsExactTokenCount) {
      if (this.loadedModel?.id !== model.id) this.reset();
      return undefined;
    }

    // Node regression tests provide a partial Zotero stub and cannot resolve
    // chrome:// model URLs. Real Zotero exposes ChromeWorker in this context.
    if (typeof Zotero === 'undefined' || typeof ChromeWorker === 'undefined') {
      return undefined;
    }

    if (this.loadedModel?.id === model.id && this.tokenizer) {
      return text => this.countTokens(text, kind);
    }
    if ((this.loadedModel && this.loadedModel.id !== model.id) ||
        (this.failedModelId && this.failedModelId !== model.id)) {
      this.reset();
    }
    if (this.failedModelId === model.id) {
      throw new Error(`Exact tokenizer for ${model.label} is unavailable; indexing cannot continue safely.`);
    }

    const ready = await this.init(model);
    return ready ? text => this.countTokens(text, kind) : undefined;
  }

  private async init(model: ModelConfig): Promise<boolean> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const startedAt = Date.now();
      try {
        env.allowRemoteModels = false;
        env.allowLocalModels = true;
        env.useBrowserCache = false;
        const location = requiresLocalFiles(model) ? await findModelLocation(model) : null;
        if (requiresLocalFiles(model) && location === null) {
          throw new Error(`Tokenizer files are missing for ${model.label}`);
        }
        env.localModelPath = modelBasePath(model, location ?? 'profile');

        this.logger.info(`Loading exact tokenizer for ${model.id}`);
        this.tokenizer = await AutoTokenizer.from_pretrained(model.hfPath, {
          local_files_only: true,
        });
        this.loadedModel = model;
        this.failedModelId = null;
        this.tokenCache.clear();
        this.logger.info(`Exact tokenizer ready in ${Date.now() - startedAt}ms`);
        return true;
      } catch (error: any) {
        this.tokenizer = null;
        this.loadedModel = null;
        this.failedModelId = model.id;
        const reason = error?.message || error;
        this.logger.error(`Exact tokenizer unavailable for ${model.id}: ${reason}`);
        throw new Error(
          `Exact tokenizer for ${model.label} could not be loaded. ` +
          `ZotSeek will not use an unsafe estimate for multilingual input. ${reason}`
        );
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  private countTokens(text: string, kind: 'query' | 'doc'): number {
    if (!this.tokenizer || !this.loadedModel) {
      throw new Error('Exact tokenizer is not initialized');
    }

    const input = applyPrefix(text, kind, this.loadedModel);
    const cacheKey = `${this.loadedModel.id}:${kind}:${input}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached !== undefined) {
      // Refresh insertion order for the bounded LRU cache.
      this.tokenCache.delete(cacheKey);
      this.tokenCache.set(cacheKey, cached);
      return cached;
    }

    const encoded: any = this.tokenizer(input);
    const count = Number(encoded.input_ids.data.length);
    for (const value of Object.values(encoded) as any[]) {
      if (value && typeof value.dispose === 'function') value.dispose();
    }

    this.tokenCache.set(cacheKey, count);
    if (this.tokenCache.size > TOKEN_CACHE_LIMIT) {
      const oldest = this.tokenCache.keys().next().value;
      if (oldest !== undefined) this.tokenCache.delete(oldest);
    }
    return count;
  }

  /** Release the tokenizer and cached text references on shutdown/model change. */
  reset(): void {
    try {
      this.tokenizer?.dispose?.();
    } catch {
      // Tokenizers currently have no mandatory disposal path.
    }
    this.tokenizer = null;
    this.loadedModel = null;
    this.initPromise = null;
    this.failedModelId = null;
    this.tokenCache.clear();
  }
}

export const tokenizerService = new TokenizerService();

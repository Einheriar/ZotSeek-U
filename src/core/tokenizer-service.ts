/**
 * Lazy exact tokenizer for document chunking.
 *
 * The embedding worker owns its own Transformers.js instance. Chunking happens
 * on the main thread before text is sent to that worker, so Notes mode needs a
 * small tokenizer-only instance here to enforce multilingual E5's real
 * 512-token context limit. It is loaded only when Notes/Full extraction runs,
 * then reused for the rest of the Zotero session.
 */

import { AutoTokenizer, env } from '@huggingface/transformers';
import type { TokenCounter } from '../utils/chunker';
import { Logger } from '../utils/logger';
import { applyPrefix, getActiveModel, modelBasePath, type ModelConfig } from './model-registry';

declare const Zotero: any;
declare const ChromeWorker: any;

const EXACT_TOKENIZER_MODEL_ID = 'multilingual-e5-base';
const TOKEN_CACHE_LIMIT = 4096;

export class TokenizerService {
  private logger = new Logger('TokenizerService');
  private tokenizer: any = null;
  private loadedModel: ModelConfig | null = null;
  private initPromise: Promise<boolean> | null = null;
  private failedModelId: string | null = null;
  private tokenCache = new Map<string, number>();

  /**
   * Return a synchronous document-token counter after one lazy async load.
   * Unsupported/server models keep using the chunker's conservative fallback.
   */
  async getDocumentTokenCounter(): Promise<TokenCounter | undefined> {
    const model = getActiveModel();

    // This fork ships and tunes exact chunking for multilingual E5. Other
    // selectable models have different tokenizers/context limits and retain
    // the existing estimator until they receive model-specific tuning.
    if (model.runtime !== 'onnx' || model.id !== EXACT_TOKENIZER_MODEL_ID) {
      if (this.loadedModel?.id !== model.id) this.reset();
      return undefined;
    }

    // Node regression tests provide a partial Zotero stub and cannot resolve
    // chrome:// model URLs. Real Zotero exposes ChromeWorker in this context.
    if (typeof Zotero === 'undefined' || typeof ChromeWorker === 'undefined') {
      return undefined;
    }

    if (this.loadedModel?.id === model.id && this.tokenizer) {
      return text => this.countDocumentTokens(text);
    }
    if (this.failedModelId === model.id) return undefined;

    const ready = await this.init(model);
    return ready ? text => this.countDocumentTokens(text) : undefined;
  }

  private async init(model: ModelConfig): Promise<boolean> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const startedAt = Date.now();
      try {
        env.allowRemoteModels = false;
        env.allowLocalModels = true;
        env.useBrowserCache = false;
        env.localModelPath = modelBasePath(model);

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
        this.logger.warn(
          `Exact tokenizer unavailable for ${model.id}; using fallback estimator: ${error?.message || error}`
        );
        return false;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  private countDocumentTokens(text: string): number {
    if (!this.tokenizer || !this.loadedModel) {
      throw new Error('Exact tokenizer is not initialized');
    }

    const input = applyPrefix(text, 'doc', this.loadedModel);
    const cached = this.tokenCache.get(input);
    if (cached !== undefined) {
      // Refresh insertion order for the bounded LRU cache.
      this.tokenCache.delete(input);
      this.tokenCache.set(input, cached);
      return cached;
    }

    const encoded: any = this.tokenizer(input);
    const count = Number(encoded.input_ids.data.length);
    for (const value of Object.values(encoded) as any[]) {
      if (value && typeof value.dispose === 'function') value.dispose();
    }

    this.tokenCache.set(input, count);
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

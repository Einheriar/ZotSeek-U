/** Provider-aware model discovery for literature-brief generation. */

import {
  assertCustomProviderBaseUrl,
  type CloudProviderId,
} from './cloud-model-config';

type FetchLike = (input: string, init?: any) => Promise<any>;

export const OPENAI_BRIEF_BASE_URL = 'https://api.openai.com/v1';
export const GEMINI_BRIEF_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export interface BriefModelSuggestion {
  id: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  verifiedCapability: boolean;
}

export interface BriefModelDiscoveryConfig {
  provider: CloudProviderId;
  baseUrl: string;
  apiKey: string;
  requestTimeoutMs?: number;
}

export interface BriefModelDiscoveryDependencies {
  fetch?: FetchLike;
  abortController?: any;
}

export class BriefModelDiscoveryError extends Error {
  readonly code = 'BRIEF_MODEL_DISCOVERY_ERROR' as const;

  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'BriefModelDiscoveryError';
  }
}

function normalizedHttpsBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new BriefModelDiscoveryError('The literature-brief provider URL is invalid.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new BriefModelDiscoveryError('The literature-brief provider URL must be a credential-free HTTPS URL.');
  }
  return url.href.replace(/\/+$/u, '');
}

export function briefProviderBaseUrl(
  provider: CloudProviderId,
  configuredBaseUrl: string,
): string {
  if (provider === 'openai') return OPENAI_BRIEF_BASE_URL;
  if (provider === 'google-gemini-api') return GEMINI_BRIEF_BASE_URL;
  if (provider === 'custom-openai-compatible') {
    return assertCustomProviderBaseUrl(configuredBaseUrl);
  }
  return normalizedHttpsBaseUrl(configuredBaseUrl);
}

function abortControllerCtor(explicit?: any): any | null {
  if (explicit) return explicit;
  if (typeof AbortController !== 'undefined') return AbortController;
  return null;
}

function positiveInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function uniqueSuggestions(values: BriefModelSuggestion[]): BriefModelSuggestion[] {
  const seen = new Set<string>();
  return values.filter(value => {
    const id = value.id.trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    value.id = id;
    return true;
  });
}

export class BriefModelDiscoveryClient {
  private readonly fetchImpl: FetchLike;
  private readonly abortController: any;

  constructor(
    private readonly config: BriefModelDiscoveryConfig,
    dependencies: BriefModelDiscoveryDependencies = {},
  ) {
    if (!config.apiKey.trim()) throw new BriefModelDiscoveryError('Cloud API key is missing.');
    briefProviderBaseUrl(config.provider, config.baseUrl);
    this.fetchImpl = dependencies.fetch || fetch.bind(globalThis);
    this.abortController = abortControllerCtor(dependencies.abortController);
  }

  private async getJson(url: string, signal?: AbortSignal): Promise<any> {
    const Controller = this.abortController;
    const controller = Controller ? new Controller() : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), this.config.requestTimeoutMs ?? 30_000)
      : null;
    let removeAbortListener: (() => void) | null = null;
    try {
      if (signal?.aborted) throw new BriefModelDiscoveryError('Model discovery was canceled.');
      if (signal && controller) {
        const abort = () => controller.abort();
        signal.addEventListener('abort', abort, { once: true });
        removeAbortListener = () => signal.removeEventListener('abort', abort);
      }
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: this.config.provider === 'google-gemini-api'
          ? { 'x-goog-api-key': this.config.apiKey }
          : { Authorization: `Bearer ${this.config.apiKey}` },
        redirect: 'error',
        ...(controller ? { signal: controller.signal } : signal ? { signal } : {}),
      });
      if (!response || typeof response.ok !== 'boolean' || !Number.isSafeInteger(response.status)) {
        throw new BriefModelDiscoveryError('The provider returned an invalid model-list response.');
      }
      const text = await response.text().catch(() => '');
      if (!response.ok) {
        throw new BriefModelDiscoveryError(
          `The provider rejected model discovery with HTTP ${response.status}.`,
          response.status,
        );
      }
      try { return JSON.parse(text); }
      catch { throw new BriefModelDiscoveryError('The provider returned invalid model-list JSON.'); }
    } catch (error: any) {
      if (error instanceof BriefModelDiscoveryError) throw error;
      if (signal?.aborted) throw new BriefModelDiscoveryError('Model discovery was canceled.');
      throw new BriefModelDiscoveryError('Could not retrieve the provider model list.');
    } finally {
      if (timeout) clearTimeout(timeout);
      if (removeAbortListener) removeAbortListener();
    }
  }

  private async discoverGemini(signal?: AbortSignal): Promise<BriefModelSuggestion[]> {
    const base = briefProviderBaseUrl(this.config.provider, this.config.baseUrl);
    const suggestions: BriefModelSuggestion[] = [];
    let pageToken = '';
    for (let page = 0; page < 10; page++) {
      const query = new URLSearchParams({ pageSize: '1000' });
      if (pageToken) query.set('pageToken', pageToken);
      const json = await this.getJson(`${base}/models?${query.toString()}`, signal);
      const models = Array.isArray(json?.models) ? json.models : [];
      for (const model of models) {
        if (!Array.isArray(model?.supportedGenerationMethods)
            || !model.supportedGenerationMethods.includes('generateContent')) continue;
        const rawName = typeof model.name === 'string' ? model.name : '';
        const id = rawName.replace(/^models\//u, '');
        if (!id) continue;
        suggestions.push({
          id,
          ...(typeof model.displayName === 'string' ? { displayName: model.displayName } : {}),
          ...(typeof model.description === 'string' ? { description: model.description } : {}),
          ...(positiveInteger(model.inputTokenLimit) ? { inputTokenLimit: model.inputTokenLimit } : {}),
          ...(positiveInteger(model.outputTokenLimit) ? { outputTokenLimit: model.outputTokenLimit } : {}),
          verifiedCapability: true,
        });
      }
      pageToken = typeof json?.nextPageToken === 'string' ? json.nextPageToken : '';
      if (!pageToken) break;
    }
    return uniqueSuggestions(suggestions);
  }

  private async discoverOpenAiCompatible(signal?: AbortSignal): Promise<BriefModelSuggestion[]> {
    const base = briefProviderBaseUrl(this.config.provider, this.config.baseUrl);
    const json = await this.getJson(`${base}/models`, signal);
    const models = Array.isArray(json?.data) ? json.data : [];
    return uniqueSuggestions(models.map((model: any) => ({
      id: typeof model?.id === 'string' ? model.id : '',
      verifiedCapability: false,
    })));
  }

  private async discoverBailian(signal?: AbortSignal): Promise<BriefModelSuggestion[]> {
    const compatibleBase = briefProviderBaseUrl(this.config.provider, this.config.baseUrl);
    const url = new URL(compatibleBase);
    url.pathname = '/api/v1/models';
    url.search = 'capabilities=TG&page_size=100';
    const json = await this.getJson(url.href, signal);
    const models = Array.isArray(json?.output?.models)
      ? json.output.models
      : Array.isArray(json?.data?.models)
      ? json.data.models
      : Array.isArray(json?.models) ? json.models : Array.isArray(json?.data) ? json.data : [];
    return uniqueSuggestions(models.map((model: any) => ({
      id: typeof model?.name === 'string'
        ? model.name
        : typeof model?.model === 'string'
          ? model.model
          : typeof model?.id === 'string' ? model.id : '',
      ...(typeof model?.display_name === 'string' ? { displayName: model.display_name } : {}),
      ...(typeof model?.description === 'string' ? { description: model.description } : {}),
      ...(positiveInteger(model?.input_token_limit)
        ? { inputTokenLimit: model.input_token_limit } : {}),
      ...(positiveInteger(model?.output_token_limit)
        ? { outputTokenLimit: model.output_token_limit } : {}),
      verifiedCapability: true,
    })));
  }

  async discover(signal?: AbortSignal): Promise<BriefModelSuggestion[]> {
    if (this.config.provider === 'google-gemini-api') return this.discoverGemini(signal);
    if (this.config.provider === 'alibaba-bailian') return this.discoverBailian(signal);
    return this.discoverOpenAiCompatible(signal);
  }
}

export function filterBriefModelSuggestions(
  suggestions: readonly BriefModelSuggestion[],
  query: string,
  limit = 20,
): BriefModelSuggestion[] {
  const needle = query.trim().toLocaleLowerCase();
  const scored = suggestions.map((suggestion, index) => {
    const id = suggestion.id.toLocaleLowerCase();
    const name = (suggestion.displayName || '').toLocaleLowerCase();
    const description = (suggestion.description || '').toLocaleLowerCase();
    const start = id.startsWith(needle) || name.startsWith(needle);
    const contains = !needle || id.includes(needle) || name.includes(needle) || description.includes(needle);
    return { suggestion, index, score: contains ? (start ? 0 : 1) : 2 };
  }).filter(item => item.score < 2);
  scored.sort((left, right) => left.score - right.score || left.index - right.index);
  return scored.slice(0, Math.max(1, limit)).map(item => item.suggestion);
}

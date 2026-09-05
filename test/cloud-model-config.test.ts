import './helpers/zotero-stub';
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { installZoteroStub, ZoteroStub } from './helpers/zotero-stub';
import {
  assertCloudBaseUrl,
  assertCustomProviderBaseUrl,
  allowsStartupAutoIndex,
  calculateCloudRecommendedChunkTokens,
  cloudModelId,
  customEmbeddingEndpoint,
  CLOUD_DEFAULT_BASE_URL,
  BAILIAN_REGION_INTL_BASE_URL,
  CLOUD_BATCH_SIZE,
  CLOUD_DEFAULT_DOCUMENT_ROLE,
  CLOUD_DEFAULT_QUERY_ROLE,
  CLOUD_MAX_INPUT_TOKENS,
  CLOUD_MODEL_CATALOG,
  CLOUD_MODEL_ID,
  CLOUD_PROVIDER_OPTIONS,
  findCloudCatalogEntry,
  getCloudModelSettings,
  getCloudProvider,
  getProviderCatalogEntries,
  getProviderDefaultCatalogEntry,
  hasCurrentCloudConsent,
  isCloudAutoIndexAllowed,
  isCloudConnectionVerified,
  recordCurrentCloudConsent,
  setCloudAutoIndexAllowed,
  setCloudConnectionVerified,
  setCloudModelSettings,
} from '../src/core/cloud-model-config';

describe('cloud model configuration', () => {
  beforeEach(() => installZoteroStub());

  test('exposes the four approved providers with default models', () => {
    assert.deepEqual(CLOUD_PROVIDER_OPTIONS.map(option => option.id), [
      'alibaba-bailian',
      'openai',
      'google-gemini-api',
      'custom-openai-compatible',
    ]);
    assert.equal(getProviderDefaultCatalogEntry('openai')?.modelName, 'text-embedding-3-small');
    assert.equal(getProviderDefaultCatalogEntry('google-gemini-api')?.modelName, 'gemini-embedding-001');
    // The custom provider is the documented escape hatch and never enters the catalog.
    assert.equal(getProviderCatalogEntries('custom-openai-compatible').length, 0);
  });

  test('registers exactly the four planned catalog models', () => {
    assert.deepEqual(CLOUD_MODEL_CATALOG.map(entry => `${entry.provider}:${entry.modelName}`), [
      'alibaba-bailian:qwen3.7-text-embedding',
      'openai:text-embedding-3-small',
      'openai:text-embedding-3-large',
      'google-gemini-api:gemini-embedding-001',
    ]);
    const gemini = findCloudCatalogEntry('google-gemini-api', 'gemini-embedding-001', 768)!;
    assert.equal(gemini.queryRole, 'RETRIEVAL_QUERY');
    assert.equal(gemini.documentRole, 'RETRIEVAL_DOCUMENT');
    assert.equal(gemini.maxInputTokens, 2048);
    const large = findCloudCatalogEntry('openai', 'text-embedding-3-large', 3072)!;
    assert.equal(large.queryRole, '');
    assert.equal(large.documentRole, '');
    assert.equal(large.maxInputTokens, 8192);
  });

  test('uses stable Bailian defaults and model identity', () => {
    const settings = getCloudModelSettings();
    assert.equal(settings.provider, 'alibaba-bailian');
    assert.equal(settings.configured, true);
    assert.equal(settings.baseUrl, CLOUD_DEFAULT_BASE_URL);
    assert.equal(settings.maxInputTokens, CLOUD_MAX_INPUT_TOKENS);
    assert.equal(settings.batchSize, CLOUD_BATCH_SIZE);
    assert.equal(settings.queryRole, CLOUD_DEFAULT_QUERY_ROLE);
    assert.equal(settings.documentRole, CLOUD_DEFAULT_DOCUMENT_ROLE);
    assert.equal(settings.recommendedChunkTokens, 4000);
    assert.equal(CLOUD_BATCH_SIZE, 10);
    assert.equal(CLOUD_MODEL_ID, 'cloud:alibaba-bailian:qwen3.7-text-embedding:1024');
    assert.equal(cloudModelId(settings), CLOUD_MODEL_ID);
  });

  test('resolves OpenAI and Gemini selections from the catalog with fixed parameters', () => {
    setCloudModelSettings({ provider: 'openai', modelName: 'text-embedding-3-small', dimensions: 1536 });
    let settings = getCloudModelSettings();
    assert.equal(settings.provider, 'openai');
    assert.equal(settings.configured, true);
    assert.equal(settings.dimensions, 1536);
    assert.equal(settings.maxInputTokens, 8192);
    assert.equal(settings.recommendedChunkTokens, 2000);
    assert.equal(settings.adapterVersion, 'openai-embeddings-v1');
    assert.equal(settings.queryRole, '');

    setCloudModelSettings({ provider: 'openai', modelName: 'text-embedding-3-large', dimensions: 3072 });
    settings = getCloudModelSettings();
    assert.equal(settings.dimensions, 3072);
    assert.equal(cloudModelId(settings), 'cloud:openai:text-embedding-3-large:3072');

    setCloudModelSettings({ provider: 'google-gemini-api', modelName: 'gemini-embedding-001', dimensions: 768 });
    settings = getCloudModelSettings();
    assert.equal(settings.configured, true);
    assert.equal(settings.recommendedChunkTokens, 1740);
    assert.equal(settings.adapterVersion, 'gemini-embedcontent-v1');
    assert.equal(settings.documentRole, 'RETRIEVAL_DOCUMENT');
    assert.equal(cloudModelId(settings), 'cloud:google-gemini-api:gemini-embedding-001:768');
  });

  test('marks non-catalog stored models as unconfigured instead of silently substituting', () => {
    const stub: ZoteroStub = (globalThis as any).Zotero;
    stub.prefs.set('zotseek.cloud.provider', 'openai');
    stub.prefs.set('zotseek.cloud.modelName', 'my-experimental-model');
    stub.prefs.set('zotseek.cloud.dimensions', 999);
    const settings = getCloudModelSettings();
    assert.equal(settings.configured, false);
    // The stored values stay visible so nothing pretends to be another model.
    assert.equal(settings.modelName, 'my-experimental-model');
    assert.equal(cloudModelId(settings), 'cloud:openai:my-experimental-model:999');
  });

  test('rejects model selections outside the provider catalog', () => {
    assert.throws(
      () => setCloudModelSettings({ provider: 'openai', modelName: 'text-embedding-ada-002', dimensions: 1536 }),
      /Unknown OpenAI model/,
    );
    assert.throws(
      () => setCloudModelSettings({ provider: 'google-gemini-api', modelName: 'text-embedding-3-small', dimensions: 1536 }),
      /Unknown Google Gemini API model/,
    );
    assert.throws(
      () => setCloudModelSettings({
        provider: 'alibaba-bailian',
        bailianRegion: 'cn',
        modelName: 'another-model',
        dimensions: 768,
        maxInputTokens: 8192,
        queryRole: 'query',
        documentRole: 'document',
        batchSize: 10,
      }),
      /Unknown Alibaba Bailian model/,
    );
  });

  test('calculates 85 percent recommended chunks with a 4000-token cap', () => {
    assert.equal(calculateCloudRecommendedChunkTokens(512), 435);
    assert.equal(calculateCloudRecommendedChunkTokens(8192), 4000);
    assert.equal(calculateCloudRecommendedChunkTokens(128000), 4000);
    assert.throws(() => calculateCloudRecommendedChunkTokens(0), /positive integer/);
  });

  test('accepts shared HTTPS endpoints and rejects unsafe ones', () => {
    assert.equal(assertCloudBaseUrl(CLOUD_DEFAULT_BASE_URL).hostname, 'dashscope.aliyuncs.com');
    assert.equal(
      assertCloudBaseUrl(BAILIAN_REGION_INTL_BASE_URL).hostname,
      'dashscope-intl.aliyuncs.com',
    );
    for (const value of [
      'http://dashscope.aliyuncs.com/compatible-mode/v1',
      'https://key@dashscope.aliyuncs.com/compatible-mode/v1',
      'https://dashscope.aliyuncs.com.evil.example/compatible-mode/v1',
      'https://dashscope.aliyuncs.com/v1',
      'https://dashscope.aliyuncs.com/compatible-mode/v1?key=secret',
    ]) {
      assert.throws(() => assertCloudBaseUrl(value));
    }
  });

  test('migrates the legacy Base URL preference to the Bailian region selection', () => {
    const stub: ZoteroStub = (globalThis as any).Zotero;
    assert.equal(getCloudModelSettings().bailianRegion, 'cn');
    stub.prefs.set('zotseek.cloud.baseUrl', BAILIAN_REGION_INTL_BASE_URL);
    assert.equal(getCloudModelSettings().bailianRegion, 'intl');
    assert.equal(getCloudModelSettings().baseUrl, BAILIAN_REGION_INTL_BASE_URL);
    // Any other legacy value (enterprise hosts, wrong paths) falls back to cn.
    stub.prefs.set('zotseek.cloud.baseUrl', 'https://llm-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1');
    assert.equal(getCloudModelSettings().bailianRegion, 'cn');
    // An explicit region selection wins over the legacy value.
    setCloudModelSettings({
      provider: 'alibaba-bailian',
      bailianRegion: 'intl',
      modelName: 'qwen3.7-text-embedding',
      dimensions: 1024,
      maxInputTokens: 128000,
      queryRole: 'query',
      documentRole: 'document',
      batchSize: 10,
    });
    assert.equal(getCloudModelSettings().bailianRegion, 'intl');
  });

  test('validates and normalizes the Custom (OpenAI-compatible) Base URL', () => {
    assert.equal(
      assertCustomProviderBaseUrl('https://api.example.com/v1/'),
      'https://api.example.com/v1',
    );
    assert.equal(
      customEmbeddingEndpoint(' https://api.example.com/v1 '),
      'https://api.example.com/v1/embeddings',
    );
    assert.equal(
      customEmbeddingEndpoint('https://api.example.com'),
      'https://api.example.com/embeddings',
    );
    for (const value of [
      'http://api.example.com/v1',
      'https://user:key@api.example.com/v1',
      'https://api.example.com/v1?key=secret',
      'not a url',
    ]) {
      assert.throws(() => assertCustomProviderBaseUrl(value), CloudConfigRejectedErrorShape);
    }
  });

  test('saves a complete Custom provider configuration under its own namespace', () => {
    const settings = setCloudModelSettings({
      provider: 'custom-openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      modelName: ' bge-m3 ',
      dimensions: 1024,
      maxInputTokens: 8192,
      batchSize: 20,
    });
    assert.equal(settings.configured, true);
    assert.equal(settings.customBaseUrl, 'https://api.example.com/v1');
    assert.equal(settings.modelName, 'bge-m3');
    assert.equal(settings.recommendedChunkTokens, 4000);
    assert.equal(settings.queryRole, '');
    assert.equal(settings.adapterVersion, 'openai-compatible-v1');
    assert.equal(cloudModelId(settings), 'cloud:custom-openai-compatible:bge-m3:1024');
    assert.deepEqual(getCloudModelSettings(), settings);
  });

  test('rejects incomplete or unsafe custom fields', () => {
    const base = {
      provider: 'custom-openai-compatible' as const,
      baseUrl: 'https://api.example.com/v1',
      modelName: 'model',
      dimensions: 1024,
      maxInputTokens: 8192,
      batchSize: 10,
    };
    assert.throws(() => setCloudModelSettings({ ...base, modelName: ' ' }), /must not be empty/);
    assert.throws(() => setCloudModelSettings({ ...base, dimensions: 0 }), /positive integer/);
    assert.throws(() => setCloudModelSettings({ ...base, batchSize: 257 }), /1 to 256/);
    assert.throws(() => setCloudModelSettings({ ...base, baseUrl: 'http://api.example.com/v1' }), /HTTPS/);
    assert.throws(
      () => setCloudModelSettings({ ...base, maxInputTokens: 0 }),
      /Maximum input tokens must be a positive integer/,
    );
  });

  test('keeps connection verification per provider with a Bailian legacy fallback', () => {
    const stub: ZoteroStub = (globalThis as any).Zotero;
    // Legacy global state (pre-multi-provider) applies to Bailian only.
    stub.prefs.set('zotseek.cloud.connectionVerified', true);
    stub.prefs.set('zotseek.cloud.connectionVerifiedContract', 2);
    assert.equal(isCloudConnectionVerified('alibaba-bailian'), true);
    assert.equal(isCloudConnectionVerified('openai'), false);
    assert.equal(isCloudConnectionVerified('custom-openai-compatible'), false);

    // An explicit per-provider value overrides the legacy fallback.
    setCloudConnectionVerified(false, 'alibaba-bailian');
    assert.equal(isCloudConnectionVerified('alibaba-bailian'), false);
    setCloudConnectionVerified(true, 'openai');
    assert.equal(isCloudConnectionVerified('openai'), true);
    assert.equal(isCloudConnectionVerified('alibaba-bailian'), false);
  });

  test('keeps consent per provider and migrates the legacy Bailian consent', () => {
    const stub: ZoteroStub = (globalThis as any).Zotero;
    stub.prefs.set('zotseek.cloud.consentVersion', 1);
    assert.equal(hasCurrentCloudConsent('alibaba-bailian'), true);
    assert.equal(hasCurrentCloudConsent('openai'), false);
    recordCurrentCloudConsent('openai');
    assert.equal(hasCurrentCloudConsent('openai'), true);
    assert.equal(hasCurrentCloudConsent('google-gemini-api'), false);
    assert.equal(hasCurrentCloudConsent('alibaba-bailian'), true);
  });

  test('clears only the changed provider verification when its settings change', () => {
    setCloudModelSettings({ provider: 'openai', modelName: 'text-embedding-3-small', dimensions: 1536 });
    setCloudConnectionVerified(true, 'openai');
    setCloudConnectionVerified(true, 'alibaba-bailian');

    // Switching provider keeps both providers' stored verification state.
    setCloudModelSettings({ provider: 'openai', modelName: 'text-embedding-3-large', dimensions: 3072 });
    assert.equal(isCloudConnectionVerified('openai'), false);
    assert.equal(isCloudConnectionVerified('alibaba-bailian'), true);
  });

  test('clears the brief connection state when leaving Bailian or changing region', () => {
    const stub: ZoteroStub = (globalThis as any).Zotero;
    stub.prefs.set('zotseek.cloud.brief.connectionVerified', true);

    setCloudModelSettings({ provider: 'openai', modelName: 'text-embedding-3-small', dimensions: 1536 });
    assert.equal(stub.prefs.get('zotseek.cloud.brief.connectionVerified'), false);

    stub.prefs.set('zotseek.cloud.brief.connectionVerified', true);
    setCloudModelSettings({
      provider: 'alibaba-bailian',
      bailianRegion: 'intl',
      modelName: 'qwen3.7-text-embedding',
      dimensions: 1024,
      maxInputTokens: 128000,
      queryRole: 'query',
      documentRole: 'document',
      batchSize: 10,
    });
    assert.equal(stub.prefs.get('zotseek.cloud.brief.connectionVerified'), false);
  });

  test('persists editable Bailian input-contract fields and clears verification', () => {
    setCloudConnectionVerified(true, 'alibaba-bailian');
    const settings = setCloudModelSettings({
      provider: 'alibaba-bailian',
      bailianRegion: 'cn',
      modelName: 'qwen3.7-text-embedding',
      dimensions: 1024,
      maxInputTokens: 2048,
      queryRole: ' search_query ',
      documentRole: ' search_document ',
      batchSize: 10,
    });
    assert.deepEqual(getCloudModelSettings(), settings);
    assert.equal(settings.recommendedChunkTokens, 1740);
    assert.equal(settings.queryRole, 'search_query');
    assert.equal(settings.documentRole, 'search_document');
    assert.equal(isCloudConnectionVerified('alibaba-bailian'), false);
  });

  test('rejects incomplete or unsafe Bailian fields', () => {
    const base = {
      provider: 'alibaba-bailian' as const,
      bailianRegion: 'cn' as const,
      modelName: 'qwen3.7-text-embedding',
      dimensions: 1024,
      maxInputTokens: 8192,
      queryRole: '',
      documentRole: '',
      batchSize: 20,
    };
    assert.throws(() => setCloudModelSettings({ ...base, maxInputTokens: 0 }), /positive integer/);
    assert.throws(() => setCloudModelSettings({ ...base, batchSize: 257 }), /1 to 256/);
    assert.throws(
      () => setCloudModelSettings({ ...base, queryRole: 'bad\nrole' }),
      /unsupported characters/,
    );
    assert.throws(
      () => setCloudModelSettings({ ...base, bailianRegion: 'us' as any }),
      /"cn" or "intl"/,
    );
  });

  test('blank API roles are persisted as an explicit request to omit the parameter', () => {
    const settings = setCloudModelSettings({
      provider: 'alibaba-bailian',
      bailianRegion: 'cn',
      modelName: 'qwen3.7-text-embedding',
      dimensions: 1024,
      maxInputTokens: 8192,
      queryRole: '',
      documentRole: '',
      batchSize: 10,
    });
    assert.equal(settings.queryRole, '');
    assert.equal(settings.documentRole, '');
    assert.equal(getCloudModelSettings().queryRole, '');
    assert.equal(getCloudModelSettings().documentRole, '');
  });

  test('falls back to Bailian when the stored provider id is unknown', () => {
    const stub: ZoteroStub = (globalThis as any).Zotero;
    stub.prefs.set('zotseek.cloud.provider', 'vertex-ai');
    assert.equal(getCloudProvider(), 'alibaba-bailian');
  });

  test('requires both global and Cloud-specific startup authorization', () => {
    assert.equal(allowsStartupAutoIndex(true, false, false), true);
    assert.equal(allowsStartupAutoIndex(true, true, false), false);
    assert.equal(allowsStartupAutoIndex(true, true, true), true);
    assert.equal(allowsStartupAutoIndex(true, true, true, false), false);
    assert.equal(allowsStartupAutoIndex(false, true, true), false);
    assert.equal(isCloudAutoIndexAllowed(), false);
    setCloudAutoIndexAllowed(true);
    assert.equal(isCloudAutoIndexAllowed(), true);
  });
});

// Assertion helper: every rejected custom URL must fail as a config rejection.
function CloudConfigRejectedErrorShape(error: any): boolean {
  return error?.code === 'CLOUD_CONFIG_REJECTED';
}

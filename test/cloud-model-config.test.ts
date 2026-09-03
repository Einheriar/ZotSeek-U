import './helpers/zotero-stub';
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { installZoteroStub } from './helpers/zotero-stub';
import {
  assertCloudBaseUrl,
  allowsStartupAutoIndex,
  calculateCloudRecommendedChunkTokens,
  cloudModelId,
  CLOUD_DEFAULT_BASE_URL,
  CLOUD_MAX_INPUT_TOKENS,
  CLOUD_MODEL_ID,
  getCloudModelSettings,
  hasCurrentCloudConsent,
  isCloudAutoIndexAllowed,
  isCloudConnectionVerified,
  recordCurrentCloudConsent,
  setCloudAutoIndexAllowed,
  setCloudBaseUrl,
  setCloudConnectionVerified,
  setCloudModelSettings,
} from '../src/core/cloud-model-config';

describe('cloud model configuration', () => {
  beforeEach(() => installZoteroStub());

  test('uses stable Bailian defaults and model identity', () => {
    const settings = getCloudModelSettings();
    assert.equal(settings.baseUrl, CLOUD_DEFAULT_BASE_URL);
    assert.equal(settings.maxInputTokens, CLOUD_MAX_INPUT_TOKENS);
    assert.equal(settings.recommendedChunkTokens, 3000);
    assert.equal(CLOUD_MODEL_ID, 'cloud:alibaba-bailian:qwen3.7-text-embedding:1024');
    assert.equal(cloudModelId(settings), CLOUD_MODEL_ID);
  });

  test('calculates 85 percent recommended chunks with a 3000-token cap', () => {
    assert.equal(calculateCloudRecommendedChunkTokens(512), 435);
    assert.equal(calculateCloudRecommendedChunkTokens(8192), 3000);
    assert.equal(calculateCloudRecommendedChunkTokens(128000), 3000);
    assert.throws(() => calculateCloudRecommendedChunkTokens(0), /positive integer/);
  });

  test('accepts shared and workspace-specific HTTPS endpoints', () => {
    assert.equal(assertCloudBaseUrl(CLOUD_DEFAULT_BASE_URL).hostname, 'dashscope.aliyuncs.com');
    assert.equal(
      assertCloudBaseUrl('https://llm-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/').pathname,
      '/compatible-mode/v1',
    );
  });

  test('rejects non-HTTPS, credentials, untrusted hosts, and wrong paths', () => {
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

  test('changing the endpoint clears verification and consent/auto-index are explicit', () => {
    setCloudConnectionVerified(true);
    setCloudBaseUrl('https://dashscope-us.aliyuncs.com/compatible-mode/v1');
    assert.equal(isCloudConnectionVerified(), false);
    assert.equal(isCloudAutoIndexAllowed(), false);
    setCloudAutoIndexAllowed(true);
    assert.equal(isCloudAutoIndexAllowed(), true);
    assert.equal(hasCurrentCloudConsent(), false);
    recordCurrentCloudConsent();
    assert.equal(hasCurrentCloudConsent(), true);
  });

  test('persists editable model and input-contract fields and clears verification', () => {
    setCloudConnectionVerified(true);
    const settings = setCloudModelSettings({
      provider: 'alibaba-bailian',
      baseUrl: CLOUD_DEFAULT_BASE_URL,
      modelName: 'custom-embedding-model',
      dimensions: 768,
      maxInputTokens: 2048,
      queryPrefix: 'query: ',
      docPrefix: 'passage: ',
      batchSize: 10,
    });
    assert.deepEqual(getCloudModelSettings(), settings);
    assert.equal(settings.recommendedChunkTokens, 1740);
    assert.equal(cloudModelId(settings), 'cloud:alibaba-bailian:custom-embedding-model:768');
    assert.equal(isCloudConnectionVerified(), false);
  });

  test('rejects incomplete or unsafe editable fields', () => {
    const base = {
      provider: 'alibaba-bailian',
      baseUrl: CLOUD_DEFAULT_BASE_URL,
      modelName: 'model',
      dimensions: 1024,
      maxInputTokens: 8192,
      queryPrefix: '',
      docPrefix: '',
      batchSize: 20,
    };
    assert.throws(() => setCloudModelSettings({ ...base, modelName: ' ' }), /must not be empty/);
    assert.throws(() => setCloudModelSettings({ ...base, dimensions: 0 }), /positive integer/);
    assert.throws(() => setCloudModelSettings({ ...base, batchSize: 257 }), /1 to 256/);
    assert.throws(() => setCloudModelSettings({ ...base, provider: 'custom' }), /Unsupported/);
  });

  test('requires both global and Cloud-specific startup authorization', () => {
    assert.equal(allowsStartupAutoIndex(true, false, false), true);
    assert.equal(allowsStartupAutoIndex(true, true, false), false);
    assert.equal(allowsStartupAutoIndex(true, true, true), true);
    assert.equal(allowsStartupAutoIndex(true, true, true, false), false);
    assert.equal(allowsStartupAutoIndex(false, true, true), false);
  });
});

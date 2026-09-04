import './helpers/zotero-stub';
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { installZoteroStub } from './helpers/zotero-stub';
import {
  BRIEF_MAX_INPUT_TOKENS,
  BRIEF_MAX_OUTPUT_TOKENS,
  BRIEF_MODEL_NAME,
  getBriefGenerationSettings,
  hasCurrentBriefConsent,
  isBriefConnectionVerified,
  recordCurrentBriefConsent,
  setBriefConnectionVerified,
  setBriefGenerationSettings,
} from '../src/core/brief-generation-config';
import {
  CLOUD_DEFAULT_BASE_URL,
  getCloudModelSettings,
  setCloudBaseUrl,
} from '../src/core/cloud-model-config';

describe('brief generation configuration', () => {
  beforeEach(() => installZoteroStub());

  test('uses the verified DeepSeek model with thinking enabled by default', () => {
    assert.deepEqual(getBriefGenerationSettings(), {
      modelName: BRIEF_MODEL_NAME,
      maxInputTokens: BRIEF_MAX_INPUT_TOKENS,
      maxOutputTokens: BRIEF_MAX_OUTPUT_TOKENS,
      thinkingEnabled: true,
    });
    assert.equal(BRIEF_MODEL_NAME, 'deepseek-v4-flash-0731');
  });

  test('persists independent generation settings and clears only brief verification', () => {
    setBriefConnectionVerified(true);
    const settings = setBriefGenerationSettings({
      modelName: 'brief-snapshot',
      maxInputTokens: 200000,
      maxOutputTokens: 8000,
      thinkingEnabled: true,
    });
    assert.deepEqual(getBriefGenerationSettings(), settings);
    assert.equal(isBriefConnectionVerified(), false);
  });

  test('rejects invalid model and token budgets', () => {
    const valid = {
      modelName: BRIEF_MODEL_NAME,
      maxInputTokens: 100000,
      maxOutputTokens: 8000,
      thinkingEnabled: true,
    };
    assert.throws(() => setBriefGenerationSettings({ ...valid, modelName: ' ' }), /must not be empty/);
    assert.throws(() => setBriefGenerationSettings({ ...valid, maxInputTokens: 0 }), /positive integer/);
    assert.throws(() => setBriefGenerationSettings({ ...valid, maxOutputTokens: 100000 }), /smaller/);
  });

  test('uses separate consent and connection state', () => {
    assert.equal(isBriefConnectionVerified(), false);
    assert.equal(hasCurrentBriefConsent(), false);
    setBriefConnectionVerified(true);
    recordCurrentBriefConsent();
    assert.equal(isBriefConnectionVerified(), true);
    assert.equal(hasCurrentBriefConsent(), true);
  });

  test('changing the shared Base URL invalidates brief verification', () => {
    assert.equal(getCloudModelSettings().baseUrl, CLOUD_DEFAULT_BASE_URL);
    setBriefConnectionVerified(true);
    setCloudBaseUrl('https://dashscope-us.aliyuncs.com/compatible-mode/v1');
    assert.equal(isBriefConnectionVerified(), false);
  });
});

import './helpers/zotero-stub';
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { installZoteroStub } from './helpers/zotero-stub';
import {
  BRIEF_MAX_INPUT_TOKENS,
  BRIEF_MAX_OUTPUT_TOKENS,
  BRIEF_CLASSIFIER_MAX_COMPLETION_TOKENS,
  BRIEF_MODEL_NAME,
  getBriefGenerationSettings,
  getBriefGenerationConfigSnapshot,
  getBriefGenerationConfigFingerprint,
  getBriefGenerationConfigRevision,
  hasCurrentBriefConsent,
  isBriefConnectionVerified,
  recordCurrentBriefConsent,
  setBriefConnectionVerified,
  setBriefGenerationSettings,
} from '../src/core/brief-generation-config';
import {
  BAILIAN_REGION_INTL_BASE_URL,
  CLOUD_DEFAULT_BASE_URL,
  getCloudModelSettings,
  setCloudModelSettings,
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
    assert.throws(
      () => setBriefGenerationSettings({
        ...valid,
        maxOutputTokens: BRIEF_CLASSIFIER_MAX_COMPLETION_TOKENS - 1,
      }),
      /must be at least/,
    );
    assert.doesNotThrow(() => setBriefGenerationSettings({
      ...valid,
      maxInputTokens: 8000,
      maxOutputTokens: 100000,
    }));
  });

  test('uses separate consent and connection state', () => {
    assert.equal(isBriefConnectionVerified(), false);
    assert.equal(hasCurrentBriefConsent(), false);
    setBriefConnectionVerified(true);
    recordCurrentBriefConsent();
    assert.equal(isBriefConnectionVerified(), true);
    assert.equal(hasCurrentBriefConsent(), true);
  });

  test('changing the Bailian region invalidates brief verification', () => {
    assert.equal(getCloudModelSettings().baseUrl, CLOUD_DEFAULT_BASE_URL);
    setBriefConnectionVerified(true);
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
    assert.equal(isBriefConnectionVerified(), false);
    assert.equal(getCloudModelSettings().baseUrl, BAILIAN_REGION_INTL_BASE_URL);
  });

  test('exposes damaged stored configuration and revokes its verification', () => {
    const zotero = installZoteroStub({
      'zotseek.cloud.brief.modelName': BRIEF_MODEL_NAME,
      'zotseek.cloud.brief.maxInputTokens': 100000,
      'zotseek.cloud.brief.maxOutputTokens': 'not-a-number',
      'zotseek.cloud.brief.thinkingEnabled': true,
      'zotseek.cloud.brief.connectionVerified': true,
    });
    const snapshot = getBriefGenerationConfigSnapshot();
    assert.equal(snapshot.status, 'invalid');
    assert.ok(snapshot.error);
    assert.equal(isBriefConnectionVerified(), false);
    assert.equal(getBriefGenerationConfigFingerprint(), snapshot.fingerprint);
    assert.equal(getBriefGenerationConfigRevision(), snapshot.revision);
    assert.equal(zotero.prefs.get('zotseek.cloud.brief.connectionVerified'), false);
  });

  test('binds verification to the non-secret config fingerprint and revision', () => {
    const zotero = installZoteroStub();
    const fingerprint = getBriefGenerationConfigFingerprint();
    const revision = getBriefGenerationConfigRevision();
    setBriefConnectionVerified(true, {
      configFingerprint: fingerprint,
      configRevision: revision,
      credentialRevision: 7,
    });
    assert.equal(isBriefConnectionVerified({ credentialRevision: 7 }), true);
    assert.equal(isBriefConnectionVerified({ credentialRevision: 8 }), false);
    assert.equal(
      typeof zotero.prefs.get('zotseek.cloud.brief.connectionVerified.binding'),
      'string',
    );
  });
});

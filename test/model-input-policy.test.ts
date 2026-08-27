import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/zotero-stub';
import { getModel } from '../src/core/model-registry';
import {
  modelInputPolicyFingerprint,
  normalizeRequestedChunkTokens,
  resolveModelInputPolicy,
  shouldClearLegacyDefaultChunkPreference,
} from '../src/core/model-input-policy';

describe('model input policy resolution', () => {
  test('uses per-model recommendations when no user override exists', () => {
    assert.equal(resolveModelInputPolicy(getModel('multilingual-e5-base')!).effectiveChunkTokens, 420);
    assert.equal(resolveModelInputPolicy(getModel('nomic-embed-text-v1.5')!).effectiveChunkTokens, 2000);
    assert.equal(resolveModelInputPolicy(getModel('bge-m3')!).effectiveChunkTokens, 2000);
  });

  test('clamps a valid override to the model hard limit', () => {
    const policy = resolveModelInputPolicy(getModel('multilingual-e5-base')!, 7000);
    assert.equal(policy.requestedChunkTokens, 7000);
    assert.equal(policy.effectiveChunkTokens, 512);
    assert.equal(policy.usesUserOverride, true);
  });

  test('rejects invalid preference values', () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '800']) {
      assert.equal(normalizeRequestedChunkTokens(value), undefined);
    }
  });

  test('only clears the legacy plugin-written 450 once', () => {
    assert.equal(shouldClearLegacyDefaultChunkPreference(450, false), true);
    assert.equal(shouldClearLegacyDefaultChunkPreference(450, true), false);
    assert.equal(shouldClearLegacyDefaultChunkPreference(800, false), false);
  });

  test('fingerprint includes the resolved model policy', () => {
    const e5 = resolveModelInputPolicy(getModel('multilingual-e5-base')!);
    const bge = resolveModelInputPolicy(getModel('bge-m3')!);
    assert.notEqual(modelInputPolicyFingerprint(e5), modelInputPolicyFingerprint(bge));
    assert.match(modelInputPolicyFingerprint(e5), /^v1:multilingual-e5-base:420:512:8000:exact$/);
  });

  test('server document prefixes are part of the index policy fingerprint', () => {
    const base = getModel('multilingual-e5-base')!;
    const server = {
      ...base,
      id: 'server:e5-local',
      runtime: 'server' as const,
      docPrefix: 'passage: ',
      serverMaxInputTokens: 512,
      serverRecommendedChunkTokens: 420,
    };
    const first = modelInputPolicyFingerprint(resolveModelInputPolicy(server));
    const changed = modelInputPolicyFingerprint(resolveModelInputPolicy({
      ...server,
      docPrefix: 'document: ',
    }));
    assert.notEqual(first, changed);
    assert.match(first, /doc=passage%3A%20$/);
  });
});

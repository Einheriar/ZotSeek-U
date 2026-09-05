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
import { fixedChunkProfile } from '../src/core/model-chunk-profile';

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
    assert.match(modelInputPolicyFingerprint(e5), /^v2:multilingual-e5-base:420:512:8000:105:exact$/);
  });

  test('remote document input contracts are part of the index policy fingerprint', () => {
    const base = getModel('multilingual-e5-base')!;
    const server = {
      ...base,
      id: 'server:e5-local',
      runtime: 'server' as const,
      docPrefix: 'passage: ',
      serverMaxInputTokens: 512,
      serverRecommendedChunkTokens: 420,
      chunkProfile: fixedChunkProfile(420),
    };
    const first = modelInputPolicyFingerprint(resolveModelInputPolicy(server));
    const changed = modelInputPolicyFingerprint(resolveModelInputPolicy({
      ...server,
      docPrefix: 'document: ',
    }));
    assert.notEqual(first, changed);
    assert.match(first, /doc=passage%3A%20$/);

    const cloud = {
      ...server,
      id: 'cloud:test',
      runtime: 'cloud' as const,
      docPrefix: '',
      cloudDocumentRole: 'document',
      cloudApiAdapterVersion: 'dashscope-native-text-type-v1',
      cloudOutputContract: 'dense',
    };
    const cloudFirst = modelInputPolicyFingerprint(resolveModelInputPolicy(cloud));
    const cloudChanged = modelInputPolicyFingerprint(resolveModelInputPolicy({
      ...cloud,
      cloudDocumentRole: 'search_document',
    }));
    assert.notEqual(cloudFirst, cloudChanged);
    assert.match(
      cloudFirst,
      /:105:estimated:estimate=cloud-multilingual-v1:adapter=dashscope-native-text-type-v1:role=document:output=dense:instruct=none$/,
    );
    // A cloud model without a declared output contract fingerprints as "none"
    // so a contract declaration change is always visible to reconciliation.
    const undeclared = modelInputPolicyFingerprint(resolveModelInputPolicy({
      ...cloud,
      cloudOutputContract: undefined,
    }));
    assert.match(undeclared, /:output=none:/);
    assert.notEqual(cloudFirst, undeclared);
    assert.doesNotMatch(cloudFirst, /:doc=/);
    assert.doesNotMatch(first, /cloud-multilingual/);
  });

  test('Cloud estimator version does not change local model fingerprints', () => {
    const nomic = modelInputPolicyFingerprint(
      resolveModelInputPolicy(getModel('nomic-embed-text-v1.5')!),
    );
    assert.equal(nomic, 'v2:nomic-embed-text-v1.5:2000:8192:8000:500:estimated');
  });
});

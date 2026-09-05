import './helpers/zotero-stub';
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { installZoteroStub } from './helpers/zotero-stub';
import { modelInputPolicyFingerprint, resolveModelInputPolicy } from '../src/core/model-input-policy';
import { getActiveModel, getActiveModelId, setActiveModelId } from '../src/core/model-registry';
import { CLOUD_SLOT_SELECTION_ID } from '../src/core/model-registry';

/**
 * Plan 56 stage 0 regression baseline.
 *
 * These pins freeze the existing Bailian Cloud vector-space identity before
 * the multi-provider refactor touches any production code. If a refactor
 * changes any pinned value, every existing Cloud user would be flagged for a
 * paid re-embedding, so such a change must be an explicit, documented decision.
 */
describe('plan 56 stage 0 bailian identity pins', () => {
  beforeEach(() => installZoteroStub());

  test('pins the default Bailian model id', () => {
    setActiveModelId(CLOUD_SLOT_SELECTION_ID);
    assert.equal(getActiveModelId(), 'cloud:alibaba-bailian:qwen3.7-text-embedding:1024');
    assert.equal(getActiveModel().id, 'cloud:alibaba-bailian:qwen3.7-text-embedding:1024');
  });

  test('pins the default Bailian input policy fingerprint byte for byte', () => {
    setActiveModelId(CLOUD_SLOT_SELECTION_ID);
    const policy = resolveModelInputPolicy(getActiveModel());
    assert.equal(
      modelInputPolicyFingerprint(policy),
      'v2'
      + ':cloud:alibaba-bailian:qwen3.7-text-embedding:1024'
      + ':4000:128000:8000:1000:estimated'
      + ':estimate=cloud-multilingual-v1'
      + ':adapter=dashscope-native-text-type-v1'
      + ':role=document'
      + ':output=dense'
      + ':instruct=none',
    );
  });
});

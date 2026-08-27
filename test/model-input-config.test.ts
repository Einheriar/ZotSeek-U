import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/zotero-stub';
import { getModel, MODELS } from '../src/core/model-registry';
import {
  getModelInputConfig,
  LOCAL_MODEL_INPUT_CONFIGS,
  validateModelInputConfigs,
} from '../src/core/model-input-config';

describe('local model input contracts', () => {
  test('match the approved model facts and ZotSeek recommendations', () => {
    assert.deepEqual(LOCAL_MODEL_INPUT_CONFIGS['nomic-embed-text-v1.5'], {
      maxInputTokens: 8192, recommendedChunkTokens: 2000, maxChunkChars: 8000,
      quantization: 'q8', tokenizerType: 'bert', supportsExactTokenCount: false,
    });
    assert.deepEqual(LOCAL_MODEL_INPUT_CONFIGS['multilingual-e5-base'], {
      maxInputTokens: 512, recommendedChunkTokens: 420, maxChunkChars: 8000,
      quantization: 'q8', tokenizerType: 'xlm-roberta', supportsExactTokenCount: true,
    });
    assert.deepEqual(LOCAL_MODEL_INPUT_CONFIGS['bge-m3'], {
      maxInputTokens: 8192, recommendedChunkTokens: 2000, maxChunkChars: 8000,
      quantization: 'q8', tokenizerType: 'xlm-roberta', supportsExactTokenCount: true,
    });
  });

  test('has no missing, orphaned or internally invalid configs', () => {
    assert.deepEqual(validateModelInputConfigs(MODELS), []);
  });

  test('keeps Q8 declarations aligned with the configured ONNX artifact', () => {
    for (const model of MODELS) {
      const config = getModelInputConfig(model);
      assert.equal(config.quantization, 'q8');
      assert.match(model.onnxFile, /model_quantized\.onnx$/);
      assert.ok(model.files.includes(model.onnxFile));
    }
  });

  test('uses each server model\'s declared input contract', () => {
    const server = {
      ...getModel('multilingual-e5-base')!,
      id: 'server:test',
      runtime: 'server' as const,
      serverMaxInputTokens: 4096,
      serverRecommendedChunkTokens: 1000,
    };
    assert.deepEqual(getModelInputConfig(server), {
      maxInputTokens: 4096, recommendedChunkTokens: 1000, maxChunkChars: 8000,
      quantization: 'server-managed', tokenizerType: 'server-managed',
      supportsExactTokenCount: false,
    });
  });

  test('rejects a server model without a complete input contract', () => {
    const server = {
      ...getModel('multilingual-e5-base')!,
      id: 'server:incomplete',
      runtime: 'server' as const,
    };
    assert.throws(() => getModelInputConfig(server), /missing its input contract/);
  });
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import {
  getSelectedServerModelConfigurationIssue,
  parseServerModelConfig,
  SERVER_MODEL_CONFIG_SCHEMA_VERSION,
  serverModelConfigurationErrorMessage,
} from '../src/core/server-model-config';
import { SERVER_SLOT_SELECTION_ID } from '../src/core/model-registry';

const validModel = {
  id: 'server:bge-m3-local',
  baseUrl: 'http://127.0.0.1:1234/v1',
  serverModelName: 'bge-m3',
  dimensions: 1024,
  maxInputTokens: 8192,
  recommendedChunkTokens: 2000,
  queryPrefix: '',
  docPrefix: '',
};

function config(model: unknown): string {
  return JSON.stringify({ schemaVersion: SERVER_MODEL_CONFIG_SCHEMA_VERSION, model });
}

describe('single-slot server model configuration', () => {
  test('treats an explicit null model as NONE', () => {
    const parsed = parseServerModelConfig(config(null));
    assert.equal(parsed.kind, 'none');
    assert.equal(parsed.model, null);
    assert.deepEqual(parsed.errors, []);
  });

  test('loads one complete model and normalizes its URL', () => {
    const parsed = parseServerModelConfig(config(validModel));
    assert.equal(parsed.kind, 'ready');
    assert.equal(parsed.model?.baseUrl, 'http://127.0.0.1:1234');
    assert.equal(parsed.model?.label, 'Local Server (bge-m3)');
    assert.equal(parsed.model?.maxInputTokens, 8192);
  });

  test('allows explicitly empty query and document prefixes', () => {
    const parsed = parseServerModelConfig(config(validModel));
    assert.equal(parsed.model?.queryPrefix, '');
    assert.equal(parsed.model?.docPrefix, '');
  });

  test('classifies damaged JSON and unsupported schemas as UNKNOWN', () => {
    const damaged = parseServerModelConfig('{bad');
    assert.equal(damaged.kind, 'unknown');
    assert.match(damaged.errors[0], /Invalid JSON/);

    const unsupported = parseServerModelConfig(JSON.stringify({ schemaVersion: 99, model: null }));
    assert.equal(unsupported.kind, 'unknown');
    assert.match(unsupported.errors[0], /Unsupported/);
  });

  test('requires the model field instead of interpreting omission as NONE', () => {
    const parsed = parseServerModelConfig(JSON.stringify({ schemaVersion: 2 }));
    assert.equal(parsed.kind, 'unknown');
    assert.match(parsed.errors[0], /must be present/);
  });

  test('reports every missing explicit model fact without guessing', () => {
    const parsed = parseServerModelConfig(config({
      ...validModel,
      queryPrefix: undefined,
      maxInputTokens: undefined,
    }));
    assert.equal(parsed.kind, 'unknown');
    assert.equal(parsed.model, null);
    assert.match(parsed.errors[0], /maxInputTokens/);
    assert.match(parsed.errors[0], /queryPrefix/);
  });

  test('rejects remote URLs and invalid token budgets', () => {
    const remote = parseServerModelConfig(config({
      ...validModel,
      baseUrl: 'https://example.com',
    }));
    assert.equal(remote.kind, 'unknown');
    assert.match(remote.errors.join('\n'), /only talks to an inference server on this machine/);

    const badBudget = parseServerModelConfig(config({
      ...validModel,
      maxInputTokens: 512,
      recommendedChunkTokens: 800,
    }));
    assert.equal(badBudget.kind, 'unknown');
    assert.match(badBudget.errors.join('\n'), /cannot exceed/);
  });

  test('accepts one legacy schema model and marks the source', () => {
    const parsed = parseServerModelConfig(JSON.stringify({
      schemaVersion: 1,
      models: [{ ...validModel, label: 'Old label' }],
    }));
    assert.equal(parsed.kind, 'ready');
    assert.equal(parsed.legacySchema, true);
    assert.equal(parsed.model?.id, validModel.id);
  });

  test('does not choose between multiple legacy models without a preferred id', () => {
    const other = { ...validModel, id: 'server:other', serverModelName: 'other' };
    const raw = JSON.stringify({ schemaVersion: 1, models: [validModel, other] });
    assert.equal(parseServerModelConfig(raw).kind, 'unknown');
    assert.equal(parseServerModelConfig(raw, 'server:other').model?.id, 'server:other');
  });

  test('marks unresolved migration candidates as UNKNOWN', () => {
    const parsed = parseServerModelConfig(JSON.stringify({
      schemaVersion: 2,
      model: null,
      legacyCandidates: [validModel, { ...validModel, id: 'server:other' }],
    }));
    assert.equal(parsed.kind, 'unknown');
    assert.match(parsed.errors[0], /Multiple legacy/);
  });

  test('reports an issue only when the incomplete Server slot is selected', () => {
    installZoteroStub({ 'zotseek.embeddingModel': 'multilingual-e5-base' });
    assert.equal(getSelectedServerModelConfigurationIssue(), null);

    installZoteroStub({ 'zotseek.embeddingModel': SERVER_SLOT_SELECTION_ID });
    const issue = getSelectedServerModelConfigurationIssue();
    assert.equal(issue?.state, 'NONE');
    assert.match(issue?.path || '', /zotseek-server-models\.json/);
    assert.match(serverModelConfigurationErrorMessage(issue!), /restart Zotero/);
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { VectorStoreSQLite } from '../src/core/vector-store-sqlite';

test('reads startup fingerprints when Zotero 8 drops indented SELECT results', async () => {
  const zotero = installZoteroStub();
  const fingerprintRow = {
    config_fingerprint: 'config-hash',
    metadata_fingerprint: 'metadata-hash',
    note_state_fingerprint: 'note-state-hash',
    note_content_fingerprint: 'note-content-hash',
    checked_at: '2026-09-01T12:04:35.007Z',
  };
  const observedQueries: string[] = [];

  zotero.DB = {
    inTransaction: () => false,
    queryAsync: async (sql: string) => {
      observedQueries.push(sql);
      if (sql === 'PRAGMA database_list') {
        return [{ name: 'main' }, { name: 'zotseek' }];
      }
      // Reproduce Zotero 8's DB wrapper behaviour: a result-returning SELECT
      // with leading whitespace is treated like a statement with no rows.
      if (/^\s+SELECT/.test(sql)) return undefined;
      if (sql.startsWith('SELECT config_fingerprint')) return [fingerprintRow];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  const store = new VectorStoreSQLite();
  (store as any).initialized = true;
  (store as any).attached = true;

  const fingerprint = await store.getStartupFingerprint(
    'user',
    '7V5KX97V',
    'multilingual-e5-base',
  );

  assert.deepEqual(fingerprint, {
    libraryKey: 'user',
    itemKey: '7V5KX97V',
    modelId: 'multilingual-e5-base',
    configFingerprint: 'config-hash',
    metadataFingerprint: 'metadata-hash',
    noteStateFingerprint: 'note-state-hash',
    noteContentFingerprint: 'note-content-hash',
    checkedAt: '2026-09-01T12:04:35.007Z',
  });
  assert.equal(observedQueries[1].startsWith('SELECT config_fingerprint'), true);
});

test('content freshness reads the requested model partition rather than the shared item row', async () => {
  const zotero = installZoteroStub();
  const hashes = new Map([
    ['model-a', 'h1'],
    ['model-b', 'h0'],
  ]);
  const observed: Array<{ sql: string; params: any[] }> = [];
  zotero.DB = {
    queryAsync: async (sql: string) => {
      if (sql === 'PRAGMA database_list') return [{ name: 'main' }, { name: 'zotseek' }];
      return [];
    },
    valueQueryAsync: async (sql: string, params: any[] = []) => {
      observed.push({ sql, params });
      return hashes.get(String(params[2])) || false;
    },
  };
  const store = new VectorStoreSQLite();
  (store as any).initialized = true;
  (store as any).attached = true;

  assert.equal(await store.needsReindexByIdentity('user', 'ABCDEFGH', 'h1', 'model-a'), false);
  assert.equal(await store.needsReindexByIdentity('user', 'ABCDEFGH', 'h1', 'model-b'), true);
  assert.equal(await store.needsReindexByIdentity('user', 'ABCDEFGH', 'h1', 'missing'), true);
  assert.equal(observed.every(entry => entry.sql.includes('item_models')), true);
  assert.deepEqual(observed.map(entry => entry.params[2]), ['model-a', 'model-b', 'missing']);
});

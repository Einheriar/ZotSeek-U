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

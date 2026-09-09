import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { VectorStoreSQLite, type PaperEmbedding } from '../src/core/vector-store-sqlite';

// Exercise transaction rollback in real SQLite, not an in-memory revision mock.
const { DatabaseSync } = require('node:sqlite');

test('all normal corpus writes revise atomically; lifecycle and failed writes do not', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec("ATTACH DATABASE ':memory:' AS zotseek");
  const z = installZoteroStub({ 'zotseek.embeddingModel': 'multilingual-e5-base' });
  let failRevision = false;
  z.DB = {
    queryAsync: async (sql: string, params: any[] = []) => {
      if (failRevision && /SET value = CAST/.test(sql)) throw new Error('revision write failed');
      const statement = db.prepare(sql);
      return statement.columns().length ? statement.all(...params) : (statement.run(...params), []);
    },
    valueQueryAsync: async (sql: string, params: any[] = []) => {
      const row = db.prepare(sql).get(...params);
      return row ? Object.values(row)[0] : false;
    },
    executeTransaction: async (body: () => Promise<void>) => {
      db.exec('BEGIN');
      try { await body(); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  const store: any = new VectorStoreSQLite();
  store.ensureInit = async () => {};
  store.initialized = true;
  store.detachDatabase = async () => {};
  try {
    await store.createTables();
    await store.initializeLexicalRevision();
    const first = await store.readLexicalIdentity('model');
    await store.initializeLexicalRevision();
    assert.deepEqual(await store.readLexicalIdentity('model'), first, 'startup does not increment revision');
    const e: PaperEmbedding = { libraryKey: 'user', itemKey: 'ABCDEFGH', title: 'Paper',
      chunkIndex: 0, chunkText: '支持', textSource: 'note', embedding: [1, 0],
      modelId: 'multilingual-e5-base', indexedAt: '2026-09-09', contentHash: 'test' };
    const revision = async () => Number((await store.readLexicalIdentity('model')).revision);
    let expected = 0;
    for (const operation of [
      () => store.put(e), () => store.putBatch([{ ...e, chunkText: '反对' }]),
      () => store.replaceItemModelChunks([e]),
      () => store.deleteChunksForItem('user', e.itemKey, e.modelId),
      () => store.put(e), () => store.deleteItem('user', e.itemKey),
      () => store.put(e), () => store.deleteModelEmbeddings(e.modelId),
      () => store.put(e), () => store.clear(),
    ]) {
      await operation();
      assert.equal(await revision(), ++expected);
    }
    failRevision = true;
    await assert.rejects(store.put(e), /revision write failed/);
    assert.equal(await revision(), expected);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM zotseek.chunks').get().n, 0,
      'chunk write rolls back together with failed revision update');
    store.invalidateCache();
    await store.close();
    assert.equal(await revision(), expected, 'closing does not invalidate the persisted revision');
  } finally { db.close(); }
});

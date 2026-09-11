import './helpers/zotero-stub';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { VectorStoreSQLite } from '../src/core/vector-store-sqlite';

let DatabaseSync: any;
try { ({ DatabaseSync } = require('node:sqlite')); } catch { /* Node 18/20 have no built-in SQLite. */ }

const legacyEmbeddingColumns = `
  item_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  item_key TEXT NOT NULL,
  library_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  abstract TEXT,
  chunk_text TEXT,
  text_source TEXT NOT NULL,
  embedding TEXT NOT NULL,
  model_id TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  content_hash TEXT NOT NULL`;

function legacyEmbeddingFixture(version: number, withLocationColumns: boolean): string {
  const location = withLocationColumns ? `,
    page_number INTEGER,
    paragraph_index INTEGER,
    start_char INTEGER,
    end_char INTEGER,
    bbox TEXT` : '';
  return `
    CREATE TABLE zotseek.metadata (key TEXT PRIMARY KEY, value TEXT);
    INSERT INTO zotseek.metadata VALUES ('schema_version', '${version}');
    CREATE TABLE zotseek.embeddings (${legacyEmbeddingColumns}${location}, PRIMARY KEY (item_id, chunk_index));
    INSERT INTO zotseek.embeddings
      (item_id, chunk_index, item_key, library_id, title, abstract, chunk_text,
       text_source, embedding, model_id, indexed_at, content_hash)
    VALUES (1, 0, 'ABCDEFGH', 1, 'Legacy paper', 'Legacy abstract', 'Faithful chunk',
      'note', '[1,0]', 'multilingual-e5-base', '2026-01-01', 'legacy-hash');
  `;
}

const v8Fixture = `
  CREATE TABLE zotseek.metadata (key TEXT PRIMARY KEY, value TEXT);
  INSERT INTO zotseek.metadata VALUES ('schema_version', '8');
  CREATE TABLE zotseek.items (
    item_pk INTEGER PRIMARY KEY AUTOINCREMENT, library_key TEXT NOT NULL,
    item_key TEXT NOT NULL, title TEXT NOT NULL, abstract TEXT,
    model_id TEXT NOT NULL, indexed_at TEXT NOT NULL, content_hash TEXT NOT NULL,
    was_truncated INTEGER NOT NULL DEFAULT 0, pages_indexed INTEGER NOT NULL DEFAULT 0,
    pages_total INTEGER NOT NULL DEFAULT 0, UNIQUE(library_key, item_key));
  CREATE TABLE zotseek.chunks (
    item_pk INTEGER NOT NULL, chunk_index INTEGER NOT NULL DEFAULT 0,
    chunk_text TEXT, text_source TEXT NOT NULL, embedding TEXT NOT NULL,
    page_number INTEGER, paragraph_index INTEGER, start_char INTEGER,
    end_char INTEGER, bbox TEXT, PRIMARY KEY (item_pk, chunk_index));
  CREATE TABLE zotseek.orphan_items (
    item_pk INTEGER PRIMARY KEY, library_key TEXT NOT NULL, item_key TEXT NOT NULL,
    detected_at TEXT NOT NULL, reason TEXT NOT NULL);
  INSERT INTO zotseek.items
    (library_key, item_key, title, abstract, model_id, indexed_at, content_hash)
  VALUES ('user', 'ABCDEFGH', 'Legacy paper', 'Legacy abstract',
    'multilingual-e5-base', '2026-01-01', 'legacy-hash');
  INSERT INTO zotseek.chunks
    (item_pk, chunk_index, chunk_text, text_source, embedding)
  VALUES (1, 0, 'Faithful chunk', 'note', '[1,0]');
`;

function createFixture(schema: string) {
  const db = new DatabaseSync(':memory:');
  db.exec("ATTACH DATABASE ':memory:' AS zotseek");
  db.exec(schema);
  const zotero = installZoteroStub({ 'zotseek.embeddingModel': 'multilingual-e5-base' });
  const userLibrary = { libraryID: 1, libraryType: 'user' };
  zotero.DataDirectory = { dir: '/fixture' };
  zotero.Libraries = {
    userLibraryID: 1,
    get: (id: number) => id === 1 ? userLibrary : null,
    getAll: () => [userLibrary],
  };
  zotero.Items = {
    getIDFromLibraryAndKey: (libraryId: number, key: string) =>
      libraryId === 1 && key === 'ABCDEFGH' ? 1 : false,
  };
  (globalThis as any).PathUtils = { join: (...parts: string[]) => parts.join('/') };
  (globalThis as any).IOUtils = { copy: async () => {} };

  let failOnce: RegExp | null = null;
  zotero.DB = {
    inTransaction: () => false,
    queryAsync: async (sql: string, params: any[] = []) => {
      if (failOnce?.test(sql)) {
        failOnce = null;
        throw new Error('injected migration interruption');
      }
      const statement = db.prepare(sql);
      return statement.columns().length ? statement.all(...params) : (statement.run(...params), []);
    },
    valueQueryAsync: async (sql: string, params: any[] = []) => {
      const row = db.prepare(sql).get(...params);
      return row ? Object.values(row)[0] : false;
    },
    columnQueryAsync: async (sql: string, params: any[] = []) =>
      db.prepare(sql).all(...params).map((row: any) => Object.values(row)[0]),
    executeTransaction: async (body: () => Promise<void>) => {
      db.exec('BEGIN');
      try { await body(); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };

  const newStore = () => {
    const store: any = new VectorStoreSQLite();
    store.attachDatabase = async () => { store.attached = true; };
    store.detachDatabase = async () => { store.attached = false; };
    store.registerReattachHook = () => {};
    return store;
  };
  return {
    db,
    zotero,
    newStore,
    failNext(pattern: RegExp) { failOnce = pattern; },
  };
}

function verifyCurrent(db: any): void {
  assert.equal(db.prepare("SELECT value FROM zotseek.metadata WHERE key='schema_version'").get().value, '12');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM zotseek.items').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM zotseek.chunks').get().n, 1);
  const item = db.prepare('SELECT library_key, item_key, content_hash FROM zotseek.items').get();
  assert.equal(item.library_key, 'user');
  assert.equal(item.item_key, 'ABCDEFGH');
  assert.equal(item.content_hash, 'legacy-hash');
  const model = db.prepare('SELECT model_id, content_hash FROM zotseek.item_models').get();
  assert.equal(model.model_id, 'multilingual-e5-base');
  assert.equal(model.content_hash, 'legacy-hash');
  const chunk = db.prepare('SELECT model_id, chunk_text FROM zotseek.chunks').get();
  assert.equal(chunk.model_id, 'multilingual-e5-base');
  assert.equal(chunk.chunk_text, 'Faithful chunk');
}

describe('legacy schema recovery fixtures', { skip: !DatabaseSync && 'Requires Node 22.13+ built-in SQLite' }, () => {
  for (const fixture of [
    { name: 'v3', schema: legacyEmbeddingFixture(3, false) },
    { name: 'v4', schema: legacyEmbeddingFixture(4, true) },
    { name: 'stranded high-version v3 layout', schema: legacyEmbeddingFixture(12, false) },
  ]) {
    test(`${fixture.name} migrates to current without losing identity, hash, or chunk text`, async () => {
      const env = createFixture(fixture.schema);
      try {
        await env.newStore().init();
        verifyCurrent(env.db);
        if (fixture.name.includes('stranded')) {
          assert.equal(env.zotero.debugLog.some(line => line.includes('replaying idempotent migrations')), true);
        }
      } finally { env.db.close(); }
    });
  }

  test('an interrupted v9 migration rolls back, reports its backup, and succeeds on retry', async () => {
    const env = createFixture(v8Fixture);
    try {
      env.failNext(/CREATE TABLE zotseek\.chunks\s*\(/u);
      await assert.rejects(env.newStore().init(), /injected migration interruption/);
      assert.equal(
        env.db.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('chunks') WHERE name='model_id'").get().n,
        0,
        'the failed transaction must leave the v8 chunks table intact',
      );
      assert.equal(env.zotero.debugLog.some(line => line.includes('Backup at /fixture/zotseek.sqlite.v8.bak')), true);

      await env.newStore().init();
      verifyCurrent(env.db);

      await env.newStore().init();
      verifyCurrent(env.db);
    } finally { env.db.close(); }
  });
});

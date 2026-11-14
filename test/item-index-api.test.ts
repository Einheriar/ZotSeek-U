import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import '../src/index';
import { readItemIndexAttempt } from '../src/core/item-indexing';
import { autoIndexManager } from '../src/core/auto-index-manager';

// Exercise the public orchestration, leaving real PDF/Worker/SQLite to the
// isolated Zotero suite rather than pretending those runtimes run in Node.
const plugin = (globalThis as any).Zotero.ZotSeek;

function setup() {
  const z = installZoteroStub({
    'zotseek.indexingMode': 'full', 'zotseek.embeddingModel': 'multilingual-e5-base',
  });
  const parent = { id: 1, key: 'PARENT01', libraryID: 1, deleted: false,
    isRegularItem: () => true, isNote: () => false, isAttachment: () => false,
    getField: (field: string) => field === 'title' ? 'Paper' : '', getTags: () => [],
  };
  z.Libraries = { userLibraryID: 1, get: () => ({ id: 1, libraryType: 'user' }) };
  z.Items = { get: () => parent, getIDFromLibraryAndKey: (_libraryID: number, key: string) => key === parent.key ? 1 : false };
  z.ZotSeek = plugin;
  z.ProgressWindow = function () { throw new Error('Unexpected UI'); };
  const values = new Map<string, unknown>();
  const store = {
    getMetadata: async (key: string) => values.get(key),
    setMetadata: async (key: string, value: unknown) => { values.set(key, JSON.parse(JSON.stringify(value))); },
  };
  plugin.vectorStore = store;
  plugin.ensureStoreReady = async () => {};
  plugin.ensureOperationalModel = () => true;
  plugin.tryBeginIndexOperation = () => Symbol('test-operation');
  let released = 0;
  plugin.endIndexOperation = () => { released++; };
  return { z, parent, store, values, released: () => released };
}

test('explicit PDF implies a single forced scoped call and persists its final result', async () => {
  const { store, released } = setup();
  let call: any[] = [];
  plugin.indexItems = async (...args: any[]) => {
    call = args;
    args[4].extractionContext.onDiagnostic({ status: 'selected', attachmentKey: 'PDFKEY01', reason: null, pagesIndexed: 1, pagesTotal: 1 });
    return { checked: 1, indexedNew: 1, rebuilt: 0, notesUpdated: 0, unchanged: 0, failed: 0, removed: 0 };
  };
  const result = await plugin.api.indexItem({ libraryKey: 'user', itemKey: 'parent01', pdfAttachmentKey: 'PDFKEY01' });
  assert.equal(result.outcome, 'indexed');
  assert.equal(call[0].length, 1);
  assert.deepEqual(call[1], { type: 'items', items: [{ libraryKey: 'user', itemKey: 'PARENT01' }] });
  assert.equal(call[2], true);
  assert.equal(call[4].headless, true);
  assert.equal(call[4].extractionContext.pdfAttachmentKey, 'PDFKEY01');
  assert.equal((await readItemIndexAttempt(store, 'user', 'PARENT01', result.modelId)).lastAttempt?.outcome, 'indexed');
  assert.equal(released(), 1);
});

test('busy does not execute, release somebody else\'s lock, or overwrite history', async () => {
  const { values, released } = setup();
  plugin.tryBeginIndexOperation = () => null;
  plugin.indexItems = async () => { throw new Error('Must not execute while busy'); };
  const result = await plugin.api.indexItem({ libraryKey: 'user', itemKey: 'PARENT01' });
  assert.equal(result.outcome, 'busy');
  assert.equal(values.size, 0);
  assert.equal(released(), 0);
});

test('execution failure records a bounded stage reason and releases the operation', async () => {
  const { store, released } = setup();
  plugin.indexItems = async (...args: any[]) => {
    args[4].onFailure('embedding');
    throw new Error('Secret-bearing upstream response must not be persisted');
  };
  const result = await plugin.api.indexItem({ libraryKey: 'user', itemKey: 'PARENT01', force: true });
  assert.equal(result.outcome, 'failed');
  assert.equal(result.reason.code, 'embedding_failed');
  assert.doesNotMatch(JSON.stringify(await readItemIndexAttempt(store, 'user', 'PARENT01', result.modelId)), /Secret-bearing/);
  assert.equal(released(), 1);
});

test('ordinary updates remain incremental and absent titles skip without an index write', async () => {
  const { parent } = setup();
  let calls = 0;
  plugin.indexItems = async (...args: any[]) => {
    calls++;
    assert.equal(args[2], false);
    return { checked: 1, indexedNew: 0, rebuilt: 0, notesUpdated: 0, unchanged: 1, failed: 0, removed: 0 };
  };
  assert.equal((await plugin.api.indexItem({ libraryKey: 'user', itemKey: 'PARENT01' })).outcome, 'unchanged');
  parent.getField = () => '';
  const skipped = await plugin.api.indexItem({ libraryKey: 'user', itemKey: 'PARENT01' });
  assert.equal(skipped.outcome, 'skipped');
  assert.equal(skipped.reason.code, 'no_title');
  assert.equal(calls, 1);
});

test('configuration changes during preparation or unchanged reconciliation cannot be recorded as success', async () => {
  for (const phase of ['preparation', 'unchanged']) {
    const { z } = setup();
    plugin.ensureStoreReady = async () => {
      if (phase === 'preparation') z.prefs.set('zotseek.embeddingModel', 'bge-m3');
    };
    plugin.indexItems = async () => {
      assert.equal(phase, 'unchanged', 'changed preparation must not reach reconciliation');
      z.prefs.set('zotseek.embeddingModel', 'bge-m3');
      return { checked: 1, unchanged: 1, failed: 0 };
    };
    const result = await plugin.api.indexItem({ libraryKey: 'user', itemKey: 'PARENT01' });
    assert.equal(result.outcome, 'failed');
    assert.equal(result.reason.code, 'configuration_changed');
    assert.equal(result.modelId, 'multilingual-e5-base');
  }
});

function statusStore() {
  const context = setup();
  const status = { libraryKey: 'user', itemKey: 'PARENT01', indexedAt: '2026-11-14T00:00:00Z',
    chunkCount: 2, wasTruncated: false, pagesIndexed: 1, pagesTotal: 1 };
  Object.assign(context.store, {
    getIndexStatusByIdentity: async (_identities: unknown, options: any) => {
      assert.equal(options.strict, true);
      return new Map([['user|PARENT01', status]]);
    },
    getItemIndexSources: async (_libraryKey: string, _itemKey: string, modelId: string) => {
      assert.equal(modelId, 'multilingual-e5-base');
      return { sources: ['content'], pdfAttachmentKey: 'PDFKEY01' };
    },
    getStartupFingerprint: async () => ({ configFingerprint: autoIndexManager.getConfigFingerprint('full') }),
  });
  return context;
}

test('status reads strict coverage and real sources without inventing a verification timestamp', async () => {
  statusStore();
  const status = await plugin.api.getItemIndexStatus({ libraryKey: 'user', itemKey: 'PARENT01' });
  assert.equal(status.indexed, true);
  assert.equal(status.indexedMode, 'full');
  assert.equal(status.state, 'indexed');
  assert.equal(status.checkedAt, null);
  assert.deepEqual(status.sources, ['content']);
  assert.equal(status.pdfAttachmentKey, 'PDFKEY01');
  assert.equal(status.pdfFreshness, 'not_checked');
});

test('status propagates storage failure and refuses a model-changing read', async () => {
  const { z, store } = statusStore();
  (store as any).getIndexStatusByIdentity = async () => { throw new Error('injected query failure'); };
  await assert.rejects(plugin.api.getItemIndexStatus({ libraryKey: 'user', itemKey: 'PARENT01' }), /query failure/);
  (store as any).getIndexStatusByIdentity = async () => {
    z.prefs.set('zotseek.embeddingModel', 'bge-m3');
    return new Map();
  };
  await assert.rejects(plugin.api.getItemIndexStatus({ libraryKey: 'user', itemKey: 'PARENT01' }), /configuration changed/i);
});

test('incomplete Server configuration is explicit and never queries placeholder coverage', async () => {
  const { z, store } = statusStore();
  z.prefs.set('zotseek.embeddingModel', 'server-slot');
  (store as any).getIndexStatusByIdentity = async () => { throw new Error('Must not query placeholder partition'); };
  const status = await plugin.api.getItemIndexStatus({ libraryKey: 'user', itemKey: 'PARENT01' });
  assert.equal(status.indexed, false);
  assert.match(status.configurationError, /incomplete/i);
});

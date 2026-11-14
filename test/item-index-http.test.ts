import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { handleMcpRequest } from '../src/server/mcp-endpoint';
import {
  handleIndexItemRequest, handleItemIndexStatusRequest, ZotSeekIndexItemEndpoint,
  REST_PATHS,
} from '../src/server/rest-endpoints';
import { registerEndpoints, unregisterEndpoints } from '../src/server/server-manager';
import { VectorStoreSQLite } from '../src/core/vector-store-sqlite';

function setup(outcome = 'updated') {
  const z = installZoteroStub({ 'zotseek.embeddingModel': 'multilingual-e5-base' });
  z.Libraries.userLibraryID = 1;
  z.Groups = { getLibraryIDFromGroupID: () => 2 };
  const calls: any[] = [];
  const result = { outcome, libraryKey: 'user', itemKey: 'PARENT01',
    reason: outcome === 'failed' ? { code: 'embedding_failed', message: 'Embedding failed.' } : undefined };
  z.ZotSeek = { api: {
    indexItem: async (request: any) => { calls.push(request); return result; },
    getItemIndexStatus: async (request: any) => {
      calls.push(request);
      return { indexed: true, lastAttempt: result, pdfFreshness: 'not_checked' };
    },
  } };
  return { z, calls, result };
}

async function rpc(name: string, args: any, options: any = {}) {
  const [status, , body] = await handleMcpRequest({ headers: {}, ...options,
    data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
  });
  assert.equal(status, 200);
  return JSON.parse(body).result;
}

test('MCP and REST pass the same explicit item/PDF request and return the final result', async () => {
  const { calls } = setup();
  const response = await rpc('index_item', {
    item_key: 'parent01', pdf_attachment_key: 'pdfkey01', force: true,
  });
  assert.notEqual(response.isError, true);
  assert.equal(JSON.parse(response.content[0].text).outcome, 'updated');
  const [status] = await handleIndexItemRequest({ method: 'POST', headers: {},
    data: { itemKey: 'PARENT01', force: true, pdfAttachmentKey: 'PDFKEY01' },
  });
  assert.equal(status, 200);
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[0], {
    libraryKey: 'user', itemKey: 'PARENT01', force: true, pdfAttachmentKey: 'PDFKEY01',
  });
});

test('maintenance validates inputs and Origin before invoking the plugin', async () => {
  const { calls } = setup();
  for (const args of [
    { item_key: 'bad' }, { item_key: 'PARENT01', force: 'true' },
    { item_key: 'PARENT01', library_key: '' },
    { item_key: 'PARENT01', library_key: 'group:1.5' },
    { item_key: 'PARENT01', pdf_attachment_key: '../file' },
    { item_key: 'PARENT01', model: 'other' },
  ]) assert.equal((await rpc('index_item', args)).isError, true);
  assert.equal((await handleIndexItemRequest({ method: 'GET', headers: {}, data: { itemKey: 'PARENT01' } }))[0], 405);
  assert.equal((await handleIndexItemRequest({ method: 'POST', headers: {}, data: { itemKey: 'PARENT01', force: 'false' } }))[0], 400);
  assert.equal((await handleIndexItemRequest({ headers: { origin: 'https://remote.example' }, data: { itemKey: 'PARENT01' } }))[0], 403);
  assert.equal((await handleIndexItemRequest({ headers: {}, data: [] }))[0], 400);
  assert.equal(calls.length, 0);
});

test('busy and failed operations remain machine-readable over both transports', async () => {
  for (const [outcome, httpStatus] of [['busy', 409], ['failed', 500]] as const) {
    setup(outcome);
    const mcp = await rpc('index_item', { item_key: 'PARENT01' });
    assert.equal(mcp.isError, true);
    assert.equal(JSON.parse(mcp.content[0].text).outcome, outcome);
    const [status, , body] = await handleIndexItemRequest({ headers: {}, data: { itemKey: 'PARENT01' } });
    assert.equal(status, httpStatus);
    assert.equal(JSON.parse(body).outcome, outcome);
  }
});

test('a write notification cannot create an unobservable indexing operation', async () => {
  const { calls } = setup();
  const [status] = await handleMcpRequest({ headers: {}, data: {
    jsonrpc: '2.0', method: 'tools/call', params: { name: 'index_item', arguments: { item_key: 'PARENT01' } },
  } });
  assert.equal(status, 400);
  assert.equal(calls.length, 0);
});

test('per-item status preserves old coverage and the last failed attempt', async () => {
  const { calls } = setup('failed');
  const mcp = await rpc('get_item_index_status', { item_key: 'PARENT01' });
  const read = JSON.parse(mcp.content[0].text);
  assert.equal(read.indexed, true);
  assert.equal(read.lastAttempt.outcome, 'failed');
  assert.equal(read.pdfFreshness, 'not_checked');
  const [status, , body] = await handleItemIndexStatusRequest({ headers: {}, searchParams: new URLSearchParams('itemKey=PARENT01') });
  assert.equal(status, 200);
  assert.deepEqual(JSON.parse(body), read);
  assert.deepEqual(calls[0], calls[1]);
});

test('runtime TypeErrors remain server failures and status queries reject ambiguous parameters', async () => {
  const { z, calls } = setup();
  for (const query of ['itemKey=PARENT01&itemKey=OTHER001', 'itemKey=PARENT01&library_key=group:1']) {
    assert.equal((await handleItemIndexStatusRequest({ headers: {}, searchParams: new URLSearchParams(query) }))[0], 400);
  }
  assert.equal(calls.length, 0);
  z.ZotSeek.api.indexItem = async () => { throw new TypeError('injected runtime failure'); };
  z.ZotSeek.api.getItemIndexStatus = z.ZotSeek.api.indexItem;
  assert.equal((await handleIndexItemRequest({ headers: {}, data: { itemKey: 'PARENT01' } }))[0], 500);
  assert.equal((await handleItemIndexStatusRequest({ headers: {}, searchParams: new URLSearchParams('itemKey=PARENT01') }))[0], 500);
});

test('registration and shutdown include both new routes, with a POST-only writer', () => {
  const { z } = setup();
  z.Server = { Endpoints: {}, port: 23119 };
  registerEndpoints();
  try {
    assert.equal(z.Server.Endpoints[REST_PATHS.indexItem], ZotSeekIndexItemEndpoint);
    assert.ok(z.Server.Endpoints[REST_PATHS.itemIndexStatus]);
    assert.deepEqual(ZotSeekIndexItemEndpoint.prototype.supportedMethods, ['POST']);
  } finally { unregisterEndpoints(); }
  assert.equal(Object.keys(z.Server.Endpoints).length, 0);
});

test('strict index-status reads report SQL failure rather than missing coverage', async () => {
  const { z } = setup();
  z.DB = { columnQueryAsync: async () => { throw new Error('injected SQL failure'); } };
  const store = new VectorStoreSQLite();
  (store as any).ensureInit = async () => {};
  const identity = [{ libraryKey: 'user', itemKey: 'PARENT01' }];
  assert.equal((await store.getIndexStatusByIdentity(identity)).size, 0);
  await assert.rejects(store.getIndexStatusByIdentity(identity, { strict: true }), /Unable to read item index status/);
  z.DB.columnQueryAsync = async () => [];
  assert.equal((await store.getIndexStatusByIdentity(identity, { strict: true })).size, 0);
});

test('source diagnostics pin the model, propagate SQL errors, and do not decode embeddings', async () => {
  const { z } = setup();
  const calls: any[] = [];
  z.DB = { columnQueryAsync: async (sql: string, params: any[]) => {
    calls.push(params);
    assert.doesNotMatch(sql, /SELECT.*embedding/i);
    return sql.includes('DISTINCT c.text_source') ? ['content', 'summary'] : ['PDFKEY01'];
  } };
  const store = new VectorStoreSQLite();
  (store as any).ensureInit = async () => {};
  assert.deepEqual(await store.getItemIndexSources('group:7', 'PARENT01', 'model-a'), {
    sources: ['content', 'summary'], pdfAttachmentKey: 'PDFKEY01',
  });
  assert.deepEqual(calls, [['group:7', 'PARENT01', 'model-a'], ['group:7', 'PARENT01', 'model-a']]);
  z.DB.columnQueryAsync = async () => { throw new Error('injected source query failure'); };
  await assert.rejects(store.getItemIndexSources('user', 'PARENT01'), /source query failure/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { HybridSearchEngine } from '../src/core/hybrid-search';
import { runSearchTool } from '../src/server/http-tools';

test('missing, deleted and mismatched local IDs remain separate explicit keyword errors', async () => {
  const z = installZoteroStub({ 'zotseek.excludeBooks': false });
  z.Libraries = { get: () => ({ libraryType: 'user' }) };
  z.Search = class { addCondition() {} async search() { return []; } };
  z.Items = { getAsync: async () => [
    { id: 8, key: 'DIFFERENT', libraryID: 1, isRegularItem: () => true },
    { id: 9, key: 'DELETED1', libraryID: 1, deleted: true, isRegularItem: () => true },
  ] };
  const engine: any = new HybridSearchEngine({ searchIndexedText: async () => [
    { itemId: undefined, itemKey: 'MISSING1', libraryKey: 'user', score: 1 },
    { itemId: undefined, itemKey: 'MISSING2', libraryKey: 'user', score: 0.9 },
    { itemId: 8, itemKey: 'ORIGINAL', libraryKey: 'user', score: 0.8 },
    { itemId: 9, itemKey: 'DELETED1', libraryKey: 'user', score: 0.7 },
  ] } as any);
  const results = await engine.search('missing evidence', { mode: 'keyword', finalTopK: 10 });
  assert.equal(results.length, 4);
  assert.deepEqual(results.map((r: any) => r.itemKey), ['MISSING1', 'MISSING2', 'ORIGINAL', 'DELETED1']);
  assert.ok(results.every((r: any) => r.itemStatus === 'item_not_found' && r.itemId === undefined));

  const original = HybridSearchEngine.prototype.search;
  HybridSearchEngine.prototype.search = async () => results;
  try {
    const response = await runSearchTool({ query: 'missing evidence', mode: 'keyword' });
    assert.equal(response.results.length, 4);
    assert.ok(response.results.every(r => r.itemStatus === 'item_not_found' && r.title === 'Item not found'));
    assert.ok(response.results.every(r => !r.links && !r.metadata), 'no links or metadata from reused local IDs');
  } finally { HybridSearchEngine.prototype.search = original; }
});

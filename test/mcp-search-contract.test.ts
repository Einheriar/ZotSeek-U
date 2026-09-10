import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { HybridSearchEngine } from '../src/core/hybrid-search';
import { handleMcpRequest } from '../src/server/mcp-endpoint';
import { handleSearchRequest } from '../src/server/rest-endpoints';

async function rpc(method: string, params?: any): Promise<any> {
  const [status, , body] = await handleMcpRequest({ headers: {}, data: { jsonrpc: '2.0', id: 1, method, params } });
  assert.equal(status, 200);
  return JSON.parse(body!);
}

test('MCP fixes threshold zero without changing UI preferences or REST; component scores retain precision', async () => {
  const z = installZoteroStub({ 'zotseek.minSimilarityPercent': 70, 'zotseek.indexingMode': 'notes' });
  const originalSearch = HybridSearchEngine.prototype.search;
  const originalSmart = HybridSearchEngine.prototype.smartSearch;
  const calls: any[] = [];
  const stub = async (_q: string, options: any): Promise<any[]> => {
    calls.push(options);
    return [{ itemKey: 'ABCDEFGH', libraryKey: 'user', title: 'Cached result',
      itemStatus: 'item_not_found', rrfScore: .651360559463501,
      semanticScore: options.mode === 'keyword' ? null : .601360559463501,
      bm25Score: options.mode === 'semantic' ? undefined : 12.345678901,
      source: 'both', chunkText: 'Evidence', textSource: 'summary' }];
  };
  HybridSearchEngine.prototype.search = stub;
  HybridSearchEngine.prototype.smartSearch = stub;
  try {
    for (const extra of [{}, { min_similarity: .99 }, { min_similarity: 'invalid' }]) {
      const response = await rpc('tools/call', { name: 'search', arguments: { query: 'research relation', ...extra } });
      assert.notEqual(response.result.isError, true);
      const item = JSON.parse(response.result.content[0].text).results[0];
      assert.equal(item.score, .651);
      assert.equal(item.semanticScore, .601360559463501);
      assert.equal(item.bm25Score, 12.345678901);
      assert.equal(item.matchedChunk.snippet, 'Evidence');
      assert.equal(calls.at(-1).minSimilarity, 0);
      assert.equal(calls.at(-1).finalTopK, 10);
    }
    for (const mode of ['keyword', 'semantic']) {
      const response = await rpc('tools/call', { name: 'search', arguments: { query: 'terms', mode, max_results: 1000 } });
      const item = JSON.parse(response.result.content[0].text).results[0];
      assert.equal(item[mode === 'keyword' ? 'semanticScore' : 'bm25Score'], null);
      assert.equal(calls.at(-1).finalTopK, 100);
    }
    await handleSearchRequest({ headers: {}, searchParams: new URLSearchParams('q=terms') });
    assert.equal(calls.at(-1).minSimilarity, .7);
    await handleSearchRequest({ headers: {}, searchParams: new URLSearchParams('q=terms&minSimilarity=0.5') });
    assert.equal(calls.at(-1).minSimilarity, .5);
    assert.equal(z.Prefs.get('zotseek.minSimilarityPercent'), 70);
  } finally {
    HybridSearchEngine.prototype.search = originalSearch;
    HybridSearchEngine.prototype.smartSearch = originalSmart;
  }
});

test('advertised MCP tools omit threshold tuning and explain evidence/PDF reading', async () => {
  installZoteroStub();
  const response = await rpc('tools/list');
  const search = response.result.tools.find((t: any) => t.name === 'search');
  assert.equal('min_similarity' in search.inputSchema.properties, false);
  assert.equal(search.inputSchema.properties.max_results.default, 10);
  assert.equal(search.inputSchema.properties.max_results.maximum, 100);
  assert.match(search.description, /semanticScore/);
  assert.match(search.description, /bm25Score/);
  assert.match(search.description, /Read the results before deciding/);
  const item = response.result.tools.find((t: any) => t.name === 'get_item');
  assert.match(item.description, /extracted text/);
  assert.match(item.description, /Greek letters/);
});

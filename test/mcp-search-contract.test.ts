import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { HybridSearchEngine } from '../src/core/hybrid-search';
import { handleMcpRequest, ZotSeekMCPEndpoint } from '../src/server/mcp-endpoint';
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
  assert.equal(search.inputSchema.properties.include_subcollections.default, true);
  assert.ok(search.inputSchema.properties.filter.properties.tag);
  assert.match(search.description, /semanticScore/);
  assert.match(search.description, /bm25Score/);
  assert.match(search.description, /Read the results before deciding/);
  const item = response.result.tools.find((t: any) => t.name === 'get_item');
  assert.match(item.description, /extracted text/);
  assert.match(item.description, /Greek letters/);
  assert.match(item.description, /batches of at most 20 pages/);
  assert.match(item.description, /at most 100 pages/);
  assert.match(item.description, /status=partial/);
  assert.match(item.inputSchema.properties.include_pdf.description, /bounded leading prefix/);
  const libraryMap = response.result.tools.find((t: any) => t.name === 'get_library_map');
  assert.match(libraryMap.description, /complete live collection tree/);
});

test('collection scope is resolved once and live tag filtering fills the final window', async () => {
  const z = installZoteroStub({ 'zotseek.indexingMode': 'notes' });
  const makeItem = (id: number, key: string, year: string, tags: string[]) => ({
    id, key, libraryID: 1, itemType: 'journalArticle', deleted: false,
    isRegularItem: () => true,
    getField: (field: string) => ({ title: `Paper ${id}`, date: year } as Record<string, string>)[field] || '',
    getCreators: () => [],
    getTags: () => tags.map(tag => ({ tag })),
    getBestAttachment: async () => null,
  });
  const items = new Map<number, any>([
    [1, makeItem(1, 'PAPER001', '2019', [])],
    [2, makeItem(2, 'PAPER002', '2024', ['Review'])],
    [3, makeItem(3, 'PAPER003', '2023', ['Review'])],
  ]);
  const searchConditions: Array<Array<[string, string, string]>> = [];
  z.Libraries = {
    userLibraryID: 1,
    get: () => ({ libraryType: 'user', name: 'Personal Library' }),
  };
  z.Collections = {
    getByLibraryAndKey: (libraryId: number, key: string) =>
      libraryId === 1 && key === 'ROOT0001'
        ? { id: 10, key, name: 'Root', libraryID: 1 }
        : null,
  };
  z.Search = class {
    private conditions: Array<[string, string, string]> = [];
    constructor() { searchConditions.push(this.conditions); }
    addCondition(field: string, operator: string, value: string): void {
      this.conditions.push([field, operator, value]);
    }
    async search(): Promise<number[]> { return [1, 2, 3]; }
  };
  z.Items = {
    get: (id: number) => items.get(id),
    getAsync: async (ids: number[]) => ids.map(id => items.get(id)),
    getByLibraryAndKey: () => null,
  };

  const originalSearch = HybridSearchEngine.prototype.search;
  const originalSmart = HybridSearchEngine.prototype.smartSearch;
  const calls: any[] = [];
  const stub = async (_query: string, options: any): Promise<any[]> => {
    calls.push(options);
    assert.equal(options.candidateFilter({ libraryKey: 'user', itemKey: 'PAPER002', itemId: 2 }), true);
    assert.equal(options.candidateFilter({ libraryKey: 'user', itemKey: 'OUTSIDE1', itemId: 99 }), false);
    const ranked = [1, 2, 3].map((id, index) => ({
      itemId: id,
      itemKey: items.get(id).key,
      libraryKey: 'user',
      title: `Paper ${id}`,
      creators: '',
      year: Number(items.get(id).getField('date')),
      rrfScore: 1 - index * 0.1,
      semanticScore: 1 - index * 0.1,
      keywordScore: null,
      source: 'semantic',
    }));
    return ranked.filter(options.postFilter).slice(0, options.finalTopK);
  };
  HybridSearchEngine.prototype.search = stub;
  HybridSearchEngine.prototype.smartSearch = stub;
  try {
    const response = await rpc('tools/call', {
      name: 'search',
      arguments: {
        query: 'topic', library_key: 'user', collection_key: 'ROOT0001',
        max_results: 2, filter: { tag: 'Review' },
      },
    });
    const payload = JSON.parse(response.result.content[0].text);
    assert.deepEqual(payload.results.map((entry: any) => entry.itemKey), ['PAPER002', 'PAPER003']);
    assert.equal(calls[0].includeSubcollections, true);
    assert.ok(searchConditions[0].some(([field]) => field === 'recursive'));

    const [restStatus] = await handleSearchRequest({
      headers: {},
      searchParams: new URLSearchParams(
        'q=topic&libraryKey=user&collectionKey=ROOT0001&includeSubcollections=false&tag=Review',
      ),
    });
    assert.equal(restStatus, 200);
    assert.equal(calls[1].includeSubcollections, false);
    assert.ok(!searchConditions[1].some(([field]) => field === 'recursive'));
  } finally {
    HybridSearchEngine.prototype.search = originalSearch;
    HybridSearchEngine.prototype.smartSearch = originalSmart;
  }
});

test('MCP 2025-03-26 receives mixed JSON-RPC batches and omits notification responses', async () => {
  installZoteroStub();
  const [status, contentType, body] = await handleMcpRequest({
    method: 'POST',
    headers: { 'mcp-protocol-version': '2025-03-26' },
    data: [
      { jsonrpc: '2.0', id: 'list', method: 'tools/list' },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'ping' },
      { nope: true },
    ],
  });
  assert.equal(status, 200);
  assert.equal(contentType, 'application/json');
  const responses = JSON.parse(body);
  assert.deepEqual(responses.map((entry: any) => entry.id), ['list', 2, null]);
  assert.equal(responses[0].result.tools.length, 5);
  assert.deepEqual(responses[1].result, {});
  assert.equal(responses[2].error.code, -32600);

  const [notificationStatus, , notificationBody] = await handleMcpRequest({
    method: 'POST',
    headers: { 'mcp-protocol-version': '2025-03-26' },
    data: [
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', method: 'ping' },
    ],
  });
  assert.equal(notificationStatus, 202);
  assert.equal(notificationBody, '');
});

test('MCP batch boundaries reject empty, initialization, and the 2025-06 contract', async () => {
  installZoteroStub();
  const [emptyStatus, , emptyBody] = await handleMcpRequest({ headers: {}, data: [] });
  assert.equal(emptyStatus, 400);
  assert.equal(JSON.parse(emptyBody).error.code, -32600);

  const [initStatus, , initBody] = await handleMcpRequest({
    headers: { 'mcp-protocol-version': '2025-03-26' },
    data: [{
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-03-26' },
    }],
  });
  assert.equal(initStatus, 200);
  assert.match(JSON.parse(initBody)[0].error.message, /must not be sent.*batch/);

  const [newStatus, , newBody] = await handleMcpRequest({
    headers: { 'mcp-protocol-version': '2025-06-18' },
    data: [{ jsonrpc: '2.0', id: 1, method: 'ping' }],
  });
  assert.equal(newStatus, 400);
  assert.match(JSON.parse(newBody).error.message, /not supported.*2025-06-18/);
});

test('MCP endpoint explicitly returns 405 for GET when SSE is unavailable', async () => {
  installZoteroStub();
  assert.deepEqual((ZotSeekMCPEndpoint as any).prototype.supportedMethods, ['POST', 'GET']);
  const [status, contentType, body] = await handleMcpRequest({ method: 'GET', headers: {} });
  assert.equal(status, 405);
  assert.equal(contentType, 'text/plain');
  assert.equal(body, 'Method Not Allowed');
});

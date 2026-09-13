/**
 * Self-test suite for the local MCP/REST endpoints (#38, #32).
 *
 * Protocol-level scenarios call the handler functions directly (no HTTP).
 * Two end-to-end scenarios do real HTTP fetches against Zotero.Server and
 * are skipped if the HTTP server is not running. In-Zotero fetch has a
 * Mozilla/ UA, so e2e requests carry Zotero-Allowed-Request to pass the
 * server's browser-traffic gate.
 */
import { selfTest, scenario, assertEq, assertTrue, Scenario } from '../self-test';
import { handleMcpRequest } from '../../server/mcp-endpoint';
import {
  handleItemRequest,
  handleLibraryMapRequest,
  handleSearchRequest,
  handleStatsRequest,
} from '../../server/rest-endpoints';
import { handleOpenRequest, parseOpenParams, buildZoteroUri } from '../../server/open-endpoint';
import { registerEndpoints, isRegistered, unregisterEndpoints } from '../../server/server-manager';
import { searchEngine } from '../../core/search-engine';

declare const Zotero: any;

function rpc(method: string, params?: any, id: any = 1) {
  return { headers: {}, data: { jsonrpc: '2.0', id, method, params } };
}

async function callMcp(method: string, params?: any, headers: any = {}) {
  const [status, contentType, body] = await handleMcpRequest({
    headers,
    data: { jsonrpc: '2.0', id: 1, method, params },
  });
  return { status, contentType, json: body ? JSON.parse(body) : null };
}

function parseToolPayload(json: any): any {
  // tools/call wraps the payload as {content: [{type:'text', text}]}
  return JSON.parse(json.result.content[0].text);
}

function flattenCollections(nodes: any[]): any[] {
  return nodes.flatMap(node => [node, ...flattenCollections(node.children || [])]);
}

async function liveCollectionMemberKeys(collectionKey: string, recursive: boolean): Promise<Set<string>> {
  const libraryId = Zotero.Libraries.userLibraryID;
  const collection = Zotero.Collections.getByLibraryAndKey(libraryId, collectionKey);
  assertTrue(!!collection, `collection ${collectionKey} resolves`);
  const search = new Zotero.Search();
  search.libraryID = libraryId;
  search.addCondition('collectionID', 'is', String(collection.id));
  if (recursive) search.addCondition('recursive', 'true');
  search.addCondition('itemType', 'isNot', 'attachment');
  search.addCondition('itemType', 'isNot', 'note');
  const ids = await search.search();
  const resolved = ids.length ? await Zotero.Items.getAsync(ids) : [];
  return new Set((Array.isArray(resolved) ? resolved : [resolved])
    .filter((item: any) => item?.isRegularItem?.() && !item.deleted)
    .map((item: any) => String(item.key)));
}

selfTest.register('mcp-server', async () => {
  const scenarios: Scenario[] = [];

  scenarios.push(await scenario('initialize returns protocolVersion and serverInfo', async () => {
    const { status, json } = await callMcp('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'self-test', version: '0' },
    });
    assertEq(status, 200, 'status');
    assertEq(json.result.protocolVersion, '2025-06-18', 'echoes known protocolVersion');
    assertEq(json.result.serverInfo.name, 'zotseek', 'serverInfo.name');
    assertTrue(!!json.result.capabilities.tools, 'declares tools capability');
  }));

  scenarios.push(await scenario('notifications/initialized returns 202', async () => {
    const [status] = await handleMcpRequest(rpc('notifications/initialized'));
    assertEq(status, 202, 'status');
  }));

  scenarios.push(await scenario('2025-03-26 batch returns requests and omits notifications', async () => {
    const [status, , body] = await handleMcpRequest({
      method: 'POST',
      headers: { 'mcp-protocol-version': '2025-03-26' },
      data: [
        { jsonrpc: '2.0', id: 'list', method: 'tools/list' },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 'ping', method: 'ping' },
      ],
    });
    assertEq(status, 200, 'status');
    const json = JSON.parse(body);
    assertEq(JSON.stringify(json.map((entry: any) => entry.id)), JSON.stringify(['list', 'ping']), 'response ids');
  }));

  scenarios.push(await scenario('GET handler returns 405 without SSE', async () => {
    const [status] = await handleMcpRequest({ method: 'GET', headers: {} });
    assertEq(status, 405, 'status');
  }));

  scenarios.push(await scenario('tools/list returns the 5 tools', async () => {
    const { json } = await callMcp('tools/list');
    const names = json.result.tools.map((t: any) => t.name).sort();
    assertEq(
      JSON.stringify(names),
      JSON.stringify(['find_similar', 'get_item', 'get_library_map', 'index_status', 'search']),
      'tool names',
    );
    assertTrue(
      json.result.tools.every((t: any) => t.inputSchema?.type === 'object'),
      'every tool has an object inputSchema'
    );
    const getItem = json.result.tools.find((tool: any) => tool.name === 'get_item');
    assertTrue(getItem.description.includes('at most 100 pages'), 'get_item advertises bounded full reads');
    assertTrue(getItem.description.includes('nextPage'), 'get_item advertises continuation page');
    const search = json.result.tools.find((tool: any) => tool.name === 'search');
    assertTrue(
      !Object.prototype.hasOwnProperty.call(search.inputSchema.properties, 'min_similarity'),
      'search schema omits the legacy min_similarity field',
    );
  }));

  scenarios.push(await scenario('library map is complete, stable, and matches REST', async () => {
    const { json } = await callMcp('tools/call', {
      name: 'get_library_map', arguments: { library_key: 'user' },
    });
    assertTrue(!json.result.isError, 'no map tool error');
    const payload = parseToolPayload(json);
    assertEq(payload.libraryKey, 'user', 'stable user library key');
    const nodes = flattenCollections(payload.collections);
    assertTrue(nodes.every(node => /^[A-Z0-9]{8}$/.test(node.collectionKey)), 'stable collection keys');
    assertEq(new Set(nodes.map(node => node.collectionKey)).size, nodes.length, 'no duplicate collections');
    assertEq(
      nodes.length,
      (Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID) || []).length,
      'every live collection appears once',
    );

    const [status, , body] = await handleLibraryMapRequest({
      headers: {}, searchParams: new URLSearchParams('libraryKey=user'),
    });
    assertEq(status, 200, 'REST status');
    assertEq(body, JSON.stringify(payload), 'REST and MCP map payloads match');
  }));

  scenarios.push(await scenario('collection-scoped Keyword results never leak outside the live scope', async () => {
    const { json: mapJson } = await callMcp('tools/call', {
      name: 'get_library_map', arguments: { library_key: 'user' },
    });
    const nodes = flattenCollections(parseToolPayload(mapJson).collections);
    let target: { node: any; title: string } | undefined;
    for (const node of nodes) {
      const recursiveKeys = await liveCollectionMemberKeys(node.collectionKey, true);
      for (const key of recursiveKeys) {
        const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, key);
        const title = String(item?.getField?.('title') || '').trim();
        if (title) {
          target = { node, title };
          break;
        }
      }
      if (target) break;
    }
    if (!target) return;

    for (const includeSubcollections of [true, false]) {
      const expected = await liveCollectionMemberKeys(target.node.collectionKey, includeSubcollections);
      const { json } = await callMcp('tools/call', {
        name: 'search',
        arguments: {
          query: target.title,
          library_key: 'user',
          collection_key: target.node.collectionKey,
          include_subcollections: includeSubcollections,
          mode: 'keyword',
          max_results: 100,
        },
      });
      assertTrue(!json.result.isError, 'scoped keyword search has no tool error');
      const results = parseToolPayload(json).results;
      assertTrue(results.every((result: any) => expected.has(result.itemKey)), 'no result crosses collection scope');
    }

    const { json: invalid } = await callMcp('tools/call', {
      name: 'search',
      arguments: {
        query: target.title,
        library_key: 'user',
        collection_key: 'ZZZZZZZZ',
        mode: 'keyword',
      },
    });
    assertEq(invalid.result.isError, true, 'unknown collection is explicit tool error');
  }));

  scenarios.push(await scenario('live complete-tag filter returns only exact case-sensitive tags', async () => {
    const keys = await Zotero.DB.columnQueryAsync(
      "SELECT item_key FROM zotseek.items WHERE library_key = 'user' LIMIT 200"
    ).then((rows: any) => rows || []);
    let target: any;
    let tag = '';
    for (const key of keys) {
      const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, String(key));
      const firstTag = item?.getTags?.()?.map((entry: any) => String(entry.tag || '').trim()).find(Boolean);
      const title = String(item?.getField?.('title') || '').trim();
      if (item?.isRegularItem?.() && firstTag && title) {
        target = item;
        tag = firstTag;
        break;
      }
    }
    if (!target) return;
    const { json } = await callMcp('tools/call', {
      name: 'search',
      arguments: {
        query: String(target.getField('title')),
        library_key: 'user',
        mode: 'keyword',
        max_results: 100,
        filter: { tag },
      },
    });
    assertTrue(!json.result.isError, 'tag-filtered keyword search has no tool error');
    const results = parseToolPayload(json).results;
    assertTrue(results.some((result: any) => result.itemKey === target.key), 'known tagged item is retained');
    assertTrue(results.every((result: any) => {
      const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, result.itemKey);
      return (item?.getTags?.() || []).some((entry: any) =>
        String(entry.tag || '').normalize('NFC') === tag.normalize('NFC'));
    }), 'every result has the complete live tag');
  }));

  scenarios.push(await scenario('unknown method returns -32601', async () => {
    const { json } = await callMcp('resources/list');
    assertEq(json.error.code, -32601, 'error code');
  }));

  scenarios.push(await scenario('malformed request returns -32600', async () => {
    const [status, , body] = await handleMcpRequest({ headers: {}, data: { hello: 'world' } });
    assertEq(status, 400, 'status');
    assertEq(JSON.parse(body).error.code, -32600, 'error code');
  }));

  scenarios.push(await scenario('non-local Origin is rejected with 403', async () => {
    const { status } = await callMcp('tools/list', undefined, { origin: 'https://evil.example' });
    assertEq(status, 403, 'status');
  }));

  scenarios.push(await scenario('localhost Origin is accepted', async () => {
    const { status } = await callMcp('tools/list', undefined, { origin: 'http://localhost:23119' });
    assertEq(status, 200, 'status');
  }));

  scenarios.push(await scenario('tools/call index_status returns stats', async () => {
    const { json } = await callMcp('tools/call', { name: 'index_status', arguments: {} });
    const payload = parseToolPayload(json);
    assertTrue(typeof payload.indexedPapers === 'number', 'indexedPapers is a number');
    assertTrue(typeof payload.modelId === 'string', 'modelId is a string');
    assertTrue(typeof payload.ready === 'boolean', 'ready is a boolean');
    assertTrue(typeof payload.modelLoaded === 'boolean', 'modelLoaded is a boolean');
  }));

  scenarios.push(await scenario('tools/call search returns ranked results', async () => {
    const { json } = await callMcp('tools/call', {
      name: 'search',
      arguments: { query: 'method results analysis', max_results: 5, mode: 'semantic' },
    });
    const payload = parseToolPayload(json);
    if (json.result.isError) {
      // Acceptable only when the index is empty
      assertTrue(String(payload.error).length > 0, 'isError result carries a message');
      return;
    }
    assertTrue(Array.isArray(payload.results), 'results is an array');
    if (payload.results.length > 0) {
      const r = payload.results[0];
      assertTrue(/^[A-Z0-9]{8}$/.test(r.itemKey), 'itemKey looks like a Zotero key');
      assertTrue(typeof r.score === 'number', 'score is a number');
      assertTrue(!!r.metadata, 'resolved search result includes bibliographic metadata');
      assertEq(r.metadata.title, r.title, 'metadata title matches result title');
      assertTrue(Array.isArray(r.metadata.creators), 'metadata creators is an array');
      assertTrue(
        !r.links || r.links.select.startsWith('zotero://select/'),
        'links.select is a zotero:// deep link'
      );
      assertTrue(
        !r.links?.openPdf || r.links.openPdf.startsWith('zotero://open-pdf/'),
        'links.openPdf is a zotero://open-pdf link'
      );
      assertTrue(
        !r.links || /^http:\/\/localhost:\d+\/zotseek\/open\?target=select/.test(r.links.selectHttp),
        'links.selectHttp is a local http launcher link'
      );
      assertTrue(
        !r.links?.openPdfHttp ||
          /^http:\/\/localhost:\d+\/zotseek\/open\?target=pdf/.test(r.links.openPdfHttp),
        'links.openPdfHttp is a local http launcher link'
      );
    }
  }));

  scenarios.push(await scenario('mode=semantic matches the JS API ordering (#38 parity)', async () => {
    const q = 'collaboration methods analysis';
    const apiResults = await searchEngine.search(q, { topK: 5, minSimilarity: 0 });
    if (!apiResults.length) return; // empty index — nothing to compare
    const { json } = await callMcp('tools/call', {
      name: 'search',
      arguments: { query: q, max_results: 5, mode: 'semantic' },
    });
    const payload = parseToolPayload(json);
    assertEq(
      JSON.stringify(payload.results.map((r: any) => r.itemKey)),
      JSON.stringify(apiResults.map(r => r.itemKey)),
      'same items in the same order as Zotero.ZotSeek.api.search'
    );
  }));

  scenarios.push(await scenario('mode=hybrid runs the auto-adjusted path without errors', async () => {
    const { json } = await callMcp('tools/call', {
      name: 'search',
      arguments: { query: 'what influences trust in automated decisions', max_results: 3, mode: 'hybrid' },
    });
    assertTrue(!json.result.isError, 'no tool error');
    assertTrue(Array.isArray(parseToolPayload(json).results), 'results array');
  }));

  scenarios.push(await scenario('legacy MCP min_similarity cannot change the fixed threshold', async () => {
    const { json } = await callMcp('tools/call', {
      name: 'search',
      arguments: { query: 'analysis', max_results: 50, mode: 'semantic', min_similarity: 0.99 },
    });
    const payload = parseToolPayload(json);
    assertTrue(!json.result.isError, 'legacy field does not cause a tool error');
    assertTrue(Array.isArray(payload.results), 'results array');
    if (!payload.results.length) return;
    assertTrue(
      payload.results.some((result: any) =>
        typeof result.semanticScore === 'number' && result.semanticScore < 0.99),
      'legacy 0.99 threshold is ignored rather than applied to semantic results',
    );
  }));

  scenarios.push(await scenario('tools/call search without query returns isError', async () => {
    const { json } = await callMcp('tools/call', { name: 'search', arguments: {} });
    assertEq(json.result.isError, true, 'isError flag');
  }));

  scenarios.push(await scenario('tools/call unknown tool returns -32602', async () => {
    const { json } = await callMcp('tools/call', { name: 'nope', arguments: {} });
    assertEq(json.error.code, -32602, 'error code');
  }));

  scenarios.push(await scenario('find_similar with bad key returns isError', async () => {
    const { json } = await callMcp('tools/call', {
      name: 'find_similar',
      arguments: { item_key: 'not-a-key' },
    });
    assertEq(json.result.isError, true, 'isError flag');
  }));

  scenarios.push(await scenario('get_item with bad key returns isError', async () => {
    const { json } = await callMcp('tools/call', {
      name: 'get_item',
      arguments: { item_key: 'not-a-key' },
    });
    assertEq(json.result.isError, true, 'isError flag');
  }));

  scenarios.push(await scenario('get_item reads one real normalized parent item', async () => {
    const keys = await Zotero.DB.columnQueryAsync(
      "SELECT item_key FROM zotseek.items WHERE library_key = 'user' LIMIT 10"
    ).then((rows: any) => rows || []);
    const realKey = keys.map(String).find((key: string) => {
      const item = Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, key);
      return item?.isRegularItem?.() && !item.isAttachment?.() && !item.isNote?.();
    });
    if (!realKey) return;
    const { json } = await callMcp('tools/call', {
      name: 'get_item',
      arguments: { item_key: realKey, include_notes: true },
    });
    assertTrue(!json.result.isError, 'no tool error');
    const payload = parseToolPayload(json);
    assertEq(payload.itemKey, realKey, 'stable item key');
    assertEq(payload.libraryKey, 'user', 'stable library key');
    assertTrue(!!payload.metadata?.title, 'normalized metadata title');
    assertTrue(Array.isArray(payload.attachments), 'attachment snapshot');
    assertTrue(Array.isArray(payload.notes), 'notes array');
  }));

  scenarios.push(await scenario('REST search handler validates q', async () => {
    const [status, , body] = await handleSearchRequest({
      headers: {},
      searchParams: new URLSearchParams(''),
    });
    assertEq(status, 400, 'status');
    assertTrue(JSON.parse(body).error.includes('q'), 'error mentions q');
  }));

  scenarios.push(await scenario('REST stats handler returns JSON stats', async () => {
    const [status, contentType, body] = await handleStatsRequest({
      headers: {},
      searchParams: new URLSearchParams(''),
    });
    assertEq(status, 200, 'status');
    assertEq(contentType, 'application/json', 'content type');
    assertTrue(typeof JSON.parse(body).indexedPapers === 'number', 'indexedPapers present');
  }));

  scenarios.push(await scenario('REST item handler validates itemKey', async () => {
    const [status, , body] = await handleItemRequest({
      headers: {},
      searchParams: new URLSearchParams(''),
    });
    assertEq(status, 400, 'status');
    assertTrue(JSON.parse(body).error.includes('itemKey'), 'error mentions itemKey');
  }));

  scenarios.push(await scenario('open launcher parses and formats URIs correctly', async () => {
    const sel = parseOpenParams(new URLSearchParams('target=select&key=abcd2345'));
    assertTrue(!!sel, 'select params parse (key uppercased)');
    assertEq(buildZoteroUri(sel!), 'zotero://select/library/items/ABCD2345', 'select URI');
    const pdf = parseOpenParams(new URLSearchParams('target=pdf&key=WXYZ6789&library=group:123&page=11'));
    assertTrue(!!pdf, 'group pdf params parse');
    assertEq(
      buildZoteroUri(pdf!),
      'zotero://open-pdf/groups/123/items/WXYZ6789?page=11',
      'group pdf URI with page'
    );
  }));

  scenarios.push(await scenario('open launcher returns 404 for unknown item or group', async () => {
    const [missingItem] = await handleOpenRequest({
      headers: {},
      searchParams: new URLSearchParams('target=select&key=ZZZZZZZZ'),
    });
    assertEq(missingItem, 404, 'unknown item key');
    const [missingGroup] = await handleOpenRequest({
      headers: {},
      searchParams: new URLSearchParams('target=select&key=ABCD2345&library=group:999999999'),
    });
    assertEq(missingGroup, 404, 'unknown group library');
  }));

  scenarios.push(await scenario('open launcher ignores prefetch requests', async () => {
    const [status] = await handleOpenRequest({
      headers: { 'sec-purpose': 'prefetch' },
      searchParams: new URLSearchParams('target=select&key=ZZZZZZZZ'),
    });
    assertEq(status, 204, 'prefetch gets 204 and no action');
  }));

  scenarios.push(await scenario('open launcher selects a real item end to end', async () => {
    const keys = await Zotero.DB.columnQueryAsync(
      "SELECT item_key FROM zotseek.items WHERE library_key = 'user' LIMIT 5"
    ).then((r: any) => r || []);
    let realKey: string | null = null;
    for (const k of keys) {
      if (Zotero.Items.getIDFromLibraryAndKey(Zotero.Libraries.userLibraryID, String(k))) {
        realKey = String(k);
        break;
      }
    }
    if (!realKey) return; // nothing indexed/resolvable — covered by the 404 scenario
    const [status, contentType, body] = await handleOpenRequest({
      headers: {},
      searchParams: new URLSearchParams(`target=select&key=${realKey}`),
    });
    assertEq(status, 200, 'status');
    assertEq(contentType, 'text/html', 'content type');
    assertTrue(body.includes('Opened in Zotero'), 'confirmation page');
  }));

  scenarios.push(await scenario('open launcher rejects invalid input', async () => {
    const bad = [
      'target=select&key=../etc/passwd',
      'target=select&key=ABCD234', // 7 chars
      'target=nope&key=ABCD2345',
      'target=pdf&key=ABCD2345&library=evil',
      '',
    ];
    for (const qs of bad) {
      const [status] = await handleOpenRequest({ headers: {}, searchParams: new URLSearchParams(qs) });
      assertEq(status, 400, `status for "${qs}"`);
    }
  }));

  scenarios.push(await scenario('end-to-end: HTTP initialize + tools/list', async () => {
    const port = Zotero.Server?.port;
    if (!port) return; // HTTP server disabled — covered by handler-level scenarios
    const wasRegistered = isRegistered();
    registerEndpoints();
    try {
      // In-Zotero fetch has a Mozilla/ UA, so Zotero's browser-traffic gate
      // would cancel it without the Zotero-Allowed-Request header.
      const resp = await fetch(`http://127.0.0.1:${port}/zotseek/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Zotero-Allowed-Request': '1',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      assertEq(resp.status, 200, 'HTTP status');
      const json = await resp.json();
      assertEq(json.result.tools.length, 5, 'five tools over HTTP');
    } finally {
      if (!wasRegistered) unregisterEndpoints();
    }
  }));

  scenarios.push(await scenario('end-to-end: HTTP MCP batch + GET 405', async () => {
    const port = Zotero.Server?.port;
    if (!port) return;
    const wasRegistered = isRegistered();
    registerEndpoints();
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2025-03-26',
        'Zotero-Allowed-Request': '1',
      };
      const batch = await fetch(`http://127.0.0.1:${port}/zotseek/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify([
          { jsonrpc: '2.0', id: 1, method: 'ping' },
          { jsonrpc: '2.0', method: 'notifications/initialized' },
          { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        ]),
      });
      assertEq(batch.status, 200, 'batch status');
      const batchJson = await batch.json();
      assertEq(JSON.stringify(batchJson.map((entry: any) => entry.id)), JSON.stringify([1, 2]), 'batch ids');

      const get = await fetch(`http://127.0.0.1:${port}/zotseek/mcp`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'MCP-Protocol-Version': '2025-03-26',
          'Zotero-Allowed-Request': '1',
        },
      });
      assertEq(get.status, 405, 'GET status');
    } finally {
      if (!wasRegistered) unregisterEndpoints();
    }
  }));

  scenarios.push(await scenario('end-to-end: REST /zotseek/stats over HTTP', async () => {
    const port = Zotero.Server?.port;
    if (!port) return;
    const wasRegistered = isRegistered();
    registerEndpoints();
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/zotseek/stats`, {
        headers: { 'Zotero-Allowed-Request': '1' },
      });
      assertEq(resp.status, 200, 'HTTP status');
      const json = await resp.json();
      assertTrue(typeof json.indexedPapers === 'number', 'indexedPapers present');
    } finally {
      if (!wasRegistered) unregisterEndpoints();
    }
  }));

  scenarios.push(await scenario('end-to-end: REST /zotseek/library-map over HTTP', async () => {
    const port = Zotero.Server?.port;
    if (!port) return;
    const wasRegistered = isRegistered();
    registerEndpoints();
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/zotseek/library-map?libraryKey=user`, {
        headers: { 'Zotero-Allowed-Request': '1' },
      });
      assertEq(resp.status, 200, 'HTTP status');
      const json = await resp.json();
      assertEq(json.libraryKey, 'user', 'libraryKey');
      assertTrue(Array.isArray(json.collections), 'collections tree present');
    } finally {
      if (!wasRegistered) unregisterEndpoints();
    }
  }));

  return scenarios;
});

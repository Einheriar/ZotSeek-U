/**
 * Plain REST endpoints over Zotero's local HTTP server (issue #32).
 * "Just curl it" interface: GET + query params + JSON out. Shares the
 * tool layer (and result shapes) with the MCP endpoint.
 */
import {
  runSearchTool,
  runFindSimilarTool,
  runIndexStatusTool,
  runGetItemTool,
  runGetLibraryMapTool,
  runIndexItemTool,
  runGetItemIndexStatusTool,
  ItemIndexArgumentsError,
  isAllowedOrigin,
} from './http-tools';

export const REST_PATHS = {
  search: '/zotseek/search',
  similar: '/zotseek/similar',
  stats: '/zotseek/stats',
  item: '/zotseek/item',
  libraryMap: '/zotseek/library-map',
  indexItem: '/zotseek/index-item',
  itemIndexStatus: '/zotseek/item-index-status',
};

type EndpointResponse = [number, string, string];

function json(status: number, payload: any): EndpointResponse {
  return [status, 'application/json', JSON.stringify(payload)];
}

function originGuard(requestData: any): EndpointResponse | null {
  const headers = requestData?.headers || {};
  if (!isAllowedOrigin(headers['origin'])) {
    return json(403, { error: 'Forbidden: non-local Origin' });
  }
  return null;
}

export async function handleSearchRequest(requestData: any): Promise<EndpointResponse> {
  const denied = originGuard(requestData);
  if (denied) return denied;
  const sp: URLSearchParams = requestData.searchParams;
  const q = sp.get('q');
  if (!q || !q.trim()) {
    return json(400, { error: 'Missing required query parameter: q' });
  }
  try {
    const exactParam = sp.get('exact');
    if (exactParam !== null && exactParam !== 'true' && exactParam !== 'false') {
      throw new Error('search: exact must be "true" or "false"');
    }
    const recursiveParam = sp.get('includeSubcollections');
    if (recursiveParam !== null && recursiveParam !== 'true' && recursiveParam !== 'false') {
      throw new Error('search: includeSubcollections must be "true" or "false"');
    }
    const filter = ['yearFrom', 'yearTo', 'journal', 'author', 'tag', 'exact']
      .some(name => sp.has(name))
      ? {
          year_from: sp.has('yearFrom') ? Number(sp.get('yearFrom')) : undefined,
          year_to: sp.has('yearTo') ? Number(sp.get('yearTo')) : undefined,
          journal: sp.get('journal') ?? undefined,
          author: sp.get('author') ?? undefined,
          tag: sp.get('tag') ?? undefined,
          exact: exactParam === null ? undefined : exactParam === 'true',
        }
      : undefined;
    const payload = await runSearchTool({
      query: q,
      library_key: sp.get('libraryKey') || undefined,
      collection_key: sp.has('collectionKey') ? sp.get('collectionKey')! : undefined,
      include_subcollections: recursiveParam === null ? undefined : recursiveParam === 'true',
      max_results: sp.get('topK') ? parseInt(sp.get('topK') as string, 10) : undefined,
      mode: (sp.get('mode') as any) || undefined,
      granularity: (sp.get('granularity') as any) || undefined,
      min_similarity: sp.get('minSimilarity')
        ? parseFloat(sp.get('minSimilarity') as string)
        : undefined,
      filter,
    });
    return json(200, payload);
  } catch (e: any) {
    return json(400, { error: e?.message || String(e) });
  }
}

export async function handleItemRequest(requestData: any): Promise<EndpointResponse> {
  const denied = originGuard(requestData);
  if (denied) return denied;
  const sp: URLSearchParams = requestData.searchParams;
  const itemKey = sp.get('itemKey');
  if (!itemKey || !itemKey.trim()) {
    return json(400, { error: 'Missing required query parameter: itemKey' });
  }
  const includeNotes = sp.get('includeNotes');
  if (includeNotes !== null && includeNotes !== 'true' && includeNotes !== 'false') {
    return json(400, { error: 'includeNotes must be "true" or "false"' });
  }
  try {
    return json(200, await runGetItemTool({
      item_key: itemKey,
      library_key: sp.get('libraryKey') || undefined,
      include_notes: includeNotes === null ? undefined : includeNotes === 'true',
      include_pdf: (sp.get('includePdf') as any) || undefined,
      pdf_pages: sp.get('pdfPages') || undefined,
      pdf_attachment_key: sp.get('pdfAttachmentKey') || undefined,
    }));
  } catch (e: any) {
    return json(400, { error: e?.message || String(e) });
  }
}

export async function handleSimilarRequest(requestData: any): Promise<EndpointResponse> {
  const denied = originGuard(requestData);
  if (denied) return denied;
  const sp: URLSearchParams = requestData.searchParams;
  const itemKey = sp.get('itemKey');
  if (!itemKey || !itemKey.trim()) {
    return json(400, { error: 'Missing required query parameter: itemKey' });
  }
  try {
    const payload = await runFindSimilarTool({
      item_key: itemKey,
      library_key: sp.get('libraryKey') || undefined,
      max_results: sp.get('topK') ? parseInt(sp.get('topK') as string, 10) : undefined,
    });
    return json(200, payload);
  } catch (e: any) {
    return json(400, { error: e?.message || String(e) });
  }
}

export async function handleStatsRequest(requestData: any): Promise<EndpointResponse> {
  const denied = originGuard(requestData);
  if (denied) return denied;
  try {
    return json(200, await runIndexStatusTool());
  } catch (e: any) {
    return json(500, { error: e?.message || String(e) });
  }
}

export async function handleLibraryMapRequest(requestData: any): Promise<EndpointResponse> {
  const denied = originGuard(requestData);
  if (denied) return denied;
  const sp: URLSearchParams = requestData.searchParams;
  try {
    return json(200, await runGetLibraryMapTool({
      library_key: sp.get('libraryKey') || undefined,
    }));
  } catch (e: any) {
    return json(400, { error: e?.message || String(e) });
  }
}

export async function handleIndexItemRequest(requestData: any): Promise<EndpointResponse> {
  const denied = originGuard(requestData);
  if (denied) return denied;
  if (String(requestData?.method || 'POST').toUpperCase() !== 'POST') {
    return json(405, { error: 'Index maintenance requires POST.' });
  }
  const data = requestData?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).some(key => !['libraryKey', 'itemKey', 'force', 'pdfAttachmentKey', 'pdfTextSource'].includes(key))) {
    return json(400, { error: 'Expected a JSON object with itemKey and optional libraryKey, force, pdfAttachmentKey, pdfTextSource.' });
  }
  try {
    const result = await runIndexItemTool({
      item_key: data.itemKey, library_key: data.libraryKey,
      force: data.force, pdf_attachment_key: data.pdfAttachmentKey,
      ...(data.pdfTextSource !== undefined ? { pdf_text_source: data.pdfTextSource } : {}),
    });
    return json(result.outcome === 'busy' ? 409 : result.outcome === 'failed' ? 500 : 200, result);
  } catch (error: any) {
    return json(error instanceof ItemIndexArgumentsError ? 400 : 500, { error: error?.message || 'Item indexing failed.' });
  }
}

export async function handleItemIndexStatusRequest(requestData: any): Promise<EndpointResponse> {
  const denied = originGuard(requestData);
  if (denied) return denied;
  if (String(requestData?.method || 'GET').toUpperCase() !== 'GET') {
    return json(405, { error: 'Item index status requires GET.' });
  }
  const sp: URLSearchParams = requestData.searchParams;
  let invalidQuery = false;
  sp.forEach((_, key) => {
    if (!['itemKey', 'libraryKey'].includes(key) || sp.getAll(key).length !== 1) invalidQuery = true;
  });
  if (invalidQuery) return json(400, { error: 'Expected unique itemKey and optional libraryKey query parameters.' });
  try {
    return json(200, await runGetItemIndexStatusTool({
      item_key: sp.get('itemKey'), library_key: sp.get('libraryKey') ?? undefined,
    }));
  } catch (error: any) {
    return json(error instanceof ItemIndexArgumentsError ? 400 : 500, { error: error?.message || 'Item index status failed.' });
  }
}

export function ZotSeekSearchEndpoint(this: any) {}
ZotSeekSearchEndpoint.prototype = {
  supportedMethods: ['GET'],
  supportedDataTypes: ['application/json'],
  permitBookmarklet: false,
  init: handleSearchRequest,
};

export function ZotSeekSimilarEndpoint(this: any) {}
ZotSeekSimilarEndpoint.prototype = {
  supportedMethods: ['GET'],
  supportedDataTypes: ['application/json'],
  permitBookmarklet: false,
  init: handleSimilarRequest,
};

export function ZotSeekStatsEndpoint(this: any) {}
ZotSeekStatsEndpoint.prototype = {
  supportedMethods: ['GET'],
  supportedDataTypes: ['application/json'],
  permitBookmarklet: false,
  init: handleStatsRequest,
};

export function ZotSeekItemEndpoint(this: any) {}
ZotSeekItemEndpoint.prototype = {
  supportedMethods: ['GET'],
  supportedDataTypes: ['application/json'],
  permitBookmarklet: false,
  init: handleItemRequest,
};

export function ZotSeekLibraryMapEndpoint(this: any) {}
ZotSeekLibraryMapEndpoint.prototype = {
  supportedMethods: ['GET'],
  supportedDataTypes: ['application/json'],
  permitBookmarklet: false,
  init: handleLibraryMapRequest,
};

export function ZotSeekIndexItemEndpoint(this: any) {}
ZotSeekIndexItemEndpoint.prototype = {
  supportedMethods: ['POST'],
  supportedDataTypes: ['application/json'],
  permitBookmarklet: false,
  init: handleIndexItemRequest,
};

export function ZotSeekItemIndexStatusEndpoint(this: any) {}
ZotSeekItemIndexStatusEndpoint.prototype = {
  supportedMethods: ['GET'],
  supportedDataTypes: ['application/json'],
  permitBookmarklet: false,
  init: handleItemIndexStatusRequest,
};

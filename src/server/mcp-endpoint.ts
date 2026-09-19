/**
 * MCP (Model Context Protocol) endpoint over Zotero's local HTTP server.
 *
 * Implements the minimal stateless subset of the Streamable HTTP transport:
 * JSON-RPC 2.0 over POST, plain application/json responses, no SSE, no
 * sessions (no Mcp-Session-Id — permitted by the MCP spec and deliberate:
 * Zotero's DB connection can recycle mid-session, so the less state the better).
 *
 * Connect with: claude mcp add --transport http --scope user zotseek http://localhost:23119/zotseek/mcp
 *
 * Module-level functions plus a plain-constructor endpoint are used for
 * reliability under the esbuild IIFE bundle.
 */
import {
  runMcpSearchTool,
  runFindSimilarTool,
  runIndexStatusTool,
  runGetItemTool,
  runGetLibraryMapTool,
  isAllowedOrigin,
} from './http-tools';

declare const Zotero: any;

export const MCP_PATH = '/zotseek/mcp';

// Newest MCP revision this server knows; echoed back when the client
// requests an unknown/invalid version.
const LATEST_PROTOCOL_VERSION = '2025-06-18';

// Protocol revisions this server will echo back verbatim. A client asking
// for anything outside this set is answered with LATEST_PROTOCOL_VERSION.
const SUPPORTED_PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18'];

// Cross-tool workflow guidance is optional for MCP hosts; keep tool descriptions usable alone.
const SERVER_INSTRUCTIONS =
  'For literature research, search in two stages: usually use up to 5 meaningfully different searches to find candidates. ' +
  'Read the strongest candidates with get_item; only if a key condition remains unresolved, use up to 5 more searches without synonym-only repeats. ' +
  'Prefer metadata, Notes and relevant PDF pages; generally read no more than 4 papers with include_pdf=full. ' +
  'Stop when the evidence answers the question or the remaining uncertainty can be stated honestly. Reuse candidates in follow-ups. These are soft guidelines, not server quotas.';

const TOOL_DEFINITIONS = [
  {
    name: 'search',
    description:
      "Search the user's Zotero library by keyword, semantic or Hybrid ranking. Start with hybrid/papers and 10 results. " +
      'Use focused queries that preserve the user\'s research objects and conditions; avoid routine mode sweeps. ' +
      'Read the results before searching again; a second search should address a missing angle, not just change synonyms. ' +
      'Returns bounded excerpts, page numbers, citation metadata and Zotero deep links when available. ' +
      'Use evidence, not scores, to judge relevance; semanticScore and bm25Score are not confidence values. ' +
      'Semantic/Hybrid queries may send query text to the configured cloud embedding provider; Keyword does not.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Non-empty query: keywords for keyword mode, a focused research question for semantic/Hybrid, ' +
            'or a known title/DOI for Hybrid identity navigation. Queries are not automatically rewritten or split.',
        },
        max_results: {
          type: 'integer', minimum: 1, maximum: 100, default: 10,
          description: 'Return cap, not a guaranteed count. Default 10 is independent of the UI preference; ' +
            'request 20 for broader exploration. Does not expand internal candidate depth (normally S50/K50 for paper Hybrid).',
        },
        mode: {
          type: 'string',
          enum: ['hybrid', 'semantic', 'keyword'],
          default: 'hybrid',
          description:
            'hybrid = default, sharing the UI ranking engine and combining semantic matching with keyword evidence; ' +
            'papers also support explicit title/DOI identity navigation. ' +
            'semantic = semantic matching only. keyword = Quick Search and BM25 without query embeddings; ' +
            'suited to actual term/phrase queries, not chosen merely because a research question contains an acronym. ' +
            'Semantic and BM25 follow the configured indexing sources; Quick Search uses Zotero searchable fields.',
        },
        granularity: {
          type: 'string',
          enum: ['papers', 'passages'],
          default: 'papers',
          description:
            'papers = one result per paper with a best-matching chunk, recommended for discovery. ' +
            'passages = chunk-level results, possibly several from one paper, for targeted evidence gathering. ' +
            'Both are capped by max_results; passages retain compatibility ranking, not the new paper formula.',
        },
        library_key: {
          type: 'string',
          description:
            "'user' for the personal library, or 'group:<groupID>' to limit the search to one group library. " +
            'Omit to search all indexed libraries. Required when collection_key is supplied. Indexing mode follows ZotSeek settings.',
        },
        collection_key: {
          type: 'string',
          description:
            '8-character stable key of one collection in library_key. The scope is applied before semantic/keyword candidate top-K.',
        },
        include_subcollections: {
          type: 'boolean',
          default: true,
          description:
            'With collection_key, include all descendant collections by default. Set false for direct members only.',
        },
        filter: {
          type: 'object',
          description:
            'Filter the existing bounded ranked candidates before max_results is applied. This is not an exhaustive library field query; matching papers outside the mode-specific candidate pool are not added.',
          properties: {
            year_from: { type: 'integer' },
            year_to: { type: 'integer' },
            journal: {
              type: 'string',
              description: 'Publication, book, or proceedings title; substring match by default',
            },
            author: {
              type: 'string',
              description: 'Creator name; substring match by default',
            },
            tag: {
              type: 'string',
              description: 'One complete live Zotero tag name; Unicode-normalized and case-sensitive',
            },
            exact: {
              type: 'boolean',
              default: false,
              description: 'Use whole-field matching for journal and author, ignoring case',
            },
          },
          additionalProperties: false,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_library_map',
    description:
      'Read the complete live collection tree for one Zotero library. Returns every ordinary collection, including empty and nested collections, with stable collectionKey values, names, and children. ' +
      'Use a returned collectionKey together with the same library_key in search. Read-only; does not return item lists, tags, saved searches, or index coverage.',
    inputSchema: {
      type: 'object',
      properties: {
        library_key: {
          type: 'string',
          default: 'user',
          description: "'user' for the personal library, or 'group:<groupID>'",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_item',
    description:
      'Read one Zotero parent item by library_key + item_key. Returns metadata and attachments, optionally complete Child Notes, exact PDF pages, a bounded full prefix, or a detected references region. ' +
      'Prefer the matched page and adjacent pages before full text; generally use include_pdf=full for no more than 4 papers. ' +
      'PDF is extracted text, not a faithful rendering; verify suspicious symbols, tables and column order. ' +
      'Full reads return at most 100 pages or about 300,000 characters, in batches of at most 20 pages; status=partial and nextPage indicate continuation. ' +
      'A references result may be not_found or partial if detection or scanning is incomplete. Read-only and local.',
    inputSchema: {
      type: 'object',
      properties: {
        item_key: {
          type: 'string',
          description: '8-character Zotero key of a parent bibliographic item',
        },
        library_key: {
          type: 'string',
          default: 'user',
          description: "'user' for the personal library, or 'group:<groupID>'",
        },
        include_notes: {
          type: 'boolean',
          default: false,
          description: 'Include every Child Note as complete visible text plus live heading structure',
        },
        include_pdf: {
          type: 'string',
          enum: ['none', 'pages', 'full', 'references'],
          default: 'none',
          description: 'Read no PDF text, a page range, a bounded leading prefix, or only the detected reference-list region of the exact PDF attachment',
        },
        pdf_pages: {
          type: 'string',
          description: 'Required for include_pdf=pages; one page or one continuous range, e.g. 3 or 3-5 (maximum 20 pages)',
        },
        pdf_attachment_key: {
          type: 'string',
          description: 'Exact PDF attachment key, normally copied from search.matchedChunk.pdfAttachmentKey',
        },
      },
      required: ['item_key'],
      additionalProperties: false,
    },
  },
  {
    name: 'find_similar',
    description:
      'Find papers similar to a known library item, using its stored ' +
      'embeddings. Identify the item by its 8-character Zotero item key. ' +
      'Each resolvable result includes structured bibliographic metadata for ' +
      'client-side citation formatting. ' +
      'It may also include optional cached Zotero Style journalMetrics; this never changes similarity ranking. ' +
      'Results carry zotero:// deep links (links.select / links.openPdf; ' +
      'use the links.selectHttp / links.openPdfHttp variants when your ' +
      'client only linkifies http URLs).',
    inputSchema: {
      type: 'object',
      properties: {
        item_key: {
          type: 'string',
          description: '8-character Zotero item key of the source paper (must be indexed)',
        },
        library_key: {
          type: 'string',
          default: 'user',
          description: "'user' for the personal library, or 'group:<groupID>'",
        },
        max_results: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
      },
      required: ['item_key'],
    },
  },
  {
    name: 'index_status',
    description:
      'Report ZotSeek index status: number of indexed papers, total chunks, ' +
      'embedding model, last-indexed time. Call this first to check whether ' +
      'search results will be meaningful.',
    inputSchema: { type: 'object', properties: {} },
  },
];

type EndpointResponse = [number, string, string];

function hasRequestId(message: any): boolean {
  return Object.prototype.hasOwnProperty.call(message, 'id');
}

function isJsonRpcResponse(message: any): boolean {
  return !!message && typeof message === 'object' && !Array.isArray(message) &&
    message.jsonrpc === '2.0' && hasRequestId(message) &&
    (Object.prototype.hasOwnProperty.call(message, 'result') ||
      Object.prototype.hasOwnProperty.call(message, 'error'));
}

function rpcError(id: any, code: number, message: string): object {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function ok(id: any, result: any): EndpointResponse {
  return [200, 'application/json', JSON.stringify({ jsonrpc: '2.0', id: id ?? null, result })];
}

function err(status: number, id: any, code: number, message: string): EndpointResponse {
  return [status, 'application/json', JSON.stringify(rpcError(id, code, message))];
}

function toolText(payload: any, isError = false): object {
  const result: any = {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
  if (isError) result.isError = true;
  return result;
}

async function callTool(id: any, params: any): Promise<EndpointResponse> {
  const name = params?.name;
  const args = params?.arguments || {};
  let payload: any;
  try {
    if (name === 'search') {
      payload = await runMcpSearchTool(args);
    } else if (name === 'get_library_map') {
      payload = await runGetLibraryMapTool(args);
    } else if (name === 'get_item') {
      payload = await runGetItemTool(args);
    } else if (name === 'find_similar') {
      payload = await runFindSimilarTool(args);
    } else if (name === 'index_status') {
      payload = await runIndexStatusTool();
    } else {
      return err(200, id, -32602, `Unknown tool: ${String(name)}`);
    }
  } catch (e: any) {
    // Tool execution errors are MCP tool results, not protocol errors,
    // so the agent can read the message and react.
    return ok(id, toolText({ error: e?.message || String(e) }, true));
  }
  return ok(id, toolText(payload));
}

async function handleMcpMessage(msg: any, inBatch = false): Promise<EndpointResponse> {
  // Responses acknowledge a prior server request. This stateless server never
  // sends such requests, but accepting them keeps the HTTP transport valid.
  if (isJsonRpcResponse(msg)) return [202, 'text/plain', ''];
  if (
    !msg || typeof msg !== 'object' || Array.isArray(msg) ||
    msg.jsonrpc !== '2.0' || typeof msg.method !== 'string'
  ) {
    return err(400, null, -32600, 'Invalid JSON-RPC 2.0 request');
  }

  const { id, method, params } = msg;
  const notification = !hasRequestId(msg);

  // MCP initialization establishes the protocol contract for a connection and
  // must remain a standalone request rather than one member of a batch.
  if (inBatch && method === 'initialize') {
    return err(200, id, -32600, 'initialize must not be sent in a JSON-RPC batch');
  }

  // Notifications (no response body expected). 202 per the MCP spec.
  // Zotero's responseCodes table has no 202 entry, so the status line's
  // reason phrase comes out as "undefined" — harmless; clients ignore
  // reason phrases, and the status code itself is correct.
  if (method.startsWith('notifications/')) {
    return [202, 'text/plain', ''];
  }

  try {
    let response: EndpointResponse;
    switch (method) {
      case 'initialize': {
        const requested = params?.protocolVersion;
        const protocolVersion =
          typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
            ? requested
            : LATEST_PROTOCOL_VERSION;
        response = ok(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: 'zotseek',
            version: Zotero.ZotSeek?.info?.version || 'unknown',
          },
          instructions: SERVER_INSTRUCTIONS,
        });
        break;
      }
      case 'ping':
        response = ok(id, {});
        break;
      case 'tools/list':
        response = ok(id, { tools: TOOL_DEFINITIONS });
        break;
      case 'tools/call':
        response = await callTool(id, params);
        break;
      default:
        response = err(200, id, -32601, `Method not found: ${method}`);
        break;
    }
    return notification ? [202, 'text/plain', ''] : response;
  } catch (e: any) {
    return notification
      ? [202, 'text/plain', '']
      : err(200, id, -32603, e?.message || 'Internal error');
  }
}

export async function handleMcpRequest(requestData: any): Promise<EndpointResponse> {
  const headers = requestData?.headers || {};
  if (!isAllowedOrigin(headers['origin'])) {
    return err(403, null, -32600, 'Forbidden: non-local Origin');
  }
  if (String(requestData?.method || 'POST').toUpperCase() === 'GET') {
    return [405, 'text/plain', 'Method Not Allowed'];
  }

  const data = requestData?.data;
  if (!Array.isArray(data)) return handleMcpMessage(data);
  if (data.length === 0) return err(400, null, -32600, 'Invalid empty JSON-RPC batch');

  // Batching was removed in 2025-06-18. A missing version header uses the
  // 2025-03-26 compatibility contract, which requires receiving batches.
  const protocolVersion = headers['mcp-protocol-version'];
  if (protocolVersion === '2025-06-18') {
    return err(400, null, -32600, 'JSON-RPC batching is not supported in MCP 2025-06-18');
  }

  const handled = await Promise.all(data.map(message => handleMcpMessage(message, true)));
  const responses = handled
    .filter(([status, , body]) => status !== 202 && !!body)
    .map(([, , body]) => JSON.parse(body));
  if (responses.length === 0) return [202, 'text/plain', ''];
  return [200, 'application/json', JSON.stringify(responses)];
}

/**
 * Endpoint constructor for Zotero.Server.Endpoints. Plain constructor with
 * explicit prototype — the shape Zotero's own endpoints use, and the most
 * reliable under the esbuild IIFE bundle.
 */
export function ZotSeekMCPEndpoint(this: any) {}
ZotSeekMCPEndpoint.prototype = {
  supportedMethods: ['POST', 'GET'],
  supportedDataTypes: ['application/json'],
  permitBookmarklet: false,
  init: handleMcpRequest,
};

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

const TOOL_DEFINITIONS = [
  {
    name: 'search',
    description:
      "Search the user's Zotero library by keywords, semantic similarity or Hybrid ranking. " +
      'Start with hybrid/papers and 10 results. Turn informal requests into focused queries, preserving ' +
      'research objects, relationships and reliable clues. Do not invent missing details or turn uncertain ' +
      'years into hard filters. An acronym alone does not make a relationship question a keyword query. ' +
      'Read the results before deciding to stop, request more, search a missing angle, or use get_item ' +
      'to verify selected papers. Do not routinely run every mode or translate every query. ' +
      'When assessing results, check the user\'s research objects, relationships and material constraints, not just topical similarity. ' +
      'Returns ranked results with bounded matched text ' +
      'excerpts and page numbers where available. Each resolvable result also ' +
      'includes structured metadata with the full creator list, date, journal ' +
      'or book title, volume, issue, pages, DOI, and other citation fields. ' +
      'Use these fields when the user requests a bibliography or a citation ' +
      'style such as APA; do not guess missing or conflicting bibliographic details. Resolvable results carry available ' +
      'zotero:// deep links: links.select opens the item in Zotero, ' +
      'links.openPdf opens the PDF at the matched page — include them when ' +
      'citing results to the user. If your client does not render zotero:// ' +
      'URIs as clickable links, use links.selectHttp / links.openPdfHttp ' +
      'instead (same action via a local http launcher). The MCP endpoint is local and read-only; ' +
      'semantic/Hybrid query embedding can send query text to the selected cloud provider. ' +
      'Keyword search does not request query embeddings. ' +
      'Paper Hybrid content scores are semantic MaxSim plus a bounded lexical bonus, possibly above 1, ' +
      'not probabilities. Keyword scores are equal Quick/BM25 RRF with k=10, not the normalized UI percentage. ' +
      'semanticScore is the unrounded cosine similarity and bm25Score is the unnormalized BM25 score; ' +
      'null means that component was not computed or did not match. These fields do not trigger extra searches. ' +
      'When Zotero Style is loaded and already has valid cached data, resolvable items may also include ' +
      'journalMetrics with impactFactor and JCR SCI sciQuartile (Q1-Q4). This optional enrichment is omitted ' +
      'otherwise, never triggers a journal-data refresh, and never changes ranking. ' +
      'Use excerpts and source evidence to assess relevance, not scores as confidence. ' +
      'Identity navigation and ' +
      'passage paths retain their own score conventions. Compare scores only within the same query and policy.',
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
            'Omit to search all indexed libraries, not just the selected collection. Indexing mode follows ZotSeek settings.',
        },
        filter: {
          type: 'object',
          description:
            'Post-filter the already-ranked result window. This is not an exhaustive library field query, so the returned set may contain fewer than max_results.',
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
    name: 'get_item',
    description:
      'Read one Zotero parent item by stable library_key + item_key. Returns a normalized metadata snapshot and attachment list; optionally includes complete, unfiltered Child Notes and exact PDF pages or a bounded leading PDF prefix. ' +
      'When Zotero Style is loaded and its cache already contains valid data, the result may include optional journalMetrics with impactFactor and JCR SCI sciQuartile (Q1-Q4); no refresh is triggered. ' +
      'For a selected search hit, begin with its matched PDF page and necessary adjacent pages; request the bounded full prefix only when the question requires broader reading. ' +
      'Verify passages supporting key claims before issuing near-duplicate searches. ' +
      'PDF content is extracted text, not a faithful rendering: Greek letters, mathematical symbols, superscripts, subscripts, column order and tables may be incorrect. ' +
      'Do not guess missing symbols or treat extraction artifacts as the paper\'s claims. Distinguish the source\'s direct claims, studies reported by a review, and your own inference; identify background or insufficient evidence and cite material actually read. ' +
      'PDF reads use the exact attachment selected during Full indexing when available and prefer Zotero\'s full-text cache. Explicit pages use one PDFWorker batch; full reads use batches of at most 20 pages and return at most 100 pages or about 300,000 text characters. A limited result has status=partial, complete=false, limitReason, and nextPage for a follow-up pages request. Read-only and local.',
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
          enum: ['none', 'pages', 'full'],
          default: 'none',
          description: 'Read no PDF text, a page range, or a bounded leading prefix of the exact PDF attachment',
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

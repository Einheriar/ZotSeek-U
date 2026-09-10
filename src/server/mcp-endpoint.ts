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
  runSearchTool,
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
      'Start with hybrid/papers for literature discovery; use get_item to read complete evidence. ' +
      'Returns ranked results with bounded matched text ' +
      'excerpts and page numbers where available. Each resolvable result also ' +
      'includes structured metadata with the full creator list, date, journal ' +
      'or book title, volume, issue, pages, DOI, and other citation fields. ' +
      'Use these fields when the user requests a bibliography or a citation ' +
      'style such as APA. Resolvable results carry available ' +
      'zotero:// deep links: links.select opens the item in Zotero, ' +
      'links.openPdf opens the PDF at the matched page — include them when ' +
      'citing results to the user. If your client does not render zotero:// ' +
      'URIs as clickable links, use links.selectHttp / links.openPdfHttp ' +
      'instead (same action via a local http launcher). The MCP endpoint is local and read-only; ' +
      'semantic/Hybrid query embedding can send query text to the selected cloud provider. ' +
      'Keyword search does not request query embeddings. ' +
      'Paper Hybrid content scores are semantic MaxSim plus a bounded lexical bonus, possibly above 1, ' +
      'not probabilities. Keyword scores are equal Quick/BM25 RRF with k=10, not the normalized UI percentage. ' +
      'Semantic scores are cosine similarities; identity navigation and ' +
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
            'hybrid = the same ranking engine as the UI. Papers first attempt explicit identity navigation; ' +
            'content queries independently retrieve semantic S50 and lexical K50 (equal Quick/BM25 RRF, k=10), ' +
            'then rank their union by MaxSim + 0.05*11/(10+rankK50), with no bonus outside K50. ' +
            'Abstract/Notes/Full follow the configured indexing sources without reserved source slots. ' +
            'Legacy automatic weights do not change this formula. semantic is an explicit override; ' +
            'keyword returns the same Q/L K50 ranking without semantic retrieval or Hybrid identity navigation.',
        },
        min_similarity: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description:
            'Semantic candidate threshold (0-1). Omit to inherit the ZotSeek preference: shipped default 0.7, ' +
            'current fallback 0.3 if unreadable or invalid. In paper Hybrid content retrieval this filters S50 only; ' +
            'K50 results may fall below it. Not a final Hybrid score floor or confidence cutoff. ' +
            'Does not filter identity-navigation hits and has no effect in keyword mode.',
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
      'Read one Zotero parent item by stable library_key + item_key. Returns a normalized metadata snapshot and attachment list; optionally includes complete, unfiltered Child Notes and exact PDF pages or full text. PDF reads use the exact attachment selected during Full indexing when available, prefer Zotero\'s full-text cache, and fall back to one batched PDFWorker call. Read-only and local.',
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
          description: 'Read no PDF text, a page range, or the complete exact PDF attachment',
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
      payload = await runSearchTool(args);
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

export async function handleMcpRequest(requestData: any): Promise<EndpointResponse> {
  const headers = requestData?.headers || {};
  if (!isAllowedOrigin(headers['origin'])) {
    return err(403, null, -32600, 'Forbidden: non-local Origin');
  }

  const msg = requestData?.data;
  if (
    !msg || typeof msg !== 'object' || Array.isArray(msg) ||
    msg.jsonrpc !== '2.0' || typeof msg.method !== 'string'
  ) {
    return err(400, null, -32600, 'Invalid JSON-RPC 2.0 request');
  }

  const { id, method, params } = msg;

  // Notifications (no response body expected). 202 per the MCP spec.
  // Zotero's responseCodes table has no 202 entry, so the status line's
  // reason phrase comes out as "undefined" — harmless; clients ignore
  // reason phrases, and the status code itself is correct.
  if (method.startsWith('notifications/')) {
    return [202, 'text/plain', ''];
  }

  try {
    switch (method) {
      case 'initialize': {
        const requested = params?.protocolVersion;
        const protocolVersion =
          typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
            ? requested
            : LATEST_PROTOCOL_VERSION;
        return ok(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: 'zotseek',
            version: Zotero.ZotSeek?.info?.version || 'unknown',
          },
        });
      }
      case 'ping':
        return ok(id, {});
      case 'tools/list':
        return ok(id, { tools: TOOL_DEFINITIONS });
      case 'tools/call':
        return callTool(id, params);
      default:
        return err(200, id, -32601, `Method not found: ${method}`);
    }
  } catch (e: any) {
    return err(200, id, -32603, e?.message || 'Internal error');
  }
}

/**
 * Endpoint constructor for Zotero.Server.Endpoints. Plain constructor with
 * explicit prototype — the shape Zotero's own endpoints use, and the most
 * reliable under the esbuild IIFE bundle.
 */
export function ZotSeekMCPEndpoint(this: any) {}
ZotSeekMCPEndpoint.prototype = {
  supportedMethods: ['POST'],
  supportedDataTypes: ['application/json'],
  permitBookmarklet: false,
  init: handleMcpRequest,
};

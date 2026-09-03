# ZotSeek MCP Server & REST API

ZotSeek can expose read-only search plus stable-identity item, Note, and PDF reading to AI agents and scripts through a local MCP server and matching REST endpoints, served on Zotero's own HTTP server.

This needs no extra software: the endpoints run inside the Zotero you already have open. They are **opt-in** (off by default), **read-only** (nothing can modify your library or the index), and bound to **localhost only** — no data leaves your machine.

Everything routes through the running Zotero, where your embeddings and index already live, so **Zotero must be running** for the endpoints to respond.

> Looking for the in-Zotero JavaScript API for other plugins (`Zotero.ZotSeek.api`)? See [API.md](API.md).

## Setup

### 1. Enable AI Agent Access

In Zotero, open **Settings → ZotSeek → AI Agent Access** and check **"Allow AI agents to search and read your library (local MCP server)"**. This is off by default. Toggling it takes effect immediately — no restart needed. The same switch authorizes all read-only MCP/REST operations; there is no separate PDF permission.

### 2. Allow Zotero's local HTTP server

The endpoints ride on Zotero's built-in HTTP server, which must be enabled: **Settings → Advanced → "Allow other applications on this computer to communicate with Zotero"**. If this is off, the ZotSeek pane shows a warning. Zotero serves on `localhost:23119`.

### 3. Connect your MCP client

The MCP endpoint is at `http://localhost:23119/zotseek/mcp` (Streamable HTTP transport, stateless).

For **Claude Code**, add it with:

```bash
claude mcp add --transport http --scope user zotseek http://localhost:23119/zotseek/mcp
```

For **OpenAI Codex**, add it with (registers globally for your user):

```bash
codex mcp add zotseek --url http://localhost:23119/zotseek/mcp
```

or equivalently in `~/.codex/config.toml`:

```toml
[mcp_servers.zotseek]
url = "http://localhost:23119/zotseek/mcp"
```

Any other MCP client that supports the HTTP transport works the same way (for example, a Claude Desktop custom connector). Point it at the URL above.

## MCP Tools

| Tool | Arguments | Returns |
|------|-----------|---------|
| `search` | `query` *(required)*; `max_results` (1–100, default 10); `mode` (`hybrid` \| `semantic` \| `keyword`, default `hybrid`); `granularity` (`papers` \| `passages`, default `papers`); `min_similarity` (0–1, defaults to your ZotSeek preference); `library_key` (`user` or `group:<groupID>`, omit to search all indexed libraries); optional `filter` (`year_from`, `year_to`, `journal`, `author`, `exact`) | Ranked results, optionally post-filtered within the ranked result window |
| `get_item` | `item_key` *(required)*; `library_key` (default `user`); `include_notes` (default `false`); `include_pdf` (`none` \| `pages` \| `full`, default `none`); `pdf_pages` (`3` or `3-5`, at most 20 pages); `pdf_attachment_key` | A normalized live Zotero item snapshot, optionally with complete Notes and exact PDF text |
| `find_similar` | `item_key` *(required, 8-character Zotero key)*; `library_key` (`user` or `group:<groupID>`, default `user`); `max_results` (1–100, default 10) | Papers similar to a known library item, by its stored embeddings |
| `index_status` | *(none)* | `{ready, modelLoaded, indexedPapers, totalChunks, modelId, activeModel, coverage, configurationError?, lastIndexed, storageUsedBytes}` |

`mode` mirrors the ZotSeek UI: **hybrid** fuses semantic and keyword results with RRF, honoring your ZotSeek preferences including automatic weight adjustment, so it returns the same ranking you see in the ZotSeek dialog; **semantic** uses embeddings only (same code path as the [JS API](API.md)'s `search()`); **keyword** uses Zotero's keyword search only. `granularity` controls whether you get one result per paper (`papers`, best-matching chunk) or every matching chunk as its own result (`passages`).

If the fixed Server model slot is selected but its profile JSON template is `NONE` or `UNKNOWN`, semantic/hybrid `search` and `find_similar` return a configuration error containing the template path; keyword-only search remains available. `index_status` remains callable and reports `ready: false`, zero usable coverage and the same text in `configurationError`. This state never falls back to a local model.

`library_key` narrows `search` to a single library; when omitted, results come from every indexed library. Note the different default on `find_similar`: there `library_key` identifies the library of the *source* item and defaults to `user`.

`search.filter` is deliberately a **post-filter**. ZotSeek first obtains the normal ranked `max_results` window and then filters it without changing order. It is not an exhaustive database field query, so the result can contain fewer than `max_results` items or be empty even when another matching item exists below the original window. `journal` checks publication, book, and proceedings titles. `author` checks first name, last name, `First Last`, `Last, First`, and institutional creator names. Matching trims values, normalizes Unicode NFC, and ignores case; `exact:true` switches the two string filters from substring to whole-candidate matching.

For `index_status`, `ready` is `true` when the index contains papers and the selected model has an operational identity; the embedding model itself lazy-loads on the first search, adding ~30s to that first call when `modelLoaded` is `false`. `modelLoaded` reports whether that pipeline is already warm. A `ready: true, modelLoaded: false` status means searches will work but the first one will be slow. `activeModel` is the short identifier of the currently configured embedding model (e.g. `"bge-m3"`), or `"server-slot"` while an incomplete Server choice is retained. `coverage` is `{ covered, total }` — the number of library items indexed under the operational model vs. the total items in the index, letting agents detect when a model switch has left items to be re-indexed.

### Result shape

`search` and `find_similar` both return `{ "results": [...] }`, where each result item looks like this:

```json
{
  "itemKey": "ABCD2345",
  "libraryKey": "user",
  "title": "Attention Is All You Need",
  "authors": "Vaswani et al.",
  "year": 2017,
  "score": 0.016,
  "source": "both",
  "matchedChunk": {
    "snippet": "The Transformer relies entirely on self-attention to compute representations...",
    "page": 3,
    "textSource": "methods",
    "pdfAttachmentKey": "WXYZ6789"
  },
  "links": {
    "select": "zotero://select/library/items/ABCD2345",
    "selectHttp": "http://localhost:23119/zotseek/open?target=select&key=ABCD2345",
    "openPdf": "zotero://open-pdf/library/items/WXYZ6789?page=3",
    "openPdfHttp": "http://localhost:23119/zotseek/open?target=pdf&key=WXYZ6789&page=3"
  }
}
```

Notes on the shape:

- `source` (`"both"` | `"semantic"` | `"keyword"`) is present on `search` results only — it reports which engine found the item.
- `libraryKey` is `"user"` or `"group:<groupID>"`, or `null` for items that can no longer be resolved locally (e.g. indexed on another machine and not present in this library); a `null` `libraryKey` also means no `links` are emitted.
- `authors` is a formatted string for `search` results and an array of strings for `find_similar` results.
- `matchedChunk` is `null` when no excerpt or page is available; `page`, `textSource`, `sectionPaths`, and `pdfAttachmentKey` may be absent within it. `pdfAttachmentKey` is present on newly indexed Full-mode PDF chunks and identifies the exact attachment that produced the hit; copy it into `get_item.pdf_attachment_key`. Old Full indexes remain searchable but return no exact PDF key until refreshed.
- Child Note keyword fallbacks return a query-centred excerpt capped at 1200 Unicode characters, never the complete long Note. When the stored index has the matching chunk, its faithful chunk text and `sectionPaths` take precedence.
- `score` is a relevance score (RRF score for `search`, cosine similarity for `find_similar`), rounded to three decimals. RRF scores are small by construction (typically 0.005-0.03) and only meaningful for ranking within a single result set; don't read them as percentages. Cosine scores (semantic mode, `find_similar`) range 0-1.

### `get_item` result and PDF behavior

`get_item` always returns stable identity, normalized bibliographic metadata (including abstract), tags, collections, related-item identities, attachments, and deep links. `include_notes:true` adds all Child Notes sorted by `noteKey`; every Note contains complete visible `text`, live `sections` (`path`, `pathLevels`, `paragraphs`), and deduplicated `sectionPaths`. Read-side Notes do not apply ZotSeek's indexing exclusions for Basic Information or References.

PDF reading never reruns the main-PDF classifier. A supplied `pdf_attachment_key` must be a PDF child of the requested parent in the same library. Without it, ZotSeek uses the exact source persisted by a new Full index; if no exact source is available, `pdf.status` is `unresolved` and the caller can choose a key from `attachments`. `pages` accepts one physical page or one continuous range such as `3-5`; `full` is explicit and can return a very large response for books or theses.

`pdf.status` uses stable machine values: `ok`, `partial`, `missing`, `unresolved`, `empty`, or `failed`. `source` is `zotero-fulltext-cache`, `pdfworker`, or `cache+pdfworker`. Zotero's `.zotero-ft-cache` is used first; missing requested pages are filled with one batched PDFWorker call, and a full fallback likewise parses the document only once. Returned text is Zotero/PDF.js plain text split by physical page, including References and without ZotSeek's indexing cleanup.

### Recommended workflow for AI agents

An agent should separate discovery from complete-item reading:

1. Call `index_status` before a retrieval session. If `ready` is false, `coverage.covered` is lower than `coverage.total`, or `configurationError` is present, report the limitation instead of presenting the result set as complete.
2. For literature discovery, start with `search` using `mode: "hybrid"`, `granularity: "papers"`, and multiple results (normally 10). Do not answer a completeness-sensitive question from the first result alone.
3. For comparisons or questions that require several papers, split the information need into focused retrieval queries, run one paper-level search per concept or claim, then merge and deduplicate results by `libraryKey + itemKey`. Putting several weakly related concepts into one long embedding query can reduce recall.
4. Use `granularity: "passages"` only for targeted evidence gathering. Passage results may contain several chunks from the same paper, so they should not replace paper-level discovery when document diversity matters.
5. For a chosen result, call `get_item` with its `libraryKey` and `itemKey`. For a PDF hit, pass `matchedChunk.pdfAttachmentKey` and request the matched page or a small adjacent range before requesting `full`.
6. Synthesize only from evidence actually returned, and say when one side of a comparison remains unsupported. Broaden or rephrase the focused query before concluding that the library contains no relevant paper.

`matchedChunk.snippet` remains one bounded matching chunk or excerpt, **not the complete Child Note or PDF**. Use `get_item` for complete Notes or page/full PDF text rather than trying to reconstruct a document through repeated search queries.

### Deep links

Each result carries `zotero://` deep links so an agent can cite a paper with a link that opens it directly in Zotero:

| Field | Opens | Notes |
|-------|-------|-------|
| `links.select` | The item in the Zotero main pane | Always present for a resolvable item |
| `links.openPdf` | The exact indexed PDF in Zotero's reader, at the matched page | New Full-mode PDF hits use `matchedChunk.pdfAttachmentKey`; older/non-PDF results may use Zotero's best attachment |
| `links.selectHttp` | Same as `select`, via a local http launcher | For clients that only linkify `http(s)` URLs |
| `links.openPdfHttp` | Same as `openPdf`, via a local http launcher | Present whenever `openPdf` is |

These links work only on the machine where this Zotero instance is running. Used together with `matchedChunk.page`, they give an agent page-precise grounding: it can quote the matched passage and hand the user a link that opens the PDF right at that page.

**Which form to use:** some chat clients only turn `http(s)://` URLs into clickable links and leave custom schemes like `zotero://` as plain text — and embedded webviews often block the protocol handoff even when the link is clicked. The `*Http` variants exist for those clients: they point at `GET /zotseek/open` on the local server, and since that request is answered by Zotero itself, the action happens directly inside Zotero (the item is selected, or the PDF opens at the page) — no `zotero://` handoff involved. The page that loads just confirms it. Clients that render `zotero://` links directly (Claude Code, for example) get a smoother jump with the plain `select`/`openPdf` forms.

## REST API

The same operations and result shapes are available as plain `GET` endpoints for scripts and CLI tools. All are served on `localhost:23119`.

| Endpoint | Query parameters |
|----------|------------------|
| `GET /zotseek/search` | `q` *(required)*, `topK`, `mode`, `granularity`, `minSimilarity`, `libraryKey`, plus `yearFrom`, `yearTo`, `journal`, `author`, `exact` (`true`/`false`) |
| `GET /zotseek/item` | `itemKey` *(required)*, `libraryKey`, `includeNotes`, `includePdf` (`none`/`pages`/`full`), `pdfPages`, `pdfAttachmentKey` |
| `GET /zotseek/similar` | `itemKey` *(required)*, `libraryKey` (`user` or `group:N`), `topK` |
| `GET /zotseek/stats` | *(none)* |
| `GET /zotseek/open` | `target` (`select` \| `pdf`) *(required)*, `key` *(required)*, `library` (`user` or `group:N`), `page` (pdf only) — selects the item or opens the PDF directly in Zotero and returns a confirmation page (`404` if the item isn't in this library) |

Example:

```bash
curl 'http://localhost:23119/zotseek/search?q=transformer+attention&topK=2&mode=hybrid'
```

```json
{
  "results": [
    {
      "itemKey": "ABCD2345",
      "libraryKey": "user",
      "title": "Attention Is All You Need",
      "authors": "Vaswani et al.",
      "year": 2017,
      "score": 0.016,
      "source": "both",
      "matchedChunk": { "snippet": "The Transformer relies entirely on self-attention...", "page": 3, "textSource": "methods" },
      "links": { "select": "zotero://select/library/items/ABCD2345", "selectHttp": "http://localhost:23119/zotseek/open?target=select&key=ABCD2345", "openPdf": "zotero://open-pdf/library/items/WXYZ6789?page=3", "openPdfHttp": "http://localhost:23119/zotseek/open?target=pdf&key=WXYZ6789&page=3" }
    }
  ]
}
```

### Errors

| Status | When |
|--------|------|
| `400` | Invalid input, or the search failed (e.g. missing `q` / `itemKey`, or an item not indexed), with `{"error": "..."}` |
| `403` | Request presents a forged non-local `Origin` header |
| `404` | AI Agent Access is disabled (the endpoints are not registered) |
| `500` | Unexpected internal failure on `GET /zotseek/stats`, with `{"error": "..."}` |

## Security

| Property | Guarantee |
|----------|-----------|
| **Opt-in** | Off by default; you enable it explicitly in ZotSeek settings |
| **Read-only** | Nothing exposed here can modify your library or the index — tools only search or read live item, Note, PDF, and index-status data |
| **Localhost only** | Endpoints bind to the loopback interface; not reachable from the network |
| **Not reachable from web pages** | Zotero's server blocks browser-originated requests to the data endpoints before they reach ZotSeek, and ZotSeek additionally validates the `Origin` header. The one deliberate exception is the `GET /zotseek/open` link launcher, which browsers can reach by design — it exposes no data and can only select an item or open a PDF in Zotero (strictly validated input, prefetch requests ignored) |
| **100% local** | All search and inference run on your machine; no data leaves it |

## See also

- [API.md](API.md) — the in-Zotero JavaScript API (`Zotero.ZotSeek.api`) for other Zotero plugins running inside Zotero.
- [SEARCH_ARCHITECTURE.md](SEARCH_ARCHITECTURE.md) — how hybrid search, RRF fusion, and chunking work.

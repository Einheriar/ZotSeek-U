# ZotSeek MCP Server & REST API

ZotSeek can expose read-only library/collection navigation, search, and stable-identity item, Note, and PDF reading to AI agents and scripts through a local MCP server and matching REST endpoints, served on Zotero's own HTTP server.

This needs no extra software: the endpoints run inside the Zotero you already have open. They are **opt-in** (off by default), expose **read-only** library operations, and are bound to **localhost only**. Search can prepare local caches. Localhost describes the MCP connection, not every downstream operation: semantic/Hybrid query embedding uses the selected provider and can send query text to a configured cloud service. Keyword search does not request query embeddings. The connected agent receives returned excerpts and metadata and handles them according to its own configuration.

Everything routes through the running Zotero, where your embeddings and index already live, so **Zotero must be running** for the endpoints to respond.

> Looking for the in-Zotero JavaScript API for other plugins (`Zotero.ZotSeek.api`)? See [API.md](API.md).

## Setup

### 1. Enable AI Agent Access

In Zotero, open **Settings → ZotSeek → AI Agent Access** and check **"Allow AI agents to search and read your library (local MCP server)"**. This is off by default. Toggling it takes effect immediately — no restart needed. The same switch authorizes all read-only MCP/REST operations; there is no separate PDF permission.

### 2. Allow Zotero's local HTTP server

The endpoints ride on Zotero's built-in HTTP server, which must be enabled: **Settings → Advanced → "Allow other applications on this computer to communicate with Zotero"**. If this is off, the ZotSeek pane shows a warning. Zotero serves on `localhost:23119`.

### 3. Connect your MCP client

The MCP endpoint is at `http://localhost:23119/zotseek/mcp` (Streamable HTTP transport, stateless). It does not expose an SSE stream, so `GET` explicitly returns **405 Method Not Allowed**; normal client messages use `POST`.

The server negotiates `2024-11-05`, `2025-03-26`, and `2025-06-18`. Under the `2025-03-26` transport contract (also assumed when the version header is absent), it accepts non-initialization JSON-RPC batches, returns one response array entry per request, omits notification entries, and returns 202 with an empty body for notification-only input. `initialize` remains a standalone request. Because MCP `2025-06-18` removed batching, a batch carrying that version header is rejected with a diagnostic 400 response.

`initialize` also returns a short, optional `instructions` string for cross-tool workflow guidance: two stages of usually up to five searches each, candidate reading before follow-up search, generally no more than four full-paper reads, and early stopping when the evidence is sufficient or the uncertainty can be reported honestly. These are soft suggestions, not enforced limits. MCP hosts differ in whether they pass server instructions to the model; the `search` and `get_item` tool descriptions therefore retain brief standalone guidance.

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

Documentation alignment (2026-09-13; Plan 74 implementation): the behavior below describes the current MCP contract. The `tools/list` descriptions in `src/server/mcp-endpoint.ts` are aligned with this documentation. Restart Zotero to load the rebuilt plugin, then have the MCP client refresh its tool definitions.

| Tool | Arguments | Returns |
|------|-----------|---------|
| `search` | `query` *(required)*; `max_results` (1–100, default 10); `mode` (`hybrid` \| `semantic` \| `keyword`, default `hybrid`); `granularity` (`papers` \| `passages`, default `papers`); `library_key` (`user` or `group:<groupID>`, omit to search all indexed libraries); optional `collection_key` plus `include_subcollections` (default `true`); optional `filter` (`year_from`, `year_to`, `journal`, `author`, `tag`, `exact`) | Ranked results from the selected live scope, optionally filtered before the final return cap |
| `get_library_map` | `library_key` (`user` or `group:<groupID>`, default `user`) | Complete live ordinary-collection tree with stable keys and names |
| `get_item` | `item_key` *(required)*; `library_key` (default `user`); `include_notes` (default `false`); `include_pdf` (`none` \| `pages` \| `full` \| `references`, default `none`); `pdf_pages` (`3` or `3-5`, at most 20 pages); `pdf_attachment_key` | A normalized live Zotero item snapshot, optionally with complete Notes and exact, bounded PDF text |
| `find_similar` | `item_key` *(required, 8-character Zotero key)*; `library_key` (`user` or `group:<groupID>`, default `user`); `max_results` (1–100, default 10) | Papers similar to a known library item, by its stored embeddings |
| `index_status` | *(none)* | `{ready, modelLoaded, indexedPapers, totalChunks, modelId, activeModel, coverage, configurationError?, lastIndexed, storageUsedBytes}` |

### Search parameter behavior

The short `search` and `get_item` descriptions state when to use each tool, important data/reading limits and fallback guidance if a host ignores `initialize.instructions`. Detailed field, ranking and PDF behavior is documented below; the guidance adds no search parameters or automatic workflow.

- `query` is a required non-empty string. Use keywords for `keyword`, a focused research question for `semantic` or `hybrid`, and a known title or DOI for Hybrid identity navigation. The parameter does not itself rewrite or split a query.
- `max_results` defaults to **10**, independently of the UI's result-count preference. It is a return cap, not a promise to fill the window. Exploratory calls can explicitly request **20**. Increasing it does not expand internal channel depth: paper Hybrid normally uses S50 and K50, whose union may contain fewer than 100 distinct papers.
- `mode` defaults to `hybrid`; `granularity` defaults to `papers`. Passage search may return several locations from one paper and retains its existing compatibility ranking. It is not the paper-ranking formula applied to chunks.
- MCP `search` uses a fixed semantic candidate floor of **0** instead of the UI preference. The MCP schema does not expose `min_similarity`; if an older client still sends that field, the server ignores it and keeps the fixed floor. The normal S50 candidate depth and non-negative semantic eligibility rules still apply; a zero floor does not return every scored paper. K50 candidates are still included through the keyword channel. The REST `minSimilarity` parameter retains its separate behavior described in the REST section below.
- `library_key` limits the library. Omitting it searches all indexed libraries. `collection_key` is an 8-character stable key returned by `get_library_map`; it requires an explicit `library_key`. Collection membership is resolved from live Zotero data before semantic/keyword TopK, includes all descendants by default, and can be restricted to direct members with `include_subcollections:false`. An unknown collection or a failed membership read returns an explicit error rather than widening the scope. The indexing content mode (`abstract`, `notes`, `full`) follows ZotSeek settings; `search` does not expose an indexing-mode override.
- `filter` inspects the normal bounded ranked candidate pool, then `max_results` is applied, as detailed below. It does not expose candidate-depth control, semantic threshold, lexical-bonus coefficient or RRF-weight parameters.

`mode` mirrors the ZotSeek UI. Paper-level **hybrid** first attempts explicit
metadata identity navigation. Content queries independently retrieve semantic
S50 and lexical K50 (equal Quick/BM25 RRF, k=10), then rank their union using
`semantic MaxSim + 0.05 * 11/(10 + rankK50)`, with zero bonus outside K50.
Abstract, Metadata + Notes and Full share this formula over their respective
chunk sources; Full reserves no source positions. Legacy automatic-weight
preferences do not change it. **semantic** and **keyword** bypass this Hybrid
policy. `granularity: "passages"` retains the existing location-level
compatibility paths, which have not been replaced by the paper-level experiment.

If the fixed Server model slot is selected but its profile JSON template is `NONE` or `UNKNOWN`, semantic/hybrid `search` and `find_similar` return a configuration error containing the template path; keyword-only search remains available. `index_status` remains callable and reports `ready: false`, zero usable coverage and the same text in `configurationError`. This state never falls back to a local model.

`get_library_map` defaults to the personal library. It returns `{libraryKey, name, collections}`, where every collection node is `{collectionKey, name, children}`. The tree includes nested and empty ordinary collections exactly once; it deliberately omits saved searches, item lists, tags and index-coverage claims. Use the returned `collectionKey` with the same `library_key` in `search`. A hierarchy that cannot be read completely returns an error instead of a partial tree.

`search.filter` is deliberately a **bounded-candidate filter**, not an exhaustive Zotero field query. Collection/library scope is applied first; the selected retrieval mode then produces its normal bounded candidates; live metadata/tag conditions remove candidates without changing their order; finally `max_results` truncates the surviving list. This lets lower-ranked candidates fill the requested window when earlier candidates fail, but never searches beyond the mode's existing pool. Paper Hybrid filters the S50∪K50 union; Semantic filters S50; Keyword filters K50; identity navigation filters its complete identity match set. Passage mode filters its existing compatibility candidate lists and does not adopt a new paper formula.

`journal` checks publication, book, and proceedings titles. `author` checks first name, last name, `First Last`, `Last, First`, and institutional creator names. These string fields trim values, normalize Unicode NFC, ignore case, and use substring matching unless `exact:true`. `tag` matches one complete live Zotero tag after NFC normalization and remains case-sensitive; `exact` does not change tag semantics. Because the filter reads live Zotero items, stale/missing results cannot satisfy it.

For `index_status`, `ready` is `true` when the index contains papers and the selected model has an operational identity. `modelLoaded` reports pipeline initialization, not whether BM25 and vector caches are both warm. A first semantic/Hybrid request can incur provider initialization, query embedding and local cache preparation; timing depends on the provider and library, and readiness does not guarantee request success or a fixed delay. `activeModel` is the short identifier of the currently configured embedding model (e.g. `"bge-m3"`), or `"server-slot"` while an incomplete Server choice is retained. `coverage` is `{ covered, total }` — the number of library items indexed under the operational model vs. the total items in the index, letting agents detect when a model switch has left items to be re-indexed.

### Result shape

`search` and `find_similar` both return `{ "results": [...] }`, where each result item looks like this:

```json
{
  "itemKey": "ABCD2345",
  "libraryKey": "user",
  "title": "Attention Is All You Need",
  "authors": "Vaswani et al.",
  "year": 2017,
  "score": 0.812,
  "semanticScore": 0.804321,
  "bm25Score": 12.7345,
  "source": "both",
  "journalMetrics": {
    "provider": "zotero-style",
    "impactFactor": 8.9,
    "sciQuartile": "Q1"
  },
  "metadata": {
    "itemType": "journalArticle",
    "title": "Attention Is All You Need",
    "creators": [{ "creatorType": "author", "firstName": "Ashish", "lastName": "Vaswani" }],
    "date": "2017-06-12",
    "year": 2017,
    "publicationTitle": "Advances in Neural Information Processing Systems",
    "DOI": "10.48550/arXiv.1706.03762",
    "abstractNote": "The dominant sequence transduction models are based on..."
  },
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
- `metadata` (present when the item resolves locally) is a normalized bibliographic snapshot read from the live Zotero item — `itemType`, typed `creators` (including institutional `name`), `date`/`year`, `publicationTitle`/`bookTitle`/`proceedingsTitle`, `volume`/`issue`/`pages`, `publisher`/`place`, `DOI`/`ISBN`/`ISSN`, `url`, and `abstractNote`. The `filter` parameters operate on these fields. It is omitted for items that can no longer be resolved locally.
- `journalMetrics` is optional best-effort enrichment from Zotero Style's existing local journal cache. Style 6.x stores that cache by publication title under `rank` in `<Zotero data directory>/zoterostyle.json`; the adapter also retains a legacy in-memory-cache fallback for older releases. It checks the runtime global first and uses Zotero's Add-on Manager as a read-only fallback when extension compartments hide that global, so a disabled or uninstalled Style does not expose leftover file data. `provider` is the stable value `"zotero-style"`; `impactFactor` is a finite non-negative number read from Style's `sciif`, and `sciQuartile` is JCR SCI `Q1`–`Q4` read from `sci`. This is not a Zotero bibliographic field or a search score. It is included on resolvable `search` / `find_similar` results and `get_item` only when at least one valid metric exists. The whole object, or either metric within it, is omitted when Style is absent, disabled, has no cached data, or changes its internal storage. ZotSeek keeps a short-lived read snapshot to avoid reparsing the file for every result; it never reads Style credentials, calls EasyScholar, invokes Style's column data provider, or triggers a metric refresh while serving MCP/REST. Values can therefore be stale and never affect ranking or filtering.
- Plan 62: BM25 prepares after startup maintenance and during the existing manual update action. Early keyword/Hybrid requests may wait for preparation. Ordinary additions, edits and deletions can leave BM25 session-stale until the next maintenance pass; metadata navigation remains live.
- A stale hit whose Zotero item no longer exists returns `itemStatus: "item_not_found"` and `title: "Item not found"`, preserving `libraryKey`/`itemKey` and any cached matched snippet. `links` and live `metadata` are omitted. Do not treat that snippet as evidence that the item still exists. The same optional status applies to MCP and REST; live results keep their prior shape. UI labels are localized independently of the machine status.
- `libraryKey` is `"user"` or `"group:<groupID>"`, or `null` for items that can no longer be resolved locally (e.g. indexed on another machine and not present in this library); a `null` `libraryKey` also means no `links` are emitted.
- `authors` is a formatted string for `search` results and an array of strings for `find_similar` results.
- `matchedChunk` is `null` when no excerpt or page is available; `page`, `textSource`, `sectionPaths`, and `pdfAttachmentKey` may be absent within it. `pdfAttachmentKey` is present on newly indexed Full-mode PDF chunks and identifies the exact attachment that produced the hit; copy it into `get_item.pdf_attachment_key`. Old Full indexes remain searchable but return no exact PDF key until refreshed.
- Child Note keyword fallbacks return a query-centred excerpt capped at 1200 Unicode characters, never the complete long Note. When the stored index has the matching chunk, its faithful chunk text and `sectionPaths` take precedence.
- `score` is the selected search policy's final ranking score, rounded to three decimals. Paper Hybrid returns semantic MaxSim plus the bounded lexical bonus, possibly above 1; it is not a percentage or probability. `semanticScore` is the raw, unrounded semantic MaxSim when semantic retrieval was run and the item has a usable semantic match; otherwise it is `null`. `bm25Score` is the raw, unnormalized BM25 score for the best lexical chunk when BM25 produced one; otherwise it is `null`. Keyword still combines Quick Search and BM25 with raw equal-weight RRF (k=10), and does not run semantic retrieval merely to populate `semanticScore`. `find_similar` is semantic-only, so its `semanticScore` is populated and `bm25Score` is `null`. The UI keyword percentage remains separately normalized to the best result in the query. Hybrid passage paths retain their own score conventions. Compare scores within the same query and policy; raw BM25 values from different queries are not confidence values and should not be compared directly. A genuinely missing vector retains a null internal semantic score and compatible zero-baseline lexical bonus; this case is outside the complete-vector offline quality validation. `source: "both"` means a semantic score exists and the paper is in K50, even if it is outside S50; it does not imply confidence.

### `get_item` result and PDF behavior

`get_item` always returns stable identity, normalized bibliographic metadata (including abstract), tags, collections, related-item identities, attachments, and deep links. It also returns the same optional cached Zotero Style `journalMetrics` as search results when available. Each `attachments` entry carries `key`, `contentType`, `isPDF`, `filename`, `isIndexedPdfSource` (true for the exact PDF attachment a new Full-mode index was built from), and — for PDF attachments — direct `openPdf`/`openPdfHttp` deep links. `include_notes:true` adds all Child Notes sorted by `noteKey`; every Note contains complete visible `text`, live `sections` (`path`, `pathLevels`, `paragraphs`), and deduplicated `sectionPaths`. Read-side Notes do not apply ZotSeek's indexing exclusions for Basic Information or References.

PDF reading never reruns the main-PDF classifier. A supplied `pdf_attachment_key` must be a PDF child of the requested parent in the same library. Without it, ZotSeek uses the exact source persisted by a new Full index; if no exact source is available, `pdf.status` is `unresolved` and the caller can choose a key from `attachments`. `pages` accepts one physical page or one continuous range such as `3-5`, with at most 20 pages per request.

`references` returns only a detected reference-list region, with the source PDF's real physical page numbers. It reuses the same References v2 detector as production PDF preprocessing but exposes the detector's inverse view: the region excluded from semantic indexing is returned as page-aligned plain text. It does not parse citations into author/title/journal/DOI fields. The server probes from the end in batches of at most 20 pages and scans at most 100 pages or approximately 300,000 source characters. `referenceDetection` reports the strategy/version and scanned physical-page interval. A complete scan with no reliable region returns `status:"not_found"`, `complete:true`, and empty `pages`; reaching a scan bound first returns `status:"partial"`, `complete:false`, empty `pages`, and `limitReason`. This distinction prevents a bounded miss from being reported as an empty bibliography. Detection can still miss unusual headings or layouts.

`full` means “return the leading PDF prefix in full if it fits the server limits”, not an unbounded whole-document promise. The server reads at most 20 physical pages per PDFWorker batch and returns at most 100 pages or approximately 300,000 text characters. It never splits a physical page merely to meet the character threshold; consequently, one exceptionally large first page can exceed that approximate threshold. These limits apply equally to MCP and REST and also bound responses served entirely from Zotero's cache.

When the attachment exceeds either boundary, `pdf.status` is `partial`, `complete` is `false`, `limitReason` is the stable machine value `page_limit` or `character_limit`, and `nextPage` is the first omitted physical page. Continue, when needed, with `include_pdf:"pages"` and a range starting at `nextPage`; there is no opaque continuation token. A complete result has `status:"ok"` (or `empty`) and `complete:true` and omits the limit fields.

`pdf.status` otherwise uses the stable machine values `ok`, `partial`, `not_found`, `missing`, `unresolved`, `empty`, or `failed`; `not_found` is specific to a completed `references` scan. `source` is `zotero-fulltext-cache`, `pdfworker`, or `cache+pdfworker`. Zotero's `.zotero-ft-cache` is used first; missing explicit pages use one PDFWorker batch, while bounded `full` and `references` reads use sequential batches. If a worker batch's form-feed count does not match the requested pages, only those pages are reread individually and sequentially: Zotero's final `trim()` can erase boundaries around empty edge pages. Single-page text (including empty text or embedded form feeds) belongs to that requested physical page. Invalid or inconsistent fallback results fail rather than fabricate pages. Normal batches, response limits and continuation fields are unchanged. This bounds newly enqueued work but is not a hard timeout: Zotero's shared PDFWorker queue exposes no cancellation API, so ZotSeek does not use a `Promise.race` that would return early while leaving an invisible job running. `pages` and `full` return Zotero/PDF.js plain text without ZotSeek's indexing cleanup; `references` returns only the References v2-classified region.

### Recommended workflow for AI agents

An agent should separate discovery from complete-item reading:

1. Call `index_status` before a retrieval session. If `ready` is false, `coverage.covered` is lower than `coverage.total`, or `configurationError` is present, report the limitation instead of presenting the result set as complete.
2. First turn the user's natural-language request into a focused search expression. Keep reliable objects, relations, directions and conditions; preserve uncertain clues as uncertain instead of inventing a year, method, result or exact wording. The agent may choose `semantic` or `keyword` when the query clearly calls for it, but `hybrid` is the default and no routine multi-mode round-robin is required.
3. For literature discovery, start with `search` using `mode: "hybrid"`, `granularity: "papers"` and the default 10 results. Request a larger window, up to 100, only when the question needs broader coverage. Read titles, metadata, matched chunks and all three scores as retrieval evidence; scores are not answer correctness or confidence.
4. Use search in two stages. In the first stage, usually make no more than 5 calls from meaningfully different angles to form candidates. After reading those candidates, make up to 5 additional calls only when a key condition remains unresolved; do not repeat queries merely by changing synonyms or word order. Stop when the evidence is sufficient or the remaining uncertainty can be reported honestly, and reuse existing candidates for follow-up. Deduplicate papers by `libraryKey + itemKey`.
5. Use `granularity: "passages"` only for targeted evidence gathering. Passage results may contain several chunks from the same paper, so they should not replace paper-level discovery when document diversity matters.
6. For a chosen result, call `get_item` with its `libraryKey` and `itemKey`. Prefer metadata, Child Notes and relevant pages; generally use `include_pdf:"full"` for no more than 4 papers. For a PDF hit, pass `matchedChunk.pdfAttachmentKey` and request the matched page or a small adjacent range before requesting bounded `full`. If `full` returns `partial`, request further 20-page-or-smaller ranges only when the unresolved question needs them. The returned PDF text is parser-produced plain text: Greek characters, mathematical symbols, subscripts/superscripts, columns and tables can be misread or reordered. Treat suspicious text as a prompt to verify the source, and do not silently guess a correction.
7. Synthesize only from evidence actually returned, distinguish direct evidence from background material, and say when one side of a comparison remains unsupported. Broaden or rephrase the focused query before concluding that the library contains no relevant paper.

`matchedChunk.snippet` remains one bounded matching chunk or excerpt, **not the complete Child Note or PDF**. Use `get_item` for complete Notes or exact page/bounded-full PDF text rather than trying to reconstruct a document through repeated search queries. PDF content returned by `get_item` is parsed text and may contain extraction errors; it is not a layout-faithful transcription.

The stage and full-text counts above are concise soft guidance for the model, not server-enforced quotas. ZotSeek does not keep per-task counters and does not reject an eleventh search or a fifth full-paper read. Hosts that ignore `initialize.instructions` may not deliver the complete staged workflow; the individual tool descriptions still explain how to begin and read selectively.

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

The same operations and result shapes are available as plain `GET` endpoints for scripts and CLI tools. All are served on `localhost:23119`. Search results on both surfaces include `score`, `semanticScore` and `bm25Score` with the meanings above.

REST keeps its existing `minSimilarity` query parameter and preference-based default. This is intentionally separate from MCP: only MCP search uses the fixed semantic candidate threshold of 0 and omits the threshold from its public schema. REST callers that send `minSimilarity` continue to receive the REST behavior documented by the endpoint implementation.

| Endpoint | Query parameters |
|----------|------------------|
| `GET /zotseek/search` | `q` *(required)*, `topK`, `mode`, `granularity`, `minSimilarity`, `libraryKey`, optional `collectionKey` and `includeSubcollections` (`true`/`false`), plus `yearFrom`, `yearTo`, `journal`, `author`, `tag`, `exact` (`true`/`false`) |
| `GET /zotseek/library-map` | `libraryKey` (default `user`) |
| `GET /zotseek/item` | `itemKey` *(required)*, `libraryKey`, `includeNotes`, `includePdf` (`none`/`pages`/`full`/`references`), `pdfPages`, `pdfAttachmentKey` |
| `GET /zotseek/similar` | `itemKey` *(required)*, `libraryKey` (`user` or `group:N`), `topK` |
| `GET /zotseek/stats` | *(none)* |
| `GET /zotseek/open` | `target` (`select` \| `pdf`) *(required)*, `key` *(required)*, `library` (`user` or `group:N`), `page` (pdf only) — selects the item or opens the PDF directly in Zotero and returns a confirmation page (`404` if the item isn't in this library) |

Example:

```bash
curl 'http://localhost:23119/zotseek/search?q=transformer+attention&topK=2&mode=hybrid'
```

Discover a collection key and search its whole subtree with a complete live tag:

```bash
curl 'http://localhost:23119/zotseek/library-map?libraryKey=user'
curl 'http://localhost:23119/zotseek/search?q=neural+synchrony&libraryKey=user&collectionKey=ABCD2345&includeSubcollections=true&tag=Review'
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
      "semanticScore": 0.804321,
      "bm25Score": 12.7345,
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
| **Read-only operations** | Tools expose search and reading, not library edits or index-maintenance commands; requests can initialize local caches |
| **Localhost only** | Endpoints bind to the loopback interface; not reachable from the network |
| **Not reachable from web pages** | Zotero's server blocks browser-originated requests to the data endpoints before they reach ZotSeek, and ZotSeek additionally validates the `Origin` header. The one deliberate exception is the `GET /zotseek/open` link launcher, which browsers can reach by design — it exposes no data and can only select an item or open a PDF in Zotero (strictly validated input, prefetch requests ignored) |
| **Provider-dependent inference** | Index retrieval is local; semantic/Hybrid query embedding can use the selected cloud provider. Returned data is also available to the connected agent |

## See also

- [API.md](API.md) — the in-Zotero JavaScript API (`Zotero.ZotSeek.api`) for other Zotero plugins running inside Zotero.
- [SEARCH_ARCHITECTURE_EN.md](SEARCH_ARCHITECTURE_EN.md) — how hybrid search, RRF fusion, and chunking work (Chinese version: [SEARCH_ARCHITECTURE_CN.md](SEARCH_ARCHITECTURE_CN.md)).

# ZotSeek-U Development Guide (DEVELOPMENT_U_EN)

> **About this document:** This is the English counterpart of `DEVELOPMENT_U_CN.md`. It records the features, architecture and development workflow that **ZotSeek-U** adds on top of upstream [ZotSeek](https://github.com/introfini/ZotSeek), and is the fork's primary development document, maintained with the repository. Documentation baseline: `0.1.0` (2026-09-06). The Chinese version (`DEVELOPMENT_U_CN.md`) is the source of truth; when the two diverge, it wins and this file must be brought back in sync.
>
> Companion reading: the upstream development journal (pre-fork, single-model Nomic era, frozen for historical reference, no longer maintained) is [DEVELOPMENT.md](DEVELOPMENT.md); runtime details of search, chunking and indexing modes live in [SEARCH_ARCHITECTURE_EN.md](SEARCH_ARCHITECTURE_EN.md); MCP/REST usage is documented in [MCP.md](MCP.md).
>
> Status markers: **[Shipped]** = in production code and accepted; **[In progress]** = approved, partially implemented or awaiting runtime acceptance. Finer-grained experiment data and per-item acceptance records live in the maintainer's local workspace and are not distributed with this repository.

## Plan 71: PDF batch boundary recovery

Shared `readPdfAttachment` rereads only a mismatched PDFWorker batch one page at a time, sequentially. Zotero's final `trim()` removes form-feed boundaries around empty edge pages; padding cannot safely recover page numbers. Single-page results retain their requested physical page, empty text and embedded form feeds; failed or inconsistent results still fail. MCP/REST keep their 20-page batches, 100-page/about-300,000-character response limits and continuation fields. Brief's internal whole-document reads share recovery without acquiring server limits. Index extraction is unchanged.

## Plan 62: BM25 snapshots (accepted)

Preferences Storage Used sums the file sizes of `zotseek.sqlite` and the saved BM25 JSON snapshot, reread on Refresh Statistics. A missing snapshot contributes zero; stale or corrupt files still count their actual bytes. Temporary replacement files, SQLite journals, model files and Zotero attachments are excluded. The raw JS API / MCP `storageUsedBytes` retains its database-file meaning.

2026-09-09: Independent JSON snapshots, transactional corpus revisions, cooperative construction, end-of-startup preparation and the existing manual action are implemented. Ordinary writes retain session BM25; clear, model deletion, close and reattach invalidate memory. Snapshots match database identity, revision, model and algorithm contracts and verify SHA-256; software versions alone do not invalidate them. Searches wait for shared preparation without dual versions. Missing items return item_not_found, localized in all ten UI locales, without links or live metadata in MCP/REST. Format 3 retains one JSON file with bounded codec/validation records and restores numeric columns directly as typed arrays. All 468 Node tests pass. Isolated Zotero 9.0.6 verifies cold startup, reuse, session-stale content, explicit refresh and revision invalidation. For 58,105 chunks, the snapshot is about 198 MB; the final hit took 6.85 seconds with a 0.52-second maximum event-loop gap, versus 3.94 seconds and a 3.27-second gap for whole-object JSON. Responsiveness trades off total time; no stall-free or fixed-time guarantee is made. Actual isolated Zotero windows verify storage totals, Refresh Statistics, the manual update action and missing-item display/open feedback; menus and preferences remain operable during large-library construction. Manual completion uses a controlled scenario requiring no embeddings; earlier large-library runtime tests cover newly changed text becoming searchable after refresh.

## Table of Contents

1. [Relationship to Upstream](#1-relationship-to-upstream)
2. [Indexing Mode System](#2-indexing-mode-system)
3. [Structured Child Note Chunking](#3-structured-child-note-chunking)
4. [PDF Main-Text Indexing Pipeline](#4-pdf-main-text-indexing-pipeline)
5. [R1 Semantic Breadcrumbs](#5-r1-semantic-breadcrumbs)
6. [Search Architecture Changes](#6-search-architecture-changes)
7. [Embedding and Models](#7-embedding-and-models)
8. [Index Maintenance System](#8-index-maintenance-system)
9. [Database and Stable Identity](#9-database-and-stable-identity)
10. [MCP/REST Extensions](#10-mcprest-extensions)
11. [Localization](#11-localization)
12. [Preferences UI](#12-preferences-ui)
13. [LLM Literature Briefs](#13-llm-literature-briefs)
14. [Engineering and Development Workflow](#14-engineering-and-development-workflow)
15. [Release and Versioning Strategy](#15-release-and-versioning-strategy)
16. [Documentation Conventions](#16-documentation-conventions)

---

## 1. Relationship to Upstream

ZotSeek-U forked upstream at v1.19.x with the goal of making Zotero infrastructure for the AI era of literature management, focusing on Chinese/multilingual semantic retrieval, embeddings, hybrid search, Metadata + Notes indexing, and a local MCP interface. Upstream v1.20.0 was integrated on 2026-08-24 (Zotero 10 database hooks, multi-collection indexing, worker thread fixes, database reconnection/remount, idle compaction, model asset self-repair); the compatibility range is Zotero 9.0 – 10.0.*.

**Kept from upstream** (largely untouched, only extended):

- MCP/REST foundation: `search` / `find_similar` / `index_status` tools, Streamable HTTP JSON-RPC, localhost-only Origin validation, the `/zotseek/open` deep-link launcher.
- Local inference stack: Transformers.js v3 + ChromeWorker + CPU/WASM Q8 quantization, per-`modelId` vector partitioning, 60-second timeout and retry semantics.
- Search framework: semantic / keyword / hybrid modes with RRF fusion, papers/passages result granularity.
- SQLite basics: `zotseek.sqlite` ATTACHed to the Zotero connection, reconnect/remount handling, idle `VACUUM INTO` compaction.

**Technical identity deliberately unchanged**: plugin ID, `zotseek.*` preference prefix, `zotseek.sqlite`, the `chrome://zotseek/` namespace, and the `Zotero.ZotSeek` global. `bootstrap.js` disables this fork's background auto-update after startup so upstream releases cannot overwrite it.

## 2. Indexing Mode System [Shipped]

### 2.1 Content definition per mode

| Mode (machine value) | UI label | Indexed content |
|---|---|---|
| `abstract` | Abstract only | title + abstract + non-`#` tags |
| `notes` | Metadata + Notes | title + abstract + non-`#` tags + child notes |
| `full` | Full text | title + abstract + non-`#` tags + child notes + PDF |

All three modes share one `IndexedMetadataSnapshot` extraction path: the Metadata/Summary portion is fixed as "title + abstract (≥50 chars) + tags filtered for the `#` prefix". Workflow tags starting with `#` never enter embedding text in any mode, and a purely `#`-tag change does not trigger Summary recomputation.

### 2.2 Default mode and machine-value boundary

- Fresh installs and missing preferences default to the machine value `notes` (`DEFAULT_INDEXING_MODE` in `src/utils/indexing-mode.ts`); a non-empty unknown value safely falls back to `abstract`, explicit user choices are kept.
- `abstract` / `notes` / `full` are stable machine values used in preferences, the database, business logic and cross-module APIs. Display text in any language must never participate in indexing-mode decisions (see [16 Documentation Conventions](#16-documentation-conventions)).

### 2.3 Full-mode source priority

Within each paper's unified `maxChunksPerPaper` budget, Full mode allocates strictly in order: Metadata/Summary first → Notes (at most 30 chunks per paper) → PDF gets the remainder (`combineFullModeChunks()`). The 30-chunk Notes cap applies to Full mode only.

### 2.4 Incremental mode transitions and vector reuse

Switching modes does not necessarily recompute everything (`src/core/index-mode-transition.ts`): only when a per-item versioned configuration fingerprint proves that everything except the mode is unchanged (index contract, maxChunks, chunk strategy version, model input policy, model ID) can target chunks be matched exactly against old source + `chunk_text` + `sectionPaths` and reuse their existing embeddings, computing only what is missing. Anything unprovable or simultaneously changed triggers a full recompute; replacement is always atomic via `replaceItemModelChunks()`. The preferences pane and startup flow surface the mismatch and offer "check and update / rebuild / cancel".

## 3. Structured Child Note Chunking [Shipped]

Metadata + Notes and Full mode index Zotero child notes. The fork distinguishes two kinds:

- **Structured notes** (reliable heading hierarchy): the Note HTML is parsed into an `h1`–`h6` section tree; "基本信息" (basic-information) sections and reference-list subtrees are filtered out. Reference detection uses a composed title classifier (numbering/punctuation/bilingual-shell normalization + reference-object vocabulary + list-intent vocabulary), designed to prefer missed detections over false kills. Adjacent short sections are greedily packed within the same `h2` down to a soft floor of 1/4 of the recommended token budget; merging across `h2` boundaries is forbidden.
- **Plain notes** (no reliable hierarchy): the existing paragraph → sentence → Unicode-character fallback split applies; structure is never guessed.

Key data contract: every Note chunk stores three layers — the faithful evidence text `text`, the embedding-only input `embedText`, and persisted section paths `sectionPaths: string[][]` (schema v11 `section_paths`). Structural context only feeds the semantic input and must never pollute what the user sees; all four indexing paths consume `embedText ?? text`.

The note-specific strategy version `NOTE_CHUNK_STRATEGY_VERSION` went 2 → 3 → 4 (composed reference filtering); after unification with the general strategy the production value is `CHUNK_STRATEGY_VERSION = 10` (`src/utils/chunker.ts`). Chunk strategy upgrades require a full rebuild: the plugin prompts for a rebuild and pauses incremental updates, but never auto-deletes the user's index — the old index stays searchable until the rebuild completes.

Additionally, when keyword search hits a child note, the fallback `matchedChunk` is a bounded snippet of at most 1200 Unicode characters centered on the query terms, instead of the beginning of the whole note.

## 4. PDF Main-Text Indexing Pipeline [Shipped]

Full-mode PDF text is produced by the production strategy **`zotseek-pdf-main-text-indexing-v1`** (strategy version 6 onward):

1. **Main attachment selection**: one first-text-bearing main PDF per paper, keeping supplementary material out of the body text.
2. **PDFWorker direct page-by-page extraction**: Zotero's bundled PDF.js pipeline provides per-physical-page text; blank pages keep a placeholder so page numbers stay truthful.
3. **References v2 filtering**: reference regions are detected and filtered, substantially reducing useless chunks and improving aggregate retrieval.
4. **Repeating header/footer filtering (F v1)**: on by default with an internal function switch (no preferences entry); one known body-title false-hide risk is accepted.
5. **Same-page short-paragraph packing**: adjacent short paragraphs on the same physical page are greedily packed up to the recommended token budget (420 exact tokens for E5); no cross-page packing, no overlap, no packing across filter boundaries.

Design boundaries: PDF chunks must keep their real physical page numbers and provenance; when provenance is unclear, prefer omission. Controlled comparisons showed neither the Structured Document Text (SDT) route nor eight external PDF parsing libraries (pdftext, PyMuPDF4LLM, etc., OCR-free profiles) replaced the PDFWorker direct mainline.

**Chunk text fidelity (strategy 10)**: sentence spans are taken directly from the original string (preserving inter-sentence whitespace in English, leading punctuation such as `.NET`, and unterminated final sentences); all hard character splits respect Unicode code-point boundaries (protecting surrogate pairs/emoji); Summary stores the full title without the former 300-character truncation; token and character limits are merged into one final-input check.

## 5. R1 Semantic Breadcrumbs [Shipped]

Note chunk bodies are first split under the recommended budget (420 tokens for E5) with fixed boundaries; afterwards a deterministic prefix is added **to `embedText` only**:

```
Paper: <parent title>
Section: <section path>
```

- Breadcrumbs are not written into faithful `chunk_text`, do not enter the BM25 lexical index, and do not consume the body packing budget; over-long titles are truncated only before the model hard limit.
- Motivation: the same term means different things in Introduction/Methods/Results/Discussion, and a deterministic breadcrumb feeds document position to the embedding at zero hallucination cost; paired offline evaluation showed front-rank gains (R@1, MRR, nDCG) with zero truncation under the 512 hard limit.
- As with all structural context, users still see the faithful `displayText`; breadcrumbs only ever live in `embedText`.

## 6. Search Architecture Changes [Shipped]

The fork rebuilt the lexical channel and result organization on top of upstream's "semantic retrieval + Zotero quick search with RRF fusion". Runtime details: [SEARCH_ARCHITECTURE_EN.md](SEARCH_ARCHITECTURE_EN.md).

### 6.1 Identity navigation (identity prepass)

Queries first pass an identity layer over read-only Zotero metadata: exact DOIs, full titles, and unique sufficiently-long title fragments (≥3 consecutive Latin words or 12 characters; CJK ≥6 characters) navigate straight to the paper; author names return the author's set of papers rather than picking one; Latin surnames shorter than 5 characters stay silent. Explicitly selecting semantic or keyword mode strictly bypasses the default strategy.

### 6.2 T0 BM25 lexical channel

Upstream's heuristic keyword re-ranking was replaced by a zero-dependency BM25 (`src/core/lexical-search.ts`): `Intl.Segmenter('zh-Hans')` natural words plus CJK bigrams as dual channels, `k1=1.2 / b=0.75`, max TF between natural word and bigram, RRF fusion with `k=60`. It replaces the old `LOWER(chunk_text) LIKE` containment scan, making exact term hits in Notes/PDF bodies scale with corpus size. After a four-tokenizer ablation the production choice was frozen as the zero-dependency option (jieba-wasm etc. never shipped); the library-wide keyword dictionary patch is frozen as disabled.

Plan 60 compatibility fixes advance the lexical contract to v2: recover Latin terms from runtime-merged Korean/Latin segments with correct occurrence counts, and retain Thai-only segments that Gecko marks as non-word-like. Other scripts retain their existing filter. No global isWordLike relaxation or language detection is introduced. After an upgrade and restart, the first search rebuilds only the in-memory BM25 cache from stored text; semantic vectors are reused and no manual reindex is required.

### 6.3 Per-mode default search strategies

| Indexing mode | Default strategy |
|---|---|
| `abstract` | after identity navigation, abstract-scoped S50 ∪ K50 with bounded bonus |
| `notes` | after identity navigation, Metadata + Notes S50 ∪ K50 with bounded bonus |
| `full` | after identity navigation, all-source S50 ∪ K50 with bounded bonus, no source quotas |

The 2026-09-10 Plan 66P implementation (merged to main in `211b22e`) unifies paper-level UI / MCP / REST ranking as `S + 0.05*11/(10+rankK50)`. S is real MaxSim retained from an independent scoped scan; K50 combines Quick/BM25 ranks with equal weights and k=10. Eligibility precedes top-K; the semantic score table is not threshold-truncated; K-only semantic winners are hydrated on demand. Legacy weight settings do not affect this formula. Explicit Keyword/Semantic, multi-query aggregation and passage compatibility paths are not redesigned here. Truly missing vectors retain a zero-baseline compatibility behavior outside the validated offline quality conclusions. See the search architecture for formulas, fields and boundaries.

Initial vector-cache decoding now yields on an approximately 8 ms budget, preserving normalization arithmetic and concurrent publication checks, with no schema, dependency or disk-file additions. Production fusion matches 1,080 frozen cells; K50 matches 180 Q/L cells. In one isolated 57,523-chunk cache component comparison, the maximum timer gap fell from 1.725 s to 0.763 s while total loading changed from 5.808 s to 6.344 s. This does not establish lower full UI latency.

Additional real-window acceptance on 2026-09-10: the development proxy loaded this build against the existing Notes index and real cloud query embeddings. Mode switching, English short keywords, a Chinese research-relation query, full-title navigation, summary/note hover previews, opening a selected item and empty results were checked without blocking issues. This round does not cover Full PDF page navigation, HTTP transport or complete cold-start performance; the source strategy remains unchanged.

### 6.4 Queries and caching

- Two-character Chinese queries are valid (`src/utils/query-validation.ts`); single-character Chinese and overly short non-Chinese queries are still rejected.
- Search cache consistency: vector/lexical caches share a monotonic mutation generation with independent keyed single-flights to prevent duplicate cold builds; publishing re-checks generation / active model / store lifecycle. While indexing writes are ongoing, search may degrade safely rather than serve known-stale or mixed caches.
- Semantic searches scoped to a `library_key` reuse the pre-normalized vector cache and filter by library afterwards instead of re-decoding every time.

### 6.5 Performance work

Narrow-projection vector cache for the active model (base64 decoded straight into `Float32Array` and normalized in place), in-flight query-embedding sharing for identical model+query, and `metadata-identity-cache.ts` — a compact identity snapshot (stable identity + title + DOI + year + creators, never holding `Zotero.Item`, 32 MiB cap, conservatively invalidated whole-snapshot by the Notifier). Paper-level Full Hybrid now runs one scoped semantic pass (no Notes/PDF specialist split); `searchPartitions()` source specialists and their shared vector traversal remain for the `passages` compatibility path. Median hot-query latency on the real 150-paper Full corpus dropped from ~3.05s to ~1.33s; known cold-build and memory costs are recorded in the architecture document.

## 7. Embedding and Models [Shipped]

### 7.1 Model registry

- Default bundled model `multilingual-e5-base` (Q8, 768 dims, 512-token input limit, `query:` / `passage:` prefixes), switched from upstream's Nomic default at fork start for multilingual semantics.
- Three-model registry: `nomic-embed-text-v1.5` (optional download), `multilingual-e5-base` (default), `bge-m3` (optional download); upstream's MiniLM was removed from the registry and settings menu.
- Download interaction: selecting a missing model offers "download automatically (recommended) / download manually / cancel"; a `.part` file is written atomically and the active model does not switch until the download succeeds. Vectors are partitioned per `model_id`; switching or failing never deletes or mixes existing vectors.
- ChromeWorker crash recovery is single-flight: concurrent failed calls share one replacement Worker; late events from old instances are ignored by identity, and reset/destroy cancels unfinished initialization so an ended lifecycle cannot be revived.

### 7.2 Model input contracts and exact chunking

`src/core/model-input-config.ts` and `src/core/model-input-policy.ts` centralize each model's input contract: E5 recommended 420 / hard limit 512 tokens; Nomic and BGE-M3 recommended 2000 / hard limit 8192. E5 and BGE-M3 count Summary, Notes, per-page PDF and query inputs with their real tokenizers (including prefixes and special tokens), so Chinese is no longer underestimated by whitespace estimation. The former 8000-character pre-inference tail truncation is gone — over-long content is split losslessly during chunking. The policy version (`POLICY_VERSION`) is part of the index configuration fingerprint, so contract changes trigger reconciliation of old indexes through the fingerprint. Each registered model carries a `chunkProfile`; the recommended chunk size derives from `min(4000, floor(maxInputTokens × 0.85))` with a 25% soft floor.

### 7.3 Local Server slot

Self-hosted inference servers connect through a single fixed slot: the config file `<Zotero profile>/zotseek-server-models.json` (with a `schemaVersion` / `models` / `example` template; fields include `id` (`server:` prefix), `baseUrl` (loopback only), `serverModelName`, `dimensions`, `maxInputTokens`, `recommendedChunkTokens`, `queryPrefix`, `docPrefix`). The model menu presents the stable value `server-slot` with NONE / UNKNOWN / ready states; incomplete configs may be kept but semantic operations are gated; when ready, startup validates `GET /v1/models` and probes dimensions. Every normal embedding response revalidates complete unique indexes plus each vector's array shape, dimension, finite values, and non-zero content before storage.

### 7.4 Cloud embedding and BYOK

Cloud embeddings are bring-your-own-key (BYOK) with four providers:

| Provider | Model | Dims | Batch |
|---|---|---|---|
| Alibaba Bailian (native DashScope) | `qwen3.7-text-embedding` | 1024 | 20 |
| OpenAI | `text-embedding-3-small` / `-3-large` | 1536 / 3072 | 10 |
| Google Gemini API | `gemini-embedding-001` | 768 | 10 |
| Custom (OpenAI-compatible) | custom | self-reported | 1 |

Key points:

- Three adapters — `dashscope-embedding-adapter.ts`, `openai-embedding-adapter.ts`, `gemini-embedding-adapter.ts` — are driven by the generalized `cloud-embedding-client.ts`; Bailian uses native dense output with `parameters.text_type`, Gemini uses `batchEmbedContents` with `RETRIEVAL_QUERY` / `RETRIEVAL_DOCUMENT` task types.
- **Credential security**: API keys live in Zotero's Login Manager + OSKeyStore (`cloud-credential-store.ts`); plaintext fallback is refused on failure and the UI shows only first/last-five-character masking; HTTPS domain allowlist, redirects forbidden, bounded 429/5xx retries.
- **Versioned consent**: cost disclosure and consent versions are stored per provider; connection verification uses a document + query dual probe; error output is always sanitized.
- **Query/document API roles**: editable in advanced settings (defaults `query` / `document`, with a restore-Bailian-defaults action); changing a role invalidates connection verification and enters the index fingerprint (together with adapter version and output contract).
- Bailian region endpoint `zotseek.cloud.bailianRegion` (`cn` / `intl`); `cloudAutoIndex` defaults to off.
- A Cloud-only conservative multilingual token estimator (×1.3 per English word, ×2 per CJK character) feeds only the Cloud chunking budget; the estimator version is part of the Cloud strategy fingerprint.
- Custom `model_id` values also carry a short fingerprint of the normalized endpoint. The raw URL is not stored in the database, and identically named/equal-dimension models from different services remain in separate vector partitions.

## 8. Index Maintenance System [Shipped]

### 8.1 Index freshness and status column

`src/core/index-freshness.ts` maintains four fingerprints per parent item (config / metadata / note structure / note content), persisted in the `startup_fingerprints` table (schema v10). Zotero Notifier events only mark affected parents dirty (with a 300ms reconciliation backstop) and never trigger embeddings directly. The item-tree status column (`src/ui/item-tree-column.ts`) shows, in priority order: `⊘` excluded → blank not indexed → `↻` stale → `◐` truncated → `✓` fresh. Child-note add/edit/delete flips the parent from `✓` to `↻`.

### 8.2 Unified index operation entries

The preferences pane converged to three buttons whose semantics match the actual behavior:

- **Check and update index** (daily main operation): adds missing items, replaces items whose content or configuration changed, skips unchanged ones, and purges index identities that disappeared from Zotero; supports failure retry and resumable checkpoints.
- **Rebuild index** (destructive): clears first, then rebuilds the confirmed scope completely.
- **Clear index** (dangerous): deletes without rebuilding.

The "run incremental sync now" button was removed; at startup, a configuration-fingerprint mismatch raises a three-way "check and update / rebuild / cancel" prompt where cancel performs zero writes. Context-menu entries are limited to "check and update selected items / current collection" and reuse the same freshness fingerprints as startup reconciliation.

Every explicit index write/delete operation and startup/background reconciliation share one operation lease. While either side is active, the other exits before reading candidates or clearing a partition and reports the busy state. A rebuild retains the lease from coverage discovery through its final batch, preventing reconciliation from observing or advancing a partition between clear and completion.

Full extraction and incremental Note replacement share the same Summary → at most 30 Notes → remaining PDF-slot allocator. A Note change on an already truncated Full item forces a whole-item rebuild with fresh PDF extraction so quota allocation, page coverage, and `wasTruncated` can converge again.

### 8.3 Index task pause and resume

Long-running indexing progress windows offer a localized "pause indexing" button (injected by resolving the native window through `ItemProgress` internals), with the state machine `running → pausing → paused`. Pausing preserves the original pending scope (personal library / collections / selected items, keyed by `libraryKey + itemKey`); unfinished papers are never partially replaced; the next startup asks whether to continue. Cancel and pause can both short-circuit at the coordination layer.

### 8.4 Exclusion rules and index cleanup

Index identities **already indexed** that come to match `excludeTag` / `excludeBooks` are cleaned up transactionally, within the explicit scope, on the next check (all model partitions' chunks, `item_models`, and startup fingerprints for the item); a single-item failure keeps the complete old index and is counted for retry. Un-excluding makes the item a missing entry that gets re-indexed on the next check. The status column shows `⊘` for both exclusion kinds.

### 8.5 Configuration fingerprints and selective recompute

`config_fingerprint` is a versioned structured JSON snapshot (fingerprint format version / index contract version / mode / maxChunksPerPaper / chunk strategy version / model input policy fingerprint), no longer an irreversible hash. When `maxChunksPerPaper` is raised, only if it is provable that this was the sole change are previously `was_truncated=1` papers recomputed as whole groups; all other papers only advance their fingerprint. Lowering the cap still recomputes fully under the new quota.

## 9. Database and Stable Identity [Shipped]

- The index lives in a **separate `zotseek.sqlite`** (not the Zotero main database), ATTACHed and remounted across Zotero reconnects.
- **Stable item identity is `libraryKey + itemKey`**, threading through deletion cleanup, fingerprints, incremental reconciliation, MCP reads and deep links; local Zotero item IDs are never used as cross-library stable identity. user / group / orphan records are handled distinctly.
- Schema nodes introduced by the fork: **v10** `startup_fingerprints` (freshness fingerprints), **v11** `section_paths` (note section paths), **v12** `chunks.pdf_attachment_key` (exact Full-mode PDF provenance, nullable; existing rows are never assigned a guessed source).
- One model partition per paper (`chunks.model_id` composite key + `item_models`); model switching and failures never mix vectors.
- Incremental freshness reads `item_models.content_hash` for the active model. `items.content_hash` remains only as a legacy-schema/migration compatibility field and cannot describe whether another model partition is current.
- Startup cross-checks schema metadata against the physical tables. If an historical build marked a v3 layout with `embeddings`, or a pre-v8 `items` table without `library_key`, as a newer version, startup lowers the replay point to the verified v3/v6/v7 boundary and reruns the existing idempotent migrations; v8/v9 still back up the database before destructive migration. Current layouts are never downgraded by this recovery path.
- The "storage usage" figure in preferences is the database file's physical size: after `DELETE`, pages go to the freelist instead of returning to disk immediately; only "compact database" (`VACUUM INTO`) actually shrinks the file. This is by design, not residue.

## 10. MCP/REST Extensions [Shipped]

MCP tool descriptions add general evidence-assessment reminders: retain the user's research objects, relationships and material constraints when judging results; verify passages supporting key claims before near-duplicate queries; distinguish direct source claims, studies reported by a review, and the agent's own inference; and do not guess missing or conflicting bibliographic details. These reminders add no parameters and do not implement an automatic research workflow inside the tools.

Explicit Keyword now adopts the K50 selected in REPORT66: the top 50 Quick and BM25 results are combined by equal RRF (k=10); BM25 sources follow indexing mode and eligibility precedes top-K. No semantic model is called. UI and MCP/REST share this path: API `score` is raw Q/L RRF, whereas UI percentages are relative scores normalized to the query's best result. Paper Hybrid's formula is unchanged.

MCP parameter documentation alignment on 2026-09-10: `search` defaults to `hybrid` / `papers` / 10 results and accepts at most 100. MCP uses a fixed semantic candidate threshold of 0 and does not expose `min_similarity`; older clients that send it are ignored. The UI keeps its existing similarity preference, while REST retains its separate `minSimilarity` parameter and preference-based default. MCP/REST results retain the final `score` and add raw `semanticScore` and unnormalized `bm25Score`, using `null` when a channel was not computed or produced no match; Keyword does not run semantic retrieval merely to fill the field. `get_item` PDF output is parsed plain text and may contain Greek-character, mathematical-symbol, subscript/superscript, column-order or table errors; the guidance tells agents to verify important evidence. See MCP.md. Restart Zotero to load the new build and refresh client tool definitions.

On top of upstream's `search` / `find_similar` / `index_status` (full usage in [MCP.md](MCP.md)):

- **`get_item` tool**: reads normalized bibliography, tags, collections, relatedItems and attachment lists by `library_key + item_key`; `include_notes: true` returns all child notes' complete unfiltered text (the index-side "basic information"/References exclusion rules are not applied) plus live `sections` / `sectionPaths`; `include_pdf: "pages" | "full"` supports a chosen attachment, with ≤20 consecutive pages per explicit range, while `full` uses batches of ≤20 pages and returns a leading prefix of at most 100 pages or about 300,000 characters. Limited results expose `partial`, `limitReason`, and `nextPage` under the same MCP/REST contract; reads prefer Zotero's full-text cache and use batched `PDFWorker` fallback for missing pages without claiming that Zotero's underlying queue can be cancelled. Local file paths are never exposed. REST equivalent: `GET /zotseek/item`.
- **Structured post-filtering on `search`**: an optional `filter` (`year_from` / `year_to` / `journal` / `author` + an `exact` master switch) applies to the window already ranked into `max_results`, never reordering and never hidden-overfetching; REST exposes `yearFrom` / `yearTo` / `journal` / `author` / `exact`.
- **Exact PDF back-linking**: `matchedChunk.pdfAttachmentKey` threads through end to end so deep links open the exact attachment that produced the hit instead of a heuristic pick.
- The MCP authorization copy was updated to "allow local AI agents read-only search and access to items, notes and PDFs", synced across all 10 locales.

## 11. Localization [Shipped]

- **10 registered locales**: `en-US`, `zh-CN`, `zh-TW`, `ja-JP`, `ko-KR`, `de`, `fr-FR`, `es-ES`, `ru-RU`, `th-TH`; each ships a main Fluent file, a menu Fluent file, and DTD resources.
- The plugin follows Zotero's application locale and keeps no separate language preference; `en-US` is the canonical resource and final fallback.
- `npm run check:locales` (`scripts/check-locales.js`) validates each registered locale's required files, Fluent messages / attributes / `$variable` placeholders, DTD entities and bootstrap registration consistency, and is wired into the build as fail-fast — missing keys or placeholder drift fail the build instead of surfacing as raw message IDs in the UI.
- Localization boundary: language packs only translate at the display layer; the database, preferences, business logic and cross-module APIs use only stable machine values such as `abstract`, `notes`, `full`, `ok`, `partial`; display text never participates in business decisions.

## 12. Preferences UI [Shipped]

- Visual and information-architecture cleanup: embedding/token/chunk settings no longer live under the Search area; "max tokens per chunk / max chunks per paper" moved into "Chunking and model input" at the end of the Models group; model-input-policy hints show only "hard limit / recommended value"; spacing across stats, operations and maintenance sections was unified; all copy is synced across the 10 locales.
- Numeric settings reject blank, fractional, and out-of-range input at commit time with native visible validation; core readers also normalize historical or externally written preferences. `maxChunksPerPaper` is 1–200 (default 100), result count is 5–100 (default 20), and similarity percentage is 0–100 (default 70); invalid `maxTokens` falls back to the active model recommendation. Index runtime and configuration fingerprints reuse the same normalized value so freshness cannot describe a different quota than extraction used.
- Search settings gained a "default search mode" dropdown (Semantic / Keyword / Hybrid, default `hybrid`, reusing the existing preference key); dropdown width tuned to avoid Chinese truncation.
- An already-open VTable search window receives a new initial query and `excludeItemId` through its controller instead of a stale hard-coded input ID. Reusing the window for “Find Related” therefore refreshes the query and still excludes the source item.
- The About section links to this fork's repository, `https://github.com/Einheriar/ZotSeek-U`.
- Legacy `alert` prompts such as chunk-strategy-upgrade notices became cancellable `confirm` dialogs (closing triggers no rebuild).
- Known non-blocking UI issue: multiple bottom-right notification windows can overlap; assessed and accepted as-is.

## 13. LLM Literature Briefs

### 13.1 Implemented core modules [Shipped (module level)]

The brief feature's server-side core, settings/item entry points, and Plan 57 P7 guidance loop are in source and default off; real-Zotero end-to-end and paid-generation acceptance across providers are not complete yet:

- The provider follows the last Cloud provider saved in preferences and reuses that provider's protected credential and endpoint. When Embedding currently uses the local or loopback-server runtime, briefs still use the last saved Cloud provider.
- The generation model is independent from the Embedding model and saved per provider. Preferences retain one free-text field with model-discovery suggestions for the active provider; Bailian/Gemini suggestions carry capability metadata, while OpenAI/Custom suggestions are marked as requiring confirmation by the connection test.
- Bailian and Custom use Chat Completions, OpenAI uses the Responses API, and Gemini uses native `generateContent`; connection verification, fingerprints, and credential revisions are isolated per provider. Paper disclosure no longer reuses persistent consent: every generation operation requires a fresh confirmation.
- A title/abstract forced-choice classifier distinguishes `review` / `standard` papers (stable machine values; ambiguous samples default to `standard`) with its own call budget.
- Scheduler: single-paper manual tasks run FIFO with concurrency 1; collection tasks run in batches of three papers with intra-batch parallelism; the two modes are mutually exclusive.
- Prompt store: bundled "standard paper" and "review" templates (`prompts/standard-article-brief.md`, `prompts/review-article-brief.md`) with atomic override import into the profile directory (UTF-8 / 256KiB validation).
- Brief notes carry source provenance as HTML comments.

### 13.2 In-progress closed-loop design [In progress]

Single-paper runtime acceptance update: Bailian successfully generated and saved one Chinese brief with readable H1, sections, and provenance. Plan 70A fixes the Markdown renderer treating scientific text between a less-than sign and a later greater-than sign as raw HTML. It now strips only syntactically recognizable raw HTML tags while preserving and escaping comparisons in prose and inline code. Offline regressions cover the fix; real-Zotero generated-content fidelity still needs re-validation.

Brief setting updates complete pure validation before cancelling queued or active generation work. Invalid input reports an error and leaves existing tasks intact; only a successful commit cancels work bound to the old settings and invalidates the corresponding verification.

Generation entry points now use transaction-scoped informed confirmation: every single-paper action confirms once, while one collection batch receives one aggregate confirmation; classifier, layered, merge, and retry calls do not open additional dialogs. Before confirmation ZotSeek only extracts PDFs locally and uses the existing character-count / 3 estimator to show approximate input tokens, the per-request output ceiling, and the expected minimum call count. It does not create a provider client or send a model request. Preparation is bound to the provider, configuration, credential revision, endpoint, and both prompt hashes; any queued-time change fails before disclosure and requires a new preparation and confirmation. The preferences connection test and wizard checkbox authorize only the narrow fixed-test/template-customization disclosure and no longer write paper consent. The experimental public `recordBriefConsent()` writer is removed; `getBriefStatus().consentCurrent` remains only as a deprecated compatibility status and cannot suppress confirmation.

Every actual HTTP attempt enters an in-memory usage ledger. Provider `usage` from classification, direct generation, segment summaries, merges, final generation, and retries is aggregated into the single-paper or collection result as input, output, reasoning, and total tokens; reasoning is shown separately without being added twice. When a successful response omits usage, or a timeout/rejection/disconnect returns no usable total, the report keeps known totals and states the number of unreported requests, that the figures are incomplete, and that they are not the final bill. Failures, cancellations, and the model's garbled-source exit retain usage already incurred and reported.

Connection retest on 2026-09-11: task cancellation now shares the request client's constructor resolver, falling back to the Zotero main window when the plugin global lacks `AbortController`. The enabled switch reads and writes the same absolute preference path. Real read-only self-tests passed 4/4 and the Bailian fixed-text connection probe succeeded. Verification survived restart; the single-item menu and bundled-template branch worked. No paper was sent and no note was generated, so this does not complete end-to-end acceptance.

Real-Zotero fixes on 2026-09-11: the controller sets the wizard title, XUL status uses one attribute, the checkbox uses `.label`, and button label updates preserve native internal elements. The webpage `<datalist>` AutoComplete actor does not match Zotero chrome windows. The shared `brief-model-autocomplete.ts` now uses native `autocomplete-input` with an isolated search registration, released on window unload. Display labels preserve exact model IDs, while free-input blur and candidate completion both commit changes. After a cache-cleared restart, Bailian suggestions appeared in preferences and the wizard; preferences mouse selection and free-input persistence passed, and wizard buttons/status text were restored. Full wizard, cross-provider, and paid-generation acceptance remain incomplete.

The full generation loop below is implemented; its real-Zotero end-to-end and paid-generation acceptance are not complete yet:

- A "Briefs" collapsible section after "Search" in the preferences pane with a master switch (`zotseek.brief.enabled`, default off).
- Turning the master switch on opens a stepped wizard immediately. Closing it sends no request and does not complete setup, so the next actual brief action opens it again. Users can explicitly keep the bundled pair, which targets psychology, developmental psychology, and cognitive neuroscience, or answer exactly three questions (field, output language, optional special focus) so the LLM performs a constrained rewrite of those templates. The wizard never shows full prompts or reads the library.
- Setup becomes usable only after an explicit bundled-template choice or a complete customized/imported pair. Advanced import replaces one slot while preserving the other; generated files still use non-overwriting download names and are activated as a controlled pair in the profile.
- An invalid setup version/choice or damaged active prompt record is surfaced as needing repair rather than silently treated as ready; explicitly restoring the bundled pair or generating a new pair repairs the state.
- Entry points: single item / direct PDF / collection; generation always creates a new child note. The program injects the H1 title “简报”; the model is instructed to use only H2–H4 in the body, with no extra program-side heading validator.
- PDFs need at least 100 non-whitespace Unicode characters after cleanup or are skipped as `insufficient_text`. Above that threshold, the model may report strict `source_unusable/garbled_text`; the runner then exits without writing a note. Collection items that already have child notes are still skipped.
- Full-lifecycle cancellation context, connection-verification staleness fixes (credential revision), protocol-error and malformed-response handling, and sanitized errors.

## 14. Engineering and Development Workflow

### 14.1 Tests and validation

- `npm test`: Node's built-in test runner over 50+ test files in `test/`, using `helpers/zotero-stub.ts` to stub the Zotero API; covers chunker, model registry / input config / input policy, worker input preparation, collection resolution, mode-transition reuse, Cloud contracts and other pure-logic modules.
- The paper-level Hybrid fusion contract (candidate union, eligibility before top-K, K50 ranks, bounded bonus, stable identity, missing vectors, snippet location and cache-invalidation concurrency) is covered by Node unit tests (`hybrid-bounded-runtime.test.ts`, `hybrid-search-policy.test.ts`, `search-policy.test.ts`, `lexical-search.test.ts`, `mcp-search-contract.test.ts`); mocked embeddings and items still cannot judge retrieval quality, which remains the eval framework's job (that framework is not yet in the repository — a known gap).
- `npm run typecheck`: checks both `src/` and `test/` via `tsconfig.test.json`, with `scripts/typecheck-baseline.json` guarding known baselines against regressions.
- `npm run check:versions` validates version consistency across `package.json` / `manifest.json` / `update.json`; CI runs only that check.
- `src/dev/suites/` is the self-test harness that needs a real Zotero (27 MCP scenarios, model loading, database integrity, etc.) and cannot be replaced by Node mocks.

### 14.2 Real-Zotero development proxy

Daily development does not build an XPI; an extension proxy loads `ZotSeek/build/` directly:

1. Quit Zotero completely → `npm run build`;
2. Point `ZOTERO_PROFILE` at the real profile and run `npm run dev:install` (first time or when switching profiles; it removes the installed XPI with the same ID and regenerable startup caches);
3. `npm run dev:status` must report `Dev mode active`.

After that, each cycle is: edit sources → `npm run build` → quit Zotero completely → relaunch with `-purgecaches -ZoteroDebugText -jsconsole`, **without** repeating `dev:install`. On Windows launch with `& 'C:\Program Files\Zotero\zotero.exe' -purgecaches -ZoteroDebugText -jsconsole` (the `start:zotero` script in `package.json` is a macOS command). The startup log line `Loaded from unpackaged directory (dev proxy file)` confirms the proxy; if Zotero marks ZotSeek as disabled in its add-on manager, simply re-enable it.

### 14.3 Evaluation assets (local workspace, not distributed with the repository)

- The fixed test corpus is the real Zotero `10_Hyperscanning` collection (150 papers) with two 50-question benchmarks (Metadata + Notes, and Full Text); pre-development baselines and restore instructions live under the workspace's `output/` directory.
- Reusable runners exist for Cloud chunk-size ablations (`tokenizer/eval/plan54/`, with dry-run, usage ledger and deterministic replay constraints); Chinese tokenization research assets (pkuseg-js fixes and performance work, jieba-wasm evaluation) live in the separate `tokenizer/` directory and never entered the plugin — production BM25 uses only the zero-dependency T0.

## 15. Release and Versioning Strategy

- The fork keeps its own version sequence: since the 2026-09-06 ZotSeek-U rebrand it is reset to `0.1.0`, clearly distinct from upstream `1.19.x` / `1.20.x`; three-way consistency across `package.json` / `manifest.json` / `update.json` is guarded by `check:versions`.
- Embedding model weights are not committed to Git (the E5 ONNX is ~266MB and `.gitignore`d); release XPIs on GitHub must bundle the default model weights; daily development always uses the dev proxy, and XPIs are only for testing packaging or releases.
- No standing promise to track upstream; upstream integrations are evaluated case by case (most recently v1.20.0).
- `bootstrap.js` disabling background auto-update is a fork self-protection measure — do not remove it without an explicit reason.

## 16. Documentation Conventions

- This document (`DEVELOPMENT_U_EN.md`, with `DEVELOPMENT_U_CN.md` as the source of truth) records the fork's added features, designs and workflow: once a feature ships, it enters the relevant section marked [Shipped]; approved-but-unfinished designs go into "In progress" subsections with their status; experimental research lines that never shipped are not expanded here.
- Runtime behavior of search, chunking and indexing modes is governed by [SEARCH_ARCHITECTURE_EN.md](SEARCH_ARCHITECTURE_EN.md); MCP/REST usage by [MCP.md](MCP.md); upstream history by the frozen [DEVELOPMENT.md](DEVELOPMENT.md). When documents conflict, code and tests win and the documents get fixed.
- Changes touching indexing, search, models, maintenance or UI behavior must check the corresponding modules and tests per the workspace collaboration rules, and update the relevant section here.
- Changes to modes, states or enums must preserve the stable machine-value boundary: machine values go into the database / preferences / logic, language packs only translate the display layer; when an API needs both, it returns the machine value and a `*Label` field separately.

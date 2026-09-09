# ZotSeek-U Development Guide (DEVELOPMENT_U_EN)

> **About this document:** This is the English counterpart of `DEVELOPMENT_U_CN.md`. It records the features, architecture and development workflow that **ZotSeek-U** adds on top of upstream [ZotSeek](https://github.com/introfini/ZotSeek), and is the fork's primary development document, maintained with the repository. Documentation baseline: `0.1.0` (2026-09-06). The Chinese version (`DEVELOPMENT_U_CN.md`) is the source of truth; when the two diverge, it wins and this file must be brought back in sync.
>
> Companion reading: the upstream development journal (pre-fork, single-model Nomic era, frozen for historical reference, no longer maintained) is [DEVELOPMENT.md](DEVELOPMENT.md); runtime details of search, chunking and indexing modes live in [SEARCH_ARCHITECTURE_EN.md](SEARCH_ARCHITECTURE_EN.md); MCP/REST usage is documented in [MCP.md](MCP.md).
>
> Status markers: **[Shipped]** = in production code and accepted; **[In progress]** = approved, partially implemented or awaiting runtime acceptance. Finer-grained experiment data and per-item acceptance records live in the maintainer's local workspace and are not distributed with this repository.

## Plan 62: BM25 snapshots (in progress)

2026-09-09: JSON snapshot foundations, transactional corpus revisions and cooperative construction are implemented. Chunk-writing transactions increment the revision; ordinary writes retain the session BM25 index, while clear/model deletion/close/reattach invalidate memory. Snapshots match database identity, revision, model and algorithm contracts and verify SHA-256. Corruption or IO failure falls back to rebuilding without affecting the database. Startup/manual scheduling, missing-item presentation and Zotero runtime acceptance remain in progress. A software version change alone does not invalidate snapshots.

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
| `abstract` | after identity navigation, semantic-only for regular content |
| `notes` | after identity navigation, R1 semantic + T0 BM25 with fixed RRF fusion (H1) |
| `full` | after identity navigation, top two from the Notes channel + PDF semantic results deduplicated to fill the remaining eight, backfilled from Notes when PDF is short |

UI / MCP / REST share the same strategy routing (`src/core/search-policy.ts`). Semantic MaxSim and BM25 lexical sides are source-isolated (the Notes side does not ingest PDF term frequencies; the PDF side is not crowded out by Note chunks). A query-analysis-driven automatic weighting heuristic from upstream is retained.

### 6.4 Queries and caching

- Two-character Chinese queries are valid (`src/utils/query-validation.ts`); single-character Chinese and overly short non-Chinese queries are still rejected.
- Search cache consistency: vector/lexical caches share a monotonic mutation generation with independent keyed single-flights to prevent duplicate cold builds; publishing re-checks generation / active model / store lifecycle. While indexing writes are ongoing, search may degrade safely rather than serve known-stale or mixed caches.
- Semantic searches scoped to a `library_key` reuse the pre-normalized vector cache and filter by library afterwards instead of re-decoding every time.

### 6.5 Performance work

Narrow-projection vector cache for the active model (base64 decoded straight into `Float32Array` and normalized in place), in-flight query-embedding sharing for identical model+query, a single shared vector pass for the two semantic specialists in Full mode, and `metadata-identity-cache.ts` — a compact identity snapshot (stable identity + title + DOI + year + creators, never holding `Zotero.Item`, 32 MiB cap, conservatively invalidated whole-snapshot by the Notifier). Median hot-query latency on the real 150-paper Full corpus dropped from ~3.05s to ~1.33s; known cold-build and memory costs are recorded in the architecture document.

## 7. Embedding and Models [Shipped]

### 7.1 Model registry

- Default bundled model `multilingual-e5-base` (Q8, 768 dims, 512-token input limit, `query:` / `passage:` prefixes), switched from upstream's Nomic default at fork start for multilingual semantics.
- Three-model registry: `nomic-embed-text-v1.5` (optional download), `multilingual-e5-base` (default), `bge-m3` (optional download); upstream's MiniLM was removed from the registry and settings menu.
- Download interaction: selecting a missing model offers "download automatically (recommended) / download manually / cancel"; a `.part` file is written atomically and the active model does not switch until the download succeeds. Vectors are partitioned per `model_id`; switching or failing never deletes or mixes existing vectors.

### 7.2 Model input contracts and exact chunking

`src/core/model-input-config.ts` and `src/core/model-input-policy.ts` centralize each model's input contract: E5 recommended 420 / hard limit 512 tokens; Nomic and BGE-M3 recommended 2000 / hard limit 8192. E5 and BGE-M3 count Summary, Notes, per-page PDF and query inputs with their real tokenizers (including prefixes and special tokens), so Chinese is no longer underestimated by whitespace estimation. The former 8000-character pre-inference tail truncation is gone — over-long content is split losslessly during chunking. The policy version (`POLICY_VERSION`) is part of the index configuration fingerprint, so contract changes trigger reconciliation of old indexes through the fingerprint. Each registered model carries a `chunkProfile`; the recommended chunk size derives from `min(4000, floor(maxInputTokens × 0.85))` with a 25% soft floor.

### 7.3 Local Server slot

Self-hosted inference servers connect through a single fixed slot: the config file `<Zotero profile>/zotseek-server-models.json` (with a `schemaVersion` / `models` / `example` template; fields include `id` (`server:` prefix), `baseUrl` (loopback only), `serverModelName`, `dimensions`, `maxInputTokens`, `recommendedChunkTokens`, `queryPrefix`, `docPrefix`). The model menu presents the stable value `server-slot` with NONE / UNKNOWN / ready states; incomplete configs may be kept but semantic operations are gated; when ready, startup validates `GET /v1/models` and probes dimensions.

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

## 8. Index Maintenance System [Shipped]

### 8.1 Index freshness and status column

`src/core/index-freshness.ts` maintains four fingerprints per parent item (config / metadata / note structure / note content), persisted in the `startup_fingerprints` table (schema v10). Zotero Notifier events only mark affected parents dirty (with a 300ms reconciliation backstop) and never trigger embeddings directly. The item-tree status column (`src/ui/item-tree-column.ts`) shows, in priority order: `⊘` excluded → blank not indexed → `↻` stale → `◐` truncated → `✓` fresh. Child-note add/edit/delete flips the parent from `✓` to `↻`.

### 8.2 Unified index operation entries

The preferences pane converged to three buttons whose semantics match the actual behavior:

- **Check and update index** (daily main operation): adds missing items, replaces items whose content or configuration changed, skips unchanged ones, and purges index identities that disappeared from Zotero; supports failure retry and resumable checkpoints.
- **Rebuild index** (destructive): clears first, then rebuilds the confirmed scope completely.
- **Clear index** (dangerous): deletes without rebuilding.

The "run incremental sync now" button was removed; at startup, a configuration-fingerprint mismatch raises a three-way "check and update / rebuild / cancel" prompt where cancel performs zero writes. Context-menu entries are limited to "check and update selected items / current collection" and reuse the same freshness fingerprints as startup reconciliation.

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
- The "storage usage" figure in preferences is the database file's physical size: after `DELETE`, pages go to the freelist instead of returning to disk immediately; only "compact database" (`VACUUM INTO`) actually shrinks the file. This is by design, not residue.

## 10. MCP/REST Extensions [Shipped]

On top of upstream's `search` / `find_similar` / `index_status` (full usage in [MCP.md](MCP.md)):

- **`get_item` tool**: reads normalized bibliography, tags, collections, relatedItems and attachment lists by `library_key + item_key`; `include_notes: true` returns all child notes' complete unfiltered text (the index-side "basic information"/References exclusion rules are not applied) plus live `sections` / `sectionPaths`; `include_pdf: "pages" | "full"` supports a chosen attachment and ≤20 consecutive pages, reading from Zotero's full-text cache first with a batched `PDFWorker` fallback for missing pages; `pdf.status` uses the machine values `ok / partial / missing / unresolved / empty / failed`; local file paths are never exposed. REST equivalent: `GET /zotseek/item`.
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
- Search settings gained a "default search mode" dropdown (Semantic / Keyword / Hybrid, default `hybrid`, reusing the existing preference key); dropdown width tuned to avoid Chinese truncation.
- The About section links to this fork's repository, `https://github.com/Einheriar/ZotSeek-U`.
- Legacy `alert` prompts such as chunk-strategy-upgrade notices became cancellable `confirm` dialogs (closing triggers no rebuild).
- Known non-blocking UI issue: multiple bottom-right notification windows can overlap; assessed and accepted as-is.

## 13. LLM Literature Briefs

### 13.1 Implemented core modules [Shipped (module level)]

The brief feature's server-side core is in the source tree, but the end-to-end entry points are not open yet:

- The model is pinned to Bailian `deepseek-v4-flash-0731` (OpenAI-compatible endpoint, thinking mode on, `max_completion_tokens` with a default 16384 output budget).
- A title/abstract forced-choice classifier distinguishes `review` / `standard` papers (stable machine values; ambiguous samples default to `standard`) with its own call budget.
- Scheduler: single-paper manual tasks run FIFO with concurrency 1; collection tasks run in batches of three papers with intra-batch parallelism; the two modes are mutually exclusive.
- Prompt store: bundled "standard paper" and "review" templates (`prompts/standard-article-brief.md`, `prompts/review-article-brief.md`) with atomic override import into the profile directory (UTF-8 / 256KiB validation).
- Brief notes carry source provenance as HTML comments.
- Briefs support the Bailian provider only; switching away confirms and clears the brief connection-verification state (`zotseek.cloud.brief.connectionVerified`).

### 13.2 In-progress closed-loop design [In progress]

The approved full generation loop is being implemented (parts such as `brief-source-builder` / `brief-generation-runner` / `brief-note-writer` and the settings entries have landed; the end-to-end loop and runtime acceptance are not complete):

- A "Briefs" collapsible section after "Search" in the preferences pane with a master switch (`zotseek.brief.enabled`, default off).
- A dedicated wizard dialog collects domain / output language and lets the LLM rewrite personal prompts from the bundled templates; the default templates are downloaded automatically and a controlled paired copy is enabled; advanced users may edit and import.
- Entry points: single item / direct PDF / collection; generation always creates a new child note; PDFs need at least 100 non-whitespace Unicode characters after cleanup or are skipped as `insufficient_text`; items in a collection that already have child notes are skipped.
- Full-lifecycle cancellation context, connection-verification staleness fixes (credential revision), protocol-error and malformed-response handling, and sanitized errors.

## 14. Engineering and Development Workflow

### 14.1 Tests and validation

- `npm test`: Node's built-in test runner over 50+ test files in `test/`, using `helpers/zotero-stub.ts` to stub the Zotero API; covers chunker, model registry / input config / input policy, worker input preparation, collection resolution, mode-transition reuse, Cloud contracts and other pure-logic modules.
- The search engine and hybrid search are **deliberately not unit tested**: mocked embeddings and items only produce tests that always pass; retrieval quality is the eval framework's job (that framework is not yet in the repository — a known gap).
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

- The fork keeps its own version sequence (`1.19.55x` / `1.20.55x`) to stay distinguishable from upstream; three-way version consistency is guarded by `check:versions`.
- Embedding model weights are not committed to Git (the E5 ONNX is ~266MB and `.gitignore`d); release XPIs on GitHub must bundle the default model weights; daily development always uses the dev proxy, and XPIs are only for testing packaging or releases.
- No standing promise to track upstream; upstream integrations are evaluated case by case (most recently v1.20.0).
- `bootstrap.js` disabling background auto-update is a fork self-protection measure — do not remove it without an explicit reason.

## 16. Documentation Conventions

- This document (`DEVELOPMENT_U_EN.md`, with `DEVELOPMENT_U_CN.md` as the source of truth) records the fork's added features, designs and workflow: once a feature ships, it enters the relevant section marked [Shipped]; approved-but-unfinished designs go into "In progress" subsections with their status; experimental research lines that never shipped are not expanded here.
- Runtime behavior of search, chunking and indexing modes is governed by [SEARCH_ARCHITECTURE_EN.md](SEARCH_ARCHITECTURE_EN.md); MCP/REST usage by [MCP.md](MCP.md); upstream history by the frozen [DEVELOPMENT.md](DEVELOPMENT.md). When documents conflict, code and tests win and the documents get fixed.
- Changes touching indexing, search, models, maintenance or UI behavior must check the corresponding modules and tests per the workspace collaboration rules, and update the relevant section here.
- Changes to modes, states or enums must preserve the stable machine-value boundary: machine values go into the database / preferences / logic, language packs only translate the display layer; when an API needs both, it returns the machine value and a `*Label` field separately.

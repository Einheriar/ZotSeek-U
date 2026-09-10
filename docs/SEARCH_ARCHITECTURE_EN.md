# Search Architecture

> **Note (ZotSeek-U fork):** This is the English counterpart of the fork's search/chunking architecture documentation. The Chinese version ([SEARCH_ARCHITECTURE_CN.md](SEARCH_ARCHITECTURE_CN.md)) is the source of truth; keep the two in sync when search or indexing behavior changes. ASCII diagrams and code blocks are intentionally identical in both versions.

A comprehensive guide to how semantic and hybrid search works in ZotSeek.

---

## Plan 62 implementation status (2026-09-09)

For the 2026-09-10 branch prototype, “Current paper-level Hybrid” is authoritative. Historical diagrams and old S/K RRF examples do not describe the current paper default.

Plan 62 prepares BM25 after startup maintenance and through Check and update index. Searches wait for shared preparation. Matching snapshots load; misses release old memory before rebuilding, without dual versions. Ordinary additions, edits and deletions may retain session-stale content. Missing items return item_not_found, localized at the UI boundary. Vector and identity caches still invalidate immediately.

## Table of Contents

1. [Overview](#overview)
2. [Search Modes](#search-modes)
3. [Search Approach](#search-approach)
4. [Hybrid Search with RRF](#hybrid-search-with-rrf)
5. [Multi-Query Search](#multi-query-search)
6. [Semantic Search Pipeline](#semantic-search-pipeline)
7. [BM25 Pipeline](#bm25-pipeline)
8. [Chunking Strategy](#chunking-strategy)
   - [Model-aware maxTokens](#model-aware-maxtokens)
   - [Structured Child Note Chunking](#structured-child-note-chunking)
   - [PDF Main-Text Preprocessing](#pdf-main-text-preprocessing)
   - [Incremental Indexing-Mode Transitions](#incremental-indexing-mode-transitions)
   - [Truncation Detection (Max Chunks per Paper)](#truncation-detection-max-chunks-per-paper)
9. [Section-Aware Chunking](#section-aware-chunking)
   - [References Filtering](#references-filtering)
10. [Performance Optimizations](#performance-optimizations)
11. [Embedding Model Registry](#embedding-model-registry)
    - [Local-Server-Backed Embeddings](#local-server-backed-embeddings)
    - [Cloud Embeddings](#cloud-embeddings)
12. [Database Schema](#database-schema)
    - [Child Note Paths (Schema v11)](#child-note-paths-schema-v11)
    - [Exact PDF Source (Schema v12)](#exact-pdf-source-schema-v12)
13. [Query Analysis](#query-analysis)
14. [Configuration](#configuration)
15. [Summary](#summary)


---

## Overview

The current branch has two layers. The indexing mode determines which content is searchable; the search mode determines which retrieval channels run. Paper-level Hybrid is the default: it tries identity navigation first, then runs semantic and keyword retrieval in parallel and applies a fixed bounded lexical bonus. All three indexing modes share one paper-level formula, and Full no longer reserves Notes or PDF slots.

UI, MCP and REST reuse the same search engine and paper-level ranking. Their entry parameter boundaries are independent: the UI keeps its existing similarity preference; MCP `search` uses a fixed semantic candidate threshold of 0 and does not expose `min_similarity` (an older client-supplied field is ignored); REST keeps its existing `minSimilarity` parameter and preference-based default. MCP/REST results expose the final `score`, raw `semanticScore` and raw unnormalized `bm25Score`; a value is `null` when that channel was not computed or produced no match.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  SEARCH ARCHITECTURE OVERVIEW (ZotSeek-U)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                 USER QUERY                                  │
│                                      │                                      │
│                                      ▼                                      │
│          ┌──────────────────────────────────────────────┐                   │
│          │IDENTITY NAVIGATION (Hybrid only)              │                   │
│          │DOI / exact title / distinctive title fragment │                   │
│          │author navigation                              │                   │
│          └──────────────────────────────────────────────┘                   │
│                                      │ no identity hit                      │
│                                      ▼                                      │
│       ┌──────────────────────┐       ┌──────────────────────────────┐       │
│       │ SEMANTIC             │       │ KEYWORD                      │       │
│       │ scoped vector scan   │       │ Zotero Quick Search + BM25   │       │
│       │ MaxSim → S50         │       │ Q50 + L50 → K50 (RRF k=10)   │       │
│       └──────────┬───────────┘       └──────────────┬───────────────┘       │
│                  └───────────────┬─────────────────┘                        │
│                                  ▼                                          │
│             S50 ∪ K50 → semantic score + bounded lexical bonus             │
│                         → stable paper ranking                             │
│                                                                             │
│Index modes: abstract = metadata; notes = metadata + Child Notes;            │
│full = metadata + Child Notes + PDF.                                         │
│T0 BM25: Intl.Segmenter(zh-Hans) natural terms + CJK bigrams;                │
│BM25 (k1=1.2, b=0.75), zero third-party dependencies                         │
│                                                                             │
│User-facing modes: Semantic / Keyword / Hybrid (default).                    │
│Keyword = Quick Search + BM25; Semantic = vector search;                    │
│Hybrid = identity navigation + both channels.                                │
│Paper ranking is shared by UI, MCP and REST.                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```


---

## Search Modes

### 🔗 Hybrid (Recommended)

Hybrid is the product-default entry point.

Identity navigation runs only in Hybrid: an exact DOI, full title, sufficiently distinctive title fragment or author navigation returns Zotero-gated results directly; an ambiguous fragment declines navigation and enters content retrieval. Content retrieval runs semantic and keyword channels together. Semantic retrieval performs MaxSim over the range allowed by the current indexing mode. The keyword channel merges Zotero Quick Search with local BM25. Each channel contributes one representative hit per paper, followed by one paper-level ranking. Full does not split Notes/PDF candidates or reserve source slots.

The content strategy selected by indexing mode:

| Indexing mode | Default content strategy |
|---------------|--------------------------|
| `abstract` | abstract-scoped S50 ∪ K50 with bounded bonus |
| `notes` | Metadata + Notes S50 ∪ K50 with bounded bonus |
| `full` | all-source S50 ∪ K50 with bounded bonus |

This table describes paper granularity. Full computes one MaxSim across all sources, without reserved Notes/PDF positions. Passages retain compatibility behavior and are not covered by paper-level acceptance. Query examples below indicate use cases, not guaranteed accuracy.

| Query Type | Pure Semantic | Pure Keyword | Hybrid |
|------------|---------------|--------------|--------|
| "trust in AI" | ✅ Great | ❌ Poor | ✅ Great |
| "Smith 2023" | ❌ Poor | ✅ Great | ✅ Great |
| "RLHF" | ⚠️ Maybe | ✅ Exact only | ✅ Both |
| "automation bias healthcare" | ✅ Good | ⚠️ Partial | ✅ Best |

### 🧠 Semantic Only

Explicit semantic mode bypasses Hybrid identity navigation and fusion and runs semantic search directly.

**Best for:**
- Conceptual queries: "how does automation affect human decision making"
- Finding related work with different terminology
- Exploratory research

**Limitations:**
- Doesn't understand author names or years
- May miss exact technical terms

### 🔤 Keyword Only

When Keyword mode is explicitly selected, it bypasses Hybrid identity navigation and semantic retrieval but still runs both keyword mechanisms: **T0 BM25** (chunk text in the current local lexical index) and **Zotero Quick Search** (metadata retrieval + heuristic re-ranking). Both explicit Keyword and paper Hybrid restrict BM25 sources to the current indexing mode and combine channel top-50 lists using equal RRF `0.5/(10+rankQ)+0.5/(10+rankL)`. Missing channels contribute zero; ties use stable identity. Eligibility precedes BM25 top-K without refitting IDF. API scores retain raw RRF; UI keyword scores are normalized to the query's best result for relative display, not probability.

**Best for:**
- Author searches: "Smith 2023"
- Exact terms: "PRISMA 2020"
- Tag-based filtering
- Exact phrases from note or PDF body text

**Limitations:**
- No semantic understanding
- Won't find synonyms or related concepts


---

## Search Approach

Search modes are the user-facing entry points; this chapter describes the machinery underneath them — what original ZotSeek provided, why the fork added BM25, and what the addition costs.

### The original design: semantic + keyword search

**Semantic search** maps queries and chunks into embedding vectors, ranks by cosine similarity, and aggregates to paper granularity with MaxSim (details in [Semantic Search Pipeline](#semantic-search-pipeline)). It excels at conceptual matches and reworded hits, but does not understand authors or years and is unreliable on exact terms.

**Keyword search** uses Zotero's built-in quick search (`quicksearch-everything` or `quicksearch-titleCreatorYear`) over titles, creators, years and tags. Quick search does not rank by relevance, so the plugin re-ranks heuristically: title-term matches up to +0.3, +0.15 when every query term appears in the title, +0.15 for a year match, +0.10 for an author surname match, capped at 1.0 (scoring details in [Query Analysis](#query-analysis)). It is strong on identity queries and exact terms, with no semantic generalization.

Original Hybrid was the RRF fusion of these two lists. Its gap: quick search does not index note or PDF body text; hitting exact body terms outside metadata required a `LOWER(chunk_text) LIKE` containment scan over stored chunks — a path that degrades linearly with Full-mode corpus size. On a real 150-paper Full corpus (8,873 chunks, ~9M characters) the keyword branch took 5.71 s while semantic took 1.81 s.

### The addition: the T0 BM25 lexical channel

The fork replaced the LIKE containment scan with classic **BM25** ranking: an inverted index over locally indexed chunk text, scored by term frequency and inverse document frequency. Tokenization uses the **zero-dependency** T0 contract — `Intl.Segmenter('zh-Hans')` natural words plus CJK bigrams as dual channels (implementation in [BM25 Pipeline](#bm25-pipeline)).

It solves two problems:

- **Exact body-term hits**: original terms inside Notes/PDF (drug names, abbreviations, method names) are now guaranteed by the inverted index instead of depending on embedding similarity;
- **Controllable scale**: BM25 walks postings only for terms the query actually hits — far better scaling than per-chunk `LIKE` full-text scans.

quick search was **not removed**: it continues to cover the metadata side, and its hits merge with BM25 per item into the "keyword branch" that controlled-score fusion combines with semantic. Hybrid today is therefore a blend of three mechanisms — semantic embeddings + Zotero metadata keywords + body-text BM25 — preceded by identity navigation.

### Costs

BM25 is not free; the costs land in three places:

- **Database capacity**: BM25's corpus is the faithful per-chunk `chunk_text` stored in the database, and that text must be kept complete in `zotseek.sqlite` — it cannot be trimmed for space. On the measured 150-paper Full corpus (8,894 chunks, ~9.03M characters) `chunk_text` accounts for 8.3 MiB of the 44 MiB database (vector payloads account for 31.3 MiB).
- **In-process memory**: the CSR index remains resident when ready and is released on exit; the disk snapshot survives. Persistence primarily saves rebuilding work, not steady-state memory.
- **Cold-build latency**: historical Plan 40B results for 150 papers do not extrapolate to large libraries. Plan 62 prepares after startup maintenance and avoids tokenization on a snapshot hit. Format 3 uses one JSON file with bounded records; codecs and validation check for yielding approximately every 8 ms. Individual records, string joining, file I/O, hashing and final dictionary restoration still have synchronous costs, so frame time is not guaranteed. An isolated 58,105-chunk hit took about 6.85 s with a 0.52 s maximum event-loop gap; cold preparation is substantially longer and process peak memory needs separate measurement.

Once the cache is warm the BM25 branch adds very little per query; modes whose corpus excludes Notes/PDF bodies (`abstract`) are smaller and build faster.


---

## Hybrid Search with RRF

### What is Reciprocal Rank Fusion?

RRF combines ranked lists without putting raw scores on a common scale, but k and weights remain design parameters. The following diagram is a historical S/K RRF example; paper Hybrid now uses RRF only to form K50 from Q/L.

```
                    RECIPROCAL RANK FUSION (RRF)
                    ════════════════════════════

    Formula:  RRF_score(doc) = Σ 1/(k + rank_i)

    Where:
    • k = constant (default: 60, from original RRF paper)
    • rank_i = document's rank in each result list

    ┌─────────────────────────────────────────────────────────────────┐
    │ EXAMPLE: Query "Smith automation bias healthcare"               │
    ├─────────────────────────────────────────────────────────────────┤
    │                                                                 │
    │ SEMANTIC SEARCH (by similarity):                                │
    │ ┌────┬──────────────────────────────────────────┬─────────┐    │
    │ │Rank│ Paper                                    │ Score   │    │
    │ ├────┼──────────────────────────────────────────┼─────────┤    │
    │ │ 1  │ Automation bias in clinical AI systems   │ 89%     │    │
    │ │ 2  │ Human-AI decision making in medicine     │ 85%     │    │
    │ │ 3  │ Trust calibration for automated systems  │ 82%     │    │
    │ └────┴──────────────────────────────────────────┴─────────┘    │
    │                                                                 │
    │ KEYWORD BRANCH (BM25 + quicksearch):                            │
    │ ┌────┬──────────────────────────────────────────┬─────────┐    │
    │ │Rank│ Paper                                    │ Score   │    │
    │ ├────┼──────────────────────────────────────────┼─────────┤    │
    │ │ 1  │ Smith, J. - "Bias in ML systems"         │ 95%     │    │
    │ │ 2  │ Automation bias in clinical AI systems   │ 90%     │    │
    │ │ 3  │ Healthcare AI ethics review              │ 85%     │    │
    │ └────┴──────────────────────────────────────────┴─────────┘    │
    │                                                                 │
    │ RRF FUSION (k=60):                                              │
    │ ┌────────────────────────────────────────────────────────────┐ │
    │ │                                                            │ │
    │ │ "Automation bias in clinical AI systems"                   │ │
    │ │   Semantic: rank 1 → 1/(60+1) = 0.0164                    │ │
    │ │   Keyword:  rank 2 → 1/(60+2) = 0.0161                    │ │
    │ │   TOTAL: 0.0325  ← HIGHEST (appears in BOTH!)             │ │
    │ │                                                            │ │
    │ │ "Smith, J. - Bias in ML systems"                          │ │
    │ │   Semantic: not found → 0                                  │ │
    │ │   Keyword:  rank 1 → 1/(60+1) = 0.0164                    │ │
    │ │   TOTAL: 0.0164                                           │ │
    │ │                                                            │ │
    │ │ "Human-AI decision making in medicine"                     │ │
    │ │   Semantic: rank 2 → 1/(60+2) = 0.0161                    │ │
    │ │   Keyword:  not found → 0                                  │ │
    │ │   TOTAL: 0.0161                                           │ │
    │ │                                                            │ │
    │ └────────────────────────────────────────────────────────────┘ │
    │                                                                 │
    │ FINAL RANKING:                                                  │
    │ 1. 🔗 Automation bias in clinical AI   (0.0325) - BOTH        │
    │ 2. 🔤 Smith, J. - Bias in ML systems   (0.0164) - Keyword     │
    │ 3. 🧠 Human-AI decision making         (0.0161) - Semantic    │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘
```

> The "KEYWORD BRANCH" on the right of the diagram is not plain metadata search: it merges hits from **T0 BM25** (over locally indexed chunk text) and **Zotero quicksearch** (metadata + heuristic re-ranking) per item; the merge rules are in [Query Analysis](#query-analysis).

### Current paper-level Hybrid (Plan 66P, branch prototype)

After the existing identity-navigation gate declines a query, all three indexing modes share this contract. S is paper MaxSim over all eligible scoped vector chunks; lexical retrieval does not shortlist the papers for the semantic scan.

```
                         identity navigation
                                |
                    no identity navigation hit
                      /                    \
       global scoped semantic pass      Quick Q50 + BM25 L50
             |          |                       |
            S50     all-paper scores      equal RRF, k=10 -> K50
             \          |                       /
                      U = S50 union K50
                                |
                  S + 0.05 * 11/(10 + rankK50)
                                |
                   stable identity tie-break
                                |
               top results + matched-chunk hydration
```

- Q50 retains Quick's first 100 raw matches and heuristic reranking, using quicksearch-everything and mapping Notes to parent papers. L50 limits chunk sources by indexing mode. Book/library/collection eligibility is checked before top-K without refitting BM25 corpus IDF statistics.
- Indexing mode limits Semantic/BM25 text sources. Quick still uses Zotero's own everything scope, not just ZotSeek abstract or Note chunks.
- K50 uses `0.5/(10+rankQ)+0.5/(10+rankL)`, with zero contribution from an absent channel. Final fusion consumes K50 ranks, not normalized BM25 values.
- UI/REST `minSimilarity` settings filter S50; the MCP entry point always uses 0, so it does not discard semantic candidates early because of the UI preference. The complete semantic score table is not limited by the display threshold or S50 truncation. K-only candidates retain their real MaxSim. The fixed 0.05 bonus cap does not depend on language, library, query length or legacy automatic-weight settings.
- Abstract uses summary/abstract/title_only; Notes also includes note; Full includes all indexed sources, without Notes/PDF quotas. Default channel depth is 50, adjustable through internal topK options. Deduplication and ties use libraryKey + itemKey.
- Genuinely missing vectors retain semanticScore=null and the compatible zero-baseline lexical bonus. This case has not been validated for retrieval quality; complete vector coverage bounds the 66L conclusions. Missing items return item_not_found; unresolved collection membership does not enter that collection.
- The legacy rrfScore field now contains the fused score, potentially above 1. The external `score` is the final score; `semanticScore` is the raw unrounded cosine/MaxSim value and `bm25Score` is the raw unnormalized BM25 score of the best lexical chunk, or `null` when unavailable. Keyword does not run semantic retrieval merely to populate `semanticScore`; `find_similar` is semantic-only and returns `bm25Score: null`. UI `keywordScore` is a relative display value based on the query's best result, not probability. MCP/REST and UI share ranking while their entry thresholds may differ; raw BM25 values are not confidence values across queries. source=both means a semantic score exists and the paper is in K50; that semantic score may come from the complete score table outside S50, and it is not confidence.
- A K-only paper's winning semantic chunk is hydrated with that same chunk's text, Note paths, PDF source and page; lexical snippets cannot inherit another chunk's location.

Explicit Keyword now shares Q/L K50; explicit Semantic and multi-query aggregation logic remain unchanged. Paper experiments are not extrapolated to passage ranking: passages/location retain compatibility paths (Abstract semantic, Notes RRF, Full source merging). UI and MCP use the same engine for the same granularity. Unifying passage ranking requires separate design and acceptance.

The UI Match column retains semantic similarity (falling back to keyword display relevance when no semantic score exists), rather than the paper fusion score. Hybrid percentages therefore need not decrease monotonically with result order: K50 bonuses can promote a result with lower semantic similarity. Real Notes search-window acceptance on 2026-09-10 covered mode switching, a research-relation query, full-title navigation, source previews, item selection and empty results. Full PDF page navigation and HTTP transport were not revalidated in that round.

### Cache responsiveness and validation boundaries

Initial vector decoding checks an approximately 8 ms budget every 16 chunks and yields through a timer when exhausted. Normalization arithmetic is unchanged; publication still checks generation/model/lifecycle and concurrent searches share construction. This is not a background thread or a stall-free guarantee. In one isolated 57,523-chunk comparison, the maximum timer gap fell from 1.725 s to 0.763 s while loading changed from 5.808 s to 6.344 s. These are component observations, not full UI latency or stable performance guarantees.

All 1,080 frozen 66L cells replay through production fusion; the 180 cells with complete Q/L inputs also replay K50. This checks formula wiring, not new cross-library quality or complete live retrieval equivalence.


### Offline Benchmark: Four Index Modes x Five Search Methods

The six figures are the historical Plan 58 unified offline matrix, not a re-evaluation of the 66P formula: the frozen `10_Hyperscanning`
150-paper corpus, the MN-50 / FT-50 question sets, `multilingual-e5-base`, T0 BM25
(k1=1.2 / b=0.75) and RRF k=60. The primary run and an independent replay are byte-identical,
11 historical bindings match at six decimals; full numbers live in `plan/REPORT-58`. All
clusters within one figure share the same question set, so cross-cluster differences directly
reflect the coverage limits of index content; the metadata side of `keyword-legacy` is an
offline approximation.

**MN-50 questions (notes/abstract track):**

![Recall@10 - MN-50 Questions](images/plan58-mn-recall-at10.png)

![MRR@10 - MN-50 Questions](images/plan58-mn-mrr-at10.png)

All-metrics panel (3 production index modes x 3 current methods, all 7 metrics at a glance; the PDF-only research track is not a production index mode and is omitted here):

![All Metrics - MN-50 Questions](images/plan58-mn-all-metrics.png)

**FT-50 questions (PDF detail track):**

![Recall@10 - FT-50 Questions](images/plan58-ft-recall-at10.png)

![MRR@10 - FT-50 Questions](images/plan58-ft-mrr-at10.png)

All-metrics panel (FT track):

![All Metrics - FT-50 Questions](images/plan58-ft-all-metrics.png)

Conclusions readable directly from the figures:

- On the Metadata + Notes mode the current Hybrid reaches R@10 0.87 / MRR 0.817, the best of
  this track; BM25 alone already hits 0.87 — the T0 lexical upgrade is the main gain behind the
  current Hybrid versus the legacy Hybrid (MRR 0.549).
- On the abstract mode lexical evidence was too weak in that historical run: the old Hybrid front rank (R@1 0.06) dropped below pure semantic (0.22). This describes the old candidates and formula; it does not mean the current branch defaults paper-level `abstract` Hybrid to semantic-only.
- Only clusters containing PDF text achieve high recall on FT questions: the PDF-only cluster
  reaches R@10 0.73 while Metadata + Notes stays at 0.41-0.44; Full mode under the historical
  `FIXED-NOTES-2-8` source-slot contract reached FT R@10 0.78 / MRR 0.499. That source allocation is no longer the paper-level Full Hybrid contract.
- The legacy keyword path (quicksearch proxy + K0) nearly fails on Chinese content questions
  (R@10 <= 0.18), which is the direct motivation for replacing it with T0 BM25.

---

## Multi-Query Search

ZotSeek supports combining up to 4 search queries with AND/OR logic to find papers at the intersection of multiple topics.

This section documents the existing multi-query combiner. It has not been
refactored to the 66P single-query paper-level S50/K50 formula; its internal
subquery aggregation remains a separate compatibility behavior and should not
be read as using the fixed 0.05 lexical bonus.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MULTI-QUERY SEARCH ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER INPUT:                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ Query 1: "machine learning"                                           │ │
│  │ Query 2: "healthcare"                                                 │ │
│  │ Query 3: "ethics"                                                     │ │
│  │ Operator: AND (Product formula)                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                               │                                           │
│                               ▼                                           │
│  PARALLEL EXECUTION:                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ Search Q1       │  │ Search Q2       │  │ Search Q3       │            │
│  │ "machine        │  │ "healthcare"    │  │ "ethics"        │            │
│  │  learning"      │  │                 │  │                 │            │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘            │
│           │                    │                    │                      │
│           ▼                    ▼                    ▼                      │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ Paper A: [0.85, 0.72, 0.68]  ← scores from each query                 │ │
│  │ Paper B: [0.91, 0.45, null]  ← missing Q3 = excluded by AND           │ │
│  │ Paper C: [0.78, 0.81, 0.75]  ← all queries match                      │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                               │                                           │
│                               ▼                                           │
│  SCORE COMBINATION (AND with Product formula):                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ Paper A: (0.85×0.72×0.68)^(1/3) = 0.746                               │ │
│  │ Paper B: EXCLUDED (doesn't match all queries)                         │ │
│  │ Paper C: (0.78×0.81×0.75)^(1/3) = 0.779  ← HIGHEST                    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                               │                                           │
│                               ▼                                           │
│  FINAL RANKING:                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Paper C: 78% (78|81|75)  ← combined score (per-query scores)       │ │
│  │ 2. Paper A: 75% (85|72|68)                                            │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### AND/OR Combination

| Operator | Behavior | Result Set |
|----------|----------|------------|
| **AND** | Paper must match ALL queries | Intersection - stricter, fewer results |
| **OR** | Paper can match ANY query | Union - broader, more results |

**AND Mode:**
- Only papers appearing in ALL query results are included
- Combined score determined by the selected formula (default: Product / geometric mean; see below)
- Best for finding papers at the intersection of multiple topics

**OR Mode:**
- Papers appearing in ANY query result are included
- Combined score = maximum score across all queries
- Best for broadening search with synonyms or related terms

### AND Combination Formulas

When using AND mode, three formulas are available for combining scores; the default is **Product (geometric mean)**:

The default follows the Plan 59 offline reproduction probe: on shared-gold pairs Product/average hit
Top10 6/6 (the achievable ceiling) while min reached only 4/6. min takes the weakest sub-score, which
compresses combined scores into a narrow band where uniformly-decent survey papers can outrank the
actual target in a specialized library. Product balances both sides while still penalizing a weak
side more than average does. Minimum remains available for the strictest intersection.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AND COMBINATION FORMULAS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Example: Paper scores for 3 queries = [0.85, 0.72, 0.68]                   │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ MINIMUM (strictest)                                                   │ │
│  │ Formula: min(scores)                                                  │ │
│  │ Result:  min(0.85, 0.72, 0.68) = 0.68                                 │ │
│  │                                                                       │ │
│  │ Behavior: Score limited by weakest query match                        │ │
│  │ Use when: You want strict intersection - paper must be                │ │
│  │           strongly relevant to ALL queries                            │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ PRODUCT (default)                                                     │ │
│  │ Formula: (∏ scores)^(1/n) = nth root of product                       │ │
│  │ Result:  (0.85 × 0.72 × 0.68)^(1/3) = 0.746                           │ │
│  │                                                                       │ │
│  │ Behavior: Penalizes if ANY query is weak, but less harsh than min     │ │
│  │ Use when: You want balanced relevance across all queries              │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ AVERAGE (arithmetic mean)                                             │ │
│  │ Formula: Σ scores / n                                                 │ │
│  │ Result:  (0.85 + 0.72 + 0.68) / 3 = 0.75                              │ │
│  │                                                                       │ │
│  │ Behavior: Most lenient - one strong match can compensate for weak     │ │
│  │ Use when: You want papers that are good overall, even if              │ │
│  │           one query matches less strongly                             │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  COMPARISON:                                                                │
│  ┌────────────┬────────────┬────────────┬─────────────────────────────┐   │
│  │ Formula    │ Result     │ Strictness │ Ranking Impact              │   │
│  ├────────────┼────────────┼────────────┼─────────────────────────────┤   │
│  │ Minimum    │ 0.68       │ Strictest  │ Rewards consistent matches  │   │
│  │ Product    │ 0.746      │ Moderate   │ Balanced consideration      │   │
│  │ Average    │ 0.75       │ Lenient    │ Favors strong single match  │   │
│  └────────────┴────────────┴────────────┴─────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Details

```typescript
// Parallel search execution
const searchPromises = queries.map(query =>
  hybridSearch.search(query, options)
);
const allResults = await Promise.all(searchPromises);

// Score combination
const combinedScore = operator === 'and'
  ? applyAndFormula(scores, formula)  // min, product, or average
  : Math.max(...scores);               // OR uses max

// Per-query scores stored for display
result.queryScores = [0.85, 0.72, 0.68];  // Individual scores
result.semanticScore = 0.68;              // Combined score
```

### Display Format

The Match column shows combined score plus per-query breakdown:

```
75% (85|72|68)
 │    └──┴──┴── Individual query scores (Q1|Q2|Q3)
 └───────────── Combined score using selected formula
```

This helps users understand which queries matched strongly and which were weaker.

---

## Semantic Search Pipeline

### Embedding Generation

```
┌────────────────────────────────────────────────────────────────────┐
│                  EMBEDDING PIPELINE (model-aware)                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  INPUT TEXT (exact-token counted)      EMBEDDING VECTOR            │
│  ┌─────────────────────────┐           ┌─────────────────────┐     │
│  │ "Machine learning for   │           │ [0.023, -0.045,     │     │
│  │  medical diagnosis ..." │   --->    │  0.012, ... 768 or  │     │
│  │                         │           │  1024 values]       │     │
│  └─────────────────────────┘           └─────────────────────┘     │
│                                                                    │
│  MODEL REGISTRY (model-registry.ts / model-input-config.ts)        │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ multilingual-e5-base    768   512       bundled default  │      │
│  │ nomic-embed-text-v1.5   768   8192      optional download│      │
│  │ bge-m3                  1024  8192      optional download│      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                    │
│  INSTRUCTION PREFIXES (registry-driven, model-aware):              │
│  ├── E5:      "query: " / "passage: "                              │
│  ├── Nomic:   "search_query: " / "search_document: "               │
│  └── BGE-M3:  none                                                 │
│                                                                    │
│  TOKEN COUNTING:                                                   │
│  ├── E5 / BGE-M3: exact local tokenizer (prefix + special tokens)  │
│  └── Nomic / server / cloud: conservative word estimator           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Cosine Similarity

```
                         COSINE SIMILARITY
                         ═════════════════

                              A · B
    similarity(A, B) = ─────────────────
                        ||A|| × ||B||

    Where:
    • A · B = dot product = Σ(a[i] × b[i])
    • ||A|| = magnitude = √(Σ a[i]²)

    ┌─────────────────────────────────────────────────────────────┐
    │ INTERPRETATION:                                             │
    ├─────────────────────────────────────────────────────────────┤
    │                                                             │
    │  1.0 ████████████████████████████████████ Identical        │
    │  0.9 ███████████████████████████████████  Very similar     │
    │  0.7 █████████████████████████████        Related topics   │
    │  0.5 ███████████████████                  Loosely related  │
    │  0.3 ███████████                          Different topics │
    │  0.0                                       Completely different│
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
```

### MaxSim Aggregation

When a paper has multiple chunks, we use **MaxSim** (Maximum Similarity):

```
    Paper A has 4 chunks: [summary, methods, findings, content]

    Query: "statistical analysis techniques"

    Similarities:
    ├── summary:  0.45  (abstract mentions statistics)
    ├── methods:  0.89  ← HIGHEST (detailed methods section)
    ├── findings: 0.52  (results discuss significance)
    └── content:  0.32  (background section)

    MaxSim Result: 0.89 (methods chunk matched best)
    Source Display: "Methods" ← Shows WHERE the match was found
```

This ensures that if *any* part of a paper matches your query, the paper ranks highly.

### Snippet Enrichment (Matched-Passage Preview)

The scoring loop deliberately works on vectors only: the in-memory embedding cache (`getAllCached()`) holds vectors plus light metadata (item identity, chunk index, page/paragraph, section), **not** chunk text. Keeping `chunk_text` out of the cache avoids hundreds of MB of RAM on large libraries.

The matched passage is fetched lazily, only for the rows the user will actually see:

```
    1. Score all chunks → MaxSim per item → sort by similarity
    2. slice(0, topK)                ← typically 20-50 rows
    3. populateChunkText(topResults) ← batch-fetch chunk_text for the
                                        matchedChunkIndex of each visible row
                                        (VectorStoreSQLite.getChunkTexts)
    4. result.chunkText is now set → UI shows it on hover
```

`getChunkTexts()` issues parallel single-column queries for `chunk_text`, optional `section_paths`, and optional `pdf_attachment_key`, scoped to the active model and bounded by `topK`, following the Zotero 8 single-column query convention. Keeping these display/provenance fields out of the all-vector cache avoids scaling their memory cost with the full index. `chunk_text` has been stored since schema v6; schema v11 adds structured Child Note paths and schema v12 adds exact PDF-source provenance.

The UI (`SearchResultsTable`) renders `chunkText` as a floating tooltip on row hover, windowed around the first matched query term and with those terms highlighted (keyword/hybrid modes only).

### Parent-Child Retrieval Pattern

ZotSeek implements a **parent-child retrieval pattern** that supports two granularity modes:

```
┌─────────────────────────────────────────────────────────────────────┐
│                   PARENT-CHILD RETRIEVAL                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  INDEXING: Paragraph-level (child chunks)                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Paper A                                                      │   │
│  │ ├── Chunk 0: Abstract (page 1, para 0)                      │   │
│  │ ├── Chunk 1: Intro paragraph 1 (page 2, para 0)             │   │
│  │ ├── Chunk 2: Intro paragraph 2 (page 2, para 1)             │   │
│  │ ├── Chunk 3: Methods paragraph 1 (page 3, para 0)           │   │
│  │ └── ...                                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│              ┌───────────────┴───────────────┐                      │
│              ▼                               ▼                       │
│  ┌─────────────────────┐         ┌─────────────────────┐           │
│  │  BY SECTION MODE    │         │  BY LOCATION MODE   │           │
│  │  (returnAllChunks   │         │  (returnAllChunks   │           │
│  │   = false)          │         │   = true)           │           │
│  ├─────────────────────┤         ├─────────────────────┤           │
│  │                     │         │                     │           │
│  │ MaxSim aggregation  │         │ Return ALL chunks   │           │
│  │ 1 result per paper  │         │ with individual     │           │
│  │ Best chunk score    │         │ scores & locations  │           │
│  │                     │         │                     │           │
│  │ Result:             │         │ Results:            │           │
│  │ Paper A: 89%        │         │ Paper A, p3 ¶0: 89% │           │
│  │ (Methods section)   │         │ Paper A, p2 ¶1: 52% │           │
│  │                     │         │ Paper A, p1 ¶0: 45% │           │
│  └─────────────────────┘         └─────────────────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### By Section Mode (Default)

- **Aggregation**: MaxSim - returns highest similarity across all chunks
- **Results**: 1 result per paper
- **Display**: Shows which section matched (Abstract, Methods, Results) **and the location of that best-matching chunk** (page & paragraph). The MaxSim result already carries the best chunk's `pageNumber`/`paragraphIndex`, so the Location column is populated here too — one diverse result per paper without losing the exact location. Falls back to "—" for keyword-only matches or abstract-only indexing.
- **Use case**: Overview of matching papers

#### By Location Mode

- **Aggregation**: None - returns every matching chunk
- **Results**: Multiple results per paper (one per matching paragraph)
- **Display**: Shows exact page & paragraph number
- **Use case**: Finding specific passages, evidence linking

#### Technical Implementation

```typescript
// Search options
interface SearchOptions {
  returnAllChunks?: boolean;  // true = By Location, false = By Section
}

// RRF fusion key changes based on mode
const key = returnAllChunks
  ? `${itemId}-${chunkIndex}`  // Unique per chunk
  : String(itemId);            // Unique per paper
```

---

## BM25 Pipeline

This chapter parallels [Semantic Search Pipeline](#semantic-search-pipeline) and describes the T0 BM25 implementation inside the keyword branch (`src/core/lexical-search.ts` plus the lexical cache in `vector-store-sqlite.ts`). The faithful `chunk_text` produced by chunking is BM25's corpus.

### Tokenization: the T0 contract

- **Normalization**: NFC normalization + language-agnostic lowercasing (`toLocaleLowerCase('und')`).
- **Natural-word channel**: `Intl.Segmenter('zh-Hans', { granularity: 'word' })`, keeping `isWordLike` segments containing letters/digits, with a scoped exception for false-word-like segments composed only of Thai-script characters/combining marks and containing a letter to work around Gecko annotations. Zotero 9+ ships this API; runtimes without a Segmenter fall back to deterministic `\p{L}\p{N}` regex splitting, leaving the CJK channel unchanged.
- **Korean/Latin boundary compensation**: when a runtime segment joins Latin text and Hangul (such as `EEG로`), preserve it and add its Latin-initial terms. Count actual occurrences without duplicating already separated Latin tokens. Text without Hangul skips boundary checks. This does not provide general particle removal, arbitrary substring matching, or stemming.
- **CJK bigram channel**: adjacent character pairs over continuous Han/Hiragana/Katakana/Hangul runs. Chinese has no whitespace word boundaries, so bigrams guarantee that any two-character combination can be hit; the natural-word channel keeps whole words exact.
- When both channels produce the same term, the **maximum TF** wins.
- Frozen contract IDs: `intl-segmenter-zh-hans-cjk-bigram-v2` (tokenizer) and `chunk-bm25-k1-1.2-b-0.75-v1` (BM25 parameters), identifying application rules shared by indexing and querying; underlying runtime segmentation can still differ.

Why not jieba/pkuseg or other third-party tokenizers: the Plan 24B/24C ablations showed jieba-wasm (T2) had the best retrieval metrics, but ~4.03 MB of WASM, ~67 MB steady-state memory and first-init costs were not worth it; the zero-dependency T0 was the best overall choice and is frozen as the production contract. The library-wide keyword dictionary patch (`library-term-patch-v1`) is likewise frozen as disabled.

Upgrading lexical rules requires no new embeddings or extraction. Startup rejects a mismatched algorithm contract and rebuilds BM25 from stored chunk_text. A software version change alone does not invalidate snapshots.

### Inverted index and scoring

- **Document unit** is a single chunk (`itemPk:chunkIndex`); document length = total term count; `postings` maps term → (document → TF).
- Scoring is standard BM25:

```
score(D, Q) = Σ IDF(t) · tf(t,D) · (k1 + 1) / ( tf(t,D) + k1 · (1 − b + b · |D| / avgLen) )
IDF(t)      = ln( 1 + (N − df + 0.5) / (df + 0.5) )              k1 = 1.2, b = 0.75
```

- **Source isolation reaches the statistics layer**: `N`, `df` and average document length are recomputed within the set of sources the current query is allowed to see, rather than computed corpus-wide and filtered afterwards. Notes or Abstract queries restrict the set accordingly; Full paper-level queries allow all indexed sources. The legacy passage path may use source specialists, but that is not the current paper-level Full contract.
- **Paper-granularity exit**: only the BM25-best chunk of each paper enters the ranking (deterministic tie-break: score first, then libraryKey/itemKey), so a single paper cannot flood the list with fragments.
- **Score normalization**: raw BM25 scores are unbounded; before output they are normalized by the query's best hit to [0, 1] — order-preserving, and it lets BM25 compete directly with quicksearch heuristic scores (also 0–1) in the merge and in the UI.
- The default returns the top 50 matches (`limit`).

### Cache and lifecycle

- BM25 uses an in-memory CSR index and an independent JSON snapshot; startup/manual maintenance refreshes it, not ordinary session writes.
- In-flight builds retain generation/model/lifecycle guards and keyed single-flight. Durable revisions commit in chunk-writing transactions; closing and reconnecting do not increment them.
- Searches wait during preparation and construction yields cooperatively. Ready BM25 may retain session-stale content; clear, model and lifecycle changes reject incompatible versions.
- **Model partitions**: chunks from the active model are preferred; papers not yet rebuilt for the active model fall back to a deterministically chosen older partition so lexical retrieval survives migration without mixing two copies of the same paper.
- Build diagnostics log only sizes (chunk count, characters/bytes, unique terms, postings, elapsed time) — never corpus text or queries.

Build cost and memory overhead are in [Search Approach](#search-approach); the merge rules with quicksearch hits are in [Query Analysis](#query-analysis).


### Tokenizer Selection Benchmark (Plan 24B/24C)

T0 was not the only tokenizer evaluated. Plan 24B first replaced the legacy substring match (K0)
with BM25 (K1); Plan 24C then compared four natural-word tokenizers under a fully frozen protocol:
**T0 `Intl.Segmenter` (production choice)**, **T1 `PKUSEG-js`**, **T2 `jieba-wasm@2.4.0` (search
mode)** and **T3 `Segmentit`**. All four arms share the same CJK bigram channel, BM25 parameters
(k1=1.2 / b=0.75), RRF k=60, E5 vectors and the same 50-question set; only the natural-word
channel changes. The main comparison runs on the Metadata + Notes corpus (150 papers / 1000
chunks); the PDF-only corpus with the 2 Chinese-dominant hub papers excluded only confirms
English/abbreviation retrieval is unaffected.

![Tokenizer Benchmark - Retrieval Quality](images/plan24c-tokenizer-quality.png)

On retrieval quality all four tokenizers lift the lexical branch to the same level (keyword-only
R@1 0.72-0.76), and **T2 jieba-wasm wins content-hybrid slightly** (R@1 0.74 / MRR 0.809 /
nDCG 0.818; +0.04 R@1 and +0.018 MRR over T0); T1/T3 sit in between. The dashed blue line marks
the pure-semantic level without a lexical branch — every BM25 tokenizer beats it on MRR/nDCG,
showing the fusion itself has a stable gain.

![Tokenizer Benchmark - Resource & Cost](images/plan24c-tokenizer-resources.png)

Resource cost decided the final choice: **T2 has the best quality but requires a 4 MB WASM asset,
about 67 MB stable memory, a ~252 ms lazy first query, and the slowest BM25 build (5.6 s)**; T1
needs about 163.5 MB of runtime assets and 170 MB of memory; T3 needs 114.5 MB. The D5 decision
froze the zero-dependency T0 — the incremental quality was not worth a third-party WASM dependency
and resident memory — which Plan 40 then integrated into production. The same ablation froze two
more outcomes: `library-term-patch-v1` (library keyword dictionary) stayed **HOLD_OFF** — patch ON
has no stable retrieval gain (Metadata+Notes hybrid MRR +0.000032) while adding 2.7% index size;
and the two Chinese hub papers fill the PDF-track lexical Top10 under every tokenizer, a
corpus-level risk rather than a tokenizer defect. Full data: `plan/archive/REPORT-24B`,
`plan/archive/REPORT-24C` and `tokenizer/eval/runs/plan24c-tokenizers-v1/2026-09-01-formal-report-v3/`.

---

## Chunking Strategy

### Trade-offs: Chunk Size Selection

Embedding time scales **O(n²)** with sequence length due to transformer attention. Chunk size directly impacts both indexing speed and search quality:

| Chunk Size | Applies To | Speed (CPU/WASM) | Precision | Recall | Best For |
|------------|-----------|------------------|-----------|--------|----------|
| **420 tokens** | multilingual-e5-base (512 hard limit) | Very fast (~0.4s/chunk) | High | Lower | Specific claims, methods, passages |
| **2000 tokens** | Nomic v1.5, BGE-M3 (8192 hard limit) | Moderate (~0.9s/chunk) | Balanced | Balanced | Long-context local models |
| **up to 4000 tokens** | Cloud model profiles (ratio-capped) | Provider-bound | Lower | Higher | Broad topics, long-context Cloud |

**Precision vs Recall:**
- **Smaller chunks** = more precise matches to specific passages, but may miss broader context
- **Larger chunks** = captures more context, but similarity scores get "diluted" by surrounding text

### Model-aware maxTokens

The default depends on the active model: **420 tokens for multilingual E5** and
**2000 tokens for Nomic v1.5 and BGE-M3**. These are ZotSeek recommendations,
not model context limits. An explicit global override is preserved across model
switches and clamped to the active model's hard limit. Clearing the override in
Settings restores the current model's recommendation.

### Paragraph-Based Chunking

The `maxTokens` setting is a **ceiling, not a target**. The chunker:

1. Splits text at paragraph boundaries (`\n\n`)
2. Accumulates paragraphs into a chunk
3. Flushes when adding another paragraph would exceed `maxTokens`
4. Splits oversized paragraphs at sentence boundaries, then at Unicode
   character boundaries when an unpunctuated unit is still too large

```
Example with maxTokens=800:

Paragraph 1: 200 tokens  ─┐
Paragraph 2: 350 tokens   ├─► Chunk 1 (550 tokens)
                         ─┘
Paragraph 3: 400 tokens  ─┐
                          ├─► Chunk 2 (400 tokens) ← under limit, that's OK
                         ─┘
Paragraph 4: 900 tokens  ─┐
                          ├─► Chunk 3a + 3b (both within the limit)
                         ─┘
```

A chunk might be 400 tokens if that's where the paragraph ends naturally. Paragraphs larger than `maxTokens` are split at sentence boundaries into multiple chunks, preserving all content with correct page location data. PDF chunks additionally use the same-page packing stage described below; non-PDF sources keep their own source-aware grouping rules.

### Structured Child Note Chunking

Child Notes retain Zotero `h1` through `h6` heading structure before plain-text normalization. Any meaningful heading enables structured processing; a Note with only a generic root such as “简报” falls back to ordinary paragraph chunking. This avoids the stricter “three distinct heading levels” rule, which missed usable briefs in the fixed local snapshot.

The production strategy is:

1. Remove conservative “基本信息” and reference-list subtrees before fingerprinting, quota allocation and chunking. A citation/title preamble between a generic brief `h1` and the first meaningful heading is removed for the same reason. A skipped subtree ends at the next heading of the same or a higher level.
2. Split oversized sections at paragraph, sentence and Unicode-character boundaries under the model's hard input ceiling.
3. Greedily combine adjacent small sections using the active model profile's derived `softMinTokens` as a soft minimum, but never merge across an `h2` boundary or across different Zotero Child Notes.
4. Store faithful evidence in `chunk_text`. After the Note body has completed its existing split, R1 adds `文献：<父文献标题>` and, when available, `章节：...` only to `embedText`; these artificial prefixes are not shown as quoted evidence and do not enter BM25.
5. Persist all represented paths as `sectionPaths: string[][]`, because one compact chunk may contain several adjacent subsections.

The parent title breadcrumb is added after body chunking, so it does not consume
the recommended Note body budget or change boundaries. The model hard limit
still governs the final inference input. The brief's filtered “基本信息” section
is not restored. The selected strategy is versioned; strategy 8 introduces R1,
while strategy 9 unifies the Metadata Summary across all indexing modes.
Strategy 10 preserves sentence separators and unfinished tails, protects Unicode
code points during hard splitting, and bounds oversized title context.
If an existing model partition contains old chunks without the current strategy
marker, ZotSeek keeps it searchable but pauses writes and background
reconciliation until the user explicitly rebuilds the index.

### Faithful Text and Input Limits (Strategy 10)

Sentence spans retain original punctuation and internal whitespace, including
leading `.NET` and unfinished PDF tails. Only outer chunk whitespace is trimmed;
existing HTML/paragraph normalization still applies. Hard splits use Unicode
code-point boundaries, including the PDF paragraph-recovery window. The 8000
character ceiling remains measured in UTF-16 units; this does not promise that
every multi-code-point emoji or combining sequence remains in one chunk.

Metadata Summary retains the complete title in every indexing mode. Normal
titles still repeat when a Summary needs splitting. If an oversized input's
title context consumes more than half its token or character budget, Summary
instead splits the complete title and Metadata body as consecutive source text.
Repeated PDF context is shortened with an ellipsis (or omitted if necessary)
under the same half-budget fallback, leaving room for the body. Note parent
titles continue to use only the remaining hard-limit room after body splitting.

Summary/PDF token and character ceilings are checked on the same final input,
with explicit source-title information rather than guessing from a double
newline. The selected counter includes local model-prefix overhead where
supported; Nomic/Local Server keep the word estimator and Cloud keeps its
multilingual estimator. Estimated limits do not guarantee real provider token
counts. An impossible complete-character budget raises an error instead of
silently emitting an oversized input. Shared source quotas still report
intentional content omission with `wasTruncated`.

### PDF Main-Text Preprocessing

Full indexing uses the versioned `zotseek-pdf-main-text-indexing-v1` pipeline:

1. Enumerate sibling PDF attachments and extract every physical page through
   Zotero PDFWorker, retaining empty page slots so later page numbers cannot
   shift.
2. Select a unique high-confidence main attachment from title, filename,
   first-page structure, containment and parser-status evidence. Supplement and
   unknown attachments abstain; they do not re-enter through a best-attachment
   or first-readable fallback.
3. Apply References v2 region filtering, followed by repeated page-furniture
   filtering. Both return derived pages and an ignored-block ledger; the source
   PDFWorker pages are never changed in place.
4. Add the bibliographic title as PDF embedding context, then greedily pack
   compatible adjacent short paragraphs on the same physical page. Packing
   never crosses a page, filtering boundary or coarse section type.
5. Enforce the active model's exact prefixed token budget, character ceiling
   and the shared Summary/Note/PDF `maxChunksPerPaper` quota.

Full mode assigns that shared quota in strict source order: all Summary chunks
that fit are kept first, up to 30 Note chunks are kept next, and PDF chunks use
only the remaining slots. The 30-chunk Note cap applies only while combining
Full-mode sources; Metadata + Notes mode can still use all slots left after its
Summary chunks. If Notes exceed the Full-mode cap, the item is reported as
truncated even when no PDF is available to consume the unused total capacity.

### Incremental Indexing-Mode Transitions

Every current-strategy mode starts from the same Metadata Summary: the title, the
abstract only when `trim().length >= 50`, and trimmed/sorted Zotero tags except
those whose trimmed text starts with `#`. Authors, years, journals and DOI are
not appended to this embedding input. Workflow tags remain available in Zotero,
`get_item`, exclusion rules and keyword paths; the filter only defines semantic
Summary content.

Changing `abstract`, `notes` or `full` does not automatically discard every
vector. For each indexed item, ZotSeek first requires a modern per-item config
fingerprint proving that mode is the only changed setting. The index contract,
model input policy, chunk strategy, `maxChunksPerPaper` and active model must
remain identical. Missing/legacy fingerprints or any simultaneous setting
change use the established complete replacement path.

After that gate, target chunks are matched to stored chunks by exact source,
faithful text and `sectionPaths` (with legacy Summary source aliases accepted
only for Summary). Matching preserves duplicate multiplicity. A match carries
forward only the embedding; index, source text, paths, location, content hash,
truncation state and timestamps come from the new target extraction. Unmatched
target chunks alone are sent to the embedding pipeline. If every target chunk
matches, a shrinking transition does not load the model.

Within the same current strategy, every mode-only transition reuses the exact shared Summary.
Abstract to Notes adds Notes; Abstract to Full adds up to 30 Note chunks and PDF;
Notes to Abstract removes Notes; Full to Abstract removes Notes and PDF. Notes
to Full reuses compatible Metadata and the first 30 target Notes while adding
PDF. Full to Notes removes PDF, reuses existing Notes and embeds only target
Notes beyond Full's 30-Note cap. The target mode is always extracted first, so
the shared per-paper chunk cap and source priority still determine the final set.
The per-item replacement remains atomic, so a missing new embedding cannot
destroy a complete old item index.

Strategies 8 and 9 cannot be updated incrementally into strategy 10. The old index stays
searchable until the user confirms a rebuild. Rebuild deletes only the active
model's embeddings and fingerprints, initializes that empty partition as
strategy 10, and leaves other model partitions intact. An interrupted rebuild
contains only strategy-10 chunks and retains a pending scope for recovery. Cloud
strategy migration additionally warns that old Cloud coverage is removed first
and that re-embedding may incur provider charges.

References v2, page-furniture v1 and same-page packing are internal production
switches that default on and can be disabled independently for deterministic
benchmark replay. The legacy chunker References rules are explicitly disabled
for preprocessed pages, preventing the same content from being filtered twice.
Persisted PDF chunks retain their 1-based physical `pageNumber`; Summary and
Note chunks never receive a synthetic PDF page.

### Truncation Detection (Max Chunks per Paper)

Long papers can exceed `maxChunksPerPaper` (default 100). When that happens the chunker stops adding chunks at the ceiling — silently, in versions before this. The chunker now reports a `wasTruncated` flag alongside `pagesIndexed`/`pagesTotal`:

```
chunkDocumentWithPagesEx(...) → {
  chunks:        [...],
  wasTruncated:  true,
  pagesIndexed:  18,
  pagesTotal:    52,
}
```

These three values are stored on the `items` table (`was_truncated`, `pages_indexed`, `pages_total` — added in schema v7) so the index-status column and the indexing progress window can surface partial coverage to the user. See [README §Indexing Status Column](../README.md#indexing-status-column) for the user-facing glyphs.

To capture the full content of long papers, raise *Max Chunks per Paper* in **Settings → ZotSeek** or switch the affected papers to Abstract mode (tag them with `zotseek-exclude` if you want only the abstract).

### Token Counting

E5 and BGE-M3 use their exact local tokenizers for Summary, Child Notes, PDF
chunks and queries. Counts include the model's document/query prefix and
special tokens. Nomic and server-managed models use the English-oriented
heuristic of approximately 1.3 tokens per whitespace-separated word:

```
1000 words ≈ 1300 tokens ≈ 6000 characters
```

| maxTokens | Approximate Size |
|-----------|------------------|
| 500 | ~385 words, ~1500 chars |
| 800 | ~615 words, ~2400 chars |
| 2000 | ~1540 words, ~6000 chars |

Cloud models do not claim exact local token counts. Their conservative
preflight estimate keeps the same 1.3 ratio for whitespace-separated non-CJK
words and counts Han, Hiragana, Katakana and Hangul characters as two tokens
each. This estimate controls chunk granularity; the provider remains the final
authority on its real tokenizer and context limit.

All models use an independent 8000-character upstream chunk split threshold.
Oversized chunks are split into consecutive pieces without dropping their
tails. Exhausting `maxChunksPerPaper`, or exceeding Full mode's 30-Note source
cap, can make an item partially indexed.
The local Worker and server paths do not perform a second character-based cut.
Transformers.js feature extraction enables tokenizer truncation and therefore
uses each local model's `model_max_length` for a direct over-limit call. Exact
E5/BGE-M3 preflight counting logs that condition but does not replace the
tokenizer's automatic behavior with a ZotSeek error.

### Chunk Overlap

Currently, there is **no overlap** between chunks. Each paragraph belongs to exactly one chunk.

The paper title remains part of Summary/PDF embedding context where the existing chunker adds it. R1 Child Note embeddings also prepend the parent title after body chunking, followed by their section breadcrumb when one is reliable; faithful Note evidence remains unchanged.

**Why no overlap?**
- Keeps index size predictable
- Paragraphs are natural semantic boundaries in academic writing
- Avoids duplicate matches for the same content

Overlap is common in RAG systems (e.g., LangChain defaults to ~200 token overlap) and could be added as a future enhancement for cases where important information spans paragraph boundaries.

### PDF Preprocessing Parser Benchmark (Plan 11B)

The starting point of every PDF chunk is the per-page text a parser produces; parse quality
directly bounds packing boundaries and retrieval quality. Plan 11B compared 8 no-OCR profiles from
4 external parser packages against the production baseline `Zotero.PDFWorker.getFullText` on the
`10_Hyperscanning` corpus (153 PDFs / 2,362 pages) with unified Gold anchors and a canonical
comparison:

![PDF Parser Benchmark - Text Quality](images/plan11b-parser-quality.png)

Three conclusions read directly from the figure:

- **document-worker is the closest external candidate to the baseline**: critical expressions
  27/38, reading order 99/106, cross-column 20/20 and text retention 0.9991 — nearly tied with
  PDFWorker direct; its structure variant needs onnxruntime-web plus classifier/repair models
  (198 s isolated run) and the fulltext variant depends on Node-side PDF.js assets (72 s).
- **The Python-side packages (pdftext / ZRA / PyMuPDF4LLM) lose mainly on reading order and
  cross-column layout** (59-79 / 106 and 3-16 / 20), with text retention of only 0.94-0.98.
- The frozen decision was therefore to **keep PDFWorker direct as the production main chain**,
  with external structure capabilities reserved as optional sidecars (roles output: doc-worker
  structure 11/20, PyMuPDF4LLM layout 8/20).

Full methodology, per-package reviews and failure cases: `plan/archive/11B-外部PDF解析包无OCR基准比较报告.md`;
runtime costs (wall time 25-1,200 s per package) are in its runtime-dependency section.

### Chunk Max-Token Sweep and Cloud Token Limit Estimate (Plan 47/54)

How sensitive is retrieval to chunk size? Plan 54 re-embedded the Metadata + Notes corpus at
five `maxTokens` tiers (C500-C8000) with a cloud embedding and replayed the 50 questions. The
cloud model (qwen3.7-text-embedding, 1024-dim, DashScope) was used because re-embedding the
whole corpus for five tiers is only practical with batched cloud requests; therefore this figure
is about the TIER TREND and its absolute values cannot be compared with the E5-based matrices
elsewhere in this chapter.

![Chunk Max-Token Sweep - Retrieval Quality](images/plan54-chunk-tier-sweep.png)

Conclusion: none of the three search methods is sensitive to the tier - the current Hybrid holds
R@10 at 0.88-0.90 across all five tiers, BM25 stays at 0.85-0.87, and pure semantic degrades
mildly with larger chunks (R@10 0.96 -> 0.90). **So for advanced embedding models with generous
input limits, larger chunks are safe**: merging the same body text into bigger chunks reduces the
chunk count per paper (fewer vectors, smaller index, faster indexing) without a measurable loss
in the production default Hybrid ("no performance loss" is anchored on Hybrid; the mild semantic
front-rank decline is the known cost of very large tiers). On the PDF side both tiers (F2000 /
F4000) reach semantic R@10 0.91. The experiment did not change production chunk defaults.

Cloud models have no local tokenizer, so their token limit is validated with a conservative
estimator (`estimateCloudTokens()`, introduced in Plan 47; the estimator version is part of the
Cloud index strategy fingerprint only):

```
tokens = ceil(CJK characters x 2 + non-CJK words x 1.3)
```

- CJK characters (Han / Hiragana / Katakana / Hangul) count **2 tokens each**, the conservative
  end of the published Bailian guidance;
- non-CJK text is whitespace-split into words, **1.3 tokens each**; the result is rounded up.

Both the chunking `maxTokens` budget and the model hard input limit are validated against this
estimate for the Cloud runtime; E5/BGE-M3 keep exact tokenizer counting and Nomic keeps its own
estimator.

---

## Section-Aware Chunking

> In Full mode, the PDF text entering this stage has already been preprocessed
> by the `zotseek-pdf-main-text-indexing-v1` pipeline (main-attachment
> selection, PDFWorker direct extraction, References v2, page-furniture
> filtering and same-page packing); see
> [PDF Main-Text Preprocessing](#pdf-main-text-preprocessing).

### Academic Paper Structure

Unlike generic chunkers that split at arbitrary character boundaries, our chunker respects academic paper structure:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SECTION-AWARE CHUNKING                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  INPUT: Full PDF Text                                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Title: Deep Learning for Medical Diagnosis                   │   │
│  │                                                              │   │
│  │ Abstract: We propose a novel approach to medical...          │   │
│  │                                                              │   │
│  │ 1. Introduction                                              │   │
│  │ Machine learning has revolutionized healthcare...            │   │
│  │                                                              │   │
│  │ 2. Related Work                                              │   │
│  │ Prior studies by Smith et al. (2020) showed...              │   │
│  │                                                              │   │
│  │ 3. Methods                                                   │   │
│  │ We collected data from 500 patients...                       │   │
│  │                                                              │   │
│  │ 4. Results                                                   │   │
│  │ Our analysis shows 95% accuracy...                          │   │
│  │                                                              │   │
│  │ 5. Discussion                                                │   │
│  │ These findings suggest that AI can assist...                │   │
│  │                                                              │   │
│  │ 6. Conclusion                                                │   │
│  │ In summary, we demonstrated...                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  OUTPUT: Semantic Chunks                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │  CHUNK 1: summary                                            │  │
│  │  ├── Title + eligible Abstract + non-# Tags                   │  │
│  │  └── "What is this paper about?"                             │  │
│  │                                                              │  │
│  │  CHUNK 2-3: methods                                          │  │
│  │  ├── Introduction + Related Work + Methods                   │  │
│  │  └── "How did they do it?"                                   │  │
│  │                                                              │  │
│  │  CHUNK 4-5: findings                                         │  │
│  │  ├── Results + Discussion + Conclusion                       │  │
│  │  └── "What did they find?"                                   │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  SECTION PATTERNS DETECTED:                                         │
│  ├── Methods-like: Introduction, Background, Literature Review,     │
│  │                 Methods, Methodology, Materials, Data Collection │
│  │                                                                  │
│  └── Findings-like: Results, Findings, Evaluation, Discussion,     │
│                     Conclusions, Implications, Limitations         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Chunk Types and Display

| Chunk Type | Contains | Source Display | Purpose |
|------------|----------|----------------|---------|
| `summary` | Title + abstract (50+ chars) + non-`#` tags | "Abstract" | What is this paper about? |
| `methods` | Intro, Background, Methods | "Methods" | How did they do it? |
| `findings` | Results, Discussion, Conclusions | "Results" | What did they find? |
| `content` | Fallback (no sections detected) | "Content" | Generic content |
| `note` | Child Note body (structured heading-aware or plain paragraphs) | "Note" | What do the researcher's own notes say? |

### Fallback Behavior

When a PDF doesn't have recognizable section headers (e.g., book chapters, reports, non-standard formats):

1. **Section detection fails** - No "Results", "Methods", etc. found
2. **Fallback triggered** - Entire text split at paragraph boundaries
3. **Chunks labeled `content`** - Displays as "Content" in Source column

| Document Type | Chunks Created | Source Column Shows |
|---------------|----------------|---------------------|
| Standard academic paper | summary + methods + findings | Abstract, Methods, Results |
| Book chapter / Report | summary + content chunks | Abstract, Content, Content... |
| Abstract mode (`abstract`) | summary only | Abstract |
| No PDF, no abstract | title only | Abstract |

The search still works perfectly with `content` chunks - you just won't know which *part* of the document matched.

### References Filtering

The PDF preprocessor detects and excludes high-confidence bibliography regions to keep search results focused on actual content:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    REFERENCES FILTERING                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PDF TEXT PROCESSING:                                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Page 1: Abstract...                    ✓ INDEXED            │   │
│  │ Page 2: Introduction...                ✓ INDEXED            │   │
│  │ Page 3: Methods...                     ✓ INDEXED            │   │
│  │ Page 4: Results...                     ✓ INDEXED            │   │
│  │ Page 5: Discussion...                  ✓ INDEXED            │   │
│  │ Page 6: Conclusion...                  ✓ INDEXED            │   │
│  │ Page 7: References                     ✗ HEADER DETECTED    │   │
│  │         [1] Smith, J. (2021)...        ✗ SKIPPED            │   │
│  │         [2] Jones, A. (2020)...        ✗ SKIPPED            │   │
│  │ Page 8: More references...             ✗ SKIPPED            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  DETECTION PATTERNS:                                                 │
│  ├── Headers: "References", "Bibliography", "Works Cited",          │
│  │            "Literature Cited", "Citations"                        │
│  │                                                                   │
│  └── Citation entries (fallback if header missed):                  │
│      ├── [1], [2], [3]...         (numbered style)                  │
│      ├── 1. Author...              (numbered list)                  │
│      ├── Smith, J. A. (2021).     (APA style)                       │
│      ├── doi: 10.1234/...         (DOI pattern)                     │
│      └── pp. 123-456, Vol. 12     (publication details)             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

Production no longer uses a permanent chunker state that blindly discards every
line after the first References-like heading, nor does it independently delete
citation-looking body paragraphs. References v2 establishes document-level
regions from conservative headings, entry evidence and page progression, keeps
protected body locators, and records every excluded line in a diagnostic
ledger. Content after a bibliography, such as a publisher note, may remain
inside the excluded reference region because the product contract intentionally
indexes the main body rather than post-reference matter. If no high-confidence
region is found, the text remains visible.

### Performance-Optimized Chunking

See [Chunking Strategy](#chunking-strategy) for detailed trade-offs. Summary:

| Recommendation | Applies To | Time per Chunk (CPU/WASM) |
|----------------|-----------|---------------------------|
| 420 tokens | multilingual-e5-base (default) | ~0.4s |
| 2000 tokens | Nomic v1.5 / BGE-M3 | ~0.9s |

**Default settings:**
- `maxTokens`: model-aware — 420 for E5, 2000 for Nomic/BGE-M3, clamped by each model's hard limit
- `maxChunksPerPaper`: 100 — shared by Summary, Notes and PDF sources in Full mode
- Paragraph-aware splitting (never splits mid-paragraph); PDF chunks additionally pack adjacent short paragraphs on the same physical page

---

## Performance Optimizations

### Embedding Cache

Search uses vector, lexical and metadata-identity memory caches; only lexical has a disk snapshot. Vectors read a narrow active-model projection without chunk_text, decode to Float32Array and normalize in place; public getAll() remains complete and cross-model. BM25 prepares one active-model/fallback CSR index from a matching snapshot or rebuilds it.

The third cache is the Plan 44 metadata identity snapshot used by the Hybrid
prepass. It retains at most one library/collection scope and contains only
stable library/item identity, local item ID, title, DOI, year, and creator name
surfaces. It never retains `Zotero.Item`, abstracts, Notes, PDF text, chunks, or
embeddings. Its estimated logical payload is capped at 32 MiB; an oversized,
failed, stale, or destroyed build is discarded and the query uses the legacy
Zotero Search path.

Vector and lexical in-flight builds retain separate keyed single-flight and generation/model/lifecycle guards. Ordinary writes invalidate vectors but retain ready BM25 until startup/manual maintenance detects a revision change. Library/source restrictions share the base index.

Normal chunk writes increment the revision in their transaction; initialization creates a database identity. Snapshots match identity, revision, model, contracts and format, and verify SHA-256 and structural bounds without scanning corpus text. Builds wait for writers and recheck versions, retrying stale work at most once. Saves use a single-writer queue and same-directory temporary replacement; failure affects future reuse. External writes by older code that does not register revisions are outside this contract; explicitly refresh/remove snapshots after such restores or cross-version experiments.

Identical query embeddings also use an in-flight-only single-flight keyed by
the runtime model and exact query text. The promise is removed after success or
failure, so this does not retain a persistent query-result cache. Hybrid result
mapping batch-loads Zotero items and then restores input order; T0 tokenization
reuses one `Intl.Segmenter` instance. These optimizations do not change the
per-semantic-branch 50-candidate hydration window.

Paper-level Full Hybrid performs one scoped semantic scan and ranks it together
with Quick/BM25 keyword candidates; it no longer runs Metadata/Notes and PDF
specialists with fixed source slots. `searchPartitions()` and source specialists
remain for the `passages` compatibility path and must not be described as the
paper-level default.

The identity snapshot uses its own monotonic generation and keyed single-flight.
Item, collection-item, and collection Notifier events, relevant preference
changes, a new scope, and plugin shutdown invalidate the whole snapshot. A
generation check prevents an in-flight stale build from publishing. The
whole-scope snapshot is allowed to answer only a proven identity-negative query
directly. If any DOI, exact/distinctive title, author, or author-year match is
possible—including an ambiguous title fragment—the query is validated through
the original query-specific Zotero Search candidate gate. This keeps Zotero's
punctuation/tokenization and candidate semantics as the final authority while
removing that gate from ordinary concept-query hot paths.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CACHING ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  FIRST SEARCH (cache miss):                                         │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                    │
│  │  Query   │ ──► │  SQLite  │ ──► │  Cache   │                    │
│  │          │     │  (disk)  │     │  (RAM)   │                    │
│  └──────────┘     └──────────┘     └──────────┘                    │
│       │                                  │                          │
│       │     active-model projection      │                          │
│       └──────────────────────────────────┘                          │
│                                                                      │
│  SUBSEQUENT SEARCHES (cache hit):                                   │
│  ┌──────────┐     ┌──────────┐                                     │
│  │  Query   │ ──► │  Cache   │  ──► scoring + bounded hydration    │
│  │          │     │  (RAM)   │                                      │
│  └──────────┘     └──────────┘                                     │
│                                                                      │
│  CACHE CONTENTS:                                                    │
│  • Active-model pre-normalized Float32Arrays                       │
│  • Stable item identity, title, source and location metadata       │
│  • No chunk_text, abstract, hash, timestamp, or section paths      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Performance Benchmarks

Plan 43 measured the current Windows development corpus in Zotero 9.0.6:
150 Full-mode papers, 8,894 chunks, bundled `multilingual-e5-base`, REST
`topK=10`, papers granularity, and query
`mother child neural synchrony emotional regulation`.

| Operation | Before | After Plan 43 |
|-----------|--------|---------------|
| Two concurrent cold Full Hybrid requests | 12.065 / 12.352 s | 10.275 / 10.483 s |
| Five cache-invalidated rebuilds, median | 9.999 s | 8.731 s |
| Five rebuild cycles, post-GC Working Set | 2.010–2.092 GB | 1.939–1.952 GB |
| Rebuild-query pre-GC Working Set | 2.57–2.63 GB | 2.192–2.210 GB |
| Stable warm Full Hybrid, five requests | 3.042–3.500 s in Plan 40B; another D0 run was 2.644–2.772 s | 3.024–3.172 s |

All compared responses were byte-identical. Warm timings vary enough between
runs that Plan 43 does not claim a stable warm-latency win; its demonstrated
benefits are the cache-invalidated path and lower main-process memory. Working
Set includes the whole Zotero parent process, model, tokenizer, lexical index,
vector cache, UI, and temporary query objects; it is not a direct JavaScript
heap or isolated cache-size measurement. Preserve the exact corpus, process
state, cache state, and endpoint when comparing future results.

Plan 44 reused the same 150-paper / 8,894-chunk / E5 / Full corpus and froze a
new D0 before either change. D1's single semantic traversal preserved every
response byte and moved the fixed-query warm median only from 3.045942 s to
2.99 s (about 1.8%), so its demonstrated value is removal of duplicate work,
not a large standalone latency claim. D2's bounded identity cache produced a
final warm median of 1.329666 s, 55.5% below D1 and 56.3% below D0; its cold run
was 7.048830 s. The hot identity prepass fell from 1,271–1,530 ms to roughly
39–54 ms.

For the measured user library, the snapshot had 2,274 candidates and an
estimated logical payload of 1,950,580 bytes (about 1.86 MiB), far below the
32 MiB rejection cap. Five scope invalidation/rebuild cycles produced stable
whole-process deltas of about +7.7 MiB Working Set and +8.5 MiB Private Bytes;
explicit GC/CC reduced both figures, so no monotonic accumulation was observed.
All fixed and matrix response SHA-256 values remained identical to D0, and the
Browser Console confirmed `notes=50`, `pdf=50`, a single vector pass, and an
identity `cache-hit`. These figures are corpus-specific; group libraries and
substantially larger real libraries remain external validation boundaries.

---

## Embedding Model Registry

### Curated Model Set

ZotSeek separates basic model registration from input policy. The selectable
identity/loading registry lives in `src/core/model-registry.ts`; hard context
facts and ZotSeek chunk/runtime policy live in `src/core/model-input-config.ts`.

| Model ID | Label | Dims | Pooling | Prefixes | Bundled | Approx. size |
|----------|-------|------|---------|----------|---------|--------------|
| `nomic-embed-text-v1.5` | Nomic v1.5 (English, balanced) | 768 | mean | `search_query:` / `search_document:` | No | ~130 MB |
| `multilingual-e5-base` | Multilingual E5 base | 768 | mean | `query:` / `passage:` | Yes | ~282 MB |
| `bge-m3` | BGE-M3 (top multilingual) | 1024 | cls | none | No | ~570 MB |

Each `ModelConfig` specifies:
- `dimensions` — embedding vector length; determines cosine-similarity space. Embeddings from different models are **not** interchangeable.
- `pooling` — `mean` averages all token embeddings; `cls` uses the `[CLS]` token. Must match the model's training setup.
- `queryPrefix` / `docPrefix` — instruction strings prepended to queries and documents respectively. Nomic and E5 use these to shift the embedding towards retrieval mode; BGE-M3 does not need them. Whether instructions are required is derived from these strings.
- `onnxFile` — path within the Hugging Face repo to the quantized ONNX file.
- `bundled` — `true` only for the default model shipped inside the XPI (`chrome://zotseek/content/models/`). Non-bundled installed models are read from `zotseek-models/` inside the Zotero **profile** directory and served from `resource://zotseek-models/`. The Settings model picker always lists the three curated local models. Missing entries offer an allowlisted automatic download or a manual guide; neither changes the active model before installation succeeds.

`ModelInputConfig` additionally records `maxInputTokens`,
`recommendedChunkTokens`, the model's `chunkProfile`, its derived soft minimum,
`maxChunkChars`, tokenizer type, exact-count support and the actual local
quantization. The registry profile is the runtime source of truth for the
recommended size and soft minimum; local input facts are validated against it.
`maxChunkChars` is a lossless upstream split threshold, not an inference
truncation limit. Current local values are E5 512/420, Nomic 8192/2000 and
BGE-M3 8192/2000 (hard limit/recommendation); all local artifacts use Q8.

  Downloads used to go to the Zotero **data** directory, and models still there are read from `resource://zotseek-models-legacy/` so they keep working. The data directory is the one users relocate to a NAS, an external drive or a synced folder, and reading hundreds of MB of ONNX weights over a network share stalls the load outright, so weights (which are re-downloadable and are not user data) no longer follow the library.

### Partitioned Search by Model

Every embedding chunk in the database carries a `model_id` column. At query time:

```
Active model: "multilingual-e5-base"
                        │
                        ▼
         Filter chunks WHERE model_id = "multilingual-e5-base"
                        │
                        ▼
         Cosine similarity computed only within this partition
```

Embeddings from different models live side-by-side in the `chunks` table but are never compared against each other. Switching the active model in preferences changes which partition the next search reads from — without deleting or invalidating the other partitions.

### Switching Models

When the user changes the active model (`zotseek.embeddingModel` pref), the workflow is:

```
1. Persist new model_id via setActiveModelId()
2. Reload EmbeddingPipeline (re-reads getActiveModel() on next init)
3. Check item_models for items not yet covered by the new model
4. Offer background re-index for uncovered items
   ├── Items already indexed with the new model → instant, no re-work
   └── Items not yet indexed → queued for background embedding
5. Search immediately uses the new model's partition
   └── Results show only items indexed with the new model
```

Items indexed with the previous model retain their embeddings. Switching back to that model restores its full result set instantly without re-indexing.

### Model-Aware Indexing and find_similar

All read paths that gate or drive indexing work are model-aware via `item_models`:

- **`isIndexedByIdentity(libraryKey, itemKey, modelId)`** — used by auto-index and manual "Index Library." An item counts as covered only when a row exists in `item_models` for the active `model_id`. The result is that "Index Library" backfills items not yet covered by the active model, rather than skipping everything that was ever indexed.
- **`getItemChunksByIdentity(libraryKey, itemKey, modelId)`** and **`getChunkByPk(itemPk, chunkIndex, modelId)`** — used by `find_similar` / "Find Related Documents." They filter `chunks` by `model_id`, so the source item's embedding and all candidate embeddings come from the same model's vector space. Switching the active model changes which partition similarity is computed in.

Two model-aware triggers can re-index the library, both preserving embeddings from other models:
1. The prompt shown immediately after switching to a new model.
2. The toolbar / right-click **Index Library** action.

### Local-Server-Backed Embeddings

Issue #42 adds a second `runtime` to `ModelConfig` alongside the in-process ChromeWorker: `'server'`, shown to users as **Local Server**. It delegates embedding generation to a local OpenAI-compatible inference server (LM Studio, Ollama, llama.cpp or vLLM), all of which expose `POST /v1/embeddings` and `GET /v1/models` on localhost. The stable `server-slot` and `server:` machine values remain unchanged.

**Provider branch:** `EmbeddingPipeline.init()` reads the active model's `runtime` and initializes one of two code paths. Both converge on the same `embed()` / `embedDocuments()` call surface used by the rest of the search engine, so callers never branch on runtime themselves:

```
                         getActiveModel()
                                │
                                ▼
                       ┌─────────────────┐
                       │  model.runtime  │
                       └────────┬────────┘
                   'onnx'       │        'server'
             ┌──────────────────┴──────────────────┐
             ▼                                      ▼
     initWorker()                          initServerClient()
     ChromeWorker + Transformers.js         ServerEmbeddingClient
     (WASM, in-process)                     (HTTP, loopback-only)
             │                                      │
             ▼                                      ▼
     per-chunk embed, one retry            /v1/models checks name,
             │                              probe() checks dimensions,
             │                              then embed() in groups
             │                              of 32 chunks/request
             └──────────────────┬───────────────────┘
                                ▼
                    embedChunks() (src/index.ts)
                    shared by indexLibrary, auto-index,
                    and reindexForActiveModel
```

**Request batching:** the server runtime groups chunks into requests of `SERVER_EMBED_GROUP = 32` (`embedChunks()` in `src/index.ts`), one HTTP round-trip per group, rather than one request per chunk as the ONNX path does internally. This amortizes HTTP overhead across chunks; the response array is re-sorted by the `index` field the OpenAI embeddings API returns, so out-of-order responses cannot misalign chunk IDs with vectors.

**Advanced configuration template:** ZotSeek exposes one fixed Local Server slot, configured in `<Zotero profile>/zotseek-server-models.json`. Schema v2 has one `model` field: `null` means unconfigured (`Local Server (NONE)`), an invalid or partial object means incomplete (`Local Server (UNKNOWN)`), and one valid object produces `Local Server (<serverModelName>)`. ZotSeek creates an empty template with a complete example when the file is missing, validates it at startup, and copies only the ready model into `zotseek.serverModels` as a synchronous one-entry cache. The settings pane shows the path and validation result but does not edit the contract. Changes take effect after restarting Zotero.

**Selection versus model identity:** the model menu persists the stable `server-slot` selection value even while the slot is `NONE` or `UNKNOWN`. A ready template supplies a separate explicit `server:`-prefixed id (for example `server:nomic-embed-text-v1.5-lmstudio`); only this real id identifies the vector space in `chunks.model_id`, coverage and search. The placeholder selection id is never written to the database. If the actual model or its output dimensions change, the template should use a new id and receive its own index pass. Previous ONNX and server partitions remain untouched.

**Incomplete-selection behavior:** selecting an incomplete Local Server slot is allowed and survives restart, but it never falls back to an ONNX model. Clicking the slot or explicitly starting indexing, semantic/hybrid search or similar-document search shows a localized configuration summary with the template path and an **Open file location** action; Close and the title-bar close path only dismiss the prompt. The Settings path exposes the same file-manager action. Raw validator details are not inserted into localized UI text, while MCP/REST still returns the technical error as text. Startup and background reconciliation do not show a modal and skip work that needs embeddings; keyword-only search remains available. A damaged Local Server template is inert when a local model is selected.

**Prefix handling:** `queryPrefix` and `docPrefix` are required template fields and may be explicitly empty. ZotSeek does not infer them from the model name. The client applies the configured task prefix through the same `applyPrefix()` path used by ONNX models, so the server receives the final text. `docPrefix` is part of the index policy fingerprint and therefore triggers reconciliation when changed; `queryPrefix` affects future queries but does not invalidate stored document embeddings.

**Input limits:** `maxInputTokens` and `recommendedChunkTokens` are required fields in the single model object. They drive the same model input policy and user-override clamping as built-in models. Generic OpenAI-compatible servers do not expose a standard tokenizer API, so server counting remains estimated and ZotSeek does not silently truncate the final request. The configured budget is an advanced-user contract; the service still owns the definitive tokenizer and any final context-limit error.

**Failure semantics:** `ServerEmbeddingClient.embed()` retries network errors, timeouts and 5xx responses with a bounded backoff of 2s, 5s, then 15s; a 4xx response fails immediately (a configuration problem that retrying cannot fix). After the retry budget is exhausted, the client throws `ServerUnavailableError`, which propagates out of `embedChunks()` to the caller's outer catch and stops the run cleanly, the same way a cancellation does. There is deliberately **no fallback to the in-process ONNX model**: silently switching runtimes mid-run would mix two different vector spaces under one `model_id`. Update Index resumes from the same checkpoint mechanism used for any interrupted run once the server is back.

**Model and dimension guards:** `initServerClient()` first requires `GET /v1/models` to list the configured `serverModelName`, then calls `client.probe()` (a one-text `/v1/embeddings` request) and compares the returned vector length with the template's `dimensions`. Either mismatch throws before any chunk is embedded. The user must load the named model or correct the template; a changed model or dimension should receive a new `server:` id and a new index pass.

**Loopback enforcement:** every request URL, not just the configured base URL, passes through `assertLoopbackUrl()` at request time, which allow-lists `127.0.0.1`, `localhost` and `[::1]` and rejects everything else, including a redirect target (`fetch` is called with `redirect: 'error'`, so a redirect off-loopback aborts rather than being followed). There is no preference to disable this check.

### Cloud Embeddings

Cloud is a third, independent `ModelConfig.runtime`, organized as a provider/model catalog (Plan 56). Four providers are approved: `alibaba-bailian`, `openai`, `google-gemini-api`, and the `custom-openai-compatible` escape hatch. Built-in providers resolve every model fact (model name, dimensions, input limit, role contract, batch default, chunk profile, adapter version) from a registered catalog; users cannot type an arbitrary model name into a built-in provider, and a stored legacy value that does not match the catalog is marked unconfigured instead of being silently substituted. The built-in catalog registers Bailian `qwen3.7-text-embedding` (1024d, 128k input), OpenAI `text-embedding-3-small` (1536d, fixed 2000-token recommendation) and `text-embedding-3-large` (3072d), and Google `gemini-embedding-001` (768d of its 128–3072 range, 2048-token input). Ratio-cap profiles derive recommendations as `min(cap, floor(maxInputTokens × 0.85))` with a 25% soft minimum; Bailian and the Custom provider cap at 4000, Gemini's cap makes its recommendation 1740. Custom has no fabricated model profile: Base URL, model, dimensions and maximum input tokens remain blank until supplied by the user, and the recommended chunk value appears only after a valid maximum is available. In the absence of a local provider tokenizer, Cloud uses the conservative multilingual estimate described above to apply that recommendation; the estimator version is part of the Cloud-only index policy fingerprint so old and new chunk boundaries cannot silently mix. ZotSeek sends HTTP directly and does not depend on a provider SDK. The menu persists `cloud-slot`; provider, model name and dimensions derive the current vector-space identity, preserving `cloud:alibaba-bailian:qwen3.7-text-embedding:1024` for the Bailian default.

Request URLs are fixed for built-in providers. Bailian selects one of two official regional endpoints via a machine-valued region preference (`cn` or `intl`; a legacy `zotseek.cloud.baseUrl` pref migrates to the region selection); OpenAI and Gemini endpoints are hardcoded in their adapters. Only the Custom (OpenAI-compatible) provider accepts a user Base URL, which must be HTTPS, must not carry credentials, query parameters or fragments, and is joined with `/embeddings` following the OpenAI SDK convention. The Custom provider reuses the OpenAI request/response format but deliberately does not send the `dimensions` parameter (many compatible gateways reject unknown parameters); its configured dimension only validates responses. It is a single slot with its own preference namespace and credential, and it is the only provider that accepts a free model name.

Each provider has a dedicated request adapter behind one shared transport client. The Bailian adapter keeps the native DashScope `text-embedding` request (`/api/v1/services/embeddings/text-embedding/text-embedding`, `parameters.text_type`, `output_type=dense`) while the persisted shared Base URL stays on `/compatible-mode/v1` because the literature-brief client uses it for chat completion — and brief generation deliberately supports only Bailian: switching the embedding provider away from Bailian prompts for confirmation and clears the brief connection state. The OpenAI adapter posts `{model, input, dimensions}` with Bearer auth and sends the same body for query and document kinds (no task roles, no textual prefixes). The Gemini adapter posts `batchEmbedContents` with `x-goog-api-key`, one request per text, placing `taskType` (`RETRIEVAL_QUERY`/`RETRIEVAL_DOCUMENT`) and `outputDimensionality` directly on each request, matching the Google SDK and the verified 768-dimensional runtime response (`gemini-embedcontent-v2`). Cloud roles are provider API parameters rather than E5-style string prefixes; the adapter version, document-side role and per-provider output contract are part of the document index policy fingerprint, while the query role only affects future queries.

The shared client enforces each profile's configured batch size: Bailian defaults to 20 inputs, OpenAI and Gemini to 10, and an unconfigured Custom endpoint starts conservatively at 1 until the user supplies its contract. It restores provider response order (Bailian `text_index`, OpenAI `index`, Gemini input order) and accepts only non-zero vectors of exactly the configured finite dimensions. Network errors, 429 and 5xx responses use bounded retries; deterministic 4xx responses fail immediately. Provider response bodies are reduced to a bounded safe error code, so text, queries and credentials are never copied into logs or user errors. The connection probe submits one fixed document string and one fixed query string in separate requests and requires both to return the same dimension.

The API key is BYOK with one encrypted Login Manager entry per provider (the login username is the provider id), so providers keep independent keys and switching providers never overwrites another provider's credential; the historical Bailian entry already matches this scheme. Newer Zotero versions use `Zotero.OSKeyStore`, while Zotero 9.0 uses the bundled Mozilla `OSKeyStore.sys.mjs` compatibility path and accepts only ZotSeek-version-tagged ciphertext. Settings display only the first and last five characters with a fixed masked middle, per provider. Consent and connection verification are stored per provider with a read-only legacy fallback for Bailian, and Cloud initialization refuses to proceed without the current provider's consent, verification, and a configured catalog selection.

Startup maintenance has a second Cloud-specific authorization, disabled by default, in addition to the global automatic-maintenance preference. Manual indexing and searches remain explicit actions. A Cloud full rebuild shows only the estimated paper count. It does not clear the database first: all chunks for one paper must finish and validate before `replaceItemModelChunks()` atomically replaces that paper/model pair. Failure or cancellation therefore keeps the previous complete paper index, while completed papers and every other model partition remain available.

---

## Database Schema

ZotSeek stores embeddings in a separate SQLite database (`zotseek.sqlite`) attached to Zotero's main connection. The schema is normalized into three tables:

- **`items`** — one row per indexed paper, keyed by an internal autoincrement `item_pk`, with its stable identity (`library_key`, `item_key`) and metadata (title, abstract).
- **`chunks`** — one row per embedding chunk per model, referencing `item_pk`, with faithful chunk text, optional Child Note `section_paths`, optional exact `pdf_attachment_key`, source label, base64-encoded Float32 embedding, and location metadata (page, paragraph, char offsets, bbox).
- **`item_models`** — one row per (item, model), holding that pairing's indexing status: timestamp, content hash, and truncation/coverage fields (`was_truncated`, `pages_indexed`, `pages_total`).

The indexing status lives on `item_models` rather than `items` because it is inherently per-model; see [Per-Model Embeddings (Schema v9)](#per-model-embeddings-schema-v9) below.

### Stable Identity (Schema v8)

ZotSeek identifies indexed items using a stable `(library_key, item_key)` pair, decoupled from Zotero's mutable local IDs:

- `library_key`: `'user'` for the user library, or `'group:<groupID>'` where `<groupID>` is the server-assigned Zotero group ID.
- `item_key`: Zotero's 8-character `Item.key`, generated once at item creation and propagated by sync.

Both identifiers are stable across all machines syncing the same library, and survive Zotero reinstalls, profile rebuilds, and database moves. The `items` table uses an internal autoincrement `item_pk` as the primary key referenced by `chunks`. Local `Zotero.Item.id` values are resolved at runtime via `identity-resolver.ts` and never stored.

Migration from v7 to v8 resolves each row's identity using the stored `item_key` (which v7 already populated), so cross-machine database copies succeed even when local `item_id` values from the source machine no longer match the destination's local IDs.

### Per-Model Embeddings (Schema v9)

Schema v9 extends the database to hold embeddings from multiple models simultaneously:

**`chunks` table** — primary key promoted to `(item_pk, chunk_index, model_id)`. A given paragraph can now have one row per model, each with its own embedding vector. The search engine filters by the active `model_id` before computing cosine similarity, so results are always within a single model's embedding space.

**`item_models` table** — records per-(item, model) indexing status:
- `item_pk` (FK to `items`), `model_id` (composite PK together)
- `indexed_at`, `content_hash`, `was_truncated`, `pages_indexed`, `pages_total`

The per-item status columns (`was_truncated`, `pages_indexed`, `pages_total`) that were on the `items` table in v7/v8 are now on `item_models` because they are inherently per-(item, model): a paper may be fully indexed under one model but truncated under another if the chunk count varies. The `items` table loses these columns; queries check `item_models` for the active model.

**Migration v8 → v9:** existing `chunks` rows have `model_id` back-filled from the `items.model_id` column (which recorded the last model used to index that item). Rows from `items` that have per-item status columns are migrated into `item_models` for each item's recorded model. A backup is written to `zotseek.sqlite.v8.bak` before the migration starts.

### Child Note Paths (Schema v11)

Schema v11 adds nullable `chunks.section_paths`, encoded as JSON `string[][]`. Existing rows migrate in place with `NULL`; vectors are not silently rewritten. The independent `chunk_strategy_version:<modelId>` metadata marker determines whether a non-empty model partition may receive new writes. Missing or older markers pause incremental writes and prompt for a full rebuild, so chunks produced by different Note strategies are never mixed within one model partition.

### Exact PDF Source (Schema v12)

Schema v12 adds nullable `chunks.pdf_attachment_key`. New Full-mode PDF chunks store the stable attachment key selected by the main-PDF classifier; Summary, Metadata, and Note chunks keep `NULL`. Migration never guesses a source for existing rows. Search fetches the key only for visible matched chunks and exposes it as `matchedChunk.pdfAttachmentKey`, allowing `get_item` and deep links to read the exact PDF that produced the hit. A Full-only freshness contract marks old Full indexes for refresh, while Abstract and Metadata + Notes indexes remain current because they do not contain PDF chunks.

---

## Query Analysis

Paper-level Hybrid does not change channel weights based on query language,
length, question form or detected patterns. All three indexing modes use the
fixed 0.05 bonus cap. `hybridSearch.autoAdjustWeights` and the historical
query-weight analysis below remain only for legacy configuration and passage
compatibility paths; they do not affect current `papers` ranking.

The metadata identity prepass emits timing diagnostics for Zotero Search, bulk `Zotero.Items.getAsync()` loading, candidate filtering, classification and final result preparation, together with candidate counts and the match kind. These diagnostics do not include the query, creator list, DOI or document text.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      QUERY ANALYSIS                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  KEYWORD BOOSTERS (favor exact matching):                           │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Pattern              │ Example              │ Boost            ││
│  ├──────────────────────┼──────────────────────┼──────────────────┤│
│  │ Year present         │ "Smith 2023"         │ +15% keyword     ││
│  │ Author pattern       │ "Jones et al."       │ +20% keyword     ││
│  │ Acronym              │ "RLHF models"        │ +10% keyword     ││
│  │ Quoted phrase        │ "machine learning"   │ +15% keyword     ││
│  │ Special characters   │ "p < 0.05"           │ +10% keyword     ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  SEMANTIC BOOSTERS (favor meaning matching):                        │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Pattern              │ Example                      │ Boost    ││
│  ├──────────────────────┼──────────────────────────────┼──────────┤│
│  │ Question format      │ "how does AI affect..."      │ +15% sem ││
│  │ Conceptual (4+ words)│ "trust in automated systems" │ +10% sem ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  EXAMPLES:                                                          │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Query                        │ Weight │ Reasoning              ││
│  ├──────────────────────────────┼────────┼────────────────────────┤│
│  │ "Smith 2023"                 │ 35%/65%│ Year + author pattern  ││
│  │ "how does AI affect trust"   │ 65%/35%│ Question + conceptual  ││
│  │ "machine learning"           │ 50%/50%│ Balanced query         ││
│  │ "PRISMA 2020 guidelines"     │ 25%/75%│ Acronym + year         ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Keyword-branch scoring (current Keyword mode and Hybrid Q/L stage)

The keyword branch always contains Quick Search and BM25. Keyword mode merges
the two sources per paper and returns that keyword ranking. Paper-level Hybrid
keeps their ranks and combines them into K50 with equal-weight RRF `k=10`, then
uses only the K50 rank as the bounded bonus in the final formula:

**1) T0 BM25 ranking.** Query and documents use the same T0 tokenization (natural words + CJK bigrams); scoring and source-isolation rules are in [BM25 Pipeline](#bm25-pipeline). Only the best chunk per paper enters the ranking; standalone BM25 output is normalized by the query's best hit to [0, 1]. Paper-level Hybrid uses that hit's K50 rank in the final formula rather than adding the normalized value directly to the semantic score.

**2) Zotero quicksearch heuristic scoring.** Quick search does not rank by relevance, so the plugin re-ranks by match quality:

```
Base score: 0.50 (any match)

Bonuses:
├── Title match:     +0.30 × (matched_terms / total_terms)
├── All in title:    +0.15 (if ALL query terms appear in title)
├── Year match:      +0.15 (if query contains the paper's year)
└── Author match:    +0.10 (if query matches author last name, 3+ chars)

Maximum: 1.00 (100%)
```

**3) Per-item merge.** Hits from both sources merge by stable paper identity. Keyword and paper Hybrid share Q/L K50, keeping both ranks to compute `0.5/(10+rankQ)+0.5/(10+rankL)`; it does not add a BM25 raw or normalized value directly to the semantic score. Special rules:

- Note hits returned by quicksearch map back to their parent item and are re-scored against clean note text: a full-phrase containment scores 1.0 directly, partial term hits score `0.65 + 0.3 × (matched terms / query terms)`; if quicksearch only matched content that the index-side filters out (such as the "basic information" or References sections), the hit is dropped.
- Explicit Keyword and paper Hybrid both use `quicksearch-everything`; BM25 source restrictions do not change the Quick entry point.
- Book exclusion, library and collection constraints apply to both sources equally.

Keyword mode keeps the top `keywordTopK` entries after this merge. Hybrid keeps the top `keywordTopK` as K50, then applies the paper-level bounded lexical-bonus formula; the final formula does not consume normalized BM25 values.


---

## Configuration

### Search Settings

| Preference | Default | Description |
|------------|---------|-------------|
| `hybridSearch.mode` | `"hybrid"` | `"hybrid"`, `"semantic"`, or `"keyword"` |
| `hybridSearch.semanticWeightPercent` | `50` | Compatibility parameter for the old RRF path; unused by bounded Hybrid |
| `hybridSearch.rrfK` | `60` | Compatibility constant for the legacy passage RRF path; paper-level Hybrid fixes Q/L K50 at `k=10` |
| `hybridSearch.autoAdjustWeights` | `true` | Compatibility switch for the old RRF path; bounded Hybrid keeps a fixed score contract |

### Chunking Settings

| Preference | Default | Description |
|------------|---------|-------------|
| `indexingMode` | `"notes"` | `"abstract"`, `"notes"`, or `"full"` |
| `maxTokens` | model-aware | Recommended body tokens, clamped by the model policy |
| `maxChunksPerPaper` | `100` | Max chunks per paper |

### Chunk Size Trade-offs (Historical Note)

Upstream once compared maxTokens=512 vs 2000 with citation pairs (A cites B as ground truth) over 646 papers and 486 queries: retrieval quality differences were negligible (<1% on every metric) and indexing speed was close — most papers hit the `maxChunksPerPaper` ceiling, so the effective bottleneck is the per-paper quota, not chunk granularity. That evaluation used the upstream framework since removed from the repository; the numbers are kept as historical reference only. This fork's retrieval-quality scores come from the `hyperscanning-benchmark` 50-question system and the `heuristic/eval` end-to-end measurements.


---

## Summary

ZotSeek's search combines three mechanisms:

1. **Identity navigation** — exact DOI / title / author queries resolve directly from Zotero metadata, validated through the original Zotero Search gate
2. **Semantic understanding** — AI embeddings capture meaning, with R1 breadcrumbs adding document structure
3. **Lexical precision** — T0 BM25 (Intl.Segmenter + CJK bigrams) ranks exact terms in Notes and PDF text
4. **Keyword branch** — BM25 and Zotero quicksearch heuristic scores merge per item, covering both exact body hits and metadata retrieval
5. **Paper-level Hybrid fusion** — equal-weight RRF `k=10` combines Q/L into K50, then semantic MaxSim plus a lexical rank bonus capped at 0.05 ranks the union; Full does not allocate Notes/PDF source slots
6. **Performance** — narrow-projection vector cache, keyed single-flight builds and a bounded identity snapshot keep hot queries fast

The combination finds conceptually related papers, resolves identity queries exactly, and guarantees that original terms in notes and body text remain retrievable.

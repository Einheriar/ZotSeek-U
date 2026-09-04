# Search Architecture

A comprehensive guide to how semantic and hybrid search works in ZotSeek.

---

## Table of Contents

1. [Overview](#overview)
2. [Search Modes](#search-modes)
3. [Hybrid Search with RRF](#hybrid-search-with-rrf)
4. [Multi-Query Search](#multi-query-search)
   - [AND/OR Combination](#andor-combination)
   - [AND Combination Formulas](#and-combination-formulas)
5. [Semantic Search Pipeline](#semantic-search-pipeline)
   - [MaxSim Aggregation](#maxsim-aggregation)
   - [Parent-Child Retrieval Pattern](#parent-child-retrieval-pattern)
6. [Chunking Strategy](#chunking-strategy)
   - [Trade-offs: Chunk Size Selection](#trade-offs-chunk-size-selection)
   - [Version-Aware Defaults](#version-aware-defaults)
   - [Paragraph-Based Chunking](#paragraph-based-chunking)
   - [Truncation Detection (Max Chunks per Paper)](#truncation-detection-max-chunks-per-paper)
   - [Token Estimation](#token-estimation)
   - [Chunk Overlap](#chunk-overlap)
7. [Section-Aware Chunking](#section-aware-chunking)
   - [References Filtering](#references-filtering)
8. [Performance Optimizations](#performance-optimizations)
9. [Embedding Model Registry](#embedding-model-registry)
   - [Curated Model Set](#curated-model-set)
   - [Partitioned Search by Model](#partitioned-search-by-model)
   - [Switching Models](#switching-models)
   - [Local-Server-Backed Embeddings](#local-server-backed-embeddings)
   - [Cloud Embeddings](#cloud-embeddings)
10. [Database Schema](#database-schema)
    - [Stable Identity (Schema v8)](#stable-identity-schema-v8)
    - [Per-Model Embeddings (Schema v9)](#per-model-embeddings-schema-v9)
11. [Query Analysis](#query-analysis)

---

## Overview

The plugin offers three search modes, each optimized for different use cases:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SEARCH ARCHITECTURE OVERVIEW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              USER QUERY                                      │
│                                  │                                           │
│                                  ▼                                           │
│                       ┌───────────────────┐                                  │
│                       │   Query Analyzer  │                                  │
│                       │   (Auto-weights)  │                                  │
│                       └─────────┬─────────┘                                  │
│                                 │                                            │
│              ┌──────────────────┼──────────────────┐                         │
│              │                  │                  │                         │
│              ▼                  ▼                  ▼                         │
│    ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐                │
│    │ 🧠 Semantic      │ │ 🔗 Hybrid     │ │ 🔤 Keyword      │                │
│    │ (Embeddings)    │ │ (RRF Fusion)  │ │ (Zotero Search) │                │
│    └────────┬────────┘ └───────┬───────┘ └────────┬────────┘                │
│             │                  │                  │                          │
│             │         ┌───────┴───────┐          │                          │
│             │         │               │          │                          │
│             ▼         ▼               ▼          ▼                          │
│    ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│    │ Cosine     │ │ Semantic   │ │ Keyword    │ │ Title/     │             │
│    │ Similarity │ │ Results    │ │ Results    │ │ Author/    │             │
│    └────────────┘ └─────┬──────┘ └─────┬──────┘ │ Year Match │             │
│                         │              │        └────────────┘             │
│                         └──────┬───────┘                                    │
│                                │                                            │
│                                ▼                                            │
│                    ┌───────────────────────┐                                │
│                    │  Reciprocal Rank      │                                │
│                    │  Fusion (RRF)         │                                │
│                    │                       │                                │
│                    │  score = Σ 1/(k+rank) │                                │
│                    └───────────┬───────────┘                                │
│                                │                                            │
│                                ▼                                            │
│                    ┌───────────────────────┐                                │
│                    │   RANKED RESULTS      │                                │
│                    │   with indicators:    │                                │
│                    │   🔗 Both sources     │                                │
│                    │   🧠 Semantic only    │                                │
│                    │   🔤 Keyword only     │                                │
│                    └───────────────────────┘                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Search Modes

### 🔗 Hybrid (Recommended)

Hybrid is the product-default entry point. It first performs metadata-only
identity navigation for exact DOI/title, unique distinctive title fragments and
author collections, then selects a content strategy from the stable indexing
mode. A Latin title fragment needs at least three words and 12 characters; a
continuous CJK fragment needs at least six characters. Weaker or ambiguous
fragments abstain and keep the semantic/content path:

| Indexing mode | Default content strategy |
|---------------|--------------------------|
| `abstract` | semantic-only |
| `notes` | R1 Metadata + Notes semantic and T0 BM25, RRF (`k=60`) |
| `full` | first two papers from the Notes H1 specialist, then PDF semantic results |

The Full result allocation is source-aware: it de-duplicates papers, lets PDF
fill the tail, and falls back to remaining Notes results only when PDF cannot
fill the requested result count. For `topK=10` this is the finalized product `2+8`
contract. Other result counts keep at most two Notes head slots. Passage mode
uses the same positional rule but has not received the paper-level Plan 37
paired validation.

| Query Type | Pure Semantic | Pure Keyword | Hybrid |
|------------|---------------|--------------|--------|
| "trust in AI" | ✅ Great | ❌ Poor | ✅ Great |
| "Smith 2023" | ❌ Poor | ✅ Great | ✅ Great |
| "RLHF" | ⚠️ Maybe | ✅ Exact only | ✅ Both |
| "automation bias healthcare" | ✅ Good | ⚠️ Partial | ✅ Best |

### 🧠 Semantic Only

Uses AI embeddings to find conceptually related papers, even with different wording.

**Best for:**
- Conceptual queries: "how does automation affect human decision making"
- Finding related work with different terminology
- Exploratory research

**Limitations:**
- Doesn't understand author names or years
- May miss exact technical terms

### 🔤 Keyword Only

Uses Zotero's built-in quick search on titles, authors, years, tags.

**Best for:**
- Author searches: "Smith 2023"
- Exact terms: "PRISMA 2020"
- Tag-based filtering

**Limitations:**
- No semantic understanding
- Won't find synonyms or related concepts

---

## Hybrid Search with RRF

### What is Reciprocal Rank Fusion?

RRF is a technique for combining ranked lists from different search systems without requiring score normalization or tuning.

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
    │ KEYWORD SEARCH (by relevance):                                  │
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

### Why RRF?

| Property | Benefit |
|----------|---------|
| **No score normalization** | Works on ranks, not raw scores |
| **No tuning required** | k=60 works well across domains |
| **Robust** | Top results from ANY source get boosted |
| **Production-proven** | Used by Elasticsearch, Vespa, Pinecone |

### Result Indicators

| Icon | Meaning | Interpretation |
|------|---------|----------------|
| 🔗 | Found by BOTH | High confidence - matches semantically AND by keywords |
| 🧠 | Semantic only | Conceptually related but may use different terminology |
| 🔤 | Keyword only | Exact match but not indexed for semantic search |

---

## Multi-Query Search

ZotSeek supports combining up to 4 search queries with AND/OR logic to find papers at the intersection of multiple topics.

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
│  │ Operator: AND (Minimum formula)                                       │ │
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
│  SCORE COMBINATION (AND with Minimum formula):                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ Paper A: min(0.85, 0.72, 0.68) = 0.68                                 │ │
│  │ Paper B: EXCLUDED (doesn't match all queries)                         │ │
│  │ Paper C: min(0.78, 0.81, 0.75) = 0.75  ← HIGHEST                      │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                               │                                           │
│                               ▼                                           │
│  FINAL RANKING:                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Paper C: 75% (78|81|75)  ← combined score (per-query scores)       │ │
│  │ 2. Paper A: 68% (85|72|68)                                            │ │
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
- Combined score determined by the selected formula (see below)
- Best for finding papers at the intersection of multiple topics

**OR Mode:**
- Papers appearing in ANY query result are included
- Combined score = maximum score across all queries
- Best for broadening search with synonyms or related terms

### AND Combination Formulas

When using AND mode, three formulas are available for combining scores:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AND COMBINATION FORMULAS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Example: Paper scores for 3 queries = [0.85, 0.72, 0.68]                   │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ MINIMUM (default)                                                     │ │
│  │ Formula: min(scores)                                                  │ │
│  │ Result:  min(0.85, 0.72, 0.68) = 0.68                                 │ │
│  │                                                                       │ │
│  │ Behavior: Score limited by weakest query match                        │ │
│  │ Use when: You want strict intersection - paper must be                │ │
│  │           strongly relevant to ALL queries                            │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ PRODUCT (geometric mean)                                              │ │
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
73% (85|72|68)
 │    └──┴──┴── Individual query scores (Q1|Q2|Q3)
 └───────────── Combined score using selected formula
```

This helps users understand which queries matched strongly and which were weaker.

---

## Semantic Search Pipeline

### Embedding Generation

```
┌─────────────────────────────────────────────────────────────────────┐
│                     EMBEDDING PIPELINE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  INPUT TEXT                           EMBEDDING VECTOR               │
│  ┌─────────────────────────┐         ┌─────────────────────┐        │
│  │ "Machine learning for   │         │ [0.023, -0.045,     │        │
│  │  medical diagnosis      │   →     │  0.012, 0.089,      │        │
│  │  using deep neural      │         │  -0.034, 0.056,     │        │
│  │  networks..."           │         │  ... 768 values]    │        │
│  └─────────────────────────┘         └─────────────────────┘        │
│                                                                      │
│  MODEL: nomic-embed-text-v1.5                                       │
│  ├── Context: 8192 tokens                                           │
│  ├── Dimensions: 768                                                │
│  ├── Size: 131MB (quantized)                                        │
│  └── Quality: Outperforms OpenAI text-embedding-3-small             │
│                                                                      │
│  INSTRUCTION PREFIXES (improve retrieval quality):                   │
│  ├── Documents: "search_document: <text>"                           │
│  └── Queries:   "search_query: <text>"                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
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

## Chunking Strategy

### Trade-offs: Chunk Size Selection

Embedding time scales **O(n²)** with sequence length due to transformer attention. Chunk size directly impacts both indexing speed and search quality:

| Chunk Size | Speed | Precision | Recall | Best For |
|------------|-------|-----------|--------|----------|
| **500-800 tokens** | Very fast (~0.3-0.5s/chunk) | High | Lower | Finding specific claims, methods, passages |
| **2000 tokens** | Moderate (~3s/chunk) | Balanced | Balanced | Long-context model default |
| **4000+ tokens** | Slow (~10s+/chunk) | Lower | Higher | Finding papers about broad topics |
| **7000 tokens** | Very slow (~45s/chunk) | Low | High | Not recommended |

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
3. Greedily combine adjacent small sections using `recommendedChunkTokens / 4` as a soft minimum, but never merge across an `h2` boundary or across different Zotero Child Notes.
4. Store faithful evidence in `chunk_text`. After the Note body has completed its existing split, R1 adds `文献：<父文献标题>` and, when available, `章节：...` only to `embedText`; these artificial prefixes are not shown as quoted evidence and do not enter BM25.
5. Persist all represented paths as `sectionPaths: string[][]`, because one compact chunk may contain several adjacent subsections.

The parent title breadcrumb is added after body chunking, so it does not consume
the recommended Note body budget or change boundaries. The model hard limit
still governs the final inference input. The brief's filtered “基本信息” section
is not restored. The selected strategy is versioned; strategy 8 introduces R1.
If an existing model partition contains old chunks without the current strategy
marker, ZotSeek keeps it searchable but pauses writes and background
reconciliation until the user explicitly rebuilds the index.

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

This retains the historical mode semantics, including Abstract's short-summary
guard and exclusion of tags. In particular, Full to Abstract never reads PDF or
Child Notes and needs at most the target Summary embeddings. Notes to Full adds
PDF while reusing compatible Metadata and the first 30 Notes. Full to Notes can
reuse its stored Notes but must embed any target Notes beyond Full's 30-Note cap.
The per-item replacement remains atomic, so a missing new embedding cannot
destroy a complete old item index.

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

---

## Section-Aware Chunking

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
│  │  ├── Title + Abstract                                        │  │
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
| `summary` | Title + Abstract | "Abstract" | What is this paper about? |
| `methods` | Intro, Background, Methods | "Methods" | How did they do it? |
| `findings` | Results, Discussion, Conclusions | "Results" | What did they find? |
| `content` | Fallback (no sections detected) | "Content" | Generic content |

### Fallback Behavior

When a PDF doesn't have recognizable section headers (e.g., book chapters, reports, non-standard formats):

1. **Section detection fails** - No "Results", "Methods", etc. found
2. **Fallback triggered** - Entire text split at paragraph boundaries
3. **Chunks labeled `content`** - Displays as "Content" in Source column

| Document Type | Chunks Created | Source Column Shows |
|---------------|----------------|---------------------|
| Standard academic paper | summary + methods + findings | Abstract, Methods, Results |
| Book chapter / Report | summary + content chunks | Abstract, Content, Content... |
| Abstract-only mode | summary only | Abstract |
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

| Chunk Size | Time per Chunk | Notes |
|------------|----------------|-------|
| 7000 tokens | ~45 seconds | Too slow for practical use |
| 2000 tokens | ~3 seconds | **Default** |
| 800 tokens | ~0.5 seconds | Higher precision, finds specific passages |
| 500 tokens | ~0.3 seconds | Fastest, highest precision |

**Default settings:**
- `maxTokens`: 2000 — tuned for Firefox 140+ WASM
- `maxChunksPerPaper`: 100 — covers most full papers
- Paragraph-aware splitting (never splits mid-paragraph)

---

## Performance Optimizations

### Embedding Cache

Search uses three process-local, non-persistent caches. The semantic cache holds
pre-normalized vectors for all stored model partitions plus lightweight source
and location metadata; it deliberately excludes `chunk_text`. Since Plan 43,
the vector cache reads only the active model and only this narrow projection
from SQLite, decodes stored vectors directly to `Float32Array`, and normalizes
them in place. The public `getAll()` bulk contract remains complete and
cross-model. The T0 lexical cache holds one in-memory BM25 index for the
active-model/fallback corpus. Both caches are lost when Zotero exits, so the
first corresponding query after startup or invalidation rebuilds them from
`zotseek.sqlite`.

The third cache is the Plan 44 metadata identity snapshot used by the Hybrid
prepass. It retains at most one library/collection scope and contains only
stable library/item identity, local item ID, title, DOI, year, and creator name
surfaces. It never retains `Zotero.Item`, abstracts, Notes, PDF text, chunks, or
embeddings. Its estimated logical payload is capped at 32 MiB; an oversized,
failed, stale, or destroyed build is discarded and the query uses the legacy
Zotero Search path.

Both caches share a monotonically increasing mutation generation but use
independent keyed single-flight builds. Concurrent cold semantic queries for the
same generation share one vector read, while concurrent lexical queries for the
same model and generation share one corpus read and tokenization pass. Library
and source restrictions are applied when searching the shared base index; they
do not create full per-library or per-source cache copies.

A build publishes only if its generation, active model where applicable, and
store lifecycle are still current when it completes. A successful index write,
clear, model deletion, database reattachment, compaction, or store close first
invalidates publication eligibility. If a build becomes stale it is discarded
and retried once. Continued indexing can therefore temporarily omit index-side
BM25 evidence; a repeatedly invalidated vector build preserves its error
semantics and is converted to an empty semantic branch by the Hybrid layer. No
known-stale or potentially mixed cache is returned. The next query after writes
settle rebuilds normally, without requiring a restart or index clear.

Identical query embeddings also use an in-flight-only single-flight keyed by
the runtime model and exact query text. The promise is removed after success or
failure, so this does not retain a persistent query-result cache. Hybrid result
mapping batch-loads Zotero items and then restores input order; T0 tokenization
reuses one `Intl.Segmenter` instance. These optimizations do not change the
per-semantic-branch 50-candidate hydration window.

Full's default Hybrid policy uses `searchPartitions()` to share one query
embedding, one active-model vector-cache filter, and one dot-product traversal
between the Metadata/Notes and PDF semantic specialists. Each specialist still
owns its independent MaxSim state, source filter, stable tie-break, Top-50
window, and snippet hydration. The shared scan therefore does not form a global
50-result window before splitting sources, and the later Notes-2/PDF-tail
allocation and RRF behavior are unchanged.

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
`recommendedChunkTokens`, `maxChunkChars`, tokenizer type, exact-count support
and the actual local quantization. `maxChunkChars` is a lossless upstream split
threshold, not an inference truncation limit. Current values are E5 512/420,
Nomic 8192/2000 and BGE-M3 8192/2000 (hard limit/recommendation); all local
artifacts use Q8.

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

- **`isIndexedByIdentity(libraryKey, itemKey, modelId)`** — used by auto-index, manual "Index Library," and the "Index remaining" button. An item counts as covered only when a row exists in `item_models` for the active `model_id`. The result is that "Index Library" backfills items not yet covered by the active model, rather than skipping everything that was ever indexed.
- **`getItemChunksByIdentity(libraryKey, itemKey, modelId)`** and **`getChunkByPk(itemPk, chunkIndex, modelId)`** — used by `find_similar` / "Find Related Documents." They filter `chunks` by `model_id`, so the source item's embedding and all candidate embeddings come from the same model's vector space. Switching the active model changes which partition similarity is computed in.

Three model-aware triggers can re-index the library, all preserving embeddings from other models:
1. The prompt shown immediately after switching to a new model.
2. The **Index remaining N** button on the coverage line in Settings (shows count of items lacking coverage for the active model).
3. The toolbar / right-click **Index Library** action.

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

Cloud is a third, independent `ModelConfig.runtime`. The first provider is Alibaba Cloud Model Studio (Bailian), using the OpenAI-compatible `POST /embeddings` endpoint at `https://dashscope.aliyuncs.com/compatible-mode/v1`. The preset starts with `qwen3.7-text-embedding`, 1024 dimensions, a 128000-token input limit and batches of 20, while model name, dimensions and model-input parameters remain user-configurable. Recommended chunk tokens are derived as `min(3000, floor(maxInputTokens * 0.85))`. In the absence of a local provider tokenizer, Cloud uses the conservative multilingual estimate described above to apply that recommendation; the estimator version is part of the Cloud-only index policy fingerprint so old and new chunk boundaries cannot silently mix. ZotSeek sends HTTP directly and does not depend on the OpenAI SDK. The menu persists `cloud-slot`; provider, model name and dimensions derive the current vector-space identity, preserving `cloud:alibaba-bailian:qwen3.7-text-embedding:1024` for the default preset.

Local Server and Cloud configuration are separate collapsed Settings sections; Cloud has a second collapsed advanced-parameter section. Selecting the Bailian provider supplies its default Base URL, which remains editable for an allowlisted workspace endpoint. The URL must use HTTPS, may not contain credentials, query parameters or fragments, and is invalidated for use until a direct embedding probe succeeds. Redirects are rejected. The probe submits one full configured batch of fixed strings, and responses are accepted only when every input has one unique indexed vector containing exactly the configured number of finite values. Network errors, 429 and 5xx responses use bounded retries; deterministic 4xx responses fail immediately. Provider response bodies are reduced to a bounded safe error code, so text, queries and credentials are never copied into logs or user errors.

The API key is BYOK. It is entered with a password-style masked prompt and stored only through Zotero Login Manager after OS-backed encryption; there is no preference or plaintext fallback. Newer Zotero versions use `Zotero.OSKeyStore`, while Zotero 9.0 uses the bundled Mozilla `OSKeyStore.sys.mjs` compatibility path and accepts only ZotSeek-version-tagged ciphertext. Settings display only the first and last five characters with a fixed masked middle. Before the first Cloud selection, ZotSeek explains that indexed text and semantic/hybrid queries leave the device, the provider may charge the user, and ZotSeek neither receives nor participates in those fees. Consent is versioned and Cloud initialization refuses to proceed if it is no longer current.

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

When automatic weight adjustment is enabled, query analysis tunes only the
semantic/lexical share inside the Notes H1 specialist. It does not change the
Full 2+N source allocation, and Abstract content search remains semantic after
metadata identity navigation:

The metadata identity prepass emits timing diagnostics for Zotero Search,
bulk `Zotero.Items.getAsync()` loading, candidate filtering, classification and
final result preparation, together with candidate counts and the match kind.
These diagnostics do not include the query, creator list, DOI or document text.

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

### Keyword Scoring

Stored faithful chunk text is ranked by the frozen T0 contract:

- `Intl.Segmenter('zh-Hans', { granularity: 'word' })` natural terms;
- shared CJK bigrams;
- maximum TF when natural and bigram channels produce the same term;
- BM25 `k1=1.2`, `b=0.75`, with no library-term patch.

The first lexical query builds a process-local in-memory cache. For each paper,
chunks from the active model are preferred; if that paper has not yet been
rebuilt for the active model, one deterministic fallback model partition keeps
lexical retrieval available during migration without mixing two copies of the
same paper. Index mutations, clearing, model changes and database reattachment
invalidate the cache or prevent an obsolete build from publishing. Same-key
concurrent cold queries join one build; an invalidated build retries once and
then safely omits index-side lexical evidence until a later stable query.
Semantic vectors are not decoded while building it. Build diagnostics report
model, chunk count, faithful-text character/UTF-8 byte counts, unique terms,
postings and elapsed time without logging corpus text.
Source-restricted specialists calculate corpus statistics after restricting to
their Metadata/Notes or PDF source set.

Zotero quick search remains the metadata fallback. Its local score uses:

```
Base score: 0.50 (any match)

Bonuses:
├── Title match:     +0.30 × (matched_terms / total_terms)
├── All in title:    +0.15 (if ALL query terms appear in title)
├── Year match:      +0.15 (if query contains the paper's year)
└── Author match:    +0.10 (if query matches author last name, 3+ chars)

Maximum: 1.00 (100%)
```

---

## Configuration

### Search Settings

| Preference | Default | Description |
|------------|---------|-------------|
| `hybridSearch.mode` | `"hybrid"` | `"hybrid"`, `"semantic"`, or `"keyword"` |
| `hybridSearch.semanticWeightPercent` | `50` | H1 balance when automatic adjustment is disabled |
| `hybridSearch.rrfK` | `60` | RRF constant (higher = more weight to top ranks) |
| `hybridSearch.autoAdjustWeights` | `true` | Tune the Notes H1 semantic/lexical share; never changes Full's 2+N allocation |

### Chunking Settings

| Preference | Default | Description |
|------------|---------|-------------|
| `indexingMode` | `"notes"` | `"abstract"`, `"notes"`, or `"full"` |
| `maxTokens` | model-aware | Recommended body tokens, clamped by the model policy |
| `maxChunksPerPaper` | `100` | Max chunks per paper |

### Chunk Size Trade-offs (Empirical Analysis)

A retrieval evaluation comparing maxTokens=512 vs maxTokens=2000 was conducted using 486 citation-pair queries across 646 papers. Citation pairs (A cites B) served as ground truth: when searching with paper A's abstract, cited paper B should appear in the top results.

**Quality results (no meaningful difference):**

| Metric | 512 tokens | 2000 tokens | Delta |
|--------|-----------|-------------|-------|
| MRR | 0.2514 | 0.2550 | -0.4% |
| Recall@10 | 0.3014 | 0.3095 | -0.8% |
| NDCG@10 | 0.2177 | 0.2236 | -0.6% |

**Indexing speed in Zotero (WASM, 50 papers):**

| | 512 tokens | 2000 tokens |
|--|-----------|-------------|
| Chunks/paper | 99.0 | 93.9 |
| Total time | 22.1 min | 23.9 min |
| Per item | 26.5s | 28.7s |

Both strategies produce similar chunk counts because most papers hit the `maxChunksPerPaper` ceiling. The per-chunk embedding time is lower for 512 tokens (~0.4s vs ~0.9s in WASM), but the higher chunk count negates the advantage.

**Conclusion:** `maxTokens` has negligible impact on both quality and speed in practice. The effective bottleneck is `maxChunksPerPaper`, not chunk granularity.

Full eval framework: `eval/` directory. Raw results: `eval/data/eval-results.json`.

---

## Summary

ZotSeek combines:

1. **Semantic Understanding** - AI embeddings capture meaning, not just keywords
2. **Keyword Precision** - Zotero's search finds exact author/year/term matches
3. **Intelligent Fusion** - RRF combines both without score normalization
4. **Section Awareness** - Chunks respect academic paper structure
5. **Performance** - Optimized chunking and caching for fast searches

This hybrid approach gives you the best of both worlds: finding conceptually related papers while still being able to search for specific authors, years, and technical terms.


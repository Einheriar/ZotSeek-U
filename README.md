# ZotSeek-U

> **Universal, multilingual, and evidence-grounded retrieval for Zotero.**

**English** | [简体中文](README-CN.md)

## Mission

> **Make Zotero foundational infrastructure for reference management in the AI era.**

ZotSeek-U is an independent fork of [ZotSeek](https://github.com/introfini/ZotSeek). It brings multilingual semantic search to your local Zotero library and grounds retrieval results in metadata, Notes, matched passages, and PDF page numbers.

## Why I Maintain This Fork

We have probably all struggled to find a paper we know we have read: we remember a concept or a small detail, but not the title or the right keywords. Finding it again can take far too much effort. Vector-based Semantic Search is a great solution to this problem. Since 2024, I have wanted to search the literature stored in my own Zotero library as naturally as asking Consensus a question.

I tried Zotero-MCP, but it requires an additional Python process with non-trivial resource usage and is mainly accessed through MCP. Other Zotero semantic-search plugins also did not work as well as I hoped. ZotSeek is the best plugin I have seen in this area. It fulfills almost everything I imagined semantic literature search inside Zotero could be.

However, the original ZotSeek still differed from my workflow in several ways:

1. Some chunking paths relied on fixed rules to estimate tokens. This is efficient and reliable for English, but it can underestimate the actual token count of Chinese and other languages. With models such as E5 that have a relatively small context window, over-limit input is truncated by the tokenizer and the end of a chunk can be lost.

2. A Zotero library grows over time, and many researchers accumulate a large collection of valuable Notes. The original indexing modes did not fully use this material, while PDF full-text indexing can require orders of magnitude more computation than Metadata indexing. I wanted a middle ground that balances cost and content coverage.

3. The original project emphasizes privacy and local processing, but did not provide a way for users to bring their own API key and use Cloud Embedding. I believe many users would like to try this option, while anyone with privacy concerns can continue using the fully local features.

4. The original Hybrid Search combined Semantic Search with heuristically adapted Zotero search results through RRF. Its measured recall was already good, but there was still room for improvement.

For these reasons, I created and continue to maintain this fork, mainly adding:

- reliable support for Chinese, Japanese, Korean, Thai, Russian, and other languages, using the model's own tokenizer to count tokens whenever available;
- a `Metadata + Notes` indexing mode and a redesigned hybrid search mode;
- optional BYOK Cloud Embedding;
- Hybrid Search based on Semantic Search + BM25.

I have run many experiments on chunking, Embedding, and retrieval quality. Their methods and results will be published progressively on the project Blog.

## Main Goals

1. Support semantic retrieval for Chinese and multilingual literature.

2. Explore unified indexing of titles, abstracts, tags, PDF full text, and Child Notes.

3. Study how text preprocessing, structured chunking, and Embedding input affect retrieval quality.

4. Improve Embedding, semantic search, hybrid retrieval, and MCP access to provide external AI Agents with verifiable literature search results.

## Usage

ZotSeek-U includes an Embedding model out of the box and defaults to the **Metadata + Notes** indexing mode. The default model is Multilingual E5 base. It supports multiple languages and runs at a reasonable speed; its main limitation is a context window of only 512 tokens. Run **Check and Update Index**, then start searching with Hybrid Search.

### 1. Choose an Embedding Model

Open **Zotero Settings → ZotSeek → Models** and choose an Embedding option:

- **Multilingual E5 base**: the bundled default multilingual model, ready to use after installation;
- **Nomic v1.5**: oriented toward English literature and downloaded separately;
- **BGE-M3**: a larger multilingual model, also downloaded separately;
- **Local Server**: use a local inference service such as LM Studio, Ollama, llama.cpp, or vLLM;
- **Cloud**: call a cloud Embedding service with your own API key.

![Choose an Embedding model](docs/images/readme-model-picker.png)

#### Benchmark reference for model selection

The chart below is a performance reference for choosing an Embedding model. It was measured on an **AMD Ryzen 7 4800H (R7 4800H)** with 16 logical threads, using CPU/WASM Q8 inference and the same 10 English PDFs (83 pages, 494,816 extracted characters). It compares indexing time and process Working Set; actual results vary with hardware, library size, PDF length, and background load. Retrieval quality was not measured in this benchmark.

![Embedding model benchmark](docs/images/model-benchmark-patchwork_en.png)

Most users can use the bundled model directly. After choosing another model, build an index for that model. Embeddings from different models are stored separately and are never compared with each other.

#### Optional: Cloud Embedding

Cloud Embedding is optional. Indexed content and semantic queries are sent to the cloud provider and may incur provider charges. ZotSeek-U does not charge users or receive a share of those fees. Users with privacy concerns can leave this feature disabled.

Set the API key, test the connection, and then select the Cloud model. The API key is stored through Zotero's secure credential storage and is not written to ordinary preferences or project files.

![Cloud Embedding settings](docs/images/readme-cloud-settings.png)

The advanced fields describe the model context, dimensions, optional query/index parameters, and batch size. Built-in models use their catalog profiles; Custom endpoints require the user to provide the unknown model limits explicitly.

![Advanced Cloud Embedding settings](docs/images/readme-cloud-advanced-settings.png)

### 2. Choose an Indexing Mode

Open **Zotero Settings → ZotSeek → Indexing** and choose what should be embedded:

- **Abstract only**: primarily indexes Metadata; fastest and smallest;
- **Metadata + Notes**: adds the paper's Child Notes without processing the PDF; recommended for everyday use;
- **Full text**: adds PDF content to Metadata and Notes; provides the widest coverage but requires the most time and storage.

The indexing mode determines what enters the index. It is different from choosing Hybrid, Semantic, or Keyword mode at search time.

![Choose an indexing mode](docs/images/readme-indexing-modes.png)

### 3. Build and Maintain the Index

After selecting a model and indexing mode, confirm the library scope under **Status**, then click **Check and Update Index**. It adds missing items, updates changed Metadata, Notes, and indexing configuration, and skips unchanged items.

![Check and update the index](docs/images/readme-index-maintenance.png)

Use **Check and Update Index** for routine maintenance. Use **Rebuild Index** only when ZotSeek-U explicitly asks for it, when the indexing strategy changes substantially, or when you need to start over. Updating or rebuilding with a Cloud model may incur provider charges.

### 4. Search Your Library

Click the ZotSeek icon in the Zotero toolbar, enter a natural-language question, and choose a search mode:

- **Hybrid Search**: combines Semantic Search with BM25; recommended by default;
- **Semantic Search**: useful for concepts, meanings, and matches expressed in different words;
- **Keyword Search**: useful for exact titles, terms, and abbreviations.

Results can be grouped by paper section or shown by exact location with matched passages and PDF page numbers. A result set can also be saved as a new Zotero Collection.

![ZotSeek search dialog](docs/images/readme-search-dialog.png)

### 5. Connect an AI Agent

ZotSeek-U uses Zotero's built-in local HTTP server to provide read-only search to MCP clients, without requiring an additional Python service. Zotero must remain open while the connection is in use.

First, open **Zotero Settings → Advanced** and enable **Allow other applications on this computer to communicate with Zotero**.

![Allow local applications to communicate with Zotero](docs/images/readme-zotero-local-api.png)

Then open **Zotero Settings → ZotSeek → Integrations & Maintenance** and enable **Allow AI agents to search and read your library**. This feature is off by default and takes effect without restarting Zotero.

![Enable AI Agent Access](docs/images/readme-ai-agent-access.png)

The settings page displays a connection command containing the MCP endpoint for the local HTTP server currently provided by Zotero. Copy the address shown there when configuring a client; do not assume that the port is always the same. The address normally ends with `/zotseek/mcp`.

Claude Code:

```bash
claude mcp add --transport http --scope user zotseek <MCP_URL_FROM_ZOTSEEK_SETTINGS>
```

OpenAI Codex:

```bash
codex mcp add zotseek --url <MCP_URL_FROM_ZOTSEEK_SETTINGS>
```

Other MCP clients that support Streamable HTTP can use the same address shown in ZotSeek settings. Native MCP clients normally need only the URL. If a client sends requests through an embedded browser environment, also add this request header:

```text
Zotero-Allowed-Request=true
```

![Connect ZotSeek in an MCP client](docs/images/readme-mcp-client.png)

The MCP interface can search literature, read item Metadata and Child Notes, retrieve specific PDF pages, and return links that open the result in Zotero. It listens only on localhost, and all tools are read-only: they cannot modify your library or index.

## Project Status

Due to the limits of my personal expertise and resources, this project is developed primarily through **Vibe Coding** as an experimental project for my own workflow. Features, architecture, and experimental conclusions may continue to change. I do not guarantee synchronization with upstream ZotSeek or stable production support.

The current release requires **Zotero 9.0 or newer** and supports Zotero 9 and Zotero 10.

## Upstream

[Visit the original ZotSeek project](https://github.com/introfini/ZotSeek)

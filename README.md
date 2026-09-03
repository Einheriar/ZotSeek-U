# ZotSeek-CHS

ZotSeek-CHS 是 [ZotSeek 原项目](https://github.com/introfini/ZotSeek) 的一个独立 fork，面向中文用户和本地科研文献检索场景进行持续开发。

*ZotSeek-CHS is an independent fork of the [original ZotSeek project](https://github.com/introfini/ZotSeek), developed for Chinese users and local academic literature retrieval.*

本项目 README 只介绍当前 fork 的定位和开发方向。完整的功能说明、安装方法、使用文档和上游项目信息，请直接访问原项目仓库。

*This README only describes the identity and development direction of this fork. For complete feature descriptions, installation instructions, usage documentation, and upstream project information, please visit the original repository.*

## 项目宗旨

本项目的宗旨是：

> **让 Zotero 成为文献管理 AI 时代的基础设施。**

Zotero 不仅可以用于保存、整理和管理文献，也可以作为本地科研知识库，为 Embedding、语义搜索、混合检索和 MCP 调用提供可靠的数据基础。

*The purpose of this project is to make Zotero foundational infrastructure for the AI era of reference management. Zotero should not only store, organize, and manage literature, but also serve as a local research knowledge base for embeddings, semantic search, hybrid retrieval, and MCP-based agent access.*

Embedding 默认仍可完全在本机运行；高级用户也可选择 Local Server，或在明确确认数据上传和云厂商计费边界后，以 BYOK 方式使用 Cloud Embedding。Cloud API Key 使用 Zotero 的系统安全凭据存储，不写入普通偏好或项目文件。

*Embeddings can remain fully local by default. Advanced users may instead choose Local Server, or use BYOK Cloud Embedding after explicitly acknowledging data transfer and provider billing. Cloud API keys use Zotero's OS-backed credential storage and are not written to ordinary preferences or project files.*

## 当前方向

基于个人的文献阅读习惯，本项目重点维护 **hybrid 混合检索模式**，并以 **Metadata + Notes** 作为主要索引模式。日常阅读文献时，通常会使用 LLM 生成一份文献简报，并将其作为文献的长期阅读记录。因此，本项目将 Zotero 中的元数据和 Notes 作为语义检索的重要基础，同时保留 PDF 全文索引和扩展能力。

*Based on the author's personal literature-reading workflow, this project primarily maintains hybrid retrieval and uses Metadata + Notes as the main indexing mode. An LLM-generated literature brief is often kept as a long-term reading record. Therefore, Zotero metadata and notes are treated as important foundations for semantic retrieval while PDF full-text indexing and future extensions remain supported.*

最终目标是构建一个可由外部 Agent 调用、能够返回原文依据，并且可以通过 Zotero 元数据、Note 内容、匹配片段和 PDF 页码进行验证的本地 MCP 环境。

*The ultimate goal is to provide a local MCP environment that external agents can call, whose results include source evidence and can be verified through Zotero metadata, note content, matched passages, and PDF page locations.*

## 主要目标

1. 支持中文和多语言文献的语义检索。

   *Support semantic retrieval for Chinese and multilingual literature.*

2. 探索标题、摘要、标签、PDF 全文和 Child Notes 的统一索引方式。

   *Explore unified indexing of titles, abstracts, tags, PDF full text, and child notes.*

3. 研究文本预处理、结构化分块和 Embedding 输入方式对检索效果的影响。

   *Study how text preprocessing, structured chunking, and embedding inputs affect retrieval quality.*

4. 改进 Embedding、语义搜索、混合检索和 MCP 调用等环节，为外部 AI Agent 提供可验证的文献检索结果。

   *Improve embeddings, semantic search, hybrid retrieval, and MCP access to provide external AI agents with verifiable literature retrieval results.*

## 项目状态

由于个人能力和资源所限，本项目主要通过 **Vibe Coding** 的方式推进，是一个面向个人工作流的实验性项目。功能、架构和实验结论可能持续变化，不保证与上游 ZotSeek 保持同步，也不承诺提供稳定的生产环境支持。

*Due to limitations in personal resources and expertise, this project is developed primarily through **Vibe Coding** as an experimental project for a personal workflow. Its features, architecture, and experimental conclusions may change over time. It does not guarantee synchronization with upstream ZotSeek or stable production support.*

当前版本最低要求 **Zotero 9.0**，支持 Zotero 9 和 Zotero 10。

*The current release requires **Zotero 9.0 or newer** and supports Zotero 9 and Zotero 10.*

## 上游项目

[访问 ZotSeek 原项目](https://github.com/introfini/ZotSeek)

[Visit the original ZotSeek project](https://github.com/introfini/ZotSeek)

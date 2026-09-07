# ZotSeek-U 开发文档（DEVELOPMENT_U）

> **本文档定位：** 记录 **ZotSeek-U** 相对上游 [ZotSeek](https://github.com/introfini/ZotSeek) 的全部新增功能、架构设计与开发流程，是本 fork 的第一手开发文档，随仓库持续维护。文档基准：`0.1.0`（2026-09-06）。
>
> 配套阅读：上游原版开发日志（Nomic 单模型时代口径，已冻结存档，不再维护）见 [DEVELOPMENT.md](DEVELOPMENT.md)；搜索、分块与索引模式的运行时行为细节见 [SEARCH_ARCHITECTURE_CN.md](SEARCH_ARCHITECTURE_CN.md)；MCP/REST 接口使用见 [MCP.md](MCP.md)。
>
> 状态标记约定：**[已上线]** = 已进入生产代码并通过验收；**[进行中]** = 已批准、部分实现或尚待实机验收。更细粒度的实验数据与逐项验收记录保存在维护者本地工作区，不随本仓库分发。

## 目录

1. [与上游的关系](#1-与上游的关系)
2. [索引模式体系](#2-索引模式体系)
3. [Child Notes 结构化分块](#3-child-notes-结构化分块)
4. [PDF 正文索引链路](#4-pdf-正文索引链路)
5. [R1 语义面包屑](#5-r1-语义面包屑)
6. [搜索架构改动](#6-搜索架构改动)
7. [Embedding 与模型](#7-embedding-与模型)
8. [索引维护体系](#8-索引维护体系)
9. [数据库与稳定身份](#9-数据库与稳定身份)
10. [MCP/REST 扩展](#10-mcprest-扩展)
11. [多语言](#11-多语言)
12. [设置页与 UI](#12-设置页与-ui)
13. [LLM 文献简报](#13-llm-文献简报)
14. [工程化与开发流程](#14-工程化与开发流程)
15. [发布与版本策略](#15-发布与版本策略)
16. [文档维护约定](#16-文档维护约定)

---

## 1. 与上游的关系

ZotSeek-U 基于 upstream v1.19.x fork，目标是让 Zotero 成为文献管理 AI 时代的基础设施，重点维护中文/多语言语义检索、Embedding、hybrid 混合搜索、Metadata + Notes 索引和本地 MCP 接口。2026-08-24 已整合上游 v1.20.0（Zotero 10 数据库钩子、多合集索引、Worker 线程修复、数据库重连重挂载、空闲压缩、模型资源自修复），兼容范围为 Zotero 9.0 – 10.0.*。

**保留自上游的能力**（fork 基本未动，仅做扩展）：

- MCP/REST 底座：`search` / `find_similar` / `index_status` 三个工具、Streamable HTTP JSON-RPC、localhost-only Origin 校验、`/zotseek/open` 深链接启动器。
- 本地推理链：Transformers.js v3 + ChromeWorker + CPU/WASM Q8 量化、模型 `modelId` 分区隔离、60 秒超时与重试语义。
- 搜索框架：semantic / keyword / hybrid 三模式与 RRF 融合、papers/passages 两种结果粒度。
- SQLite 基础：`zotseek.sqlite` ATTACH 到 Zotero 主连接、重连重挂载、空闲时 `VACUUM INTO` 压缩。

**有意保持不变的技术身份**：插件 ID、`zotseek.*` 偏好前缀、`zotseek.sqlite`、`chrome://zotseek/` 命名空间、`Zotero.ZotSeek` 全局对象。`bootstrap.js` 会在启动后禁用本 fork 的后台自动更新，防止被上游版本覆盖。

## 2. 索引模式体系 [已上线]

### 2.1 三种模式的内容定义

| 模式（机器值） | 界面名称 | 索引内容 |
|---|---|---|
| `abstract` | 仅摘要 | 标题 + 摘要 + 非 `#` Tags |
| `notes` | 元数据 + 笔记 | 标题 + 摘要 + 非 `#` Tags + Child Notes |
| `full` | 全文 | 标题 + 摘要 + 非 `#` Tags + Child Notes + PDF |

三模式共用统一 `IndexedMetadataSnapshot` 提取逻辑：Metadata/Summary 部分固定为"标题 + ≥50 字符摘要 + 过滤 `#` 前缀后的 Tags"，`#` 开头的工作流标签不进入任何模式的 Embedding 文本，纯 `#` 标签变化不触发 Summary 重算。

### 2.2 默认模式与机器值边界

- 新安装与偏好缺失时的默认索引模式统一为机器值 `notes`（`src/utils/indexing-mode.ts` 的 `DEFAULT_INDEXING_MODE`）；非空未知值安全回退 `abstract`，用户显式选择保留。
- `abstract` / `notes` / `full` 是稳定机器值，用于偏好、数据库、业务逻辑和跨模块 API；任何语言的显示文字不得参与索引模式判断（详见 [16 文档维护约定](#16-文档维护约定)）。

### 2.3 Full 模式来源优先级

Full 模式在每篇 `maxChunksPerPaper` 统一上限内按严格顺序分配：Metadata/Summary 最优先 → Notes（每篇最多 30 chunks）→ PDF 使用剩余名额（`combineFullModeChunks()`）。该 30-chunk Notes 上限只约束 Full 模式。

### 2.4 模式增量切换与旧向量复用

模式切换不必然全量重算（`src/core/index-mode-transition.ts`）：仅当逐条版本化配置指纹证明除 mode 外其余配置（索引契约、maxChunks、分块策略版本、模型输入策略、模型 ID）全部一致时，目标 chunk 与旧来源 + `chunk_text` + `sectionPaths` 精确匹配即可复用旧 embedding，只计算缺失块；无法证明或同时变化时整组重算，替换始终按 `replaceItemModelChunks()` 原子进行。设置页与启动流程会提示模式不匹配并保留"检查更新 / 重建 / 取消"选择。

## 3. Child Notes 结构化分块 [已上线]

Metadata + Notes 与 Full 模式将 Zotero Child Notes 纳入索引。fork 把笔记分为两类处理：

- **结构化笔记**（有可靠标题层级）：解析 Note HTML 中的 `h1`–`h6` 构建章节树，过滤"基本信息"章节和参考文献子树；参考文献识别采用组合式标题分类（编号/标点/双语外壳归一化 + 参考对象词 + 列表意图词），按"宁可漏检、不错杀"设计。同一 `h2` 内相邻小节按推荐 token 值 `1/4` 软下限贪心装箱，禁止跨 `h2` 合并。
- **普通笔记**（无可靠层级）：沿用段落 → 句子 → Unicode 字符的回退拆分，不强行猜测结构。

关键数据契约：每个 Note chunk 保存三个层面——忠实证据文本 `text`、仅作 Embedding 输入的 `embedText`、持久化章节路径 `sectionPaths: string[][]`（schema v11 `section_paths` 列）。章节位置只进入语义输入，不得污染用户看到的原文；四条索引路径统一按 `embedText ?? text` 取用。

Note 专用分块策略版本 `NOTE_CHUNK_STRATEGY_VERSION` 经历 2 → 3 → 4（组合式参考文献过滤）；与通用策略合并后当前生产值为 `CHUNK_STRATEGY_VERSION = 10`（`src/utils/chunker.ts`）。分块策略升级要求完整重建旧索引：插件提示用户重建并暂停增量更新，但**不自动删除**用户索引，旧索引在重建完成前仍可用于搜索。

另外，关键词搜索命中 Child Note 时，兜底 `matchedChunk` 以查询词为中心、最多 1200 个 Unicode 字符，而不是只返回整条笔记的开头。

## 4. PDF 正文索引链路 [已上线]

Full 模式的 PDF 正文由生产策略 **`zotseek-pdf-main-text-indexing-v1`**（策略版本 6 起）处理，主链为：

1. **主附件选择**：每篇文献选定 first-text-bearing 的主 PDF 附件，避免把补充材料混入正文。
2. **PDFWorker direct 逐物理页提取**：直接使用 Zotero 内置 PDF.js 管线取逐页文本，空白页保留占位以维持页码真实性。
3. **References v2 过滤**：识别 reference region 并过滤参考文献列表，显著减少无效 chunks 并改善聚合检索。
4. **重复页眉页脚过滤（F v1）**：默认开启、可显式关闭的内部函数开关（不设设置页选项）；接受 1 条已知的正文标题误隐藏风险。
5. **同页短段落装箱**：同一物理页内相邻短段落贪心装箱到推荐 token 预算（E5 为 420 exact tokens），不跨页、不加重叠、不跨过滤边界；显著降低 chunk 数量与向量成本。

设计边界：PDF chunk 必须保留真实物理页码和来源；不确定来源时宁缺毋滥。经对比实验，结构化文档文本（SDT）主路线和 8 个外部 PDF 解析包（pdftext、PyMuPDF4LLM 等，无 OCR profile）均未取代 PDFWorker direct 主链。

**Chunk 文本保真（策略 10）**：句子 span 直接取自原串（保留英文句间空白、`.NET` 等开头标点、未结束尾句）；所有硬字符切分按 Unicode code point 边界（保护代理对/emoji）；Summary 保存完整标题不再 300 字符截断；token 与字符限制合并到同一最终输入检查。

## 5. R1 语义面包屑 [已上线]

Note chunk 的正文先按推荐预算（E5 420 tokens）完成切分、固定边界，然后**仅在 `embedText`** 添加确定性前缀：

```
文献：<父文献标题>
章节：<章节路径>
```

- 面包屑不写入忠实 `chunk_text`、不进入 BM25 词法索引、不挤占正文装箱额度；超长标题只在模型硬上限前截断。
- 动机：同一术语在 Introduction/Methods/Results/Discussion 中语义不同，确定性面包屑以零幻觉成本向 Embedding 提供文档内位置信息；离线配对实验显示前排质量（R@1、MRR、nDCG）改善且 512 硬上限下零截断。
- 结构上下文同理只用于 `embedText`；用户展示与引用仍保留忠实 `displayText`。

## 6. 搜索架构改动 [已上线]

fork 在上游"语义检索 + Zotero quick search RRF 融合"的基础上重构了词法通道与结果组织。运行时细节见 [SEARCH_ARCHITECTURE_CN.md](SEARCH_ARCHITECTURE_CN.md)。

### 6.1 身份导航（identity prepass）

查询先经过只读 Zotero metadata 的身份层：精确 DOI、完整标题、唯一且足够长的标题片段（连续 Latin ≥3 词或 12 字符、CJK ≥6 字符）直接导航到文献；作者名返回作者文献集合而不挑选单篇；短于 5 字符的 Latin 姓氏保持沉默。显式选择 semantic 或 keyword 模式时严格绕过默认策略。

### 6.2 T0 BM25 词法通道

上游的启发式关键词重排被替换为零第三方依赖的 BM25（`src/core/lexical-search.ts`）：`Intl.Segmenter('zh-Hans')` 自然词 + CJK bigram 双通道，`k1=1.2 / b=0.75`，自然词与 bigram 取最大 TF，RRF `k=60` 融合。它替代了旧的 `LOWER(chunk_text) LIKE` 包含式扫描，使 Notes/PDF 正文的精确词项命中随语料规模可控。分词器选型经四分词器消融后冻结为零依赖方案（jieba-wasm 等未进生产）；全库关键词词典 patch 冻结为不启用。

Plan 60 兼容修补将词法契约更新为 v2：对实际合并的韩英片段补充英文词项并正确累计词频，限定保留被 Gecko 错标为非 word-like 的泰文片段；其他脚本继续原过滤规则。无需全局取消 isWordLike 或自动语言识别。升级后重启即可在首次搜索自动重建内存 BM25 缓存，复用已存文本和 semantic 向量，不需要用户手动重建索引。

### 6.3 三模式默认搜索策略

| 索引模式 | 默认策略 |
|---|---|
| `abstract` | 身份导航后，普通内容 semantic-only |
| `notes` | 身份导航后，R1 语义 + T0 BM25 固定 RRF 融合（H1） |
| `full` | 身份导航后，Notes 通道前二 + PDF semantic 去重补齐后八位，PDF 不足时 Notes 回填 |

UI / MCP / REST 共用同一策略分流（`src/core/search-policy.ts`）。语义 MaxSim 与 BM25 词法双侧按来源隔离（Notes 侧不吃 PDF 词频，PDF 侧不被 Note chunks 抢占）。另有查询分析驱动的自动权重调节，沿用上游启发式。

### 6.4 查询与缓存

- 两字中文查询合法（`src/utils/query-validation.ts`）；一字中文与过短非中文查询仍拒绝。
- 搜索缓存一致性：vector / lexical 缓存共享单调 mutation generation，独立 keyed single-flight 防重复冷构建，发布前复核 generation / 活动模型 / store 生命周期；索引持续写入时允许搜索暂时安全降级，不发布已知过期或混杂的缓存。
- 限定 `library_key` 的语义搜索复用预归一化向量缓存后按库过滤，不重复解码。

### 6.5 性能优化

活动模型窄投影向量缓存（base64 直接解码 `Float32Array` 并原地归一化）、相同模型相同查询共享在途 query embedding、Full 模式 Notes/PDF 两个语义 specialist 共享一次向量遍历、`metadata-identity-cache.ts` 紧凑身份快照（稳定身份 + 标题 + DOI + 年份 + creator，不持有 `Zotero.Item`，32 MiB 上限，Notifier 保守整份失效）。当前真实 150 篇 Full 语料的热查询中位数从约 3.05s 降至约 1.33s；冷构建与内存的已知成本记录见架构文档。

## 7. Embedding 与模型 [已上线]

### 7.1 模型注册表

- 默认内置模型 `multilingual-e5-base`（Q8 量化、768 维、512-token 输入上限、`query:` / `passage:` 前缀），fork 初期即从上游 Nomic 默认切换，以获得多语言语义能力。
- 注册表三模型制：`nomic-embed-text-v1.5`（可选下载）、`multilingual-e5-base`（默认）、`bge-m3`（可选下载）；上游的 MiniLM 已从注册表与设置菜单移除。
- 模型下载交互：选择缺失模型时提供"自动下载（推荐）/ 手动下载 / 取消"三选一，`.part` 临时文件原子写入，下载成功前不切换活动模型；各模型向量按 `model_id` 分区隔离，切换或失败不删除、不混用现有向量。

### 7.2 模型输入契约与精确分块

`src/core/model-input-config.ts` 与 `src/core/model-input-policy.ts` 集中管理每个模型的输入契约：E5 推荐 420 / 硬上限 512 tokens；Nomic 与 BGE-M3 推荐 2000 / 硬上限 8192。E5 与 BGE-M3 使用各自真实 tokenizer 对 Summary、Notes、逐页 PDF 和查询做精确计数（含前缀与特殊 token），中文不再被空白估算低估；旧的推理前 8000 字符删尾已移除，超长内容在分块阶段无损拆分。策略版本（`POLICY_VERSION`）进入索引配置指纹，契约变化通过指纹触发旧索引核对。每个注册模型携带 `chunkProfile`，推荐 chunk 粒度由 `min(4000, floor(maxInputTokens × 0.85))` 派生，软下限 25%。

### 7.3 Local Server 槽位

自建推理服务经固定单槽位接入：配置文件 `<Zotero profile>/zotseek-server-models.json`（含 `schemaVersion` / `models` / `example` 模板，字段 `id`（`server:` 前缀）、`baseUrl`（仅允许 loopback）、`serverModelName`、`dimensions`、`maxInputTokens`、`recommendedChunkTokens`、`queryPrefix`、`docPrefix` 等）。模型菜单以稳定值 `server-slot` 呈现 NONE / UNKNOWN / ready 三态；不完整配置可保留但不执行语义操作；ready 时启动校验 `GET /v1/models` 与维度探测。

### 7.4 Cloud Embedding 与 BYOK

云 Embedding 以自带密钥（BYOK）方式接入，当前支持四个 provider：

| Provider | 模型 | 维度 | 批量 |
|---|---|---|---|
| 阿里云百炼（DashScope 原生） | `qwen3.7-text-embedding` | 1024 | 20 |
| OpenAI | `text-embedding-3-small` / `-3-large` | 1536 / 3072 | 10 |
| Google Gemini API | `gemini-embedding-001` | 768 | 10 |
| Custom (OpenAI-compatible) | 自定义 | 自报 | 1 |

要点：

- 三个适配器 `dashscope-embedding-adapter.ts`、`openai-embedding-adapter.ts`、`gemini-embedding-adapter.ts` 由泛化的 `cloud-embedding-client.ts` 驱动；百炼走原生 dense 输出与 `parameters.text_type`，Gemini 走 `batchEmbedContents` + `RETRIEVAL_QUERY` / `RETRIEVAL_DOCUMENT` taskType。
- **凭据安全**：API Key 存 Zotero Login Manager + OSKeyStore（`cloud-credential-store.ts`），失败时拒绝明文降级，UI 仅显示首尾五字符遮罩；HTTPS 域名白名单、禁重定向、有界 429/5xx 重试。
- **版本化同意**：费用披露与 consent 版本按 provider 分槽保存；连接验证使用 document + query 双探针，错误输出固定脱敏。
- **query/document API role**：高级设置可编辑两角色（默认 `query` / `document`，可恢复百炼默认）；角色变化使连接验证失效并进入索引指纹（连同 adapter 版本、输出契约）。
- 百炼区域端点 `zotseek.cloud.bailianRegion`（`cn` / `intl`）；`cloudAutoIndex` 默认关闭。
- Cloud 专用保守多语言 token 估算（英文词 ×1.3、CJK 字符 ×2）仅用于 Cloud 分块预算，估算器版本进入 Cloud 策略指纹。

## 8. 索引维护体系 [已上线]

### 8.1 索引新鲜度与状态列

`src/core/index-freshness.ts` 为每个父文献维护四类指纹（配置 / 元数据 / Note 结构 / Note 内容），持久化于 `startup_fingerprints` 表（schema v10）；Zotero Notifier 事件只把受影响父条目标脏（300ms 兜底核对），不直接触发 Embedding。条目树状态列（`src/ui/item-tree-column.ts`）按优先级显示：`⊘` 排除 → 空白未索引 → `↻` 过期 → `◐` 截断 → `✓` 最新。Child Note 增删改会把父文献从 `✓` 翻为 `↻`。

### 8.2 统一索引操作入口

设置页收敛为三个按钮，语义与文案严格对齐实际行为：

- **检查并更新索引**（日常主操作）：添加缺失条目、替换内容或配置已变化的条目、跳过未变化条目，并清理已从 Zotero 消失的索引身份；支持失败重试与断点继续。
- **重建索引**（破坏性）：先清空再按确认范围完整重建。
- **清除索引**（危险）：只删除不重建。

"立即执行增量同步"按钮已删除；启动时若发现配置指纹不一致，弹"检查并更新 / 重建 / 取消"三选一，取消保持零写入。右键菜单仅保留"检查并更新所选条目 / 当前合集"两个范围快捷入口，与启动核对复用同一套新鲜度指纹。

### 8.3 索引任务暂停与恢复

长时间索引进度窗提供本地化的"暂停索引"按钮（经 `ItemProgress` 内部结构反查原生窗口注入），状态机 `running → pausing → paused`。暂停保留原始 pending 范围（个人库 / 合集 / 所选条目，按 `libraryKey + itemKey`），未完成文献不做部分替换；下次启动询问是否继续。取消与暂停都可从协调层短路。

### 8.4 排除规则与索引清理

`excludeTag` / `excludeBooks` 命中的**已有**索引身份会在下次检查时按明确范围事务性清理（该条目全部模型分区的 chunks、`item_models` 与启动指纹）；单项失败保留完整旧索引并计入待重试。取消排除后，条目作为缺失条目重新建立索引。状态列对两类排除均显示 `⊘`。

### 8.5 配置指纹与选择性重算

`config_fingerprint` 为版本化结构化 JSON 快照（指纹格式版本 / 索引契约版本 / 模式 / maxChunksPerPaper / 分块策略版本 / 模型输入策略指纹），不再是不可逆 hash。提高 `maxChunksPerPaper` 时，仅当能证明唯一变化是该上限上调，才对原先 `was_truncated=1` 的文献整组重算，其余文献只推进指纹；降低上限仍按新配额完整重算。

## 9. 数据库与稳定身份 [已上线]

- 索引存放在**独立的 `zotseek.sqlite`**（非 Zotero 主库），经 ATTACH 挂载并随 Zotero 重连重挂载。
- **稳定文献身份是 `libraryKey + itemKey`**，贯穿删除清理、指纹、增量核对、MCP 读取与深链接；本地 Zotero item ID 不作为跨库稳定身份。user / group / orphan 记录分别处理。
- fork 引入的 schema 节点：**v10** `startup_fingerprints`（新鲜度指纹）、**v11** `section_paths`（Note 章节路径）、**v12** `chunks.pdf_attachment_key`（Full 模式精确 PDF 来源，nullable，旧数据不伪造来源）。
- 每篇一个模型分区（`chunks.model_id` 复合主键 + `item_models`），模型切换与失败不混用向量。
- 设置页"存储占用"显示数据库文件物理大小：`DELETE` 后空间进入 freelist 而非立即归还磁盘，执行"压缩数据库"（`VACUUM INTO`）后才真正缩小文件，这是设计行为而非残留。

## 10. MCP/REST 扩展 [已上线]

在上游 `search` / `find_similar` / `index_status` 基础上新增（完整用法见 [MCP.md](MCP.md)）：

- **`get_item` 工具**：按 `library_key + item_key` 读取规范化书目、tags、collections、relatedItems 与附件清单；`include_notes: true` 返回全部 Child Notes 的完整未过滤文本（不应用索引侧的"基本信息"/References 排除规则）及实时 `sections` / `sectionPaths`；`include_pdf: "pages" | "full"` 支持指定附件与 ≤20 连续页，PDF 读取优先 Zotero 全文缓存、缺页时批量 `PDFWorker` 兜底，`pdf.status` 以机器值 `ok / partial / missing / unresolved / empty / failed` 表达；不暴露本机文件路径。REST 对应 `GET /zotseek/item`。
- **`search` 结构化后过滤**：可选 `filter`（`year_from` / `year_to` / `journal` / `author` + `exact` 总开关）作用于已排入 `max_results` 的结果窗口，不改变排序、不做隐藏超量拉取；REST 暴露 `yearFrom` / `yearTo` / `journal` / `author` / `exact`。
- **精确 PDF 回链**：`matchedChunk.pdfAttachmentKey` 端到端透传，深链接打开产生命中的确切附件，而非启发式选择。
- MCP 授权文案更新为"允许本地 AI 智能体只读搜索并读取条目、Notes 和 PDF"，同步全部 10 个语言包。

## 11. 多语言 [已上线]

- 正式注册 **10 个 locale**：`en-US`、`zh-CN`、`zh-TW`、`ja-JP`、`ko-KR`、`de`、`fr-FR`、`es-ES`、`ru-RU`、`th-TH`。每套包含主 Fluent、菜单 Fluent 与 DTD 资源。
- 插件跟随 Zotero 应用界面语言，不维护独立语言偏好；`en-US` 是 canonical 资源与最终回退。
- `npm run check:locales`（`scripts/check-locales.js`）校验每个注册 locale 的必需文件、Fluent message / attribute / `$variable` 占位符、DTD entity 与 bootstrap 注册一致性，并接入构建 fail-fast——缺失 key 或参数漂移在构建期失败，而不是等到真实界面显示 message ID。
- 本地化边界：语言包只负责展示层翻译；数据库、偏好、业务逻辑和跨模块 API 只使用 `abstract`、`notes`、`full`、`ok`、`partial` 等稳定机器值，显示文字永不参与业务判断。

## 12. 设置页与 UI [已上线]

- 设置页视觉与信息层级整理：Embedding / token / chunk 设置不再归属 Search 区域；"每分块最大令牌数 / 每篇文献最大分块数"迁入模型分组末尾的"分块与模型输入"；模型输入策略提示只保留"硬上限 / 推荐值"；统计、操作、维护区间距统一收紧；全部文案同步 10 个语言包。
- 搜索设置新增"默认搜索模式"下拉（Semantic / Keyword / Hybrid，默认 `hybrid`，复用既有偏好键）；下拉列宽调整避免中文截断。
- 关于页链接指向本 fork 仓库 `https://github.com/Einheriar/ZotSeek-U`。
- 分块策略升级提示等旧式 `alert` 改为可关闭的 `confirm`（关闭不触发重建）。
- 已知非阻断 UI 问题：多个右下角通知窗口可能重叠遮挡，经评估接受现状。

## 13. LLM 文献简报

### 13.1 已实现的核心模块 [已上线（模块级）]

简报功能的服务端核心已进入源码，但端到端入口尚未开放：

- 模型固定为百炼 `deepseek-v4-flash-0731`（OpenAI 兼容端点、思考模式开启、`max_completion_tokens` 默认 16384 输出预算）。
- 标题/摘要迫选分类器区分 `review` / `standard` 两类文献（稳定机器值，模糊样本默认 `standard`），分类调用独立预算。
- 调度器：单篇手动任务 FIFO 并发 1；合集任务三篇一批、批内并行；两模式互斥。
- 提示词存储：随包内置"标准论文"与"综述"双模板（`prompts/standard-article-brief.md`、`prompts/review-article-brief.md`），支持 profile 目录原子覆盖导入（UTF-8 / 256KiB 校验）。
- 简报 Note 携带 HTML 注释形式的来源 provenance。
- 简报仅支持百炼 provider；切出该 provider 时确认并清空简报连接验证状态（`zotseek.cloud.brief.connectionVerified`）。

### 13.2 进行中的闭环设计 [进行中]

以下为已批准的完整生成闭环，实现正在推进（工作区已有未提交的 `brief-source-builder` / `brief-generation-runner` / `brief-note-writer` / 设置入口等改动），端到端闭环与实机验收尚未完成：

- 设置页"搜索"后新增"简报"折叠栏目与总开关（`zotseek.brief.enabled`，默认关闭）。
- 独立弹窗收集领域 / 输出语言等信息，由 LLM 基于内置双模板改写个人提示词；自动下载默认模板并保存受控副本成对启用，高级用户可编辑后导入。
- 生成入口：单篇 / 直接 PDF / 合集；生成始终新建 Child Note；PDF 清理后至少 100 个非空白 Unicode 字符才发送，不足则按 `insufficient_text` 跳过；合集内已有 Child Note 的条目跳过。
- 全生命周期取消上下文、连接验证失效修复（凭据 revision）、协议错误与畸形响应处理、错误脱敏。

## 14. 工程化与开发流程

### 14.1 测试与验证

- `npm test`：Node 内建 test runner，`test/` 下 50+ 个测试文件，通过 `helpers/zotero-stub.ts` 模拟 Zotero API；覆盖 chunker、模型注册表 / 输入契约 / 输入策略、Worker 输入准备、collection 解析、索引模式切换复用、Cloud 契约等纯逻辑模块。
- 搜索引擎与 hybrid 搜索**有意不做单元测试**：mock 嵌入与条目只能产出恒真的测试，检索质量归 eval 框架管（该框架尚不在仓库内，是已知缺口）。
- `npm run typecheck`：基于 `tsconfig.test.json` 同时检查 `src/` 与 `test/`，配合 `scripts/typecheck-baseline.json` 已知基线防回退。
- `npm run check:versions` 校验 `package.json` / `manifest.json` / `update.json` 版本一致性；CI 仅运行该检查。
- `src/dev/suites/` 是需要真实 Zotero 的 self-test harness（MCP 27 场景、模型加载、数据库完整性等），不能用 Node mock 替代。

### 14.2 真实 Zotero 开发代理

日常开发不制作 XPI，用 extension proxy 直接加载 `ZotSeek/build/`：

1. 完全退出 Zotero → `npm run build`；
2. 用 `ZOTERO_PROFILE` 指定真实 profile 后运行 `npm run dev:install`（首次或切换 profile 时；它会删除同 ID 的已安装 XPI 与可再生启动缓存）；
3. `npm run dev:status` 确认 `Dev mode active`。

之后的每轮循环只需：修改源码 → `npm run build` → 完全退出 Zotero → 以 `-purgecaches -ZoteroDebugText -jsconsole` 启动，**不重复** `dev:install`。Windows 启动命令为 `& 'C:\Program Files\Zotero\zotero.exe' -purgecaches -ZoteroDebugText -jsconsole`（`package.json` 的 `start:zotero` 是 macOS 命令，Windows 不用）。启动日志出现 `Loaded from unpackaged directory (dev proxy file)` 即代理生效；若 Zotero 把 ZotSeek 标记为 disabled，只需重新启用它。

### 14.3 评测资产（本地工作区，不随仓库分发）

- 固定测试语料为真实 Zotero 的 `10_Hyperscanning` collection（150 篇），配套 Metadata + Notes 与 Full Text 两套 50 题基准；开发前基线与恢复说明存放在工作区 `output/` 下。
- Cloud chunk 粒度消融等实验有可复用 runner（`tokenizer/eval/plan54/`，含 dry-run、usage 台账与确定性 replay 约束）；中文分词研究资产（pkuseg-js 修复与性能优化、jieba-wasm 评测）位于独立的 `tokenizer/` 目录，未进入插件——生产 BM25 只用零依赖 T0。

## 15. 发布与版本策略

- fork 使用独立版本号序列（`1.19.55x` / `1.20.55x`）与上游区分；三处版本一致性由 `check:versions` 守护。
- Embedding 模型权重不入 Git（E5 ONNX 约 266MB 已在 `.gitignore`）；GitHub Release 的 XPI 必须内含默认模型权重；日常开发一律走 dev proxy，XPI 仅用于测试打包行为或发布。
- 不默认承诺与上游同步；上游整合按需评估、逐案执行（最近一次为 v1.20.0）。
- `bootstrap.js` 禁用后台自动更新是 fork 的自我保护，无明确理由不得移除。

## 16. 文档维护约定

- 本文档（`DEVELOPMENT_U_CN.md`，中文母本）与英文对照版（`DEVELOPMENT_U_EN.md`）共同记录 fork 的新增功能、设计与开发流程：功能进入生产后写入对应章节并标注 [已上线]；已批准未完成的设计放入"进行中"小节并标注状态；实验性研究线（未进生产）不在此展开。两份文件必须同步修改，不允许只改其中一份。
- 搜索、分块、索引模式的**运行时行为细节**以 [SEARCH_ARCHITECTURE_CN.md](SEARCH_ARCHITECTURE_CN.md) 为准；MCP/REST 用法以 [MCP.md](MCP.md) 为准；上游历史见已冻结的 [DEVELOPMENT.md](DEVELOPMENT.md)。三份文档冲突时，以代码与测试为准并回改文档。
- 修改索引、搜索、模型、维护或 UI 行为时，按工作区协作规则同步检查对应模块与测试，并更新本文相应章节。
- 涉及模式、状态或枚举的改动必须保持稳定机器值边界：机器值进数据库 / 偏好 / 逻辑，语言包只做展示层翻译；同 API 需要两种值时分别返回机器值与 `*Label` 字段。

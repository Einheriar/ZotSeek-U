# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

## Context menu items

zotseek-menu-findSimilar = 查找相似文献
zotseek-menu-openZotSeek = 打开 ZotSeek…
zotseek-menu-indexSelected = 检查并更新所选条目
zotseek-menu-indexCollection = 检查并更新当前合集
zotseek-menu-updateLibrary = 检查并更新索引
zotseek-menu-removeFromIndex = 从 ZotSeek 索引中移除
zotseek-menu-findRelated = 查找相关文献

## Toolbar

zotseek-toolbar-openZotSeek = 打开 ZotSeek-U
zotseek-toolbar-findSimilar = 查找相似文献

## Preference pane

zotseek-pref-title = ZotSeek-U
zotseek-pref-indexStatistics = 索引统计
zotseek-pref-papersIndexed = 已索引文献
zotseek-pref-totalChunks = 总分块数
zotseek-pref-storageUsed = 存储占用
zotseek-pref-model = 模型：
zotseek-pref-avg = 平均：
zotseek-pref-chunksPerPaper = 分块/文献
zotseek-pref-lastIndexed = 上次索引：
zotseek-pref-refreshStats =
    .label = 刷新统计
zotseek-pref-compactDatabase =
    .label = 压缩数据库
zotseek-pref-autoCompact =
    .label = Zotero 空闲时自动压缩
zotseek-pref-autoCompactDesc = 需要 Zotero 10 或更高版本。仅在有足够可回收空间且没有索引任务进行时运行。
zotseek-pref-indexModeMismatch = 索引模式不匹配
zotseek-pref-indexModeMismatchDesc = 您的索引是使用{ $indexedMode }模式构建的，但当前设置为{ $currentMode }。
zotseek-pref-indexModeMismatchAction = 点击下方“检查并更新索引”以应用新模式。ZotSeek 会复用兼容向量，只计算缺少的部分；您仍可选择“重建索引”。
zotseek-pref-indexingMode = 索引模式
zotseek-pref-abstractOnly = 仅摘要
zotseek-pref-abstractOnlyMenu =
    .label = 仅摘要（更快）
zotseek-pref-abstractSpeed = 快速 · 每篇文献约 1 个分块
zotseek-pref-abstractDesc = 索引标题、摘要和不以 # 开头的标签。
zotseek-pref-notes = 元数据 + 笔记
zotseek-pref-notesMenu =
    .label = 元数据 + 笔记（不处理 PDF）
zotseek-pref-notesSpeed = 专注 · 不处理 PDF
zotseek-pref-notesDesc = 索引相同的元数据及条目下的子笔记。
zotseek-pref-fullPaper = 全文
zotseek-pref-fullPaperMenu =
    .label = 全文（更彻底）
zotseek-pref-fullSpeed = 彻底 · 摘要 + 笔记 + PDF
zotseek-pref-fullDesc = 索引相同的元数据、子笔记及带页码的完整 PDF 内容。
zotseek-pref-mcpServer = AI 智能体访问
zotseek-pref-mcpServerLabel =
    .label = 允许 AI 智能体搜索并读取您的文献库（本地 MCP 服务器）
zotseek-pref-mcpServerDesc = 让 Claude Code 等 MCP 客户端进行只读搜索，并读取条目元数据、笔记和 PDF 内容。所有数据均保留在本机（仅限 localhost）。
zotseek-pref-mcpServerUrl = 连接方式：
zotseek-pref-mcpServerWarning = Zotero 的本地 HTTP 服务器已禁用。请在“设置 → 高级”中启用“允许本机上的其他应用程序与 Zotero 通信”。
zotseek-pref-autoIndexing = 自动维护
zotseek-pref-autoIndexLabel =
    .label = Zotero 启动时自动检查并更新索引
zotseek-pref-autoIndexDesc = Zotero 启动时检查所选文库范围，自动更新新增或变化的条目，清理已从 Zotero 删除或当前命中排除规则的索引记录，并在右下角显示进度。
zotseek-pref-checkNowResult = 已检查 { $checked } 个条目；更新 { $changed } 个；移除 { $removed } 条索引记录。
zotseek-indexing-noteUpdate = 正在更新 { $count } 个条目的笔记……
zotseek-indexing-noteUpdateComplete = 已更新 { $count } 个条目的笔记
zotseek-pref-indexScope = 索引范围
zotseek-pref-indexScopeUser =
 .label = 我的文献库
zotseek-pref-indexScopeAll =
 .label = 所有文献库
zotseek-pref-indexScopeDesc = 此范围同时用于手动“检查并更新索引”和 Zotero 启动时的自动维护。
zotseek-pref-searchSettings = 搜索设置
zotseek-pref-resultsToShow = 显示结果数
zotseek-pref-resultsToShowDesc = 显示多少个匹配结果（5–100）
zotseek-pref-minSimilarity = 最低相似度
zotseek-pref-minSimilarityDesc = % — 过滤低质量匹配（0–100）
zotseek-pref-defaultSearchMode = 默认搜索模式
zotseek-pref-defaultSearchModeDesc = 更改默认搜索模式。
zotseek-pref-advancedSettings = 高级设置
zotseek-pref-modelInputSettings = 分块与模型输入
zotseek-pref-modelOptionalHint = （选用时填写）
zotseek-pref-maxTokens = 每分块最大令牌数
zotseek-pref-maxTokensDesc = 可选的用户覆盖值；最终上限由当前模型策略决定
zotseek-pref-modelInputPolicy = 硬上限：{ $limit } · 推荐值：{ $recommended }
zotseek-pref-modelInputUnknown = 由服务器管理
zotseek-pref-modelInputPrefixRequired = 需要
zotseek-pref-modelInputPrefixNone = 不需要
zotseek-pref-modelStatusBundled = 内置
zotseek-pref-modelStatusInstalled = 已安装
zotseek-pref-modelStatusDownload = 需要下载 · 约 { $size } MB
zotseek-pref-modelMultilingual = 多语言
zotseek-modelDownloadChoiceTitle = 安装 Embedding 模型
zotseek-modelDownloadChoiceMessage = { $model } 尚未安装。自动下载会从 huggingface.co 获取约 { $size } MB 的模型文件并保存在这台电脑上。ZotSeek 不会把您的 Zotero 文献库发送到 Hugging Face。
zotseek-modelDownloadAutomatic = 自动下载（推荐）
zotseek-modelDownloadManual = 手动下载
zotseek-modelDownloadCancel = 取消
zotseek-modelDownloadManualTitle = 手动下载模型
zotseek-modelDownloadManualMessage = 请从官方模型页面下载下列文件，并在保留所列子目录的情况下保存到安装位置。

    模型：{ $model }
    官方页面：{ $page }

    所需文件：
    { $files }

    安装位置：
    { $path }

## Cloud Embedding 与 Local Server 命名

zotseek-pref-localServerReady = Local Server（{ $model }）
zotseek-pref-localServerState = Local Server（{ $state }）
zotseek-pref-cloudSlotReady = Cloud（{ $model }）
zotseek-pref-cloudSlotSetup = Cloud（需要设置）
zotseek-pref-cloudTitle = Cloud 模型
zotseek-pref-cloudDesc = 配置 BYOK 云端 Embedding 服务。索引内容和语义查询会发送给云厂商；ZotSeek-U 不收费，也不从中分成。索引和查询均需联网并消耗云厂商 API 额度，可能产生费用；具体计费请参考云厂商的费率文档。
zotseek-pref-cloudProvider = 服务商
zotseek-pref-cloudBaseUrl = Base URL
zotseek-pref-cloudModel = 模型
zotseek-pref-cloudDimensions = 向量维度
zotseek-pref-cloudAdvanced = 高级模型参数
zotseek-pref-cloudMaxInputTokens = 最大输入 Tokens
zotseek-pref-cloudRecommendedChunkTokens = 推荐 Chunk Tokens
zotseek-pref-cloudQueryParameter = 查询参数（可选）
zotseek-pref-cloudIndexParameter = 索引参数（可选）
zotseek-pref-cloudBatchSize = 单批最大输入数
zotseek-pref-cloudResetSettings = 恢复默认设置
zotseek-pref-cloudApiKey = API Key
zotseek-pref-cloudApiKeyMissing = 尚未配置
zotseek-pref-cloudSetApiKey =
    .label = 设置 / 更换
zotseek-pref-cloudRemoveApiKey =
    .label = 删除
zotseek-pref-cloudTest =
    .label = 测试连接
zotseek-pref-cloudAutoIndex =
    .label = 使用 Cloud 模型时，允许 Zotero 在启动时自动维护索引
zotseek-pref-cloudAutoIndexDesc = 默认关闭；同时还需要启用全局“自动维护”设置。
zotseek-pref-cloudConnectionVerified = 连接已验证。
zotseek-pref-cloudConnectionNotVerified = 连接尚未验证。选择 Cloud 前请设置 API Key 并测试连接。
zotseek-pref-cloudTesting = 正在使用固定探测文本测试……本次调用可能产生极少量云厂商费用。
zotseek-pref-cloudTestFailed = 连接测试失败：{ $error }
zotseek-pref-cloudInvalidConfig = Cloud 配置无效：{ $error }
zotseek-pref-cloudSecureStorageError = 安全凭据存储失败：{ $error }
zotseek-pref-cloudApiKeyPromptTitle = 设置 Cloud API Key
zotseek-pref-cloudApiKeyPromptMessage = 请粘贴{ $provider } API Key。密钥会使用 Zotero 安全凭据存储加密，不会写入普通偏好、配置文件或日志。
zotseek-pref-cloudRemoveApiKeyTitle = 删除 Cloud API Key
zotseek-pref-cloudRemoveApiKeyMessage = 删除已保存的 Cloud API Key？如果 Cloud 当前正在使用，ZotSeek 将切回内置 E5 模型。
zotseek-pref-cloudConsentTitle = 是否将 Embedding 内容发送给云厂商？
zotseek-pref-cloudConsentMessage = 选择 Cloud 后，ZotSeek 会把当前索引模式包含的内容，以及每一次语义或 Hybrid 查询，发送给{ $provider }。您需要自带 API Key（BYOK）。云厂商可能向您的账号收费；全部费用仅支付给云厂商，ZotSeek 不收费、不分成，也不参与账单。连接测试会发送固定探测文本，也可能产生极少量厂商费用。是否继续？
zotseek-pref-cloudConsentCustomMessage = 您选择了自定义 OpenAI 兼容服务商。ZotSeek 会把您的 API Key、当前索引模式包含的内容，以及每一次语义或 Hybrid 查询，发送到您自行配置的端点。ZotSeek 无法验证该服务如何存储或使用您的数据。端点、模型与维度由您自行负责。是否继续？
zotseek-pref-cloudRegion = 百炼区域
zotseek-pref-cloudRegionCn = 中国大陆
zotseek-pref-cloudRegionIntl = 国际站
zotseek-pref-cloudCustomWarning = 您自行负责在此配置的端点、模型与维度。ZotSeek 会把您的 API Key 和索引内容发送到该地址。
zotseek-pref-cloudUnconfigured = Cloud 模型尚未配置，请从列表中选择一个模型。
zotseek-pref-cloudRebuildTitle = 是否使用 Cloud 补齐文献索引？
zotseek-pref-cloudRebuildMessage = 这会把 { $count } 篇符合条件的文献内容发送给已配置的云厂商，并可能产生厂商费用。是否继续？
zotseek-pref-modelBackfillTitle = 是否补齐当前模型的文献索引？
zotseek-pref-modelBackfillMessage = 当前模型已覆盖 { $covered }/{ $total } 篇文献。是否在后台为其余 { $missing } 篇建立索引？索引过程中您仍可继续使用 Zotero。
zotseek-modelDownloadOpenPage = 打开模型网页
zotseek-modelDownloadOpenLocation = 打开安装位置
zotseek-modelDownloadClose = 关闭
zotseek-modelDownloadStarting = 正在下载 { $model }……
zotseek-modelDownloadProgress = 正在下载 { $model }：文件 { $done}/{ $total }
zotseek-modelDownloadFailed = 模型操作失败：{ $error }
zotseek-modelDownloadRevealFailedTitle = 无法打开安装位置
zotseek-modelDownloadRevealFailedMessage = ZotSeek 无法打开模型安装位置。您可以复制以下路径并手动打开：

    { $path }
zotseek-pref-resetMaxTokens =
    .label = 恢复推荐值
zotseek-pref-serverConfigTitle = Local Server 模型
zotseek-pref-serverConfigDesc = 在 Zotero profile 的 JSON 模板中配置固定的单一 Local Server 模型槽位。ZotSeek 会在启动时校验模板；编辑后请重启 Zotero 使其生效。
zotseek-pref-serverConfigPath = 模板：
zotseek-pref-serverConfigNotLoaded = 模板尚未加载，请重启 Zotero。
zotseek-pref-serverConfigLoaded = Local Server（{ $model }）已配置。编辑文件后请重启 Zotero 使其生效。
zotseek-pref-serverConfigNone = Local Server（NONE）：尚未配置 Local Server 模型。请在模型菜单中选择 Local Server 查看配置提示。
zotseek-pref-serverConfigErrors = Local Server（UNKNOWN）：发现 { $errors } 个配置错误。请检查模板中的模型 ID、本机服务地址、向量维度、token 配额和查询/文档前缀。
zotseek-pref-serverModelIncomplete = Local Server 模型信息不完整。请填写 JSON 模板并重启 Zotero。
zotseek-serverConfigRequiredTitle = 需要补全 Local Server 模型配置
zotseek-serverConfigRequiredMessage = 当前选择了 Local Server（{ $state }），但模型信息不完整。ZotSeek 会保留这一选择，但暂时不能建立索引或执行语义搜索。

    请编辑：{ $path }

    保存文件后请重启 Zotero。

    { $guidance }
zotseek-serverConfigMissingEntry = 请把模板中的“model”字段填写为一个完整的 Local Server 模型对象。
zotseek-serverConfigInvalidEntry = 模板中有 { $errors } 个配置错误。请根据模板示例补全模型 ID、本机服务地址、向量维度、token 配额及查询/文档前缀。
zotseek-serverConfigOpenLocation = 打开文件所在位置
    .label = 打开文件所在位置
zotseek-serverConfigClose = 关闭
zotseek-serverConfigRevealFailedTitle = 无法打开文件所在位置
zotseek-serverConfigRevealFailedMessage = ZotSeek 无法打开配置文件所在位置。您可以复制下面的路径并手动打开：

    { $path }
zotseek-pref-maxChunks = 每篇文献最大分块数
zotseek-pref-maxChunksDesc = 长文档限制（1–200）
zotseek-pref-excludeBooks =
    .label = 排除书籍
zotseek-pref-excludeBooksDesc = 书籍将不建立索引；已有的书籍 ZotSeek-U 索引会在下次检查索引时移除。
zotseek-pref-excludeTag = 排除标签
zotseek-pref-excludeTagDesc = 带有此标签的条目将不建立索引；匹配条目的现有 ZotSeek-U 索引会在下次检查索引时移除。留空以禁用。
zotseek-pref-actions = 操作
zotseek-pref-maintenanceRepair = 维护与修复
zotseek-pref-updateIndex =
    .label = 检查并更新索引
zotseek-pref-recommended = ✓ 推荐
zotseek-pref-updateIndexDesc = 添加缺失条目，更新元数据、笔记或索引设置发生变化的条目，跳过未变化条目，并清理已从 Zotero 删除或当前命中排除规则的索引记录。索引设置变化可能会使已有条目按当前设置重新计算。
zotseek-pref-rebuildIndex =
    .label = 重建索引
zotseek-pref-rebuildIndexDesc = 清除当前模型的索引，并使用当前设置重新索引所有条目。更改索引模式或分块策略，或明确需要全量重算时使用。
zotseek-pref-clearIndex =
    .label = 清除索引
zotseek-pref-dangerZone = 危险操作
zotseek-pref-destructive = ⚠ 破坏性操作
zotseek-pref-clearIndexDesc = 从数据库中删除所有嵌入向量。之后需要重新索引。
zotseek-pref-about = 关于
zotseek-pref-githubRepo =
    .value = GitHub 仓库
zotseek-pref-modelLine = 模型：{ $model }
zotseek-pref-avgLine = 平均：{ $avg } 分块/文献
zotseek-pref-lastIndexedLine = 上次索引：{ $date }
zotseek-pref-compacted = 数据库已压缩
zotseek-pref-compactionFailed = 压缩失败
zotseek-pref-healthHeader = 数据库健康
zotseek-pref-healthOrphans = 未解析的嵌入：{ $count }
zotseek-pref-healthOrphansDesc = 这些嵌入对应的条目无法与当前 Zotero 文献库匹配。清理可释放空间，但操作不可撤销。
zotseek-pref-healthPurgeOrphans =
    .label = 清理孤立项
zotseek-pref-healthPurgeConfirmTitle = 清理未解析的嵌入
zotseek-pref-healthPurgeConfirmMsg = 这将永久删除在当前 Zotero 文献库中找不到的条目所对应的嵌入向量。是否继续？
zotseek-pref-healthPurgeDoneTitle = 孤立项已清理
zotseek-pref-healthPurgeDoneMsg = 已移除 { $count } 个未解析的条目。
zotseek-pref-healthPurgeFailedTitle = 清理失败

## Search dialog

zotseek-search-search =
    .value = 搜索：
zotseek-search-placeholder =
    .placeholder = 输入搜索查询（输入时自动搜索）… | 例：较高的育儿压力与较低的亲子脑同步相关的文献
zotseek-search-addQuery =
    .label = +
    .tooltiptext = 添加查询以进行 AND/OR 组合
zotseek-search-searchBtn =
    .label = 搜索
zotseek-search-and =
    .label = AND
zotseek-search-or =
    .label = OR
zotseek-search-using =
    .value = 使用
zotseek-search-minimum =
    .label = 最小值
zotseek-search-product =
    .label = 乘积
zotseek-search-average =
    .label = 平均值
zotseek-search-andDesc =
    .value = — 结果必须匹配两个查询
zotseek-search-query2 =
    .value = 查询 2：
zotseek-search-query3 =
    .value = 查询 3：
zotseek-search-query4 =
    .value = 查询 4：
zotseek-search-enterQuery = 输入查询 { $n }…
zotseek-search-removeQuery =
    .label = ✕
    .tooltiptext = 删除此查询
zotseek-search-mode =
    .value = 模式：
zotseek-search-modeHybrid =
    .label = 🔗 混合（推荐）
zotseek-search-modeSemantic =
    .label = 🧠 仅语义
zotseek-search-modeKeyword =
    .label = 🔤 仅关键词
zotseek-search-modeDesc =
    .value = 匹配类型：🔗 两种搜索 · 🧠 AI 匹配 · 🔤 关键词匹配
zotseek-search-results =
    .value = 结果：
zotseek-search-bySection = 按章节
zotseek-search-byLocation = 按位置（精确页码和段落）
zotseek-search-settings =
    .label = ⚙ 设置
    .tooltiptext = 打开 ZotSeek 设置
zotseek-search-openSelected =
    .label = 打开选中项
zotseek-search-close =
    .label = 关闭
zotseek-search-initializing = 正在初始化搜索…
zotseek-search-hybrid = 混合
zotseek-search-semantic = 语义
zotseek-search-keyword = 关键词
zotseek-search-loadingModel = 正在加载 AI 模型（首次可能需要稍等）…
zotseek-search-finding = { $mode }搜索：正在查找条目…
zotseek-search-findingMulti = { $mode }搜索（{ $op }）：正在查找条目…
zotseek-search-noItemsFound = 未找到条目
zotseek-search-showInLibrary = 在文献库中显示
zotseek-search-showItemsInLibrary = 在文献库中显示 { $count } 个条目
zotseek-search-addToCollection = 添加到合集
zotseek-search-noCollections = 无合集
zotseek-search-moreCollections = …及其他 { $count } 个
zotseek-search-foundItems = 找到 { $count } 个条目
zotseek-search-foundItemsFromMatches = 找到 { $count } 个条目（来自 { $matches } 个匹配）
zotseek-search-foundItemsQuery = 找到 { $count } 个条目（{ $query }）
zotseek-search-searching = 搜索中…
zotseek-search-searchLabel = 搜索
zotseek-search-searchingMoment = 即将搜索…
zotseek-search-queryTooShort = 请至少输入2个中日韩字符，或3个其他字符
zotseek-search-failed = 搜索失败：{ $error }
zotseek-search-noItemsMatchingAll = 未找到匹配所有查询的条目
zotseek-search-matchBoth = — 结果必须匹配两个查询
zotseek-search-matchAll = — 结果必须匹配所有查询
zotseek-search-matchAny = — 结果可匹配任一查询

## Results table columns

zotseek-column-match = 匹配
zotseek-column-title = 标题
zotseek-column-authors = 作者
zotseek-column-year = 年份
zotseek-column-location = 位置
zotseek-column-section = 章节

## Source labels

zotseek-source-abstract = 摘要
zotseek-source-fulltext = 全文
zotseek-source-title = 标题
zotseek-source-methods = 方法
zotseek-source-results = 结果
zotseek-source-content = 内容
zotseek-source-note = 笔记
zotseek-search-hybrid-menuitem =
    .label = 🔗 混合（推荐）
zotseek-search-semantic-menuitem =
    .label = 🧠 仅语义
zotseek-search-keyword-menuitem =
    .label = 🔤 仅关键词

## Similar documents dialog

zotseek-similar-title =
    .title = 查找相似文献
zotseek-similar-similarTo = 相似于：{ " " }
zotseek-similar-loading = 加载中…
zotseek-similar-openSelected =
    .label = 打开选中项
zotseek-similar-close =
    .label = 关闭
zotseek-similar-initFailed = 初始化失败：{ $error }
zotseek-similar-noSource = 未选择来源文献
zotseek-similar-finding = 正在查找相似文献…
zotseek-similar-loadingModel = 正在加载 AI 模型…
zotseek-similar-searching = 搜索中…
zotseek-similar-noResults = 未找到相似文献
zotseek-similar-found = 找到 { $count } 篇相似文献
zotseek-similar-searchFailed = 搜索失败：{ $error }

## Indexing progress

zotseek-indexing-title = ZotSeek 索引
zotseek-indexing-clearTitle = 正在清除 ZotSeek 索引
zotseek-indexing-clearConfirmTitle = 清除 ZotSeek 索引
zotseek-indexing-clearConfirmMsg = 这将删除所有存储的嵌入向量。您需要重新索引文献库。

    继续？
zotseek-indexing-clearConfirmButton = 清除索引
zotseek-indexing-initStorage = 正在初始化存储…
zotseek-indexing-deletingAll = 正在删除所有嵌入向量…
zotseek-indexing-clearedSuccess = 索引已成功清除！
zotseek-indexing-clearedMsg = 索引已成功清除。

    您现在可以重新索引文献库。
zotseek-indexing-rebuildTitle = 重建 ZotSeek 索引
zotseek-indexing-rebuildConfirmTitle = 重建 ZotSeek 索引
zotseek-indexing-rebuildConfirmMsg = 这将删除当前模型存储的嵌入向量，并使用当前设置重建该模型索引；其他模型索引会保留。
zotseek-indexing-rebuildConfirmButton = 重建索引
zotseek-indexing-chunkStrategyRebuildRequired = ZotSeek 检测到当前模型的索引使用旧版分块策略。
    旧索引仍可搜索，但后台增量更新已暂停，以避免新旧分块混合。请在设置中使用 “重建索引” 完成全量重建。关闭此提示不会启动重建或修改现有索引。
    根据文献库大小和索引策略，可能需要数十分钟至几小时不等。
zotseek-indexing-rebuildingTitle = 正在重建 ZotSeek 索引
zotseek-indexing-clearingExisting = 正在清除现有索引…
zotseek-indexing-existingCleared = ✓ 当前模型索引已清除
zotseek-indexing-loading = 加载中…
zotseek-indexing-alreadyInProgress = 索引已在进行中…
zotseek-indexing-selectItems = 请选择要索引的条目。
zotseek-indexing-selectCollection = 请先选择一个合集。

    （在左侧边栏中点击一个合集）
zotseek-indexing-emptyCollection = 合集“{ $name }”没有可索引的条目。
zotseek-indexing-emptyCollections = 选定的 { $count } 个合集没有可索引的条目。
zotseek-indexing-updateTitle = ZotSeek - 检查并更新索引
zotseek-indexing-updateConfirmMsg = 要检查并更新{ $scope }的索引吗？ZotSeek 将添加缺失条目，更新元数据、笔记或索引设置发生变化的条目，跳过未变化条目，并清理已从 Zotero 删除或当前命中排除规则的索引记录。索引设置变化可能会使已有条目按当前设置重新计算。
zotseek-indexing-updateConfirmButton = 检查并更新
zotseek-indexing-confirmCancel = 取消
zotseek-indexing-scopeUser = 您的个人文献库
zotseek-indexing-scopeAll = 您的所有文献库（个人 + 群组）

zotseek-indexing-configChangeTitle = ZotSeek - 索引设置已变化
zotseek-indexing-configChangeMessage = { $scope }中有 { $affected } 个已有索引条目的配置记录需要更新，其中 { $rebuildRequired } 个条目需要重新计算嵌入向量，其余条目只更新配置记录。在您选择操作前，ZotSeek 不会删除记录、更新指纹或写入嵌入向量。要如何继续本次启动检查？
zotseek-indexing-configChangeUpdate = 检查并更新索引
zotseek-indexing-configChangeRebuild = 重建索引
zotseek-indexing-configChangeCancel = 取消

# 启动时检测到先前中断的索引任务时显示的恢复提示。
zotseek-resume-title = ZotSeek - 恢复索引
zotseek-resume-message = 上一次索引被中断。ZotSeek 将重新检查{ $scope }中的全部 { $count } 个条目，并继续处理未完成或失败的更新。已经是最新状态的条目将被跳过。如果取消，本次 Zotero 启动也不再执行自动索引维护。现在恢复吗？
zotseek-resume-confirm = 继续执行
zotseek-resume-scopeLibrary = 您的文献库
zotseek-resume-scopeUserLibrary = 您的个人文献库
zotseek-resume-scopeCollection = “{ $name }”合集
zotseek-resume-scopeCollections = 选定的 { $count } 个合集
zotseek-resume-scopeItems = 所选条目范围
zotseek-indexing-noItemsSelected = 未选择条目
zotseek-indexing-removedItems = 已从索引中移除 { $count } 个条目
zotseek-indexing-notInIndex = 选中的条目不在索引中
zotseek-indexing-removeFailed = 从索引中移除失败
zotseek-indexing-mode = 索引模式：{ $mode }
zotseek-indexing-checking = 正在检查已索引的条目…
zotseek-indexing-skippedExcluded = ✓ 跳过 { $count } 个已排除条目
zotseek-indexing-skippedIndexed = ✓ 跳过 { $count } 个已索引条目
zotseek-indexing-allIndexed = 所有条目已索引！
zotseek-indexing-allInIndex = ✓ { $count } 个条目已在索引中
zotseek-indexing-nothingToIndex = 无需索引 — 所有条目均已是最新！
zotseek-indexing-loadingModel = 正在加载 AI 模型（Transformers.js）…
zotseek-indexing-modelLoaded = ✓ AI 模型已加载
zotseek-indexing-batchExtracting = 批次 { $current }/{ $total }：正在提取文本…
zotseek-indexing-batchEmbedding = 批次 { $current }/{ $total }：正在生成嵌入向量…
zotseek-indexing-batchEmbeddingChunks = 批次 { $current }/{ $total }：嵌入分块
zotseek-indexing-chunksFailed = ⚠ { $count } 个分块已跳过：{ $items }
zotseek-indexing-batchSaving = 批次 { $current }/{ $total }：正在保存检查点…
zotseek-indexing-checkpoint = ✓ 检查点 { $current }/{ $total }：{ $items } 个条目，{ $chunks } 个分块已保存
zotseek-indexing-complete = 索引完成！
zotseek-indexing-completeMode = ✓ 模式：{ $mode }
zotseek-indexing-completePrevious = ✓ 先前已索引：{ $count } 个条目
zotseek-indexing-completeNew = ✓ 新增已索引条目：{ $count } 个
zotseek-indexing-completeChunks = ✓ 总分块数：{ $count }
zotseek-indexing-completeAvg = ✓ 平均分块/条目：{ $avg }
zotseek-indexing-completeDuration = ✓ 时长：{ $duration }
zotseek-indexing-completeNoContent = ⚠ 无内容：{ $count } 个条目
zotseek-indexing-completeTruncated = ⚠ 部分内容：{ $count } 个条目达到每篇最大分块数限制。请提高限制或切换至摘要模式以索引全文。
zotseek-indexing-completeSuccess = 索引已成功完成！
zotseek-indexing-cancelled = 索引已取消
zotseek-indexing-pauseAction = 暂停索引
zotseek-indexing-pausingAction = 正在暂停…
zotseek-indexing-pauseTooltip = 在最近的安全检查点停止，并在下次启动 Zotero 时继续
zotseek-indexing-paused = 索引任务已暂停。下次启动 Zotero 时，ZotSeek 将询问是否继续这一精确范围。
zotseek-indexing-failed = 索引失败：{ $error }
zotseek-indexing-progressTitle = ZotSeek
zotseek-indexing-progressItem = 正在索引：{ $title }
zotseek-indexing-progressLoadingModel = 正在加载模型…
zotseek-indexing-allExcluded = 所有条目均已从索引中排除
zotseek-indexing-extracting = 正在提取…
zotseek-indexing-noContent = ✗ 未找到内容
zotseek-indexing-embedding = 嵌入 { $current }/{ $total }…
zotseek-indexing-saving = 正在保存…
zotseek-indexing-chunksIndexed = ✓ { $count } 个分块已索引
zotseek-indexing-chunksIndexedWithFailed = ✓ { $count } 个分块已索引（{ $failed } 个失败）

## Export to Collection (issue #28)

# Keys referenced via data-l10n-id on XUL elements use the .attr = value form
# so Fluent sets the named attribute instead of wiping the element's children.
# Keys consumed via formatValueSync / getString() from JS stay as plain key = text.

zotseek-export-saveAsCollection =
    .label = 将结果保存为合集
zotseek-export-addToCollectionNew =
    .label = 新建合集…
zotseek-export-dialogTitle =
    .title = 将结果保存为合集
zotseek-export-nameLabel =
    .value = 合集名称：
zotseek-export-libraryLabel =
    .value = 文献库：
zotseek-export-ok =
    .label = 保存
zotseek-export-cancel =
    .label = 取消
zotseek-export-itemcountSimple = { $count } 个条目 → { $destination }
zotseek-export-itemcountFiltered = { $total } 个条目中保留 { $kept } 个 → { $destination }（{ $reasons }）
zotseek-export-reasonOtherLibrary = { $count } 个位于其他文献库
zotseek-export-reasonDeleted = { $count } 个已删除
zotseek-export-itemcountEmpty = 没有可添加的条目。
zotseek-export-statusExported = 已将 { $count } 个条目添加到“{ $name }”。
zotseek-export-statusExportedSkipped = 已将 { $count } 个条目添加到“{ $name }”，跳过 { $skipped } 个。
zotseek-export-statusFailed = 无法将结果保存为合集。

## 模型区域标题

zotseek-pref-embeddingModelTitle = 嵌入模型
zotseek-pref-manageModelsTitle = 管理已安装模型

## 设置页分组标题

zotseek-prefs-group-status = 状态
zotseek-prefs-group-models = 模型
zotseek-prefs-group-indexing = 索引
zotseek-prefs-group-search = 搜索
zotseek-prefs-group-maintenance = 集成与维护
zotseek-prefs-exclusions = 排除项
zotseek-indexing-cloudRebuildConfirmTitle = 重建 Cloud 索引？
zotseek-indexing-cloudRebuildConfirmMsg = 预计将把 { $scope } 中的 { $count } 篇文献发送给已配置的云厂商，并可能产生厂商费用。每篇文献成功完成替换前，现有完整索引都会保留。是否继续？
zotseek-indexing-cloudStrategyRebuildConfirmMsg = 当前 Cloud 索引使用旧版分块策略。必须先删除其现有嵌入，再把 { $scope } 中约 { $count } 篇文献重新发送给云厂商，并可能产生厂商费用；其他模型索引会保留。是否继续？

## 简报设置

zotseek-prefs-group-brief = 简报（实验性）
zotseek-pref-brief-title = 文献简报
zotseek-pref-brief-enabled =
    .label = 启用文献简报
zotseek-pref-brief-enabled-desc = 按需从文献 PDF 生成实验性的文献简报。
zotseek-pref-brief-provider = 共享服务商
zotseek-pref-brief-open-cloud-settings = 配置凭据
zotseek-pref-brief-model = 生成模型
zotseek-pref-brief-test = 测试连接
zotseek-pref-brief-create-prompts = 创建我的简报提示词……
zotseek-pref-brief-create-prompts-desc = 为普通论文和综述或理论论文创建配套提示词。
zotseek-pref-brief-standard-prompt = 普通论文提示词
zotseek-pref-brief-review-prompt = 综述/理论论文提示词
zotseek-pref-brief-advanced = 高级设置
zotseek-pref-brief-import-standard = 导入普通论文提示词……
zotseek-pref-brief-import-review = 导入综述提示词……
zotseek-pref-brief-reset-prompts = 恢复内置提示词
zotseek-pref-brief-max-input = 最大输入 token 数
zotseek-pref-brief-max-input-desc = 生成模型的输入预算。
zotseek-pref-brief-max-output = 最大输出 token 数
zotseek-pref-brief-max-output-desc = 为生成预留的输出预算。
zotseek-pref-brief-thinking-enabled =
    .label = 启用扩展思考

## 简报提示词引导

zotseek-brief-prompt-wizard-title = 自定义简报提示词
zotseek-brief-prompt-wizard-domain-label = 主题或研究领域
zotseek-brief-prompt-wizard-language-label = 输出语言
zotseek-brief-prompt-wizard-habits-label = 阅读与分析习惯
zotseek-brief-prompt-wizard-location-label = 提示词位置
zotseek-brief-prompt-wizard-open-location = 打开提示词文件夹
zotseek-brief-prompt-wizard-cancel = 取消

## 简报状态与确认提示

zotseek-pref-brief-prompt-bundled = 内置（{ $file }）
zotseek-pref-brief-prompt-time-unknown = 更新时间未知
zotseek-pref-brief-prompt-custom = 自定义（{ $file }），更新于 { $updated }
zotseek-pref-brief-provider-summary = 服务商：{ $provider } · 凭据：{ $credential }
zotseek-pref-brief-key-configured = 已配置 API 密钥
zotseek-pref-brief-key-missing = 未配置 API 密钥
zotseek-pref-brief-unsupported-provider = 当前简报仅支持 Alibaba Bailian。
zotseek-pref-brief-key-required = 使用简报前，请先配置 Alibaba Bailian API 密钥。
zotseek-pref-brief-connection-verified = 连接已验证
zotseek-pref-brief-connection-not-verified = 连接未验证
zotseek-pref-brief-invalid-settings = 简报设置无效：{ $error }
zotseek-pref-brief-status-failed = 简报生成失败：{ $error }
zotseek-pref-brief-settings-saved = 简报设置已保存。
zotseek-pref-brief-cancelling = 正在取消简报生成……
zotseek-pref-brief-consent-title = 允许生成文献简报吗？
zotseek-pref-brief-consent-message = 生成简报时，ZotSeek 会将文献标题、摘要和 PDF 页文本发送至 { $provider }；创建提示词模板时，会发送两份模板和你填写的表单内容。你的 BYOK 账户可能产生费用，连接测试也可能产生少量费用。是否继续？
zotseek-pref-brief-test-consent-title = 测试文献简报连接吗？
zotseek-pref-brief-test-consent-message = 此次测试只会向 { $provider } 发送固定测试文本，可能产生少量 API 费用；不会发送论文、笔记或文件路径。是否继续？
zotseek-pref-brief-testing = 正在测试连接……
zotseek-pref-brief-test-failed = 连接测试失败：{ $error }
zotseek-pref-brief-connection-required = 生成简报前必须先验证连接。
zotseek-pref-brief-import-failed = 导入提示词失败：{ $error }
zotseek-pref-brief-reset-title = 恢复内置提示词吗？
zotseek-pref-brief-reset-message = 这将用内置提示词替换你的自定义提示词。是否继续？
zotseek-pref-brief-reset-done = 内置提示词已恢复。

## Literature brief menu and runtime status

zotseek-menu-generateBrief = 生成文献简报
zotseek-brief-disabled = 文献简报功能已关闭。
zotseek-brief-busy = 已有其他文献简报任务正在运行。
zotseek-brief-connection-required = 生成前请先验证文献简报连接。
zotseek-brief-start-failed = 无法启动文献简报生成：{ $error }
zotseek-brief-cancelling = 正在取消文献简报生成……
zotseek-brief-cancel-task = 取消任务
zotseek-brief-cancel-tooltip = 取消当前文献简报任务
zotseek-brief-progress-title = 文献简报生成
zotseek-brief-progress-summary = 已完成 { $completed } / { $total } · 成功：{ $success } · 失败：{ $failed } · 跳过：{ $skipped } · 取消：{ $cancelled }
zotseek-brief-progress-active = 正在处理：{ $title }
zotseek-brief-progress-latest = { $title }：{ $status }
zotseek-brief-progress-latest-with-reason = { $title }：{ $status }（{ $reason }）
zotseek-brief-progress-complete = 文献简报任务已完成。
zotseek-brief-summary-title = 文献简报结果
zotseek-brief-summary-message = 成功：{ $success } · 失败：{ $failed } · 跳过：{ $skipped } · 取消：{ $cancelled }
zotseek-brief-usage-heading = 服务商报告的 Token 用量：
zotseek-brief-usage-input = 输入：{ $tokens }
zotseek-brief-usage-output = 输出：{ $tokens }
zotseek-brief-usage-reasoning = 其中推理：{ $tokens }（单独列示，不再另行加总）
zotseek-brief-usage-total = 总计：{ $tokens }
zotseek-brief-usage-total-unavailable = 总计：服务商未返回可用数据
zotseek-brief-usage-requests = 返回可用用量：{ $reported } / { $total } 次请求
zotseek-brief-usage-incomplete = 另有 { $count } 次请求未返回可用用量，以上统计可能不完整，也不等同最终账单。
zotseek-brief-status-success = 成功
zotseek-brief-status-failed = 失败
zotseek-brief-status-skipped = 已跳过
zotseek-brief-status-cancelled = 已取消
zotseek-brief-skip-reason-insufficient-text = 无可提取的 PDF 文本
zotseek-brief-skip-reason-existing-note = 已有子笔记
zotseek-brief-skip-reason-no-main-pdf = 无主 PDF
zotseek-brief-select-one = 请选择一篇普通论文或一个 PDF 附件。
zotseek-brief-invalid-selection = 所选项目不是可处理的论文或 PDF 附件。
zotseek-brief-existing-note-title = 已有简报笔记
zotseek-brief-existing-note-message = 这篇文献已有子笔记。是否再创建一条文献简报笔记？
zotseek-brief-select-collection = 请先选择一个文献库集合。
zotseek-brief-no-eligible = 所选集合中没有可处理的文献。
zotseek-brief-preparation-changed = 本次准备中的服务商、模型或输出限制不一致。请重新发起生成并再次确认。
zotseek-brief-generation-confirm-title = 确认发送并生成文献简报吗？
zotseek-brief-generation-confirm-message = 本次将为 { $count } 篇文献生成简报，并把标题、摘要和 PDF 页文本发送至 { $provider }（模型：{ $model }）。预计输入约 { $inputTokens } tokens；单次输出上限 { $outputTokens } tokens；预计至少 { $requests } 次请求。估算仅供参考，BYOK 账户可能产生费用，最终以服务商返回的用量和账单为准。是否继续？

## Literature brief prompt wizard runtime status

zotseek-brief-wizard-unavailable = 无法启动：文献简报服务不可用。
zotseek-brief-wizard-generating = 正在生成配套提示词文件……
zotseek-brief-wizard-required = 请同时填写研究领域和输出语言。
zotseek-brief-wizard-invalid-result = 文献简报服务没有返回可用结果。
zotseek-brief-wizard-success = 提示词文件已成功生成。
zotseek-brief-wizard-success-no-path = 提示词文件已成功生成，但服务没有返回输出位置。
zotseek-brief-wizard-downloaded-not-enabled = 提示词文件已下载，但未能启用受控双模板。你可以重试，或手动导入已下载的文件。
zotseek-brief-wizard-canceled = 生成已取消。
zotseek-brief-wizard-canceling = 正在取消生成……
zotseek-brief-wizard-failed = 生成失败，未启用任何提示词文件。
zotseek-brief-wizard-open-failed = 无法打开提示词文件位置。
zotseek-brief-wizard-init-failed = 无法启动文献简报提示词引导。
zotseek-search-itemNotFound = 条目不存在
zotseek-pref-brief-refresh-models = 刷新模型
zotseek-pref-brief-models-loading = 正在读取当前提供商可用的模型……
zotseek-pref-brief-models-loaded = 已读取 { $count } 个候选模型；仍需通过连接测试确认可用性。
zotseek-pref-brief-models-empty = 没有发现候选模型，你仍可手动输入模型 ID。
zotseek-pref-brief-models-failed = 无法读取模型列表：{ $error }。你仍可手动输入并测试。
zotseek-brief-wizard-service-title = 连接简报生成模型
zotseek-brief-wizard-service-desc = 简报沿用 Cloud 设置中的提供商和 API Key；这里只单独选择并测试生成模型。
zotseek-brief-wizard-consent =
    .label = 我同意向当前 Cloud 提供商发送连接测试和提示词定制请求
zotseek-brief-wizard-consent-desc = 连接测试只发送固定测试文本；定制只发送两份内置模板和下方回答，不发送论文、笔记或文件路径。
zotseek-brief-wizard-provider-summary = { $provider } · { $credential }
zotseek-brief-wizard-model-required = 请输入一个简报生成模型。
zotseek-brief-wizard-consent-required = 请先确认窄用途外发说明，再测试连接或定制提示词。
zotseek-brief-wizard-test-required = 请先让当前模型通过独立连接测试。
zotseek-brief-wizard-template-title = 选择提示词起点
zotseek-brief-wizard-template-desc = 你可以在内置双模板基础上生成个人版本，也可以直接使用内置版本。
zotseek-brief-wizard-template-personalized-title = 生成我的提示词
zotseek-brief-wizard-template-personalized-desc = 回答三个简短问题，让模型受控修改内置的普通论文与综述双模板。
zotseek-brief-wizard-template-bundled-title = 跳过引导，使用内置模板
zotseek-brief-wizard-template-bundled-desc = 内置模板面向心理学、发展心理学和认知神经科学，默认生成中文简报。
zotseek-brief-wizard-questions-title = 告诉我们你的阅读需求
zotseek-brief-wizard-questions-desc = 这些回答只用于修改内置双模板，不会让模型从空白创建提示词。
zotseek-brief-wizard-domain-example = 例如：计算社会科学、肿瘤免疫学、教育技术。
zotseek-brief-wizard-focus-example = 选填。例如：更关注研究方法与关键数值；保留理论定义和原始引用线索。
zotseek-brief-wizard-confirm-title = 确认生成设置
zotseek-brief-wizard-confirm-desc = 请检查偏好摘要。生成时不会读取任何论文或笔记。
zotseek-brief-wizard-confirm-disclosure = 模型会改写两份内置模板，并严格返回 standard 与 review 两个提示词。
zotseek-brief-wizard-summary = 提供商：{ $provider } | 模型：{ $model } | 研究领域：{ $domain } | 输出语言：{ $language } | 特别关注：{ $focus }
zotseek-brief-wizard-summary-none = 无
zotseek-brief-wizard-result-title = 简报设置已完成
zotseek-brief-wizard-bundled-success = 已启用内置双模板。以后可以从设置页重新进入引导或导入自定义模板。
zotseek-brief-wizard-progress = 第 { $current } / { $total } 步
zotseek-brief-wizard-back = 上一步
zotseek-brief-wizard-next = 下一步
zotseek-brief-wizard-generate = 生成并启用
zotseek-brief-wizard-finish = 完成
zotseek-brief-skip-reason-garbled-text = PDF 文本乱码，模型无法可靠理解
zotseek-pref-brief-model-needs-test = 需要连接测试
zotseek-brief-wizard-service-restored = 当前提供商和模型已通过测试，原有提示词继续有效，简报设置已恢复就绪。
zotseek-brief-wizard-setup-damaged = 现有提示词设置需要修复。请选择内置模板或重新生成一对提示词后再继续。

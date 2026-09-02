# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

## Context menu items

zotseek-menu-findSimilar = 查找相似文献
zotseek-menu-openZotSeek = 打开 ZotSeek...
zotseek-menu-indexSelected = 检查并更新所选条目
zotseek-menu-indexCollection = 检查并更新当前合集
zotseek-menu-updateLibrary = 检查并更新索引
zotseek-menu-removeFromIndex = 从 ZotSeek 索引中移除
zotseek-menu-findRelated = 查找相关文献

## Toolbar

zotseek-toolbar-openZotSeek = 打开 ZotSeek
zotseek-toolbar-findSimilar = 查找相似文献

## Preference pane

zotseek-pref-title = ZotSeek
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
zotseek-pref-indexModeMismatchAction = 点击下方"重建索引"以应用新的索引模式设置。
zotseek-pref-indexingMode = 索引模式
zotseek-pref-abstractOnly = 仅摘要
zotseek-pref-abstractOnlyMenu =
    .label = 仅摘要（更快）
zotseek-pref-abstractSpeed = 快速 • 每篇文献约1个分块
zotseek-pref-abstractDesc = 索引标题和摘要。适合按主题查找文献。
zotseek-pref-notes = 元数据 + 笔记
zotseek-pref-notesMenu =
    .label = 元数据 + 笔记（不处理PDF）
zotseek-pref-notesSpeed = 聚焦笔记 • 不处理PDF
zotseek-pref-notesDesc = 索引标题、摘要、标签和条目下的子笔记。
zotseek-pref-fullPaper = 全文
zotseek-pref-fullPaperMenu =
    .label = 全文（更彻底）
zotseek-pref-fullSpeed = 彻底 • 笔记 + 每个PDF页约1-2个分块
zotseek-pref-fullDesc = 索引标题、摘要、标签、子笔记及带页码的完整PDF内容。
zotseek-pref-mcpServer = AI 智能体访问
zotseek-pref-mcpServerLabel =
    .label = 允许 AI 智能体搜索您的文献库（本地 MCP 服务器）
zotseek-pref-mcpServerDesc = 让 Claude Code 等 MCP 客户端对您的文献库进行只读语义搜索。所有数据均保留在本机（仅限 localhost）。
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
zotseek-pref-resultsToShowDesc = 显示多少个匹配结果（5-100）
zotseek-pref-minSimilarity = 最低相似度
zotseek-pref-minSimilarityDesc = % — 过滤低质量匹配（0-100）
zotseek-pref-advancedSettings = 高级设置
zotseek-pref-maxTokens = 每分块最大令牌数
zotseek-pref-maxTokensDesc = 可选的用户覆盖值；最终上限由当前模型策略决定
zotseek-pref-modelInputPolicy = 硬上限：{ $limit } · 推荐值：{ $recommended } · 当前有效值：{ $effective } · 指令前缀：{ $prefix }
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
zotseek-pref-serverConfigTitle = 高级 Server 模型
zotseek-pref-serverConfigDesc = 在 Zotero profile 的 JSON 模板中配置固定的单一 Server 模型槽位。ZotSeek 会在启动时校验模板；编辑后请重启 Zotero 使其生效。
zotseek-pref-serverConfigPath = 模板：
zotseek-pref-serverConfigNotLoaded = 模板尚未加载，请重启 Zotero。
zotseek-pref-serverConfigLoaded = Server（{ $model }）已配置。编辑文件后请重启 Zotero 使其生效。
zotseek-pref-serverConfigNone = Server（NONE）：尚未配置 Server 模型。请在模型菜单中选择 Server 查看配置提示。
zotseek-pref-serverConfigErrors = Server（UNKNOWN）：发现 { $errors } 个配置错误。请检查模板中的模型 ID、本机服务地址、向量维度、token 配额和查询/文档前缀。
zotseek-pref-serverModelIncomplete = Server 模型信息不完整。请填写 JSON 模板并重启 Zotero。
zotseek-serverConfigRequiredTitle = 需要补全 Server 模型配置
zotseek-serverConfigRequiredMessage = 当前选择了 Server（{ $state }），但模型信息不完整。ZotSeek 会保留这一选择，但暂时不能建立索引或执行语义搜索。

    请编辑：{ $path }

    保存文件后请重启 Zotero。

    { $guidance }
zotseek-serverConfigMissingEntry = 请把模板中的“model”字段填写为一个完整的 Server 模型对象。
zotseek-serverConfigInvalidEntry = 模板中有 { $errors } 个配置错误。请根据模板示例补全模型 ID、本机服务地址、向量维度、token 配额及查询/文档前缀。
zotseek-serverConfigOpenLocation = 打开文件所在位置
    .label = 打开文件所在位置
zotseek-serverConfigClose = 关闭
zotseek-serverConfigRevealFailedTitle = 无法打开文件所在位置
zotseek-serverConfigRevealFailedMessage = ZotSeek 无法打开配置文件所在位置。你可以复制下面的路径并手动打开：

    { $path }
zotseek-pref-maxChunks = 每篇文献最大分块数
zotseek-pref-maxChunksDesc = 长文档限制（1-200）
zotseek-pref-excludeBooks =
    .label = 排除书籍
zotseek-pref-excludeBooksDesc = 书籍将不建立索引；已有的书籍 ZotSeek 索引会在下次检查索引时移除。
zotseek-pref-excludeTag = 排除标签
zotseek-pref-excludeTagDesc = 带有此标签的条目将不建立索引；已有的匹配索引会在下次检查索引时移除。留空以禁用。
zotseek-pref-actions = 操作
zotseek-pref-maintenanceRepair = 维护与修复
zotseek-pref-updateIndex =
    .label = 检查并更新索引
zotseek-pref-recommended = ✓ 推荐
zotseek-pref-updateIndexDesc = 添加缺失条目，更新元数据、笔记或索引设置发生变化的条目，跳过未变化条目，并清理已从 Zotero 删除或当前命中排除规则的索引记录。索引设置变化可能会使已有条目按当前设置重新计算。
zotseek-pref-rebuildIndex =
    .label = 重建索引
zotseek-pref-rebuildIndexDesc = 清除并使用当前设置重新索引所有条目。更改索引模式或分块策略，或明确需要全量重算时使用。
zotseek-pref-clearIndex =
    .label = 清除索引
zotseek-pref-dangerZone = 危险操作
zotseek-pref-destructive = ⚠ 有破坏性
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
zotseek-pref-healthOrphansDesc = 这些嵌入对应的项目无法与当前 Zotero 库匹配。清理可释放空间，但操作不可撤销。
zotseek-pref-healthPurgeOrphans =
    .label = 清理孤立项
zotseek-pref-healthPurgeConfirmTitle = 清理未解析的嵌入
zotseek-pref-healthPurgeConfirmMsg = 这将永久删除在当前 Zotero 库中找不到的项目嵌入。是否继续？
zotseek-pref-healthPurgeDoneTitle = 孤立项已清理
zotseek-pref-healthPurgeDoneMsg = 已移除 { $count } 个未解析的条目。
zotseek-pref-healthPurgeFailedTitle = 清理失败

## Search dialog

zotseek-search-search =
    .value = 搜索：
zotseek-search-placeholder =
    .placeholder = 输入搜索查询（输入时自动搜索）...
zotseek-search-addQuery =
    .label = +
    .tooltiptext = 添加查询以进行AND/OR组合
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
zotseek-search-enterQuery = 输入查询 { $n }...
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
    .value = 匹配类型：🔗 两种搜索 · 🧠 AI匹配 · 🔤 关键词匹配
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
zotseek-search-initializing = 正在初始化搜索...
zotseek-search-hybrid = 混合
zotseek-search-semantic = 语义
zotseek-search-keyword = 关键词
zotseek-search-loadingModel = 正在加载AI模型（首次可能需要稍等）...
zotseek-search-finding = { $mode }搜索：正在查找...
zotseek-search-findingMulti = { $mode }搜索（{ $op }）：正在查找...
zotseek-search-noItemsFound = 未找到条目
zotseek-search-showInLibrary = 在文献库中显示
zotseek-search-showItemsInLibrary = 在文献库中显示 { $count } 个条目
zotseek-search-addToCollection = 添加到合集
zotseek-search-noCollections = 无合集
zotseek-search-moreCollections = ... 及其他 { $count } 个
zotseek-search-foundItems = 找到 { $count } 个条目
zotseek-search-foundItemsFromMatches = 找到 { $count } 个条目（来自 { $matches } 个匹配）
zotseek-search-foundItemsQuery = 找到 { $count } 个条目（{ $query }）
zotseek-search-searching = 搜索中...
zotseek-search-searchLabel = 搜索
zotseek-search-searchingMoment = 即将搜索...
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
zotseek-similar-loading = 加载中...
zotseek-similar-openSelected =
    .label = 打开选中项
zotseek-similar-close =
    .label = 关闭
zotseek-similar-initFailed = 初始化失败：{ $error }
zotseek-similar-noSource = 未选择源文献
zotseek-similar-finding = 正在查找相似文献...
zotseek-similar-loadingModel = 正在加载AI模型...
zotseek-similar-searching = 搜索中...
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
zotseek-indexing-initStorage = 正在初始化存储...
zotseek-indexing-deletingAll = 正在删除所有嵌入向量...
zotseek-indexing-clearedSuccess = 索引已成功清除！
zotseek-indexing-clearedMsg = 索引已成功清除。

    您现在可以重新索引文献库。
zotseek-indexing-rebuildTitle = 重建 ZotSeek 索引
zotseek-indexing-rebuildConfirmTitle = 重建 ZotSeek 索引
zotseek-indexing-rebuildConfirmMsg = 这将删除所有存储的嵌入向量并使用当前设置重建索引。
zotseek-indexing-rebuildConfirmButton = 重建索引
zotseek-indexing-chunkStrategyRebuildRequired = ZotSeek 检测到当前模型的索引使用旧版分块策略。旧索引仍可搜索，但后台增量更新已暂停，以避免新旧分块混合。请在设置中使用“重建索引”完成全量重建。关闭此提示不会启动重建或修改现有索引。

    根据文献库大小，这可能需要几分钟。

    继续？
zotseek-indexing-rebuildingTitle = 正在重建 ZotSeek 索引
zotseek-indexing-clearingExisting = 正在清除现有索引...
zotseek-indexing-existingCleared = ✓ 现有索引已清除
zotseek-indexing-loading = 加载中...
zotseek-indexing-alreadyInProgress = 索引已在进行中...
zotseek-indexing-selectItems = 请选择要索引的条目。
zotseek-indexing-selectCollection = 请先选择一个合集。

    （在左侧边栏中点击一个合集）
zotseek-indexing-emptyCollection = 合集"{ $name }"没有可索引的条目。
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
zotseek-resume-scopeLibrary = 您的所有文献库
zotseek-resume-scopeUserLibrary = 您的个人文献库
zotseek-resume-scopeCollection = "{ $name }" 合集
zotseek-resume-scopeCollections = 选定的 { $count } 个合集
zotseek-resume-scopeItems = 所选条目范围
zotseek-indexing-noItemsSelected = 未选择条目
zotseek-indexing-removedItems = 已从索引中移除 { $count } 个条目
zotseek-indexing-notInIndex = 选中的条目不在索引中
zotseek-indexing-removeFailed = 从索引中移除失败
zotseek-indexing-mode = 索引模式：{ $mode }
zotseek-indexing-checking = 正在检查已索引的条目...
zotseek-indexing-skippedExcluded = ✓ 跳过 { $count } 个已排除条目
zotseek-indexing-skippedIndexed = ✓ 跳过 { $count } 个已索引条目
zotseek-indexing-allIndexed = 所有条目已索引！
zotseek-indexing-allInIndex = ✓ { $count } 个条目已在索引中
zotseek-indexing-nothingToIndex = 无需索引 — 所有条目均已是最新！
zotseek-indexing-loadingModel = 正在加载AI模型（Transformers.js）...
zotseek-indexing-modelLoaded = ✓ AI模型已加载
zotseek-indexing-batchExtracting = 批次 { $current }/{ $total }：正在提取文本...
zotseek-indexing-batchEmbedding = 批次 { $current }/{ $total }：正在生成嵌入向量...
zotseek-indexing-batchEmbeddingChunks = 批次 { $current }/{ $total }：嵌入分块
zotseek-indexing-chunksFailed = ⚠ { $count } 个分块已跳过：{ $items }
zotseek-indexing-batchSaving = 批次 { $current }/{ $total }：正在保存检查点...
zotseek-indexing-checkpoint = ✓ 检查点 { $current }/{ $total }：{ $items } 个条目，{ $chunks } 个分块已保存
zotseek-indexing-complete = 索引完成！
zotseek-indexing-completeMode = ✓ 模式：{ $mode }
zotseek-indexing-completePrevious = ✓ 先前已索引：{ $count } 个条目
zotseek-indexing-completeNew = ✓ 新索引：{ $count } 个条目
zotseek-indexing-completeChunks = ✓ 总分块数：{ $count }
zotseek-indexing-completeAvg = ✓ 平均分块/条目：{ $avg }
zotseek-indexing-completeDuration = ✓ 时长：{ $duration }
zotseek-indexing-completeNoContent = ⚠ 无内容：{ $count } 个条目
zotseek-indexing-completeTruncated = ⚠ 部分内容：{ $count } 个条目达到每篇最大分块数限制。请提高限制或切换至摘要模式以索引完整文本。
zotseek-indexing-completeSuccess = 索引已成功完成！
zotseek-indexing-cancelled = 索引已取消
zotseek-indexing-pauseAction = 暂停索引
zotseek-indexing-pausingAction = 正在暂停…
zotseek-indexing-pauseTooltip = 在最近的安全检查点停止，并在下次启动 Zotero 时继续
zotseek-indexing-paused = 索引任务已暂停。下次启动 Zotero 时，ZotSeek 将询问是否继续这一精确范围。
zotseek-indexing-failed = 索引失败：{ $error }
zotseek-indexing-progressTitle = ZotSeek
zotseek-indexing-progressItem = 正在索引：{ $title }
zotseek-indexing-progressLoadingModel = 正在加载模型...
zotseek-indexing-allExcluded = 所有条目均已从索引中排除
zotseek-indexing-extracting = 正在提取...
zotseek-indexing-noContent = ✗ 未找到内容
zotseek-indexing-embedding = 嵌入 { $current }/{ $total }...
zotseek-indexing-saving = 正在保存...
zotseek-indexing-chunksIndexed = ✓ { $count } 个分块已索引
zotseek-indexing-chunksIndexedWithFailed = ✓ { $count } 个分块已索引（{ $failed } 个失败）

## Export to Collection (issue #28)

# Keys referenced via data-l10n-id on XUL elements use the .attr = value form
# so Fluent sets the named attribute instead of wiping the element's children.
# Keys consumed via formatValueSync / getString() from JS stay as plain key = text.

zotseek-export-saveAsCollection =
    .label = Save Results as Collection
zotseek-export-addToCollectionNew =
    .label = New collection...
zotseek-export-dialogTitle =
    .title = Save Results as Collection
zotseek-export-nameLabel =
    .value = Collection name:
zotseek-export-libraryLabel =
    .value = Library:
zotseek-export-ok =
    .label = Save
zotseek-export-cancel =
    .label = Cancel
zotseek-export-itemcountSimple = { $count } items → { $destination }
zotseek-export-itemcountFiltered = { $kept } of { $total } items → { $destination } ({ $reasons })
zotseek-export-reasonOtherLibrary = { $count } in other libraries
zotseek-export-reasonDeleted = { $count } deleted
zotseek-export-itemcountEmpty = No items to add.
zotseek-export-statusExported = Added { $count } items to "{ $name }".
zotseek-export-statusExportedSkipped = Added { $count } items to "{ $name }", { $skipped } skipped.
zotseek-export-statusFailed = Failed to save results as collection.

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

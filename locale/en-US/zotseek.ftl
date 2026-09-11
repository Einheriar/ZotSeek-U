# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

## Context menu items

zotseek-menu-findSimilar = Find Similar Documents
zotseek-menu-openZotSeek = Open ZotSeek...
zotseek-menu-indexSelected = Check and Update Selected Items
zotseek-menu-indexCollection = Check and Update Current Collection
zotseek-menu-updateLibrary = Check and Update Index
zotseek-menu-removeFromIndex = Remove from ZotSeek Index
zotseek-menu-findRelated = Find Related Documents

## Toolbar

zotseek-toolbar-openZotSeek = Open ZotSeek-U
zotseek-toolbar-findSimilar = Find Similar Documents

## Preference pane

zotseek-pref-title = ZotSeek-U
zotseek-pref-indexStatistics = Index Statistics
zotseek-pref-papersIndexed = Papers Indexed
zotseek-pref-totalChunks = Total Chunks
zotseek-pref-storageUsed = Storage Used
zotseek-pref-model = Model:
zotseek-pref-avg = Avg:
zotseek-pref-chunksPerPaper = chunks/paper
zotseek-pref-lastIndexed = Last indexed:
zotseek-pref-refreshStats =
    .label = Refresh Stats
zotseek-pref-compactDatabase =
    .label = Compact Database
zotseek-pref-autoCompact =
    .label = Compact automatically when Zotero is idle
zotseek-pref-autoCompactDesc = Requires Zotero 10 or later. Runs only when there is meaningful space to reclaim and no indexing is in progress.
zotseek-pref-indexModeMismatch = Index Mode Mismatch
zotseek-pref-indexModeMismatchDesc = Your index was built with { $indexedMode } mode, but your current setting is { $currentMode }.
zotseek-pref-indexModeMismatchAction = Click "Check and Update Index" below to apply the new mode. ZotSeek reuses compatible vectors and computes only missing ones; "Rebuild Index" remains available.
zotseek-pref-indexingMode = Indexing Mode
zotseek-pref-abstractOnly = Abstract only
zotseek-pref-abstractOnlyMenu =
    .label = Abstract only (faster)
zotseek-pref-abstractSpeed = Fast · ~1 chunk per paper
zotseek-pref-abstractDesc = Indexes title, abstract, and tags not starting with #.
zotseek-pref-notes = Metadata + notes
zotseek-pref-notesMenu =
    .label = Metadata + notes (no PDF processing)
zotseek-pref-notesSpeed = Focused · no PDF processing
zotseek-pref-notesDesc = Indexes the same metadata plus child notes.
zotseek-pref-fullPaper = Full paper
zotseek-pref-fullPaperMenu =
    .label = Full paper (more thorough)
zotseek-pref-fullSpeed = Thorough · Abstract + Notes + PDF
zotseek-pref-fullDesc = Indexes the same metadata, child notes, and full PDF content with page numbers.
zotseek-pref-mcpServer = AI Agent Access
zotseek-pref-mcpServerLabel =
    .label = Allow AI agents to search and read your library (local MCP server)
zotseek-pref-mcpServerDesc = Lets MCP clients such as Claude Code perform read-only searches and read item metadata, Notes, and PDF content. Everything stays on this computer (localhost only).
zotseek-pref-mcpServerUrl = Connect with:
zotseek-pref-mcpServerWarning = Zotero's local HTTP server is disabled. Enable "Allow other applications on this computer to communicate with Zotero" in Settings → Advanced.
zotseek-pref-autoIndexing = Automatic Maintenance
zotseek-pref-autoIndexLabel =
    .label = Check and update the index when Zotero starts
zotseek-pref-autoIndexDesc = Checks the selected library scope at startup, updates added or changed items, removes records for items deleted from Zotero or now excluded by indexing rules, and shows progress in the lower-right corner.
zotseek-pref-checkNowResult = Checked { $checked } items; updated { $changed }; removed { $removed } index record(s).
zotseek-indexing-noteUpdate = Updating notes for { $count } item(s)…
zotseek-indexing-noteUpdateComplete = Updated notes for { $count } item(s)
zotseek-pref-indexScope = Index scope
zotseek-pref-indexScopeUser =
 .label = My Library
zotseek-pref-indexScopeAll =
 .label = All libraries
zotseek-pref-indexScopeDesc = This scope applies to the manual “Check and Update Index” action and automatic maintenance at startup.
zotseek-pref-searchSettings = Search Settings
zotseek-pref-resultsToShow = Results to show
zotseek-pref-resultsToShowDesc = How many matches to display (5-100)
zotseek-pref-minSimilarity = Min similarity
zotseek-pref-minSimilarityDesc = % — Filter out low-quality matches (0-100)
zotseek-pref-defaultSearchMode = Default search mode
zotseek-pref-defaultSearchModeDesc = Change the default search mode.
zotseek-pref-advancedSettings = Advanced Settings
zotseek-pref-modelInputSettings = Chunking and Model Input
zotseek-pref-modelOptionalHint = (configure when selected)
zotseek-pref-maxTokens = Max tokens per chunk
zotseek-pref-maxTokensDesc = Optional user override; the active model policy applies the final limit
zotseek-pref-modelInputPolicy = Limit: { $limit } · Recommended: { $recommended }
zotseek-pref-modelInputUnknown = server managed
zotseek-pref-modelInputPrefixRequired = required
zotseek-pref-modelInputPrefixNone = none
zotseek-pref-modelStatusBundled = Built-in
zotseek-pref-modelStatusInstalled = Installed
zotseek-pref-modelStatusDownload = Download required · about { $size } MB
zotseek-pref-modelMultilingual = multilingual
zotseek-modelDownloadChoiceTitle = Install embedding model
zotseek-modelDownloadChoiceMessage = { $model } is not installed. Automatic download retrieves about { $size } MB once from huggingface.co and stores it on this computer. ZotSeek does not send your Zotero library to Hugging Face.
zotseek-modelDownloadAutomatic = Automatic download (recommended)
zotseek-modelDownloadManual = Manual download
zotseek-modelDownloadCancel = Cancel
zotseek-modelDownloadManualTitle = Manual model download
zotseek-modelDownloadManualMessage = Download the required files from the official model page and save them under the installation location while preserving the listed subdirectories.

    Model: { $model }
    Official page: { $page }

    Required files:
    { $files }

    Installation location:
    { $path }

## Cloud embedding and Local Server naming

zotseek-pref-localServerReady = Local Server ({ $model })
zotseek-pref-localServerState = Local Server ({ $state })
zotseek-pref-cloudSlotReady = Cloud ({ $model })
zotseek-pref-cloudSlotSetup = Cloud (SETUP REQUIRED)
zotseek-pref-cloudTitle = Cloud Model
zotseek-pref-cloudDesc = Configure a BYOK Cloud embedding service. Indexed content and semantic queries are sent to the cloud provider; ZotSeek-U does not charge or receive any share of those fees. Indexing and searching both require an internet connection and consume the provider's API quota, which may incur charges; see the provider's pricing documentation for details.
zotseek-pref-cloudProvider = Provider
zotseek-pref-cloudBaseUrl = Base URL
zotseek-pref-cloudModel = Model
zotseek-pref-cloudDimensions = Dimensions
zotseek-pref-cloudAdvanced = Advanced model parameters
zotseek-pref-cloudMaxInputTokens = Maximum input Tokens
zotseek-pref-cloudRecommendedChunkTokens = Recommended Chunk Tokens
zotseek-pref-cloudQueryParameter = Advanced query parameter (optional)
zotseek-pref-cloudIndexParameter = Advanced indexing parameter (optional)
zotseek-pref-cloudBatchSize = Maximum inputs per batch
zotseek-pref-cloudResetSettings = Restore default settings
zotseek-pref-cloudApiKey = API Key
zotseek-pref-cloudApiKeyMissing = Not configured
zotseek-pref-cloudSetApiKey =
    .label = Set / replace
zotseek-pref-cloudRemoveApiKey =
    .label = Remove
zotseek-pref-cloudTest =
    .label = Test connection
zotseek-pref-cloudAutoIndex =
    .label = Allow Zotero to maintain the index at startup when using a Cloud model
zotseek-pref-cloudAutoIndexDesc = Off by default. The global Automatic Maintenance setting must also be enabled.
zotseek-pref-cloudConnectionVerified = Connection verified.
zotseek-pref-cloudConnectionNotVerified = Connection not verified. Set an API key and test the connection before selecting Cloud.
zotseek-pref-cloudTesting = Testing with a fixed probe text… This call may incur a very small provider charge.
zotseek-pref-cloudTestFailed = Connection test failed: { $error }
zotseek-pref-cloudInvalidConfig = Invalid Cloud configuration: { $error }
zotseek-pref-cloudSecureStorageError = Secure credential storage failed: { $error }
zotseek-pref-cloudApiKeyPromptTitle = Set Cloud API Key
zotseek-pref-cloudApiKeyPromptMessage = Paste your { $provider } API Key. It will be encrypted using Zotero secure credential storage and will not be written to preferences, configuration files, or logs.
zotseek-pref-cloudRemoveApiKeyTitle = Remove Cloud API Key
zotseek-pref-cloudRemoveApiKeyMessage = Remove the saved Cloud API Key? If Cloud is active, ZotSeek will switch back to the built-in E5 model.
zotseek-pref-cloudConsentTitle = Send embedding content to a Cloud provider?
zotseek-pref-cloudConsentMessage = When Cloud is selected, ZotSeek sends content included by the current indexing mode and every semantic or Hybrid query to { $provider }. You must provide your own API Key (BYOK). The provider may charge your account; all fees are paid only to the provider. ZotSeek does not charge, receive a share, or participate in billing. A connection test sends fixed probe text and may also incur a very small provider charge. Continue?
zotseek-pref-cloudConsentCustomMessage = You selected a custom OpenAI-compatible provider. ZotSeek will send your API Key, the content included by the current indexing mode, and every semantic or Hybrid query to the endpoint you configured. ZotSeek cannot verify how that service stores or uses your data. You are responsible for the endpoint, model, and dimensions you configured. Continue?
zotseek-pref-cloudRegion = Bailian Region
zotseek-pref-cloudRegionCn = Mainland China
zotseek-pref-cloudRegionIntl = International
zotseek-pref-cloudCustomWarning = You are responsible for the endpoint, model, and dimensions you configure here. ZotSeek sends your API Key and indexed content to this address.
zotseek-pref-cloudUnconfigured = Cloud model is not configured. Select a model from the list.
zotseek-pref-cloudRebuildTitle = Index remaining papers with Cloud?
zotseek-pref-cloudRebuildMessage = This will send content from { $count } eligible papers to the configured Cloud provider. Provider charges may apply. Continue?
zotseek-pref-modelBackfillTitle = Index remaining items?
zotseek-pref-modelBackfillMessage = This model covers { $covered } of { $total } items. Index the remaining { $missing } in the background now? You can keep using Zotero while it runs.
zotseek-modelDownloadOpenPage = Open model page
zotseek-modelDownloadOpenLocation = Open installation location
zotseek-modelDownloadClose = Close
zotseek-modelDownloadStarting = Downloading { $model }…
zotseek-modelDownloadProgress = Downloading { $model }: file { $done } of { $total }
zotseek-modelDownloadFailed = Model operation failed: { $error }
zotseek-modelDownloadRevealFailedTitle = Could not open installation location
zotseek-modelDownloadRevealFailedMessage = ZotSeek could not open the model installation location. You can copy this path and open it manually:

    { $path }
zotseek-pref-resetMaxTokens =
    .label = Use recommended
zotseek-pref-serverConfigTitle = Local Server model
zotseek-pref-serverConfigDesc = Configure the fixed Local Server model slot in the profile JSON template. ZotSeek validates it at startup; edit the file and restart Zotero to apply changes.
zotseek-pref-serverConfigPath = Template:
zotseek-pref-serverConfigNotLoaded = The template has not been loaded yet. Restart Zotero.
zotseek-pref-serverConfigLoaded = Local Server ({ $model }) is configured. Edit the file and restart Zotero to apply changes.
zotseek-pref-serverConfigNone = Local Server (NONE): no local server model is configured. Select Local Server in the model menu to see setup instructions.
zotseek-pref-serverConfigErrors = Local Server (UNKNOWN): { $errors } configuration error(s). Check the model ID, loopback service URL, vector dimensions, token budgets, and query/document prefixes in the template.
zotseek-pref-serverModelIncomplete = Local Server model information is incomplete. Configure the JSON template and restart Zotero.
zotseek-serverConfigRequiredTitle = Local Server model configuration required
zotseek-serverConfigRequiredMessage = Local Server ({ $state }) is selected, but its model information is incomplete. ZotSeek will keep this selection but cannot index or run semantic searches yet.

    Edit: { $path }

    Restart Zotero after saving the file.

    { $guidance }
zotseek-serverConfigMissingEntry = Set the template's "model" field to one complete Local Server model object.
zotseek-serverConfigInvalidEntry = The template has { $errors } configuration error(s). Use the example in the template to complete the model ID, loopback service URL, vector dimensions, token budgets, and query/document prefixes.
zotseek-serverConfigOpenLocation = Open file location
    .label = Open file location
zotseek-serverConfigClose = Close
zotseek-serverConfigRevealFailedTitle = Could not open file location
zotseek-serverConfigRevealFailedMessage = ZotSeek could not open the configuration file location. You can copy this path and open it manually:

    { $path }
zotseek-pref-maxChunks = Max chunks per paper
zotseek-pref-maxChunksDesc = Limit for long documents (1-200)
zotseek-pref-excludeBooks =
    .label = Exclude books from indexing
zotseek-pref-excludeBooksDesc = Books will not be indexed. Existing ZotSeek-U indexes for books are removed by the next index check.
zotseek-pref-excludeTag = Exclude tag
zotseek-pref-excludeTagDesc = Items with this tag will not be indexed. Existing ZotSeek-U indexes for matching items are removed by the next index check. Leave empty to disable.
zotseek-pref-actions = Actions
zotseek-pref-maintenanceRepair = Maintenance and Repair
zotseek-pref-updateIndex =
    .label = Check and Update Index
zotseek-pref-recommended = ✓ Recommended
zotseek-pref-updateIndexDesc = Add missing items, update items whose metadata, notes, or indexing settings changed, skip unchanged items, and remove records for items deleted from Zotero or now excluded by indexing rules. Changes to indexing settings may recompute existing items.
zotseek-pref-rebuildIndex =
    .label = Rebuild Index
zotseek-pref-rebuildIndexDesc = Clear the current model's index and re-index all items with current settings. Use after changing indexing mode or chunking strategy, or when a full re-index is required.
zotseek-pref-clearIndex =
    .label = Clear Index
zotseek-pref-dangerZone = Danger Zone
zotseek-pref-destructive = ⚠ Destructive
zotseek-pref-clearIndexDesc = Remove all embeddings from the database. You will need to re-index afterwards.
zotseek-pref-about = About
zotseek-pref-githubRepo =
    .value = GitHub Repository
zotseek-pref-modelLine = Model: { $model }
zotseek-pref-avgLine = Avg: { $avg } chunks/paper
zotseek-pref-lastIndexedLine = Last indexed: { $date }
zotseek-pref-compacted = Database Compacted
zotseek-pref-compactionFailed = Compaction Failed
zotseek-pref-healthHeader = Database Health
zotseek-pref-healthOrphans = Unresolved embeddings: { $count }
zotseek-pref-healthOrphansDesc = Embeddings whose source items couldn't be matched to your current library. Purging frees space but cannot be undone.
zotseek-pref-healthPurgeOrphans =
    .label = Purge Orphans
zotseek-pref-healthPurgeConfirmTitle = Purge Unresolved Embeddings
zotseek-pref-healthPurgeConfirmMsg = This will permanently delete embeddings for items not found in your current Zotero library. Continue?
zotseek-pref-healthPurgeDoneTitle = Orphans Purged
zotseek-pref-healthPurgeDoneMsg = Removed { $count } unresolved entries.
zotseek-pref-healthPurgeFailedTitle = Purge Failed

## Search dialog

zotseek-search-search =
    .value = Search:
zotseek-search-placeholder =
    .placeholder = Enter your search query (auto-searches as you type)... | E.g.: Studies linking higher parenting stress to lower parent-child brain synchrony
zotseek-search-addQuery =
    .label = +
    .tooltiptext = Add another query for AND/OR combination
zotseek-search-searchBtn =
    .label = Search
zotseek-search-and =
    .label = AND
zotseek-search-or =
    .label = OR
zotseek-search-using =
    .value = using
zotseek-search-minimum =
    .label = Minimum
zotseek-search-product =
    .label = Product
zotseek-search-average =
    .label = Average
zotseek-search-andDesc =
    .value = — results must match both queries
zotseek-search-query2 =
    .value = Query 2:
zotseek-search-query3 =
    .value = Query 3:
zotseek-search-query4 =
    .value = Query 4:
zotseek-search-enterQuery = Enter query { $n }...
zotseek-search-removeQuery =
    .label = ✕
    .tooltiptext = Remove this query
zotseek-search-mode =
    .value = Mode:
zotseek-search-modeHybrid =
    .label = 🔗 Hybrid (Recommended)
zotseek-search-modeSemantic =
    .label = 🧠 Semantic Only
zotseek-search-modeKeyword =
    .label = 🔤 Keyword Only
zotseek-search-modeDesc =
    .value = Match type: 🔗 both searches · 🧠 AI match · 🔤 keyword match
zotseek-search-results =
    .value = Results:
zotseek-search-bySection = By Section
zotseek-search-byLocation = By Location (exact page & paragraph)
zotseek-search-settings =
    .label = ⚙ Settings
    .tooltiptext = Open ZotSeek preferences
zotseek-search-openSelected =
    .label = Open Selected
zotseek-search-close =
    .label = Close
zotseek-search-initializing = Initializing search...
zotseek-search-hybrid = Hybrid
zotseek-search-semantic = Semantic
zotseek-search-keyword = Keyword
zotseek-search-loadingModel = Loading AI model (first time may take a moment)...
zotseek-search-finding = { $mode } search: Finding items...
zotseek-search-findingMulti = { $mode } search ({ $op }): Finding items...
zotseek-search-noItemsFound = No items found
zotseek-search-showInLibrary = Show in Library
zotseek-search-showItemsInLibrary = Show { $count } Items in Library
zotseek-search-addToCollection = Add to Collection
zotseek-search-noCollections = No collections
zotseek-search-moreCollections = ... and { $count } more
zotseek-search-foundItems = Found { $count } items
zotseek-search-foundItemsFromMatches = Found { $count } items (from { $matches } matches)
zotseek-search-foundItemsQuery = Found { $count } items ({ $query })
zotseek-search-searching = Searching...
zotseek-search-searchLabel = Search
zotseek-search-searchingMoment = Searching in a moment...
zotseek-search-queryTooShort = Enter at least 2 CJK characters or 3 other characters
zotseek-search-failed = Search failed: { $error }
zotseek-search-noItemsMatchingAll = No items found matching all queries
zotseek-search-matchBoth = — results must match both queries
zotseek-search-matchAll = — results must match all queries
zotseek-search-matchAny = — results can match any query

## Results table columns

zotseek-column-match = Match
zotseek-column-title = Title
zotseek-column-authors = Authors
zotseek-column-year = Year
zotseek-column-location = Location
zotseek-column-section = Section

## Source labels

zotseek-source-abstract = Abstract
zotseek-source-fulltext = Full Text
zotseek-source-title = Title
zotseek-source-methods = Methods
zotseek-source-results = Results
zotseek-source-content = Content
zotseek-source-note = Note
zotseek-search-hybrid-menuitem =
    .label = 🔗 Hybrid (Recommended)
zotseek-search-semantic-menuitem =
    .label = 🧠 Semantic Only
zotseek-search-keyword-menuitem =
    .label = 🔤 Keyword Only

## Similar documents dialog

zotseek-similar-title =
    .title = Find Similar Documents
zotseek-similar-similarTo = Similar to:{ " " }
zotseek-similar-loading = Loading...
zotseek-similar-openSelected =
    .label = Open Selected
zotseek-similar-close =
    .label = Close
zotseek-similar-initFailed = Failed to initialize: { $error }
zotseek-similar-noSource = No source document selected
zotseek-similar-finding = Finding similar documents...
zotseek-similar-loadingModel = Loading AI model...
zotseek-similar-searching = Searching...
zotseek-similar-noResults = No similar documents found
zotseek-similar-found = Found { $count } similar documents
zotseek-similar-searchFailed = Search failed: { $error }

## Indexing progress

zotseek-indexing-title = ZotSeek Indexing
zotseek-indexing-clearTitle = Clearing ZotSeek Index
zotseek-indexing-clearConfirmTitle = Clear ZotSeek Index
zotseek-indexing-clearConfirmMsg = This will delete all stored embeddings. You will need to re-index your library.

    Continue?
zotseek-indexing-clearConfirmButton = Clear Index
zotseek-indexing-initStorage = Initializing storage...
zotseek-indexing-deletingAll = Deleting all embeddings...
zotseek-indexing-clearedSuccess = Index cleared successfully!
zotseek-indexing-clearedMsg = Index cleared successfully.

    You can now re-index your library.
zotseek-indexing-rebuildTitle = Rebuild ZotSeek Index
zotseek-indexing-rebuildConfirmTitle = Rebuild ZotSeek Index
zotseek-indexing-rebuildConfirmMsg = This will delete the current model's stored embeddings and rebuild that model's index with your current settings. Other model indexes are kept.
zotseek-indexing-rebuildConfirmButton = Rebuild Index
zotseek-indexing-chunkStrategyRebuildRequired = ZotSeek detected that the current model's index uses an older chunking strategy.
    The existing index remains searchable, but background incremental updates are paused to avoid mixing old and new chunks. Use "Rebuild Index" in Settings to perform a full rebuild. Dismissing this notice does not start a rebuild or modify the existing index.
    Depending on the library size and indexing strategy, the rebuild may take from tens of minutes to several hours.
zotseek-indexing-rebuildingTitle = Rebuilding ZotSeek Index
zotseek-indexing-clearingExisting = Clearing existing index...
zotseek-indexing-existingCleared = ✓ Current model index cleared
zotseek-indexing-loading = Loading...
zotseek-indexing-alreadyInProgress = Indexing already in progress...
zotseek-indexing-selectItems = Please select items to index.
zotseek-indexing-selectCollection = Please select a collection first.

    (Click on a collection in the left sidebar)
zotseek-indexing-emptyCollection = Collection "{ $name }" has no items to index.
zotseek-indexing-emptyCollections = The { $count } selected collections have no items to index.
zotseek-indexing-updateTitle = ZotSeek - Check and Update Index
zotseek-indexing-updateConfirmMsg = Check and update the index for { $scope }? ZotSeek will add missing items, update items whose metadata, notes, or indexing settings changed, skip unchanged items, and remove records for items deleted from Zotero or now excluded by indexing rules. Changes to indexing settings may recompute existing items using the current settings.
zotseek-indexing-updateConfirmButton = Check and Update
zotseek-indexing-confirmCancel = Cancel
zotseek-indexing-scopeUser = your personal library
zotseek-indexing-scopeAll = all your libraries (personal + groups)

zotseek-indexing-configChangeTitle = ZotSeek - Index Settings Changed
zotseek-indexing-configChangeMessage = The indexing settings changed for { $affected } already indexed item(s) in { $scope }; { $rebuildRequired } item(s) need embeddings recomputed, while the others only need their configuration record updated. Before you choose, ZotSeek will not delete records, update fingerprints, or write embeddings. How should this startup check proceed?
zotseek-indexing-configChangeUpdate = Check and Update Index
zotseek-indexing-configChangeRebuild = Rebuild Index
zotseek-indexing-configChangeCancel = Cancel

# Auto-resume prompt shown at startup when a previous bulk-index run was interrupted.
zotseek-resume-title = ZotSeek - Resume Indexing
zotseek-resume-message = A previous indexing run was interrupted. ZotSeek will recheck all { $count } item(s) in { $scope } and resume unfinished or failed updates. Items that are already current will be skipped. If you cancel, automatic index maintenance will also be skipped for this startup. Resume now?
zotseek-resume-confirm = Resume Indexing
zotseek-resume-scopeLibrary = your libraries
zotseek-resume-scopeUserLibrary = your personal library
zotseek-resume-scopeCollection = the "{ $name }" collection
zotseek-resume-scopeCollections = { $count } selected collections
zotseek-resume-scopeItems = the selected-items scope
zotseek-indexing-noItemsSelected = No items selected
zotseek-indexing-removedItems = Removed { $count } item(s) from index
zotseek-indexing-notInIndex = Selected items were not in the index
zotseek-indexing-removeFailed = Failed to remove from index
zotseek-indexing-mode = Indexing mode: { $mode }
zotseek-indexing-checking = Checking for already-indexed items...
zotseek-indexing-skippedExcluded = ✓ Skipped { $count } excluded item(s)
zotseek-indexing-skippedIndexed = ✓ Skipped { $count } already-indexed items
zotseek-indexing-allIndexed = All items already indexed!
zotseek-indexing-allInIndex = ✓ { $count } items already in index
zotseek-indexing-nothingToIndex = Nothing to index — all items are up to date!
zotseek-indexing-loadingModel = Loading AI model (Transformers.js)...
zotseek-indexing-modelLoaded = ✓ AI model loaded
zotseek-indexing-batchExtracting = Batch { $current }/{ $total }: Extracting text...
zotseek-indexing-batchEmbedding = Batch { $current }/{ $total }: Generating embeddings...
zotseek-indexing-batchEmbeddingChunks = Batch { $current }/{ $total }: Embedding chunks
zotseek-indexing-chunksFailed = ⚠ { $count } chunks skipped in: { $items }
zotseek-indexing-batchSaving = Batch { $current }/{ $total }: Saving checkpoint...
zotseek-indexing-checkpoint = ✓ Checkpoint { $current }/{ $total }: { $items } items, { $chunks } chunks saved
zotseek-indexing-complete = Indexing Complete!
zotseek-indexing-completeMode = ✓ Mode: { $mode }
zotseek-indexing-completePrevious = ✓ Previously indexed: { $count } items
zotseek-indexing-completeNew = ✓ Newly indexed: { $count } items
zotseek-indexing-completeChunks = ✓ Total chunks: { $count }
zotseek-indexing-completeAvg = ✓ Avg chunks/item: { $avg }
zotseek-indexing-completeDuration = ✓ Duration: { $duration }
zotseek-indexing-completeNoContent = ⚠ No content: { $count } items
zotseek-indexing-completeTruncated = ⚠ Partial content: { $count } item(s) hit the Max Chunks per Paper limit. Raise the limit or switch to Summary mode to index the full text.
zotseek-indexing-completeSuccess = Indexing completed successfully!
zotseek-indexing-cancelled = Indexing cancelled
zotseek-indexing-pauseAction = Pause indexing
zotseek-indexing-pausingAction = Pausing…
zotseek-indexing-pauseTooltip = Stop after the current safe checkpoint and resume next time Zotero starts
zotseek-indexing-paused = Indexing paused. ZotSeek will offer to resume this exact scope the next time Zotero starts.
zotseek-indexing-failed = Indexing failed: { $error }
zotseek-indexing-progressTitle = ZotSeek
zotseek-indexing-progressItem = Indexing: { $title }
zotseek-indexing-progressLoadingModel = Loading model...
zotseek-indexing-allExcluded = All items are excluded from indexing
zotseek-indexing-extracting = Extracting...
zotseek-indexing-noContent = ✗ No content found
zotseek-indexing-embedding = Embedding { $current }/{ $total }...
zotseek-indexing-saving = Saving...
zotseek-indexing-chunksIndexed = ✓ { $count } chunks indexed
zotseek-indexing-chunksIndexedWithFailed = ✓ { $count } chunks indexed ({ $failed } failed)

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

## Preference group headers

zotseek-prefs-group-status = Status
zotseek-prefs-group-models = Models
zotseek-prefs-group-indexing = Indexing
zotseek-prefs-group-search = Search
zotseek-prefs-group-maintenance = Integrations & Maintenance
zotseek-prefs-exclusions = Exclusions

## Model section headers (fallbacks existed in XHTML only; adds the missing ftl entries)

zotseek-pref-embeddingModelTitle = Embedding Model
zotseek-pref-manageModelsTitle = Manage installed models
zotseek-indexing-cloudRebuildConfirmTitle = Rebuild Cloud index?
zotseek-indexing-cloudRebuildConfirmMsg = About { $count } papers in { $scope } will be sent to the configured Cloud provider and may incur provider charges. Existing complete indexes are kept until each paper is replaced successfully. Continue?
zotseek-indexing-cloudStrategyRebuildConfirmMsg = The current Cloud index uses an older chunk strategy. Its existing embeddings must be deleted before about { $count } papers in { $scope } are sent again, which may incur provider charges. Other model indexes are kept. Continue?

## Literature brief settings

zotseek-prefs-group-brief = Literature Briefs (Experimental)
zotseek-pref-brief-title = Literature Briefs
zotseek-pref-brief-enabled =
    .label = Enable literature briefs
zotseek-pref-brief-enabled-desc = Generate an experimental literature brief from a paper's PDF when requested.
zotseek-pref-brief-provider = Shared provider
zotseek-pref-brief-open-cloud-settings = Configure credentials
zotseek-pref-brief-model = Generation model
zotseek-pref-brief-test = Test connection
zotseek-pref-brief-create-prompts = Create my brief prompts…
zotseek-pref-brief-create-prompts-desc = Create paired prompts for standard papers and reviews or theory papers.
zotseek-pref-brief-standard-prompt = Standard paper prompt
zotseek-pref-brief-review-prompt = Review/theory prompt
zotseek-pref-brief-advanced = Advanced
zotseek-pref-brief-import-standard = Import standard prompt…
zotseek-pref-brief-import-review = Import review prompt…
zotseek-pref-brief-reset-prompts = Restore built-in prompts
zotseek-pref-brief-max-input = Maximum input tokens
zotseek-pref-brief-max-input-desc = Generation-model input budget.
zotseek-pref-brief-max-output = Maximum output tokens
zotseek-pref-brief-max-output-desc = Reserved generation output budget.
zotseek-pref-brief-thinking-enabled =
    .label = Enable extended reasoning

## Literature brief prompt wizard

zotseek-brief-prompt-wizard-title = Customize Literature Brief Prompts
zotseek-brief-prompt-wizard-domain-label = Topic or research domain
zotseek-brief-prompt-wizard-language-label = Output language
zotseek-brief-prompt-wizard-habits-label = Reading and analysis preferences
zotseek-brief-prompt-wizard-location-label = Prompt location
zotseek-brief-prompt-wizard-open-location = Open prompt folder
zotseek-brief-prompt-wizard-cancel = Cancel

## Literature brief status and consent

zotseek-pref-brief-prompt-bundled = Built-in ({ $file })
zotseek-pref-brief-prompt-time-unknown = Update time unavailable
zotseek-pref-brief-prompt-custom = Custom ({ $file }), updated { $updated }
zotseek-pref-brief-provider-summary = Provider: { $provider } · Credential: { $credential }
zotseek-pref-brief-key-configured = API key configured
zotseek-pref-brief-key-missing = API key not configured
zotseek-pref-brief-unsupported-provider = Literature briefs currently support Alibaba Bailian only.
zotseek-pref-brief-key-required = Configure an Alibaba Bailian API key before using literature briefs.
zotseek-pref-brief-connection-verified = Connection verified
zotseek-pref-brief-connection-not-verified = Connection not verified
zotseek-pref-brief-invalid-settings = Invalid brief settings: { $error }
zotseek-pref-brief-status-failed = Brief generation failed: { $error }
zotseek-pref-brief-settings-saved = Brief settings saved.
zotseek-pref-brief-cancelling = Cancelling brief generation…
zotseek-pref-brief-consent-title = Allow literature brief generation?
zotseek-pref-brief-consent-message = To generate a brief, ZotSeek will send the paper title, abstract, and PDF page text to { $provider }. When creating prompt templates, it will send the two templates and your form responses. Your BYOK account may incur charges, and even a connection test may incur a small charge. Continue?
zotseek-pref-brief-test-consent-title = Test the literature-brief connection?
zotseek-pref-brief-test-consent-message = This test sends only fixed test text to { $provider } and may incur a small API charge. It never sends papers, notes, or file paths. Continue?
zotseek-pref-brief-testing = Testing connection…
zotseek-pref-brief-test-failed = Connection test failed: { $error }
zotseek-pref-brief-connection-required = Verify the connection before generating a brief.
zotseek-pref-brief-import-failed = Failed to import prompt: { $error }
zotseek-pref-brief-reset-title = Restore built-in prompts?
zotseek-pref-brief-reset-message = This will replace your custom prompts with the built-in prompts. Continue?
zotseek-pref-brief-reset-done = Built-in prompts restored.

## Literature brief menu and runtime status

zotseek-menu-generateBrief = Generate literature brief
zotseek-brief-disabled = Literature briefs are disabled.
zotseek-brief-busy = Another literature brief task is already running.
zotseek-brief-connection-required = Verify the literature brief connection before generating.
zotseek-brief-start-failed = Could not start literature brief generation: { $error }
zotseek-brief-cancelling = Cancelling literature brief generation…
zotseek-brief-cancel-task = Cancel task
zotseek-brief-cancel-tooltip = Cancel this literature brief task
zotseek-brief-progress-title = Literature brief generation
zotseek-brief-progress-summary = Completed { $completed } of { $total } · Success: { $success } · Failed: { $failed } · Skipped: { $skipped } · Cancelled: { $cancelled }
zotseek-brief-progress-active = Processing: { $title }
zotseek-brief-progress-latest = { $title }: { $status }
zotseek-brief-progress-latest-with-reason = { $title }: { $status } ({ $reason })
zotseek-brief-progress-complete = Literature brief task complete.
zotseek-brief-summary-title = Literature brief results
zotseek-brief-summary-message = Success: { $success } · Failed: { $failed } · Skipped: { $skipped } · Cancelled: { $cancelled }
zotseek-brief-usage-heading = Provider-reported token usage:
zotseek-brief-usage-input = Input: { $tokens }
zotseek-brief-usage-output = Output: { $tokens }
zotseek-brief-usage-reasoning = Reasoning: { $tokens } (shown separately; not added again)
zotseek-brief-usage-total = Total: { $tokens }
zotseek-brief-usage-total-unavailable = Total: no usable value returned by the provider
zotseek-brief-usage-requests = Usable usage returned: { $reported } of { $total } requests
zotseek-brief-usage-incomplete = { $count } additional request(s) returned no usable usage. These figures may be incomplete and are not the final bill.
zotseek-brief-status-success = Succeeded
zotseek-brief-status-failed = Failed
zotseek-brief-status-skipped = Skipped
zotseek-brief-status-cancelled = Cancelled
zotseek-brief-skip-reason-insufficient-text = no extractable PDF text
zotseek-brief-skip-reason-existing-note = already has a child note
zotseek-brief-skip-reason-no-main-pdf = no main PDF
zotseek-brief-select-one = Select one regular paper or PDF attachment.
zotseek-brief-invalid-selection = The selected item is not an eligible paper or PDF attachment.
zotseek-brief-existing-note-title = Existing brief note
zotseek-brief-existing-note-message = This paper already has a child note. Create an additional literature brief note?
zotseek-brief-select-collection = Select a collection first.
zotseek-brief-no-eligible = No eligible papers were found in the selected collection.
zotseek-brief-preparation-changed = The provider, model, or output limit changed during preparation. Start generation again and reconfirm.
zotseek-brief-generation-confirm-title = Confirm sending and generating literature briefs?
zotseek-brief-generation-confirm-message = Generate briefs for { $count } paper(s) and send their titles, abstracts, and PDF page text to { $provider } (model: { $model }). Estimated input: about { $inputTokens } tokens; per-request output limit: { $outputTokens } tokens; expected minimum: { $requests } request(s). The estimate is advisory. Your BYOK account may incur charges; final usage and billing come from the provider. Continue?

## Literature brief prompt wizard runtime status

zotseek-brief-wizard-unavailable = Unable to start: the literature brief service is unavailable.
zotseek-brief-wizard-generating = Generating paired prompt files…
zotseek-brief-wizard-required = Provide both a research field and an output language.
zotseek-brief-wizard-invalid-result = The literature brief service returned no usable result.
zotseek-brief-wizard-success = Prompt files generated successfully.
zotseek-brief-wizard-success-no-path = Prompt files generated successfully; no output location was returned.
zotseek-brief-wizard-downloaded-not-enabled = Prompt files were downloaded, but the managed pair could not be activated. You can retry or import the downloaded files manually.
zotseek-brief-wizard-canceled = Generation canceled.
zotseek-brief-wizard-canceling = Canceling generation…
zotseek-brief-wizard-failed = Generation failed. No prompt files were activated.
zotseek-brief-wizard-open-failed = Unable to open the prompt file location.
zotseek-brief-wizard-init-failed = Unable to start the literature brief prompt wizard.
zotseek-search-itemNotFound = Item not found
zotseek-pref-brief-refresh-models = Refresh models
zotseek-pref-brief-models-loading = Loading models available to the current provider…
zotseek-pref-brief-models-loaded = Loaded { $count } candidate models; a connection test is still required.
zotseek-pref-brief-models-empty = No candidate models were found. You can still enter a model ID manually.
zotseek-pref-brief-models-failed = Could not load models: { $error }. You can still enter and test a model manually.
zotseek-brief-wizard-service-title = Connect a brief generation model
zotseek-brief-wizard-service-desc = Briefs inherit the provider and API key from Cloud settings. Choose and test only the generation model here.
zotseek-brief-wizard-consent =
    .label = I agree to send connection-test and prompt-customization requests to the current Cloud provider
zotseek-brief-wizard-consent-desc = The test sends fixed text only. Customization sends the two built-in templates and your answers, never papers, notes, or file paths.
zotseek-brief-wizard-provider-summary = { $provider } · { $credential }
zotseek-brief-wizard-model-required = Enter a brief generation model.
zotseek-brief-wizard-consent-required = Confirm the narrow disclosure before testing the connection or customizing prompts.
zotseek-brief-wizard-test-required = Run the independent connection test for this model first.
zotseek-brief-wizard-template-title = Choose a prompt starting point
zotseek-brief-wizard-template-desc = Personalize the built-in pair or explicitly use it unchanged.
zotseek-brief-wizard-template-personalized-title = Create my prompts
zotseek-brief-wizard-template-personalized-desc = Answer three short questions so the model can make constrained changes to both built-in templates.
zotseek-brief-wizard-template-bundled-title = Skip guidance and use built-in templates
zotseek-brief-wizard-template-bundled-desc = The built-ins target psychology, developmental psychology, and cognitive neuroscience, and output Chinese by default.
zotseek-brief-wizard-questions-title = Tell us how you read
zotseek-brief-wizard-questions-desc = Your answers modify the built-in pair; they do not ask the model to create prompts from scratch.
zotseek-brief-wizard-domain-example = Examples: computational social science, cancer immunology, or educational technology.
zotseek-brief-wizard-focus-example = Optional. For example: emphasize methods and key values; preserve definitions and original citation leads.
zotseek-brief-wizard-confirm-title = Confirm generation settings
zotseek-brief-wizard-confirm-desc = Review the preference summary. No papers or notes are read during generation.
zotseek-brief-wizard-confirm-disclosure = The model rewrites both built-in templates and must return exactly the standard and review prompts.
zotseek-brief-wizard-summary = Provider: { $provider } | Model: { $model } | Field: { $domain } | Language: { $language } | Focus: { $focus }
zotseek-brief-wizard-summary-none = None
zotseek-brief-wizard-result-title = Brief setup complete
zotseek-brief-wizard-bundled-success = The built-in prompt pair is active. You can reopen the guide or import custom prompts later.
zotseek-brief-wizard-progress = Step { $current } of { $total }
zotseek-brief-wizard-back = Back
zotseek-brief-wizard-next = Next
zotseek-brief-wizard-generate = Generate and enable
zotseek-brief-wizard-finish = Finish
zotseek-brief-skip-reason-garbled-text = PDF text is too garbled to understand reliably
zotseek-pref-brief-model-needs-test = connection test required
zotseek-brief-wizard-service-restored = The current provider and model passed the test. Your existing prompts remain active and brief setup is ready.
zotseek-brief-wizard-setup-damaged = The existing prompt setup needs repair. Choose the built-in prompts or create a new pair to continue.

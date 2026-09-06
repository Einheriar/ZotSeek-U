# ZotSeek Japanese localization


## Cloud embedding and Local Server naming

zotseek-pref-localServerReady = Local Server ({ $model })
zotseek-pref-localServerState = Local Server ({ $state })
zotseek-pref-cloudSlotReady = Cloud ({ $model })
zotseek-pref-cloudSlotSetup = Cloud (SETUP REQUIRED)
zotseek-pref-cloudTitle = Cloud Model
zotseek-pref-cloudDesc = BYOK のクラウド Embedding サービスを設定します。インデックス対象の内容とセマンティック検索クエリはクラウド事業者に送信されます。Zotseek-U は料金を請求せず、手数料も受け取りません。インデックス作成と検索にはインターネット接続が必要で、事業者の API 利用枠を消費し、料金が発生する場合があります。詳しくはクラウド事業者の料金資料を確認してください。
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
    .label = Cloud モデル使用時に、Zotero 起動時のインデックス自動メンテナンスを許可
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
zotseek-pref-cloudBriefSwitchTitle = Literature brief generation will be unavailable
zotseek-pref-cloudBriefSwitchMessage = Literature brief generation currently supports only Alibaba Bailian. If you switch providers, the brief feature will be unavailable and its connection state will be cleared. Switch anyway?
zotseek-pref-cloudRebuildTitle = Index remaining papers with Cloud?
zotseek-pref-cloudRebuildMessage = This will send content from { $count } eligible papers to the configured Cloud provider. Provider charges may apply. Continue?
zotseek-pref-modelBackfillTitle = 現在のモデルで残りの文献を索引しますか？
zotseek-pref-modelBackfillMessage = このモデルで索引済みの文献は { $total } 件中 { $covered } 件です。残りの { $missing } 件をバックグラウンドで索引しますか？処理中も Zotero を使用できます。
## Context menu items
zotseek-menu-findSimilar = 類似文献を検索
zotseek-menu-openZotSeek = ZotSeekを開く…
zotseek-menu-indexSelected = 選択した項目を確認して更新
zotseek-menu-indexCollection = 現在のコレクションを確認して更新
zotseek-menu-updateLibrary = インデックスを確認して更新
zotseek-menu-removeFromIndex = ZotSeekのインデックスから削除
zotseek-menu-findRelated = 関連文献を検索

## Toolbar
zotseek-toolbar-openZotSeek = Zotseek-Uを開く
zotseek-toolbar-findSimilar = 類似文献を検索

## Preference pane
zotseek-pref-title = Zotseek-U
zotseek-pref-indexStatistics = インデックス統計
zotseek-pref-papersIndexed = インデックス済み文献
zotseek-pref-totalChunks = チャンク数
zotseek-pref-storageUsed = 使用ストレージ
zotseek-pref-model = モデル:
zotseek-pref-avg = 平均:
zotseek-pref-chunksPerPaper = チャンク/文献
zotseek-pref-lastIndexed = 最終インデックス作成:
zotseek-pref-refreshStats =
    .label = 統計を更新
zotseek-pref-compactDatabase =
    .label = データベースを圧縮
zotseek-pref-autoCompact =
    .label = Zoteroがアイドル状態のとき自動的に圧縮
zotseek-pref-autoCompactDesc = Zotero 10以降が必要です。回収できる空き容量が十分で、インデックス作成中でない場合のみ実行します。
zotseek-pref-indexModeMismatch = インデックスモードの不一致
zotseek-pref-indexModeMismatchDesc = インデックスは{ $indexedMode }モードで作成されていますが、現在の設定は{ $currentMode }です。
zotseek-pref-indexModeMismatchAction = 新しいモードを適用するには、下の「インデックスを確認して更新」をクリックしてください。ZotSeek は互換性のあるベクトルを再利用し、不足分だけを計算します。「インデックスを再構築」も引き続き選択できます。
zotseek-pref-indexingMode = インデックスモード
zotseek-pref-abstractOnly = 要旨のみ
zotseek-pref-abstractOnlyMenu =
    .label = 要旨のみ（高速）
zotseek-pref-abstractSpeed = 高速 · 文献あたり約1チャンク
zotseek-pref-abstractDesc = タイトル、要旨、# で始まらないタグをインデックス化します。
zotseek-pref-notes = メタデータ + ノート
zotseek-pref-notesMenu =
    .label = メタデータ + ノート（PDF処理なし）
zotseek-pref-notesSpeed = 集中的 · PDF処理なし
zotseek-pref-notesDesc = 同じメタデータと子ノートをインデックス化します。
zotseek-pref-fullPaper = 論文全文
zotseek-pref-fullPaperMenu =
    .label = 論文全文（より詳細）
zotseek-pref-fullSpeed = 詳細 · 要旨 + ノート + PDF
zotseek-pref-fullDesc = 同じメタデータ、子ノート、ページ番号付きのPDF全文をインデックス化します。
zotseek-pref-mcpServer = AIエージェントアクセス
zotseek-pref-mcpServerLabel =
    .label = AIエージェントによるライブラリの検索と読み取りを許可（ローカルMCPサーバー）
zotseek-pref-mcpServerDesc = Claude CodeなどのMCPクライアントが読み取り専用の検索を実行し、アイテムのメタデータ、ノート、PDF本文を読み取れるようにします。すべての処理はこのコンピューター上（localhostのみ）で行われます。
zotseek-pref-mcpServerUrl = 接続先:
zotseek-pref-mcpServerWarning = ZoteroのローカルHTTPサーバーが無効です。設定 → 詳細設定で「このコンピューター上の他のアプリケーションによるZoteroとの通信を許可」を有効にしてください。
zotseek-pref-autoIndexing = 自動メンテナンス
zotseek-pref-autoIndexLabel =
    .label = Zoteroの起動時にインデックスを確認して更新
zotseek-pref-autoIndexDesc = 起動時に選択したライブラリ範囲を確認し、追加・変更された項目を更新します。Zoteroから削除された項目やインデックス規則で除外された項目のレコードを削除し、右下に進捗を表示します。
zotseek-pref-checkNowResult = { $checked }件を確認、{ $changed }件を更新、{ $removed }件のインデックスレコードを削除しました。
zotseek-indexing-noteUpdate = { $count }件の項目のノートを更新中…
zotseek-indexing-noteUpdateComplete = { $count }件の項目のノートを更新しました
zotseek-pref-indexScope = インデックス範囲
zotseek-pref-indexScopeUser =
 .label = マイライブラリ
zotseek-pref-indexScopeAll =
 .label = すべてのライブラリ
zotseek-pref-indexScopeDesc = この範囲は、手動の「インデックスを確認して更新」と起動時の自動メンテナンスに適用されます。
zotseek-pref-searchSettings = 検索設定
zotseek-pref-resultsToShow = 表示する結果数
zotseek-pref-resultsToShowDesc = 表示する一致件数（5～100）
zotseek-pref-minSimilarity = 最小類似度
zotseek-pref-minSimilarityDesc = % — 品質の低い一致を除外（0～100）
zotseek-pref-defaultSearchMode = デフォルトの検索モード
zotseek-pref-defaultSearchModeDesc = デフォルトの検索モードを変更します。
zotseek-pref-advancedSettings = 詳細設定
zotseek-pref-modelInputSettings = チャンク分割とモデル入力
zotseek-pref-modelOptionalHint = （選択時に設定）
zotseek-pref-maxTokens = チャンクあたりの最大トークン数
zotseek-pref-maxTokensDesc = 任意のユーザー設定値。最終的な上限はアクティブなモデルポリシーが適用します
zotseek-pref-modelInputPolicy = 上限: { $limit } · 推奨: { $recommended }
zotseek-pref-modelInputUnknown = サーバー管理
zotseek-pref-modelInputPrefixRequired = 必須
zotseek-pref-modelInputPrefixNone = なし
zotseek-pref-modelStatusBundled = 組み込み
zotseek-pref-modelStatusInstalled = インストール済み
zotseek-pref-modelStatusDownload = ダウンロードが必要 · 約{ $size } MB
zotseek-pref-modelMultilingual = 多言語
zotseek-modelDownloadChoiceTitle = 埋め込みモデルをインストール
zotseek-modelDownloadChoiceMessage = { $model }はインストールされていません。自動ダウンロードではhuggingface.coから約{ $size } MBを一度だけ取得し、このコンピューターに保存します。ZotSeekがZoteroライブラリをHugging Faceに送信することはありません。
zotseek-modelDownloadAutomatic = 自動ダウンロード（推奨）
zotseek-modelDownloadManual = 手動ダウンロード
zotseek-modelDownloadCancel = キャンセル
zotseek-modelDownloadManualTitle = モデルを手動でダウンロード
zotseek-modelDownloadManualMessage = 公式モデルページから必要なファイルをダウンロードし、一覧のサブディレクトリ構成を保ったままインストール場所の下に保存してください。

    モデル: { $model }
    公式ページ: { $page }

    必要なファイル:
    { $files }

    インストール場所:
    { $path }
zotseek-modelDownloadOpenPage = モデルページを開く
zotseek-modelDownloadOpenLocation = インストール場所を開く
zotseek-modelDownloadClose = 閉じる
zotseek-modelDownloadStarting = { $model }をダウンロード中…
zotseek-modelDownloadProgress = { $model }をダウンロード中: ファイル{ $done }/{ $total }
zotseek-modelDownloadFailed = モデル操作に失敗しました: { $error }
zotseek-modelDownloadRevealFailedTitle = インストール場所を開けませんでした
zotseek-modelDownloadRevealFailedMessage = ZotSeekはモデルのインストール場所を開けませんでした。次のパスをコピーして手動で開いてください:

    { $path }
zotseek-pref-resetMaxTokens =
    .label = 推奨値を使用
zotseek-pref-serverConfigTitle = Local Server モデル
zotseek-pref-serverConfigDesc = プロファイルJSONテンプレートで固定の Local Server モデルスロットを設定します。ZotSeekは起動時に検証します。ファイルを編集し、変更を適用するにはZoteroを再起動してください。
zotseek-pref-serverConfigPath = テンプレート:
zotseek-pref-serverConfigNotLoaded = テンプレートはまだ読み込まれていません。Zoteroを再起動してください。
zotseek-pref-serverConfigLoaded = Local Server（{ $model }）が設定されています。ファイルを編集し、変更を適用するにはZoteroを再起動してください。
zotseek-pref-serverConfigNone = Local Server（NONE）: Local Server モデルが設定されていません。モデルメニューで Local Server を選択すると設定手順を確認できます。
zotseek-pref-serverConfigErrors = Local Server（UNKNOWN）: 設定エラー{ $errors }件。モデルID、ループバックサービスURL、ベクトル次元数、トークン予算、クエリ/文書プレフィックスを確認してください。
zotseek-pref-serverModelIncomplete = Local Server モデル情報が不完全です。JSONテンプレートを設定し、Zoteroを再起動してください。
zotseek-serverConfigRequiredTitle = Local Server モデルの設定が必要です
zotseek-serverConfigRequiredMessage = Local Server（{ $state }）が選択されていますが、モデル情報が不完全です。ZotSeekはこの選択を保持しますが、現時点ではインデックス作成やセマンティック検索を実行できません。

    編集: { $path }

    ファイルを保存した後、Zoteroを再起動してください。

    { $guidance }
zotseek-serverConfigMissingEntry = テンプレートの「model」フィールドに、完全な Local Server モデルオブジェクトを1つ設定してください。
zotseek-serverConfigInvalidEntry = テンプレートに設定エラーが{ $errors }件あります。テンプレートの例を使い、モデルID、ループバックサービスURL、ベクトル次元数、トークン予算、クエリ/文書プレフィックスを完成させてください。
zotseek-serverConfigOpenLocation = ファイルの場所を開く
    .label = ファイルの場所を開く
zotseek-serverConfigClose = 閉じる
zotseek-serverConfigRevealFailedTitle = ファイルの場所を開けませんでした
zotseek-serverConfigRevealFailedMessage = ZotSeekは設定ファイルの場所を開けませんでした。次のパスをコピーして手動で開いてください:

    { $path }
zotseek-pref-maxChunks = 文献あたりの最大チャンク数
zotseek-pref-maxChunksDesc = 長い文書の上限（1～200）
zotseek-pref-excludeBooks =
    .label = 書籍をインデックスから除外
zotseek-pref-excludeBooksDesc = 書籍はインデックス化されません。書籍の既存のZotseek-Uインデックスは、次回のインデックス確認時に削除されます。
zotseek-pref-excludeTag = 除外タグ
zotseek-pref-excludeTagDesc = このタグを持つ項目はインデックス化されません。一致する項目の既存Zotseek-Uインデックスは、次回の確認時に削除されます。無効にするには空欄にしてください。
zotseek-pref-actions = 操作
zotseek-pref-maintenanceRepair = メンテナンスと修復
zotseek-pref-updateIndex =
    .label = インデックスを確認して更新
zotseek-pref-recommended = ✓ 推奨
zotseek-pref-updateIndexDesc = 不足している項目を追加し、メタデータ・ノート・インデックス設定が変更された項目を更新します。変更のない項目はスキップし、Zoteroから削除された項目やインデックス規則で除外された項目のレコードを削除します。インデックス設定の変更により既存項目を再計算する場合があります。
zotseek-pref-rebuildIndex =
    .label = インデックスを再構築
zotseek-pref-rebuildIndexDesc = 現在のモデルのインデックスを消去し、現在の設定ですべての項目を再インデックス化します。モードやチャンク戦略の変更後に使用してください。
zotseek-pref-clearIndex =
    .label = インデックスを消去
zotseek-pref-dangerZone = 危険な操作
zotseek-pref-destructive = ⚠ 破壊的操作
zotseek-pref-clearIndexDesc = データベースからすべての埋め込みを削除します。その後、再度インデックス化が必要です。
zotseek-pref-about = 情報
zotseek-pref-githubRepo =
    .value = GitHub リポジトリ
zotseek-pref-modelLine = モデル: { $model }
zotseek-pref-avgLine = 平均: { $avg }チャンク/文献
zotseek-pref-lastIndexedLine = 最終インデックス作成: { $date }
zotseek-pref-compacted = データベースを圧縮しました
zotseek-pref-compactionFailed = データベースの圧縮に失敗しました
zotseek-pref-healthHeader = データベースの状態
zotseek-pref-healthOrphans = 未解決の埋め込み: { $count }
zotseek-pref-healthOrphansDesc = 現在のライブラリで元の項目と照合できない埋め込みです。削除すると空き容量を確保できますが、元に戻せません。
zotseek-pref-healthPurgeOrphans =
    .label = 未解決データを削除
zotseek-pref-healthPurgeConfirmTitle = 未解決の埋め込みを削除
zotseek-pref-healthPurgeConfirmMsg = 現在のZoteroライブラリに見つからない項目の埋め込みを完全に削除します。続行しますか？
zotseek-pref-healthPurgeDoneTitle = 未解決データを削除しました
zotseek-pref-healthPurgeDoneMsg = 未解決のエントリを{ $count }件削除しました。
zotseek-pref-healthPurgeFailedTitle = 削除に失敗しました

## Search dialog
zotseek-search-search =
    .value = 検索:
zotseek-search-placeholder =
    .placeholder = 検索語を入力（入力中に自動検索）… | 例：育児ストレスの高さと親子間脳同期の低さに関連する文献
zotseek-search-addQuery =
    .label = +
    .tooltiptext = AND/OR結合用の検索語を追加
zotseek-search-searchBtn =
    .label = 検索
zotseek-search-and =
    .label = AND
zotseek-search-or =
    .label = OR
zotseek-search-using =
    .value = 使用:
zotseek-search-minimum =
    .label = 最小
zotseek-search-product =
    .label = 積
zotseek-search-average =
    .label = 平均
zotseek-search-andDesc =
    .value = — 両方の検索語に一致する結果
zotseek-search-query2 =
    .value = 検索語2:
zotseek-search-query3 =
    .value = 検索語3:
zotseek-search-query4 =
    .value = 検索語4:
zotseek-search-enterQuery = 検索語{ $n }を入力…
zotseek-search-removeQuery =
    .label = ✕
    .tooltiptext = この検索語を削除
zotseek-search-mode =
    .value = モード:
zotseek-search-modeHybrid =
    .label = 🔗 ハイブリッド（推奨）
zotseek-search-modeSemantic =
    .label = 🧠 セマンティックのみ
zotseek-search-modeKeyword =
    .label = 🔤 キーワードのみ
zotseek-search-modeDesc =
    .value = 一致方式: 🔗 両方の検索 · 🧠 AI一致 · 🔤 キーワード一致
zotseek-search-results =
    .value = 結果:
zotseek-search-bySection = セクション別
zotseek-search-byLocation = 場所別（正確なページと段落）
zotseek-search-settings =
    .label = ⚙ 設定
    .tooltiptext = ZotSeekの設定を開く
zotseek-search-openSelected =
    .label = 選択項目を開く
zotseek-search-close =
    .label = 閉じる
zotseek-search-initializing = 検索を初期化中…
zotseek-search-hybrid = ハイブリッド
zotseek-search-semantic = セマンティック
zotseek-search-keyword = キーワード
zotseek-search-loadingModel = AIモデルを読み込み中（初回は時間がかかる場合があります）…
zotseek-search-finding = { $mode }検索: 項目を検索中…
zotseek-search-findingMulti = { $mode }検索（{ $op }）: 項目を検索中…
zotseek-search-noItemsFound = 項目が見つかりません
zotseek-search-showInLibrary = ライブラリで表示
zotseek-search-showItemsInLibrary = ライブラリで{ $count }件を表示
zotseek-search-addToCollection = コレクションに追加
zotseek-search-noCollections = コレクションなし
zotseek-search-moreCollections = …ほか{ $count }件
zotseek-search-foundItems = { $count }件の項目が見つかりました
zotseek-search-foundItemsFromMatches = { $matches }件の一致から{ $count }件の項目が見つかりました
zotseek-search-foundItemsQuery = { $count }件の項目が見つかりました（{ $query }）
zotseek-search-searching = 検索中…
zotseek-search-searchLabel = 検索
zotseek-search-searchingMoment = まもなく検索します…
zotseek-search-queryTooShort = CJK文字は2文字以上、それ以外は3文字以上入力してください
zotseek-search-failed = 検索に失敗しました: { $error }
zotseek-search-noItemsMatchingAll = すべての検索語に一致する項目が見つかりません
zotseek-search-matchBoth = — 両方の検索語に一致する結果
zotseek-search-matchAll = — すべての検索語に一致する結果
zotseek-search-matchAny = — いずれかの検索語に一致する結果

## Results table columns
zotseek-column-match = 一致度
zotseek-column-title = タイトル
zotseek-column-authors = 著者
zotseek-column-year = 年
zotseek-column-location = 場所
zotseek-column-section = セクション

## Source labels
zotseek-source-abstract = 要旨
zotseek-source-fulltext = 全文
zotseek-source-title = タイトル
zotseek-source-methods = 方法
zotseek-source-results = 結果
zotseek-source-content = 内容
zotseek-source-note = ノート
zotseek-search-hybrid-menuitem =
    .label = 🔗 ハイブリッド（推奨）
zotseek-search-semantic-menuitem =
    .label = 🧠 セマンティックのみ
zotseek-search-keyword-menuitem =
    .label = 🔤 キーワードのみ

## Similar documents dialog
zotseek-similar-title =
    .title = 類似文献を検索
zotseek-similar-similarTo = 類似対象:{ " " }
zotseek-similar-loading = 読み込み中…
zotseek-similar-openSelected =
    .label = 選択項目を開く
zotseek-similar-close =
    .label = 閉じる
zotseek-similar-initFailed = 初期化に失敗しました: { $error }
zotseek-similar-noSource = 元の文献が選択されていません
zotseek-similar-finding = 類似文献を検索中…
zotseek-similar-loadingModel = AIモデルを読み込み中…
zotseek-similar-searching = 検索中…
zotseek-similar-noResults = 類似文献が見つかりません
zotseek-similar-found = 類似文献が{ $count }件見つかりました
zotseek-similar-searchFailed = 検索に失敗しました: { $error }

## Indexing progress
zotseek-indexing-title = ZotSeekのインデックス作成
zotseek-indexing-clearTitle = ZotSeekインデックスを消去
zotseek-indexing-clearConfirmTitle = ZotSeekインデックスを消去
zotseek-indexing-clearConfirmMsg = 保存されているすべての埋め込みを削除します。ライブラリを再度インデックス化する必要があります。

    続行しますか？
zotseek-indexing-clearConfirmButton = インデックスを消去
zotseek-indexing-initStorage = ストレージを初期化中…
zotseek-indexing-deletingAll = すべての埋め込みを削除中…
zotseek-indexing-clearedSuccess = インデックスを消去しました！
zotseek-indexing-clearedMsg = インデックスを消去しました。

    これでライブラリを再度インデックス化できます。
zotseek-indexing-rebuildTitle = ZotSeekインデックスを再構築
zotseek-indexing-rebuildConfirmTitle = ZotSeekインデックスを再構築
zotseek-indexing-rebuildConfirmMsg = 現在のモデルの埋め込みを削除してインデックスを再構築します。他のモデルのインデックスは保持されます。
zotseek-indexing-rebuildConfirmButton = インデックスを再構築
zotseek-indexing-chunkStrategyRebuildRequired = 現在のモデルのインデックスが古いチャンク戦略を使用していることをZotSeekが検出しました。
    既存のインデックスは検索できますが、古いチャンクと新しいチャンクの混在を避けるため、バックグラウンドの増分更新を一時停止しています。設定の「インデックスを再構築」を使って完全に再構築してください。この通知を閉じても再構築は開始されず、既存のインデックスも変更されません。
    ライブラリの規模とインデックス戦略によっては、再構築に数十分から数時間かかる場合があります。
zotseek-indexing-rebuildingTitle = ZotSeekインデックスを再構築中
zotseek-indexing-clearingExisting = 既存のインデックスを消去中…
zotseek-indexing-existingCleared = ✓ 現在のモデルのインデックスを消去しました
zotseek-indexing-loading = 読み込み中…
zotseek-indexing-alreadyInProgress = インデックス作成はすでに進行中です…
zotseek-indexing-selectItems = インデックス化する項目を選択してください。
zotseek-indexing-selectCollection = 先にコレクションを選択してください。

    （左側のサイドバーでコレクションをクリック）
zotseek-indexing-emptyCollection = コレクション「{ $name }」にはインデックス化する項目がありません。
zotseek-indexing-emptyCollections = 選択した{ $count }件のコレクションにはインデックス化する項目がありません。
zotseek-indexing-updateTitle = ZotSeek - インデックスを確認して更新
zotseek-indexing-updateConfirmMsg = { $scope }のインデックスを確認して更新しますか？ZotSeekは不足している項目を追加し、メタデータ・ノート・インデックス設定が変更された項目を更新します。変更のない項目はスキップし、Zoteroから削除された項目やインデックス規則で除外された項目のレコードを削除します。インデックス設定の変更により、現在の設定で既存項目を再計算する場合があります。
zotseek-indexing-updateConfirmButton = 確認して更新
zotseek-indexing-confirmCancel = キャンセル
zotseek-indexing-scopeUser = 個人ライブラリ
zotseek-indexing-scopeAll = すべてのライブラリ（個人 + グループ）
zotseek-indexing-configChangeTitle = ZotSeek - インデックス設定を変更
zotseek-indexing-configChangeMessage = { $scope }でインデックス済みの{ $affected }件の項目について設定が変更されました。{ $rebuildRequired }件は埋め込みの再計算が必要で、残りは設定レコードのみ更新します。選択するまで、レコードの削除、フィンガープリントの更新、埋め込みの書き込みは行いません。この起動時チェックをどう進めますか？
zotseek-indexing-configChangeUpdate = インデックスを確認して更新
zotseek-indexing-configChangeRebuild = インデックスを再構築
zotseek-indexing-configChangeCancel = キャンセル

# Auto-resume prompt shown at startup when a previous bulk-index run was interrupted.
zotseek-resume-title = ZotSeek - インデックス作成を再開
zotseek-resume-message = 前回のインデックス作成が中断されました。ZotSeekは{ $scope }の全{ $count }件を再確認し、未完了または失敗した更新を再開します。最新の項目はスキップされます。キャンセルすると、今回の起動時の自動メンテナンスもスキップされます。今すぐ再開しますか？
zotseek-resume-confirm = インデックス作成を再開
zotseek-resume-scopeLibrary = ライブラリ
zotseek-resume-scopeUserLibrary = 個人ライブラリ
zotseek-resume-scopeCollection = 「{ $name }」コレクション
zotseek-resume-scopeCollections = 選択した{ $count }件のコレクション
zotseek-resume-scopeItems = 選択項目の範囲
zotseek-indexing-noItemsSelected = 項目が選択されていません
zotseek-indexing-removedItems = インデックスから{ $count }件を削除しました
zotseek-indexing-notInIndex = 選択した項目はインデックスにありません
zotseek-indexing-removeFailed = インデックスからの削除に失敗しました
zotseek-indexing-mode = インデックスモード: { $mode }
zotseek-indexing-checking = インデックス済みの項目を確認中…
zotseek-indexing-skippedExcluded = ✓ 除外された{ $count }件をスキップ
zotseek-indexing-skippedIndexed = ✓ インデックス済みの{ $count }件をスキップ
zotseek-indexing-allIndexed = すべての項目はすでにインデックス済みです！
zotseek-indexing-allInIndex = ✓ { $count }件はすでにインデックスにあります
zotseek-indexing-nothingToIndex = インデックス化するものはありません — すべて最新です！
zotseek-indexing-loadingModel = AIモデルを読み込み中（Transformers.js）…
zotseek-indexing-modelLoaded = ✓ AIモデルを読み込みました
zotseek-indexing-batchExtracting = バッチ{ $current }/{ $total }: テキストを抽出中…
zotseek-indexing-batchEmbedding = バッチ{ $current }/{ $total }: 埋め込みを生成中…
zotseek-indexing-batchEmbeddingChunks = バッチ{ $current }/{ $total }: チャンクを埋め込み中
zotseek-indexing-chunksFailed = ⚠ { $items }で{ $count }チャンクをスキップ
zotseek-indexing-batchSaving = バッチ{ $current }/{ $total }: チェックポイントを保存中…
zotseek-indexing-checkpoint = ✓ チェックポイント{ $current }/{ $total }: { $items }件、{ $chunks }チャンクを保存
zotseek-indexing-complete = インデックス作成完了！
zotseek-indexing-completeMode = ✓ モード: { $mode }
zotseek-indexing-completePrevious = ✓ 既存: { $count }件
zotseek-indexing-completeNew = ✓ 新規: { $count }件
zotseek-indexing-completeChunks = ✓ チャンク合計: { $count }
zotseek-indexing-completeAvg = ✓ 平均チャンク/項目: { $avg }
zotseek-indexing-completeDuration = ✓ 所要時間: { $duration }
zotseek-indexing-completeNoContent = ⚠ 内容なし: { $count }件
zotseek-indexing-completeTruncated = ⚠ 部分的な内容: { $count }件が文献あたりの最大チャンク数に達しました。上限を上げるか、要約モードに切り替えて全文をインデックス化してください。
zotseek-indexing-completeSuccess = インデックス作成が正常に完了しました！
zotseek-indexing-cancelled = インデックス作成をキャンセルしました
zotseek-indexing-pauseAction = インデックス作成を一時停止
zotseek-indexing-pausingAction = 一時停止中…
zotseek-indexing-pauseTooltip = 現在の安全なチェックポイント後に停止し、次回のZotero起動時に再開
zotseek-indexing-paused = インデックス作成を一時停止しました。次回のZotero起動時に、この範囲の再開を提案します。
zotseek-indexing-failed = インデックス作成に失敗しました: { $error }
zotseek-indexing-progressTitle = ZotSeek
zotseek-indexing-progressItem = インデックス作成中: { $title }
zotseek-indexing-progressLoadingModel = モデルを読み込み中…
zotseek-indexing-allExcluded = すべての項目がインデックスから除外されています
zotseek-indexing-extracting = 抽出中…
zotseek-indexing-noContent = ✗ 内容が見つかりません
zotseek-indexing-embedding = 埋め込み中 { $current }/{ $total }…
zotseek-indexing-saving = 保存中…
zotseek-indexing-chunksIndexed = ✓ { $count }チャンクをインデックス化しました
zotseek-indexing-chunksIndexedWithFailed = ✓ { $count }チャンクをインデックス化（{ $failed }件失敗）

## Export to Collection
zotseek-export-saveAsCollection =
    .label = 結果をコレクションとして保存
zotseek-export-addToCollectionNew =
    .label = 新しいコレクション…
zotseek-export-dialogTitle =
    .title = 結果をコレクションとして保存
zotseek-export-nameLabel =
    .value = コレクション名:
zotseek-export-libraryLabel =
    .value = ライブラリ:
zotseek-export-ok =
    .label = 保存
zotseek-export-cancel =
    .label = キャンセル
zotseek-export-itemcountSimple = { $count }件 → { $destination }
zotseek-export-itemcountFiltered = { $total }件中{ $kept }件 → { $destination }（{ $reasons }）
zotseek-export-reasonOtherLibrary = 他のライブラリに{ $count }件
zotseek-export-reasonDeleted = 削除済み{ $count }件
zotseek-export-itemcountEmpty = 追加する項目がありません。
zotseek-export-statusExported = 「{ $name }」に{ $count }件を追加しました。
zotseek-export-statusExportedSkipped = 「{ $name }」に{ $count }件を追加、{ $skipped }件をスキップしました。
zotseek-export-statusFailed = 結果をコレクションとして保存できませんでした。

## Preference group headers
zotseek-prefs-group-status = ステータス
zotseek-prefs-group-models = モデル
zotseek-prefs-group-indexing = インデックス作成
zotseek-prefs-group-search = 検索
zotseek-prefs-group-maintenance = 統合とメンテナンス
zotseek-prefs-exclusions = 除外

## Model section headers
zotseek-pref-embeddingModelTitle = 埋め込みモデル
zotseek-pref-manageModelsTitle = インストール済みモデルの管理
zotseek-indexing-cloudRebuildConfirmTitle = Rebuild Cloud index?
zotseek-indexing-cloudRebuildConfirmMsg = About { $count } papers in { $scope } will be sent to the configured Cloud provider and may incur provider charges. Existing complete indexes are kept until each paper is replaced successfully. Continue?
zotseek-indexing-cloudStrategyRebuildConfirmMsg = The current Cloud index uses an older chunk strategy. Its existing embeddings must be deleted before about { $count } papers in { $scope } are sent again, which may incur provider charges. Other model indexes are kept. Continue?

## 文献ブリーフ設定

zotseek-prefs-group-brief = 文献ブリーフ（実験的）
zotseek-pref-brief-title = 文献ブリーフ
zotseek-pref-brief-enabled =
    .label = 文献ブリーフを有効にする
zotseek-pref-brief-enabled-desc = 必要に応じて論文の PDF から実験的な文献ブリーフを生成します。
zotseek-pref-brief-provider = 共有プロバイダー
zotseek-pref-brief-open-cloud-settings = 認証情報を設定
zotseek-pref-brief-model = 生成モデル
zotseek-pref-brief-test = 接続をテスト
zotseek-pref-brief-create-prompts = 自分用のブリーフプロンプトを作成…
zotseek-pref-brief-create-prompts-desc = 通常論文用とレビュー・理論論文用のペアプロンプトを作成します。
zotseek-pref-brief-standard-prompt = 通常論文用プロンプト
zotseek-pref-brief-review-prompt = レビュー／理論論文用プロンプト
zotseek-pref-brief-advanced = 詳細設定
zotseek-pref-brief-import-standard = 通常論文用プロンプトをインポート…
zotseek-pref-brief-import-review = レビュープロンプトをインポート…
zotseek-pref-brief-reset-prompts = 組み込みプロンプトに戻す
zotseek-pref-brief-max-input = 最大入力トークン数
zotseek-pref-brief-max-input-desc = 生成モデルの入力予算です。
zotseek-pref-brief-max-output = 最大出力トークン数
zotseek-pref-brief-max-output-desc = 生成用に確保する出力予算です。
zotseek-pref-brief-thinking-enabled =
    .label = 拡張推論を有効にする

## 文献ブリーフプロンプトウィザード

zotseek-brief-prompt-wizard-title = 文献ブリーフプロンプトをカスタマイズ
zotseek-brief-prompt-wizard-notice = 読みたい内容や好みを入力してください。ZotSeek が通常論文用とレビュー・理論論文用のペアプロンプトを生成します。
zotseek-brief-prompt-wizard-domain-label = トピックまたは研究分野
zotseek-brief-prompt-wizard-language-label = 出力言語
zotseek-brief-prompt-wizard-habits-label = 読み方・分析の好み
zotseek-brief-prompt-wizard-status-idle = プロンプトを生成する準備ができました。
zotseek-brief-prompt-wizard-location-label = プロンプトの場所
zotseek-brief-prompt-wizard-open-location = プロンプトフォルダーを開く
zotseek-brief-prompt-wizard-cancel = キャンセル
zotseek-brief-prompt-wizard-generate = プロンプトを生成

## 文献ブリーフの状態と同意

zotseek-pref-brief-prompt-bundled = 組み込み（{ $file }）
zotseek-pref-brief-prompt-time-unknown = 更新日時不明
zotseek-pref-brief-prompt-custom = カスタム（{ $file }）、更新日時 { $updated }
zotseek-pref-brief-provider-summary = プロバイダー：{ $provider } · 認証情報：{ $credential }
zotseek-pref-brief-key-configured = API キー設定済み
zotseek-pref-brief-key-missing = API キー未設定
zotseek-pref-brief-unsupported-provider = 文献ブリーフは現在 Alibaba Bailian のみをサポートしています。
zotseek-pref-brief-key-required = 文献ブリーフを使用する前に Alibaba Bailian API キーを設定してください。
zotseek-pref-brief-connection-verified = 接続を確認済み
zotseek-pref-brief-connection-not-verified = 接続未確認
zotseek-pref-brief-invalid-settings = 文献ブリーフの設定が無効です：{ $error }
zotseek-pref-brief-status-failed = 文献ブリーフの生成に失敗しました：{ $error }
zotseek-pref-brief-settings-saved = 文献ブリーフの設定を保存しました。
zotseek-pref-brief-cancelling = 文献ブリーフの生成をキャンセルしています…
zotseek-pref-brief-consent-title = 文献ブリーフの生成を許可しますか？
zotseek-pref-brief-consent-message = ブリーフを生成するため、ZotSeek は論文のタイトル、要旨、PDF ページのテキストを Alibaba Bailian に送信します。プロンプトテンプレートの作成時には、2 つのテンプレートとフォームの回答を送信します。BYOK アカウントに料金が発生する場合があり、接続テストにも少額の料金が発生する可能性があります。続行しますか？
zotseek-pref-brief-testing = 接続をテストしています…
zotseek-pref-brief-test-failed = 接続テストに失敗しました：{ $error }
zotseek-pref-brief-connection-required = ブリーフを生成する前に接続を確認してください。
zotseek-pref-brief-import-failed = プロンプトのインポートに失敗しました：{ $error }
zotseek-pref-brief-reset-title = 組み込みプロンプトに戻しますか？
zotseek-pref-brief-reset-message = カスタムプロンプトを組み込みプロンプトで置き換えます。続行しますか？
zotseek-pref-brief-reset-done = 組み込みプロンプトに戻しました。

## Literature brief menu and runtime status

zotseek-menu-generateBrief = 文献ブリーフを生成
zotseek-brief-disabled = 文献ブリーフは無効になっています。
zotseek-brief-busy = 別の文献ブリーフタスクが実行中です。
zotseek-brief-connection-required = 生成する前に文献ブリーフの接続を確認してください。
zotseek-brief-start-failed = 文献ブリーフの生成を開始できませんでした：{ $error }
zotseek-brief-cancelling = 文献ブリーフの生成をキャンセルしています…
zotseek-brief-cancel-task = タスクをキャンセル
zotseek-brief-cancel-tooltip = この文献ブリーフタスクをキャンセル
zotseek-brief-progress-title = 文献ブリーフを生成中
zotseek-brief-progress-summary = { $total } 件中 { $completed } 件完了 · 成功：{ $success } · 失敗：{ $failed } · スキップ：{ $skipped } · キャンセル：{ $cancelled }
zotseek-brief-progress-active = 処理中：{ $title }
zotseek-brief-progress-latest = { $title }：{ $status }
zotseek-brief-progress-latest-with-reason = { $title }：{ $status }（{ $reason }）
zotseek-brief-progress-complete = 文献ブリーフタスクが完了しました。
zotseek-brief-summary-title = 文献ブリーフの結果
zotseek-brief-summary-message = 成功：{ $success } · 失敗：{ $failed } · スキップ：{ $skipped } · キャンセル：{ $cancelled }
zotseek-brief-status-success = 成功
zotseek-brief-status-failed = 失敗
zotseek-brief-status-skipped = スキップ
zotseek-brief-status-cancelled = キャンセル
zotseek-brief-skip-reason-insufficient-text = 抽出可能な PDF テキストなし
zotseek-brief-skip-reason-existing-note = 子ノートが既に存在
zotseek-brief-skip-reason-no-main-pdf = メイン PDF なし
zotseek-brief-select-one = 通常の論文または PDF 添付ファイルを 1 つ選択してください。
zotseek-brief-invalid-selection = 選択した項目は対象の論文または PDF 添付ファイルではありません。
zotseek-brief-existing-note-title = 既存のブリーフノート
zotseek-brief-existing-note-message = この論文には子ノートが既にあります。追加の文献ブリーフノートを作成しますか？
zotseek-brief-select-collection = 先にコレクションを選択してください。
zotseek-brief-no-eligible = 選択したコレクションに対象の論文がありません。
zotseek-brief-collection-confirm-title = コレクションの文献ブリーフを生成しますか？
zotseek-brief-collection-confirm-message = { $count } 件の論文の文献ブリーフを生成しますか？ API 料金が発生する場合があります。

## Literature brief prompt wizard runtime status

zotseek-brief-wizard-unavailable = 開始できません：文献ブリーフサービスを利用できません。
zotseek-brief-wizard-generating = ペアのプロンプトファイルを生成中…
zotseek-brief-wizard-required = 研究分野と出力言語の両方を入力してください。
zotseek-brief-wizard-invalid-result = 文献ブリーフサービスから使用可能な結果が返されませんでした。
zotseek-brief-wizard-success = プロンプトファイルを正常に生成しました。
zotseek-brief-wizard-success-no-path = プロンプトファイルを生成しましたが、保存場所が返されませんでした。
zotseek-brief-wizard-downloaded-not-enabled = プロンプトファイルはダウンロードされましたが、管理対象のペアを有効化できませんでした。再試行するか、手動でインポートしてください。
zotseek-brief-wizard-canceled = 生成をキャンセルしました。
zotseek-brief-wizard-canceling = 生成をキャンセルしています…
zotseek-brief-wizard-failed = 生成に失敗しました。プロンプトファイルは有効化されていません。
zotseek-brief-wizard-open-failed = プロンプトファイルの場所を開けません。
zotseek-brief-wizard-init-failed = 文献ブリーフプロンプトウィザードを開始できません。

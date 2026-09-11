# ZotSeek Korean localization


## Cloud embedding and Local Server naming

zotseek-pref-localServerReady = Local Server ({ $model })
zotseek-pref-localServerState = Local Server ({ $state })
zotseek-pref-cloudSlotReady = Cloud ({ $model })
zotseek-pref-cloudSlotSetup = Cloud (SETUP REQUIRED)
zotseek-pref-cloudTitle = Cloud Model
zotseek-pref-cloudDesc = BYOK 클라우드 Embedding 서비스를 구성합니다. 색인 콘텐츠와 의미 검색어가 클라우드 제공업체로 전송되며, ZotSeek-U는 요금을 부과하거나 수수료를 받지 않습니다. 색인과 검색 모두 인터넷 연결이 필요하고 제공업체의 API 할당량을 사용하므로 비용이 발생할 수 있습니다. 자세한 요금은 클라우드 제공업체의 요금 문서를 참조하세요.
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
    .label = Cloud 모델 사용 시 Zotero 시작 시 색인을 자동으로 유지 관리하도록 허용
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
zotseek-pref-modelBackfillTitle = 현재 모델로 나머지 문헌을 색인하시겠습니까?
zotseek-pref-modelBackfillMessage = 이 모델로 색인된 문헌은 { $total }개 중 { $covered }개입니다. 나머지 { $missing }개를 백그라운드에서 색인하시겠습니까? 색인 중에도 Zotero를 계속 사용할 수 있습니다.
## Context menu items
zotseek-menu-findSimilar = 유사 문서 찾기
zotseek-menu-openZotSeek = ZotSeek 열기…
zotseek-menu-indexSelected = 선택 항목 확인 및 업데이트
zotseek-menu-indexCollection = 현재 컬렉션 확인 및 업데이트
zotseek-menu-updateLibrary = 색인 확인 및 업데이트
zotseek-menu-removeFromIndex = ZotSeek 색인에서 제거
zotseek-menu-findRelated = 관련 문서 찾기

## Toolbar
zotseek-toolbar-openZotSeek = ZotSeek-U 열기
zotseek-toolbar-findSimilar = 유사 문서 찾기

## Preference pane
zotseek-pref-title = ZotSeek-U
zotseek-pref-indexStatistics = 색인 통계
zotseek-pref-papersIndexed = 색인된 문서
zotseek-pref-totalChunks = 총 청크 수
zotseek-pref-storageUsed = 사용 중인 저장 공간
zotseek-pref-model = 모델:
zotseek-pref-avg = 평균:
zotseek-pref-chunksPerPaper = 문서당 청크
zotseek-pref-lastIndexed = 마지막 색인:
zotseek-pref-refreshStats =
    .label = 통계 새로 고침
zotseek-pref-compactDatabase =
    .label = 데이터베이스 압축
zotseek-pref-autoCompact =
    .label = Zotero가 유휴 상태일 때 자동으로 압축
zotseek-pref-autoCompactDesc = Zotero 10 이상이 필요합니다. 회수할 공간이 충분하고 색인 작업이 진행 중이 아닐 때만 실행됩니다.
zotseek-pref-indexModeMismatch = 색인 모드 불일치
zotseek-pref-indexModeMismatchDesc = 색인은 { $indexedMode } 모드로 생성되었지만 현재 설정은 { $currentMode }입니다.
zotseek-pref-indexModeMismatchAction = 새 모드를 적용하려면 아래의 “색인 확인 및 업데이트”를 클릭하세요. ZotSeek는 호환되는 벡터를 재사용하고 누락된 부분만 계산하며, “색인 재구성”도 계속 선택할 수 있습니다.
zotseek-pref-indexingMode = 색인 모드
zotseek-pref-abstractOnly = 초록만
zotseek-pref-abstractOnlyMenu =
    .label = 초록만 (빠름)
zotseek-pref-abstractSpeed = 빠름 · 문서당 약 1개 청크
zotseek-pref-abstractDesc = 제목, 초록, #으로 시작하지 않는 태그를 색인합니다.
zotseek-pref-notes = 메타데이터 + 노트
zotseek-pref-notesMenu =
    .label = 메타데이터 + 노트 (PDF 처리 안 함)
zotseek-pref-notesSpeed = 집중 · PDF 처리 안 함
zotseek-pref-notesDesc = 동일한 메타데이터와 하위 노트를 색인합니다.
zotseek-pref-fullPaper = 전체 문서
zotseek-pref-fullPaperMenu =
    .label = 전체 문서 (더 철저함)
zotseek-pref-fullSpeed = 철저 · 초록 + 노트 + PDF
zotseek-pref-fullDesc = 동일한 메타데이터, 하위 노트 및 페이지 번호가 포함된 PDF 전체 내용을 색인합니다.
zotseek-pref-mcpServer = AI 에이전트 액세스
zotseek-pref-mcpServerLabel =
    .label = AI 에이전트의 라이브러리 검색 및 읽기 허용 (로컬 MCP 서버)
zotseek-pref-mcpServerDesc = Claude Code와 같은 MCP 클라이언트가 읽기 전용 검색을 실행하고 항목 메타데이터, 노트 및 PDF 내용을 읽을 수 있게 합니다. 모든 데이터는 이 컴퓨터에서만 처리됩니다 (localhost 전용).
zotseek-pref-mcpServerUrl = 연결 방법:
zotseek-pref-mcpServerWarning = Zotero의 로컬 HTTP 서버가 비활성화되어 있습니다. 설정 → 고급에서 “이 컴퓨터의 다른 애플리케이션이 Zotero와 통신하도록 허용”을 활성화하세요.
zotseek-pref-autoIndexing = 자동 유지 관리
zotseek-pref-autoIndexLabel =
    .label = Zotero 시작 시 색인 확인 및 업데이트
zotseek-pref-autoIndexDesc = 시작할 때 선택한 라이브러리 범위를 확인하고 추가되거나 변경된 항목을 업데이트합니다. Zotero에서 삭제되었거나 색인 규칙에서 제외된 항목의 레코드를 제거하고 오른쪽 아래에 진행률을 표시합니다.
zotseek-pref-checkNowResult = { $checked }개 항목 확인, { $changed }개 업데이트, 색인 레코드 { $removed }개 제거.
zotseek-indexing-noteUpdate = { $count }개 항목의 노트 업데이트 중…
zotseek-indexing-noteUpdateComplete = { $count }개 항목의 노트를 업데이트했습니다
zotseek-pref-indexScope = 색인 범위
zotseek-pref-indexScopeUser =
 .label = 내 라이브러리
zotseek-pref-indexScopeAll =
 .label = 모든 라이브러리
zotseek-pref-indexScopeDesc = 이 범위는 수동 “색인 확인 및 업데이트” 작업과 시작 시 자동 유지 관리에 적용됩니다.
zotseek-pref-searchSettings = 검색 설정
zotseek-pref-resultsToShow = 표시할 결과 수
zotseek-pref-resultsToShowDesc = 표시할 일치 항목 수 (5~100)
zotseek-pref-minSimilarity = 최소 유사도
zotseek-pref-minSimilarityDesc = % — 품질이 낮은 일치 항목 제외 (0~100)
zotseek-pref-defaultSearchMode = 기본 검색 모드
zotseek-pref-defaultSearchModeDesc = 기본 검색 모드를 변경합니다.
zotseek-pref-advancedSettings = 고급 설정
zotseek-pref-modelInputSettings = 청킹 및 모델 입력
zotseek-pref-modelOptionalHint = (선택 시 설정)
zotseek-pref-maxTokens = 청크당 최대 토큰
zotseek-pref-maxTokensDesc = 선택적 사용자 지정값이며 최종 제한은 활성 모델 정책이 적용합니다
zotseek-pref-modelInputPolicy = 제한: { $limit } · 권장: { $recommended }
zotseek-pref-modelInputUnknown = 서버 관리
zotseek-pref-modelInputPrefixRequired = 필수
zotseek-pref-modelInputPrefixNone = 없음
zotseek-pref-modelStatusBundled = 기본 제공
zotseek-pref-modelStatusInstalled = 설치됨
zotseek-pref-modelStatusDownload = 다운로드 필요 · 약 { $size }MB
zotseek-pref-modelMultilingual = 다국어
zotseek-modelDownloadChoiceTitle = 임베딩 모델 설치
zotseek-modelDownloadChoiceMessage = { $model }이(가) 설치되지 않았습니다. 자동 다운로드는 huggingface.co에서 약 { $size }MB를 한 번 받아 이 컴퓨터에 저장합니다. ZotSeek는 Zotero 라이브러리를 Hugging Face로 전송하지 않습니다.
zotseek-modelDownloadAutomatic = 자동 다운로드 (권장)
zotseek-modelDownloadManual = 수동 다운로드
zotseek-modelDownloadCancel = 취소
zotseek-modelDownloadManualTitle = 모델 수동 다운로드
zotseek-modelDownloadManualMessage = 공식 모델 페이지에서 필요한 파일을 다운로드하고 나열된 하위 디렉터리를 유지한 채 설치 위치 아래에 저장하세요.

    모델: { $model }
    공식 페이지: { $page }

    필요한 파일:
    { $files }

    설치 위치:
    { $path }
zotseek-modelDownloadOpenPage = 모델 페이지 열기
zotseek-modelDownloadOpenLocation = 설치 위치 열기
zotseek-modelDownloadClose = 닫기
zotseek-modelDownloadStarting = { $model } 다운로드 중…
zotseek-modelDownloadProgress = { $model } 다운로드 중: 파일 { $done }/{ $total }
zotseek-modelDownloadFailed = 모델 작업 실패: { $error }
zotseek-modelDownloadRevealFailedTitle = 설치 위치를 열 수 없음
zotseek-modelDownloadRevealFailedMessage = ZotSeek가 모델 설치 위치를 열 수 없습니다. 다음 경로를 복사하여 수동으로 여세요:

    { $path }
zotseek-pref-resetMaxTokens =
    .label = 권장값 사용
zotseek-pref-serverConfigTitle = Local Server 모델
zotseek-pref-serverConfigDesc = 프로필 JSON 템플릿에서 고정된 Local Server 모델 슬롯을 설정합니다. ZotSeek는 시작할 때 이를 검증합니다. 파일을 편집한 뒤 Zotero를 다시 시작해야 적용됩니다.
zotseek-pref-serverConfigPath = 템플릿:
zotseek-pref-serverConfigNotLoaded = 템플릿이 아직 로드되지 않았습니다. Zotero를 다시 시작하세요.
zotseek-pref-serverConfigLoaded = Local Server ({ $model })이(가) 설정되었습니다. 파일을 편집한 뒤 Zotero를 다시 시작해야 적용됩니다.
zotseek-pref-serverConfigNone = Local Server (NONE): Local Server 모델이 설정되지 않았습니다. 모델 메뉴에서 Local Server를 선택하면 설정 안내를 볼 수 있습니다.
zotseek-pref-serverConfigErrors = Local Server (UNKNOWN): 구성 오류 { $errors }개. 모델 ID, 루프백 서비스 URL, 벡터 차원, 토큰 예산 및 쿼리/문서 접두사를 확인하세요.
zotseek-pref-serverModelIncomplete = Local Server 모델 정보가 불완전합니다. JSON 템플릿을 구성하고 Zotero를 다시 시작하세요.
zotseek-serverConfigRequiredTitle = Local Server 모델 구성 필요
zotseek-serverConfigRequiredMessage = Local Server ({ $state })이(가) 선택되었지만 모델 정보가 불완전합니다. ZotSeek는 이 선택을 유지하지만 지금은 색인 작업이나 의미 검색을 실행할 수 없습니다.

    편집: { $path }

    파일을 저장한 뒤 Zotero를 다시 시작하세요.

    { $guidance }
zotseek-serverConfigMissingEntry = 템플릿의 “model” 필드를 완전한 Local Server 모델 객체 하나로 설정하세요.
zotseek-serverConfigInvalidEntry = 템플릿에 구성 오류가 { $errors }개 있습니다. 템플릿의 예시를 사용하여 모델 ID, 루프백 서비스 URL, 벡터 차원, 토큰 예산 및 쿼리/문서 접두사를 완성하세요.
zotseek-serverConfigOpenLocation = 파일 위치 열기
    .label = 파일 위치 열기
zotseek-serverConfigClose = 닫기
zotseek-serverConfigRevealFailedTitle = 파일 위치를 열 수 없음
zotseek-serverConfigRevealFailedMessage = ZotSeek가 구성 파일 위치를 열 수 없습니다. 다음 경로를 복사하여 수동으로 여세요:

    { $path }
zotseek-pref-maxChunks = 문서당 최대 청크
zotseek-pref-maxChunksDesc = 긴 문서의 제한 (1~200)
zotseek-pref-excludeBooks =
    .label = 책을 색인에서 제외
zotseek-pref-excludeBooksDesc = 책은 색인되지 않습니다. 책의 기존 ZotSeek-U 색인은 다음 색인 확인 때 제거됩니다.
zotseek-pref-excludeTag = 제외할 태그
zotseek-pref-excludeTagDesc = 이 태그가 있는 항목은 색인되지 않습니다. 일치하는 항목의 기존 ZotSeek-U 색인은 다음 확인 때 제거됩니다. 사용하지 않으려면 비워 두세요.
zotseek-pref-actions = 작업
zotseek-pref-maintenanceRepair = 유지 관리 및 복구
zotseek-pref-updateIndex =
    .label = 색인 확인 및 업데이트
zotseek-pref-recommended = ✓ 권장
zotseek-pref-updateIndexDesc = 누락된 항목을 추가하고 메타데이터, 노트 또는 색인 설정이 변경된 항목을 업데이트합니다. 변경되지 않은 항목은 건너뛰며 Zotero에서 삭제되었거나 색인 규칙에서 제외된 항목의 레코드를 제거합니다. 색인 설정 변경으로 기존 항목을 다시 계산할 수 있습니다.
zotseek-pref-rebuildIndex =
    .label = 색인 재구성
zotseek-pref-rebuildIndexDesc = 현재 모델의 색인을 지우고 현재 설정으로 모든 항목을 다시 색인합니다. 색인 모드나 청크 전략을 변경한 후 사용하세요.
zotseek-pref-clearIndex =
    .label = 색인 지우기
zotseek-pref-dangerZone = 위험 영역
zotseek-pref-destructive = ⚠ 되돌릴 수 없는 작업
zotseek-pref-clearIndexDesc = 데이터베이스에서 모든 임베딩을 제거합니다. 이후 다시 색인해야 합니다.
zotseek-pref-about = 정보
zotseek-pref-githubRepo =
    .value = GitHub 저장소
zotseek-pref-modelLine = 모델: { $model }
zotseek-pref-avgLine = 평균: { $avg } 청크/문서
zotseek-pref-lastIndexedLine = 마지막 색인: { $date }
zotseek-pref-compacted = 데이터베이스 압축 완료
zotseek-pref-compactionFailed = 데이터베이스 압축 실패
zotseek-pref-healthHeader = 데이터베이스 상태
zotseek-pref-healthOrphans = 해결되지 않은 임베딩: { $count }
zotseek-pref-healthOrphansDesc = 현재 라이브러리의 원본 항목과 연결되지 않은 임베딩입니다. 삭제하면 공간이 확보되지만 되돌릴 수 없습니다.
zotseek-pref-healthPurgeOrphans =
    .label = 고아 데이터 삭제
zotseek-pref-healthPurgeConfirmTitle = 해결되지 않은 임베딩 삭제
zotseek-pref-healthPurgeConfirmMsg = 현재 Zotero 라이브러리에서 찾을 수 없는 항목의 임베딩을 영구 삭제합니다. 계속하시겠습니까?
zotseek-pref-healthPurgeDoneTitle = 고아 데이터 삭제 완료
zotseek-pref-healthPurgeDoneMsg = 해결되지 않은 항목 { $count }개를 제거했습니다.
zotseek-pref-healthPurgeFailedTitle = 삭제 실패

## Search dialog
zotseek-search-search =
    .value = 검색:
zotseek-search-placeholder =
    .placeholder = 검색어를 입력하세요 (입력하는 동안 자동 검색)… | 예: 높은 양육 스트레스와 낮은 부모-자녀 간 뇌 동기화의 관련 문헌
zotseek-search-addQuery =
    .label = +
    .tooltiptext = AND/OR 조합을 위한 검색어 추가
zotseek-search-searchBtn =
    .label = 검색
zotseek-search-and =
    .label = AND
zotseek-search-or =
    .label = OR
zotseek-search-using =
    .value = 사용:
zotseek-search-minimum =
    .label = 최소
zotseek-search-product =
    .label = 곱
zotseek-search-average =
    .label = 평균
zotseek-search-andDesc =
    .value = — 두 검색어 모두와 일치하는 결과
zotseek-search-query2 =
    .value = 검색어 2:
zotseek-search-query3 =
    .value = 검색어 3:
zotseek-search-query4 =
    .value = 검색어 4:
zotseek-search-enterQuery = 검색어 { $n } 입력…
zotseek-search-removeQuery =
    .label = ✕
    .tooltiptext = 이 검색어 제거
zotseek-search-mode =
    .value = 모드:
zotseek-search-modeHybrid =
    .label = 🔗 하이브리드 (권장)
zotseek-search-modeSemantic =
    .label = 🧠 의미 검색만
zotseek-search-modeKeyword =
    .label = 🔤 키워드만
zotseek-search-modeDesc =
    .value = 일치 유형: 🔗 두 검색 모두 · 🧠 AI 일치 · 🔤 키워드 일치
zotseek-search-results =
    .value = 결과:
zotseek-search-bySection = 섹션별
zotseek-search-byLocation = 위치별 (정확한 페이지 및 문단)
zotseek-search-settings =
    .label = ⚙ 설정
    .tooltiptext = ZotSeek 환경 설정 열기
zotseek-search-openSelected =
    .label = 선택 항목 열기
zotseek-search-close =
    .label = 닫기
zotseek-search-initializing = 검색 초기화 중…
zotseek-search-hybrid = 하이브리드
zotseek-search-semantic = 의미 검색
zotseek-search-keyword = 키워드
zotseek-search-loadingModel = AI 모델 로드 중 (처음에는 시간이 걸릴 수 있음)…
zotseek-search-finding = { $mode } 검색: 항목 찾는 중…
zotseek-search-findingMulti = { $mode } 검색 ({ $op }): 항목 찾는 중…
zotseek-search-noItemsFound = 항목을 찾을 수 없습니다
zotseek-search-showInLibrary = 라이브러리에서 보기
zotseek-search-showItemsInLibrary = 라이브러리에서 { $count }개 항목 보기
zotseek-search-addToCollection = 컬렉션에 추가
zotseek-search-noCollections = 컬렉션 없음
zotseek-search-moreCollections = …외 { $count }개
zotseek-search-foundItems = { $count }개 항목을 찾았습니다
zotseek-search-foundItemsFromMatches = { $matches }개 일치에서 { $count }개 항목을 찾았습니다
zotseek-search-foundItemsQuery = { $query }에서 { $count }개 항목을 찾았습니다
zotseek-search-searching = 검색 중…
zotseek-search-searchLabel = 검색
zotseek-search-searchingMoment = 잠시 후 검색합니다…
zotseek-search-queryTooShort = CJK 문자는 2자 이상, 그 외 문자는 3자 이상 입력하세요
zotseek-search-failed = 검색 실패: { $error }
zotseek-search-noItemsMatchingAll = 모든 검색어와 일치하는 항목이 없습니다
zotseek-search-matchBoth = — 두 검색어 모두와 일치하는 결과
zotseek-search-matchAll = — 모든 검색어와 일치하는 결과
zotseek-search-matchAny = — 검색어 중 하나와 일치하는 결과

## Results table columns
zotseek-column-match = 일치도
zotseek-column-title = 제목
zotseek-column-authors = 저자
zotseek-column-year = 연도
zotseek-column-location = 위치
zotseek-column-section = 섹션

## Source labels
zotseek-source-abstract = 초록
zotseek-source-fulltext = 전체 텍스트
zotseek-source-title = 제목
zotseek-source-methods = 방법
zotseek-source-results = 결과
zotseek-source-content = 내용
zotseek-source-note = 노트
zotseek-search-hybrid-menuitem =
    .label = 🔗 하이브리드 (권장)
zotseek-search-semantic-menuitem =
    .label = 🧠 의미 검색만
zotseek-search-keyword-menuitem =
    .label = 🔤 키워드만

## Similar documents dialog
zotseek-similar-title =
    .title = 유사 문서 찾기
zotseek-similar-similarTo = 다음과 유사:{ " " }
zotseek-similar-loading = 로드 중…
zotseek-similar-openSelected =
    .label = 선택 항목 열기
zotseek-similar-close =
    .label = 닫기
zotseek-similar-initFailed = 초기화 실패: { $error }
zotseek-similar-noSource = 원본 문서를 선택하지 않았습니다
zotseek-similar-finding = 유사 문서를 찾는 중…
zotseek-similar-loadingModel = AI 모델 로드 중…
zotseek-similar-searching = 검색 중…
zotseek-similar-noResults = 유사 문서를 찾을 수 없습니다
zotseek-similar-found = 유사 문서 { $count }개를 찾았습니다
zotseek-similar-searchFailed = 검색 실패: { $error }

## Indexing progress
zotseek-indexing-title = ZotSeek 색인 작업
zotseek-indexing-clearTitle = ZotSeek 색인 지우기
zotseek-indexing-clearConfirmTitle = ZotSeek 색인 지우기
zotseek-indexing-clearConfirmMsg = 저장된 모든 임베딩을 삭제합니다. 라이브러리를 다시 색인해야 합니다.

    계속하시겠습니까?
zotseek-indexing-clearConfirmButton = 색인 지우기
zotseek-indexing-initStorage = 저장 공간 초기화 중…
zotseek-indexing-deletingAll = 모든 임베딩 삭제 중…
zotseek-indexing-clearedSuccess = 색인을 성공적으로 지웠습니다!
zotseek-indexing-clearedMsg = 색인을 성공적으로 지웠습니다.

    이제 라이브러리를 다시 색인할 수 있습니다.
zotseek-indexing-rebuildTitle = ZotSeek 색인 재구성
zotseek-indexing-rebuildConfirmTitle = ZotSeek 색인 재구성
zotseek-indexing-rebuildConfirmMsg = 현재 모델의 임베딩을 삭제하고 색인을 다시 구성합니다. 다른 모델 색인은 유지됩니다.
zotseek-indexing-rebuildConfirmButton = 색인 재구성
zotseek-indexing-chunkStrategyRebuildRequired = ZotSeek가 현재 모델의 색인이 이전 청크 전략을 사용하고 있음을 감지했습니다.
    기존 색인은 검색할 수 있지만 이전 청크와 새 청크가 섞이지 않도록 백그라운드 증분 업데이트를 일시 중지했습니다. 설정에서 “색인 재구성”을 사용해 전체 재구성을 실행하세요. 이 알림을 닫아도 재구성이 시작되거나 기존 색인이 변경되지 않습니다.
    라이브러리 크기와 색인 전략에 따라 재구성에 수십 분에서 몇 시간이 걸릴 수 있습니다.
zotseek-indexing-rebuildingTitle = ZotSeek 색인 재구성 중
zotseek-indexing-clearingExisting = 기존 색인 지우는 중…
zotseek-indexing-existingCleared = ✓ 현재 모델의 색인을 지웠습니다
zotseek-indexing-loading = 로드 중…
zotseek-indexing-alreadyInProgress = 색인 작업이 이미 진행 중입니다…
zotseek-indexing-selectItems = 색인할 항목을 선택하세요.
zotseek-indexing-selectCollection = 먼저 컬렉션을 선택하세요.

    (왼쪽 사이드바에서 컬렉션을 클릭)
zotseek-indexing-emptyCollection = 컬렉션 “{ $name }”에 색인할 항목이 없습니다.
zotseek-indexing-emptyCollections = 선택한 컬렉션 { $count }개에 색인할 항목이 없습니다.
zotseek-indexing-updateTitle = ZotSeek - 색인 확인 및 업데이트
zotseek-indexing-updateConfirmMsg = { $scope }의 색인을 확인하고 업데이트하시겠습니까? ZotSeek는 누락된 항목을 추가하고 메타데이터, 노트 또는 색인 설정이 변경된 항목을 업데이트합니다. 변경되지 않은 항목은 건너뛰며 Zotero에서 삭제되었거나 색인 규칙에서 제외된 항목의 레코드를 제거합니다. 색인 설정 변경으로 현재 설정을 사용해 기존 항목을 다시 계산할 수 있습니다.
zotseek-indexing-updateConfirmButton = 확인 및 업데이트
zotseek-indexing-confirmCancel = 취소
zotseek-indexing-scopeUser = 개인 라이브러리
zotseek-indexing-scopeAll = 모든 라이브러리 (개인 + 그룹)
zotseek-indexing-configChangeTitle = ZotSeek - 색인 설정 변경
zotseek-indexing-configChangeMessage = { $scope }에서 이미 색인된 항목 { $affected }개의 설정이 변경되었습니다. { $rebuildRequired }개는 임베딩을 다시 계산해야 하며 나머지는 구성 레코드만 업데이트하면 됩니다. 선택하기 전에는 레코드를 삭제하거나 지문을 업데이트하거나 임베딩을 기록하지 않습니다. 시작 시 확인을 어떻게 진행하시겠습니까?
zotseek-indexing-configChangeUpdate = 색인 확인 및 업데이트
zotseek-indexing-configChangeRebuild = 색인 재구성
zotseek-indexing-configChangeCancel = 취소

# Auto-resume prompt shown at startup when a previous bulk-index run was interrupted.
zotseek-resume-title = ZotSeek - 색인 재개
zotseek-resume-message = 이전 색인 작업이 중단되었습니다. ZotSeek는 { $scope }의 항목 { $count }개를 다시 확인하고 완료되지 않았거나 실패한 업데이트를 재개합니다. 최신 상태인 항목은 건너뜁니다. 취소하면 이번 시작 시 자동 색인 유지 관리도 건너뜁니다. 지금 재개하시겠습니까?
zotseek-resume-confirm = 색인 재개
zotseek-resume-scopeLibrary = 라이브러리
zotseek-resume-scopeUserLibrary = 개인 라이브러리
zotseek-resume-scopeCollection = “{ $name }” 컬렉션
zotseek-resume-scopeCollections = 선택한 컬렉션 { $count }개
zotseek-resume-scopeItems = 선택 항목 범위
zotseek-indexing-noItemsSelected = 선택한 항목이 없습니다
zotseek-indexing-removedItems = 색인에서 항목 { $count }개를 제거했습니다
zotseek-indexing-notInIndex = 선택한 항목이 색인에 없습니다
zotseek-indexing-removeFailed = 색인에서 제거하지 못했습니다
zotseek-indexing-mode = 색인 모드: { $mode }
zotseek-indexing-checking = 이미 색인된 항목 확인 중…
zotseek-indexing-skippedExcluded = ✓ 제외된 항목 { $count }개 건너뜀
zotseek-indexing-skippedIndexed = ✓ 이미 색인된 항목 { $count }개 건너뜀
zotseek-indexing-allIndexed = 모든 항목이 이미 색인되어 있습니다!
zotseek-indexing-allInIndex = ✓ 항목 { $count }개가 이미 색인에 있습니다
zotseek-indexing-nothingToIndex = 색인할 항목이 없습니다 — 모두 최신 상태입니다!
zotseek-indexing-loadingModel = AI 모델 로드 중 (Transformers.js)…
zotseek-indexing-modelLoaded = ✓ AI 모델을 로드했습니다
zotseek-indexing-batchExtracting = 배치 { $current }/{ $total }: 텍스트 추출 중…
zotseek-indexing-batchEmbedding = 배치 { $current }/{ $total }: 임베딩 생성 중…
zotseek-indexing-batchEmbeddingChunks = 배치 { $current }/{ $total }: 청크 임베딩 중
zotseek-indexing-chunksFailed = ⚠ { $items }에서 청크 { $count }개 건너뜀
zotseek-indexing-batchSaving = 배치 { $current }/{ $total }: 체크포인트 저장 중…
zotseek-indexing-checkpoint = ✓ 체크포인트 { $current }/{ $total }: 항목 { $items }개, 청크 { $chunks }개 저장
zotseek-indexing-complete = 색인 완료!
zotseek-indexing-completeMode = ✓ 모드: { $mode }
zotseek-indexing-completePrevious = ✓ 기존 색인: 항목 { $count }개
zotseek-indexing-completeNew = ✓ 새로 색인: 항목 { $count }개
zotseek-indexing-completeChunks = ✓ 총 청크: { $count }
zotseek-indexing-completeAvg = ✓ 항목당 평균 청크: { $avg }
zotseek-indexing-completeDuration = ✓ 소요 시간: { $duration }
zotseek-indexing-completeNoContent = ⚠ 내용 없음: 항목 { $count }개
zotseek-indexing-completeTruncated = ⚠ 일부 내용만 색인됨: 항목 { $count }개가 문서당 최대 청크 제한에 도달했습니다. 제한을 높이거나 요약 모드로 전환해 전체 텍스트를 색인하세요.
zotseek-indexing-completeSuccess = 색인이 성공적으로 완료되었습니다!
zotseek-indexing-cancelled = 색인 취소됨
zotseek-indexing-pauseAction = 색인 일시 중지
zotseek-indexing-pausingAction = 일시 중지 중…
zotseek-indexing-pauseTooltip = 현재 안전한 체크포인트 후 중지하고 다음 Zotero 시작 때 재개
zotseek-indexing-paused = 색인이 일시 중지되었습니다. 다음 Zotero 시작 때 이 범위의 재개를 제안합니다.
zotseek-indexing-failed = 색인 실패: { $error }
zotseek-indexing-progressTitle = ZotSeek
zotseek-indexing-progressItem = 색인 중: { $title }
zotseek-indexing-progressLoadingModel = 모델 로드 중…
zotseek-indexing-allExcluded = 모든 항목이 색인에서 제외되었습니다
zotseek-indexing-extracting = 추출 중…
zotseek-indexing-noContent = ✗ 내용을 찾을 수 없음
zotseek-indexing-embedding = 임베딩 중 { $current }/{ $total }…
zotseek-indexing-saving = 저장 중…
zotseek-indexing-chunksIndexed = ✓ 청크 { $count }개 색인됨
zotseek-indexing-chunksIndexedWithFailed = ✓ 청크 { $count }개 색인됨 ({ $failed }개 실패)

## Export to Collection
zotseek-export-saveAsCollection =
    .label = 결과를 컬렉션으로 저장
zotseek-export-addToCollectionNew =
    .label = 새 컬렉션…
zotseek-export-dialogTitle =
    .title = 결과를 컬렉션으로 저장
zotseek-export-nameLabel =
    .value = 컬렉션 이름:
zotseek-export-libraryLabel =
    .value = 라이브러리:
zotseek-export-ok =
    .label = 저장
zotseek-export-cancel =
    .label = 취소
zotseek-export-itemcountSimple = 항목 { $count }개 → { $destination }
zotseek-export-itemcountFiltered = 전체 { $total }개 중 { $kept }개 → { $destination } ({ $reasons })
zotseek-export-reasonOtherLibrary = 다른 라이브러리에 { $count }개
zotseek-export-reasonDeleted = 삭제됨 { $count }개
zotseek-export-itemcountEmpty = 추가할 항목이 없습니다.
zotseek-export-statusExported = “{ $name }”에 항목 { $count }개를 추가했습니다.
zotseek-export-statusExportedSkipped = “{ $name }”에 항목 { $count }개를 추가하고 { $skipped }개를 건너뛰었습니다.
zotseek-export-statusFailed = 결과를 컬렉션으로 저장하지 못했습니다.

## Preference group headers
zotseek-prefs-group-status = 상태
zotseek-prefs-group-models = 모델
zotseek-prefs-group-indexing = 색인
zotseek-prefs-group-search = 검색
zotseek-prefs-group-maintenance = 통합 및 유지 관리
zotseek-prefs-exclusions = 제외

## Model section headers
zotseek-pref-embeddingModelTitle = 임베딩 모델
zotseek-pref-manageModelsTitle = 설치된 모델 관리
zotseek-indexing-cloudRebuildConfirmTitle = Rebuild Cloud index?
zotseek-indexing-cloudRebuildConfirmMsg = About { $count } papers in { $scope } will be sent to the configured Cloud provider and may incur provider charges. Existing complete indexes are kept until each paper is replaced successfully. Continue?
zotseek-indexing-cloudStrategyRebuildConfirmMsg = The current Cloud index uses an older chunk strategy. Its existing embeddings must be deleted before about { $count } papers in { $scope } are sent again, which may incur provider charges. Other model indexes are kept. Continue?

## 문헌 브리프 설정

zotseek-prefs-group-brief = 문헌 브리프 (실험적)
zotseek-pref-brief-title = 문헌 브리프
zotseek-pref-brief-enabled =
    .label = 문헌 브리프 활성화
zotseek-pref-brief-enabled-desc = 필요할 때 논문의 PDF에서 실험적인 문헌 브리프를 생성합니다.
zotseek-pref-brief-provider = 공유 제공업체
zotseek-pref-brief-open-cloud-settings = 자격 증명 구성
zotseek-pref-brief-model = 생성 모델
zotseek-pref-brief-test = 연결 테스트
zotseek-pref-brief-create-prompts = 내 브리프 프롬프트 만들기…
zotseek-pref-brief-create-prompts-desc = 일반 논문과 리뷰 또는 이론 논문에 사용할 프롬프트 쌍을 만듭니다.
zotseek-pref-brief-standard-prompt = 일반 논문 프롬프트
zotseek-pref-brief-review-prompt = 리뷰/이론 프롬프트
zotseek-pref-brief-advanced = 고급
zotseek-pref-brief-import-standard = 일반 프롬프트 가져오기…
zotseek-pref-brief-import-review = 리뷰 프롬프트 가져오기…
zotseek-pref-brief-reset-prompts = 기본 제공 프롬프트 복원
zotseek-pref-brief-max-input = 최대 입력 토큰
zotseek-pref-brief-max-input-desc = 생성 모델 입력 예산입니다.
zotseek-pref-brief-max-output = 최대 출력 토큰
zotseek-pref-brief-max-output-desc = 생성을 위해 예약된 출력 예산입니다.
zotseek-pref-brief-thinking-enabled =
    .label = 확장 추론 활성화

## 문헌 브리프 프롬프트 마법사

zotseek-brief-prompt-wizard-title = 문헌 브리프 프롬프트 사용자 지정
zotseek-brief-prompt-wizard-domain-label = 주제 또는 연구 분야
zotseek-brief-prompt-wizard-language-label = 출력 언어
zotseek-brief-prompt-wizard-habits-label = 읽기 및 분석 선호 사항
zotseek-brief-prompt-wizard-location-label = 프롬프트 위치
zotseek-brief-prompt-wizard-open-location = 프롬프트 폴더 열기
zotseek-brief-prompt-wizard-cancel = 취소

## 문헌 브리프 상태 및 동의

zotseek-pref-brief-prompt-bundled = 기본 제공 ({ $file })
zotseek-pref-brief-prompt-time-unknown = 업데이트 시간 알 수 없음
zotseek-pref-brief-prompt-custom = 사용자 지정 ({ $file }), 업데이트됨 { $updated }
zotseek-pref-brief-provider-summary = 제공업체: { $provider } · 자격 증명: { $credential }
zotseek-pref-brief-key-configured = API 키 구성됨
zotseek-pref-brief-key-missing = API 키가 구성되지 않음
zotseek-pref-brief-unsupported-provider = 문헌 브리프는 현재 Alibaba Bailian만 지원합니다.
zotseek-pref-brief-key-required = 문헌 브리프를 사용하기 전에 Alibaba Bailian API 키를 구성하세요.
zotseek-pref-brief-connection-verified = 연결 확인됨
zotseek-pref-brief-connection-not-verified = 연결이 확인되지 않음
zotseek-pref-brief-invalid-settings = 잘못된 브리프 설정: { $error }
zotseek-pref-brief-status-failed = 브리프 생성 실패: { $error }
zotseek-pref-brief-settings-saved = 브리프 설정이 저장되었습니다.
zotseek-pref-brief-cancelling = 브리프 생성을 취소하는 중…
zotseek-pref-brief-consent-title = 문헌 브리프 생성을 허용하시겠습니까?
zotseek-pref-brief-test-consent-title = 문헌 브리프 연결을 테스트할까요?
zotseek-pref-brief-test-consent-message = 이 테스트는 고정된 테스트 텍스트만 { $provider }에 전송하며 소액의 API 요금이 발생할 수 있습니다. 논문, 노트 또는 파일 경로는 전송하지 않습니다. 계속할까요?
zotseek-pref-brief-consent-message = 브리프를 생성하기 위해 ZotSeek가 논문의 제목, 초록, PDF 페이지 텍스트를 { $provider }으로 전송합니다. 프롬프트 템플릿을 만들 때는 두 템플릿과 양식 응답을 전송합니다. BYOK 계정에 요금이 발생할 수 있으며 연결 테스트에도 소액의 요금이 발생할 수 있습니다. 계속하시겠습니까?
zotseek-pref-brief-testing = 연결 테스트 중…
zotseek-pref-brief-test-failed = 연결 테스트 실패: { $error }
zotseek-pref-brief-connection-required = 브리프를 생성하기 전에 연결을 확인하세요.
zotseek-pref-brief-import-failed = 프롬프트 가져오기 실패: { $error }
zotseek-pref-brief-reset-title = 기본 제공 프롬프트를 복원하시겠습니까?
zotseek-pref-brief-reset-message = 사용자 지정 프롬프트가 기본 제공 프롬프트로 대체됩니다. 계속하시겠습니까?
zotseek-pref-brief-reset-done = 기본 제공 프롬프트가 복원되었습니다.

## Literature brief menu and runtime status

zotseek-menu-generateBrief = 문헌 브리프 생성
zotseek-brief-disabled = 문헌 브리프가 비활성화되어 있습니다.
zotseek-brief-busy = 다른 문헌 브리프 작업이 이미 실행 중입니다.
zotseek-brief-connection-required = 생성하기 전에 문헌 브리프 연결을 확인하세요.
zotseek-brief-start-failed = 문헌 브리프 생성을 시작하지 못했습니다: { $error }
zotseek-brief-cancelling = 문헌 브리프 생성을 취소하는 중…
zotseek-brief-cancel-task = 작업 취소
zotseek-brief-cancel-tooltip = 이 문헌 브리프 작업 취소
zotseek-brief-progress-title = 문헌 브리프 생성
zotseek-brief-progress-summary = { $total }개 중 { $completed }개 완료 · 성공: { $success } · 실패: { $failed } · 건너뜀: { $skipped } · 취소됨: { $cancelled }
zotseek-brief-progress-active = 처리 중: { $title }
zotseek-brief-progress-latest = { $title }: { $status }
zotseek-brief-progress-latest-with-reason = { $title }: { $status } ({ $reason })
zotseek-brief-progress-complete = 문헌 브리프 작업이 완료되었습니다.
zotseek-brief-summary-title = 문헌 브리프 결과
zotseek-brief-summary-message = 성공: { $success } · 실패: { $failed } · 건너뜀: { $skipped } · 취소됨: { $cancelled }
zotseek-brief-usage-heading = 제공자가 보고한 Token 사용량:
zotseek-brief-usage-input = 입력: { $tokens }
zotseek-brief-usage-output = 출력: { $tokens }
zotseek-brief-usage-reasoning = 추론: { $tokens }(별도 표시하며 다시 합산하지 않음)
zotseek-brief-usage-total = 합계: { $tokens }
zotseek-brief-usage-total-unavailable = 합계: 제공자가 사용 가능한 값을 반환하지 않음
zotseek-brief-usage-requests = 사용량 반환: { $reported } / { $total } 요청
zotseek-brief-usage-incomplete = 추가로 { $count }개 요청에서 사용량이 반환되지 않았습니다. 수치는 불완전할 수 있으며 최종 청구서와 같지 않습니다.
zotseek-brief-status-success = 성공
zotseek-brief-status-failed = 실패
zotseek-brief-status-skipped = 건너뜀
zotseek-brief-status-cancelled = 취소됨
zotseek-brief-skip-reason-insufficient-text = 추출 가능한 PDF 텍스트 없음
zotseek-brief-skip-reason-existing-note = 하위 노트가 이미 있음
zotseek-brief-skip-reason-no-main-pdf = 기본 PDF 없음
zotseek-brief-select-one = 일반 논문 또는 PDF 첨부 파일 하나를 선택하세요.
zotseek-brief-invalid-selection = 선택한 항목은 유효한 논문 또는 PDF 첨부 파일이 아닙니다.
zotseek-brief-existing-note-title = 기존 브리프 노트
zotseek-brief-existing-note-message = 이 논문에는 하위 노트가 이미 있습니다. 문헌 브리프 노트를 하나 더 만들까요?
zotseek-brief-select-collection = 먼저 컬렉션을 선택하세요.
zotseek-brief-no-eligible = 선택한 컬렉션에서 대상 논문을 찾지 못했습니다.
zotseek-brief-preparation-changed = 준비 중 제공자, 모델 또는 출력 제한이 변경되었습니다. 생성을 다시 시작하고 다시 확인하세요.
zotseek-brief-generation-confirm-title = 전송 및 문헌 브리프 생성을 확인할까요?
zotseek-brief-generation-confirm-message = { $count }개 논문의 브리프를 생성하고 제목, 초록 및 PDF 페이지 텍스트를 { $provider }(모델: { $model })에 전송합니다. 예상 입력: 약 { $inputTokens } tokens, 요청당 출력 한도: { $outputTokens } tokens, 예상 최소 요청 수: { $requests }회. 예상치는 참고용입니다. BYOK 계정에 요금이 발생할 수 있으며 최종 사용량과 청구는 제공자 정보를 따릅니다. 계속할까요?

## Literature brief prompt wizard runtime status

zotseek-brief-wizard-unavailable = 시작할 수 없습니다. 문헌 브리프 서비스를 사용할 수 없습니다.
zotseek-brief-wizard-generating = 쌍으로 된 프롬프트 파일을 생성하는 중…
zotseek-brief-wizard-required = 연구 분야와 출력 언어를 모두 입력하세요.
zotseek-brief-wizard-invalid-result = 문헌 브리프 서비스에서 사용할 수 있는 결과를 반환하지 않았습니다.
zotseek-brief-wizard-success = 프롬프트 파일을 성공적으로 생성했습니다.
zotseek-brief-wizard-success-no-path = 프롬프트 파일을 생성했지만 출력 위치가 반환되지 않았습니다.
zotseek-brief-wizard-downloaded-not-enabled = 프롬프트 파일은 다운로드되었지만 관리되는 쌍을 활성화하지 못했습니다. 다시 시도하거나 파일을 수동으로 가져오세요.
zotseek-brief-wizard-canceled = 생성을 취소했습니다.
zotseek-brief-wizard-canceling = 생성을 취소하는 중…
zotseek-brief-wizard-failed = 생성에 실패했습니다. 프롬프트 파일을 활성화하지 않았습니다.
zotseek-brief-wizard-open-failed = 프롬프트 파일 위치를 열 수 없습니다.
zotseek-brief-wizard-init-failed = 문헌 브리프 프롬프트 마법사를 시작할 수 없습니다.
zotseek-search-itemNotFound = 항목이 존재하지 않습니다
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
zotseek-brief-wizard-template-bundled-desc = The built-ins target psychology, developmental psychology, and cognitive neuroscience, and output Chinese by default. Choosing them also saves both files to your default Downloads folder.
zotseek-brief-wizard-bundled-failed = The built-in prompts could not be downloaded or activated. Your current prompt settings were not changed.
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
zotseek-brief-wizard-bundled-success = The built-in prompt pair is active, and both files were saved to your default Downloads folder. You can reopen the guide or import custom prompts later.
zotseek-brief-wizard-progress = Step { $current } of { $total }
# TODO(translation): Plan 72 intro page and step names; English placeholder.
zotseek-brief-wizard-step-intro = Intro
zotseek-brief-wizard-step-service = Service
zotseek-brief-wizard-step-template = Template
zotseek-brief-wizard-step-questions = Needs
zotseek-brief-wizard-step-confirm = Confirm
zotseek-brief-wizard-intro-title = What is a literature brief?
zotseek-brief-wizard-intro-lead = A brief is written by an LLM after reading the paper PDF. It is not a compressed abstract but a rebuilt understanding: a concise, accurate, traceable academic brief that turns terminology- and data-dense papers into readable notes saved as child notes under the item.
zotseek-brief-wizard-intro-readable-title = Dense, yet highly readable
zotseek-brief-wizard-intro-readable-desc = A fixed section structure (question, method, findings, discussion) keeps the research logic, key numbers, and original citation trails intact, so one coffee is enough to understand a paper.
zotseek-brief-wizard-intro-search-title = Written for people, and a better search entry
zotseek-brief-wizard-intro-search-desc = Brief child notes join ZotSeek's notes index. The structured, bilingual-terminology text lets semantic and hybrid search hit a paper's methods and findings directly, not just its title and abstract.
zotseek-brief-wizard-intro-privacy-title = Privacy and safety under your control
zotseek-brief-wizard-intro-privacy-desc = The feature is off by default. Every generation asks for explicit confirmation and shows the estimated token cost before any request is sent. Your reading notes and annotations are never read or uploaded.
zotseek-brief-wizard-back = Back
zotseek-brief-wizard-next = Next
zotseek-brief-wizard-generate = Generate and enable
zotseek-brief-wizard-finish = Finish
zotseek-brief-skip-reason-garbled-text = PDF text is too garbled to understand reliably
zotseek-pref-brief-model-needs-test = connection test required
zotseek-brief-wizard-service-restored = The current provider and model passed the test. Your existing prompts remain active and brief setup is ready.
zotseek-brief-wizard-setup-damaged = The existing prompt setup needs repair. Choose the built-in prompts or create a new pair to continue.

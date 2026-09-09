# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## Cloud embedding and Local Server naming

zotseek-pref-localServerReady = Local Server ({ $model })
zotseek-pref-localServerState = Local Server ({ $state })
zotseek-pref-cloudSlotReady = Cloud ({ $model })
zotseek-pref-cloudSlotSetup = Cloud (SETUP REQUIRED)
zotseek-pref-cloudTitle = Cloud Model
zotseek-pref-cloudDesc = Настройте облачный сервис embedding с собственным ключом API (BYOK). Индексируемые материалы и семантические запросы отправляются облачному провайдеру; ZotSeek-U не взимает плату и не получает долю этих платежей. Для индексирования и поиска требуется подключение к Интернету и расходуется квота API провайдера, что может повлечь расходы; подробности см. в тарифной документации провайдера.
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
    .label = Разрешить Zotero автоматически обслуживать индекс при запуске с Cloud-моделью
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
zotseek-pref-modelBackfillTitle = Проиндексировать оставшиеся документы текущей моделью?
zotseek-pref-modelBackfillMessage = Эта модель охватывает { $covered } из { $total } документов. Проиндексировать оставшиеся { $missing } в фоновом режиме? Во время индексации можно продолжать пользоваться Zotero.
## Context menu items

zotseek-menu-findSimilar = Найти похожие документы
zotseek-menu-openZotSeek = Открыть ZotSeek…
zotseek-menu-indexSelected = Проверить и обновить выбранные элементы
zotseek-menu-indexCollection = Проверить и обновить текущую коллекцию
zotseek-menu-updateLibrary = Проверить и обновить индекс
zotseek-menu-removeFromIndex = Удалить из индекса ZotSeek
zotseek-menu-findRelated = Найти связанные документы

## Toolbar

zotseek-toolbar-openZotSeek = Открыть ZotSeek-U
zotseek-toolbar-findSimilar = Найти похожие документы

## Preference pane

zotseek-pref-title = ZotSeek-U
zotseek-pref-indexStatistics = Статистика индекса
zotseek-pref-papersIndexed = Проиндексированные документы
zotseek-pref-totalChunks = Всего фрагментов
zotseek-pref-storageUsed = Использовано места
zotseek-pref-model = Модель:
zotseek-pref-avg = Среднее:
zotseek-pref-chunksPerPaper = фрагментов/документ
zotseek-pref-lastIndexed = Последнее индексирование:
zotseek-pref-refreshStats =
    .label = Обновить статистику
zotseek-pref-compactDatabase =
    .label = Сжать базу данных
zotseek-pref-autoCompact =
    .label = Автоматически сжимать, когда Zotero не используется
zotseek-pref-autoCompactDesc = Требуется Zotero 10 или новее. Запускается только при наличии существенного места для освобождения и когда индексирование не выполняется.
zotseek-pref-indexModeMismatch = Несоответствие режима индексирования
zotseek-pref-indexModeMismatchDesc = Индекс создан в режиме { $indexedMode }, но текущая настройка — { $currentMode }.
zotseek-pref-indexModeMismatchAction = Нажмите «Проверить и обновить индекс» ниже, чтобы применить новый режим. ZotSeek повторно использует совместимые векторы и вычисляет только недостающие; вариант «Перестроить индекс» остаётся доступным.
zotseek-pref-indexingMode = Режим индексирования
zotseek-pref-abstractOnly = Только аннотация
zotseek-pref-abstractOnlyMenu =
    .label = Только аннотация (быстрее)
zotseek-pref-abstractSpeed = Быстрый · ~1 фрагмент на документ
zotseek-pref-abstractDesc = Индексирует заголовок, аннотацию и метки, не начинающиеся с #.
zotseek-pref-notes = Метаданные + заметки
zotseek-pref-notesMenu =
    .label = Метаданные + заметки (без обработки PDF)
zotseek-pref-notesSpeed = Сфокусированный · без обработки PDF
zotseek-pref-notesDesc = Индексирует те же метаданные и дочерние заметки.
zotseek-pref-fullPaper = Полный текст
zotseek-pref-fullPaperMenu =
    .label = Полный текст (тщательнее)
zotseek-pref-fullSpeed = Тщательный · аннотация + заметки + PDF
zotseek-pref-fullDesc = Индексирует те же метаданные, дочерние заметки и полный текст PDF с номерами страниц.
zotseek-pref-mcpServer = Доступ для AI-агентов
zotseek-pref-mcpServerLabel =
    .label = Разрешить AI-агентам искать и читать вашу библиотеку (локальный MCP-сервер)
zotseek-pref-mcpServerDesc = Позволяет MCP-клиентам, например Claude Code, выполнять поиск только для чтения и читать метаданные записей, заметки и содержимое PDF. Всё остаётся на этом компьютере (только localhost).
zotseek-pref-mcpServerUrl = Подключиться:
zotseek-pref-mcpServerWarning = Локальный HTTP-сервер Zotero отключён. Включите в настройках → «Дополнительно» параметр «Разрешить другим приложениям на этом компьютере взаимодействовать с Zotero».
zotseek-pref-autoIndexing = Автоматическое обслуживание
zotseek-pref-autoIndexLabel =
    .label = Проверять и обновлять индекс при запуске Zotero
zotseek-pref-autoIndexDesc = При запуске проверяет выбранную область библиотеки, обновляет добавленные или изменённые элементы, удаляет записи об элементах, удалённых из Zotero или исключённых правилами индексирования, и показывает ход выполнения в правом нижнем углу.
zotseek-pref-checkNowResult = Проверено элементов: { $checked }; обновлено: { $changed }; удалено записей индекса: { $removed }.
zotseek-indexing-noteUpdate = Обновление заметок для элементов: { $count }…
zotseek-indexing-noteUpdateComplete = Заметки обновлены для элементов: { $count }
zotseek-pref-indexScope = Область индексирования
zotseek-pref-indexScopeUser =
 .label = Моя библиотека
zotseek-pref-indexScopeAll =
 .label = Все библиотеки
zotseek-pref-indexScopeDesc = Эта область применяется к действию «Проверить и обновить индекс» вручную и к автоматическому обслуживанию при запуске.
zotseek-pref-searchSettings = Настройки поиска
zotseek-pref-resultsToShow = Показывать результатов
zotseek-pref-resultsToShowDesc = Количество отображаемых совпадений (5–100)
zotseek-pref-minSimilarity = Минимальное сходство
zotseek-pref-minSimilarityDesc = % — отфильтровывать низкокачественные совпадения (0–100)
zotseek-pref-defaultSearchMode = Режим поиска по умолчанию
zotseek-pref-defaultSearchModeDesc = Изменить режим поиска по умолчанию.
zotseek-pref-advancedSettings = Расширенные настройки
zotseek-pref-modelInputSettings = Разбиение и ввод для модели
zotseek-pref-modelOptionalHint = (настраивается при выборе)
zotseek-pref-maxTokens = Максимум токенов на фрагмент
zotseek-pref-maxTokensDesc = Необязательное пользовательское ограничение; итоговый предел определяется политикой активной модели
zotseek-pref-modelInputPolicy = Ограничение: { $limit } · Рекомендуется: { $recommended }
zotseek-pref-modelInputUnknown = управляется сервером
zotseek-pref-modelInputPrefixRequired = требуется
zotseek-pref-modelInputPrefixNone = нет
zotseek-pref-modelStatusBundled = Встроенная
zotseek-pref-modelStatusInstalled = Установлена
zotseek-pref-modelStatusDownload = Требуется загрузка · около { $size } МБ
zotseek-pref-modelMultilingual = многоязычная
zotseek-modelDownloadChoiceTitle = Установить embedding-модель
zotseek-modelDownloadChoiceMessage = { $model } не установлена. Автоматическая загрузка один раз получает около { $size } МБ с huggingface.co и сохраняет их на этом компьютере. ZotSeek не отправляет вашу библиотеку Zotero на Hugging Face.
zotseek-modelDownloadAutomatic = Автоматическая загрузка (рекомендуется)
zotseek-modelDownloadManual = Загрузка вручную
zotseek-modelDownloadCancel = Отмена
zotseek-modelDownloadManualTitle = Ручная загрузка модели
zotseek-modelDownloadManualMessage = Загрузите необходимые файлы с официальной страницы модели и сохраните их в месте установки, сохранив указанные подкаталоги.

    Модель: { $model }
    Официальная страница: { $page }

    Необходимые файлы:
    { $files }

    Место установки:
    { $path }
zotseek-modelDownloadOpenPage = Открыть страницу модели
zotseek-modelDownloadOpenLocation = Открыть место установки
zotseek-modelDownloadClose = Закрыть
zotseek-modelDownloadStarting = Загрузка { $model }…
zotseek-modelDownloadProgress = Загрузка { $model }: файл { $done } из { $total }
zotseek-modelDownloadFailed = Операция с моделью не выполнена: { $error }
zotseek-modelDownloadRevealFailedTitle = Не удалось открыть место установки
zotseek-modelDownloadRevealFailedMessage = ZotSeek не удалось открыть место установки модели. Скопируйте этот путь и откройте его вручную:

    { $path }
zotseek-pref-resetMaxTokens =
    .label = Использовать рекомендуемое
zotseek-pref-serverConfigTitle = Модель Local Server
zotseek-pref-serverConfigDesc = Настройте фиксированный слот модели Local Server в JSON-шаблоне профиля. ZotSeek проверяет его при запуске; отредактируйте файл и перезапустите Zotero, чтобы применить изменения.
zotseek-pref-serverConfigPath = Шаблон:
zotseek-pref-serverConfigNotLoaded = Шаблон ещё не загружен. Перезапустите Zotero.
zotseek-pref-serverConfigLoaded = Local Server ({ $model }) настроен. Отредактируйте файл и перезапустите Zotero, чтобы применить изменения.
zotseek-pref-serverConfigNone = Local Server (NONE): модель Local Server не настроена. Выберите Local Server в меню моделей, чтобы увидеть инструкции по настройке.
zotseek-pref-serverConfigErrors = Local Server (UNKNOWN). Количество ошибок конфигурации: { $errors }. Проверьте ID модели, URL loopback-сервиса, размерность векторов, бюджеты токенов и префиксы запросов/документов в шаблоне.
zotseek-pref-serverModelIncomplete = Информация о модели Local Server неполна. Настройте JSON-шаблон и перезапустите Zotero.
zotseek-serverConfigRequiredTitle = Требуется настройка модели Local Server
zotseek-serverConfigRequiredMessage = Выбрана модель Local Server ({ $state }), но информация о ней неполна. ZotSeek сохранит этот выбор, но пока не сможет индексировать или выполнять семантический поиск.

    Изменить: { $path }

    После сохранения файла перезапустите Zotero.

    { $guidance }
zotseek-serverConfigMissingEntry = Задайте в поле «model» шаблона один полный объект модели Local Server.
zotseek-serverConfigInvalidEntry = В шаблоне обнаружены ошибки конфигурации. Количество: { $errors }. Используйте пример в шаблоне, чтобы заполнить ID модели, URL loopback-сервиса, размерность векторов, бюджеты токенов и префиксы запросов/документов.
zotseek-serverConfigOpenLocation = Открыть расположение файла
    .label = Открыть расположение файла
zotseek-serverConfigClose = Закрыть
zotseek-serverConfigRevealFailedTitle = Не удалось открыть расположение файла
zotseek-serverConfigRevealFailedMessage = ZotSeek не удалось открыть расположение файла конфигурации. Скопируйте этот путь и откройте его вручную:

    { $path }
zotseek-pref-maxChunks = Максимум фрагментов на документ
zotseek-pref-maxChunksDesc = Ограничение для длинных документов (1–200)
zotseek-pref-excludeBooks =
    .label = Исключать книги из индексирования
zotseek-pref-excludeBooksDesc = Книги не индексируются. Существующие индексы ZotSeek-U для книг удаляются при следующей проверке индекса.
zotseek-pref-excludeTag = Исключаемая метка
zotseek-pref-excludeTagDesc = Элементы с этой меткой не индексируются. Существующие индексы ZotSeek-U для таких элементов удаляются при следующей проверке индекса. Оставьте поле пустым, чтобы отключить.
zotseek-pref-actions = Действия
zotseek-pref-maintenanceRepair = Обслуживание и восстановление
zotseek-pref-updateIndex =
    .label = Проверить и обновить индекс
zotseek-pref-recommended = ✓ Рекомендуется
zotseek-pref-updateIndexDesc = Добавляет отсутствующие элементы, обновляет элементы с изменившимися метаданными, заметками или настройками индексирования, пропускает элементы без изменений и удаляет записи об элементах, удалённых из Zotero или исключённых правилами индексирования. Изменение настроек индексирования может привести к повторному вычислению существующих элементов.
zotseek-pref-rebuildIndex =
    .label = Перестроить индекс
zotseek-pref-rebuildIndexDesc = Очищает индекс текущей модели и индексирует все элементы с текущими настройками. Используйте после изменения режима или стратегии разбиения.
zotseek-pref-clearIndex =
    .label = Очистить индекс
zotseek-pref-dangerZone = Опасная зона
zotseek-pref-destructive = ⚠ Разрушительное действие
zotseek-pref-clearIndexDesc = Удаляет все embedding из базы данных. После этого потребуется повторно проиндексировать библиотеку.
zotseek-pref-about = О программе
zotseek-pref-githubRepo =
    .value = Репозиторий GitHub
zotseek-pref-modelLine = Модель: { $model }
zotseek-pref-avgLine = Среднее: { $avg } фрагментов/документ
zotseek-pref-lastIndexedLine = Последнее индексирование: { $date }
zotseek-pref-compacted = База данных сжата
zotseek-pref-compactionFailed = Сжатие не выполнено
zotseek-pref-healthHeader = Состояние базы данных
zotseek-pref-healthOrphans = Неразрешённые embedding: { $count }
zotseek-pref-healthOrphansDesc = Embedding, исходные элементы которых не удалось сопоставить с текущей библиотекой. Очистка освобождает место, но необратима.
zotseek-pref-healthPurgeOrphans =
    .label = Удалить сироты
zotseek-pref-healthPurgeConfirmTitle = Удалить неразрешённые embedding
zotseek-pref-healthPurgeConfirmMsg = Будут навсегда удалены embedding элементов, не найденных в текущей библиотеке Zotero. Продолжить?
zotseek-pref-healthPurgeDoneTitle = Сироты удалены
zotseek-pref-healthPurgeDoneMsg = Удалено неразрешённых записей: { $count }.
zotseek-pref-healthPurgeFailedTitle = Удаление не выполнено

## Search dialog

zotseek-search-search =
    .value = Поиск:
zotseek-search-placeholder =
    .placeholder = Введите поисковый запрос (поиск запускается во время ввода)... | Например: публикации о связи высокого родительского стресса с низкой межмозговой синхронизацией родителя и ребёнка
zotseek-search-addQuery =
    .label = +
    .tooltiptext = Добавить запрос для комбинации AND/OR
zotseek-search-searchBtn =
    .label = Поиск
zotseek-search-and =
    .label = AND
zotseek-search-or =
    .label = OR
zotseek-search-using =
    .value = с помощью
zotseek-search-minimum =
    .label = Минимум
zotseek-search-product =
    .label = Произведение
zotseek-search-average =
    .label = Среднее
zotseek-search-andDesc =
    .value = — результаты должны соответствовать обоим запросам
zotseek-search-query2 =
    .value = Запрос 2:
zotseek-search-query3 =
    .value = Запрос 3:
zotseek-search-query4 =
    .value = Запрос 4:
zotseek-search-enterQuery = Введите запрос { $n }...
zotseek-search-removeQuery =
    .label = ✕
    .tooltiptext = Удалить этот запрос
zotseek-search-mode =
    .value = Режим:
zotseek-search-modeHybrid =
    .label = 🔗 Гибридный (рекомендуется)
zotseek-search-modeSemantic =
    .label = 🧠 Только семантический
zotseek-search-modeKeyword =
    .label = 🔤 Только ключевые слова
zotseek-search-modeDesc =
    .value = Тип совпадения: 🔗 оба поиска · 🧠 AI-сопоставление · 🔤 по ключевым словам
zotseek-search-results =
    .value = Результаты:
zotseek-search-bySection = По разделу
zotseek-search-byLocation = По расположению (точная страница и абзац)
zotseek-search-settings =
    .label = ⚙ Настройки
    .tooltiptext = Открыть настройки ZotSeek
zotseek-search-openSelected =
    .label = Открыть выбранное
zotseek-search-close =
    .label = Закрыть
zotseek-search-initializing = Инициализация поиска...
zotseek-search-hybrid = Гибридный
zotseek-search-semantic = Семантический
zotseek-search-keyword = По ключевым словам
zotseek-search-loadingModel = Загрузка AI-модели (при первом запуске это может занять некоторое время)...
zotseek-search-finding = Поиск { $mode }: поиск элементов...
zotseek-search-findingMulti = Поиск { $mode } ({ $op }): поиск элементов...
zotseek-search-noItemsFound = Элементы не найдены
zotseek-search-showInLibrary = Показать в библиотеке
zotseek-search-showItemsInLibrary = Показать в библиотеке — элементов: { $count }
zotseek-search-addToCollection = Добавить в коллекцию
zotseek-search-noCollections = Коллекции отсутствуют
zotseek-search-moreCollections = … и другие коллекции: { $count }
zotseek-search-foundItems = Найдено элементов: { $count }
zotseek-search-foundItemsFromMatches = Найдено элементов: { $count } (совпадений: { $matches })
zotseek-search-foundItemsQuery = Найдено элементов: { $count } ({ $query })
zotseek-search-searching = Поиск...
zotseek-search-searchLabel = Поиск
zotseek-search-searchingMoment = Поиск начнётся через мгновение...
zotseek-search-queryTooShort = Введите не менее 2 символов CJK или 3 других символов
zotseek-search-failed = Поиск не выполнен: { $error }
zotseek-search-noItemsMatchingAll = Элементы, соответствующие всем запросам, не найдены
zotseek-search-matchBoth = — результаты должны соответствовать обоим запросам
zotseek-search-matchAll = — результаты должны соответствовать всем запросам
zotseek-search-matchAny = — результаты могут соответствовать любому запросу

## Results table columns

zotseek-column-match = Совпадение
zotseek-column-title = Заголовок
zotseek-column-authors = Авторы
zotseek-column-year = Год
zotseek-column-location = Расположение
zotseek-column-section = Раздел

## Source labels

zotseek-source-abstract = Аннотация
zotseek-source-fulltext = Полный текст
zotseek-source-title = Заголовок
zotseek-source-methods = Методы
zotseek-source-results = Результаты
zotseek-source-content = Содержание
zotseek-source-note = Заметка
zotseek-search-hybrid-menuitem =
    .label = 🔗 Гибридный (рекомендуется)
zotseek-search-semantic-menuitem =
    .label = 🧠 Только семантический
zotseek-search-keyword-menuitem =
    .label = 🔤 Только ключевые слова

## Similar documents dialog

zotseek-similar-title =
    .title = Найти похожие документы
zotseek-similar-similarTo = Похожие на:{ " " }
zotseek-similar-loading = Загрузка...
zotseek-similar-openSelected =
    .label = Открыть выбранное
zotseek-similar-close =
    .label = Закрыть
zotseek-similar-initFailed = Не удалось инициализировать: { $error }
zotseek-similar-noSource = Исходный документ не выбран
zotseek-similar-finding = Поиск похожих документов...
zotseek-similar-loadingModel = Загрузка AI-модели...
zotseek-similar-searching = Поиск...
zotseek-similar-noResults = Похожие документы не найдены
zotseek-similar-found = Найдено похожих документов: { $count }
zotseek-similar-searchFailed = Поиск не выполнен: { $error }

## Indexing progress

zotseek-indexing-title = Индексирование ZotSeek
zotseek-indexing-clearTitle = Очистка индекса ZotSeek
zotseek-indexing-clearConfirmTitle = Очистить индекс ZotSeek
zotseek-indexing-clearConfirmMsg = Все сохранённые embedding будут удалены. После этого потребуется заново проиндексировать библиотеку.

    Продолжить?
zotseek-indexing-clearConfirmButton = Очистить индекс
zotseek-indexing-initStorage = Инициализация хранилища...
zotseek-indexing-deletingAll = Удаление всех embedding...
zotseek-indexing-clearedSuccess = Индекс успешно очищен!
zotseek-indexing-clearedMsg = Индекс успешно очищен.

    Теперь можно заново проиндексировать библиотеку.
zotseek-indexing-rebuildTitle = Перестроение индекса ZotSeek
zotseek-indexing-rebuildConfirmTitle = Перестроить индекс ZotSeek
zotseek-indexing-rebuildConfirmMsg = Embedding текущей модели будут удалены, а её индекс перестроен. Индексы других моделей сохранятся.
zotseek-indexing-rebuildConfirmButton = Перестроить индекс
zotseek-indexing-chunkStrategyRebuildRequired = ZotSeek обнаружил, что индекс текущей модели использует устаревшую стратегию разбиения на фрагменты.
    Существующий индекс остаётся доступным для поиска, но фоновые инкрементальные обновления приостановлены, чтобы не смешивать старые и новые фрагменты. Используйте «Перестроить индекс» в настройках для полного перестроения. Закрытие этого уведомления не запускает перестроение и не изменяет существующий индекс.
    В зависимости от размера библиотеки и стратегии индексирования перестроение может занять от нескольких десятков минут до нескольких часов.
zotseek-indexing-rebuildingTitle = Перестроение индекса ZotSeek
zotseek-indexing-clearingExisting = Очистка существующего индекса...
zotseek-indexing-existingCleared = ✓ Индекс текущей модели очищен
zotseek-indexing-loading = Загрузка...
zotseek-indexing-alreadyInProgress = Индексирование уже выполняется...
zotseek-indexing-selectItems = Выберите элементы для индексирования.
zotseek-indexing-selectCollection = Сначала выберите коллекцию.

    (Щёлкните коллекцию на левой боковой панели)
zotseek-indexing-emptyCollection = В коллекции «{ $name }» нет элементов для индексирования.
zotseek-indexing-emptyCollections = В выбранных коллекциях ({ $count }) нет элементов для индексирования.
zotseek-indexing-updateTitle = ZotSeek — проверка и обновление индекса
zotseek-indexing-updateConfirmMsg = Проверить и обновить индекс для области «{ $scope }»? ZotSeek добавит отсутствующие элементы, обновит элементы с изменившимися метаданными, заметками или настройками индексирования, пропустит элементы без изменений и удалит записи об элементах, удалённых из Zotero или исключённых правилами индексирования. Изменение настроек индексирования может привести к повторному вычислению существующих элементов с текущими настройками.
zotseek-indexing-updateConfirmButton = Проверить и обновить
zotseek-indexing-confirmCancel = Отмена
zotseek-indexing-scopeUser = вашей личной библиотеки
zotseek-indexing-scopeAll = всех ваших библиотек (личных и групповых)

zotseek-indexing-configChangeTitle = ZotSeek — настройки индекса изменились
zotseek-indexing-configChangeMessage = Настройки индексирования изменились в области «{ $scope }». Уже проиндексированных элементов затронуто: { $affected }; требуется пересчитать embedding: { $rebuildRequired }. Для остальных достаточно обновить запись конфигурации. До вашего выбора ZotSeek не будет удалять записи, обновлять отпечатки или записывать embedding. Как продолжить эту проверку при запуске?
zotseek-indexing-configChangeUpdate = Проверить и обновить индекс
zotseek-indexing-configChangeRebuild = Перестроить индекс
zotseek-indexing-configChangeCancel = Отмена

# Auto-resume prompt shown at startup when a previous bulk-index run was interrupted.
zotseek-resume-title = ZotSeek — продолжить индексирование
zotseek-resume-message = Предыдущее индексирование было прервано. ZotSeek повторно проверит все элементы ({ $count }) в области «{ $scope }» и продолжит незавершённые или неудачные обновления. Актуальные элементы будут пропущены. Если отменить операцию, автоматическое обслуживание индекса также будет пропущено при этом запуске. Продолжить сейчас?
zotseek-resume-confirm = Продолжить индексирование
zotseek-resume-scopeLibrary = ваших библиотек
zotseek-resume-scopeUserLibrary = вашей личной библиотеки
zotseek-resume-scopeCollection = коллекции «{ $name }»
zotseek-resume-scopeCollections = выбранных коллекций: { $count }
zotseek-resume-scopeItems = области выбранных элементов
zotseek-indexing-noItemsSelected = Элементы не выбраны
zotseek-indexing-removedItems = Удалено элементов из индекса: { $count }
zotseek-indexing-notInIndex = Выбранные элементы отсутствовали в индексе
zotseek-indexing-removeFailed = Не удалось удалить из индекса
zotseek-indexing-mode = Режим индексирования: { $mode }
zotseek-indexing-checking = Проверка уже проиндексированных элементов...
zotseek-indexing-skippedExcluded = ✓ Пропущено исключённых элементов: { $count }
zotseek-indexing-skippedIndexed = ✓ Пропущено уже проиндексированных элементов: { $count }
zotseek-indexing-allIndexed = Все элементы уже проиндексированы!
zotseek-indexing-allInIndex = ✓ Элементов уже в индексе: { $count }
zotseek-indexing-nothingToIndex = Нечего индексировать — все элементы актуальны!
zotseek-indexing-loadingModel = Загрузка AI-модели (Transformers.js)...
zotseek-indexing-modelLoaded = ✓ AI-модель загружена
zotseek-indexing-batchExtracting = Пакет { $current }/{ $total }: извлечение текста...
zotseek-indexing-batchEmbedding = Пакет { $current }/{ $total }: создание embedding...
zotseek-indexing-batchEmbeddingChunks = Пакет { $current }/{ $total }: создание embedding для фрагментов
zotseek-indexing-chunksFailed = ⚠ Пропущено фрагментов: { $count } (элементы: { $items })
zotseek-indexing-batchSaving = Пакет { $current }/{ $total }: сохранение контрольной точки...
zotseek-indexing-checkpoint = ✓ Контрольная точка { $current }/{ $total }: сохранено элементов: { $items }, фрагментов: { $chunks }
zotseek-indexing-complete = Индексирование завершено!
zotseek-indexing-completeMode = ✓ Режим: { $mode }
zotseek-indexing-completePrevious = ✓ Уже проиндексировано: { $count } элементов
zotseek-indexing-completeNew = ✓ Проиндексировано новых элементов: { $count }
zotseek-indexing-completeChunks = ✓ Всего фрагментов: { $count }
zotseek-indexing-completeAvg = ✓ Среднее фрагментов на элемент: { $avg }
zotseek-indexing-completeDuration = ✓ Длительность: { $duration }
zotseek-indexing-completeNoContent = ⚠ Без содержимого: { $count } элементов
zotseek-indexing-completeTruncated = ⚠ Частичное содержимое: достигнуто ограничение «Максимум фрагментов на документ». Затронуто элементов: { $count }. Увеличьте ограничение или переключитесь в режим «Только аннотация», чтобы индексировать весь текст.
zotseek-indexing-completeSuccess = Индексирование успешно завершено!
zotseek-indexing-cancelled = Индексирование отменено
zotseek-indexing-pauseAction = Приостановить индексирование
zotseek-indexing-pausingAction = Приостановка…
zotseek-indexing-pauseTooltip = Остановить после текущей безопасной контрольной точки и продолжить при следующем запуске Zotero
zotseek-indexing-paused = Индексирование приостановлено. При следующем запуске Zotero предложит продолжить эту же область.
zotseek-indexing-failed = Индексирование не выполнено: { $error }
zotseek-indexing-progressTitle = ZotSeek
zotseek-indexing-progressItem = Индексирование: { $title }
zotseek-indexing-progressLoadingModel = Загрузка модели...
zotseek-indexing-allExcluded = Все элементы исключены из индексирования
zotseek-indexing-extracting = Извлечение...
zotseek-indexing-noContent = ✗ Содержимое не найдено
zotseek-indexing-embedding = Создание embedding { $current }/{ $total }...
zotseek-indexing-saving = Сохранение...
zotseek-indexing-chunksIndexed = ✓ Проиндексировано фрагментов: { $count }
zotseek-indexing-chunksIndexedWithFailed = ✓ Проиндексировано фрагментов: { $count } (ошибок: { $failed })

## Export to Collection (issue #28)

# Keys referenced via data-l10n-id on XUL elements use the .attr = value form
# so Fluent sets the named attribute instead of wiping the element's children.
# Keys consumed via formatValueSync / getString() from JS stay as plain key = text.

zotseek-export-saveAsCollection =
    .label = Сохранить результаты как коллекцию
zotseek-export-addToCollectionNew =
    .label = Новая коллекция...
zotseek-export-dialogTitle =
    .title = Сохранить результаты как коллекцию
zotseek-export-nameLabel =
    .value = Название коллекции:
zotseek-export-libraryLabel =
    .value = Библиотека:
zotseek-export-ok =
    .label = Сохранить
zotseek-export-cancel =
    .label = Отмена
zotseek-export-itemcountSimple = Элементов: { $count } → { $destination }
zotseek-export-itemcountFiltered = Элементов: { $kept } из { $total } → { $destination } ({ $reasons })
zotseek-export-reasonOtherLibrary = В других библиотеках: { $count }
zotseek-export-reasonDeleted = Удалено: { $count }
zotseek-export-itemcountEmpty = Нет элементов для добавления.
zotseek-export-statusExported = Добавлено элементов в «{ $name }»: { $count }.
zotseek-export-statusExportedSkipped = Добавлено элементов в «{ $name }»: { $count }, пропущено: { $skipped }.
zotseek-export-statusFailed = Не удалось сохранить результаты как коллекцию.

## Preference group headers

zotseek-prefs-group-status = Состояние
zotseek-prefs-group-models = Модели
zotseek-prefs-group-indexing = Индексирование
zotseek-prefs-group-search = Поиск
zotseek-prefs-group-maintenance = Интеграции и обслуживание
zotseek-prefs-exclusions = Исключения

## Model section headers (fallbacks existed in XHTML only; adds the missing ftl entries)

zotseek-pref-embeddingModelTitle = Embedding-модель
zotseek-pref-manageModelsTitle = Управление установленными моделями
zotseek-indexing-cloudRebuildConfirmTitle = Rebuild Cloud index?
zotseek-indexing-cloudRebuildConfirmMsg = About { $count } papers in { $scope } will be sent to the configured Cloud provider and may incur provider charges. Existing complete indexes are kept until each paper is replaced successfully. Continue?
zotseek-indexing-cloudStrategyRebuildConfirmMsg = The current Cloud index uses an older chunk strategy. Its existing embeddings must be deleted before about { $count } papers in { $scope } are sent again, which may incur provider charges. Other model indexes are kept. Continue?

## Настройки литературных обзоров

zotseek-prefs-group-brief = Литературные обзоры (Экспериментальная функция)
zotseek-pref-brief-title = Литературные обзоры
zotseek-pref-brief-enabled =
    .label = Включить литературные обзоры
zotseek-pref-brief-enabled-desc = По запросу создавать экспериментальный литературный обзор по PDF статьи.
zotseek-pref-brief-provider = Общий провайдер
zotseek-pref-brief-open-cloud-settings = Настроить учетные данные
zotseek-pref-brief-model = Модель генерации
zotseek-pref-brief-test = Проверить подключение
zotseek-pref-brief-create-prompts = Создать мои промпты для обзоров…
zotseek-pref-brief-create-prompts-desc = Создать парные промпты для обычных статей и обзорных или теоретических работ.
zotseek-pref-brief-standard-prompt = Промпт для обычных статей
zotseek-pref-brief-review-prompt = Промпт для обзоров/теории
zotseek-pref-brief-advanced = Дополнительно
zotseek-pref-brief-import-standard = Импортировать обычный промпт…
zotseek-pref-brief-import-review = Импортировать промпт для обзоров…
zotseek-pref-brief-reset-prompts = Восстановить встроенные промпты
zotseek-pref-brief-max-input = Максимум входных токенов
zotseek-pref-brief-max-input-desc = Бюджет входных токенов модели генерации.
zotseek-pref-brief-max-output = Максимум выходных токенов
zotseek-pref-brief-max-output-desc = Зарезервированный бюджет выходных токенов.
zotseek-pref-brief-thinking-enabled =
    .label = Включить расширенное рассуждение

## Мастер настройки промптов литературных обзоров

zotseek-brief-prompt-wizard-title = Настройка промптов литературных обзоров
zotseek-brief-prompt-wizard-notice = Опишите свои читательские задачи и предпочтения. ZotSeek создаст парные промпты для обычных статей и обзорных или теоретических работ.
zotseek-brief-prompt-wizard-domain-label = Тема или область исследования
zotseek-brief-prompt-wizard-language-label = Язык вывода
zotseek-brief-prompt-wizard-habits-label = Предпочтения чтения и анализа
zotseek-brief-prompt-wizard-status-idle = Готово к созданию промптов.
zotseek-brief-prompt-wizard-location-label = Расположение промптов
zotseek-brief-prompt-wizard-open-location = Открыть папку с промптами
zotseek-brief-prompt-wizard-cancel = Отмена
zotseek-brief-prompt-wizard-generate = Создать промпты

## Состояние и подтверждение для литературных обзоров

zotseek-pref-brief-prompt-bundled = Встроенный ({ $file })
zotseek-pref-brief-prompt-time-unknown = Время обновления неизвестно
zotseek-pref-brief-prompt-custom = Пользовательский ({ $file }), обновлено { $updated }
zotseek-pref-brief-provider-summary = Провайдер: { $provider } · Учетные данные: { $credential }
zotseek-pref-brief-key-configured = API-ключ настроен
zotseek-pref-brief-key-missing = API-ключ не настроен
zotseek-pref-brief-unsupported-provider = Литературные обзоры сейчас поддерживают только Alibaba Bailian.
zotseek-pref-brief-key-required = Настройте API-ключ Alibaba Bailian перед использованием литературных обзоров.
zotseek-pref-brief-connection-verified = Подключение проверено
zotseek-pref-brief-connection-not-verified = Подключение не проверено
zotseek-pref-brief-invalid-settings = Недопустимые настройки обзора: { $error }
zotseek-pref-brief-status-failed = Не удалось создать обзор: { $error }
zotseek-pref-brief-settings-saved = Настройки обзоров сохранены.
zotseek-pref-brief-cancelling = Отмена создания обзора…
zotseek-pref-brief-consent-title = Разрешить создание литературного обзора?
zotseek-pref-brief-consent-message = Для создания обзора ZotSeek отправит в Alibaba Bailian название статьи, аннотацию и текст страниц PDF. При создании шаблонов промптов будут отправлены два шаблона и ваши ответы в форме. Для вашего BYOK-аккаунта может взиматься плата; даже проверка подключения может стоить небольшую сумму. Продолжить?
zotseek-pref-brief-testing = Проверка подключения…
zotseek-pref-brief-test-failed = Ошибка проверки подключения: { $error }
zotseek-pref-brief-connection-required = Проверьте подключение перед созданием обзора.
zotseek-pref-brief-import-failed = Не удалось импортировать промпт: { $error }
zotseek-pref-brief-reset-title = Восстановить встроенные промпты?
zotseek-pref-brief-reset-message = Пользовательские промпты будут заменены встроенными. Продолжить?
zotseek-pref-brief-reset-done = Встроенные промпты восстановлены.

## Literature brief menu and runtime status

zotseek-menu-generateBrief = Создать литературный обзор
zotseek-brief-disabled = Литературные обзоры отключены.
zotseek-brief-busy = Другая задача создания литературного обзора уже выполняется.
zotseek-brief-connection-required = Проверьте подключение литературного обзора перед созданием.
zotseek-brief-start-failed = Не удалось начать создание литературного обзора: { $error }
zotseek-brief-cancelling = Отмена создания литературного обзора…
zotseek-brief-cancel-task = Отменить задачу
zotseek-brief-cancel-tooltip = Отменить эту задачу литературного обзора
zotseek-brief-progress-title = Создание литературного обзора
zotseek-brief-progress-summary = Завершено { $completed } из { $total } · Успешно: { $success } · Ошибок: { $failed } · Пропущено: { $skipped } · Отменено: { $cancelled }
zotseek-brief-progress-active = Обработка: { $title }
zotseek-brief-progress-latest = { $title }: { $status }
zotseek-brief-progress-latest-with-reason = { $title }: { $status } ({ $reason })
zotseek-brief-progress-complete = Задача литературного обзора завершена.
zotseek-brief-summary-title = Результаты литературного обзора
zotseek-brief-summary-message = Успешно: { $success } · Ошибок: { $failed } · Пропущено: { $skipped } · Отменено: { $cancelled }
zotseek-brief-status-success = Успешно
zotseek-brief-status-failed = Ошибка
zotseek-brief-status-skipped = Пропущено
zotseek-brief-status-cancelled = Отменено
zotseek-brief-skip-reason-insufficient-text = нет извлекаемого текста PDF
zotseek-brief-skip-reason-existing-note = уже есть дочерняя заметка
zotseek-brief-skip-reason-no-main-pdf = нет основного PDF
zotseek-brief-select-one = Выберите обычную статью или PDF-вложение.
zotseek-brief-invalid-selection = Выбранный элемент не является подходящей статьёй или PDF-вложением.
zotseek-brief-existing-note-title = Существующая заметка обзора
zotseek-brief-existing-note-message = У этой статьи уже есть дочерняя заметка. Создать дополнительную заметку литературного обзора?
zotseek-brief-select-collection = Сначала выберите коллекцию.
zotseek-brief-no-eligible = В выбранной коллекции не найдено подходящих статей.
zotseek-brief-collection-confirm-title = Создать обзоры для коллекции?
zotseek-brief-collection-confirm-message = Создать литературные обзоры для { $count } статей? Это может привести к расходам API.

## Literature brief prompt wizard runtime status

zotseek-brief-wizard-unavailable = Не удалось начать: сервис литературных обзоров недоступен.
zotseek-brief-wizard-generating = Создание парных файлов промптов…
zotseek-brief-wizard-required = Укажите область исследования и язык вывода.
zotseek-brief-wizard-invalid-result = Сервис литературных обзоров не вернул пригодный результат.
zotseek-brief-wizard-success = Файлы промптов успешно созданы.
zotseek-brief-wizard-success-no-path = Файлы промптов созданы, но расположение не возвращено.
zotseek-brief-wizard-downloaded-not-enabled = Файлы загружены, но управляемую пару не удалось активировать. Повторите попытку или импортируйте файлы вручную.
zotseek-brief-wizard-canceled = Создание отменено.
zotseek-brief-wizard-canceling = Отмена создания…
zotseek-brief-wizard-failed = Ошибка создания. Файлы промптов не активированы.
zotseek-brief-wizard-open-failed = Не удалось открыть расположение файлов промптов.
zotseek-brief-wizard-init-failed = Не удалось запустить мастер промптов литературного обзора.
zotseek-search-itemNotFound = Элемент не найден

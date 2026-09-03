# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

## Context menu items

zotseek-menu-findSimilar = Найти похожие документы
zotseek-menu-openZotSeek = Открыть ZotSeek…
zotseek-menu-indexSelected = Проверить и обновить выбранные элементы
zotseek-menu-indexCollection = Проверить и обновить текущую коллекцию
zotseek-menu-updateLibrary = Проверить и обновить индекс
zotseek-menu-removeFromIndex = Удалить из индекса ZotSeek
zotseek-menu-findRelated = Найти связанные документы

## Toolbar

zotseek-toolbar-openZotSeek = Открыть ZotSeek
zotseek-toolbar-findSimilar = Найти похожие документы

## Preference pane

zotseek-pref-title = ZotSeek
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
zotseek-pref-abstractSpeed = Быстрый • ~1 фрагмент на документ
zotseek-pref-abstractDesc = Индексирует заголовок и аннотацию. Подходит для поиска документов по теме.
zotseek-pref-notes = Метаданные + заметки
zotseek-pref-notesMenu =
    .label = Метаданные + заметки (без обработки PDF)
zotseek-pref-notesSpeed = Сфокусированный • без обработки PDF
zotseek-pref-notesDesc = Индексирует заголовок, аннотацию, метки и дочерние заметки.
zotseek-pref-fullPaper = Полный текст
zotseek-pref-fullPaperMenu =
    .label = Полный текст (тщательнее)
zotseek-pref-fullSpeed = Тщательный • заметки + ~1–2 фрагмента на страницу PDF
zotseek-pref-fullDesc = Индексирует заголовок, аннотацию, метки, дочерние заметки и полный текст PDF с номерами страниц.
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
zotseek-pref-advancedSettings = Расширенные настройки
zotseek-pref-maxTokens = Максимум токенов на фрагмент
zotseek-pref-maxTokensDesc = Необязательное пользовательское ограничение; итоговый предел определяется политикой активной модели
zotseek-pref-modelInputPolicy = Ограничение: { $limit } · Рекомендуется: { $recommended } · Фактически: { $effective } · Префикс: { $prefix }
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
zotseek-pref-serverConfigTitle = Расширенная модель Server
zotseek-pref-serverConfigDesc = Настройте фиксированный слот модели Server в JSON-шаблоне профиля. ZotSeek проверяет его при запуске; отредактируйте файл и перезапустите Zotero, чтобы применить изменения.
zotseek-pref-serverConfigPath = Шаблон:
zotseek-pref-serverConfigNotLoaded = Шаблон ещё не загружен. Перезапустите Zotero.
zotseek-pref-serverConfigLoaded = Server ({ $model }) настроен. Отредактируйте файл и перезапустите Zotero, чтобы применить изменения.
zotseek-pref-serverConfigNone = Server (NONE): модель Server не настроена. Выберите Server в меню моделей, чтобы увидеть инструкции по настройке.
zotseek-pref-serverConfigErrors = Server (UNKNOWN). Количество ошибок конфигурации: { $errors }. Проверьте ID модели, URL loopback-сервиса, размерность векторов, бюджеты токенов и префиксы запросов/документов в шаблоне.
zotseek-pref-serverModelIncomplete = Информация о модели Server неполна. Настройте JSON-шаблон и перезапустите Zotero.
zotseek-serverConfigRequiredTitle = Требуется настройка серверной модели
zotseek-serverConfigRequiredMessage = Выбрана модель Server ({ $state }), но информация о ней неполна. ZotSeek сохранит этот выбор, но пока не сможет индексировать или выполнять семантический поиск.

    Изменить: { $path }

    После сохранения файла перезапустите Zotero.

    { $guidance }
zotseek-serverConfigMissingEntry = Задайте в поле «model» шаблона один полный объект модели Server.
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
zotseek-pref-excludeBooksDesc = Книги не индексируются. Существующие индексы ZotSeek для книг удаляются при следующей проверке индекса.
zotseek-pref-excludeTag = Исключаемая метка
zotseek-pref-excludeTagDesc = Элементы с этой меткой не индексируются. Существующие индексы ZotSeek для таких элементов удаляются при следующей проверке индекса. Оставьте поле пустым, чтобы отключить.
zotseek-pref-actions = Действия
zotseek-pref-maintenanceRepair = Обслуживание и восстановление
zotseek-pref-updateIndex =
    .label = Проверить и обновить индекс
zotseek-pref-recommended = ✓ Рекомендуется
zotseek-pref-updateIndexDesc = Добавляет отсутствующие элементы, обновляет элементы с изменившимися метаданными, заметками или настройками индексирования, пропускает элементы без изменений и удаляет записи об элементах, удалённых из Zotero или исключённых правилами индексирования. Изменение настроек индексирования может привести к повторному вычислению существующих элементов.
zotseek-pref-rebuildIndex =
    .label = Перестроить индекс
zotseek-pref-rebuildIndexDesc = Очищает индекс и индексирует все элементы с текущими настройками. Используйте после изменения режима индексирования или стратегии разбиения на фрагменты, а также когда требуется полное переиндексирование.
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
    .placeholder = Введите поисковый запрос (поиск запускается во время ввода)...
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
zotseek-indexing-rebuildConfirmMsg = Все сохранённые embedding будут удалены, а индекс перестроен с текущими настройками.
zotseek-indexing-rebuildConfirmButton = Перестроить индекс
zotseek-indexing-chunkStrategyRebuildRequired = ZotSeek обнаружил, что индекс текущей модели использует устаревшую стратегию разбиения на фрагменты.
    Существующий индекс остаётся доступным для поиска, но фоновые инкрементальные обновления приостановлены, чтобы не смешивать старые и новые фрагменты. Используйте «Перестроить индекс» в настройках для полного перестроения. Закрытие этого уведомления не запускает перестроение и не изменяет существующий индекс.
    В зависимости от размера библиотеки и стратегии индексирования перестроение может занять от нескольких десятков минут до нескольких часов.
zotseek-indexing-rebuildingTitle = Перестроение индекса ZotSeek
zotseek-indexing-clearingExisting = Очистка существующего индекса...
zotseek-indexing-existingCleared = ✓ Существующий индекс очищен
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

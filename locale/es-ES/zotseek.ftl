# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## Cloud embedding and Local Server naming

zotseek-pref-localServerReady = Local Server ({ $model })
zotseek-pref-localServerState = Local Server ({ $state })
zotseek-pref-cloudSlotReady = Cloud ({ $model })
zotseek-pref-cloudSlotSetup = Cloud (SETUP REQUIRED)
zotseek-pref-cloudTitle = Cloud Model
zotseek-pref-cloudDesc = Configure a BYOK Cloud embedding provider. Indexed content and semantic queries are sent to the provider and may incur provider charges. ZotSeek does not charge or receive any share of those fees.
zotseek-pref-cloudProvider = Provider
zotseek-pref-cloudBaseUrl = Base URL
zotseek-pref-cloudModel = Model
zotseek-pref-cloudDimensions = Dimensions
zotseek-pref-cloudAdvanced = Advanced model parameters
zotseek-pref-cloudMaxInputTokens = Maximum input Tokens
zotseek-pref-cloudRecommendedChunkTokens = Recommended Chunk Tokens
zotseek-pref-cloudQueryApiRole = Query API Role
zotseek-pref-cloudDocumentApiRole = Document API Role
zotseek-pref-cloudBatchSize = Maximum inputs per batch
zotseek-pref-cloudResetApiRoles = Restore Bailian role defaults
zotseek-pref-cloudRecommendedChunkDesc = Auto-calculated at 85% of the model input limit, up to 4000 Tokens.
zotseek-pref-cloudApiKey = API Key
zotseek-pref-cloudApiKeyMissing = Not configured
zotseek-pref-cloudSetApiKey =
    .label = Set / replace
zotseek-pref-cloudRemoveApiKey =
    .label = Remove
zotseek-pref-cloudTest =
    .label = Test connection
zotseek-pref-cloudAutoIndex =
    .label = Permitir que Zotero mantenga el índice al iniciar cuando se usa un modelo Cloud
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
## Elementos del menú contextual

zotseek-menu-findSimilar = Buscar documentos similares
zotseek-menu-openZotSeek = Abrir ZotSeek…
zotseek-menu-indexSelected = Comprobar y actualizar los elementos seleccionados
zotseek-menu-indexCollection = Comprobar y actualizar la colección actual
zotseek-menu-updateLibrary = Comprobar y actualizar el índice
zotseek-menu-removeFromIndex = Quitar del índice de ZotSeek
zotseek-menu-findRelated = Buscar documentos relacionados

## Barra de herramientas

zotseek-toolbar-openZotSeek = Abrir ZotSeek
zotseek-toolbar-findSimilar = Buscar documentos similares

## Panel de preferencias

zotseek-pref-title = ZotSeek
zotseek-pref-indexStatistics = Estadísticas del índice
zotseek-pref-papersIndexed = Artículos indexados
zotseek-pref-totalChunks = Fragmentos totales
zotseek-pref-storageUsed = Espacio utilizado
zotseek-pref-model = Modelo:
zotseek-pref-avg = Media:
zotseek-pref-chunksPerPaper = fragmentos/artículo
zotseek-pref-lastIndexed = Última indexación:
zotseek-pref-refreshStats =
    .label = Actualizar estadísticas
zotseek-pref-compactDatabase =
    .label = Compactar base de datos
zotseek-pref-autoCompact =
    .label = Compactar automáticamente cuando Zotero esté inactivo
zotseek-pref-autoCompactDesc = Requiere Zotero 10 o posterior. Solo se ejecuta cuando se puede recuperar una cantidad significativa de espacio y no hay ninguna indexación en curso.
zotseek-pref-indexModeMismatch = El modo de indexación no coincide
zotseek-pref-indexModeMismatchDesc = El índice se creó con el modo { $indexedMode }, pero el ajuste actual es { $currentMode }.
zotseek-pref-indexModeMismatchAction = Haz clic en «Comprobar y actualizar el índice» abajo para aplicar el nuevo modo. ZotSeek reutiliza los vectores compatibles y calcula solo los que faltan; «Reconstruir índice» sigue disponible.
zotseek-pref-indexingMode = Modo de indexación
zotseek-pref-abstractOnly = Solo resumen
zotseek-pref-abstractOnlyMenu =
    .label = Solo resumen (más rápido)
zotseek-pref-abstractSpeed = Rápido • ~1 fragmento por artículo
zotseek-pref-abstractDesc = Indexa el título, resúmenes de al menos 50 caracteres y etiquetas que no empiecen por #.
zotseek-pref-notes = Metadatos + notas
zotseek-pref-notesMenu =
    .label = Metadatos + notas (sin procesar PDF)
zotseek-pref-notesSpeed = Enfocado • sin procesar PDF
zotseek-pref-notesDesc = Indexa los mismos metadatos y las notas secundarias; excluye las etiquetas que empiezan por #.
zotseek-pref-fullPaper = Artículo completo
zotseek-pref-fullPaperMenu =
    .label = Artículo completo (más exhaustivo)
zotseek-pref-fullSpeed = Exhaustivo • notas + ~1-2 fragmentos por página de PDF
zotseek-pref-fullDesc = Indexa los mismos metadatos, las notas secundarias y todo el PDF con números de página; excluye las etiquetas que empiezan por #.
zotseek-pref-mcpServer = Acceso de agentes de IA
zotseek-pref-mcpServerLabel =
    .label = Permitir que los agentes de IA busquen y lean tu biblioteca (servidor MCP local)
zotseek-pref-mcpServerDesc = Permite a clientes MCP como Claude Code realizar búsquedas de solo lectura y leer metadatos de los elementos, notas y contenido PDF. Todo permanece en este equipo (solo localhost).
zotseek-pref-mcpServerUrl = Conectar con:
zotseek-pref-mcpServerWarning = El servidor HTTP local de Zotero está desactivado. Activa «Permitir que otras aplicaciones de este equipo se comuniquen con Zotero» en Ajustes → Avanzado.
zotseek-pref-autoIndexing = Mantenimiento automático
zotseek-pref-autoIndexLabel =
    .label = Comprobar y actualizar el índice al iniciar Zotero
zotseek-pref-autoIndexDesc = Comprueba el alcance de biblioteca seleccionado al iniciar, actualiza los elementos añadidos o modificados, elimina los registros de elementos borrados de Zotero o que ahora estén excluidos por las reglas de indexación y muestra el progreso en la esquina inferior derecha.
zotseek-pref-checkNowResult = Elementos comprobados: { $checked }; actualizados: { $changed }; registros eliminados del índice: { $removed }.
zotseek-indexing-noteUpdate = Actualizando notas — elementos afectados: { $count }…
zotseek-indexing-noteUpdateComplete = Notas actualizadas — elementos afectados: { $count }
zotseek-pref-indexScope = Alcance de indexación
zotseek-pref-indexScopeUser =
    .label = Mi biblioteca
zotseek-pref-indexScopeAll =
    .label = Todas las bibliotecas
zotseek-pref-indexScopeDesc = Este alcance se aplica a la acción manual «Comprobar y actualizar el índice» y al mantenimiento automático al iniciar.
zotseek-pref-searchSettings = Ajustes de búsqueda
zotseek-pref-resultsToShow = Resultados que mostrar
zotseek-pref-resultsToShowDesc = Cuántas coincidencias mostrar (5-100)
zotseek-pref-minSimilarity = Similitud mínima
zotseek-pref-minSimilarityDesc = % — Filtra las coincidencias de baja calidad (0-100)
zotseek-pref-defaultSearchMode = Modo de búsqueda predeterminado
zotseek-pref-defaultSearchModeDesc = Cambia el modo de búsqueda predeterminado.
zotseek-pref-advancedSettings = Ajustes avanzados
zotseek-pref-modelInputSettings = Fragmentación y entrada del modelo
zotseek-pref-modelOptionalHint = (configurar al seleccionarlo)
zotseek-pref-maxTokens = Máximo de tokens por fragmento
zotseek-pref-maxTokensDesc = Anulación opcional del usuario; la política del modelo activo aplica el límite final
zotseek-pref-modelInputPolicy = Límite: { $limit } · Recomendado: { $recommended }
zotseek-pref-modelInputUnknown = gestionado por el servidor
zotseek-pref-modelInputPrefixRequired = obligatorio
zotseek-pref-modelInputPrefixNone = ninguno
zotseek-pref-modelStatusBundled = Integrado
zotseek-pref-modelStatusInstalled = Instalado
zotseek-pref-modelStatusDownload = Descarga necesaria · aproximadamente { $size } MB
zotseek-pref-modelMultilingual = multilingüe
zotseek-modelDownloadChoiceTitle = Instalar modelo de embeddings
zotseek-modelDownloadChoiceMessage = { $model } no está instalado. La descarga automática recupera aproximadamente { $size } MB una sola vez desde huggingface.co y los guarda en este equipo. ZotSeek no envía tu biblioteca de Zotero a Hugging Face.
zotseek-modelDownloadAutomatic = Descarga automática (recomendada)
zotseek-modelDownloadManual = Descarga manual
zotseek-modelDownloadCancel = Cancelar
zotseek-modelDownloadManualTitle = Descarga manual del modelo
zotseek-modelDownloadManualMessage = Descarga los archivos necesarios desde la página oficial del modelo y guárdalos en la ubicación de instalación, conservando las subcarpetas indicadas.

    Modelo: { $model }
    Página oficial: { $page }

    Archivos necesarios:
    { $files }

    Ubicación de instalación:
    { $path }
zotseek-modelDownloadOpenPage = Abrir página del modelo
zotseek-modelDownloadOpenLocation = Abrir ubicación de instalación
zotseek-modelDownloadClose = Cerrar
zotseek-modelDownloadStarting = Descargando { $model }…
zotseek-modelDownloadProgress = Descargando { $model }: archivo { $done } de { $total }
zotseek-modelDownloadFailed = La operación del modelo ha fallado: { $error }
zotseek-modelDownloadRevealFailedTitle = No se pudo abrir la ubicación de instalación
zotseek-modelDownloadRevealFailedMessage = ZotSeek no pudo abrir la ubicación de instalación del modelo. Puedes copiar esta ruta y abrirla manualmente:

    { $path }
zotseek-pref-resetMaxTokens =
    .label = Usar valor recomendado
zotseek-pref-serverConfigTitle = Modelo Local Server
zotseek-pref-serverConfigDesc = Configura la posición fija del modelo Local Server en la plantilla JSON del perfil. ZotSeek la valida al iniciar; edita el archivo y reinicia Zotero para aplicar los cambios.
zotseek-pref-serverConfigPath = Plantilla:
zotseek-pref-serverConfigNotLoaded = La plantilla aún no se ha cargado. Reinicia Zotero.
zotseek-pref-serverConfigLoaded = Local Server ({ $model }) está configurado. Edita el archivo y reinicia Zotero para aplicar los cambios.
zotseek-pref-serverConfigNone = Local Server (NONE): no hay ningún modelo Local Server configurado. Selecciona Local Server en el menú de modelos para ver las instrucciones de configuración.
zotseek-pref-serverConfigErrors = Local Server (UNKNOWN). Errores de configuración: { $errors }. Comprueba el ID del modelo, la URL del servicio de loopback, las dimensiones de los vectores, los presupuestos de tokens y los prefijos de consulta/documento de la plantilla.
zotseek-pref-serverModelIncomplete = La información del modelo Local Server está incompleta. Configura la plantilla JSON y reinicia Zotero.
zotseek-serverConfigRequiredTitle = Se necesita configurar el modelo Local Server
zotseek-serverConfigRequiredMessage = Local Server ({ $state }) está seleccionado, pero la información de su modelo está incompleta. ZotSeek conservará esta selección, pero todavía no puede indexar ni ejecutar búsquedas semánticas.

    Editar: { $path }

    Reinicia Zotero después de guardar el archivo.

    { $guidance }
zotseek-serverConfigMissingEntry = Establece el campo «model» de la plantilla en un objeto de modelo Local Server completo.
zotseek-serverConfigInvalidEntry = La plantilla contiene errores de configuración: { $errors }. Usa el ejemplo de la plantilla para completar el ID del modelo, la URL del servicio de loopback, las dimensiones de los vectores, los presupuestos de tokens y los prefijos de consulta/documento.
zotseek-serverConfigOpenLocation = Abrir ubicación del archivo
    .label = Abrir ubicación del archivo
zotseek-serverConfigClose = Cerrar
zotseek-serverConfigRevealFailedTitle = No se pudo abrir la ubicación del archivo
zotseek-serverConfigRevealFailedMessage = ZotSeek no pudo abrir la ubicación del archivo de configuración. Puedes copiar esta ruta y abrirla manualmente:

    { $path }
zotseek-pref-maxChunks = Máximo de fragmentos por artículo
zotseek-pref-maxChunksDesc = Límite para documentos largos (1-200)
zotseek-pref-excludeBooks =
    .label = Excluir libros de la indexación
zotseek-pref-excludeBooksDesc = Los libros no se indexarán. Los índices de ZotSeek existentes para libros se eliminarán en la siguiente comprobación del índice.
zotseek-pref-excludeTag = Excluir etiqueta
zotseek-pref-excludeTagDesc = Los elementos con esta etiqueta no se indexarán. Los índices de ZotSeek existentes para los elementos coincidentes se eliminarán en la siguiente comprobación del índice. Déjalo vacío para desactivar esta opción.
zotseek-pref-actions = Acciones
zotseek-pref-maintenanceRepair = Mantenimiento y reparación
zotseek-pref-updateIndex =
    .label = Comprobar y actualizar el índice
zotseek-pref-recommended = ✓ Recomendado
zotseek-pref-updateIndexDesc = Añade los elementos que faltan, actualiza los elementos cuyos metadatos, notas o ajustes de indexación hayan cambiado, omite los elementos sin cambios y elimina los registros de elementos borrados de Zotero o excluidos por las reglas de indexación. Los cambios en los ajustes de indexación pueden volver a calcular elementos existentes.
zotseek-pref-rebuildIndex =
    .label = Reconstruir índice
zotseek-pref-rebuildIndexDesc = Borra el índice del modelo actual y vuelve a indexar todos los elementos con los ajustes actuales. Úsalo tras cambiar el modo o la estrategia de fragmentación.
zotseek-pref-clearIndex =
    .label = Borrar índice
zotseek-pref-dangerZone = Zona de peligro
zotseek-pref-destructive = ⚠ Destructivo
zotseek-pref-clearIndexDesc = Elimina todos los embeddings de la base de datos. Después tendrás que volver a indexar.
zotseek-pref-about = Acerca de
zotseek-pref-githubRepo =
    .value = Repositorio de GitHub
zotseek-pref-modelLine = Modelo: { $model }
zotseek-pref-avgLine = Media: { $avg } fragmentos/artículo
zotseek-pref-lastIndexedLine = Última indexación: { $date }
zotseek-pref-compacted = Base de datos compactada
zotseek-pref-compactionFailed = Error al compactar
zotseek-pref-healthHeader = Estado de la base de datos
zotseek-pref-healthOrphans = Embeddings sin resolver: { $count }
zotseek-pref-healthOrphansDesc = Embeddings cuyos elementos de origen no se pudieron relacionar con tu biblioteca actual. Purgarlos libera espacio, pero esta acción no se puede deshacer.
zotseek-pref-healthPurgeOrphans =
    .label = Purgar huérfanos
zotseek-pref-healthPurgeConfirmTitle = Purgar embeddings sin resolver
zotseek-pref-healthPurgeConfirmMsg = Esto eliminará permanentemente los embeddings de los elementos que no se encuentren en tu biblioteca actual de Zotero. ¿Continuar?
zotseek-pref-healthPurgeDoneTitle = Huérfanos purgados
zotseek-pref-healthPurgeDoneMsg = Se eliminaron { $count } entradas sin resolver.
zotseek-pref-healthPurgeFailedTitle = Error al purgar

## Diálogo de búsqueda

zotseek-search-search =
    .value = Buscar:
zotseek-search-placeholder =
    .placeholder = Introduce tu consulta (la búsqueda se realiza automáticamente mientras escribes)…
zotseek-search-addQuery =
    .label = +
    .tooltiptext = Añadir otra consulta para combinarla con AND/OR
zotseek-search-searchBtn =
    .label = Buscar
zotseek-search-and =
    .label = AND
zotseek-search-or =
    .label = OR
zotseek-search-using =
    .value = usando
zotseek-search-minimum =
    .label = Mínimo
zotseek-search-product =
    .label = Producto
zotseek-search-average =
    .label = Media
zotseek-search-andDesc =
    .value = — los resultados deben coincidir con ambas consultas
zotseek-search-query2 =
    .value = Consulta 2:
zotseek-search-query3 =
    .value = Consulta 3:
zotseek-search-query4 =
    .value = Consulta 4:
zotseek-search-enterQuery = Introduce la consulta { $n }…
zotseek-search-removeQuery =
    .label = ✕
    .tooltiptext = Eliminar esta consulta
zotseek-search-mode =
    .value = Modo:
zotseek-search-modeHybrid =
    .label = 🔗 Híbrido (recomendado)
zotseek-search-modeSemantic =
    .label = 🧠 Solo semántico
zotseek-search-modeKeyword =
    .label = 🔤 Solo palabras clave
zotseek-search-modeDesc =
    .value = Tipo de coincidencia: 🔗 ambas búsquedas · 🧠 coincidencia de IA · 🔤 coincidencia de palabras clave
zotseek-search-results =
    .value = Resultados:
zotseek-search-bySection = Por sección
zotseek-search-byLocation = Por ubicación (página y párrafo exactos)
zotseek-search-settings =
    .label = ⚙ Ajustes
    .tooltiptext = Abrir las preferencias de ZotSeek
zotseek-search-openSelected =
    .label = Abrir selección
zotseek-search-close =
    .label = Cerrar
zotseek-search-initializing = Inicializando la búsqueda…
zotseek-search-hybrid = Híbrido
zotseek-search-semantic = Semántico
zotseek-search-keyword = Palabras clave
zotseek-search-loadingModel = Cargando el modelo de IA (la primera vez puede tardar un momento)…
zotseek-search-finding = Búsqueda { $mode }: buscando elementos…
zotseek-search-findingMulti = Búsqueda { $mode } ({ $op }): buscando elementos…
zotseek-search-noItemsFound = No se encontraron elementos
zotseek-search-showInLibrary = Mostrar en la biblioteca
zotseek-search-showItemsInLibrary = Mostrar { $count } elementos en la biblioteca
zotseek-search-addToCollection = Añadir a la colección
zotseek-search-noCollections = No hay colecciones
zotseek-search-moreCollections = … y { $count } más
zotseek-search-foundItems = Se encontraron { $count } elementos
zotseek-search-foundItemsFromMatches = Se encontraron { $count } elementos (de { $matches } coincidencias)
zotseek-search-foundItemsQuery = Se encontraron { $count } elementos ({ $query })
zotseek-search-searching = Buscando…
zotseek-search-searchLabel = Buscar
zotseek-search-searchingMoment = Buscando en un momento…
zotseek-search-queryTooShort = Introduce al menos 2 caracteres CJK o 3 caracteres de otro tipo
zotseek-search-failed = Error en la búsqueda: { $error }
zotseek-search-noItemsMatchingAll = No se encontraron elementos que coincidan con todas las consultas
zotseek-search-matchBoth = — los resultados deben coincidir con ambas consultas
zotseek-search-matchAll = — los resultados deben coincidir con todas las consultas
zotseek-search-matchAny = — los resultados pueden coincidir con cualquier consulta

## Columnas de la tabla de resultados

zotseek-column-match = Coincidencia
zotseek-column-title = Título
zotseek-column-authors = Autores
zotseek-column-year = Año
zotseek-column-location = Ubicación
zotseek-column-section = Sección

## Etiquetas de origen

zotseek-source-abstract = Resumen
zotseek-source-fulltext = Texto completo
zotseek-source-title = Título
zotseek-source-methods = Métodos
zotseek-source-results = Resultados
zotseek-source-content = Contenido
zotseek-source-note = Nota
zotseek-search-hybrid-menuitem =
    .label = 🔗 Híbrido (recomendado)
zotseek-search-semantic-menuitem =
    .label = 🧠 Solo semántico
zotseek-search-keyword-menuitem =
    .label = 🔤 Solo palabras clave

## Diálogo de documentos similares

zotseek-similar-title =
    .title = Buscar documentos similares
zotseek-similar-similarTo = Similar a:{ " " }
zotseek-similar-loading = Cargando…
zotseek-similar-openSelected =
    .label = Abrir selección
zotseek-similar-close =
    .label = Cerrar
zotseek-similar-initFailed = Error al inicializar: { $error }
zotseek-similar-noSource = No se ha seleccionado ningún documento de origen
zotseek-similar-finding = Buscando documentos similares…
zotseek-similar-loadingModel = Cargando el modelo de IA…
zotseek-similar-searching = Buscando…
zotseek-similar-noResults = No se encontraron documentos similares
zotseek-similar-found = Se encontraron { $count } documentos similares
zotseek-similar-searchFailed = Error en la búsqueda: { $error }

## Progreso de indexación

zotseek-indexing-title = Indexación de ZotSeek
zotseek-indexing-clearTitle = Borrando el índice de ZotSeek
zotseek-indexing-clearConfirmTitle = Borrar el índice de ZotSeek
zotseek-indexing-clearConfirmMsg = Esto eliminará todos los embeddings almacenados. Después tendrás que volver a indexar tu biblioteca.

    ¿Continuar?
zotseek-indexing-clearConfirmButton = Borrar índice
zotseek-indexing-initStorage = Inicializando el almacenamiento…
zotseek-indexing-deletingAll = Eliminando todos los embeddings…
zotseek-indexing-clearedSuccess = ¡Índice borrado correctamente!
zotseek-indexing-clearedMsg = El índice se ha borrado correctamente.

    Ya puedes volver a indexar tu biblioteca.
zotseek-indexing-rebuildTitle = Reconstruir el índice de ZotSeek
zotseek-indexing-rebuildConfirmTitle = Reconstruir el índice de ZotSeek
zotseek-indexing-rebuildConfirmMsg = Esto eliminará los embeddings del modelo actual y reconstruirá su índice. Se conservarán los índices de otros modelos.
zotseek-indexing-rebuildConfirmButton = Reconstruir índice
zotseek-indexing-chunkStrategyRebuildRequired = ZotSeek ha detectado que el índice del modelo actual utiliza una estrategia de fragmentación anterior.
    El índice existente sigue disponible para búsquedas, pero las actualizaciones incrementales en segundo plano se han pausado para evitar mezclar fragmentos antiguos y nuevos. Usa «Reconstruir índice» en Ajustes para realizar una reconstrucción completa. Cerrar este aviso no inicia una reconstrucción ni modifica el índice existente.
    Según el tamaño de la biblioteca y la estrategia de indexación, la reconstrucción puede tardar desde varias decenas de minutos hasta varias horas.
zotseek-indexing-rebuildingTitle = Reconstruyendo el índice de ZotSeek
zotseek-indexing-clearingExisting = Borrando el índice existente…
zotseek-indexing-existingCleared = ✓ Índice del modelo actual borrado
zotseek-indexing-loading = Cargando…
zotseek-indexing-alreadyInProgress = La indexación ya está en curso…
zotseek-indexing-selectItems = Selecciona los elementos que quieres indexar.
zotseek-indexing-selectCollection = Selecciona primero una colección.

    (Haz clic en una colección de la barra lateral izquierda)
zotseek-indexing-emptyCollection = La colección «{ $name }» no contiene elementos para indexar.
zotseek-indexing-emptyCollections = Las { $count } colecciones seleccionadas no contienen elementos para indexar.
zotseek-indexing-updateTitle = ZotSeek - Comprobar y actualizar el índice
zotseek-indexing-updateConfirmMsg = ¿Comprobar y actualizar el índice para { $scope }? ZotSeek añadirá los elementos que falten, actualizará los elementos cuyos metadatos, notas o ajustes de indexación hayan cambiado, omitirá los elementos sin cambios y eliminará los registros de elementos borrados de Zotero o excluidos por las reglas de indexación. Los cambios en los ajustes de indexación pueden volver a calcular elementos existentes con los ajustes actuales.
zotseek-indexing-updateConfirmButton = Comprobar y actualizar
zotseek-indexing-confirmCancel = Cancelar
zotseek-indexing-scopeUser = tu biblioteca personal
zotseek-indexing-scopeAll = todas tus bibliotecas (personales y de grupos)

zotseek-indexing-configChangeTitle = ZotSeek - Ajustes de indexación modificados
zotseek-indexing-configChangeMessage = Los ajustes de indexación han cambiado en { $scope }. Elementos ya indexados afectados: { $affected }; embeddings que deben recalcularse: { $rebuildRequired }. Para los demás elementos solo hay que actualizar el registro de configuración. Antes de que elijas, ZotSeek no eliminará registros, actualizará huellas ni escribirá embeddings. ¿Cómo debe continuar esta comprobación al iniciar?
zotseek-indexing-configChangeUpdate = Comprobar y actualizar el índice
zotseek-indexing-configChangeRebuild = Reconstruir índice
zotseek-indexing-configChangeCancel = Cancelar

# Aviso mostrado al iniciar cuando se interrumpió una indexación masiva anterior.
zotseek-resume-title = ZotSeek - Reanudar indexación
zotseek-resume-message = Una indexación anterior se interrumpió. ZotSeek volverá a comprobar el ámbito { $scope } (número de elementos: { $count }) y reanudará las actualizaciones incompletas o fallidas. Los elementos que ya estén actualizados se omitirán. Si cancelas, el mantenimiento automático del índice también se omitirá en este inicio. ¿Reanudar ahora?
zotseek-resume-confirm = Reanudar indexación
zotseek-resume-scopeLibrary = tus bibliotecas
zotseek-resume-scopeUserLibrary = tu biblioteca personal
zotseek-resume-scopeCollection = la colección «{ $name }»
zotseek-resume-scopeCollections = { $count } colecciones seleccionadas
zotseek-resume-scopeItems = el alcance de elementos seleccionados
zotseek-indexing-noItemsSelected = No se han seleccionado elementos
zotseek-indexing-removedItems = Elementos retirados del índice: { $count }
zotseek-indexing-notInIndex = Los elementos seleccionados no estaban en el índice
zotseek-indexing-removeFailed = No se pudo quitar del índice
zotseek-indexing-mode = Modo de indexación: { $mode }
zotseek-indexing-checking = Comprobando los elementos ya indexados…
zotseek-indexing-skippedExcluded = ✓ Elementos excluidos omitidos: { $count }
zotseek-indexing-skippedIndexed = ✓ Elementos ya indexados omitidos: { $count }
zotseek-indexing-allIndexed = ¡Todos los elementos ya están indexados!
zotseek-indexing-allInIndex = ✓ { $count } elementos ya están en el índice
zotseek-indexing-nothingToIndex = No hay nada que indexar: todos los elementos están actualizados.
zotseek-indexing-loadingModel = Cargando el modelo de IA (Transformers.js)…
zotseek-indexing-modelLoaded = ✓ Modelo de IA cargado
zotseek-indexing-batchExtracting = Lote { $current }/{ $total }: extrayendo texto…
zotseek-indexing-batchEmbedding = Lote { $current }/{ $total }: generando embeddings…
zotseek-indexing-batchEmbeddingChunks = Lote { $current }/{ $total }: generando embeddings de los fragmentos
zotseek-indexing-chunksFailed = ⚠ Se omitieron { $count } fragmentos en: { $items }
zotseek-indexing-batchSaving = Lote { $current }/{ $total }: guardando punto de control…
zotseek-indexing-checkpoint = ✓ Punto de control { $current }/{ $total }: se guardaron { $items } elementos y { $chunks } fragmentos
zotseek-indexing-complete = ¡Indexación completada!
zotseek-indexing-completeMode = ✓ Modo: { $mode }
zotseek-indexing-completePrevious = ✓ Ya indexados: { $count } elementos
zotseek-indexing-completeNew = ✓ Indexados ahora: { $count } elementos
zotseek-indexing-completeChunks = ✓ Fragmentos totales: { $count }
zotseek-indexing-completeAvg = ✓ Media de fragmentos/elemento: { $avg }
zotseek-indexing-completeDuration = ✓ Duración: { $duration }
zotseek-indexing-completeNoContent = ⚠ Sin contenido: { $count } elementos
zotseek-indexing-completeTruncated = ⚠ Contenido parcial: se alcanzó el límite de fragmentos por artículo. Elementos afectados: { $count }. Aumenta el límite o cambia al modo «Solo resumen» para indexar todo el texto.
zotseek-indexing-completeSuccess = ¡La indexación se completó correctamente!
zotseek-indexing-cancelled = Indexación cancelada
zotseek-indexing-pauseAction = Pausar indexación
zotseek-indexing-pausingAction = Pausando…
zotseek-indexing-pauseTooltip = Detener después del punto de control seguro actual y reanudar la próxima vez que se inicie Zotero
zotseek-indexing-paused = Indexación pausada. ZotSeek ofrecerá reanudar este mismo alcance la próxima vez que se inicie Zotero.
zotseek-indexing-failed = Error en la indexación: { $error }
zotseek-indexing-progressTitle = ZotSeek
zotseek-indexing-progressItem = Indexando: { $title }
zotseek-indexing-progressLoadingModel = Cargando modelo…
zotseek-indexing-allExcluded = Todos los elementos están excluidos de la indexación
zotseek-indexing-extracting = Extrayendo…
zotseek-indexing-noContent = ✗ No se encontró contenido
zotseek-indexing-embedding = Generando embeddings { $current }/{ $total }…
zotseek-indexing-saving = Guardando…
zotseek-indexing-chunksIndexed = ✓ { $count } fragmentos indexados
zotseek-indexing-chunksIndexedWithFailed = ✓ { $count } fragmentos indexados ({ $failed } fallidos)

## Exportar a una colección (incidencia n.º 28)

# Las claves referenciadas mediante data-l10n-id en elementos XUL usan el formato .attr = value
# para que Fluent establezca el atributo indicado en lugar de borrar los elementos secundarios.
# Las claves consumidas mediante formatValueSync / getString() desde JS siguen siendo key = text.

zotseek-export-saveAsCollection =
    .label = Guardar resultados como colección
zotseek-export-addToCollectionNew =
    .label = Nueva colección…
zotseek-export-dialogTitle =
    .title = Guardar resultados como colección
zotseek-export-nameLabel =
    .value = Nombre de la colección:
zotseek-export-libraryLabel =
    .value = Biblioteca:
zotseek-export-ok =
    .label = Guardar
zotseek-export-cancel =
    .label = Cancelar
zotseek-export-itemcountSimple = { $count } elementos → { $destination }
zotseek-export-itemcountFiltered = { $kept } de { $total } elementos → { $destination } ({ $reasons })
zotseek-export-reasonOtherLibrary = { $count } en otras bibliotecas
zotseek-export-reasonDeleted = { $count } eliminados
zotseek-export-itemcountEmpty = No hay elementos que añadir.
zotseek-export-statusExported = Se añadieron { $count } elementos a «{ $name }».
zotseek-export-statusExportedSkipped = Se añadieron { $count } elementos a «{ $name }»; se omitieron { $skipped }.
zotseek-export-statusFailed = No se pudieron guardar los resultados como colección.

## Encabezados de grupos de preferencias

zotseek-prefs-group-status = Estado
zotseek-prefs-group-models = Modelos
zotseek-prefs-group-indexing = Indexación
zotseek-prefs-group-search = Búsqueda
zotseek-prefs-group-maintenance = Integraciones y mantenimiento
zotseek-prefs-exclusions = Exclusiones

## Encabezados de secciones de modelos (antes solo había textos alternativos en XHTML; se añaden aquí las entradas FTL que faltaban)

zotseek-pref-embeddingModelTitle = Modelo de embeddings
zotseek-pref-manageModelsTitle = Gestionar modelos instalados
zotseek-indexing-cloudRebuildConfirmTitle = Rebuild Cloud index?
zotseek-indexing-cloudRebuildConfirmMsg = About { $count } papers in { $scope } will be sent to the configured Cloud provider and may incur provider charges. Existing complete indexes are kept until each paper is replaced successfully. Continue?
zotseek-indexing-cloudStrategyRebuildConfirmMsg = The current Cloud index uses an older chunk strategy. Its existing embeddings must be deleted before about { $count } papers in { $scope } are sent again, which may incur provider charges. Other model indexes are kept. Continue?

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## Cloud embedding and Local Server naming

zotseek-pref-localServerReady = Local Server ({ $model })
zotseek-pref-localServerState = Local Server ({ $state })
zotseek-pref-cloudSlotReady = Cloud ({ $model })
zotseek-pref-cloudSlotSetup = Cloud (SETUP REQUIRED)
zotseek-pref-cloudTitle = Cloud Model
zotseek-pref-cloudDesc = Konfigurieren Sie einen BYOK-Cloud-Embedding-Dienst. Indexinhalte und semantische Suchanfragen werden an den Cloud-Anbieter gesendet; ZotSeek-U erhebt keine Gebühren und erhält keinen Anteil daran. Indizierung und Suche benötigen eine Internetverbindung und verbrauchen das API-Kontingent des Anbieters, wodurch Kosten entstehen können; Einzelheiten finden Sie in der Preisdokumentation des Cloud-Anbieters.
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
    .label = Index beim Start mit einem Cloud-Modell automatisch verwalten
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
zotseek-pref-modelBackfillTitle = Verbleibende Einträge mit dem aktuellen Modell indexieren?
zotseek-pref-modelBackfillMessage = Dieses Modell deckt { $covered } von { $total } Einträgen ab. Sollen die verbleibenden { $missing } jetzt im Hintergrund indexiert werden? Zotero kann währenddessen weiter verwendet werden.
## Context menu items

zotseek-menu-findSimilar = Ähnliche Dokumente finden
zotseek-menu-openZotSeek = ZotSeek öffnen…
zotseek-menu-indexSelected = Ausgewählte Einträge prüfen und aktualisieren
zotseek-menu-indexCollection = Aktuelle Sammlung prüfen und aktualisieren
zotseek-menu-updateLibrary = Index prüfen und aktualisieren
zotseek-menu-removeFromIndex = Aus ZotSeek-Index entfernen
zotseek-menu-findRelated = Verwandte Dokumente finden

## Toolbar

zotseek-toolbar-openZotSeek = ZotSeek-U öffnen
zotseek-toolbar-findSimilar = Ähnliche Dokumente finden

## Preference pane

zotseek-pref-title = ZotSeek-U
zotseek-pref-indexStatistics = Indexstatistik
zotseek-pref-papersIndexed = Indizierte Dokumente
zotseek-pref-totalChunks = Chunks insgesamt
zotseek-pref-storageUsed = Belegter Speicher
zotseek-pref-model = Modell:
zotseek-pref-avg = Ø:
zotseek-pref-chunksPerPaper = Chunks/Dokument
zotseek-pref-lastIndexed = Zuletzt indiziert:
zotseek-pref-refreshStats =
    .label = Statistik aktualisieren
zotseek-pref-compactDatabase =
    .label = Datenbank komprimieren
zotseek-pref-autoCompact =
    .label = Automatisch komprimieren, wenn Zotero nicht verwendet wird
zotseek-pref-autoCompactDesc = Erfordert Zotero 10 oder neuer. Wird nur ausgeführt, wenn sinnvoll Speicherplatz freigegeben werden kann und keine Indizierung läuft.
zotseek-pref-indexModeMismatch = Indexmodus stimmt nicht überein
zotseek-pref-indexModeMismatchDesc = Ihr Index wurde mit dem Modus { $indexedMode } erstellt, die aktuelle Einstellung ist jedoch { $currentMode }.
zotseek-pref-indexModeMismatchAction = Klicken Sie unten auf „Index prüfen und aktualisieren“, um den neuen Modus anzuwenden. ZotSeek verwendet kompatible Vektoren erneut und berechnet nur fehlende; „Index neu erstellen“ bleibt verfügbar.
zotseek-pref-indexingMode = Indizierungsmodus
zotseek-pref-abstractOnly = Nur Abstract
zotseek-pref-abstractOnlyMenu =
    .label = Nur Abstract (schneller)
zotseek-pref-abstractSpeed = Schnell · ca. 1 Chunk pro Dokument
zotseek-pref-abstractDesc = Indiziert Titel, Abstract und Schlagwörter, die nicht mit # beginnen.
zotseek-pref-notes = Metadaten + Notizen
zotseek-pref-notesMenu =
    .label = Metadaten + Notizen (keine PDF-Verarbeitung)
zotseek-pref-notesSpeed = Fokussiert · keine PDF-Verarbeitung
zotseek-pref-notesDesc = Indiziert dieselben Metadaten sowie untergeordnete Notizen.
zotseek-pref-fullPaper = Vollständiges Dokument
zotseek-pref-fullPaperMenu =
    .label = Vollständiges Dokument (gründlicher)
zotseek-pref-fullSpeed = Gründlich · Abstract + Notizen + PDF
zotseek-pref-fullDesc = Indiziert dieselben Metadaten, untergeordnete Notizen und den vollständigen PDF-Inhalt mit Seitenzahlen.
zotseek-pref-mcpServer = Zugriff für KI-Agenten
zotseek-pref-mcpServerLabel =
    .label = KI-Agenten das Suchen und Lesen Ihrer Bibliothek erlauben (lokaler MCP-Server)
zotseek-pref-mcpServerDesc = Ermöglicht MCP-Clients wie Claude Code schreibgeschützte Suchen sowie das Lesen von Metadaten, Notizen und PDF-Inhalten. Alles bleibt auf diesem Computer (nur localhost).
zotseek-pref-mcpServerUrl = Verbinden mit:
zotseek-pref-mcpServerWarning = Der lokale HTTP-Server von Zotero ist deaktiviert. Aktivieren Sie unter Einstellungen → Erweitert die Option „Anderen Anwendungen auf diesem Computer die Kommunikation mit Zotero erlauben“.
zotseek-pref-autoIndexing = Automatische Wartung
zotseek-pref-autoIndexLabel =
    .label = Index beim Start von Zotero prüfen und aktualisieren
zotseek-pref-autoIndexDesc = Prüft beim Start den ausgewählten Bibliotheksbereich, aktualisiert hinzugefügte oder geänderte Einträge, entfernt Einträge für aus Zotero gelöschte oder inzwischen ausgeschlossene Dokumente und zeigt den Fortschritt unten rechts an.
zotseek-pref-checkNowResult = { $checked } Einträge geprüft; { $changed } aktualisiert; { $removed } Indexeinträge entfernt.
zotseek-indexing-noteUpdate = Notizen für { $count } Einträge werden aktualisiert…
zotseek-indexing-noteUpdateComplete = Notizen für { $count } Einträge aktualisiert
zotseek-pref-indexScope = Indexbereich
zotseek-pref-indexScopeUser =
    .label = Meine Bibliothek
zotseek-pref-indexScopeAll =
    .label = Alle Bibliotheken
zotseek-pref-indexScopeDesc = Dieser Bereich gilt für die manuelle Aktion „Index prüfen und aktualisieren“ und die automatische Wartung beim Start.
zotseek-pref-searchSettings = Sucheinstellungen
zotseek-pref-resultsToShow = Anzuzeigende Ergebnisse
zotseek-pref-resultsToShowDesc = Anzahl der anzuzeigenden Treffer (5–100)
zotseek-pref-minSimilarity = Minimale Ähnlichkeit
zotseek-pref-minSimilarityDesc = % — Treffer mit geringer Qualität ausblenden (0–100)
zotseek-pref-defaultSearchMode = Standardsuchmodus
zotseek-pref-defaultSearchModeDesc = Ändert den Standardsuchmodus.
zotseek-pref-advancedSettings = Erweiterte Einstellungen
zotseek-pref-modelInputSettings = Aufteilung und Modelleingabe
zotseek-pref-modelOptionalHint = (bei Auswahl konfigurieren)
zotseek-pref-maxTokens = Maximale Tokens pro Chunk
zotseek-pref-maxTokensDesc = Optionale Überschreibung; die Richtlinie des aktiven Modells legt das endgültige Limit fest
zotseek-pref-modelInputPolicy = Limit: { $limit } · Empfohlen: { $recommended }
zotseek-pref-modelInputUnknown = vom Server verwaltet
zotseek-pref-modelInputPrefixRequired = erforderlich
zotseek-pref-modelInputPrefixNone = keines
zotseek-pref-modelStatusBundled = Integriert
zotseek-pref-modelStatusInstalled = Installiert
zotseek-pref-modelStatusDownload = Download erforderlich · etwa { $size } MB
zotseek-pref-modelMultilingual = mehrsprachig
zotseek-modelDownloadChoiceTitle = Embedding-Modell installieren
zotseek-modelDownloadChoiceMessage = { $model } ist nicht installiert. Der automatische Download ruft einmalig etwa { $size } MB von huggingface.co ab und speichert sie auf diesem Computer. ZotSeek sendet Ihre Zotero-Bibliothek nicht an Hugging Face.
zotseek-modelDownloadAutomatic = Automatischer Download (empfohlen)
zotseek-modelDownloadManual = Manueller Download
zotseek-modelDownloadCancel = Abbrechen
zotseek-modelDownloadManualTitle = Manueller Modell-Download
zotseek-modelDownloadManualMessage = Laden Sie die erforderlichen Dateien von der offiziellen Modellseite herunter und speichern Sie sie am Installationsort. Die aufgeführten Unterverzeichnisse müssen erhalten bleiben.

    Modell: { $model }
    Offizielle Seite: { $page }

    Erforderliche Dateien:
    { $files }

    Installationsort:
    { $path }
zotseek-modelDownloadOpenPage = Modellseite öffnen
zotseek-modelDownloadOpenLocation = Installationsort öffnen
zotseek-modelDownloadClose = Schließen
zotseek-modelDownloadStarting = { $model } wird heruntergeladen…
zotseek-modelDownloadProgress = { $model } wird heruntergeladen: Datei { $done } von { $total }
zotseek-modelDownloadFailed = Modellvorgang fehlgeschlagen: { $error }
zotseek-modelDownloadRevealFailedTitle = Installationsort konnte nicht geöffnet werden
zotseek-modelDownloadRevealFailedMessage = ZotSeek konnte den Installationsort des Modells nicht öffnen. Sie können diesen Pfad kopieren und manuell öffnen:

    { $path }
zotseek-pref-resetMaxTokens =
    .label = Empfohlene Einstellung verwenden
zotseek-pref-serverConfigTitle = Local-Server-Modell
zotseek-pref-serverConfigDesc = Konfigurieren Sie den festen Local-Server-Modellplatz in der JSON-Profilvorlage. ZotSeek prüft ihn beim Start; bearbeiten Sie die Datei und starten Sie Zotero neu, um Änderungen anzuwenden.
zotseek-pref-serverConfigPath = Vorlage:
zotseek-pref-serverConfigNotLoaded = Die Vorlage wurde noch nicht geladen. Starten Sie Zotero neu.
zotseek-pref-serverConfigLoaded = Local Server ({ $model }) ist konfiguriert. Bearbeiten Sie die Datei und starten Sie Zotero neu, um Änderungen anzuwenden.
zotseek-pref-serverConfigNone = Local Server (NONE): Kein Local-Server-Modell konfiguriert. Wählen Sie „Local Server“ im Modellmenü, um Einrichtungshinweise anzuzeigen.
zotseek-pref-serverConfigErrors = Local Server (UNKNOWN): { $errors } Konfigurationsfehler. Prüfen Sie Modell-ID, Loopback-Service-URL, Vektordimensionen, Tokenbudgets sowie Query-/Dokumentpräfixe in der Vorlage.
zotseek-pref-serverModelIncomplete = Die Informationen zum Local-Server-Modell sind unvollständig. Konfigurieren Sie die JSON-Vorlage und starten Sie Zotero neu.
zotseek-serverConfigRequiredTitle = Konfiguration des Local-Server-Modells erforderlich
zotseek-serverConfigRequiredMessage = Local Server ({ $state }) ist ausgewählt, aber die Informationen zum Modell sind unvollständig. ZotSeek behält diese Auswahl bei, kann jedoch noch nicht indizieren oder semantisch suchen.

    Bearbeiten: { $path }

    Starten Sie Zotero nach dem Speichern der Datei neu.

    { $guidance }
zotseek-serverConfigMissingEntry = Setzen Sie das Feld „model“ der Vorlage auf ein vollständiges Local-Server-Modellobjekt.
zotseek-serverConfigInvalidEntry = Die Vorlage enthält { $errors } Konfigurationsfehler. Verwenden Sie das Beispiel in der Vorlage, um Modell-ID, Loopback-Service-URL, Vektordimensionen, Tokenbudgets sowie Query-/Dokumentpräfixe zu vervollständigen.
zotseek-serverConfigOpenLocation = Dateispeicherort öffnen
    .label = Dateispeicherort öffnen
zotseek-serverConfigClose = Schließen
zotseek-serverConfigRevealFailedTitle = Dateispeicherort konnte nicht geöffnet werden
zotseek-serverConfigRevealFailedMessage = ZotSeek konnte den Speicherort der Konfigurationsdatei nicht öffnen. Sie können diesen Pfad kopieren und manuell öffnen:

    { $path }
zotseek-pref-maxChunks = Maximale Chunks pro Dokument
zotseek-pref-maxChunksDesc = Limit für lange Dokumente (1–200)
zotseek-pref-excludeBooks =
    .label = Bücher von der Indizierung ausschließen
zotseek-pref-excludeBooksDesc = Bücher werden nicht indiziert. Vorhandene ZotSeek-U-Indizes für Bücher werden bei der nächsten Indexprüfung entfernt.
zotseek-pref-excludeTag = Schlagwort ausschließen
zotseek-pref-excludeTagDesc = Einträge mit diesem Schlagwort werden nicht indiziert. Vorhandene ZotSeek-U-Indizes für passende Einträge werden bei der nächsten Indexprüfung entfernt. Leer lassen, um die Funktion zu deaktivieren.
zotseek-pref-actions = Aktionen
zotseek-pref-maintenanceRepair = Wartung und Reparatur
zotseek-pref-updateIndex =
    .label = Index prüfen und aktualisieren
zotseek-pref-recommended = ✓ Empfohlen
zotseek-pref-updateIndexDesc = Fügt fehlende Einträge hinzu, aktualisiert Einträge mit geänderten Metadaten, Notizen oder Indizierungseinstellungen, überspringt unveränderte Einträge und entfernt Einträge für aus Zotero gelöschte oder inzwischen ausgeschlossene Dokumente. Änderungen an den Indizierungseinstellungen können vorhandene Einträge neu berechnen.
zotseek-pref-rebuildIndex =
    .label = Index neu erstellen
zotseek-pref-rebuildIndexDesc = Löscht den Index des aktuellen Modells und indiziert alle Einträge mit den aktuellen Einstellungen neu. Nach Änderung des Indizierungsmodus oder der Chunk-Strategie verwenden.
zotseek-pref-clearIndex =
    .label = Index löschen
zotseek-pref-dangerZone = Gefahrenzone
zotseek-pref-destructive = ⚠ Nicht rückgängig zu machen
zotseek-pref-clearIndexDesc = Entfernt alle Embeddings aus der Datenbank. Anschließend müssen Sie die Bibliothek neu indizieren.
zotseek-pref-about = Über
zotseek-pref-githubRepo =
    .value = GitHub-Repository
zotseek-pref-modelLine = Modell: { $model }
zotseek-pref-avgLine = Ø { $avg } Chunks/Dokument
zotseek-pref-lastIndexedLine = Zuletzt indiziert: { $date }
zotseek-pref-compacted = Datenbank komprimiert
zotseek-pref-compactionFailed = Komprimierung fehlgeschlagen
zotseek-pref-healthHeader = Datenbankstatus
zotseek-pref-healthOrphans = Nicht zugeordnete Embeddings: { $count }
zotseek-pref-healthOrphansDesc = Embeddings, deren Quelldokumente nicht Ihrer aktuellen Bibliothek zugeordnet werden konnten. Das Löschen gibt Speicherplatz frei, kann aber nicht rückgängig gemacht werden.
zotseek-pref-healthPurgeOrphans =
    .label = Nicht zugeordnete löschen
zotseek-pref-healthPurgeConfirmTitle = Nicht zugeordnete Embeddings löschen
zotseek-pref-healthPurgeConfirmMsg = Dadurch werden Embeddings für Dokumente, die in Ihrer aktuellen Zotero-Bibliothek nicht gefunden wurden, dauerhaft gelöscht. Fortfahren?
zotseek-pref-healthPurgeDoneTitle = Nicht zugeordnete gelöscht
zotseek-pref-healthPurgeDoneMsg = { $count } nicht zugeordnete Einträge entfernt.
zotseek-pref-healthPurgeFailedTitle = Löschen fehlgeschlagen

## Search dialog

zotseek-search-search =
    .value = Suche:
zotseek-search-placeholder =
    .placeholder = Suchanfrage eingeben (Suche startet während der Eingabe automatisch)… | Z. B.: Literatur zum Zusammenhang zwischen höherem Erziehungsstress und geringerer Eltern-Kind-Hirnsynchronität
zotseek-search-addQuery =
    .label = +
    .tooltiptext = Eine weitere Suchanfrage für eine UND-/ODER-Kombination hinzufügen
zotseek-search-searchBtn =
    .label = Suchen
zotseek-search-and =
    .label = UND
zotseek-search-or =
    .label = ODER
zotseek-search-using =
    .value = mit
zotseek-search-minimum =
    .label = Minimum
zotseek-search-product =
    .label = Produkt
zotseek-search-average =
    .label = Durchschnitt
zotseek-search-andDesc =
    .value = — Treffer müssen beide Suchanfragen erfüllen
zotseek-search-query2 =
    .value = Suchanfrage 2:
zotseek-search-query3 =
    .value = Suchanfrage 3:
zotseek-search-query4 =
    .value = Suchanfrage 4:
zotseek-search-enterQuery = Suchanfrage { $n } eingeben…
zotseek-search-removeQuery =
    .label = ✕
    .tooltiptext = Diese Suchanfrage entfernen
zotseek-search-mode =
    .value = Modus:
zotseek-search-modeHybrid =
    .label = 🔗 Hybrid (empfohlen)
zotseek-search-modeSemantic =
    .label = 🧠 Nur semantisch
zotseek-search-modeKeyword =
    .label = 🔤 Nur Schlüsselwörter
zotseek-search-modeDesc =
    .value = Treffertyp: 🔗 beide Suchen · 🧠 KI-Treffer · 🔤 Schlüsselworttreffer
zotseek-search-results =
    .value = Ergebnisse:
zotseek-search-bySection = Nach Abschnitt
zotseek-search-byLocation = Nach Position (genaue Seite und Absatz)
zotseek-search-settings =
    .label = ⚙ Einstellungen
    .tooltiptext = ZotSeek-Einstellungen öffnen
zotseek-search-openSelected =
    .label = Auswahl öffnen
zotseek-search-close =
    .label = Schließen
zotseek-search-initializing = Suche wird initialisiert…
zotseek-search-hybrid = Hybrid
zotseek-search-semantic = Semantisch
zotseek-search-keyword = Schlüsselwort
zotseek-search-loadingModel = KI-Modell wird geladen (beim ersten Mal kann dies einen Moment dauern)…
zotseek-search-finding = { $mode }-Suche: Einträge werden gesucht…
zotseek-search-findingMulti = { $mode }-Suche ({ $op }): Einträge werden gesucht…
zotseek-search-noItemsFound = Keine Einträge gefunden
zotseek-search-showInLibrary = In Bibliothek anzeigen
zotseek-search-showItemsInLibrary = { $count } Einträge in Bibliothek anzeigen
zotseek-search-addToCollection = Zur Sammlung hinzufügen
zotseek-search-noCollections = Keine Sammlungen
zotseek-search-moreCollections = … und { $count } weitere
zotseek-search-foundItems = { $count } Einträge gefunden
zotseek-search-foundItemsFromMatches = { $count } Einträge gefunden (aus { $matches } Treffern)
zotseek-search-foundItemsQuery = { $count } Einträge gefunden ({ $query })
zotseek-search-searching = Suche läuft…
zotseek-search-searchLabel = Suchen
zotseek-search-searchingMoment = Suche startet gleich…
zotseek-search-queryTooShort = Geben Sie mindestens 2 CJK-Zeichen oder 3 andere Zeichen ein
zotseek-search-failed = Suche fehlgeschlagen: { $error }
zotseek-search-noItemsMatchingAll = Keine Einträge gefunden, die alle Suchanfragen erfüllen
zotseek-search-matchBoth = — Treffer müssen beide Suchanfragen erfüllen
zotseek-search-matchAll = — Treffer müssen alle Suchanfragen erfüllen
zotseek-search-matchAny = — Treffer können eine beliebige Suchanfrage erfüllen

## Results table columns

zotseek-column-match = Treffer
zotseek-column-title = Titel
zotseek-column-authors = Autoren
zotseek-column-year = Jahr
zotseek-column-location = Position
zotseek-column-section = Abschnitt

## Source labels

zotseek-source-abstract = Abstract
zotseek-source-fulltext = Volltext
zotseek-source-title = Titel
zotseek-source-methods = Methoden
zotseek-source-results = Ergebnisse
zotseek-source-content = Inhalt
zotseek-source-note = Notiz
zotseek-search-hybrid-menuitem =
    .label = 🔗 Hybrid (empfohlen)
zotseek-search-semantic-menuitem =
    .label = 🧠 Nur semantisch
zotseek-search-keyword-menuitem =
    .label = 🔤 Nur Schlüsselwörter

## Similar documents dialog

zotseek-similar-title =
    .title = Ähnliche Dokumente finden
zotseek-similar-similarTo = Ähnlich zu:{ " " }
zotseek-similar-loading = Wird geladen…
zotseek-similar-openSelected =
    .label = Auswahl öffnen
zotseek-similar-close =
    .label = Schließen
zotseek-similar-initFailed = Initialisierung fehlgeschlagen: { $error }
zotseek-similar-noSource = Kein Quelldokument ausgewählt
zotseek-similar-finding = Ähnliche Dokumente werden gesucht…
zotseek-similar-loadingModel = KI-Modell wird geladen…
zotseek-similar-searching = Suche läuft…
zotseek-similar-noResults = Keine ähnlichen Dokumente gefunden
zotseek-similar-found = { $count } ähnliche Dokumente gefunden
zotseek-similar-searchFailed = Suche fehlgeschlagen: { $error }

## Indexing progress

zotseek-indexing-title = ZotSeek-Indizierung
zotseek-indexing-clearTitle = ZotSeek-Index wird gelöscht
zotseek-indexing-clearConfirmTitle = ZotSeek-Index löschen
zotseek-indexing-clearConfirmMsg = Dadurch werden alle gespeicherten Embeddings gelöscht. Sie müssen Ihre Bibliothek anschließend neu indizieren.

    Fortfahren?
zotseek-indexing-clearConfirmButton = Index löschen
zotseek-indexing-initStorage = Speicher wird initialisiert…
zotseek-indexing-deletingAll = Alle Embeddings werden gelöscht…
zotseek-indexing-clearedSuccess = Index erfolgreich gelöscht!
zotseek-indexing-clearedMsg = Index erfolgreich gelöscht.

    Sie können Ihre Bibliothek jetzt neu indizieren.
zotseek-indexing-rebuildTitle = ZotSeek-Index neu erstellen
zotseek-indexing-rebuildConfirmTitle = ZotSeek-Index neu erstellen
zotseek-indexing-rebuildConfirmMsg = Dadurch werden die Embeddings des aktuellen Modells gelöscht und dessen Index neu erstellt. Andere Modellindizes bleiben erhalten.
zotseek-indexing-rebuildConfirmButton = Index neu erstellen
zotseek-indexing-chunkStrategyRebuildRequired = ZotSeek hat erkannt, dass der Index des aktuellen Modells eine ältere Chunk-Strategie verwendet.
    Der vorhandene Index bleibt durchsuchbar, aber inkrementelle Hintergrundaktualisierungen sind pausiert, um eine Mischung alter und neuer Chunks zu vermeiden. Verwenden Sie in den Einstellungen „Index neu erstellen“, um den Index vollständig neu aufzubauen. Das Schließen dieses Hinweises startet keinen Neuaufbau und ändert den vorhandenen Index nicht.
    Je nach Bibliotheksgröße und Indexierungsstrategie kann der Neuaufbau zwischen mehreren zehn Minuten und mehreren Stunden dauern.
zotseek-indexing-rebuildingTitle = ZotSeek-Index wird neu erstellt
zotseek-indexing-clearingExisting = Vorhandener Index wird gelöscht…
zotseek-indexing-existingCleared = ✓ Index des aktuellen Modells gelöscht
zotseek-indexing-loading = Wird geladen…
zotseek-indexing-alreadyInProgress = Indizierung läuft bereits…
zotseek-indexing-selectItems = Bitte wählen Sie Einträge zum Indizieren aus.
zotseek-indexing-selectCollection = Bitte wählen Sie zuerst eine Sammlung aus.

    (Klicken Sie in der linken Seitenleiste auf eine Sammlung.)
zotseek-indexing-emptyCollection = Sammlung „{ $name }“ enthält keine zu indizierenden Einträge.
zotseek-indexing-emptyCollections = Die { $count } ausgewählten Sammlungen enthalten keine zu indizierenden Einträge.
zotseek-indexing-updateTitle = ZotSeek – Index prüfen und aktualisieren
zotseek-indexing-updateConfirmMsg = Index für { $scope } prüfen und aktualisieren? ZotSeek fügt fehlende Einträge hinzu, aktualisiert Einträge mit geänderten Metadaten, Notizen oder Indizierungseinstellungen, überspringt unveränderte Einträge und entfernt Einträge für aus Zotero gelöschte oder inzwischen ausgeschlossene Dokumente. Änderungen an den Indizierungseinstellungen können vorhandene Einträge mit den aktuellen Einstellungen neu berechnen.
zotseek-indexing-updateConfirmButton = Prüfen und aktualisieren
zotseek-indexing-confirmCancel = Abbrechen
zotseek-indexing-scopeUser = Ihre persönliche Bibliothek
zotseek-indexing-scopeAll = alle Ihre Bibliotheken (persönlich + Gruppen)

zotseek-indexing-configChangeTitle = ZotSeek – Indizierungseinstellungen geändert
zotseek-indexing-configChangeMessage = Die Indizierungseinstellungen in { $scope } haben sich geändert. Bereits indizierte Einträge betroffen: { $affected }; Embeddings neu zu berechnen: { $rebuildRequired }. Bei den übrigen muss nur der Konfigurationsdatensatz aktualisiert werden. Bevor Sie wählen, löscht ZotSeek keine Datensätze, aktualisiert keine Fingerabdrücke und schreibt keine Embeddings. Wie soll diese Prüfung beim Start fortfahren?
zotseek-indexing-configChangeUpdate = Index prüfen und aktualisieren
zotseek-indexing-configChangeRebuild = Index neu erstellen
zotseek-indexing-configChangeCancel = Abbrechen

# Auto-resume prompt shown at startup when a previous bulk-index run was interrupted.
zotseek-resume-title = ZotSeek – Indizierung fortsetzen
zotseek-resume-message = Ein vorheriger Indizierungslauf wurde unterbrochen. ZotSeek prüft alle { $count } Einträge in { $scope } erneut und setzt ausstehende oder fehlgeschlagene Aktualisierungen fort. Bereits aktuelle Einträge werden übersprungen. Wenn Sie abbrechen, wird die automatische Indexwartung bei diesem Start ebenfalls übersprungen. Jetzt fortsetzen?
zotseek-resume-confirm = Indizierung fortsetzen
zotseek-resume-scopeLibrary = Ihre Bibliotheken
zotseek-resume-scopeUserLibrary = Ihre persönliche Bibliothek
zotseek-resume-scopeCollection = die Sammlung „{ $name }“
zotseek-resume-scopeCollections = { $count } ausgewählte Sammlungen
zotseek-resume-scopeItems = der Bereich der ausgewählten Einträge
zotseek-indexing-noItemsSelected = Keine Einträge ausgewählt
zotseek-indexing-removedItems = { $count } Einträge aus dem Index entfernt
zotseek-indexing-notInIndex = Die ausgewählten Einträge waren nicht im Index
zotseek-indexing-removeFailed = Entfernen aus dem Index fehlgeschlagen
zotseek-indexing-mode = Indizierungsmodus: { $mode }
zotseek-indexing-checking = Bereits indizierte Einträge werden geprüft…
zotseek-indexing-skippedExcluded = ✓ { $count } ausgeschlossene Einträge übersprungen
zotseek-indexing-skippedIndexed = ✓ { $count } bereits indizierte Einträge übersprungen
zotseek-indexing-allIndexed = Alle Einträge sind bereits indiziert!
zotseek-indexing-allInIndex = ✓ { $count } Einträge bereits im Index
zotseek-indexing-nothingToIndex = Nichts zu indizieren — alle Einträge sind aktuell!
zotseek-indexing-loadingModel = KI-Modell wird geladen (Transformers.js)…
zotseek-indexing-modelLoaded = ✓ KI-Modell geladen
zotseek-indexing-batchExtracting = Stapel { $current }/{ $total }: Text wird extrahiert…
zotseek-indexing-batchEmbedding = Stapel { $current }/{ $total }: Embeddings werden erzeugt…
zotseek-indexing-batchEmbeddingChunks = Stapel { $current }/{ $total }: Chunks werden eingebettet
zotseek-indexing-chunksFailed = ⚠ { $count } Chunks übersprungen in: { $items }
zotseek-indexing-batchSaving = Stapel { $current }/{ $total }: Prüfpunkt wird gespeichert…
zotseek-indexing-checkpoint = ✓ Prüfpunkt { $current }/{ $total }: { $items } Einträge, { $chunks } Chunks gespeichert
zotseek-indexing-complete = Indizierung abgeschlossen!
zotseek-indexing-completeMode = ✓ Modus: { $mode }
zotseek-indexing-completePrevious = ✓ Bereits indiziert: { $count } Einträge
zotseek-indexing-completeNew = ✓ Neu indiziert: { $count } Einträge
zotseek-indexing-completeChunks = ✓ Chunks insgesamt: { $count }
zotseek-indexing-completeAvg = ✓ Ø Chunks/Eintrag: { $avg }
zotseek-indexing-completeDuration = ✓ Dauer: { $duration }
zotseek-indexing-completeNoContent = ⚠ Kein Inhalt: { $count } Einträge
zotseek-indexing-completeTruncated = ⚠ Unvollständiger Inhalt: Bei { $count } Einträgen wurde das Limit für maximale Chunks pro Dokument erreicht. Erhöhen Sie das Limit oder wechseln Sie in den Modus „Nur Abstract“, um den vollständigen Text zu indizieren.
zotseek-indexing-completeSuccess = Indizierung erfolgreich abgeschlossen!
zotseek-indexing-cancelled = Indizierung abgebrochen
zotseek-indexing-pauseAction = Indizierung pausieren
zotseek-indexing-pausingAction = Wird pausiert…
zotseek-indexing-pauseTooltip = Nach dem aktuellen sicheren Prüfpunkt anhalten und beim nächsten Start von Zotero fortsetzen
zotseek-indexing-paused = Indizierung pausiert. ZotSeek bietet beim nächsten Start von Zotero an, genau diesen Bereich fortzusetzen.
zotseek-indexing-failed = Indizierung fehlgeschlagen: { $error }
zotseek-indexing-progressTitle = ZotSeek
zotseek-indexing-progressItem = Indizierung: { $title }
zotseek-indexing-progressLoadingModel = Modell wird geladen…
zotseek-indexing-allExcluded = Alle Einträge sind von der Indizierung ausgeschlossen
zotseek-indexing-extracting = Wird extrahiert…
zotseek-indexing-noContent = ✗ Kein Inhalt gefunden
zotseek-indexing-embedding = Embeddings werden erzeugt { $current }/{ $total }…
zotseek-indexing-saving = Wird gespeichert…
zotseek-indexing-chunksIndexed = ✓ { $count } Chunks indiziert
zotseek-indexing-chunksIndexedWithFailed = ✓ { $count } Chunks indiziert ({ $failed } fehlgeschlagen)

## Export to Collection (issue #28)

# Keys referenced via data-l10n-id on XUL elements use the .attr = value form
# so Fluent sets the named attribute instead of wiping the element's children.
# Keys consumed via formatValueSync / getString() from JS stay as plain key = text.

zotseek-export-saveAsCollection =
    .label = Ergebnisse als Sammlung speichern
zotseek-export-addToCollectionNew =
    .label = Neue Sammlung…
zotseek-export-dialogTitle =
    .title = Ergebnisse als Sammlung speichern
zotseek-export-nameLabel =
    .value = Sammlungsname:
zotseek-export-libraryLabel =
    .value = Bibliothek:
zotseek-export-ok =
    .label = Speichern
zotseek-export-cancel =
    .label = Abbrechen
zotseek-export-itemcountSimple = { $count } Einträge → { $destination }
zotseek-export-itemcountFiltered = { $kept } von { $total } Einträgen → { $destination } ({ $reasons })
zotseek-export-reasonOtherLibrary = { $count } in anderen Bibliotheken
zotseek-export-reasonDeleted = { $count } gelöscht
zotseek-export-itemcountEmpty = Keine Einträge hinzuzufügen.
zotseek-export-statusExported = { $count } Einträge zu „{ $name }“ hinzugefügt.
zotseek-export-statusExportedSkipped = { $count } Einträge zu „{ $name }“ hinzugefügt, { $skipped } übersprungen.
zotseek-export-statusFailed = Speichern der Ergebnisse als Sammlung fehlgeschlagen.

## Preference group headers

zotseek-prefs-group-status = Status
zotseek-prefs-group-models = Modelle
zotseek-prefs-group-indexing = Indizierung
zotseek-prefs-group-search = Suche
zotseek-prefs-group-maintenance = Integrationen und Wartung
zotseek-prefs-exclusions = Ausschlüsse

## Model section headers (fallbacks existed in XHTML only; adds the missing ftl entries)

zotseek-pref-embeddingModelTitle = Embedding-Modell
zotseek-pref-manageModelsTitle = Installierte Modelle verwalten
zotseek-indexing-cloudRebuildConfirmTitle = Rebuild Cloud index?
zotseek-indexing-cloudRebuildConfirmMsg = About { $count } papers in { $scope } will be sent to the configured Cloud provider and may incur provider charges. Existing complete indexes are kept until each paper is replaced successfully. Continue?
zotseek-indexing-cloudStrategyRebuildConfirmMsg = The current Cloud index uses an older chunk strategy. Its existing embeddings must be deleted before about { $count } papers in { $scope } are sent again, which may incur provider charges. Other model indexes are kept. Continue?

## Einstellungen für Literaturzusammenfassungen

zotseek-prefs-group-brief = Literaturzusammenfassungen (Experimentell)
zotseek-pref-brief-title = Literaturzusammenfassungen
zotseek-pref-brief-enabled =
    .label = Literaturzusammenfassungen aktivieren
zotseek-pref-brief-enabled-desc = Auf Wunsch eine experimentelle Literaturzusammenfassung aus dem PDF einer Arbeit erstellen.
zotseek-pref-brief-provider = Gemeinsamer Anbieter
zotseek-pref-brief-open-cloud-settings = Zugangsdaten konfigurieren
zotseek-pref-brief-model = Generierungsmodell
zotseek-pref-brief-test = Verbindung testen
zotseek-pref-brief-create-prompts = Meine Zusammenfassungs-Prompts erstellen…
zotseek-pref-brief-create-prompts-desc = Zusammengehörige Prompts für Standard-, Review- und Theoriearbeiten erstellen.
zotseek-pref-brief-standard-prompt = Prompt für Standardarbeiten
zotseek-pref-brief-review-prompt = Prompt für Reviews/Theoriearbeiten
zotseek-pref-brief-advanced = Erweitert
zotseek-pref-brief-import-standard = Standard-Prompt importieren…
zotseek-pref-brief-import-review = Review-Prompt importieren…
zotseek-pref-brief-reset-prompts = Integrierte Prompts wiederherstellen
zotseek-pref-brief-max-input = Maximale Eingabetoken
zotseek-pref-brief-max-input-desc = Eingabebudget des Generierungsmodells.
zotseek-pref-brief-max-output = Maximale Ausgabetoken
zotseek-pref-brief-max-output-desc = Reserviertes Ausgabebudget für die Generierung.
zotseek-pref-brief-thinking-enabled =
    .label = Erweitertes Schlussfolgern aktivieren

## Assistent für Literaturzusammenfassungs-Prompts

zotseek-brief-prompt-wizard-title = Prompts für Literaturzusammenfassungen anpassen
zotseek-brief-prompt-wizard-notice = Beschreiben Sie Ihre Leseschwerpunkte und Präferenzen. ZotSeek erstellt zusammengehörige Prompts für Standardarbeiten sowie Review- oder Theoriearbeiten.
zotseek-brief-prompt-wizard-domain-label = Thema oder Forschungsgebiet
zotseek-brief-prompt-wizard-language-label = Ausgabesprache
zotseek-brief-prompt-wizard-habits-label = Lese- und Analysepräferenzen
zotseek-brief-prompt-wizard-status-idle = Bereit zum Erstellen der Prompts.
zotseek-brief-prompt-wizard-location-label = Speicherort der Prompts
zotseek-brief-prompt-wizard-open-location = Prompt-Ordner öffnen
zotseek-brief-prompt-wizard-cancel = Abbrechen
zotseek-brief-prompt-wizard-generate = Prompts erstellen

## Status und Einwilligung für Literaturzusammenfassungen

zotseek-pref-brief-prompt-bundled = Integriert ({ $file })
zotseek-pref-brief-prompt-time-unknown = Aktualisierungszeit unbekannt
zotseek-pref-brief-prompt-custom = Benutzerdefiniert ({ $file }), aktualisiert am { $updated }
zotseek-pref-brief-provider-summary = Anbieter: { $provider } · Zugangsdaten: { $credential }
zotseek-pref-brief-key-configured = API-Schlüssel konfiguriert
zotseek-pref-brief-key-missing = API-Schlüssel nicht konfiguriert
zotseek-pref-brief-unsupported-provider = Literaturzusammenfassungen unterstützen derzeit nur Alibaba Bailian.
zotseek-pref-brief-key-required = Konfigurieren Sie vor der Nutzung einen Alibaba-Bailian-API-Schlüssel.
zotseek-pref-brief-connection-verified = Verbindung bestätigt
zotseek-pref-brief-connection-not-verified = Verbindung nicht bestätigt
zotseek-pref-brief-invalid-settings = Ungültige Einstellungen für die Zusammenfassung: { $error }
zotseek-pref-brief-status-failed = Erstellung der Zusammenfassung fehlgeschlagen: { $error }
zotseek-pref-brief-settings-saved = Einstellungen für Zusammenfassungen gespeichert.
zotseek-pref-brief-cancelling = Erstellung der Zusammenfassung wird abgebrochen…
zotseek-pref-brief-consent-title = Erstellung einer Literaturzusammenfassung erlauben?
zotseek-pref-brief-consent-message = Für eine Zusammenfassung sendet ZotSeek den Titel, das Abstract und den Text der PDF-Seiten an Alibaba Bailian. Beim Erstellen von Prompt-Vorlagen werden die beiden Vorlagen und Ihre Formulareingaben gesendet. Für Ihr BYOK-Konto können Kosten anfallen; auch ein Verbindungstest kann geringe Kosten verursachen. Fortfahren?
zotseek-pref-brief-testing = Verbindung wird getestet…
zotseek-pref-brief-test-failed = Verbindungstest fehlgeschlagen: { $error }
zotseek-pref-brief-connection-required = Bestätigen Sie die Verbindung, bevor Sie eine Zusammenfassung erstellen.
zotseek-pref-brief-import-failed = Prompt konnte nicht importiert werden: { $error }
zotseek-pref-brief-reset-title = Integrierte Prompts wiederherstellen?
zotseek-pref-brief-reset-message = Ihre benutzerdefinierten Prompts werden durch die integrierten Prompts ersetzt. Fortfahren?
zotseek-pref-brief-reset-done = Integrierte Prompts wiederhergestellt.

## Literature brief menu and runtime status

zotseek-menu-generateBrief = Literaturzusammenfassung erstellen
zotseek-brief-disabled = Literaturzusammenfassungen sind deaktiviert.
zotseek-brief-busy = Eine andere Aufgabe für eine Literaturzusammenfassung läuft bereits.
zotseek-brief-connection-required = Bestätigen Sie die Verbindung zur Literaturzusammenfassung vor der Erstellung.
zotseek-brief-start-failed = Erstellung der Literaturzusammenfassung konnte nicht gestartet werden: { $error }
zotseek-brief-cancelling = Erstellung der Literaturzusammenfassung wird abgebrochen…
zotseek-brief-cancel-task = Aufgabe abbrechen
zotseek-brief-cancel-tooltip = Diese Aufgabe für eine Literaturzusammenfassung abbrechen
zotseek-brief-progress-title = Erstellung der Literaturzusammenfassung
zotseek-brief-progress-summary = { $completed } von { $total } abgeschlossen · Erfolgreich: { $success } · Fehlgeschlagen: { $failed } · Übersprungen: { $skipped } · Abgebrochen: { $cancelled }
zotseek-brief-progress-active = Wird verarbeitet: { $title }
zotseek-brief-progress-latest = { $title }: { $status }
zotseek-brief-progress-latest-with-reason = { $title }: { $status } ({ $reason })
zotseek-brief-progress-complete = Aufgabe für Literaturzusammenfassung abgeschlossen.
zotseek-brief-summary-title = Ergebnisse der Literaturzusammenfassung
zotseek-brief-summary-message = Erfolgreich: { $success } · Fehlgeschlagen: { $failed } · Übersprungen: { $skipped } · Abgebrochen: { $cancelled }
zotseek-brief-status-success = Erfolgreich
zotseek-brief-status-failed = Fehlgeschlagen
zotseek-brief-status-skipped = Übersprungen
zotseek-brief-status-cancelled = Abgebrochen
zotseek-brief-skip-reason-insufficient-text = kein extrahierbarer PDF-Text
zotseek-brief-skip-reason-existing-note = hat bereits eine untergeordnete Notiz
zotseek-brief-skip-reason-no-main-pdf = kein Haupt-PDF
zotseek-brief-select-one = Wählen Sie eine reguläre Arbeit oder einen PDF-Anhang aus.
zotseek-brief-invalid-selection = Das ausgewählte Element ist keine zulässige Arbeit oder kein zulässiger PDF-Anhang.
zotseek-brief-existing-note-title = Vorhandene Zusammenfassungsnotiz
zotseek-brief-existing-note-message = Diese Arbeit besitzt bereits eine untergeordnete Notiz. Eine weitere Literaturzusammenfassungsnotiz erstellen?
zotseek-brief-select-collection = Wählen Sie zuerst eine Sammlung aus.
zotseek-brief-no-eligible = In der ausgewählten Sammlung wurden keine geeigneten Arbeiten gefunden.
zotseek-brief-collection-confirm-title = Literaturzusammenfassungen für die Sammlung erstellen?
zotseek-brief-collection-confirm-message = Literaturzusammenfassungen für { $count } Arbeiten erstellen? Dabei können API-Kosten entstehen.

## Literature brief prompt wizard runtime status

zotseek-brief-wizard-unavailable = Start nicht möglich: Der Dienst für Literaturzusammenfassungen ist nicht verfügbar.
zotseek-brief-wizard-generating = Zusammengehörige Prompt-Dateien werden erstellt…
zotseek-brief-wizard-required = Geben Sie sowohl ein Forschungsgebiet als auch eine Ausgabesprache an.
zotseek-brief-wizard-invalid-result = Der Dienst für Literaturzusammenfassungen lieferte kein verwendbares Ergebnis.
zotseek-brief-wizard-success = Prompt-Dateien erfolgreich erstellt.
zotseek-brief-wizard-success-no-path = Prompt-Dateien erfolgreich erstellt; kein Speicherort wurde zurückgegeben.
zotseek-brief-wizard-downloaded-not-enabled = Die Prompt-Dateien wurden heruntergeladen, das verwaltete Paar konnte jedoch nicht aktiviert werden. Sie können es erneut versuchen oder die Dateien manuell importieren.
zotseek-brief-wizard-canceled = Erstellung abgebrochen.
zotseek-brief-wizard-canceling = Erstellung wird abgebrochen…
zotseek-brief-wizard-failed = Erstellung fehlgeschlagen. Keine Prompt-Dateien wurden aktiviert.
zotseek-brief-wizard-open-failed = Speicherort der Prompt-Dateien konnte nicht geöffnet werden.
zotseek-brief-wizard-init-failed = Assistent für Prompt-Anpassung konnte nicht gestartet werden.

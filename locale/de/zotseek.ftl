# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

## Context menu items

zotseek-menu-findSimilar = Ähnliche Dokumente finden
zotseek-menu-openZotSeek = ZotSeek öffnen…
zotseek-menu-indexSelected = Ausgewählte Einträge prüfen und aktualisieren
zotseek-menu-indexCollection = Aktuelle Sammlung prüfen und aktualisieren
zotseek-menu-updateLibrary = Index prüfen und aktualisieren
zotseek-menu-removeFromIndex = Aus ZotSeek-Index entfernen
zotseek-menu-findRelated = Verwandte Dokumente finden

## Toolbar

zotseek-toolbar-openZotSeek = ZotSeek öffnen
zotseek-toolbar-findSimilar = Ähnliche Dokumente finden

## Preference pane

zotseek-pref-title = ZotSeek
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
zotseek-pref-abstractSpeed = Schnell • ca. 1 Chunk pro Dokument
zotseek-pref-abstractDesc = Indiziert Titel und Abstract. Gut, um Dokumente nach Thema zu finden.
zotseek-pref-notes = Metadaten + Notizen
zotseek-pref-notesMenu =
    .label = Metadaten + Notizen (keine PDF-Verarbeitung)
zotseek-pref-notesSpeed = Fokussiert • keine PDF-Verarbeitung
zotseek-pref-notesDesc = Indiziert Titel, Abstract, Schlagwörter und untergeordnete Notizen.
zotseek-pref-fullPaper = Vollständiges Dokument
zotseek-pref-fullPaperMenu =
    .label = Vollständiges Dokument (gründlicher)
zotseek-pref-fullSpeed = Gründlich • Notizen + ca. 1–2 Chunks pro PDF-Seite
zotseek-pref-fullDesc = Indiziert Titel, Abstract, Schlagwörter, untergeordnete Notizen und den vollständigen PDF-Inhalt mit Seitenzahlen.
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
zotseek-pref-advancedSettings = Erweiterte Einstellungen
zotseek-pref-maxTokens = Maximale Tokens pro Chunk
zotseek-pref-maxTokensDesc = Optionale Überschreibung; die Richtlinie des aktiven Modells legt das endgültige Limit fest
zotseek-pref-modelInputPolicy = Limit: { $limit } · Empfohlen: { $recommended } · Effektiv: { $effective } · Präfix: { $prefix }
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
zotseek-pref-serverConfigTitle = Erweitertes Servermodell
zotseek-pref-serverConfigDesc = Konfigurieren Sie den festen Server-Modellplatz in der JSON-Profilvorlage. ZotSeek prüft ihn beim Start; bearbeiten Sie die Datei und starten Sie Zotero neu, um Änderungen anzuwenden.
zotseek-pref-serverConfigPath = Vorlage:
zotseek-pref-serverConfigNotLoaded = Die Vorlage wurde noch nicht geladen. Starten Sie Zotero neu.
zotseek-pref-serverConfigLoaded = Server ({ $model }) ist konfiguriert. Bearbeiten Sie die Datei und starten Sie Zotero neu, um Änderungen anzuwenden.
zotseek-pref-serverConfigNone = Server (NONE): Kein Servermodell konfiguriert. Wählen Sie „Server“ im Modellmenü, um Einrichtungshinweise anzuzeigen.
zotseek-pref-serverConfigErrors = Server (UNKNOWN): { $errors } Konfigurationsfehler. Prüfen Sie Modell-ID, Loopback-Service-URL, Vektordimensionen, Tokenbudgets sowie Query-/Dokumentpräfixe in der Vorlage.
zotseek-pref-serverModelIncomplete = Die Informationen zum Servermodell sind unvollständig. Konfigurieren Sie die JSON-Vorlage und starten Sie Zotero neu.
zotseek-serverConfigRequiredTitle = Konfiguration des Servermodells erforderlich
zotseek-serverConfigRequiredMessage = Server ({ $state }) ist ausgewählt, aber die Informationen zum Modell sind unvollständig. ZotSeek behält diese Auswahl bei, kann jedoch noch nicht indizieren oder semantisch suchen.

    Bearbeiten: { $path }

    Starten Sie Zotero nach dem Speichern der Datei neu.

    { $guidance }
zotseek-serverConfigMissingEntry = Setzen Sie das Feld „model“ der Vorlage auf ein vollständiges Servermodellobjekt.
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
zotseek-pref-excludeBooksDesc = Bücher werden nicht indiziert. Vorhandene ZotSeek-Indizes für Bücher werden bei der nächsten Indexprüfung entfernt.
zotseek-pref-excludeTag = Schlagwort ausschließen
zotseek-pref-excludeTagDesc = Einträge mit diesem Schlagwort werden nicht indiziert. Vorhandene ZotSeek-Indizes für passende Einträge werden bei der nächsten Indexprüfung entfernt. Leer lassen, um die Funktion zu deaktivieren.
zotseek-pref-actions = Aktionen
zotseek-pref-maintenanceRepair = Wartung und Reparatur
zotseek-pref-updateIndex =
    .label = Index prüfen und aktualisieren
zotseek-pref-recommended = ✓ Empfohlen
zotseek-pref-updateIndexDesc = Fügt fehlende Einträge hinzu, aktualisiert Einträge mit geänderten Metadaten, Notizen oder Indizierungseinstellungen, überspringt unveränderte Einträge und entfernt Einträge für aus Zotero gelöschte oder inzwischen ausgeschlossene Dokumente. Änderungen an den Indizierungseinstellungen können vorhandene Einträge neu berechnen.
zotseek-pref-rebuildIndex =
    .label = Index neu erstellen
zotseek-pref-rebuildIndexDesc = Löscht den Index und indiziert alle Einträge mit den aktuellen Einstellungen neu. Nach Änderung des Indizierungsmodus oder der Chunk-Strategie oder für eine vollständige Neuindizierung verwenden.
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
    .placeholder = Suchanfrage eingeben (Suche startet während der Eingabe automatisch)…
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
zotseek-indexing-rebuildConfirmMsg = Dadurch werden alle gespeicherten Embeddings gelöscht und der Index mit den aktuellen Einstellungen neu erstellt.
zotseek-indexing-rebuildConfirmButton = Index neu erstellen
zotseek-indexing-chunkStrategyRebuildRequired = ZotSeek hat erkannt, dass der Index des aktuellen Modells eine ältere Chunk-Strategie verwendet.
    Der vorhandene Index bleibt durchsuchbar, aber inkrementelle Hintergrundaktualisierungen sind pausiert, um eine Mischung alter und neuer Chunks zu vermeiden. Verwenden Sie in den Einstellungen „Index neu erstellen“, um den Index vollständig neu aufzubauen. Das Schließen dieses Hinweises startet keinen Neuaufbau und ändert den vorhandenen Index nicht.
    Je nach Bibliotheksgröße und Indexierungsstrategie kann der Neuaufbau zwischen mehreren zehn Minuten und mehreren Stunden dauern.
zotseek-indexing-rebuildingTitle = ZotSeek-Index wird neu erstellt
zotseek-indexing-clearingExisting = Vorhandener Index wird gelöscht…
zotseek-indexing-existingCleared = ✓ Vorhandener Index gelöscht
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

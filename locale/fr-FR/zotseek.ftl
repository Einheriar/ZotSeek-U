# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

## Context menu items

zotseek-menu-findSimilar = Trouver des documents similaires
zotseek-menu-openZotSeek = Ouvrir ZotSeek…
zotseek-menu-indexSelected = Vérifier et mettre à jour les éléments sélectionnés
zotseek-menu-indexCollection = Vérifier et mettre à jour la collection actuelle
zotseek-menu-updateLibrary = Vérifier et mettre à jour l’index
zotseek-menu-removeFromIndex = Retirer de l’index ZotSeek
zotseek-menu-findRelated = Trouver des documents associés

## Toolbar

zotseek-toolbar-openZotSeek = Ouvrir ZotSeek
zotseek-toolbar-findSimilar = Trouver des documents similaires

## Preference pane

zotseek-pref-title = ZotSeek
zotseek-pref-indexStatistics = Statistiques de l’index
zotseek-pref-papersIndexed = Documents indexés
zotseek-pref-totalChunks = Segments totaux
zotseek-pref-storageUsed = Espace utilisé
zotseek-pref-model = Modèle :
zotseek-pref-avg = Moy. :
zotseek-pref-chunksPerPaper = segments/document
zotseek-pref-lastIndexed = Dernière indexation :
zotseek-pref-refreshStats =
    .label = Actualiser les statistiques
zotseek-pref-compactDatabase =
    .label = Compacter la base de données
zotseek-pref-autoCompact =
    .label = Compacter automatiquement lorsque Zotero est inactif
zotseek-pref-autoCompactDesc = Nécessite Zotero 10 ou une version ultérieure. S’exécute uniquement lorsqu’un espace significatif peut être récupéré et qu’aucune indexation n’est en cours.
zotseek-pref-indexModeMismatch = Incompatibilité du mode d’indexation
zotseek-pref-indexModeMismatchDesc = Votre index a été créé avec le mode { $indexedMode }, mais votre réglage actuel est { $currentMode }.
zotseek-pref-indexModeMismatchAction = Cliquez sur « Vérifier et mettre à jour l’index » ci-dessous pour appliquer le nouveau mode. ZotSeek réutilise les vecteurs compatibles et ne calcule que ceux qui manquent ; « Reconstruire l’index » reste disponible.
zotseek-pref-indexingMode = Mode d’indexation
zotseek-pref-abstractOnly = Résumés uniquement
zotseek-pref-abstractOnlyMenu =
    .label = Résumés uniquement (plus rapide)
zotseek-pref-abstractSpeed = Rapide • environ 1 segment par document
zotseek-pref-abstractDesc = Indexe le titre et le résumé. Idéal pour trouver des documents par sujet.
zotseek-pref-notes = Métadonnées + notes
zotseek-pref-notesMenu =
    .label = Métadonnées + notes (sans traitement des PDF)
zotseek-pref-notesSpeed = Ciblé • aucun traitement des PDF
zotseek-pref-notesDesc = Indexe le titre, le résumé, les étiquettes et les notes enfants.
zotseek-pref-fullPaper = Document complet
zotseek-pref-fullPaperMenu =
    .label = Document complet (plus approfondi)
zotseek-pref-fullSpeed = Approfondi • notes + environ 1 à 2 segments par page PDF
zotseek-pref-fullDesc = Indexe le titre, le résumé, les étiquettes, les notes enfants et l’intégralité du contenu PDF avec les numéros de page.
zotseek-pref-mcpServer = Accès des agents IA
zotseek-pref-mcpServerLabel =
    .label = Autoriser les agents IA à rechercher et lire votre bibliothèque (serveur MCP local)
zotseek-pref-mcpServerDesc = Permet aux clients MCP tels que Claude Code d’effectuer des recherches en lecture seule et de lire les métadonnées, les notes et le contenu PDF des documents. Tout reste sur cet ordinateur (localhost uniquement).
zotseek-pref-mcpServerUrl = Se connecter avec :
zotseek-pref-mcpServerWarning = Le serveur HTTP local de Zotero est désactivé. Activez « Autoriser les autres applications de cet ordinateur à communiquer avec Zotero » dans Paramètres → Avancé.
zotseek-pref-autoIndexing = Maintenance automatique
zotseek-pref-autoIndexLabel =
    .label = Vérifier et mettre à jour l’index au démarrage de Zotero
zotseek-pref-autoIndexDesc = Vérifie la portée de bibliothèque sélectionnée au démarrage, met à jour les éléments ajoutés ou modifiés, retire les enregistrements des éléments supprimés de Zotero ou désormais exclus par les règles d’indexation et affiche la progression dans le coin inférieur droit.
zotseek-pref-checkNowResult = { $checked } éléments vérifiés ; { $changed } mis à jour ; { $removed } enregistrements d’index retirés.
zotseek-indexing-noteUpdate = Mise à jour des notes — éléments concernés : { $count }…
zotseek-indexing-noteUpdateComplete = Notes mises à jour — éléments concernés : { $count }
zotseek-pref-indexScope = Portée de l’index
zotseek-pref-indexScopeUser =
    .label = Ma bibliothèque
zotseek-pref-indexScopeAll =
    .label = Toutes les bibliothèques
zotseek-pref-indexScopeDesc = Cette portée s’applique à l’action manuelle « Vérifier et mettre à jour l’index » et à la maintenance automatique au démarrage.
zotseek-pref-searchSettings = Paramètres de recherche
zotseek-pref-resultsToShow = Résultats à afficher
zotseek-pref-resultsToShowDesc = Nombre de résultats à afficher (5–100)
zotseek-pref-minSimilarity = Similarité minimale
zotseek-pref-minSimilarityDesc = % — Filtrer les résultats de faible qualité (0–100)
zotseek-pref-advancedSettings = Paramètres avancés
zotseek-pref-maxTokens = Nombre maximal de tokens par segment
zotseek-pref-maxTokensDesc = Remplacement facultatif ; la politique du modèle actif applique la limite finale
zotseek-pref-modelInputPolicy = Limite : { $limit } · Recommandé : { $recommended } · Effectif : { $effective } · Préfixe : { $prefix }
zotseek-pref-modelInputUnknown = géré par le serveur
zotseek-pref-modelInputPrefixRequired = requis
zotseek-pref-modelInputPrefixNone = aucun
zotseek-pref-modelStatusBundled = Intégré
zotseek-pref-modelStatusInstalled = Installé
zotseek-pref-modelStatusDownload = Téléchargement requis · environ { $size } Mo
zotseek-pref-modelMultilingual = multilingue
zotseek-modelDownloadChoiceTitle = Installer le modèle d’embeddings
zotseek-modelDownloadChoiceMessage = { $model } n’est pas installé. Le téléchargement automatique récupère environ { $size } Mo une seule fois depuis huggingface.co et les stocke sur cet ordinateur. ZotSeek n’envoie pas votre bibliothèque Zotero à Hugging Face.
zotseek-modelDownloadAutomatic = Téléchargement automatique (recommandé)
zotseek-modelDownloadManual = Téléchargement manuel
zotseek-modelDownloadCancel = Annuler
zotseek-modelDownloadManualTitle = Téléchargement manuel du modèle
zotseek-modelDownloadManualMessage = Téléchargez les fichiers requis depuis la page officielle du modèle et enregistrez-les dans le dossier d’installation en conservant les sous-dossiers indiqués.

    Modèle : { $model }
    Page officielle : { $page }

    Fichiers requis :
    { $files }

    Dossier d’installation :
    { $path }
zotseek-modelDownloadOpenPage = Ouvrir la page du modèle
zotseek-modelDownloadOpenLocation = Ouvrir le dossier d’installation
zotseek-modelDownloadClose = Fermer
zotseek-modelDownloadStarting = Téléchargement de { $model }…
zotseek-modelDownloadProgress = Téléchargement de { $model } : fichier { $done } sur { $total }
zotseek-modelDownloadFailed = Opération sur le modèle échouée : { $error }
zotseek-modelDownloadRevealFailedTitle = Impossible d’ouvrir le dossier d’installation
zotseek-modelDownloadRevealFailedMessage = ZotSeek n’a pas pu ouvrir le dossier d’installation du modèle. Vous pouvez copier ce chemin et l’ouvrir manuellement :

    { $path }
zotseek-pref-resetMaxTokens =
    .label = Utiliser la valeur recommandée
zotseek-pref-serverConfigTitle = Modèle serveur avancé
zotseek-pref-serverConfigDesc = Configurez l’emplacement fixe du modèle serveur dans le modèle JSON du profil. ZotSeek le valide au démarrage ; modifiez le fichier et redémarrez Zotero pour appliquer les changements.
zotseek-pref-serverConfigPath = Modèle :
zotseek-pref-serverConfigNotLoaded = Le modèle n’a pas encore été chargé. Redémarrez Zotero.
zotseek-pref-serverConfigLoaded = Le serveur ({ $model }) est configuré. Modifiez le fichier et redémarrez Zotero pour appliquer les changements.
zotseek-pref-serverConfigNone = Serveur (NONE) : aucun modèle serveur n’est configuré. Sélectionnez Serveur dans le menu des modèles pour afficher les instructions de configuration.
zotseek-pref-serverConfigErrors = Serveur (UNKNOWN) — nombre d’erreurs de configuration : { $errors }. Vérifiez l’identifiant du modèle, l’URL du service loopback, les dimensions des vecteurs, les budgets de tokens et les préfixes de requête/document dans le modèle.
zotseek-pref-serverModelIncomplete = Les informations du modèle serveur sont incomplètes. Configurez le modèle JSON et redémarrez Zotero.
zotseek-serverConfigRequiredTitle = Configuration du modèle serveur requise
zotseek-serverConfigRequiredMessage = Le serveur ({ $state }) est sélectionné, mais les informations de son modèle sont incomplètes. ZotSeek conservera cette sélection, mais ne peut pas encore indexer ni effectuer de recherches sémantiques.

    Modifier : { $path }

    Redémarrez Zotero après avoir enregistré le fichier.

    { $guidance }
zotseek-serverConfigMissingEntry = Définissez le champ « model » du modèle sur un objet complet de modèle serveur.
zotseek-serverConfigInvalidEntry = Le modèle comporte des erreurs de configuration (total : { $errors }). Utilisez l’exemple du modèle pour compléter l’identifiant du modèle, l’URL du service loopback, les dimensions des vecteurs, les budgets de tokens et les préfixes de requête/document.
zotseek-serverConfigOpenLocation = Ouvrir l’emplacement du fichier
    .label = Ouvrir l’emplacement du fichier
zotseek-serverConfigClose = Fermer
zotseek-serverConfigRevealFailedTitle = Impossible d’ouvrir l’emplacement du fichier
zotseek-serverConfigRevealFailedMessage = ZotSeek n’a pas pu ouvrir l’emplacement du fichier de configuration. Vous pouvez copier ce chemin et l’ouvrir manuellement :

    { $path }
zotseek-pref-maxChunks = Nombre maximal de segments par document
zotseek-pref-maxChunksDesc = Limite pour les documents longs (1–200)
zotseek-pref-excludeBooks =
    .label = Exclure les livres de l’indexation
zotseek-pref-excludeBooksDesc = Les livres ne seront pas indexés. Les index ZotSeek existants des livres seront supprimés lors de la prochaine vérification de l’index.
zotseek-pref-excludeTag = Étiquette à exclure
zotseek-pref-excludeTagDesc = Les éléments portant cette étiquette ne seront pas indexés. Les index ZotSeek existants des éléments correspondants seront supprimés lors de la prochaine vérification de l’index. Laissez vide pour désactiver.
zotseek-pref-actions = Actions
zotseek-pref-maintenanceRepair = Maintenance et réparation
zotseek-pref-updateIndex =
    .label = Vérifier et mettre à jour l’index
zotseek-pref-recommended = ✓ Recommandé
zotseek-pref-updateIndexDesc = Ajoute les éléments manquants, met à jour ceux dont les métadonnées, notes ou paramètres d’indexation ont changé, ignore ceux qui n’ont pas changé et retire les enregistrements des éléments supprimés de Zotero ou désormais exclus par les règles d’indexation. Les changements de paramètres d’indexation peuvent recalculer les éléments existants.
zotseek-pref-rebuildIndex =
    .label = Reconstruire l’index
zotseek-pref-rebuildIndexDesc = Efface l’index et réindexe tous les éléments avec les paramètres actuels. À utiliser après avoir modifié le mode d’indexation ou la stratégie de segmentation, ou lorsqu’une réindexation complète est nécessaire.
zotseek-pref-clearIndex =
    .label = Effacer l’index
zotseek-pref-dangerZone = Zone dangereuse
zotseek-pref-destructive = ⚠ Irréversible
zotseek-pref-clearIndexDesc = Supprime tous les embeddings de la base de données. Vous devrez ensuite réindexer votre bibliothèque.
zotseek-pref-about = À propos
zotseek-pref-githubRepo =
    .value = Dépôt GitHub
zotseek-pref-modelLine = Modèle : { $model }
zotseek-pref-avgLine = Moy. { $avg } segments/document
zotseek-pref-lastIndexedLine = Dernière indexation : { $date }
zotseek-pref-compacted = Base de données compactée
zotseek-pref-compactionFailed = Échec du compactage
zotseek-pref-healthHeader = État de la base de données
zotseek-pref-healthOrphans = Embeddings non résolus : { $count }
zotseek-pref-healthOrphansDesc = Embeddings dont les éléments sources n’ont pas pu être associés à votre bibliothèque actuelle. Les purger libère de l’espace, mais cette action est irréversible.
zotseek-pref-healthPurgeOrphans =
    .label = Purger les éléments orphelins
zotseek-pref-healthPurgeConfirmTitle = Purger les embeddings non résolus
zotseek-pref-healthPurgeConfirmMsg = Cette action supprimera définitivement les embeddings des éléments absents de votre bibliothèque Zotero actuelle. Continuer ?
zotseek-pref-healthPurgeDoneTitle = Éléments orphelins purgés
zotseek-pref-healthPurgeDoneMsg = { $count } entrées non résolues supprimées.
zotseek-pref-healthPurgeFailedTitle = Échec de la purge

## Search dialog

zotseek-search-search =
    .value = Rechercher :
zotseek-search-placeholder =
    .placeholder = Saisissez votre requête (recherche automatique pendant la saisie)…
zotseek-search-addQuery =
    .label = +
    .tooltiptext = Ajouter une requête pour une combinaison ET/OU
zotseek-search-searchBtn =
    .label = Rechercher
zotseek-search-and =
    .label = ET
zotseek-search-or =
    .label = OU
zotseek-search-using =
    .value = avec
zotseek-search-minimum =
    .label = Minimum
zotseek-search-product =
    .label = Produit
zotseek-search-average =
    .label = Moyenne
zotseek-search-andDesc =
    .value = — les résultats doivent correspondre aux deux requêtes
zotseek-search-query2 =
    .value = Requête 2 :
zotseek-search-query3 =
    .value = Requête 3 :
zotseek-search-query4 =
    .value = Requête 4 :
zotseek-search-enterQuery = Saisissez la requête { $n }…
zotseek-search-removeQuery =
    .label = ✕
    .tooltiptext = Supprimer cette requête
zotseek-search-mode =
    .value = Mode :
zotseek-search-modeHybrid =
    .label = 🔗 Hybride (recommandé)
zotseek-search-modeSemantic =
    .label = 🧠 Sémantique uniquement
zotseek-search-modeKeyword =
    .label = 🔤 Mots-clés uniquement
zotseek-search-modeDesc =
    .value = Type de correspondance : 🔗 les deux recherches · 🧠 correspondance IA · 🔤 correspondance par mots-clés
zotseek-search-results =
    .value = Résultats :
zotseek-search-bySection = Par section
zotseek-search-byLocation = Par emplacement (page et paragraphe exacts)
zotseek-search-settings =
    .label = ⚙ Paramètres
    .tooltiptext = Ouvrir les préférences ZotSeek
zotseek-search-openSelected =
    .label = Ouvrir la sélection
zotseek-search-close =
    .label = Fermer
zotseek-search-initializing = Initialisation de la recherche…
zotseek-search-hybrid = Hybride
zotseek-search-semantic = Sémantique
zotseek-search-keyword = Mot-clé
zotseek-search-loadingModel = Chargement du modèle IA (le premier chargement peut prendre un moment)…
zotseek-search-finding = Recherche { $mode } : recherche des éléments…
zotseek-search-findingMulti = Recherche { $mode } ({ $op }) : recherche des éléments…
zotseek-search-noItemsFound = Aucun élément trouvé
zotseek-search-showInLibrary = Afficher dans la bibliothèque
zotseek-search-showItemsInLibrary = Afficher { $count } éléments dans la bibliothèque
zotseek-search-addToCollection = Ajouter à la collection
zotseek-search-noCollections = Aucune collection
zotseek-search-moreCollections = … et { $count } autres
zotseek-search-foundItems = { $count } éléments trouvés
zotseek-search-foundItemsFromMatches = { $count } éléments trouvés (à partir de { $matches } correspondances)
zotseek-search-foundItemsQuery = { $count } éléments trouvés ({ $query })
zotseek-search-searching = Recherche en cours…
zotseek-search-searchLabel = Rechercher
zotseek-search-searchingMoment = Recherche imminente…
zotseek-search-queryTooShort = Saisissez au moins 2 caractères CJK ou 3 autres caractères
zotseek-search-failed = Échec de la recherche : { $error }
zotseek-search-noItemsMatchingAll = Aucun élément ne correspond à toutes les requêtes
zotseek-search-matchBoth = — les résultats doivent correspondre aux deux requêtes
zotseek-search-matchAll = — les résultats doivent correspondre à toutes les requêtes
zotseek-search-matchAny = — les résultats peuvent correspondre à n’importe quelle requête

## Results table columns

zotseek-column-match = Correspondance
zotseek-column-title = Titre
zotseek-column-authors = Auteurs
zotseek-column-year = Année
zotseek-column-location = Emplacement
zotseek-column-section = Section

## Source labels

zotseek-source-abstract = Résumé
zotseek-source-fulltext = Texte intégral
zotseek-source-title = Titre
zotseek-source-methods = Méthodes
zotseek-source-results = Résultats
zotseek-source-content = Contenu
zotseek-source-note = Note
zotseek-search-hybrid-menuitem =
    .label = 🔗 Hybride (recommandé)
zotseek-search-semantic-menuitem =
    .label = 🧠 Sémantique uniquement
zotseek-search-keyword-menuitem =
    .label = 🔤 Mots-clés uniquement

## Similar documents dialog

zotseek-similar-title =
    .title = Trouver des documents similaires
zotseek-similar-similarTo = Similaire à :{ " " }
zotseek-similar-loading = Chargement…
zotseek-similar-openSelected =
    .label = Ouvrir la sélection
zotseek-similar-close =
    .label = Fermer
zotseek-similar-initFailed = Échec de l’initialisation : { $error }
zotseek-similar-noSource = Aucun document source sélectionné
zotseek-similar-finding = Recherche de documents similaires…
zotseek-similar-loadingModel = Chargement du modèle IA…
zotseek-similar-searching = Recherche en cours…
zotseek-similar-noResults = Aucun document similaire trouvé
zotseek-similar-found = { $count } documents similaires trouvés
zotseek-similar-searchFailed = Échec de la recherche : { $error }

## Indexing progress

zotseek-indexing-title = Indexation ZotSeek
zotseek-indexing-clearTitle = Effacement de l’index ZotSeek
zotseek-indexing-clearConfirmTitle = Effacer l’index ZotSeek
zotseek-indexing-clearConfirmMsg = Cette action supprimera tous les embeddings enregistrés. Vous devrez ensuite réindexer votre bibliothèque.

    Continuer ?
zotseek-indexing-clearConfirmButton = Effacer l’index
zotseek-indexing-initStorage = Initialisation du stockage…
zotseek-indexing-deletingAll = Suppression de tous les embeddings…
zotseek-indexing-clearedSuccess = Index effacé avec succès !
zotseek-indexing-clearedMsg = Index effacé avec succès.

    Vous pouvez maintenant réindexer votre bibliothèque.
zotseek-indexing-rebuildTitle = Reconstruction de l’index ZotSeek
zotseek-indexing-rebuildConfirmTitle = Reconstruire l’index ZotSeek
zotseek-indexing-rebuildConfirmMsg = Cette action supprimera tous les embeddings enregistrés et reconstruira l’index avec vos réglages actuels.
zotseek-indexing-rebuildConfirmButton = Reconstruire l’index
zotseek-indexing-chunkStrategyRebuildRequired = ZotSeek a détecté que l’index du modèle actuel utilise une ancienne stratégie de segmentation. L’index existant reste interrogeable, mais les mises à jour incrémentielles en arrière-plan sont suspendues afin d’éviter de mélanger d’anciens et de nouveaux segments. Utilisez « Reconstruire l’index » dans les paramètres pour effectuer une reconstruction complète. Fermer cette notification ne lance pas de reconstruction et ne modifie pas l’index existant.

    Cette opération peut prendre plusieurs minutes selon la taille de la bibliothèque.

    Continuer ?
zotseek-indexing-rebuildingTitle = Reconstruction de l’index ZotSeek
zotseek-indexing-clearingExisting = Effacement de l’index existant…
zotseek-indexing-existingCleared = ✓ Index existant effacé
zotseek-indexing-loading = Chargement…
zotseek-indexing-alreadyInProgress = Une indexation est déjà en cours…
zotseek-indexing-selectItems = Veuillez sélectionner des éléments à indexer.
zotseek-indexing-selectCollection = Veuillez d’abord sélectionner une collection.

    (Cliquez sur une collection dans la barre latérale gauche.)
zotseek-indexing-emptyCollection = La collection « { $name } » ne contient aucun élément à indexer.
zotseek-indexing-emptyCollections = Les { $count } collections sélectionnées ne contiennent aucun élément à indexer.
zotseek-indexing-updateTitle = ZotSeek – Vérifier et mettre à jour l’index
zotseek-indexing-updateConfirmMsg = Vérifier et mettre à jour l’index pour { $scope } ? ZotSeek ajoutera les éléments manquants, mettra à jour ceux dont les métadonnées, notes ou paramètres d’indexation ont changé, ignorera ceux qui sont inchangés et retirera les enregistrements des éléments supprimés de Zotero ou désormais exclus par les règles d’indexation. Les changements de paramètres d’indexation peuvent recalculer les éléments existants avec les réglages actuels.
zotseek-indexing-updateConfirmButton = Vérifier et mettre à jour
zotseek-indexing-confirmCancel = Annuler
zotseek-indexing-scopeUser = votre bibliothèque personnelle
zotseek-indexing-scopeAll = toutes vos bibliothèques (personnelle + groupes)

zotseek-indexing-configChangeTitle = ZotSeek – Paramètres d’indexation modifiés
zotseek-indexing-configChangeMessage = Les paramètres d’indexation ont changé dans { $scope }. Éléments déjà indexés concernés : { $affected } ; embeddings à recalculer : { $rebuildRequired }. Pour les autres éléments, seul l’enregistrement de configuration doit être mis à jour. Avant votre choix, ZotSeek ne supprimera aucun enregistrement, ne mettra pas à jour les empreintes et n’écrira aucun embedding. Comment cette vérification au démarrage doit-elle se poursuivre ?
zotseek-indexing-configChangeUpdate = Vérifier et mettre à jour l’index
zotseek-indexing-configChangeRebuild = Reconstruire l’index
zotseek-indexing-configChangeCancel = Annuler

# Auto-resume prompt shown at startup when a previous bulk-index run was interrupted.
zotseek-resume-title = ZotSeek – Reprendre l’indexation
zotseek-resume-message = Une précédente opération d’indexation a été interrompue. ZotSeek revérifiera la portée { $scope } (nombre d’éléments : { $count }) et reprendra les mises à jour inachevées ou échouées. Les éléments déjà à jour seront ignorés. Si vous annulez, la maintenance automatique de l’index sera également ignorée pour ce démarrage. Reprendre maintenant ?
zotseek-resume-confirm = Reprendre l’indexation
zotseek-resume-scopeLibrary = vos bibliothèques
zotseek-resume-scopeUserLibrary = votre bibliothèque personnelle
zotseek-resume-scopeCollection = la collection « { $name } »
zotseek-resume-scopeCollections = les { $count } collections sélectionnées
zotseek-resume-scopeItems = la portée des éléments sélectionnés
zotseek-indexing-noItemsSelected = Aucun élément sélectionné
zotseek-indexing-removedItems = Éléments retirés de l’index : { $count }
zotseek-indexing-notInIndex = Les éléments sélectionnés ne figuraient pas dans l’index
zotseek-indexing-removeFailed = Échec du retrait de l’index
zotseek-indexing-mode = Mode d’indexation : { $mode }
zotseek-indexing-checking = Vérification des éléments déjà indexés…
zotseek-indexing-skippedExcluded = ✓ Éléments exclus ignorés : { $count }
zotseek-indexing-skippedIndexed = ✓ Éléments déjà indexés ignorés : { $count }
zotseek-indexing-allIndexed = Tous les éléments sont déjà indexés !
zotseek-indexing-allInIndex = ✓ { $count } éléments déjà présents dans l’index
zotseek-indexing-nothingToIndex = Rien à indexer — tous les éléments sont à jour !
zotseek-indexing-loadingModel = Chargement du modèle IA (Transformers.js)…
zotseek-indexing-modelLoaded = ✓ Modèle IA chargé
zotseek-indexing-batchExtracting = Lot { $current }/{ $total } : extraction du texte…
zotseek-indexing-batchEmbedding = Lot { $current }/{ $total } : génération des embeddings…
zotseek-indexing-batchEmbeddingChunks = Lot { $current }/{ $total } : génération des embeddings des segments
zotseek-indexing-chunksFailed = ⚠ { $count } segments ignorés dans : { $items }
zotseek-indexing-batchSaving = Lot { $current }/{ $total } : enregistrement du point de contrôle…
zotseek-indexing-checkpoint = ✓ Point de contrôle { $current }/{ $total } : { $items } éléments, { $chunks } segments enregistrés
zotseek-indexing-complete = Indexation terminée !
zotseek-indexing-completeMode = ✓ Mode : { $mode }
zotseek-indexing-completePrevious = ✓ Déjà indexés : { $count } éléments
zotseek-indexing-completeNew = ✓ Nouveaux éléments indexés : { $count }
zotseek-indexing-completeChunks = ✓ Segments totaux : { $count }
zotseek-indexing-completeAvg = ✓ Moy. segments/élément : { $avg }
zotseek-indexing-completeDuration = ✓ Durée : { $duration }
zotseek-indexing-completeNoContent = ⚠ Aucun contenu : { $count } éléments
zotseek-indexing-completeTruncated = ⚠ Contenu partiel : la limite maximale de segments par document a été atteinte. Nombre d’éléments concernés : { $count }. Augmentez la limite ou passez au mode « Résumés uniquement » pour indexer le texte complet.
zotseek-indexing-completeSuccess = Indexation terminée avec succès !
zotseek-indexing-cancelled = Indexation annulée
zotseek-indexing-pauseAction = Mettre l’indexation en pause
zotseek-indexing-pausingAction = Mise en pause…
zotseek-indexing-pauseTooltip = Arrêter après le prochain point de contrôle sûr et reprendre au prochain démarrage de Zotero
zotseek-indexing-paused = Indexation en pause. ZotSeek proposera de reprendre exactement cette portée au prochain démarrage de Zotero.
zotseek-indexing-failed = Échec de l’indexation : { $error }
zotseek-indexing-progressTitle = ZotSeek
zotseek-indexing-progressItem = Indexation : { $title }
zotseek-indexing-progressLoadingModel = Chargement du modèle…
zotseek-indexing-allExcluded = Tous les éléments sont exclus de l’indexation
zotseek-indexing-extracting = Extraction…
zotseek-indexing-noContent = ✗ Aucun contenu trouvé
zotseek-indexing-embedding = Génération des embeddings { $current }/{ $total }…
zotseek-indexing-saving = Enregistrement…
zotseek-indexing-chunksIndexed = ✓ { $count } segments indexés
zotseek-indexing-chunksIndexedWithFailed = ✓ { $count } segments indexés (nombre d’échecs : { $failed })

## Export to Collection (issue #28)

# Keys referenced via data-l10n-id on XUL elements use the .attr = value form
# so Fluent sets the named attribute instead of wiping the element's children.
# Keys consumed via formatValueSync / getString() from JS stay as plain key = text.

zotseek-export-saveAsCollection =
    .label = Enregistrer les résultats comme collection
zotseek-export-addToCollectionNew =
    .label = Nouvelle collection…
zotseek-export-dialogTitle =
    .title = Enregistrer les résultats comme collection
zotseek-export-nameLabel =
    .value = Nom de la collection :
zotseek-export-libraryLabel =
    .value = Bibliothèque :
zotseek-export-ok =
    .label = Enregistrer
zotseek-export-cancel =
    .label = Annuler
zotseek-export-itemcountSimple = { $count } éléments → { $destination }
zotseek-export-itemcountFiltered = { $kept } éléments sur { $total } → { $destination } ({ $reasons })
zotseek-export-reasonOtherLibrary = { $count } dans d’autres bibliothèques
zotseek-export-reasonDeleted = supprimés : { $count }
zotseek-export-itemcountEmpty = Aucun élément à ajouter.
zotseek-export-statusExported = { $count } éléments ajoutés à « { $name } ».
zotseek-export-statusExportedSkipped = { $count } éléments ajoutés à « { $name } » ; éléments ignorés : { $skipped }.
zotseek-export-statusFailed = Échec de l’enregistrement des résultats comme collection.

## Preference group headers

zotseek-prefs-group-status = État
zotseek-prefs-group-models = Modèles
zotseek-prefs-group-indexing = Indexation
zotseek-prefs-group-search = Recherche
zotseek-prefs-group-maintenance = Intégrations et maintenance
zotseek-prefs-exclusions = Exclusions

## Model section headers (fallbacks existed in XHTML only; adds the missing ftl entries)

zotseek-pref-embeddingModelTitle = Modèle d’embeddings
zotseek-pref-manageModelsTitle = Gérer les modèles installés

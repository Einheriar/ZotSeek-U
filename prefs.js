// Default preferences for ZotSeek
// Note: Zotero prefs only support string, int, bool - not float
// minSimilarityPercent is stored as integer (70 = 70% = 0.7).
// Multilingual E5 cosine scores are concentrated at the high end.

pref("extensions.zotero.zotseek.minSimilarityPercent", 70);
pref("extensions.zotero.zotseek.topK", 20);
pref("extensions.zotero.zotseek.autoIndex", false);

// Index scope: "user" (My Library only) or "all" (all libraries including groups)
pref("extensions.zotero.zotseek.indexScope", "user");

// Indexing mode: "abstract", "notes" (metadata + child notes), or "full" (notes + PDF sections)
pref("extensions.zotero.zotseek.indexingMode", "abstract");

// Chunking options. When maxTokens has no user value, ZotSeek resolves the
// active model's recommendation and clamps explicit overrides to its hard limit.
pref("extensions.zotero.zotseek.maxChunksPerPaper", 100);

// Has the index-status column been auto-shown once after installation?
// Used to surface the column the first time the user installs this version
// without re-showing it if they later choose to hide it.
pref("extensions.zotero.zotseek.indexStatusColumn.firstShown", false);

// Item type filtering
// Exclude books from search results (books lack paper sections and are too long to index well)
pref("extensions.zotero.zotseek.excludeBooks", true);

// Hybrid search settings
// Combines semantic search with Zotero's keyword search using Reciprocal Rank Fusion
pref("extensions.zotero.zotseek.hybridSearch.enabled", true);
// Search mode: "hybrid", "semantic", or "keyword"
pref("extensions.zotero.zotseek.hybridSearch.mode", "hybrid");
// Semantic weight (0-100): 50 = equal weight, higher = more semantic, lower = more keyword
// Stored as integer percentage since Zotero prefs don't support floats
pref("extensions.zotero.zotseek.hybridSearch.semanticWeightPercent", 50);
// RRF constant k (typical: 60, from original RRF paper)
pref("extensions.zotero.zotseek.hybridSearch.rrfK", 60);
// Auto-adjust weights based on query analysis
pref("extensions.zotero.zotseek.hybridSearch.autoAdjustWeights", true);

// Dev mode: when true, mounts the self-test harness under Zotero.ZotSeek._selfTest
// Used for autonomous verification via MCP. End users should leave this false.
pref("extensions.zotero.zotseek.devMode", false);

// Local MCP/REST endpoints for AI agents (Claude Code etc.). Opt-in:
// exposes read-only semantic search on Zotero's local HTTP server (23119).
pref("extensions.zotero.zotseek.mcpServer.enabled", false);

// Active embedding model (short id from the model registry).
// Change requires re-indexing the library with the new model.
pref("extensions.zotero.zotseek.embeddingModel", "multilingual-e5-base");
pref("extensions.zotero.zotseek.modelDefaultMigrationE5", false);
pref("extensions.zotero.zotseek.modelInputPolicyMigrationV1", false);

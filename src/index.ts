/**
 * ZotSeek - Semantic Search for Zotero
 *
 * Main entry point for the plugin.
 */

// Access Zotero through the global context set by bootstrap
declare const _globalThis: any;
declare const Zotero: any;
declare const ChromeUtils: any;
declare const Components: any;
declare const Services: any;  // Zotero 8 global Services object

// Import core modules
import { PaperEmbedding, getVectorStore, IVectorStore } from './core/storage-factory';
import { getLexicalSnapshotSize } from './core/lexical-snapshot';
import { embeddingPipeline, EmbeddingProgress } from './core/embedding-pipeline';
import { searchEngine, SearchResult } from './core/search-engine';
import { textExtractor, ExtractedText, ExtractedChunks } from './core/text-extractor';
import { ZoteroAPI } from './utils/zotero-api';
import {
  assessChunkStrategyState,
  CHUNK_STRATEGY_VERSION,
  getIndexingMode,
  type ChunkStrategyState,
  type IndexingMode,
} from './utils/chunker';
import { getZotero } from './utils/zotero-helper';
import {
  DEFAULT_INDEXING_MODE,
  isCanonicalIndexingMode,
  normalizeStoredIndexingMode,
} from './utils/indexing-mode';
import { autoIndexManager, IndexCallbackResult } from './core/auto-index-manager';
import { assessModeOnlyIndexConfigTransition } from './core/index-freshness';
import { planModeTransitionReuse } from './core/index-mode-transition';
import { indexFreshnessNotifier } from './core/index-freshness-notifier';
import { metadataIdentityCache } from './core/metadata-identity-cache';
import { getString } from './utils/locale';
import { openDismissibleNotice } from './utils/prompt-notice';
// Use stable progress window from toolkit to avoid crashes
import { StableProgressWindow, showQuickNotification } from './utils/stable-progress';
// UI components
import { searchDialog } from './ui/search-dialog';
import { searchDialogWithVTable } from './ui/search-dialog-with-vtable';
import { similarDocumentsWrapper } from './ui/similar-documents-wrapper';
import { toolbarButton } from './ui/toolbar-button';
import { itemTreeIndexColumn } from './ui/item-tree-column';
import { preferencesManager } from './ui/preferences';
import {
  openIndexConfigChangePrompt,
  openIndexConfirmationPrompt,
} from './ui/index-config-change-prompt';
import {
  revealFileLocation,
  showServerModelConfigurationPromptIfNeeded,
} from './ui/server-model-prompt';
import { identityFromItem, libraryKeyFromLocalID, localItemIDFromIdentity } from './core/identity-resolver';
import {
  getActiveModel,
  getActiveModelId,
  getActiveModelSelectionId,
  SERVER_SLOT_SELECTION_ID,
} from './core/model-registry';
import { initServerManager, shutdownServerManager } from './server/server-manager';
import { registerModelsResourceSubstitution, verifyModelsResourceSubstitution } from './core/model-download';
import { tokenizerService } from './core/tokenizer-service';
import { shouldClearLegacyDefaultChunkPreference } from './core/model-input-policy';
import {
  getLastServerModelConfigLoadResult,
  getSelectedServerModelConfigurationIssue,
  loadServerModelConfig,
  serverModelConfigurationErrorMessage,
} from './core/server-model-config';
// Self-test harness (mounted only when extensions.zotseek.devMode = true)
import { selfTest as zotseekSelfTest } from './dev/self-test';
import { exportPdfWorkerCollection } from './dev/pdf-benchmark-export';
import { exportNotesChunkBenchmark } from './dev/notes-chunk-benchmark-export';
// Task suites: imported for registration side effects only.
import './dev/suites/task-1-identity-resolver';
import './dev/suites/task-6-write-delete';
import './dev/suites/task-7-lookups';
import './dev/suites/task-8-reads';
import './dev/suites/task-9-status-map';
import './dev/suites/task-10-housekeeping';
import './dev/suites/task-13-search';
import './dev/suites/task-25-index-freshness';
import './dev/suites/mcp-server';
import './dev/suites/task-37a-model-registry';
import './dev/suites/task-37b-schema-v9';
import './dev/suites/task-37c-model-aware-store';
import './dev/suites/task-37d-partitioned-search';
import './dev/suites/task-37e-model-download';
import './dev/suites/task-42a-loopback';
import './dev/suites/task-42b-server-registry';
import './dev/suites/task-42c-server-client';
import './dev/suites/task-45-cloud';
import './dev/suites/task-47-z10-db-hooks';
import './dev/suites/task-57-brief';
import { collectCollectionItems } from './utils/collection-items';
import {
  BulkIndexScope,
  BULK_INDEX_PENDING_PREF,
  isBulkIndexScope,
  shouldClearBulkIndexScope,
  shouldClearMatchingBulkIndexScope,
  shouldRecordBulkIndexScope,
} from './utils/bulk-index-resume';
import {
  isItemExcludedFromIndex,
  readIndexExclusionPolicy,
} from './utils/index-exclusion';
import {
  briefService,
  type BriefGenerationRequest,
  type BriefJobResult,
} from './core/brief-service';
import type { BriefSchedulerProgress } from './core/brief-generation-scheduler';

/**
 * Read live Child Notes through Zotero's item API.  A missing/invalid API is
 * treated as an error rather than as "no notes", because generating another
 * external brief in that state could silently bypass the duplicate safeguard.
 */
function hasBriefChildNotes(parent: any): boolean {
  if (!parent || typeof parent.getNotes !== 'function') return false;
  const noteIDs = parent.getNotes();
  if (!Array.isArray(noteIDs)) throw new Error('Zotero returned an invalid Child Note list.');
  const items = getZotero()?.Items;
  if (!items || typeof items.get !== 'function') throw new Error('Zotero Note lookup is unavailable.');
  return noteIDs.some((id: number) => {
    const note = items.get(id);
    return !!note && note.deleted !== true && note.isDeleted?.() !== true;
  });
}

/**
 * Localized labels for the known Brief skip-reason machine values.  Historical
 * spellings (underscore vs hyphen) normalize to one label at this single UI
 * boundary; an unknown reason falls back to the plain status label instead of
 * leaking a raw locale key into the progress window.
 */
const BRIEF_SKIP_REASON_LABELS: Readonly<Record<string, string>> = {
  insufficient_text: 'brief-skip-reason-insufficient-text',
  'no-text': 'brief-skip-reason-insufficient-text',
  existing_note: 'brief-skip-reason-existing-note',
  'existing-note': 'brief-skip-reason-existing-note',
  no_main_pdf: 'brief-skip-reason-no-main-pdf',
};

/**
 * Don't bother compacting zotseek.sqlite on idle below this much reclaimable
 * space. Mirrors the threshold the preferences button label uses.
 */
const IDLE_COMPACT_MIN_BYTES = 10 * 1024 * 1024;

/**
 * Persisted scope of a bulk-index run, used to offer resume on next startup
 * if the run was interrupted (cancel, crash, sleep, plugin reload).
 */
type BulkScope = BulkIndexScope;

type ModeTransitionReuseState = {
  reusableByItem: Map<number, Map<number, PaperEmbedding>>;
  reusedChunks: number;
};

interface PluginInfo {
  id: string;
  version: string;
  rootURI: string;
}

/**
 * Simple logger - only uses Zotero.debug (no console)
 */
class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = `[${prefix}]`;
  }

  private log(level: string, ...args: any[]): void {
    const msg = `${this.prefix} [${level}] ${args.join(' ')}`;
    const Z = getZotero();
    if (Z && Z.debug) {
      Z.debug(msg);
    }
  }

  info(...args: any[]): void {
    this.log('INFO', ...args);
  }

  warn(...args: any[]): void {
    this.log('WARN', ...args);
  }

  error(...args: any[]): void {
    this.log('ERROR', ...args);
  }

  debug(...args: any[]): void {
    this.log('DEBUG', ...args);
  }
}

function hashChunkContent(texts: string[]): string {
  const content = texts.join('\n\n');
  let hash = 0;
  for (let index = 0; index < content.length; index++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(index);
    hash &= hash;
  }
  return hash.toString(16);
}

interface ChunkForEmbedding { id: string; text: string; title: string; }
interface EmbedChunksResult {
  embeddings: Map<string, { embedding: number[]; modelId: string }>;
  failedChunks: number;
  failedItems: Set<string>;
}

// Local Server accepts this many chunks; Cloud applies its provider limit internally.
const SERVER_EMBED_GROUP = 32;

/**
 * Embed a list of chunks with the active pipeline. Shared by the three
 * indexing paths (indexLibrary, auto-index, reindexForActiveModel).
 *
 * Worker runtime: per-chunk with one retry; a chunk that fails twice is
 * skipped and reported (embedding compute is local, failures are per-chunk).
 *
 * HTTP runtimes: groups of SERVER_EMBED_GROUP at the pipeline boundary; the
 * Cloud client further splits these groups to the provider maximum. Errors are NOT
 * swallowed per chunk: the client already retried with backoff, and a dead
 * server must stop the run cleanly (ServerUnavailableError propagates to the
 * caller's outer catch). Falling back to the in-process model is forbidden -
 * it would mix vector spaces under one model_id.
 *
 * onProgress(processed) runs after each chunk (worker) or group (server);
 * it may throw (e.g. 'Cancelled by user') to abort the run.
 */
async function embedChunks(
  chunks: ChunkForEmbedding[],
  onProgress: (processed: number) => Promise<void> | void,
  expectedModelId: string = getActiveModelId(),
): Promise<EmbedChunksResult> {
  const embeddings = new Map<string, { embedding: number[]; modelId: string }>();
  let failedChunks = 0;
  const failedItems = new Set<string>();

  if (embeddingPipeline.supportsBatchEmbedding()) {
    for (let i = 0; i < chunks.length; i += SERVER_EMBED_GROUP) {
      if (getActiveModelId() !== expectedModelId || embeddingPipeline.getModelId() !== expectedModelId) {
        throw new Error('Embedding model changed during indexing; the batch was stopped before saving.');
      }
      const group = chunks.slice(i, i + SERVER_EMBED_GROUP);
      const vectors = await embeddingPipeline.embedDocuments(group.map(c => c.text));
      group.forEach((c, j) => embeddings.set(c.id, { embedding: vectors[j], modelId: expectedModelId }));
      await onProgress(Math.min(i + group.length, chunks.length));
    }
    return { embeddings, failedChunks, failedItems };
  }

  for (let i = 0; i < chunks.length; i++) {
    if (getActiveModelId() !== expectedModelId || embeddingPipeline.getModelId() !== expectedModelId) {
      throw new Error('Embedding model changed during indexing; the batch was stopped before saving.');
    }
    const chunk = chunks[i];
    try {
      const result = await embeddingPipeline.embed(chunk.text);
      if (result) {
        if (result.modelId !== expectedModelId) {
          throw new Error(`Embedding model changed from ${expectedModelId} to ${result.modelId} during indexing.`);
        }
        embeddings.set(chunk.id, result);
      }
    } catch (embedException: any) {
      if (getActiveModelId() !== expectedModelId ||
          embeddingPipeline.getModelId() !== expectedModelId ||
          /Embedding model changed/.test(embedException?.message || '')) {
        throw embedException;
      }
      // Retry once before giving up on this chunk
      try {
        Zotero.debug(`[ZotSeek] Embedding failed for chunk ${chunk.id} ("${chunk.title}"), retrying: ${embedException?.message || embedException}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryResult = await embeddingPipeline.embed(chunk.text);
        if (retryResult) {
          if (retryResult.modelId !== expectedModelId) {
            throw new Error(`Embedding model changed from ${expectedModelId} to ${retryResult.modelId} during indexing.`);
          }
          embeddings.set(chunk.id, retryResult);
        }
      } catch (retryError: any) {
        if (getActiveModelId() !== expectedModelId ||
            embeddingPipeline.getModelId() !== expectedModelId ||
            /Embedding model changed/.test(retryError?.message || '')) {
          throw retryError;
        }
        failedChunks++;
        failedItems.add(chunk.title);
        Zotero.debug(`[ZotSeek] Skipping chunk ${chunk.id} ("${chunk.title}") after retry failure: ${embedException?.message || embedException}`);
      }
    }
    await onProgress(i + 1);
    // Yield to UI thread periodically
    if ((i + 1) % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  return { embeddings, failedChunks, failedItems };
}

/**
 * Main plugin class
 */
class ZotSeekPlugin {
  private info: PluginInfo | null = null;
  private logger: Logger;
  private zoteroAPI: ZoteroAPI;
  public vectorStore: IVectorStore | null = null;  // Public for preference pane access
  private initialized = false;
  private indexing = false;
  private indexOperationActive = false;
  private serverBackgroundSkipLogged = false;
  private chunkStrategyNoticeShown = false;
  private collectionMenuRegistrationID: string | null = null;
  private briefProgressWindow: StableProgressWindow | null = null;
  private briefTitles = new Map<string, string>();
  private briefItemMenuPopup: any = null;
  private briefItemMenuShowing: (() => void) | null = null;

  // Hooks for bootstrap.js
  public hooks = {
    onStartup: () => this.onStartup(),
    onShutdown: () => this.onShutdown(),
    onMainWindowLoad: (win: Window) => this.onMainWindowLoad(win),
    onMainWindowUnload: (win: Window) => this.onMainWindowUnload(win),
    onPrefsEvent: (type: string, data: any) => this.onPrefsEvent(type, data),
  };

  constructor() {
    this.logger = new Logger('ZotSeek');
    this.zoteroAPI = new ZoteroAPI();
    this.logger.debug('Plugin initialized with ZoteroToolkit logging');
  }

  setInfo(info: PluginInfo): void {
    this.info = info;
    this.logger.info(`Plugin version: ${info.version}`);
  }

  /**
   * Initialize default preferences if not already set
   * Note: Zotero prefs only support string, int, bool - not float
   */
  private initDefaultPreferences(): void {
    const Z = getZotero();
    if (!Z) return;

    // Store minSimilarity as int (70 = 0.7, divide by 100 when reading).
    // Multilingual E5 similarities are concentrated near the high end.
    // This Notes-focused build defaults to multilingual E5 for Chinese and
    // mixed-language retrieval.
    const defaults: { [key: string]: any } = {
      'zotseek.minSimilarityPercent': 70,  // 70% = 0.7
      'zotseek.topK': 20,
      'zotseek.autoIndex': false,
      'zotseek.indexingMode': DEFAULT_INDEXING_MODE,  // 'abstract', 'notes', or 'full'
      'zotseek.maxChunksPerPaper': 100,
      'zotseek.excludeBooks': true,        // Exclude books from search/indexing by default
      'zotseek.excludeTag': 'zotseek-exclude', // Tag name to exclude items from indexing
      'zotseek.indexStatusColumn.firstShown': false, // First-run flag for index-status column
      'zotseek.mcpServer.enabled': false, // Opt-in local MCP/REST endpoints for AI agents
      'zotseek.embeddingModel': 'multilingual-e5-base',
      'zotseek.modelDefaultMigrationE5': false,
      'zotseek.modelInputPolicyMigrationV1': false,
      'zotseek.indexScope': 'user', // 'user' (My Library) or 'all' (all libraries)
      'zotseek.serverModels': '[]', // Validated one-entry runtime cache for the fixed Server slot
      'zotseek.cloud.provider': 'alibaba-bailian',
      'zotseek.cloud.bailianRegion': 'cn',
      'zotseek.cloud.custom.baseUrl': '',
      'zotseek.cloud.custom.modelName': '',
      'zotseek.cloud.custom.dimensions': 0,
      // Custom endpoints do not expose a trustworthy model profile. Keep
      // these unset until the user supplies the model contract; the resolver
      // uses a runtime-safe placeholder without presenting it as a fact.
      'zotseek.cloud.custom.maxInputTokens': 0,
      'zotseek.cloud.custom.batchSize': 1,
      'zotseek.cloud.connectionVerified': false, // legacy global state, read as the Bailian fallback
      'zotseek.cloud.autoIndex': false,
      'zotseek.cloud.consentVersion': 0, // legacy global consent, read as the Bailian fallback
      'zotseek.brief.enabled': false,
      'zotseek.cloud.brief.modelName': 'deepseek-v4-flash-0731',
      'zotseek.cloud.brief.maxInputTokens': 1000000,
      'zotseek.cloud.brief.maxOutputTokens': 16384,
      'zotseek.cloud.brief.thinkingEnabled': true,
      'zotseek.cloud.brief.connectionVerified': false,
      'zotseek.cloud.brief.connectionVerified.binding': '',
      'zotseek.cloud.brief.configFingerprint': '',
      'zotseek.cloud.brief.configRevision': 0,
      'zotseek.cloud.brief.consentVersion': 0,
      'zotseek.autoCompact': true, // Reclaim space in zotseek.sqlite during Zotero's idle maintenance (Zotero 10+)
      // Experimental: run embeddings on the GPU via WebGPU (Zotero 11+ only).
      // Off by default: Firefox 153's WebGPU is 6-11x SLOWER than the WASM
      // path for this workload (measured on Apple Silicon; see issue #2).
      // The GPU path also needs fp16 weights (onnx/model_fp16.onnx), which
      // are not bundled.
      'zotseek.webgpu.enabled': false,
    };

    for (const [key, defaultValue] of Object.entries(defaults)) {
      try {
        const currentValue = Z.Prefs.get(key, true);
        if (currentValue === undefined) {
          this.logger.info(`Setting default preference: ${key} = ${defaultValue}`);
          Z.Prefs.set(key, defaultValue, true);
        } else {
          this.logger.info(`Preference ${key} already set: ${currentValue}`);
        }
      } catch (e) {
        this.logger.warn(`Failed to set preference ${key}: ${e}`);
      }
    }

    // Migrate the old upstream default once. A later explicit user choice is
    // preserved because the marker prevents subsequent automatic changes.
    try {
      const migrationKey = 'zotseek.modelDefaultMigrationE5';
      const migrated = Z.Prefs.get(migrationKey, true) === true;
      if (!migrated) {
        const selected = Z.Prefs.get('zotseek.embeddingModel', true);
        if (!selected || selected === 'nomic-embed-text-v1.5') {
          Z.Prefs.set('zotseek.embeddingModel', 'multilingual-e5-base', true);
          const minSimilarity = Z.Prefs.get('zotseek.minSimilarityPercent', true);
          if (minSimilarity === undefined || minSimilarity === 30) {
            Z.Prefs.set('zotseek.minSimilarityPercent', 70, true);
          }
          this.logger.info('Migrated default embedding model to multilingual-e5-base');
        }
        Z.Prefs.set(migrationKey, true, true);
      }
    } catch (error) {
      this.logger.warn(`Could not migrate the default embedding model: ${error}`);
    }

    // The previous build wrote 450 as a global default. Clear that one
    // ambiguous value once so each model can use its own recommendation.
    try {
      const migrationKey = 'zotseek.modelInputPolicyMigrationV1';
      const migrated = Z.Prefs.get(migrationKey, true) === true;
      const maxTokens = Z.Prefs.get('zotseek.maxTokens', true);
      if (shouldClearLegacyDefaultChunkPreference(maxTokens, migrated)) {
        Z.Prefs.clear('zotseek.maxTokens', true);
        this.logger.info('Cleared the legacy global 450-token default');
      }
      if (!migrated) Z.Prefs.set(migrationKey, true, true);
    } catch (error) {
      this.logger.warn(`Could not migrate the model input policy: ${error}`);
    }
  }

  async onStartup(): Promise<void> {
    const Z = getZotero();
    if (!Z) {
      this.logger.error('Zotero not available');
      return;
    }

    // Wait for UI to be ready
    await Z.uiReadyPromise;

    // Log startup with timestamp
    this.logger.info('=== ZotSeek Starting ===');
    this.logger.info(`Version: ${this.info?.version || 'unknown'}`);
    this.logger.info(`Time: ${new Date().toISOString()}`);

    // Set default preferences if not already set
    this.initDefaultPreferences();

    // Load the advanced profile-side template before any model-aware module or
    // startup reconciliation reads the synchronous server-model cache.
    const serverConfig = await loadServerModelConfig();
    if (serverConfig.created) {
      this.logger.info(`Created server model template: ${serverConfig.path}`);
    }
    if (serverConfig.kind === 'unknown') {
      this.logger.warn(
        `Local Server model template loaded with ${serverConfig.errors.length} error(s): ` +
        serverConfig.errors.join(' | '),
      );
    }

    // Initialize core modules
    try {
      await this.initializeCore();
    } catch (error) {
      this.logger.error(`Failed to initialize core modules: ${error}`);
    }

    // Register context menu using Zotero 8 MenuManager API (preferred)
    // Falls back to XUL injection for older versions
    this.registerContextMenu();
    briefService.setProgressListener(progress => this.onBriefProgress(progress));

    // Register preference pane
    this.registerPreferencePane();

    // Map resource://zotseek-models/ to the profile-side models directory so
    // Transformers.js in the ChromeWorker can load downloaded models locally.
    try {
      registerModelsResourceSubstitution();
      const reason = verifyModelsResourceSubstitution();
      if (reason !== null) {
        // Not fatal: the bundled model resolves over chrome:// and still works.
        // But every downloaded model is unloadable until this is fixed, so say
        // so at error level rather than leaving it to a later, opaque failure.
        this.logger.error(`models resource substitution is not usable (${reason}); downloaded models will not load`);
      }
    } catch (e: any) {
      this.logger.error(`models resource substitution failed: ${e?.message || e}; downloaded models will not load`);
    }

    // Keep the process-wide identity snapshot coherent across UI and HTTP
    // search engines before either entry point can issue a query.
    metadataIdentityCache.start();

    // Local MCP/REST endpoints for AI agents (opt-in via preferences)
    initServerManager();

    // Add toolbar button for semantic search
    const win = Z.getMainWindow();
    if (win) {
      toolbarButton.add(win);
      toolbarButton.registerToolsMenu(win);
      this.logger.info('Toolbar button and Tools menu added');
    }

    // Register reader toolbar button
    await toolbarButton.registerReaderToolbar();
    this.logger.info('Reader toolbar button registered');

    // Register reader text selection context menu ("Find Related Papers")
    await toolbarButton.registerReaderContextMenu();
    this.logger.info('Reader context menu registered');

    // Configure scoped/startup reconciliation and a lightweight notifier that
    // only marks parent items dirty while the user edits Zotero data.
    this.initAutoIndexManager();

    // Piggyback on Zotero's idle database maintenance to compact our own
    // attached database (Zotero 10+; no-op on older versions).
    this.registerIdleCompaction();

    // Register the item-tree index-status column.
    // Needs the vector store to be initialised — do it lazily by ensuring
    // the store is ready first, but only if the user opens it later. To keep
    // startup snappy we register the column with a getter that will trigger
    // lazy init on first lookup.
    try {
      // Lazy: pass a vector store wrapper that triggers ensureStoreReady on demand
      await this.ensureStoreReady();
      if (this.vectorStore) {
        await itemTreeIndexColumn.register(this.vectorStore);
        this.logger.info('Item-tree index-status column registered');
        await autoIndexManager.restoreIndexedFreshness();
      }
    } catch (e: any) {
      this.logger.warn(`Could not register item-tree column: ${e?.message || e}`);
    }

    let resumePromptHandled = false;
    try {
      // Resolve interrupted explicit work before scheduling automatic
      // maintenance. Otherwise the 10-second startup timer can race the
      // resume prompt and update a scope the user has just declined.
      resumePromptHandled = await this.checkAndOfferResume();
    } catch (e: any) {
      this.logger.debug(`checkAndOfferResume failed: ${e?.message || e}`);
    }

    let skipStartupReconciliation = true;
    try {
      const strategyWritable = await this.ensureChunkStrategyWritable(true);
      skipStartupReconciliation = resumePromptHandled || !strategyWritable || !this.ensureOperationalModel(false);
    } catch (e: any) {
      this.logger.warn(`Could not verify chunk strategy version: ${e?.message || e}`);
      autoIndexManager.setChunkStrategyBlocked(true);
    }
    autoIndexManager.start({ skipReconciliation: skipStartupReconciliation });

    // Dev-only self-test harness (gated by extensions.zotseek.devMode pref)
    try {
      const devMode = Z.Prefs.get('zotseek.devMode', true) === true;
      if (devMode) {
        Z.ZotSeek = Z.ZotSeek || {};
        Z.ZotSeek._selfTest = zotseekSelfTest;
        Z.ZotSeek._pdfBenchmark = { exportPdfWorkerCollection };
        Z.ZotSeek._notesChunkBenchmark = { exportNotesChunkBenchmark };

        // Turn on debug capture too. Zotero.debug() output is discarded unless
        // both of these are set, so without it the harness runs but its logs --
        // and any swallowed exception it was meant to surface -- are lost.
        try {
          Z.Debug.init(true);
          Z.Debug.setStore(true);
        } catch (e: any) {
          this.logger.debug(`Could not enable debug capture: ${e?.message || e}`);
        }

        this.logger.info('Self-test harness mounted (devMode=true, debug capture on)');
      }
    } catch (e: any) {
      this.logger.warn(`Self-test harness failed to mount: ${e?.message || e}`);
    }

    this.logger.info('=== Plugin Started Successfully ===');
    this.logInstallOrigin();
  }

  /**
   * Log where the plugin's code was actually loaded from.
   *
   * An installed XPI silently overrides a dev-mode proxy file, even when Zotero
   * is started with -purgecaches, so a rebuild appears to have no effect and
   * nothing in the UI says why. `rootURI` tells the two apart at a glance:
   *
   *   file:///.../zotseek/build/     proxy file, changes take effect
   *   jar:file:///...xpi!/           packaged XPI, the build directory is ignored
   *
   * Cheap enough to always emit; the alternative is remembering to ask
   * AddonManager by hand every time something looks stale.
   */
  private logInstallOrigin(): void {
    try {
      const rootURI = this.info?.rootURI || '';
      const mode = rootURI.startsWith('jar:')
        ? 'packaged XPI (rebuilds of the build/ directory will NOT take effect)'
        : 'unpackaged directory (dev proxy file)';
      this.logger.info(`Loaded from ${mode}: ${rootURI || 'unknown'}`);
    } catch (e: any) {
      this.logger.debug(`Could not determine install origin: ${e?.message || e}`);
    }
  }

  /**
   * Register a callback on Zotero's idle database maintenance so zotseek.sqlite
   * gets compacted without the user having to find the button in preferences.
   *
   * Zotero 10 runs backup + VACUUM after 300s of idle, and offers onIdle so
   * owners of ATTACHed databases can reclaim their own space in the same
   * window -- its own VACUUM covers only the main database, as its source says.
   *
   * The callbacks run on every idle pass, even when Zotero's own vacuum
   * declines to run (it is throttled to roughly fortnightly). Our throttle is
   * therefore the reclaimable-bytes threshold below, not Zotero's schedule. `zotseek.sqlite` fragments heavily after re-indexes, model
   * switches and orphan purges, so this is where that space comes back.
   *
   * Absent before Zotero 10, so feature-detected; older versions keep the
   * manual Compact Database button as the only path.
   */
  private registerIdleCompaction(): void {
    const Z = getZotero();
    if (typeof Z?.DB?.onIdle !== 'function') {
      this.logger.debug('Zotero.DB.onIdle unavailable; automatic compaction disabled');
      return;
    }

    Z.DB.onIdle(async () => {
      try {
        await this.runIdleCompaction();
      } catch (e: any) {
        // Never let this escape into Zotero's maintenance loop.
        this.logger.error(`Idle compaction failed: ${e?.message || e}`);
      }
    });

    this.logger.info('Registered Zotero.DB.onIdle hook for automatic compaction');
  }

  /**
   * Decide whether an idle pass should compact, and do it if so.
   *
   * compactDatabase() runs DETACH -> IOUtils.move -> ATTACH, which would pull
   * the schema out from under an in-flight indexing run, hence the guards. The
   * size threshold matches the one the preferences button label already uses:
   * below ~10 MB the VACUUM costs more than the space it returns.
   */
  private async runIdleCompaction(): Promise<void> {
    const Z = getZotero();

    if (Z?.Prefs.get('zotseek.autoCompact', true) === false) return;
    if (this.indexing) {
      this.logger.debug('Idle compaction skipped: indexing in progress');
      return;
    }
    if (!this.vectorStore?.isReady?.()) return;

    const reclaimable = Number(await (this.vectorStore as any).getReclaimableBytes?.()) || 0;
    if (reclaimable < IDLE_COMPACT_MIN_BYTES) {
      this.logger.debug(`Idle compaction skipped: only ${reclaimable} bytes reclaimable`);
      return;
    }

    this.logger.info(`Idle compaction starting (${reclaimable} bytes reclaimable)`);
    const { beforeBytes, afterBytes } = await (this.vectorStore as any).compactDatabase();
    this.logger.info(`Idle compaction done: ${beforeBytes} -> ${afterBytes} bytes`);
  }

  /**
   * If a previous bulk-indexing run was interrupted, offer the user a chance
   * to resume it. The intent (library or collection) was persisted by
   * `indexItems` when the run started. The whole exact scope is reconciled so
   * completed items can be skipped and stale or failed items can be retried.
   */
  private async checkAndOfferResume(): Promise<boolean> {
    if (!this.ensureOperationalModel(false)) return false;
    const Z = getZotero();
    if (!Z) return false;

    let raw: string | undefined;
    try {
      raw = Z.Prefs.get(BULK_INDEX_PENDING_PREF, true) as string | undefined;
    } catch {
      return false;
    }
    if (!raw) return false;

    let scope: BulkScope | null = null;
    try {
      const parsed = JSON.parse(raw);
      if (!isBulkIndexScope(parsed)) throw new Error('Invalid bulk scope');
      scope = parsed;
    } catch {
      // Corrupt pref — clear it and move on
      try { Z.Prefs.clear(BULK_INDEX_PENDING_PREF, true); } catch { /* ignore */ }
      return false;
    }

    // Rebuild the candidate item list for the recorded scope, then ask the
    // user whether to resume. Cheap to compute (no embedding work yet).
    let items: any[] = [];
    let label = '';
    try {
      if (scope.type === 'all-libraries') {
        items = await this.zoteroAPI.getAllLibraryItems();
        label = getString('resume-scopeLibrary');
      } else if (scope.type === 'library') {
        items = await this.zoteroAPI.getLibraryItems(scope.libraryId);
        const userLibraryID = Z.Libraries.userLibraryID;
        label = scope.libraryId === userLibraryID
          ? getString('resume-scopeUserLibrary')
          : getString('resume-scopeLibrary');
      } else if (scope.type === 'collections') {
        // Same helper as onIndexCollection, so the two can never drift.
        items = await collectCollectionItems(this.zoteroAPI, scope.collections);
        label = getString('resume-scopeCollections', { count: scope.collections.length });
      } else if (scope.type === 'items') {
        const localIDs = scope.items
          .map(identity => localItemIDFromIdentity(identity))
          .filter((id): id is number => id !== null);
        items = localIDs.length > 0 ? await Z.Items.getAsync(localIDs) : [];
        label = getString('resume-scopeItems');
      } else {
        items = await this.zoteroAPI.getCollectionItems(scope.collectionId, scope.libraryId);
        const collection = await Z.Collections.getAsync(scope.collectionId);
        label = collection?.name
          ? getString('resume-scopeCollection', { name: collection.name })
          : getString('resume-scopeCollection', { name: '?' });
      }
    } catch (e: any) {
      this.logger.debug(`checkAndOfferResume: could not rebuild scope: ${e?.message || e}`);
      // A transient Zotero collection/library read failure is retryable. Keep
      // the marker and skip automatic maintenance for this launch so it cannot
      // race or silently expand the interrupted explicit scope.
      return true;
    }

    // Reconcile the complete recorded scope again. Existing coverage alone
    // cannot prove that Metadata, Notes, or configuration are still current.
    await this.ensureStoreReady();
    if (!this.vectorStore) return false;

    const scopedItems = items.filter(item => item?.isRegularItem?.());
    if (scopedItems.length === 0) {
      try { Z.Prefs.clear(BULK_INDEX_PENDING_PREF, true); } catch { /* ignore */ }
      this.logger.info('Resume marker found but the recorded scope is now empty — clearing');
      return false;
    }
    const win = Z.getMainWindow();
    const proceed = openIndexConfirmationPrompt(
      Services?.prompt,
      win,
      getString('resume-title'),
      getString('resume-message', { count: scopedItems.length, scope: label }),
      getString('resume-confirm'),
      getString('indexing-confirmCancel'),
    );

    if (!proceed) {
      try { Z.Prefs.clear(BULK_INDEX_PENDING_PREF, true); } catch { /* ignore */ }
      this.logger.info('User declined resume — clearing marker');
      return true;
    }

    this.logger.info(`Resuming bulk index reconciliation for ${scopedItems.length} items (${label})`);
    const result = await this.indexItems(scopedItems, scope);
    if (result && shouldClearBulkIndexScope(result)) {
      try { Z.Prefs.clear(BULK_INDEX_PENDING_PREF, true); } catch { /* ignore */ }
    }
    return true;
  }

  /** Initialize the one-shot startup reconciliation manager. */
  private initAutoIndexManager(): void {
    autoIndexManager.setIndexCallback(async (items: any[]) => {
      return this.indexItemsSilent(items, true);
    });
    autoIndexManager.setNoteIndexCallback(async (items: any[]) => {
      return this.indexNoteChangesSilent(items);
    });
    autoIndexManager.setItemProvider(async () => {
      const Z = getZotero();
      if (!Z) return [];
      return this.getIndexScope() === 'all'
        ? this.zoteroAPI.getAllLibraryItems()
        : this.zoteroAPI.getLibraryItems(Z.Libraries.userLibraryID);
    });
    autoIndexManager.setStartupConfigChangeCallback(({ affected, rebuildRequired }) => {
      const Z = getZotero();
      const scopeLabel = this.getIndexScope() === 'all'
        ? getString('indexing-scopeAll')
        : getString('indexing-scopeUser');
      return openIndexConfigChangePrompt(
        Services?.prompt,
        Z?.getMainWindow(),
        getString('indexing-configChangeTitle'),
        getString('indexing-configChangeMessage', {
          affected,
          rebuildRequired,
          scope: scopeLabel,
        }),
        getString('indexing-configChangeUpdate'),
        getString('indexing-configChangeRebuild'),
        getString('indexing-configChangeCancel'),
      );
    });
    autoIndexManager.setStartupRebuildCallback(async () => {
      // The startup three-choice prompt already confirmed the destructive
      // action, so reuse the rebuild body without opening a second prompt.
      await this.performRebuild(false);
    });
    autoIndexManager.setCompletionCallback(() => {
      // Baseline-only and unchanged validations do not write embeddings, but
      // they can still make an old-looking status current. Drop the entire
      // UI cache so checked_at is visible immediately after startup or an
      // explicit scoped reconciliation.
      itemTreeIndexColumn.invalidate();
    });

    // Set vector store reference for checking indexed status
    if (this.vectorStore) {
      autoIndexManager.setVectorStore(this.vectorStore);
    }
    indexFreshnessNotifier.start(() => autoIndexManager.restoreIndexedFreshness());

    this.logger.info('Startup index reconciliation initialized');
  }

  private async initializeCore(): Promise<void> {
    this.logger.info('Initializing core modules...');

    // Get SQLite vector store (lazy initialization)
    this.vectorStore = getVectorStore();

    // Don't initialize store on startup - do it lazily on first use
    this.logger.info('Vector store configured (will initialize on first use)');

    this.initialized = true;
  }

  /**
   * Ensure vector store is initialized before use
   */
  private async ensureStoreReady(): Promise<void> {
    if (!this.vectorStore) {
      this.logger.info('Getting vector store...');
      this.vectorStore = getVectorStore();
      // Update auto-index manager with vector store reference
      autoIndexManager.setVectorStore(this.vectorStore);
    }

    if (!this.vectorStore.isReady()) {
      this.logger.info('Initializing vector store...');
      try {
        await this.vectorStore.init();
        this.logger.info('Vector store initialized');
      } catch (error: any) {
        this.logger.error(`Vector store init failed: ${error?.message || error}`);
        throw error;
      }
    }
  }

  /**
   * Prevent old and new chunk strategies from sharing one model partition.
   * Existing vectors remain searchable; only writes and startup reconciliation
   * pause until the user explicitly clears/rebuilds the index.
   */
  private async ensureChunkStrategyWritable(
    showNotice: boolean,
    forceNotice = false,
  ): Promise<boolean> {
    const status = await this.getActiveChunkStrategyStatus();
    if (!status || !this.vectorStore) return false;
    const { modelId, metadataKey, state } = status;

    if (state === 'initialize') {
      await this.vectorStore.setMetadata(metadataKey, CHUNK_STRATEGY_VERSION);
      autoIndexManager.setChunkStrategyBlocked(false);
      this.chunkStrategyNoticeShown = false;
      return true;
    }

    const current = state === 'current';
    autoIndexManager.setChunkStrategyBlocked(!current);
    if (!current && showNotice && (forceNotice || !this.chunkStrategyNoticeShown)) {
      this.chunkStrategyNoticeShown = true;
      this.showDismissibleNotice(getString('indexing-chunkStrategyRebuildRequired'));
    }
    return current;
  }

  /** Read the active model's partition state without mutating its marker. */
  private async getActiveChunkStrategyStatus(): Promise<{
    modelId: string;
    metadataKey: string;
    state: ChunkStrategyState;
  } | null> {
    await this.ensureStoreReady();
    if (!this.vectorStore) return null;

    const modelId = getActiveModelId();
    const metadataKey = `chunk_strategy_version:${modelId}`;
    const stats = await this.vectorStore.getPerModelStats();
    const chunkCount = stats.find(stat => stat.modelId === modelId)?.chunks ?? 0;
    const storedVersion = Number(await this.vectorStore.getMetadata(metadataKey));
    return {
      modelId,
      metadataKey,
      state: assessChunkStrategyState(
        chunkCount,
        Number.isFinite(storedVersion) ? storedVersion : undefined,
      ),
    };
  }

  onMainWindowLoad(window: Window): void {
    this.logger.info('Main window loaded');
    // Menu is registered via MenuManager in onStartup, no need to re-register here
  }

  onMainWindowUnload(window: Window): void {
    this.logger.info('Main window unloading');
    // MenuManager handles cleanup automatically
  }

  /**
   * Handle preference pane events
   */
  async onPrefsEvent(type: string, data: any): Promise<void> {
    switch (type) {
      case 'load':
        this.logger.info('Preference pane loaded');
        await preferencesManager.init(data.window);
        break;
      case 'unload':
        this.logger.info('Preference pane unloaded');
        preferencesManager.destroy();
        break;
      case 'updateModeCards':
        preferencesManager.updateModeCards();
        break;
      default:
        break;
    }
  }

  /**
   * Register context menu items
   * Note: MenuManager API requires l10nID (localization) for labels.
   * Using XUL injection for now as it works with plain text labels.
   * Reference: https://www.zotero.org/support/dev/zotero_8_for_developers
   */
  private registerContextMenu(): void {
    const Z = getZotero();
    if (!Z) return;

    // Item context menu actions still use XUL injection.
    this.registerWithXUL(Z);

    // Collection actions belong in the collection tree context menu.
    this.registerCollectionContextMenu(Z);
  }

  /**
   * Register the collection-specific action in the collection tree menu.
   */
  private registerCollectionContextMenu(Z: any): void {
    try {
      const win = Z.getMainWindow();
      if (!win) {
        this.logger.warn('No main window available for collection menu registration');
        return;
      }

      win.MozXULElement.insertFTLIfNeeded('zotseek-menu.ftl');

      if (!Z.MenuManager) {
        this.logger.warn('MenuManager not available - skipping collection menu registration');
        return;
      }

      if (this.collectionMenuRegistrationID) return;

      this.collectionMenuRegistrationID = Z.MenuManager.registerMenu({
        menuID: 'zotseek-index-collection-context',
        pluginID: this.info?.id || 'zotseek@zotero.org',
        target: 'main/library/collection',
        menus: [
          {
            menuType: 'menuitem',
            l10nID: 'zotseek-menuCollection-index',
            icon: 'chrome://zotseek/content/icons/icon-toolbar.svg',
            onCommand: () => {
              void this.onIndexCollection();
            },
          },
          {
            menuType: 'menuitem',
            l10nID: 'zotseek-menuCollection-generateBriefs',
            icon: 'chrome://zotseek/content/icons/icon-toolbar.svg',
            onShowing: (_event: any, context: any) => {
              context.setVisible(briefService.isEnabled());
            },
            onCommand: () => {
              void this.onGenerateCollectionBriefs();
            },
          },
        ],
      });

      this.logger.info('Collection context menu registered successfully');
    } catch (error) {
      this.logger.error('Failed to register collection context menu:', error);
    }
  }

  /**
   * Register menus using XUL element injection
   */
  private registerWithXUL(Z: any): void {
    this.logger.info('Registering menus via XUL injection');

    const win = Z.getMainWindow();
    if (!win) {
      this.logger.warn('No main window available for XUL injection');
      return;
    }

    const doc = win.document;
    const itemMenu = doc.getElementById('zotero-itemmenu');

    if (!itemMenu) {
      this.logger.warn('Could not find zotero-itemmenu');
      return;
    }

    // Remove entries created by older builds before the idempotency check.
    // This also handles in-process plugin reloads where the existing XUL nodes
    // can outlive the code that originally registered them.
    for (const obsoleteId of ['zotseek-open-dialog', 'zotseek-index-library']) {
      doc.getElementById(obsoleteId)?.remove();
    }

    // Check if already registered
    if (doc.getElementById('zotseek-find-similar')) {
      this.logger.debug('Context menu already registered');
      return;
    }

    // Create separator
    const separator = doc.createXULElement('menuseparator');
    separator.id = 'zotseek-separator';

    // Create "Find Similar Documents" menu item
    const findSimilarItem = doc.createXULElement('menuitem');
    findSimilarItem.id = 'zotseek-find-similar';
    findSimilarItem.setAttribute('label', getString('menu-findSimilar'));
    findSimilarItem.addEventListener('command', () => this.onFindSimilar());

    // Create "Index Selected" menu item
    const indexSelectedItem = doc.createXULElement('menuitem');
    indexSelectedItem.id = 'zotseek-index-selected';
    indexSelectedItem.setAttribute('label', getString('menu-indexSelected'));
    indexSelectedItem.addEventListener('command', () => this.onIndexSelected());

    // Create "Remove from Index" menu item
    const removeFromIndexItem = doc.createXULElement('menuitem');
    removeFromIndexItem.id = 'zotseek-remove-from-index';
    removeFromIndexItem.setAttribute('label', getString('menu-removeFromIndex'));
    removeFromIndexItem.addEventListener('command', () => this.onRemoveFromIndex());

    const generateBriefItem = doc.createXULElement('menuitem');
    generateBriefItem.id = 'zotseek-generate-brief';
    generateBriefItem.setAttribute('label', getString('menu-generateBrief'));
    generateBriefItem.addEventListener('command', () => this.onGenerateSelectedBrief());
    const updateBriefVisibility = () => {
      generateBriefItem.hidden = !briefService.isEnabled();
    };
    updateBriefVisibility();
    itemMenu.addEventListener('popupshowing', updateBriefVisibility);
    this.briefItemMenuPopup = itemMenu;
    this.briefItemMenuShowing = updateBriefVisibility;

    itemMenu.appendChild(separator);
    itemMenu.appendChild(findSimilarItem);
    itemMenu.appendChild(indexSelectedItem);
    itemMenu.appendChild(removeFromIndexItem);
    itemMenu.appendChild(generateBriefItem);

    this.logger.info('Context menu registered successfully');
  }

  /**
   * Register the preference pane
   * Reference: https://www.zotero.org/support/dev/zotero_7_for_developers#preference_panes
   */
  private registerPreferencePane(): void {
    const Z = getZotero();
    if (!Z || !Z.PreferencePanes) {
      this.logger.warn('Zotero.PreferencePanes not available');
      return;
    }

    try {
      Z.PreferencePanes.register({
        pluginID: this.info?.id || 'zotseek@zotero.org',
        src: `${this.info?.rootURI || 'chrome://zotseek/'}content/preferences.xhtml`,
        label: getString('pref-title'),
        image: `${this.info?.rootURI || 'chrome://zotseek/'}content/icons/favicon.png`,
      });
      this.logger.info('Preference pane registered successfully');
    } catch (error) {
      this.logger.error(`Failed to register preference pane: ${error}`);
    }
  }

  /**
   * Public method to clear the index (called from preferences pane)
   */
  public async clearIndex(): Promise<void> {
    if (this.indexOperationActive || this.indexing) {
      this.showAlert(getString('indexing-alreadyInProgress'));
      return;
    }
    const Z = getZotero();

    const confirmed = openIndexConfirmationPrompt(
      Services?.prompt,
      Z?.getMainWindow(),
      getString('indexing-clearConfirmTitle'),
      getString('indexing-clearConfirmMsg'),
      getString('indexing-clearConfirmButton'),
      getString('indexing-confirmCancel'),
    );

    if (!confirmed) return;

    // Create stable progress window for clearing
    const progressWindow = new StableProgressWindow({
      title: getString('indexing-clearTitle'),
    });

    try {
      progressWindow.updateProgress(getString('indexing-initStorage'), null);
      await this.ensureStoreReady();

      if (this.vectorStore) {
        progressWindow.updateProgress(getString('indexing-deletingAll'), 50);
        await this.vectorStore.clear();
        await this.ensureChunkStrategyWritable(false);
        itemTreeIndexColumn.invalidate();

        progressWindow.complete(getString('indexing-clearedSuccess'));
        this.logger.info('Index cleared via preferences');

        // Show additional alert for confirmation
        setTimeout(() => {
          this.showAlert(getString('indexing-clearedMsg'));
        }, 500);
      }
    } catch (error: any) {
      this.logger.error(`Failed to clear index: ${error}`);
      progressWindow.error(`Failed to clear index: ${error.message || error}`, true);
      this.showAlert(`Failed to clear index: ${error.message || error}`);
    }
  }

  /**
   * Public method to index all libraries (called from preferences pane)
   */
  public indexLibrary(): Promise<void> {
    return this.onIndexLibrary();
  }

  /** Run the same one-shot reconciliation used after startup. */
  public async checkForIndexUpdates(): Promise<import('./core/auto-index-manager').StartupCheckResult> {
    await this.ensureStoreReady();
    if (!this.ensureOperationalModel(true)) {
      await this.vectorStore?.prepareLexicalIndex();
      return {
        checked: 0, indexedNew: 0, rebuilt: 0, notesUpdated: 0,
        baselined: 0, removed: 0, unchanged: 0, outdated: 0, failed: 0, skipped: true, paused: false,
      };
    }
    if (!await this.ensureChunkStrategyWritable(true)) {
      await this.vectorStore?.prepareLexicalIndex();
      return {
        checked: 0, indexedNew: 0, rebuilt: 0, notesUpdated: 0,
        baselined: 0, removed: 0, unchanged: 0, outdated: 0, failed: 0, skipped: true, paused: false,
      };
    }
    if (this.vectorStore) autoIndexManager.setVectorStore(this.vectorStore);
    return autoIndexManager.runNow();
  }

  public async refreshChunkStrategyState(showNotice = true): Promise<boolean> {
    return this.ensureChunkStrategyWritable(showNotice);
  }

  /**
   * Public method to rebuild the index (clear + reindex)
   * This ensures the new indexing mode setting is applied
   */
  public async rebuildIndex(): Promise<void> {
    if (this.indexOperationActive || this.indexing) {
      this.showAlert(getString('indexing-alreadyInProgress'));
      return;
    }
    if (!this.ensureOperationalModel(true)) return;
    const Z = getZotero();
    const strategyStatus = await this.getActiveChunkStrategyStatus();
    if (!strategyStatus) return;
    const cloudRuntime = getActiveModel().runtime === 'cloud';
    const strategyMigration = strategyStatus.state === 'rebuild-required';

    if (cloudRuntime && !strategyMigration) {
      await this.performCloudRebuild(true);
      return;
    }

    if (cloudRuntime) {
      const target = await this.getLibraryIndexTarget();
      if (!Z || !target) return;
      const exclusionPolicy = readIndexExclusionPolicy(Z);
      const eligibleCount = target.items.filter(item =>
        item?.isRegularItem?.() && !isItemExcludedFromIndex(item, exclusionPolicy)
      ).length;
      const confirmed = openIndexConfirmationPrompt(
        Services?.prompt,
        Z.getMainWindow(),
        getString('indexing-cloudRebuildConfirmTitle'),
        getString('indexing-cloudStrategyRebuildConfirmMsg', {
          count: eligibleCount,
          scope: target.scopeLabel,
        }),
        getString('indexing-rebuildConfirmButton'),
        getString('indexing-confirmCancel'),
      );
      if (!confirmed) return;

      // The Cloud-specific prompt already confirms scope, deletion, and cost.
      await this.performRebuild(false, true);
      return;
    }

    const confirmed = openIndexConfirmationPrompt(
      Services?.prompt,
      Z?.getMainWindow(),
      getString('indexing-rebuildConfirmTitle'),
      getString('indexing-rebuildConfirmMsg'),
      getString('indexing-rebuildConfirmButton'),
      getString('indexing-confirmCancel'),
    );

    if (!confirmed) return;

    await this.performRebuild(true);
  }

  /** Clear and rebuild, optionally retaining the existing scope confirmation. */
  private async performRebuild(
    confirmIndexScope: boolean,
    cloudStrategyMigrationConfirmed = false,
  ): Promise<void> {
    if (!this.ensureOperationalModel(true)) return;
    const strategyStatus = await this.getActiveChunkStrategyStatus();
    if (!strategyStatus) return;
    const cloudRuntime = getActiveModel().runtime === 'cloud';
    if (cloudRuntime &&
        strategyStatus.state !== 'rebuild-required') {
      await this.performCloudRebuild(confirmIndexScope);
      return;
    }
    if (cloudRuntime && !cloudStrategyMigrationConfirmed) {
      // A Cloud strategy migration deletes old coverage and may incur fees.
      // Only rebuildIndex() can provide the dedicated confirmation.
      this.logger.warn('Cloud chunk-strategy migration requires explicit cost confirmation');
      this.showDismissibleNotice(getString('indexing-chunkStrategyRebuildRequired'));
      return;
    }

    const Z = getZotero();
    const target = await this.getLibraryIndexTarget();
    if (!Z || !target) return;
    if (confirmIndexScope) {
      const confirmed = openIndexConfirmationPrompt(
        Services?.prompt,
        Z.getMainWindow(),
        getString('indexing-updateTitle'),
        getString('indexing-updateConfirmMsg', { scope: target.scopeLabel }),
        getString('indexing-updateConfirmButton'),
        getString('indexing-confirmCancel'),
      );
      if (!confirmed) return;
    }

    // A strategy migration cannot mix old/new chunks. Clear only the active
    // model so unrelated model partitions remain intact.
    const progressWindow = new StableProgressWindow({
      title: getString('indexing-rebuildingTitle'),
    });

    try {
      progressWindow.updateProgress(getString('indexing-clearingExisting'), null);
      await this.ensureStoreReady();

      if (this.vectorStore) {
        const activeModelId = strategyStatus.modelId;
        if (getActiveModelId() !== activeModelId) {
          throw new Error('Embedding model changed before rebuild; no index was deleted.');
        }
        await this.vectorStore.deleteModelEmbeddings(activeModelId);
        await this.ensureChunkStrategyWritable(false);
        itemTreeIndexColumn.invalidate();
        this.logger.info(`Model index cleared for rebuild: ${activeModelId}`);
        progressWindow.addLine(getString('indexing-existingCleared'), 'chrome://zotero/skin/tick.png');

        // Close the progress window briefly
        progressWindow.close();

        // The exact scope was resolved and, when requested, confirmed before
        // deletion. indexItems records it for pause/failure recovery.
        await this.indexItems(target.items, target.bulkScope);
      }
    } catch (error: any) {
      this.logger.error(`Failed to rebuild index: ${error}`);
      progressWindow.error(`Failed to rebuild index: ${error.message || error}`, true);
      this.showAlert(`Failed to rebuild index: ${error.message || error}`);
    }
  }

  /**
   * Public method to refresh stats in the preferences pane
   */
  public async refreshStats(): Promise<void> {
    const doc = getZotero()?.getMainWindow()?.document;
    if (!doc) return;

    const setText = (id: string, value: string) => {
      const el = doc.getElementById(id);
      if (el) el.textContent = value;
    };

      setText('zotseek-stat-papers', getString('indexing-loading'));

    try {
      const stats = await this.getStats();
      setText('zotseek-stat-papers', stats.indexedPapers.toLocaleString());
      setText('zotseek-stat-chunks', stats.totalChunks.toLocaleString());
      setText('zotseek-stat-avgchunks', stats.avgChunksPerPaper.toString());
      setText('zotseek-stat-storage', stats.storageSize);
      setText('zotseek-stat-dbpath', stats.databasePath || '-');
      setText('zotseek-stat-model', stats.modelId);
      setText('zotseek-stat-lastindexed', stats.lastIndexed);
    } catch (e) {
      this.logger.error(`Failed to refresh stats: ${e}`);
      setText('zotseek-stat-papers', 'Error');
    }
  }

  /**
   * Compact the database to reclaim space after migrations or deletions.
   */
  public async compactDatabase(): Promise<string> {
    await this.ensureStoreReady();
    if (!this.vectorStore) throw new Error('Store not ready');
    if (this.indexing) throw new Error('Cannot compact while indexing is in progress');

    const result = await (this.vectorStore as any).compactDatabase();
    const beforeMB = (result.beforeBytes / (1024 * 1024)).toFixed(1);
    const afterMB = (result.afterBytes / (1024 * 1024)).toFixed(1);
    const savedMB = ((result.beforeBytes - result.afterBytes) / (1024 * 1024)).toFixed(1);
    return `Compacted: ${beforeMB} MB -> ${afterMB} MB (saved ${savedMB} MB)`;
  }

  /**
   * Public method to get index statistics (called from preferences pane)
   */
  public async getStats(): Promise<{
    indexedPapers: number;
    totalChunks: number;
    avgChunksPerPaper: number;
    modelId: string;
    storageSize: string;
    databasePath: string;
    lastIndexed: string;
    lastIndexDuration?: string;
    /** Stable persisted machine value used for comparisons. */
    indexedMode?: string;
    /** @deprecated Compatibility display label; never use for business logic. */
    indexedWithMode?: string;
  }> {
    try {
      this.logger.debug('getStats() called');
      await this.ensureStoreReady();
      if (!this.vectorStore) {
        this.logger.warn('getStats(): vectorStore is null');
        // Try to get database path even if store is not ready
        let databasePath = '-';
        try {
          const Z = getZotero();
          if (Z?.DataDirectory?.dir) {
            databasePath = Z.DataDirectory.dir + '/zotseek.sqlite';
          }
        } catch (e) { /* ignore */ }

        return {
          indexedPapers: 0,
          totalChunks: 0,
          avgChunksPerPaper: 0,
          modelId: 'none',
          storageSize: '0 KB',
          databasePath,
          lastIndexed: 'Never',
        };
      }

      this.logger.debug('getStats(): Calling vectorStore.getStats()');
      const stats = await this.vectorStore.getStats();
      this.logger.debug(`getStats(): Got stats: ${JSON.stringify(stats)}`);

      // Get the indexing mode that was used to build the current index
      let indexedMode: string | undefined;
      let indexedWithMode: string | undefined;
      try {
        const storedMode = await this.vectorStore.getMetadata('indexingMode');
        if (storedMode) {
          indexedMode = normalizeStoredIndexingMode(storedMode);
          // Keep the historical field for external callers, but the settings
          // UI localizes indexedMode and never compares this display string.
          const compatibilityLabels = {
            abstract: 'Abstract Only',
            notes: 'Metadata + Notes',
            full: 'Full Paper',
          };
          indexedWithMode = indexedMode && isCanonicalIndexingMode(indexedMode)
            ? compatibilityLabels[indexedMode]
            : indexedMode;
        }
      } catch (e) {
        this.logger.debug(`Could not get indexing mode from metadata: ${e}`);
      }

      // Get the last index duration
      let lastIndexDuration: string | undefined;
      try {
        const storedDuration = await this.vectorStore.getMetadata('lastIndexDurationMs');
        if (storedDuration) {
          const durationMs = parseInt(storedDuration, 10);
          if (!isNaN(durationMs)) {
            lastIndexDuration = this.formatDuration(durationMs);
          }
        }
      } catch (e) {
        this.logger.debug(`Could not get last index duration from metadata: ${e}`);
      }

      // Preferences show both saved index files; the raw API keeps its database-only contract.
      const storageBytes = stats.storageUsedBytes + await getLexicalSnapshotSize();
      let storageSize: string;
      if (storageBytes < 1024) {
        storageSize = `${storageBytes} B`;
      } else if (storageBytes < 1024 * 1024) {
        storageSize = `${(storageBytes / 1024).toFixed(1)} KB`;
      } else if (storageBytes < 1024 * 1024 * 1024) {
        storageSize = `${(storageBytes / (1024 * 1024)).toFixed(1)} MB`;
      } else {
        storageSize = `${(storageBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      }

      // Format last indexed date
      let lastIndexed: string;
      if (stats.lastIndexed) {
        lastIndexed = stats.lastIndexed.toLocaleString();
      } else {
        lastIndexed = 'Never';
      }

      // Get database path - use vectorStore method if available, otherwise construct it
      let databasePath = '-';
      try {
        if (this.vectorStore && typeof this.vectorStore.getDatabasePath === 'function') {
          databasePath = this.vectorStore.getDatabasePath();
        } else {
          // Fallback: construct path directly
          const Z = getZotero();
          if (Z?.DataDirectory?.dir) {
            databasePath = Z.DataDirectory.dir + '/zotseek.sqlite';
          }
        }
      } catch (e) {
        this.logger.debug(`Could not get database path: ${e}`);
      }

      return {
        indexedPapers: stats.indexedPapers,
        totalChunks: stats.totalChunks,
        avgChunksPerPaper: stats.avgChunksPerPaper,
        modelId: stats.modelId === 'none' ? 'None' : stats.modelId.replace('Xenova/', ''),
        storageSize,
        databasePath,
        lastIndexed,
        lastIndexDuration,
        indexedMode,
        indexedWithMode,
      };
    } catch (error) {
      this.logger.error(`Failed to get stats: ${error}`);
      // Try to get database path even on error
      let databasePath = '-';
      try {
        const Z = getZotero();
        if (Z?.DataDirectory?.dir) {
          databasePath = Z.DataDirectory.dir + '/zotseek.sqlite';
        }
      } catch (e) { /* ignore */ }

      return {
        indexedPapers: 0,
        totalChunks: 0,
        avgChunksPerPaper: 0,
        modelId: 'Error',
        storageSize: 'Error',
        databasePath,
        lastIndexed: 'Error',
      };
    }
  }

  /**
   * Index selected items for semantic search
   */
  private async onIndexSelected(): Promise<void> {
    if (this.indexOperationActive || this.indexing) {
      this.showAlert(getString('indexing-alreadyInProgress'));
      return;
    }
    if (!this.ensureOperationalModel(true)) return;

    const Z = getZotero();
    if (!Z) return;

    const selectedItems = this.zoteroAPI.getSelectedItems();
    if (selectedItems.length === 0) {
      this.showAlert(getString('indexing-selectItems'));
      return;
    }

    this.logger.info(`Indexing ${selectedItems.length} selected items`);
    const identities = selectedItems
      .map(item => identityFromItem(item))
      .filter((identity): identity is { libraryKey: string; itemKey: string } => identity !== null);
    const scope: BulkScope | undefined = identities.length > 0
      ? { type: 'items', items: identities }
      : undefined;
    await this.indexItems(selectedItems, scope);
  }

  private async ensureBriefGenerationReady(): Promise<boolean> {
    try {
      const status = await briefService.getStatus();
      if (!status.enabled) {
        this.showAlert(getString('brief-disabled'));
        return false;
      }
      // Manual jobs are FIFO and may accept another distinct item while the
      // current item is running.  Collection and prompt jobs remain mutually
      // exclusive with every new entry point.
      if (status.busy && status.busyMode !== 'manual') {
        this.showAlert(getString('brief-busy'));
        return false;
      }
      if (!status.providerSupported || !status.hasCredential || !status.connectionVerified) {
        this.showAlert(getString('brief-connection-required'));
        return false;
      }
      if (!status.consentCurrent) {
        const accepted = Services.prompt.confirm(
          getZotero()?.getMainWindow() || null,
          getString('pref-brief-consent-title'),
          getString('pref-brief-consent-message'),
        );
        if (!accepted) return false;
        briefService.recordConsent();
      }
      return true;
    } catch (error: any) {
      this.showAlert(getString('brief-start-failed', { error: error?.message || error }));
      return false;
    }
  }

  private resolveBriefSelection(item: any): {
    parent: any;
    target: { parent?: any; attachment?: any };
  } | null {
    const Z = getZotero();
    const feedItem = typeof item?.isFeedItem === 'function'
      ? item.isFeedItem() === true
      : item?.isFeedItem === true;
    if (!item || item.deleted === true || item.isDeleted?.() === true
        || feedItem
        || item.inTrash === true) return null;
    if (item.isRegularItem?.() === true) {
      return { parent: item, target: { parent: item } };
    }
    if (item.isAttachment?.() === true && item.isPDFAttachment?.() === true) {
      const parentID = Number(item.parentID ?? item.parentItemID);
      const parent = Number.isSafeInteger(parentID) && parentID > 0
        ? Z?.Items?.get?.(parentID)
        : null;
      const parentFeed = typeof parent?.isFeedItem === 'function'
        ? parent.isFeedItem() === true
        : parent?.isFeedItem === true;
      if (parent?.isRegularItem?.() !== true || parent.deleted === true
          || parent.isDeleted?.() === true || parentFeed) return null;
      return { parent, target: { attachment: item } };
    }
    return null;
  }

  private startBriefProgress(titles: Map<string, string>): void {
    // Manual FIFO entries share one progress window.  Replacing it for every
    // click would orphan the first task's window and lose its title mapping.
    if (this.briefProgressWindow) {
      for (const [key, title] of titles) this.briefTitles.set(key, title);
      return;
    }
    this.briefTitles = new Map(titles);
    let progressWindow: StableProgressWindow;
    const cancel = () => {
      briefService.cancelAll();
      progressWindow.updateProgress(getString('brief-cancelling'), null);
    };
    progressWindow = new StableProgressWindow({
      title: getString('brief-progress-title'),
      closeOnClick: false,
      cancelCallback: cancel,
      cancelOnWindowClose: true,
      stopCallback: () => {
        cancel();
        return true;
      },
      stopLabel: getString('brief-cancel-task'),
      stoppingLabel: getString('brief-cancelling'),
      stopTooltip: getString('brief-cancel-tooltip'),
    });
    this.briefProgressWindow = progressWindow;
  }

  private onBriefProgress(progress: BriefSchedulerProgress): void {
    const window = this.briefProgressWindow;
    if (!window) return;
    const percent = progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;
    const active = progress.activeKeys.slice(0, 3).map(key =>
      getString('brief-progress-active', { title: this.briefTitles.get(key) || key })
    );
    window.updateProgress(
      getString('brief-progress-summary', {
        completed: progress.completed,
        total: progress.total,
        success: progress.counts.success,
        failed: progress.counts.failed,
        skipped: progress.counts.skipped,
        cancelled: progress.counts.cancelled,
      }),
      percent,
      active,
    );
    if (progress.latest) {
      const title = this.briefTitles.get(progress.latest.key) || progress.latest.key;
      const status = getString(`brief-status-${progress.latest.status}`);
      const reasonKey = progress.latest.status === 'skipped' && progress.latest.reason
        ? BRIEF_SKIP_REASON_LABELS[progress.latest.reason]
        : undefined;
      window.addCheckpointLine(reasonKey
        ? getString('brief-progress-latest-with-reason', { title, status, reason: getString(reasonKey) })
        : getString('brief-progress-latest', { title, status }));
    }
    if (progress.total > 0 && progress.completed === progress.total
        && progress.activeKeys.length === 0 && progress.queuedKeys.length === 0) {
      window.complete(getString('brief-progress-complete'), true);
      this.briefProgressWindow = null;
      this.briefTitles.clear();
    }
  }

  private showBriefSummary(results: readonly BriefJobResult[]): void {
    const counts = { success: 0, failed: 0, skipped: 0, cancelled: 0 };
    for (const result of results) counts[result.status]++;
    this.showAlert(getString('brief-summary-message', counts), getString('brief-summary-title'));
  }

  private async onGenerateSelectedBrief(): Promise<void> {
    const selected = this.zoteroAPI.getSelectedItems();
    if (selected.length !== 1) {
      this.showAlert(getString('brief-select-one'));
      return;
    }
    const resolved = this.resolveBriefSelection(selected[0]);
    if (!resolved) {
      this.showAlert(getString('brief-invalid-selection'));
      return;
    }
    const identity = identityFromItem(resolved.parent);
    if (!identity) {
      this.showAlert(getString('brief-invalid-selection'));
      return;
    }
    let hasNotes = false;
    try {
      hasNotes = hasBriefChildNotes(resolved.parent);
    } catch (error: any) {
      this.showAlert(getString('brief-start-failed', { error: error?.message || error }));
      return;
    }
    if (hasNotes && !Services.prompt.confirm(
      getZotero()?.getMainWindow() || null,
      getString('brief-existing-note-title'),
      getString('brief-existing-note-message'),
    )) return;
    if (!await this.ensureBriefGenerationReady()) return;

    const key = `${identity.libraryKey}|${identity.itemKey}`;
    const title = resolved.parent.getField?.('title') || identity.itemKey;
    this.startBriefProgress(new Map([[key, title]]));
    try {
      const result = await briefService.enqueueManual({
        key,
        target: resolved.target,
        allowExistingNotes: hasNotes,
      });
      this.showBriefSummary([result]);
    } catch (error: any) {
      // A duplicate/manual-queue race must not close the window belonging to
      // an already-running FIFO task.
      if (briefService.getBusyMode() !== 'manual') {
        this.briefProgressWindow?.error(getString('brief-start-failed', {
          error: error?.message || error,
        }), true);
        this.briefProgressWindow = null;
      }
      this.showAlert(getString('brief-start-failed', { error: error?.message || error }));
    }
  }

  private async onGenerateCollectionBriefs(): Promise<void> {
    const Z = getZotero();
    const pane = Z?.getActiveZoteroPane?.();
    const collections: any[] = typeof pane?.getSelectedCollections === 'function'
      ? (pane.getSelectedCollections() || [])
      : [pane?.getSelectedCollection?.()].filter(Boolean);
    if (collections.length === 0) {
      this.showAlert(getString('brief-select-collection'));
      return;
    }
    try {
      const items = await collectCollectionItems(
        this.zoteroAPI,
        collections.map(collection => ({
          libraryId: collection.libraryID,
          collectionId: collection.id,
        })),
      );
      const requests: BriefGenerationRequest[] = [];
      const titles = new Map<string, string>();
      const stableSeen = new Set<string>();
      let billableCount = 0;
      for (const item of items) {
        const resolved = this.resolveBriefSelection(item);
        if (!resolved || resolved.target.attachment) continue;
        const identity = identityFromItem(resolved.parent);
        if (!identity) continue;
        const key = `${identity.libraryKey}|${identity.itemKey}`;
        if (stableSeen.has(key)) continue;
        stableSeen.add(key);
        const existing = hasBriefChildNotes(resolved.parent);
        requests.push({
          key,
          target: { parent: resolved.parent },
          ...(existing ? { skipReason: 'existing_note' } : {}),
        });
        if (!existing) billableCount++;
        titles.set(key, resolved.parent.getField?.('title') || identity.itemKey);
      }
      if (requests.length === 0) {
        this.showAlert(getString('brief-no-eligible'));
        return;
      }
      if (billableCount === 0) {
        this.showBriefSummary(requests.map(request => ({
          key: request.key,
          status: 'skipped',
          reason: 'existing_note',
        })));
        return;
      }
      if (!await this.ensureBriefGenerationReady()) return;
      if (!Services.prompt.confirm(
        Z?.getMainWindow?.() || null,
        getString('brief-collection-confirm-title'),
        getString('brief-collection-confirm-message', { count: billableCount }),
      )) return;
      this.startBriefProgress(titles);
      const results = await briefService.runCollection(requests);
      this.showBriefSummary(results);
    } catch (error: any) {
      this.briefProgressWindow?.error(getString('brief-start-failed', {
        error: error?.message || error,
      }), true);
      this.briefProgressWindow = null;
      this.showAlert(getString('brief-start-failed', { error: error?.message || error }));
    }
  }

  /**
   * Index current collection
   * Reference: https://windingwind.github.io/doc-for-zotero-plugin-dev/main/collection-operations.html
   */
  private async onIndexCollection(): Promise<void> {
    if (this.indexOperationActive || this.indexing) {
      this.showAlert(getString('indexing-alreadyInProgress'));
      return;
    }
    if (!this.ensureOperationalModel(true)) return;

    const Z = getZotero();
    if (!Z) return;

    // Get the selected collections using ZoteroPane. Zotero 10 removed the
    // singular getter in favour of a plural one for multi-collection selection;
    // the old name still exists but throws, so feature-detect the new one and
    // fall back for Zotero 8/9, where only one collection can be selected.
    const ZoteroPane = Z.getActiveZoteroPane();
    const collections: any[] = typeof ZoteroPane?.getSelectedCollections === 'function'
      ? (ZoteroPane.getSelectedCollections() || [])
      : [ZoteroPane?.getSelectedCollection()].filter(Boolean);

    if (collections.length === 0) {
      this.showAlert(getString('indexing-selectCollection'));
      return;
    }

    const items = await collectCollectionItems(
      this.zoteroAPI,
      collections.map((c: any) => ({ libraryId: c.libraryID, collectionId: c.id })),
    );

    if (items.length === 0) {
      this.showAlert(collections.length === 1
        ? getString('indexing-emptyCollection', { name: collections[0].name })
        : getString('indexing-emptyCollections', { count: collections.length }));
      return;
    }

    // Keep the single-collection scope shape: it is what 1.19.0 wrote, so a
    // pending marker stays readable across the upgrade, and it gives the
    // resume prompt a collection name instead of a bare count.
    const scope: BulkScope = collections.length === 1
      ? { type: 'collection', libraryId: collections[0].libraryID, collectionId: collections[0].id }
      : {
        type: 'collections',
        collections: collections.map((c: any) => ({ libraryId: c.libraryID, collectionId: c.id })),
      };

    const label = collections.map((c: any) => `"${c.name}"`).join(', ');
    this.logger.info(`Indexing ${collections.length} collection(s) ${label} (${items.length} items)`);
    await this.indexItems(items, scope);
  }

  /**
   * Read the user's index scope preference.
   * 'user' = My Library only, 'all' = all libraries (user + groups).
   */
  private getIndexScope(): 'user' | 'all' {
    const Z = getZotero();
    try {
      const scope = Z?.Prefs.get('zotseek.indexScope', true);
      if (scope === 'all') return 'all';
    } catch (e: any) {
      this.logger.debug(`Could not read indexScope pref: ${e?.message || e}`);
    }
    return 'user';
  }

  /** Resolve the current library scope once so confirmation and execution agree. */
  private async getLibraryIndexTarget(): Promise<{
    items: any[];
    bulkScope: BulkScope;
    scopeLabel: string;
  } | null> {
    const Z = getZotero();
    if (!Z) return null;
    if (this.getIndexScope() === 'all') {
      return {
        items: await this.zoteroAPI.getAllLibraryItems(),
        bulkScope: { type: 'all-libraries' },
        scopeLabel: getString('indexing-scopeAll'),
      };
    }
    const libraryId = Z.Libraries.userLibraryID;
    return {
      items: await this.zoteroAPI.getLibraryItems(libraryId),
      bulkScope: { type: 'library', libraryId },
      scopeLabel: getString('indexing-scopeUser'),
    };
  }

  /**
   * Rebuild Cloud coverage without clearing any model partition first.
   * Each paper is replaced atomically only after all of its embeddings exist.
   */
  private async performCloudRebuild(confirm: boolean): Promise<void> {
    const Z = getZotero();
    const target = await this.getLibraryIndexTarget();
    if (!Z || !target) return;
    const exclusionPolicy = readIndexExclusionPolicy(Z);
    const eligibleCount = target.items.filter(item =>
      item?.isRegularItem?.() && !isItemExcludedFromIndex(item, exclusionPolicy)
    ).length;
    if (confirm) {
      const accepted = openIndexConfirmationPrompt(
        Services?.prompt,
        Z.getMainWindow(),
        getString('indexing-cloudRebuildConfirmTitle'),
        getString('indexing-cloudRebuildConfirmMsg', {
          count: eligibleCount,
          scope: target.scopeLabel,
        }),
        getString('indexing-rebuildConfirmButton'),
        getString('indexing-confirmCancel'),
      );
      if (!accepted) return;
    }
    await this.indexItems(target.items, target.bulkScope, true);
  }

  /**
   * Index all libraries (user + groups)
   */

  private async onIndexLibrary(skipConfirmation = false): Promise<void> {
    if (this.indexOperationActive || this.indexing) {
      this.showAlert(getString('indexing-alreadyInProgress'));
      return;
    }
    if (!this.ensureOperationalModel(true)) return;

    const Z = getZotero();
    if (!Z) return;

    const target = await this.getLibraryIndexTarget();
    if (!target) return;
    const { items, bulkScope, scopeLabel } = target;
    this.logger.info(`Found ${items.length} items to index`);

    if (!skipConfirmation) {
      const confirmed = openIndexConfirmationPrompt(
        Services?.prompt,
        Z.getMainWindow(),
        getString('indexing-updateTitle'),
        getString('indexing-updateConfirmMsg', { scope: scopeLabel }),
        getString('indexing-updateConfirmButton'),
        getString('indexing-confirmCancel'),
      );

      if (!confirmed) return;
    }

    await this.indexItems(items, bulkScope);
  }

  /**
   * Remove selected items from the ZotSeek index
   */
  private async onRemoveFromIndex(): Promise<void> {
    const Z = getZotero();
    if (!Z) return;

    const ZoteroPane = Z.getActiveZoteroPane();
    const selectedItems = ZoteroPane?.getSelectedItems() || [];

    if (selectedItems.length === 0) {
      showQuickNotification(getString('indexing-noItemsSelected'), 'default');
      return;
    }

    try {
      await this.ensureStoreReady();
      if (!this.vectorStore) return;

      let removed = 0;
      for (const item of selectedItems) {
        if (item.isRegularItem()) {
          const identity = identityFromItem(item);
          if (!identity) {
            this.logger.warn(`Cannot resolve stable identity for item ${item.id}; skipping removal`);
            continue;
          }
          await this.vectorStore.deleteItem(identity.libraryKey, identity.itemKey);
          removed++;
        }
      }

      const msg = removed > 0
        ? getString('indexing-removedItems', { count: removed })
        : getString('indexing-notInIndex');
      showQuickNotification(msg, removed > 0 ? 'success' : 'default');
      this.logger.info(msg);
    } catch (error: any) {
      this.logger.error(`Failed to remove from index: ${error?.message || error}`);
      showQuickNotification(getString('indexing-removeFailed'), 'fail');
    }
  }

  /**
   * Find target chunks whose vectors can survive a proven mode-only change.
   * Any missing/legacy fingerprint or simultaneous configuration change falls
   * back to the caller's existing full-embedding path.
   */
  private async prepareModeTransitionReuse(
    extractedItems: ExtractedChunks[],
    targetMode: IndexingMode,
    modelId: string,
  ): Promise<ModeTransitionReuseState> {
    const state: ModeTransitionReuseState = {
      reusableByItem: new Map(),
      reusedChunks: 0,
    };
    if (!this.vectorStore || extractedItems.length === 0) return state;

    const currentConfigFingerprint = autoIndexManager.getConfigFingerprint(targetMode);
    for (const extracted of extractedItems) {
      const libraryKey = libraryKeyFromLocalID(extracted.libraryId);
      if (!libraryKey) continue;
      try {
        const storedFingerprint = await this.vectorStore.getStartupFingerprint(
          libraryKey,
          extracted.itemKey,
          modelId,
        );
        if (!storedFingerprint || !assessModeOnlyIndexConfigTransition(
          storedFingerprint.configFingerprint,
          currentConfigFingerprint,
        )) {
          continue;
        }

        const existing = await this.vectorStore.getItemChunksByIdentity(
          libraryKey,
          extracted.itemKey,
        );
        const plan = planModeTransitionReuse(extracted.chunks, existing, modelId);
        if (plan.reusableByTargetIndex.size > 0) {
          state.reusableByItem.set(extracted.itemId, plan.reusableByTargetIndex);
          state.reusedChunks += plan.reusableByTargetIndex.size;
        }
        this.logger.info(
          `Mode transition reuse for ${libraryKey}/${extracted.itemKey}: ` +
          `${plan.reusableByTargetIndex.size}/${extracted.chunks.length} target chunks reused`,
        );
      } catch (error: any) {
        // Reuse is an optimization. Failure to prove it must never block the
        // established complete replacement path.
        this.logger.warn(
          `Mode transition reuse unavailable for ${libraryKey}/${extracted.itemKey}: ` +
          `${error?.message || error}`,
        );
      }
    }
    return state;
  }

  /** Assess freshness inside the caller's exact scope, then write only changes. */
  private async indexItems(
    items: any[],
    scope?: BulkScope,
    forceFull = false,
  ): Promise<import('./core/auto-index-manager').StartupCheckResult | null> {
    if (!this.ensureOperationalModel(true)) return null;
    if (this.indexOperationActive) {
      this.showAlert(getString('indexing-alreadyInProgress'));
      return null;
    }
    this.indexOperationActive = true;
    try {
      if (!await this.ensureChunkStrategyWritable(true, true)) return null;
      await this.ensureStoreReady();
      if (!this.vectorStore) return null;
      autoIndexManager.setVectorStore(this.vectorStore);
      const itemIdentities = scope ? [] : items
        .map(item => identityFromItem(item))
        .filter((identity): identity is { libraryKey: string; itemKey: string } => identity !== null);
      const recoverableScope: BulkScope | undefined = scope || (itemIdentities.length > 0
        ? { type: 'items', items: itemIdentities }
        : undefined);
      if (shouldRecordBulkIndexScope(recoverableScope, items.length)) {
        try {
          getZotero()?.Prefs.set(BULK_INDEX_PENDING_PREF, JSON.stringify(recoverableScope), true);
        } catch (e: any) {
          this.logger.debug(`Could not persist resume scope: ${e?.message || e}`);
        }
      }
      const purgeMissingScope = scope?.type === 'all-libraries'
        ? 'all' as const
        : scope?.type === 'library'
          ? 'user' as const
          : false;
      const result = await autoIndexManager.reconcileItems(items, {
        purgeMissingScope,
        fullIndexCallback: candidates => this.indexItemsCandidates(candidates, recoverableScope),
        noteIndexCallback: candidates => this.indexNoteChangesSilent(candidates),
        forceFull,
      });
      // The existing explicit update action includes refreshing its keyword index.
      await this.vectorStore?.prepareLexicalIndex();
      if (recoverableScope && shouldClearBulkIndexScope(result)) {
        try {
          const rawPending = getZotero()?.Prefs.get(BULK_INDEX_PENDING_PREF, true) as string | undefined;
          if (rawPending) {
            const pending = JSON.parse(rawPending);
            if (isBulkIndexScope(pending) && shouldClearMatchingBulkIndexScope(
              pending,
              recoverableScope,
              result,
            )) {
              getZotero()?.Prefs.clear(BULK_INDEX_PENDING_PREF, true);
            }
          }
        } catch (error: any) {
          this.logger.debug(`Could not clear completed resume scope: ${error?.message || error}`);
        }
      }
      if (result.paused) return result;
      if (result.skipped) return result;
      const changed = result.indexedNew + result.rebuilt + result.notesUpdated;
      showQuickNotification(
        getString('pref-checkNowResult', {
          checked: result.checked,
          changed,
          removed: result.removed,
        }),
        result.failed > 0 ? 'fail' : 'success',
      );
      return result;
    } catch (error: any) {
      this.logger.error(`Scoped reconciliation failed: ${error?.message || error}`);
      this.showAlert(getString('indexing-failed', { error: error?.message || error }));
      return null;
    } finally {
      this.indexOperationActive = false;
    }
  }

  /** Index candidates already classified as new or needing a full rebuild. */
  private async indexItemsCandidates(items: any[], scope?: BulkScope): Promise<IndexCallbackResult> {
    if (!this.ensureOperationalModel(true)) return { successfulIds: [], paused: false };

    // Explicit indexing actions must fail before opening a progress window and
    // must always explain why, even if startup already displayed this notice.
    try {
      if (!await this.ensureChunkStrategyWritable(true, true)) {
        return { successfulIds: [], paused: false };
      }
    } catch (error: any) {
      this.logger.error(`Indexing preflight failed: ${error}`);
      this.showAlert(getString('indexing-failed', { error: error.message || error }));
      return { successfulIds: [], paused: false };
    }

    this.indexing = true;
    const Z = getZotero();
    const indexingModelId = getActiveModelId();
    const exclusionPolicy = readIndexExclusionPolicy(Z);

    const indexStartTime = Date.now(); // Track total indexing time

    // Checkpoint batch size - save every N items to prevent data loss.
    // Kept small (10) so a cancel or crash mid-batch loses at most ~10 items
    // of extraction/embedding work. Trade-off: more transaction overhead.
    const CHECKPOINT_BATCH_SIZE = 10;
    const successfulItemIds: number[] = [];

    // Create stable progress window using toolkit
    const progressWindow = new StableProgressWindow({
      title: getString('indexing-title'),
      stopLabel: getString('indexing-pauseAction'),
      stoppingLabel: getString('indexing-pausingAction'),
      stopTooltip: getString('indexing-pauseTooltip'),
      stopCallback: () => {
        embeddingPipeline.cancelPendingRequests();
        // Persist even small explicit scopes when the user deliberately pauses.
        // The normal crash-recovery threshold remains unchanged.
        if (scope) {
          try {
            Z?.Prefs.set(BULK_INDEX_PENDING_PREF, JSON.stringify(scope), true);
          } catch (error: any) {
            this.logger.error(`Could not persist paused index scope: ${error?.message || error}`);
            this.showAlert(getString('indexing-failed', { error: error?.message || error }));
            return false;
          }
        } else {
          this.logger.error('Safe indexing stop rejected because no recoverable scope is available');
          return false;
        }
        return true;
      },
    });

    try {
      // Ensure vector store is ready
      progressWindow.updateProgress(getString('indexing-initStorage'), null);
      await this.ensureStoreReady();

      // Get indexing mode
      const indexingMode = getIndexingMode(Z);
      this.logger.info(`Indexing mode: ${indexingMode}`);
      progressWindow.addLine(getString('indexing-mode', { mode: indexingMode }));

      // === PHASE 1: Keep only valid candidates. Freshness was already
      // assessed by AutoIndexManager, so existing items here need rebuilding. ===
      progressWindow.setHeadline(getString('indexing-checking'));
      const itemsToIndex: any[] = [];
      let skippedExcluded = 0;
      for (const item of items) {
        if (isItemExcludedFromIndex(item, exclusionPolicy)) {
          skippedExcluded++;
          continue;
        }
        const identity = identityFromItem(item);
        if (!identity) continue;
        itemsToIndex.push(item);
      }
      if (skippedExcluded > 0) {
        this.logger.info(`Skipped ${skippedExcluded} items excluded by indexing policy`);
        progressWindow.addLine(getString('indexing-skippedExcluded', { count: skippedExcluded }), 'chrome://zotero/skin/tick.png');
      }
      if (itemsToIndex.length === 0) {
        progressWindow.setHeadline(getString('indexing-allIndexed'));
        progressWindow.addLine(getString('indexing-allInIndex', { count: items.length }), 'chrome://zotero/skin/tick.png');
        progressWindow.complete(getString('indexing-nothingToIndex'), true);
        return { successfulIds: [], paused: false };
      }

      // === PHASE 2: Process items in batches with checkpoints ===
      const totalBatches = Math.ceil(itemsToIndex.length / CHECKPOINT_BATCH_SIZE);
      let pipelineInitialized = false;
      let totalItemsIndexed = 0;
      let totalChunksIndexed = 0;
      let totalItemsSkipped = 0; // Items with no extractable content
      let totalItemsTruncated = 0; // Items where maxChunksPerPaper cut content
      const truncatedTitles: string[] = []; // For end-of-run summary log

      this.logger.info(`Processing ${itemsToIndex.length} items in ${totalBatches} batches of ${CHECKPOINT_BATCH_SIZE}`);

      for (let batchStart = 0; batchStart < itemsToIndex.length; batchStart += CHECKPOINT_BATCH_SIZE) {
        await progressWindow.waitIfPaused();
        if (progressWindow.isStopRequested()) {
          throw new Error('Paused by user');
        }
        if (progressWindow.isCancelled()) {
          throw new Error('Cancelled by user');
        }

        const batchEnd = Math.min(batchStart + CHECKPOINT_BATCH_SIZE, itemsToIndex.length);
        const batchItems = itemsToIndex.slice(batchStart, batchEnd);
        const batchNumber = Math.floor(batchStart / CHECKPOINT_BATCH_SIZE) + 1;

        // === STEP 1: Extract chunks for this batch ===
        progressWindow.setHeadline(getString('indexing-batchExtracting', { current: batchNumber, total: totalBatches }));
        this.logger.info(`Batch ${batchNumber}/${totalBatches}: Extracting ${batchItems.length} items`);

        const extractedBatch = await textExtractor.extractChunksFromItems(
          batchItems,
          indexingMode,
          undefined,
          (progress) => {
            if (progressWindow.isStopRequested()) {
              throw new Error('Paused by user');
            }
            if (progressWindow.isCancelled()) {
              throw new Error('Cancelled by user');
            }
            progressWindow.updateProgressWithETA(
              `Batch ${batchNumber}/${totalBatches}: ${progress.currentTitle}`,
              batchStart + progress.current,
              itemsToIndex.length
            );
          }
        );

        const batchSkipped = batchItems.length - extractedBatch.length;
        totalItemsSkipped += batchSkipped;

        if (progressWindow.isStopRequested()) {
          throw new Error('Paused by user');
        }

        // === STEP 2: Reuse exact mode-transition vectors, then embed only the rest ===
        const transitionReuse = await this.prepareModeTransitionReuse(
          extractedBatch,
          indexingMode,
          indexingModelId,
        );
        const batchChunks: Array<{ id: string; text: string; title: string }> = [];
        for (const extracted of extractedBatch) {
          const reusable = transitionReuse.reusableByItem.get(extracted.itemId);
          for (const chunk of extracted.chunks) {
            if (reusable?.has(chunk.index)) continue;
            batchChunks.push({
              id: `${extracted.itemId}_${chunk.index}`,
              text: chunk.embedText ?? chunk.text,
              title: extracted.title,
            });
          }
        }

        progressWindow.setHeadline(getString('indexing-batchEmbedding', { current: batchNumber, total: totalBatches }));
        this.logger.info(
          `Batch ${batchNumber}/${totalBatches}: Reusing ${transitionReuse.reusedChunks} chunks, ` +
          `embedding ${batchChunks.length} chunks`,
        );

        let embeddingMap = new Map<string, { embedding: number[]; modelId: string }>();
        let failedChunks = 0;
        let failedItems = new Set<string>();
        if (batchChunks.length > 0) {
          if (!pipelineInitialized) {
            embeddingPipeline.reset();
            progressWindow.updateProgress(getString('indexing-loadingModel'), null);
            await embeddingPipeline.init();
            if (embeddingPipeline.getModelId() !== indexingModelId) {
              throw new Error('Embedding model changed while the indexing batch was starting.');
            }
            pipelineInitialized = true;
            this.logger.info('Embedding pipeline initialized (Transformers.js)');
            progressWindow.addLine(getString('indexing-modelLoaded'), 'chrome://zotero/skin/tick.png');
          }
          const embedded = await embedChunks(
            batchChunks,
            async (processed) => {
              await progressWindow.waitIfPaused();
              if (progressWindow.isStopRequested()) {
                throw new Error('Paused by user');
              }
              if (progressWindow.isCancelled()) {
                throw new Error('Cancelled by user');
              }
              progressWindow.updateProgressWithETA(
                getString('indexing-batchEmbeddingChunks', { current: batchNumber, total: totalBatches }),
                batchStart + Math.floor((processed / batchChunks.length) * batchItems.length),
                itemsToIndex.length
              );
            },
            indexingModelId,
          );
          embeddingMap = embedded.embeddings;
          failedChunks = embedded.failedChunks;
          failedItems = embedded.failedItems;
        }

        if (progressWindow.isStopRequested()) {
          throw new Error('Paused by user');
        }
        if (getActiveModelId() !== indexingModelId) {
          throw new Error('Embedding model changed before the indexing batch could be saved.');
        }

        if (failedChunks > 0) {
          const itemList = Array.from(failedItems).join(', ');
          this.logger.warn(`Batch ${batchNumber}: ${failedChunks} chunks failed embedding and were skipped in: ${itemList}`);
          progressWindow.addLine(getString('indexing-chunksFailed', { count: failedChunks, items: itemList }));
        }

        // === STEP 3: Save this batch (CHECKPOINT) ===
        progressWindow.setHeadline(getString('indexing-batchSaving', { current: batchNumber, total: totalBatches }));

        const batchEmbeddings: PaperEmbedding[] = [];
        const batchSuccessfulIds: number[] = [];
        for (const extracted of extractedBatch) {
          // The replacement itself is atomic. Check immediately before each
          // item so a stop request cannot drain the rest of an embedded batch.
          if (progressWindow.isStopRequested()) {
            throw new Error('Paused by user');
          }
          const libraryKey = libraryKeyFromLocalID(extracted.libraryId);
          if (!libraryKey) {
            this.logger.warn(`[bulk-index] Cannot resolve libraryKey for item ${extracted.itemId} (libraryId=${extracted.libraryId}); skipping item`);
            totalItemsSkipped++;
            continue;
          }
          const itemEmbeddings: PaperEmbedding[] = [];
          const indexedAt = new Date().toISOString();
          const reusable = transitionReuse.reusableByItem.get(extracted.itemId);
          for (const chunk of extracted.chunks) {
            const embeddingKey = `${extracted.itemId}_${chunk.index}`;
            const embeddingResult = embeddingMap.get(embeddingKey);
            const reusedEmbedding = reusable?.get(chunk.index);
            if (embeddingResult || reusedEmbedding) {
              itemEmbeddings.push({
                itemId: extracted.itemId,
                chunkIndex: chunk.index,
                libraryKey,
                itemKey: extracted.itemKey,
                libraryId: extracted.libraryId,
                title: extracted.title,
                abstract: extracted.abstract || undefined,
                chunkText: chunk.text,
                sectionPaths: chunk.sectionPaths,
                pdfAttachmentKey: chunk.pdfAttachmentKey,
                textSource: chunk.type,
                embedding: embeddingResult?.embedding || reusedEmbedding!.embedding,
                modelId: embeddingResult?.modelId || reusedEmbedding!.modelId,
                indexedAt,
                contentHash: extracted.contentHash,
                pageNumber: chunk.pageNumber,
                paragraphIndex: chunk.paragraphIndex,
                startChar: chunk.startChar,
                endChar: chunk.endChar,
                wasTruncated: extracted.wasTruncated,
                pagesIndexed: extracted.pagesIndexed,
                pagesTotal: extracted.pagesTotal,
              });
            }
          }
          if (itemEmbeddings.length !== extracted.chunks.length || itemEmbeddings.length === 0) {
            // Never destroy a complete old index when even one replacement
            // embedding is missing. The freshness tracker remains dirty.
            totalItemsSkipped++;
            continue;
          }

          await this.vectorStore!.replaceItemModelChunks(itemEmbeddings);
          batchEmbeddings.push(...itemEmbeddings);
          batchSuccessfulIds.push(extracted.itemId);
          successfulItemIds.push(extracted.itemId);

          if (extracted.wasTruncated) {
            totalItemsTruncated++;
            truncatedTitles.push(extracted.title);
            const coverage = extracted.pagesTotal > 0
              ? `${extracted.pagesIndexed}/${extracted.pagesTotal} pages`
              : `${extracted.chunks.length} chunks`;
            this.logger.warn(
              `⚠ Truncated at chunk limit: "${extracted.title}" (${coverage}). ` +
              `Increase Max Chunks per Paper or switch to Summary mode to capture full content.`
            );
          }
        }

        itemTreeIndexColumn.invalidate(batchSuccessfulIds);
        totalItemsIndexed += batchSuccessfulIds.length;
        totalChunksIndexed += batchEmbeddings.length;

        this.logger.info(`Checkpoint ${batchNumber}/${totalBatches}: Saved ${batchEmbeddings.length} chunks from ${batchSuccessfulIds.length} items`);
        progressWindow.addCheckpointLine(getString('indexing-checkpoint', { current: batchNumber, total: totalBatches, items: batchSuccessfulIds.length, chunks: batchEmbeddings.length }));
      }

      if (progressWindow.isStopRequested()) {
        throw new Error('Paused by user');
      }

      // Global legacy metadata is only safe to advance when every candidate
      // completed. Per-item fingerprints preserve mixed progress, but an old
      // fingerprint-less item still relies on this value after a restart.
      if (successfulItemIds.length === itemsToIndex.length) {
        await this.vectorStore!.setMetadata('indexingMode', indexingMode);
        this.logger.info(`Stored indexing mode '${indexingMode}' in metadata`);
      } else {
        this.logger.warn(
          `Indexing mode metadata remains unchanged because only ` +
          `${successfulItemIds.length}/${itemsToIndex.length} candidates completed`,
        );
      }

      // Calculate and store indexing duration
      const indexDurationMs = Date.now() - indexStartTime;
      await this.vectorStore!.setMetadata('lastIndexDurationMs', String(indexDurationMs));
      this.logger.info(`Indexing completed in ${indexDurationMs}ms`);

      // Calculate stats for display
      const avgChunksPerItem = totalItemsIndexed > 0
        ? Math.round((totalChunksIndexed / totalItemsIndexed) * 10) / 10
        : 0;

      // Format duration for display
      const durationFormatted = this.formatDuration(indexDurationMs);

      // Show completion
      progressWindow.setHeadline(getString('indexing-complete'));
      progressWindow.addLine(getString('indexing-completeMode', { mode: indexingMode }), 'chrome://zotero/skin/tick.png');
      progressWindow.addLine(getString('indexing-completeNew', { count: totalItemsIndexed }), 'chrome://zotero/skin/tick.png');
      progressWindow.addLine(getString('indexing-completeChunks', { count: totalChunksIndexed }), 'chrome://zotero/skin/tick.png');
      progressWindow.addLine(getString('indexing-completeAvg', { avg: avgChunksPerItem }), 'chrome://zotero/skin/tick.png');
      progressWindow.addLine(getString('indexing-completeDuration', { duration: durationFormatted }), 'chrome://zotero/skin/tick.png');

      if (totalItemsSkipped > 0) {
        progressWindow.addLine(getString('indexing-completeNoContent', { count: totalItemsSkipped }));
      }

      if (totalItemsTruncated > 0) {
        // Show a prominent warning so users notice partial indexing
        progressWindow.addLine(
          getString('indexing-completeTruncated', { count: totalItemsTruncated }),
          'chrome://zotero/skin/cross.png'
        );
        // Repeat to debug log so the warning survives the auto-close
        this.logger.warn(
          `Indexing summary: ${totalItemsTruncated} of ${totalItemsIndexed} items hit the Max Chunks per Paper limit. ` +
          `Affected (first 5): ${truncatedTitles.slice(0, 5).join(' | ')}`
        );
      }

      progressWindow.complete(getString('indexing-completeSuccess'), true);

      return { successfulIds: successfulItemIds, paused: false };

    } catch (error: any) {
      if (progressWindow.isStopRequested()) {
        this.logger.info('Indexing paused by user at a safe checkpoint');
        progressWindow.markStopped();
        showQuickNotification(getString('indexing-paused'), 'default', 5000);
        // The exact scope was persisted by stopCallback. Never clear it here;
        // the startup resume prompt owns the next user decision.
        return { successfulIds: successfulItemIds, paused: true };
      } else if (progressWindow.isCancelled()) {
        this.logger.info('Indexing cancelled by user');
        showQuickNotification(getString('indexing-cancelled'), 'default', 3000);
        // Explicit cancel = user's choice. Don't prompt them to resume on
        // next startup; they can re-trigger Index Library themselves.
        if (scope) {
          try { Z?.Prefs.clear(BULK_INDEX_PENDING_PREF, true); } catch { /* ignore */ }
        }
      } else {
        this.logger.error(`Indexing failed: ${error}`);
        progressWindow.error(getString('indexing-failed', { error: error.message || error }), false);
        // Keep window open for 10 seconds so user can see the error
        setTimeout(() => progressWindow.close(), 10000);
        this.showAlert(getString('indexing-failed', { error: error.message || error }));
        // Leave PENDING_PREF set — user may want to retry on next startup.
      }
      return { successfulIds: successfulItemIds, paused: false };
    } finally {
      this.indexing = false;
    }
  }

  /**
   * Index items silently (for auto-indexing)
   * Shows a progress indicator while running
   */
  private async indexItemsSilent(items: any[], force = false): Promise<number[]> {
    if (this.indexing) {
      this.logger.debug('Indexing already in progress, skipping auto-index');
      return [];
    }

    if (items.length === 0) {
      return [];
    }

    if (!this.ensureOperationalModel(false)) return [];
    if (!await this.ensureChunkStrategyWritable(false)) return [];

    this.indexing = true;
    const Z = getZotero();
    const indexingModelId = getActiveModelId();

    this.logger.info(`Auto-indexing ${items.length} items...`);

    // Show progress window immediately
    const progressWin = new (Z.ProgressWindow as any)({ closeOnClick: true });
    progressWin.changeHeadline(getString('indexing-progressTitle'));

    // Get truncated title for display (max 35 chars)
    const firstTitle = items[0]?.getField?.('title') || 'item';
    const truncTitle = firstTitle.length > 35 ? firstTitle.substring(0, 32) + '...' : firstTitle;
    const displayText = items.length === 1 ? truncTitle : `${items.length} items`;

    const itemRow = new progressWin.ItemProgress(
      'chrome://zotero/skin/spinner-16px.png',
      getString('indexing-progressItem', { title: displayText })
    );
    progressWin.show();
    const successfulItemIds: number[] = [];

    try {
      // Ensure vector store is ready
      await this.ensureStoreReady();

      // Get indexing mode
      const indexingMode = getIndexingMode(Z);

      // Defence in depth: reconciliation already excludes these candidates.
      const exclusionPolicy = readIndexExclusionPolicy(Z);
      const filteredItems = items.filter(item => !isItemExcludedFromIndex(item, exclusionPolicy));
      if (filteredItems.length === 0) {
        this.logger.info('All items excluded by indexing policy');
        try { itemRow.setIcon('chrome://zotero/skin/tick.png'); } catch { /* ignore */ }
        itemRow.setText(getString('indexing-allExcluded'));
        progressWin.startCloseTimer(3000);
        return [];
      }

      // Extract chunks from items
      itemRow.setText(getString('indexing-extracting'));
      const extractedCandidates = await textExtractor.extractChunksFromItems(filteredItems, indexingMode);

      if (extractedCandidates.length === 0) {
        this.logger.info('No content extracted from items');
        try { itemRow.setIcon('chrome://zotero/skin/cross.png'); } catch { /* ignore */ }
        itemRow.setText(getString('indexing-noContent'));
        progressWin.startCloseTimer(3000);
        return [];
      }

      // Compare normalized content before loading the model. In Notes mode this
      // makes formatting-only editor events effectively free after extraction.
      const extractedItems: ExtractedChunks[] = [];
      for (const extracted of extractedCandidates) {
        const libraryKey = libraryKeyFromLocalID(extracted.libraryId);
        if (!libraryKey) continue;
        const indexedForActiveModel = await this.vectorStore!.isIndexedByIdentity(
          libraryKey,
          extracted.itemKey
        );
        const needsReindex = force || !indexedForActiveModel ||
          await this.vectorStore!.needsReindexByIdentity(
            libraryKey,
            extracted.itemKey,
            extracted.contentHash,
          );
        if (needsReindex) {
          extractedItems.push(extracted);
        }
      }

      if (extractedItems.length === 0) {
        this.logger.info('Auto-index skipped: normalized content is unchanged');
        try { itemRow.setIcon('chrome://zotero/skin/tick.png'); } catch { /* ignore */ }
        itemRow.setText(getString('indexing-nothingToIndex'));
        progressWin.startCloseTimer(2000);
        return extractedCandidates.map(item => item.itemId);
      }

      // Count total chunks
      const totalChunks = extractedItems.reduce((sum, item) => sum + item.chunks.length, 0);
      this.logger.info(`Extracted ${totalChunks} chunks from ${extractedItems.length} items`);

      const transitionReuse = await this.prepareModeTransitionReuse(
        extractedItems,
        indexingMode,
        indexingModelId,
      );

      // Prepare chunks for embedding
      const textsForEmbedding: Array<{ id: string; text: string; title: string }> = [];
      for (const extracted of extractedItems) {
        const reusable = transitionReuse.reusableByItem.get(extracted.itemId);
        for (const chunk of extracted.chunks) {
          if (reusable?.has(chunk.index)) continue;
          textsForEmbedding.push({
            id: `${extracted.itemId}_${chunk.index}`,
            text: chunk.embedText ?? chunk.text,
            title: extracted.title,
          });
        }
      }

      // Generate only missing embeddings. A pure shrinking transition can
      // complete without loading the model at all.
      let embeddingMap = new Map<string, { embedding: number[]; modelId: string }>();
      let failedChunks = 0;
      let failedItems = new Set<string>();
      if (textsForEmbedding.length > 0) {
        itemRow.setText(getString('indexing-progressLoadingModel'));
        embeddingPipeline.reset();
        await embeddingPipeline.init();
        const embedded = await embedChunks(
          textsForEmbedding,
          (processed) => {
            itemRow.setText(getString('indexing-embedding', { current: processed, total: textsForEmbedding.length }));
          },
          indexingModelId,
        );
        embeddingMap = embedded.embeddings;
        failedChunks = embedded.failedChunks;
        failedItems = embedded.failedItems;
      }
      this.logger.info(
        `Mode-aware indexing: reused ${transitionReuse.reusedChunks} chunks, ` +
        `embedded ${textsForEmbedding.length} chunks`,
      );
      if (getActiveModelId() !== indexingModelId) {
        throw new Error('Embedding model changed before auto-index results could be saved.');
      }

      // Store embeddings with chunk metadata
      itemRow.setText(getString('indexing-saving'));
      const paperEmbeddings: PaperEmbedding[] = [];
      let autoTruncatedCount = 0;

      for (const extracted of extractedItems) {
        const libraryKey = libraryKeyFromLocalID(extracted.libraryId);
        if (!libraryKey) {
          this.logger.warn(`[auto-index] Cannot resolve libraryKey for item ${extracted.itemId} (libraryId=${extracted.libraryId}); skipping`);
          continue;
        }
        const itemEmbeddings: PaperEmbedding[] = [];
        const indexedAt = new Date().toISOString();
        const reusable = transitionReuse.reusableByItem.get(extracted.itemId);
        for (const chunk of extracted.chunks) {
          const embeddingKey = `${extracted.itemId}_${chunk.index}`;
          const embeddingData = embeddingMap.get(embeddingKey);
          const reusedEmbedding = reusable?.get(chunk.index);
          if (!embeddingData && !reusedEmbedding) continue;

          itemEmbeddings.push({
            itemId: extracted.itemId,
            chunkIndex: chunk.index,
            libraryKey,
            itemKey: extracted.itemKey,
            libraryId: extracted.libraryId,
            title: extracted.title,
            abstract: extracted.abstract || undefined,
            chunkText: chunk.text,
            sectionPaths: chunk.sectionPaths,
            pdfAttachmentKey: chunk.pdfAttachmentKey,
            textSource: chunk.type,
            embedding: embeddingData?.embedding || reusedEmbedding!.embedding,
            modelId: embeddingData?.modelId || reusedEmbedding!.modelId,
            indexedAt,
            contentHash: extracted.contentHash,
            pageNumber: chunk.pageNumber,
            paragraphIndex: chunk.paragraphIndex,
            startChar: chunk.startChar,
            endChar: chunk.endChar,
            wasTruncated: extracted.wasTruncated,
            pagesIndexed: extracted.pagesIndexed,
            pagesTotal: extracted.pagesTotal,
          });
        }
        if (itemEmbeddings.length !== extracted.chunks.length || itemEmbeddings.length === 0) {
          continue;
        }
        await this.vectorStore!.replaceItemModelChunks(itemEmbeddings);
        paperEmbeddings.push(...itemEmbeddings);
        successfulItemIds.push(extracted.itemId);

        if (extracted.wasTruncated) {
          autoTruncatedCount++;
          const coverage = extracted.pagesTotal > 0
            ? `${extracted.pagesIndexed}/${extracted.pagesTotal} pages`
            : `${extracted.chunks.length} chunks`;
          this.logger.warn(
            `⚠ Auto-index truncated: "${extracted.title}" (${coverage}). ` +
            `Increase Max Chunks per Paper to capture full content.`,
          );
        }
      }

      // Refresh column status for the items we just indexed
      itemTreeIndexColumn.invalidate(successfulItemIds);

      if (failedChunks > 0) {
        const itemList = Array.from(failedItems).join(', ');
        this.logger.warn(`Auto-index: ${failedChunks} chunks failed in: ${itemList}`);
      }
      // Do not advance the legacy global marker when extraction skipped any
      // eligible item. Fingerprint-less indexes still depend on this fallback.
      if (successfulItemIds.length === filteredItems.length) {
        await this.vectorStore!.setMetadata('indexingMode', indexingMode);
      }
      this.logger.info(`Auto-indexed ${successfulItemIds.length} items (${paperEmbeddings.length} chunks, ${failedChunks} failed)`);

      // Show success - use try-catch for setIcon as it may not exist in all Zotero versions
      try { itemRow.setIcon('chrome://zotero/skin/tick.png'); } catch { /* ignore */ }
      itemRow.setText(failedChunks > 0
        ? getString('indexing-chunksIndexedWithFailed', { count: paperEmbeddings.length, failed: failedChunks })
        : getString('indexing-chunksIndexed', { count: paperEmbeddings.length }));

      if (autoTruncatedCount > 0) {
        // Append a partial-content warning so the user sees it before the window auto-closes
        try {
          const warnRow = new progressWin.ItemProgress(
            'chrome://zotero/skin/cross.png',
            getString('indexing-completeTruncated', { count: autoTruncatedCount })
          );
          warnRow.setProgress(100);
        } catch { /* ignore — progress row API can vary across Zotero versions */ }
        progressWin.startCloseTimer(8000);
      } else {
        progressWin.startCloseTimer(3000);
      }

      return successfulItemIds;

    } catch (error: any) {
      this.logger.error(`Auto-indexing failed: ${error?.message || error}`);
      // Show error in progress window - use try-catch for setIcon
      const errMsg = error?.message || 'Unknown error';
      try { itemRow.setIcon('chrome://zotero/skin/cross.png'); } catch { /* ignore */ }
      itemRow.setText(`✗ Error: ${errMsg}`);
      progressWin.startCloseTimer(4000);
      return successfulItemIds;
    } finally {
      this.indexing = false;
    }
  }

  /**
   * Replace note vectors while carrying the active model's existing summary
   * and PDF vectors forward unchanged. No PDF extraction API is called here.
   */
  private async indexNoteChangesSilent(items: any[]): Promise<number[]> {
    if (this.indexing || items.length === 0) return [];
    if (!this.ensureOperationalModel(false)) return [];
    if (!await this.ensureChunkStrategyWritable(false)) return [];
    this.indexing = true;
    const Z = getZotero();
    const indexingModelId = getActiveModelId();
    const progressWin = new (Z.ProgressWindow as any)({ closeOnClick: true });
    progressWin.changeHeadline(getString('indexing-progressTitle'));
    const itemRow = new progressWin.ItemProgress(
      'chrome://zotero/skin/spinner-16px.png',
      getString('indexing-noteUpdate', { count: items.length })
    );
    progressWin.show();
    const successful: number[] = [];

    try {
      await this.ensureStoreReady();
      const exclusionPolicy = readIndexExclusionPolicy(Z);
      const filteredItems = items.filter(item => !isItemExcludedFromIndex(item, exclusionPolicy));
      const extractedItems = await textExtractor.extractChunksFromItems(filteredItems, 'notes');
      const statusIdentities = extractedItems
        .map(extracted => {
          const libraryKey = libraryKeyFromLocalID(extracted.libraryId);
          return libraryKey ? { libraryKey, itemKey: extracted.itemKey } : null;
        })
        .filter((identity): identity is { libraryKey: string; itemKey: string } => identity !== null);
      const statusMap = await this.vectorStore!.getIndexStatusByIdentity(statusIdentities);
      const maxChunks = Math.max(1, Number(Z.Prefs.get('zotseek.maxChunksPerPaper', true) ?? 100));

      const plans: Array<{
        extracted: ExtractedChunks;
        libraryKey: string;
        preservedSummary: PaperEmbedding[];
        preservedPDF: PaperEmbedding[];
        noteChunks: ExtractedChunks['chunks'];
      }> = [];
      const textsForEmbedding: ChunkForEmbedding[] = [];

      for (const extracted of extractedItems) {
        const libraryKey = libraryKeyFromLocalID(extracted.libraryId);
        if (!libraryKey) continue;
        const existing = await this.vectorStore!.getItemChunksByIdentity(
          libraryKey,
          extracted.itemKey
        );
        const preserved = existing
          .filter(chunk => chunk.textSource !== 'note')
          .sort((a, b) => a.chunkIndex - b.chunkIndex);
        if (preserved.length === 0) {
          this.logger.warn(`Cannot preserve non-note chunks for ${extracted.itemKey}; deferring to next startup`);
          continue;
        }

        const preservedSummary = preserved.filter(chunk =>
          ['summary', 'abstract', 'title_only'].includes(chunk.textSource));
        const allPDF = preserved.filter(chunk =>
          !['summary', 'abstract', 'title_only'].includes(chunk.textSource));
        const allNotes = extracted.chunks.filter(chunk => chunk.type === 'note');
        const remainingSlots = Math.max(0, maxChunks - preservedSummary.length);
        let noteCount = 0;
        let pdfCount = 0;
        if (allNotes.length > 0 && allPDF.length > 0) {
          noteCount = Math.min(Math.ceil(remainingSlots / 2), allNotes.length);
          pdfCount = Math.min(remainingSlots - noteCount, allPDF.length);
          let unused = remainingSlots - noteCount - pdfCount;
          const extraNotes = Math.min(unused, allNotes.length - noteCount);
          noteCount += extraNotes;
          unused -= extraNotes;
          pdfCount += Math.min(unused, allPDF.length - pdfCount);
        } else if (allNotes.length > 0) {
          noteCount = Math.min(remainingSlots, allNotes.length);
        } else {
          pdfCount = Math.min(remainingSlots, allPDF.length);
        }
        const noteChunks = allNotes.slice(0, noteCount);
        const preservedPDF = allPDF.slice(0, pdfCount);

        plans.push({ extracted, libraryKey, preservedSummary, preservedPDF, noteChunks });
        noteChunks.forEach((chunk, index) => {
          textsForEmbedding.push({
            id: `startup-note:${extracted.itemId}:${index}`,
            text: chunk.embedText ?? chunk.text,
            title: extracted.title,
          });
        });
      }

      let embeddingMap = new Map<string, { embedding: number[]; modelId: string }>();
      if (textsForEmbedding.length > 0) {
        itemRow.setText(getString('indexing-progressLoadingModel'));
        embeddingPipeline.reset();
        await embeddingPipeline.init();
        const embedded = await embedChunks(textsForEmbedding, processed => {
          itemRow.setText(getString('indexing-embedding', {
            current: processed,
            total: textsForEmbedding.length,
          }));
        }, indexingModelId);
        embeddingMap = embedded.embeddings;
      }

      for (const plan of plans) {
        const { extracted, libraryKey, preservedSummary, preservedPDF, noteChunks } = plan;
        const newNotes: PaperEmbedding[] = [];
        let complete = true;
        for (let index = 0; index < noteChunks.length; index++) {
          const embedded = embeddingMap.get(`startup-note:${extracted.itemId}:${index}`);
          if (!embedded) {
            complete = false;
            break;
          }
          newNotes.push({
            itemId: extracted.itemId,
            chunkIndex: 0,
            libraryKey,
            itemKey: extracted.itemKey,
            libraryId: extracted.libraryId,
            title: extracted.title,
            abstract: extracted.abstract || undefined,
            chunkText: noteChunks[index].text,
            sectionPaths: noteChunks[index].sectionPaths,
            textSource: 'note',
            embedding: embedded.embedding,
            modelId: embedded.modelId,
            indexedAt: new Date().toISOString(),
            contentHash: '',
          });
        }
        if (!complete) continue;

        const now = new Date().toISOString();
        const combined = [...preservedSummary, ...newNotes, ...preservedPDF];
        const contentHash = hashChunkContent(combined.map(chunk => chunk.chunkText || ''));
        const status = statusMap.get(`${libraryKey}|${extracted.itemKey}`);
        const normalized = combined.map((chunk, chunkIndex): PaperEmbedding => ({
          ...chunk,
          itemId: extracted.itemId,
          chunkIndex,
          libraryKey,
          itemKey: extracted.itemKey,
          libraryId: extracted.libraryId,
          title: extracted.title,
          abstract: extracted.abstract || undefined,
          modelId: indexingModelId,
          indexedAt: now,
          contentHash,
          wasTruncated: status?.wasTruncated || extracted.wasTruncated,
          pagesIndexed: status?.pagesIndexed ?? 0,
          pagesTotal: status?.pagesTotal ?? 0,
        }));

        await this.vectorStore!.replaceItemModelChunks(normalized);
        successful.push(extracted.itemId);
      }

      itemTreeIndexColumn.invalidate(successful);
      try { itemRow.setIcon('chrome://zotero/skin/tick.png'); } catch { /* ignore */ }
      itemRow.setText(getString('indexing-noteUpdateComplete', { count: successful.length }));
      progressWin.startCloseTimer(3000);
      return successful;
    } catch (error: any) {
      this.logger.error(`Startup note update failed: ${error?.message || error}`);
      try { itemRow.setIcon('chrome://zotero/skin/cross.png'); } catch { /* ignore */ }
      itemRow.setText(`✗ Error: ${error?.message || 'Unknown error'}`);
      progressWin.startCloseTimer(4000);
      return successful;
    } finally {
      this.indexing = false;
    }
  }

  /**
   * Format duration in milliseconds to human-readable string
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else if (ms < 3600000) {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.round((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    } else {
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.round((ms % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Find papers similar to selected item
   */
  private async onFindSimilar(): Promise<void> {
    this.logger.info('Find Similar Documents triggered');

    if (!this.ensureOperationalModel(true)) return;

    const Z = getZotero();
    if (!Z) return;

    const selectedItems = this.zoteroAPI.getSelectedItems();
    if (selectedItems.length === 0) {
      this.showAlert('Please select an item first.');
      return;
    }

    const item = selectedItems[0];
    const title = item.getField('title');
    this.logger.info(`Finding papers similar to: ${title}`);
    this.logger.info(`Item ID: ${item.id}, Key: ${item.key}, Type: ${typeof item.id}`);

    try {
      // Ensure store is ready
      await this.ensureStoreReady();

      // Check if item is indexed
      const identity = identityFromItem(item);
      this.logger.debug(
        `Checking if item ${identity ? `${identity.libraryKey}/${identity.itemKey}` : item.id} is indexed...`
      );
      const isIndexed = identity
        ? await this.vectorStore!.isIndexedByIdentity(identity.libraryKey, identity.itemKey)
        : false;
      this.logger.debug(`isIndexed result: ${isIndexed}`);

      if (!isIndexed) {
        // Use Services.prompt for Zotero 8 compatibility
        const indexNow = Services.prompt.confirm(
          Z.getMainWindow(),
          'ZotSeek - Item Not Indexed',
          `"${title}" is not indexed yet.\n\nWould you like to index it now?`
        );

        if (indexNow) {
          await this.indexItems([item]);
        } else {
          return;
        }
      }

      // Check if embedding pipeline is ready
      if (!embeddingPipeline.isReady()) {
        // The dialog will show its own loading message
        await embeddingPipeline.init();
      }

      // Open the similar documents dialog
      similarDocumentsWrapper.open(item);

    } catch (error) {
      this.logger.error(`Find similar failed: ${error}`);
      this.showAlert(`Search failed: ${error}`);
    }
  }

  /**
   * Display search results in a dialog
   */
  private showSearchResults(queryTitle: string, results: SearchResult[]): void {
    const Z = getZotero();
    const win = Z?.getMainWindow();
    if (!win) return;

    const resultText = results.map((r, i) =>
      `${i + 1}. [${Math.round(r.similarity * 100)}%] ${r.title}`
    ).join('\n');

    win.alert(
      `Similar to: "${queryTitle}"\n\n` +
      `Found ${results.length} similar papers:\n\n` +
      resultText +
      '\n\n(Click on items in the list to navigate)'
    );

    // Select first result in Zotero (itemId is resolved per-session and may
    // be missing if the local item was deleted; skip in that case).
    if (results.length > 0 && results[0].itemId !== undefined) {
      this.zoteroAPI.selectItem(results[0].itemId);
    }
  }

  /**
   * Show progress (placeholder - will be replaced with proper UI)
   */
  private showProgress(message: string, current: number, total: number): void {
    this.logger.info(`Progress: ${message} (${current}/${total})`);
    // TODO: Show actual progress bar UI
  }

  /** Gate embedding work without substituting the default local model. */
  private ensureOperationalModel(userInitiated: boolean): boolean {
    if (getActiveModelSelectionId() !== SERVER_SLOT_SELECTION_ID) {
      this.serverBackgroundSkipLogged = false;
      return true;
    }

    const result = getLastServerModelConfigLoadResult();
    if (result?.kind === 'ready' && result.model &&
        getActiveModelId() !== SERVER_SLOT_SELECTION_ID) {
      this.serverBackgroundSkipLogged = false;
      return true;
    }

    const issue = getSelectedServerModelConfigurationIssue();
    if (userInitiated) {
      showServerModelConfigurationPromptIfNeeded();
    } else if (!this.serverBackgroundSkipLogged) {
      this.logger.info(
        `Background embedding work skipped: Local Server (${issue?.state || 'NONE'}) is selected; ` +
        `edit ${issue?.path || 'the profile template'}`,
      );
      this.serverBackgroundSkipLogged = true;
    }
    return false;
  }

  /** Show an alert through Zotero's prompt service. */
  private showAlert(message: string, title = 'ZotSeek'): void {
    const Z = getZotero();
    const win = Z?.getMainWindow();
    if (!win) return;

    try {
      // Use Mozilla's prompt service for proper titled dialogs
      const ps = Services.prompt;
      if (ps) {
        ps.alert(win, title, message);
      } else {
        // Fallback to window.alert if Services not available
        win.alert(message);
      }
    } catch (error) {
      this.logger.error('Failed to show alert:', error);
    }
  }

  /**
   * Show an informational prompt that may be dismissed through any standard
   * close path. `alert()` requires an explicit OK acknowledgement in Zotero 9,
   * so its title-bar close button does not dismiss the old-index notice.
   */
  private showDismissibleNotice(message: string, title = 'ZotSeek'): void {
    const Z = getZotero();
    const win = Z?.getMainWindow();
    if (!win) return;

    try {
      openDismissibleNotice(Services.prompt, win, title, message);
    } catch (error) {
      this.logger.error('Failed to show dismissible notice:', error);
    }
  }

  async onShutdown(): Promise<void> {
    this.logger.info('Shutting down plugin');

    // Stop billable Brief work before tearing down windows and shared state.
    briefService.cancelAll();
    await briefService.waitForIdle();
    briefService.setProgressListener(null);
    this.briefProgressWindow?.close();
    this.briefProgressWindow = null;

    // Cancel a scheduled/running startup reconciliation pass.
    autoIndexManager.stop();
    indexFreshnessNotifier.stop();
    metadataIdentityCache.stop();

    // Release the main-thread tokenizer and its bounded text-count cache.
    tokenizerService.reset();

    // Unregister local MCP/REST endpoints and pref observer
    shutdownServerManager();

    // Remove XUL-injected menu elements and toolbar button
    const Z = getZotero();
    const win = Z?.getMainWindow();
    if (win) {
      this.removeXULElements(win);
      toolbarButton.remove(win);
    }

    if (this.collectionMenuRegistrationID && Z?.MenuManager) {
      Z.MenuManager.unregisterMenu(this.collectionMenuRegistrationID);
      this.collectionMenuRegistrationID = null;
    }

    if (this.briefItemMenuPopup && this.briefItemMenuShowing) {
      try {
        this.briefItemMenuPopup.removeEventListener(
          'popupshowing',
          this.briefItemMenuShowing,
        );
      } catch { /* main window may already be gone */ }
    }
    this.briefItemMenuPopup = null;
    this.briefItemMenuShowing = null;

    // Unregister Tools menu and reader toolbar
    toolbarButton.unregisterToolsMenu();
    toolbarButton.unregisterReaderToolbar();

    // Unregister item-tree column
    await itemTreeIndexColumn.unregister();

    if (this.vectorStore) {
      await this.vectorStore.close();
    }
  }

  /**
   * Remove XUL-injected menu elements (fallback cleanup)
   */
  private removeXULElements(window: Window): void {
    const doc = window.document;
    const ids = [
      'zotseek-find-similar',
      'zotseek-open-dialog',
      'zotseek-index-selected',
      'zotseek-index-collection',
      'zotseek-index-library',
      'zotseek-remove-from-index',
      'zotseek-generate-brief',
      'zotseek-separator',
    ];
    for (const id of ids) {
      const el = doc.getElementById(id);
      if (el) el.remove();
    }
    this.logger.debug('XUL elements removed');
  }

  /**
   * Index items that are missing coverage for the currently active embedding
   * model, without touching other models' existing chunks.
   *
   * Called from the preferences pane after the user switches models and
   * confirms the background re-index prompt.
   */
  public async reindexForActiveModel(): Promise<void> {
    if (this.indexOperationActive || this.indexing) {
      this.logger.debug('reindexForActiveModel: indexing already in progress, skipping');
      return;
    }
    if (!this.ensureOperationalModel(true)) return;

    const activeModelId = getActiveModelId();
    const zoteroItems: any[] = [];
    // Reserve the operation while resolving coverage; the shared entry owns
    // the lock once the exact missing-item scope has been handed off.
    this.indexOperationActive = true;
    this.indexing = true;
    try {
      if (!await this.ensureChunkStrategyWritable(true)) return;
      await this.ensureStoreReady();
      if (!this.vectorStore) return;
      const missing = await this.vectorStore.getItemsMissingModel(activeModelId);
      const exclusionPolicy = readIndexExclusionPolicy(getZotero());
      for (const identity of missing) {
        const localId = localItemIDFromIdentity(identity);
        if (localId == null) continue;
        const item = Zotero.Items.get(localId);
        if (!item || isItemExcludedFromIndex(item, exclusionPolicy)) continue;
        zoteroItems.push(item);
      }
    } catch (error: any) {
      this.logger.error(`reindexForActiveModel failed: ${error?.message || error}`);
      this.showAlert(getString('indexing-failed', { error: error?.message || error }));
      return;
    } finally {
      this.indexOperationActive = false;
      this.indexing = false;
    }

    // Never broaden a missing-coverage request to the whole library, or let a
    // model switch during asynchronous discovery redirect paid embedding.
    if (getActiveModelId() !== activeModelId || zoteroItems.length === 0) return;
    // Reconciliation persists fingerprints after successful atomic writes,
    // enabling subsequent mode-only transitions to reuse Summary vectors.
    await this.indexItems(zoteroItems);
  }
  // Public API for other plugins/scripts
  public api = {
    search: (query: string, options?: any) => {
      const issue = getSelectedServerModelConfigurationIssue();
      if (issue) return Promise.reject(new Error(serverModelConfigurationErrorMessage(issue)));
      return searchEngine.search(query, options);
    },
    findSimilar: (itemId: number, options?: any) => {
      const issue = getSelectedServerModelConfigurationIssue();
      if (issue) return Promise.reject(new Error(serverModelConfigurationErrorMessage(issue)));
      return searchEngine.findSimilar(itemId, options);
    },
    indexItems: (items: any[]) => this.indexItems(items),
    getStats: () => this.vectorStore?.getStats() ?? Promise.resolve({ totalPapers: 0, indexedPapers: 0, modelId: 'none', lastIndexed: null, storageUsedBytes: 0 }),
    compactDatabase: () => this.compactDatabase(),
    getReclaimableBytes: () => (this.vectorStore as any)?.getReclaimableBytes?.() ?? Promise.resolve(0),
    isReady: () => this.initialized && embeddingPipeline.isReady(),
    reindexForActiveModel: () => this.reindexForActiveModel(),
    checkForIndexUpdates: () => this.checkForIndexUpdates(),
    refreshChunkStrategyState: (showNotice?: boolean) => this.refreshChunkStrategyState(showNotice),
    getBriefStatus: () => briefService.getStatus(),
    testBriefConnection: () => briefService.testConnection(),
    cancelBriefJobs: () => briefService.cancelAll(),
    customizeBriefPrompts: async (form: any) => {
      const result = await briefService.customizePrompts(form);
      const downloadRecords = result.save?.downloads?.files
        ? Object.values(result.save.downloads.files) as any[]
        : [];
      const files = downloadRecords
        .map((file: any) => ({ path: file.path }))
        .filter(file => typeof file.path === 'string' && file.path.length > 0);
      const outputPath = downloadRecords.find(file => file.status === 'downloaded'
        && typeof file.path === 'string' && file.path.length > 0)?.path
        || files[0]?.path;
      const publicSave = result.save
        ? {
            status: result.save.status,
            downloads: result.save.downloads,
            ...(result.save.publication ? {
              publication: {
                status: result.save.publication.status,
                version: result.save.publication.version,
                error: result.save.publication.error,
              },
            } : {}),
          }
        : undefined;
      return {
        correctedProtocol: result.correctedProtocol,
        ...(publicSave ? { save: publicSave } : {}),
        // The file picker helper accepts a file path and can reveal its
        // containing folder.  Returning the directory here made the wrapper
        // point one level above the actual downloaded prompt files.
        outputPath,
        files,
      };
    },
    cancelBriefPromptCustomization: () => briefService.cancelPromptCustomization(),
    openBriefPromptDownloadLocation: (path: string) => {
      if (!revealFileLocation(path)) {
        throw new Error('Could not reveal the prompt download location.');
      }
    },
  };
}

// Create plugin instance
const addon = new ZotSeekPlugin();

// Attach to Zotero global (like BetterNotes does)
const Z = getZotero();
if (Z) {
  Z.ZotSeek = addon;
  // Exposed for runtime diagnostics/testing via execute_js
  Z.ZotSeek.StableProgressWindow = StableProgressWindow;
}

// Also expose on _globalThis for bootstrap access
if (typeof _globalThis !== 'undefined') {
  _globalThis.addon = addon;
}

/**
 * Preferences pane handler
 * Manages the preference window UI and interactions
 */

import { getZotero } from '../utils/zotero-helper';
import { getString } from '../utils/locale';
import {
  CanonicalIndexingMode,
  hasIndexingModeMismatch,
  isCanonicalIndexingMode,
} from '../utils/indexing-mode';
import { autoIndexManager } from '../core/auto-index-manager';
import {
  getAllModels,
  getActiveModelId,
  getActiveModelSelectionId,
  getModel,
  CLOUD_SLOT_SELECTION_ID,
  DEFAULT_MODEL_ID,
  SERVER_SLOT_SELECTION_ID,
  setActiveModelId,
} from '../core/model-registry';
import {
  ensureModelDownloaded,
  ensureModelInstallDir,
  getModelInstallDir,
  isModelOnDisk,
  removeModelFiles,
} from '../core/model-download';
import { vectorStoreSQLite } from '../core/vector-store-sqlite';
import { embeddingPipeline } from '../core/embedding-pipeline';
import { resolveModelInputPolicy } from '../core/model-input-policy';
import {
  getLastServerModelConfigLoadResult,
  getServerModelConfigPath,
} from '../core/server-model-config';
import {
  revealFileLocation,
  revealServerModelConfigLocation,
  showServerModelConfigurationPromptIfNeeded,
} from './server-model-prompt';
import {
  getLocalModelMenuState,
  getModelDownloadPageUrl,
  openManualModelDownloadGuide,
  openModelDownloadChoicePrompt,
} from './model-download-prompt';
import {
  CLOUD_PROVIDER_OPTIONS,
  getCloudModelSettings,
  hasCurrentCloudConsent,
  isCloudAutoIndexAllowed,
  isCloudConnectionVerified,
  recordCurrentCloudConsent,
  setCloudAutoIndexAllowed,
  setCloudConnectionVerified,
  setCloudModelSettings,
} from '../core/cloud-model-config';
import { CloudEmbeddingClient } from '../core/cloud-embedding-client';
import { cloudCredentialStore, maskCloudApiKey } from '../core/cloud-credential-store';
import { confirmCloudDisclosure, promptForCloudApiKey } from './cloud-model-prompt';

declare const Services: any;
declare const Zotero: any;

/** Re-entrancy guard: prevents two rapid model-change events from racing. */
let modelSwitchInProgress = false;

/**
 * Returns true when the preferences document is still alive and usable.
 * Guards DOM touches after long awaits (e.g. after reindexForActiveModel
 * returns, the user may have closed the prefs window).
 */
function docAlive(doc: any): boolean {
  try { return !!doc && !!doc.getElementById; } catch { return false; }
}

function setCloudStatus(doc: any, message: string): void {
  const status = doc.getElementById('zotseek-cloud-status');
  if (status) status.textContent = message;
}

async function renderCloudSettings(doc: any): Promise<void> {
  const settings = getCloudModelSettings();
  const provider = doc.getElementById('zotseek-cloud-provider') as HTMLSelectElement | null;
  const model = doc.getElementById('zotseek-cloud-model') as HTMLInputElement | null;
  const dimensions = doc.getElementById('zotseek-cloud-dimensions') as HTMLInputElement | null;
  const baseUrl = doc.getElementById('zotseek-cloud-base-url') as HTMLInputElement | null;
  const maxInputTokens = doc.getElementById('zotseek-cloud-max-input-tokens') as HTMLInputElement | null;
  const recommended = doc.getElementById('zotseek-cloud-recommended-chunk-tokens') as HTMLInputElement | null;
  const queryPrefix = doc.getElementById('zotseek-cloud-query-prefix') as HTMLInputElement | null;
  const docPrefix = doc.getElementById('zotseek-cloud-doc-prefix') as HTMLInputElement | null;
  const batchSize = doc.getElementById('zotseek-cloud-batch-size') as HTMLInputElement | null;
  const autoIndex = doc.getElementById('zotseek-cloud-auto-index') as any;
  const preview = doc.getElementById('zotseek-cloud-key-preview');
  if (provider) {
    if (provider.options.length === 0) {
      for (const option of CLOUD_PROVIDER_OPTIONS) {
        const element = doc.createElementNS('http://www.w3.org/1999/xhtml', 'option');
        element.value = option.id;
        element.textContent = option.label;
        provider.appendChild(element);
      }
    }
    provider.value = settings.provider;
  }
  if (model) model.value = settings.modelName;
  if (dimensions) dimensions.value = String(settings.dimensions);
  if (baseUrl) baseUrl.value = settings.baseUrl;
  if (maxInputTokens) maxInputTokens.value = String(settings.maxInputTokens);
  if (recommended) recommended.value = String(settings.recommendedChunkTokens);
  if (queryPrefix) queryPrefix.value = settings.queryPrefix;
  if (docPrefix) docPrefix.value = settings.docPrefix;
  if (batchSize) batchSize.value = String(settings.batchSize);
  if (autoIndex) autoIndex.checked = isCloudAutoIndexAllowed();
  if (preview) {
    try {
      const apiKey = await cloudCredentialStore.get();
      preview.textContent = apiKey
        ? maskCloudApiKey(apiKey)
        : getString('pref-cloudApiKeyMissing');
    } catch (error: any) {
      preview.textContent = getString('pref-cloudSecureStorageError', {
        error: error?.message || error,
      });
    }
  }
  setCloudStatus(
    doc,
    isCloudConnectionVerified()
      ? getString('pref-cloudConnectionVerified')
      : getString('pref-cloudConnectionNotVerified'),
  );
}

function saveCloudSettingsFromUI(doc: any): ReturnType<typeof getCloudModelSettings> | null {
  const provider = doc.getElementById('zotseek-cloud-provider') as HTMLSelectElement | null;
  const baseUrl = doc.getElementById('zotseek-cloud-base-url') as HTMLInputElement | null;
  const model = doc.getElementById('zotseek-cloud-model') as HTMLInputElement | null;
  const dimensions = doc.getElementById('zotseek-cloud-dimensions') as HTMLInputElement | null;
  const maxInputTokens = doc.getElementById('zotseek-cloud-max-input-tokens') as HTMLInputElement | null;
  const queryPrefix = doc.getElementById('zotseek-cloud-query-prefix') as HTMLInputElement | null;
  const docPrefix = doc.getElementById('zotseek-cloud-doc-prefix') as HTMLInputElement | null;
  const batchSize = doc.getElementById('zotseek-cloud-batch-size') as HTMLInputElement | null;
  if (!provider || !baseUrl || !model || !dimensions || !maxInputTokens ||
      !queryPrefix || !docPrefix || !batchSize) return null;
  try {
    const settings = setCloudModelSettings({
      provider: provider.value,
      baseUrl: baseUrl.value,
      modelName: model.value,
      dimensions: Number(dimensions.value),
      maxInputTokens: Number(maxInputTokens.value),
      queryPrefix: queryPrefix.value,
      docPrefix: docPrefix.value,
      batchSize: Number(batchSize.value),
    });
    baseUrl.value = settings.baseUrl;
    model.value = settings.modelName;
    dimensions.value = String(settings.dimensions);
    maxInputTokens.value = String(settings.maxInputTokens);
    batchSize.value = String(settings.batchSize);
    const recommended = doc.getElementById('zotseek-cloud-recommended-chunk-tokens') as HTMLInputElement | null;
    if (recommended) recommended.value = String(settings.recommendedChunkTokens);
    return settings;
  } catch (error: any) {
    setCloudStatus(doc, getString('pref-cloudInvalidConfig', { error: error?.message || error }));
    return null;
  }
}

async function promptAndSaveCloudApiKey(doc: any): Promise<boolean> {
  const apiKey = promptForCloudApiKey(
    Services.prompt,
    doc.defaultView || null,
    getString('pref-cloudApiKeyPromptTitle'),
    getString('pref-cloudApiKeyPromptMessage'),
  );
  if (!apiKey) return false;
  try {
    await cloudCredentialStore.set(apiKey);
    setCloudConnectionVerified(false);
    await renderCloudSettings(doc);
    return true;
  } catch (error: any) {
    setCloudStatus(doc, getString('pref-cloudSecureStorageError', {
      error: error?.message || error,
    }));
    return false;
  }
}

async function testCloudConnection(doc: any): Promise<boolean> {
  const settings = saveCloudSettingsFromUI(doc);
  if (!settings) return false;
  setCloudStatus(doc, getString('pref-cloudTesting'));
  try {
    const apiKey = await cloudCredentialStore.get();
    if (!apiKey) {
      setCloudStatus(doc, getString('pref-cloudApiKeyMissing'));
      return false;
    }
    const client = new CloudEmbeddingClient({
      baseUrl: settings.baseUrl,
      modelName: settings.modelName,
      dimensions: settings.dimensions,
      apiKey,
      batchSize: settings.batchSize,
    });
    await client.probe();
    setCloudConnectionVerified(true);
    if (getActiveModelSelectionId() === CLOUD_SLOT_SELECTION_ID) embeddingPipeline.reset();
    setCloudStatus(doc, getString('pref-cloudConnectionVerified'));
    return true;
  } catch (error: any) {
    setCloudConnectionVerified(false);
    setCloudStatus(doc, getString('pref-cloudTestFailed', { error: error?.message || error }));
    return false;
  }
}

async function prepareCloudSelection(doc: any): Promise<boolean> {
  if (!hasCurrentCloudConsent()) {
    const accepted = confirmCloudDisclosure(
      Services.prompt,
      doc.defaultView || null,
      getString('pref-cloudConsentTitle'),
      getString('pref-cloudConsentMessage'),
    );
    if (!accepted) return false;
    recordCurrentCloudConsent();
  }
  let hasKey = false;
  try { hasKey = await cloudCredentialStore.has(); } catch (error: any) {
    setCloudStatus(doc, getString('pref-cloudSecureStorageError', { error: error?.message || error }));
    return false;
  }
  if (!hasKey && !await promptAndSaveCloudApiKey(doc)) return false;
  if (!isCloudConnectionVerified() && !await testCloudConnection(doc)) return false;
  return true;
}

async function maybePromptReindex(doc: any, modelId: string): Promise<void> {
  const { covered, total } = await vectorStoreSQLite.getCoverage(modelId);
  if (total === 0 || covered >= total) return;
  const missing = total - covered;
  const cloud = getModel(modelId)?.runtime === 'cloud';
  const yes = Services.prompt.confirm(
    doc.defaultView || null,
    cloud ? getString('pref-cloudRebuildTitle') : 'Index remaining items',
    cloud
      ? getString('pref-cloudRebuildMessage', { count: missing })
      : `This model covers ${covered} of ${total} items. Index the remaining ${missing} `
        + `in the background now? You can keep using Zotero while it runs.`,
  );
  if (yes) {
    const zs = (typeof Zotero !== 'undefined') ? (Zotero as any).ZotSeek : null;
    if (zs && zs.api && typeof zs.api.reindexForActiveModel === 'function') {
      await zs.api.reindexForActiveModel();
      // Guard: prefs window may have been closed while reindex ran
      if (docAlive(doc)) await renderCoverage(doc);
    } else {
      if (docAlive(doc)) {
        const statusEl = doc.getElementById('zotseek-embeddingModel-status');
        if (statusEl) statusEl.textContent = 'Could not start indexing; try reopening preferences.';
      }
    }
  }
}

async function populateModelMenu(doc: any): Promise<void> {
  const menu = doc.getElementById('zotseek-pref-embeddingModel');
  if (!menu) return;
  const popup = menu.querySelector('menupopup');
  if (!popup) return;
  popup.replaceChildren();
  for (const m of getAllModels()) {
    if (m.runtime !== 'onnx') continue;
    const onDisk = m.bundled || await isModelOnDisk(m);
    const state = getLocalModelMenuState(m, onDisk);
    const status = state === 'bundled'
      ? getString('pref-modelStatusBundled')
      : state === 'installed'
        ? getString('pref-modelStatusInstalled')
        : getString('pref-modelStatusDownload', { size: m.approxSizeMB });
    const mi = doc.createXULElement('menuitem');
    mi.setAttribute('value', m.id);
    mi.setAttribute(
      'label',
      `${m.label} · ${m.dimensions}d${m.multilingual ? ` · ${getString('pref-modelMultilingual')}` : ''} · ${status}`,
    );
    popup.appendChild(mi);
  }
  const serverConfig = getLastServerModelConfigLoadResult();
  const serverItem = doc.createXULElement('menuitem');
  serverItem.setAttribute('value', SERVER_SLOT_SELECTION_ID);
  const serverLabel = serverConfig?.kind === 'ready' && serverConfig.model
    ? getString('pref-localServerReady', { model: serverConfig.model.serverModelName })
    : getString('pref-localServerState', {
        state: serverConfig?.kind === 'unknown' ? 'UNKNOWN' : 'NONE',
      });
  serverItem.setAttribute('label', serverLabel);
  popup.appendChild(serverItem);

  const cloudItem = doc.createXULElement('menuitem');
  cloudItem.setAttribute('value', CLOUD_SLOT_SELECTION_ID);
  cloudItem.setAttribute(
    'label',
    isCloudConnectionVerified()
      ? getString('pref-cloudSlotReady', { model: getCloudModelSettings().modelName })
      : getString('pref-cloudSlotSetup'),
  );
  popup.appendChild(cloudItem);

  const active = getActiveModelSelectionId();
  const items = popup.querySelectorAll('menuitem');
  for (let i = 0; i < items.length; i++) {
    if (items[i].getAttribute('value') === active) { menu.selectedIndex = i; break; }
  }
}

async function showManualDownloadGuide(doc: any, model: NonNullable<ReturnType<typeof getModel>>): Promise<void> {
  const installDir = getModelInstallDir(model);
  const pageUrl = getModelDownloadPageUrl(model);
  const files = model.files.map((file) => `• ${file}`).join('\n');
  openManualModelDownloadGuide(
    Services.prompt,
    doc.defaultView || null,
    getString('modelDownloadManualTitle'),
    getString('modelDownloadManualMessage', {
      model: model.label,
      page: pageUrl,
      files,
      path: installDir,
    }),
    getString('modelDownloadOpenPage'),
    getString('modelDownloadOpenLocation'),
    getString('modelDownloadClose'),
    () => Zotero.launchURL(pageUrl),
    () => {
      void ensureModelInstallDir(model).then((path) => {
        if (!revealFileLocation(path)) {
          Services.prompt.alert(
            doc.defaultView || null,
            getString('modelDownloadRevealFailedTitle'),
            getString('modelDownloadRevealFailedMessage', { path }),
          );
        }
      }).catch((error: any) => {
        Services.prompt.alert(
          doc.defaultView || null,
          getString('modelDownloadRevealFailedTitle'),
          getString('modelDownloadRevealFailedMessage', {
            path: `${installDir}\n${error?.message || error}`,
          }),
        );
      });
    },
  );
}

function refreshModelInputPolicy(doc: any): void {
  const Z = getZotero();
  if (!Z) return;
  const model = getModel(getActiveModelSelectionId());
  const input = doc.getElementById('zotseek-pref-maxTokens') as HTMLInputElement | null;
  const status = doc.getElementById('zotseek-pref-maxTokensPolicy');
  if (!model) {
    if (input) input.disabled = true;
    if (status) status.textContent = getString('pref-serverModelIncomplete');
    return;
  }
  if (input) input.disabled = false;
  const policy = resolveModelInputPolicy(
    model,
    Z.Prefs.get('zotseek.maxTokens', true),
  );
  if (input) {
    input.min = '50';
    input.max = String(policy.maxInputTokens ?? 8192);
    input.value = String(policy.effectiveChunkTokens);
  }
  if (status) {
    status.textContent = getString('pref-modelInputPolicy', {
      limit: policy.maxInputTokens ?? getString('pref-modelInputUnknown'),
      recommended: policy.recommendedChunkTokens,
    });
  }
}

async function renderCoverage(doc: any): Promise<void> {
  const el = doc.getElementById('zotseek-embeddingModel-coverage');
  if (!el) return;
  el.replaceChildren();
  const text = doc.createElement('span');
  if (getActiveModelSelectionId() === SERVER_SLOT_SELECTION_ID &&
      getLastServerModelConfigLoadResult()?.kind !== 'ready') {
    text.textContent = getString('pref-serverModelIncomplete');
    el.appendChild(text);
    return;
  }
  if (getActiveModelSelectionId() === CLOUD_SLOT_SELECTION_ID &&
      !isCloudConnectionVerified()) {
    text.textContent = getString('pref-cloudConnectionNotVerified');
    el.appendChild(text);
    return;
  }
  const active = getActiveModelId();
  const { covered, total } = await vectorStoreSQLite.getCoverage(active);
  text.textContent = total === 0
    ? 'No items indexed yet.'
    : `${covered} of ${total} items searchable with the active model.`;
  el.appendChild(text);
  // When the active model doesn't cover the whole library yet, offer a button
  // to index the missing items (without having to switch models to get the prompt).
  if (total > 0 && covered < total) {
    const zs = (typeof Zotero !== 'undefined') ? (Zotero as any).ZotSeek : null;
    const busy = !!(zs && zs.indexing);
    const btn = doc.createElement('button') as any;
    btn.style.cssText = 'margin-left:8px;';
    btn.textContent = busy ? 'Indexing in the background...' : `Index remaining ${total - covered}`;
    btn.disabled = busy;
    if (!busy) {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Indexing in the background...';
        try {
          if (zs && zs.api && typeof zs.api.reindexForActiveModel === 'function') {
            await zs.api.reindexForActiveModel();
          }
        } catch { /* progress + errors are surfaced by the indexing UI */ }
        if (docAlive(doc)) await renderCoverage(doc);
      });
    }
    el.appendChild(btn);
  }
}

async function renderManageModels(doc: any): Promise<void> {
  const host = doc.getElementById('zotseek-manageModels');
  if (!host) return;
  host.replaceChildren();
  host.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:6px 12px;align-items:center;';
  const active = getActiveModelId();
  const statsByModel = new Map(
    (await vectorStoreSQLite.getPerModelStats()).map(s => [s.modelId, s]));
  for (const m of getAllModels()) {
    // Cloud configuration and credentials have their own settings card below.
    if (m.runtime === 'cloud') continue;
    if (m.runtime !== 'server') {
      const onDisk = m.bundled || await isModelOnDisk(m);
      if (!onDisk) continue;
    }
    const label = doc.createElement('span');
    const labelText = m.runtime === 'server'
      ? `${m.label.replace(/^Server/, 'Local Server')} · ${m.dimensions}d · via local server (${m.baseUrl})`
      : `${m.label} · ${m.dimensions}d`;
    label.textContent = labelText;
    label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    label.title = labelText;
    // Per-model index statistics (items / chunks / embedding storage).
    const st = statsByModel.get(m.id);
    const statsEl = doc.createElement('span');
    statsEl.style.cssText = 'font-size:11px;opacity:.6;white-space:nowrap;';
    if (st && st.chunks > 0) {
      const mb = st.storageBytes / 1024 / 1024;
      statsEl.textContent = `${st.items} items · ${st.chunks} chunks · ${mb >= 1 ? mb.toFixed(0) + ' MB' : '<1 MB'}`;
    } else {
      statsEl.textContent = 'not indexed';
    }
    const btn = doc.createElement('button') as any;
    const removable = m.runtime !== 'server' && !m.bundled && m.id !== active;
    btn.textContent = m.runtime === 'server' ? 'Configured in JSON' : 'Remove';
    btn.disabled = !removable;
    if (!removable) {
      btn.title = m.runtime === 'server'
        ? 'Edit the server model template and restart Zotero to change this entry'
        : (m.bundled
          ? 'Built-in model, included with ZotSeek and cannot be removed'
          : 'Active model, switch to another model first to remove this one');
    }
    btn.addEventListener('click', async () => {
      const yes = Services.prompt.confirm(null, 'Remove model',
        `Remove ${m.label} files and its embeddings from your library?`);
      if (!yes) return;
      await removeModelFiles(m);
      await vectorStoreSQLite.deleteModelEmbeddings(m.id);
      if (docAlive(doc)) await renderManageModels(doc);
      if (docAlive(doc)) await populateModelMenu(doc);
    });
    const reason = doc.createElement('span');
    reason.textContent = removable
      ? ''
      : (m.runtime === 'server' ? 'Template' : (m.bundled ? 'Built-in' : 'Active'));
    reason.style.cssText = 'font-size:11px;opacity:.6;white-space:nowrap;';
    host.append(label, statsEl, reason, btn);
  }
  const note = doc.createElement('div');
  note.textContent = 'Remove deletes an installed local model and its embeddings. Local Server entries are managed in the JSON template; Cloud is configured below.';
  note.style.cssText = 'font-size:11px;opacity:.6;margin-top:8px;grid-column: 1 / -1;';
  host.appendChild(note);
}

function renderServerTemplateStatus(doc: any): void {
  const result = getLastServerModelConfigLoadResult();
  const path = result?.path || getServerModelConfigPath();
  const pathEl = doc.getElementById('zotseek-server-config-path');
  if (pathEl) pathEl.textContent = path;

  const statusEl = doc.getElementById('zotseek-server-config-status');
  if (!statusEl) return;
  if (!result) {
    statusEl.textContent = getString('pref-serverConfigNotLoaded');
  } else if (result.kind === 'unknown') {
    statusEl.textContent = getString('pref-serverConfigErrors', {
      errors: result.errors.length,
    });
  } else if (result.kind === 'none') {
    statusEl.textContent = getString('pref-serverConfigNone');
  } else {
    statusEl.textContent = getString('pref-serverConfigLoaded', {
      model: result.model?.serverModelName || '',
    });
  }
}

/** Groups open by default; all others start collapsed. */
const DEFAULT_OPEN_GROUPS = new Set(['zotseek-group-status', 'zotseek-group-models']);

let prefsSearchCleanup: (() => void) | null = null;

function applyDefaultGroupStates(doc: any): void {
  const groups = doc.querySelectorAll(
    'details.zotseek-prefs-group, details.zotseek-model-settings',
  );
  for (const g of groups) {
    if (DEFAULT_OPEN_GROUPS.has(g.id)) g.setAttribute('open', '');
    else g.removeAttribute('open');
  }
}

/**
 * Zotero's settings search reveals matching rows by data-search-strings,
 * but content inside a closed details element would stay hidden. While a
 * search term is active, open every group; restore defaults when cleared.
 * If the search field cannot be found (Zotero DOM change), do nothing:
 * groups remain manually collapsible.
 */
function initPrefsGroupSearchSync(doc: any): void {
  try {
    const winDoc = doc.ownerGlobal?.document || doc;
    const searchBox: any = winDoc.getElementById('prefs-search')
      || winDoc.querySelector('search-textbox, input[type="search"]');
    if (!searchBox) return;
    const onInput = () => {
      try {
        if (!docAlive(doc)) return;
        const term = String(searchBox.value || '').trim();
        if (term) {
          const groups = doc.querySelectorAll(
            'details.zotseek-prefs-group, details.zotseek-model-settings',
          );
          for (const g of groups) g.setAttribute('open', '');
        } else {
          applyDefaultGroupStates(doc);
        }
      } catch { /* pane going away; nothing to sync */ }
    };
    searchBox.addEventListener('input', onInput);
    searchBox.addEventListener('command', onInput);
    prefsSearchCleanup = () => {
      try {
        searchBox.removeEventListener('input', onInput);
        searchBox.removeEventListener('command', onInput);
      } catch { /* ignore */ }
      prefsSearchCleanup = null;
    };
    // The pane can be opened while a term is already active; sync now.
    onInput();
  } catch { /* non-fatal: groups still usable manually */ }
}

function teardownPrefsGroupSearchSync(): void {
  if (prefsSearchCleanup) prefsSearchCleanup();
}

class PreferencesManager {
  private window: Window | null = null;
  private logger: any;

  constructor() {
    const Z = getZotero();
    this.logger = {
      info: (msg: string) => Z?.debug(`[ZotSeek] [Preferences] ${msg}`),
      error: (msg: string) => Z?.debug(`[ZotSeek] [ERROR] [Preferences] ${msg}`),
      debug: (msg: string) => Z?.debug(`[ZotSeek] [DEBUG] [Preferences] ${msg}`)
    };
  }

  /**
   * Initialize the preference pane
   */
  async init(window: Window): Promise<void> {
    this.window = window;
    this.logger.info('Initializing preference pane');

    try {
      // Register FTL for localization (linkset in sub-pane XHTML isn't processed)
      (window as any).MozXULElement?.insertFTLIfNeeded('zotseek.ftl');

      // Initialize preferences
      this.initPreferences();

      // Populate model selector, coverage line, and manage-models list
      await populateModelMenu(this.window.document);
      await renderCoverage(this.window.document);
      await renderManageModels(this.window.document);

      // Advanced server models are configured in a profile-side JSON template.
      renderServerTemplateStatus(this.window.document);
      await renderCloudSettings(this.window.document);

      // Keep collapsible groups in sync with the Settings search field
      initPrefsGroupSearchSync(this.window.document);

      // Set up event listeners
      this.initEventListeners();

      // Auto-load stats
      await this.loadStatsAndCheckMismatch();

      // Auto-load database health stats (orphan count)
      await this.loadHealthStats();

      // Auto-load reclaimable space info for the Compact Database button
      await this.loadCompactionInfo();

      this.logger.info('Preference pane initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize preferences: ${error}`);
    }
  }

  /**
   * Initialize preference values in UI elements
   */
  private initPreferences(): void {
    if (!this.window) return;
    const doc = this.window.document;
    const Z = getZotero();
    if (!Z) return;

    const storedSearchMode = Z.Prefs.get('extensions.zotero.zotseek.hybridSearch.mode', true);
    const defaultSearchMode = storedSearchMode === 'semantic' || storedSearchMode === 'keyword'
      ? storedSearchMode
      : 'hybrid';

    // Read current preference values
    const prefs = {
      indexingMode: Z.Prefs.get('zotseek.indexingMode', true) || 'abstract',
      defaultSearchMode,
      maxChunksPerPaper: Z.Prefs.get('zotseek.maxChunksPerPaper', true) ?? 100,
      topK: Z.Prefs.get('zotseek.topK', true) ?? 20,
      minSimilarity: Z.Prefs.get('zotseek.minSimilarityPercent', true) ?? 70,
      excludeBooks: Z.Prefs.get('zotseek.excludeBooks', true) ?? true,
      excludeTag: Z.Prefs.get('zotseek.excludeTag', true) || 'zotseek-exclude',
      autoIndex: Z.Prefs.get('zotseek.autoIndex', true) ?? false,
      mcpServer: Z.Prefs.get('zotseek.mcpServer.enabled', true) ?? false,
      indexScope: Z.Prefs.get('zotseek.indexScope', true) || 'user',
      autoCompact: Z.Prefs.get('zotseek.autoCompact', true) ?? true,
    };

    this.logger.debug(`Loaded preferences: ${JSON.stringify(prefs)}`);

    // Set menulist values
    this.setMenulistValue('zotseek-pref-indexingMode', prefs.indexingMode);
    this.setMenulistValue('zotseek-pref-defaultSearchMode', prefs.defaultSearchMode);

    // Set input values
    this.setInputValue('zotseek-pref-maxChunksPerPaper', prefs.maxChunksPerPaper);
    this.setInputValue('zotseek-pref-topK', prefs.topK);
    this.setInputValue('zotseek-pref-minSimilarity', prefs.minSimilarity);

    // Set checkbox values
    this.setCheckboxValue('zotseek-pref-excludeBooks', prefs.excludeBooks);
    this.setCheckboxValue('zotseek-pref-autoIndex', prefs.autoIndex);
    this.setCheckboxValue('zotseek-pref-mcpServer', prefs.mcpServer);
    this.setCheckboxValue('zotseek-pref-autoCompact', prefs.autoCompact);

    // Automatic compaction rides on Zotero.DB.onIdle, which only exists on
    // Zotero 10+. Disable the control rather than hide it, so the requirement
    // in the description text has something to explain.
    const autoCompactCheckbox = this.window?.document.getElementById('zotseek-pref-autoCompact') as any;
    if (autoCompactCheckbox && typeof Z?.DB?.onIdle !== 'function') {
      autoCompactCheckbox.disabled = true;
    }

    // Show/hide MCP server info/warning based on pref and Zotero.Server state
    this.updateMcpServerVisibility(prefs.mcpServer);

    // Set text input values
    this.setInputValue('zotseek-pref-excludeTag', prefs.excludeTag);

    // Set index scope menulist
    this.setMenulistValue('zotseek-pref-indexScope', prefs.indexScope);

    // Update mode cards to match current selection
    this.updateModeCards();
    refreshModelInputPolicy(doc);
  }

  /**
   * Update the visual state of mode selection cards
   * Uses CSS classes for dark mode support
   */
  updateModeCards(): void {
    if (!this.window) return;
    const doc = this.window.document;
    const Z = getZotero();
    if (!Z) return;

    const currentMode = Z.Prefs.get('zotseek.indexingMode', true) || 'abstract';

    const cards = [
      {
        mode: 'abstract',
        card: doc.getElementById('zotseek-mode-abstract-card') as HTMLElement,
        radio: doc.getElementById('zotseek-mode-abstract-radio') as HTMLElement,
      },
      {
        mode: 'notes',
        card: doc.getElementById('zotseek-mode-notes-card') as HTMLElement,
        radio: doc.getElementById('zotseek-mode-notes-radio') as HTMLElement,
      },
      {
        mode: 'full',
        card: doc.getElementById('zotseek-mode-full-card') as HTMLElement,
        radio: doc.getElementById('zotseek-mode-full-radio') as HTMLElement,
      },
    ];

    // Helper to update radio dot (uses CSS variable for theme support)
    const updateRadio = (radio: HTMLElement | null, selected: boolean) => {
      if (!radio) return;
      // Use CSS variable for border color
      radio.style.borderColor = selected ? 'var(--zotseek-blue)' : 'var(--zotseek-text-tertiary)';
      // Clear existing children
      while (radio.firstChild) {
        radio.removeChild(radio.firstChild);
      }
      // Add dot if selected (uses CSS variable for theme support)
      if (selected) {
        const dot = doc.createElement('span');
        dot.style.cssText = 'width: 8px; height: 8px; background: var(--zotseek-blue); border-radius: 50%;';
        radio.appendChild(dot);
      }
    };

    // Helper to swap CSS classes for card selection state
    const setCardSelected = (card: HTMLElement | null, selected: boolean) => {
      if (!card) return;
      card.classList.remove('zotseek-mode-card-selected', 'zotseek-mode-card-unselected');
      card.classList.add(selected ? 'zotseek-mode-card-selected' : 'zotseek-mode-card-unselected');
    };

    for (const { mode, card, radio } of cards) {
      const selected = currentMode === mode;
      setCardSelected(card, selected);
      updateRadio(radio, selected);
    }
  }

  /**
   * Set up event listeners for UI elements
   */
  private initEventListeners(): void {
    if (!this.window) return;
    const doc = this.window.document;
    const Z = getZotero();
    if (!Z) return;

    // Indexing mode change
    const indexingModeMenu = doc.getElementById('zotseek-pref-indexingMode') as any;
    if (indexingModeMenu) {
      indexingModeMenu.addEventListener('command', () => {
        const value = indexingModeMenu.selectedItem?.value;
        if (value) {
          Z.Prefs.set('zotseek.indexingMode', value, true);
          this.logger.info(`Indexing mode changed to: ${value}`);
          // Check for mismatch after changing
          this.loadStatsAndCheckMismatch();
        }
      });
    }

    // Embedding model change: missing curated models offer automatic or manual installation.
    const modelMenu = doc.getElementById('zotseek-pref-embeddingModel') as any;
    if (modelMenu) {
      modelMenu.addEventListener('command', async () => {
        // Re-entrancy guard: two rapid selections must not race setModel + reindex
        if (modelSwitchInProgress) return;
        modelSwitchInProgress = true;
        const id = modelMenu.selectedItem?.getAttribute('value');
        if (!id) { modelSwitchInProgress = false; return; }
        const statusEl = doc.getElementById('zotseek-embeddingModel-status');
        try {
          const zs = (typeof Zotero !== 'undefined') ? (Zotero as any).ZotSeek : null;
          if (zs?.indexing) {
            if (statusEl) statusEl.textContent = 'Finish or cancel the current indexing run before switching models.';
            await populateModelMenu(doc);
            return;
          }
          if (id === CLOUD_SLOT_SELECTION_ID) {
            const ready = await prepareCloudSelection(doc);
            if (!ready) {
              await populateModelMenu(doc);
              return;
            }
          }
          if (id === SERVER_SLOT_SELECTION_ID) {
            setActiveModelId(SERVER_SLOT_SELECTION_ID);
            const config = getLastServerModelConfigLoadResult();
            if (config?.kind !== 'ready' || !config.model) {
              embeddingPipeline.reset();
              autoIndexManager.stop();
              showServerModelConfigurationPromptIfNeeded();
              if (docAlive(doc)) {
                if (statusEl) statusEl.textContent = getString('pref-serverModelIncomplete');
                await populateModelMenu(doc);
                refreshModelInputPolicy(doc);
                await renderCoverage(doc);
                await renderManageModels(doc);
              }
              return;
            }
          }
          const model = getModel(id);
          if (!model) return;
          if (model.runtime === 'onnx' && !model.bundled && !(await isModelOnDisk(model))) {
            const choice = openModelDownloadChoicePrompt(
              Services.prompt,
              doc.defaultView || null,
              getString('modelDownloadChoiceTitle'),
              getString('modelDownloadChoiceMessage', {
                model: model.label,
                size: model.approxSizeMB,
              }),
              getString('modelDownloadAutomatic'),
              getString('modelDownloadManual'),
              getString('modelDownloadCancel'),
            );
            if (choice === 'cancel') {
              if (docAlive(doc)) await populateModelMenu(doc);
              return;
            }
            if (choice === 'manual') {
              await showManualDownloadGuide(doc, model);
              if (docAlive(doc)) await populateModelMenu(doc);
              return;
            }
            if (docAlive(doc) && statusEl) {
              statusEl.textContent = getString('modelDownloadStarting', { model: model.label });
            }
            await ensureModelDownloaded(model, (done, total) => {
              if (docAlive(doc) && statusEl) {
                statusEl.textContent = getString('modelDownloadProgress', {
                  model: model.label,
                  done,
                  total,
                });
              }
            });
          }
          await embeddingPipeline.setModel(id);   // persists the pref + reloads the worker
          const strategyWritable = typeof zs?.api?.refreshChunkStrategyState === 'function'
            ? await zs.api.refreshChunkStrategyState(true)
            : true;
          if (strategyWritable) autoIndexManager.reload();
          if (docAlive(doc)) {
            if (statusEl) statusEl.textContent = '';
            await populateModelMenu(doc);
            refreshModelInputPolicy(doc);
            await renderCoverage(doc);
            await renderManageModels(doc);
          }
          // maybePromptReindex may trigger a long reindex; guard doc touches inside it
          await maybePromptReindex(doc, model.id);
        } catch (e: any) {
          // Guard: statusEl may throw if the prefs window was closed during a long await
          try {
            if (docAlive(doc) && statusEl) {
              statusEl.textContent = getString('modelDownloadFailed', { error: e?.message || e });
              await populateModelMenu(doc);
            }
          } catch { /* prefs window gone, nothing to update */ }
        } finally {
          modelSwitchInProgress = false;
        }
      });
    }

    const openServerConfigButton = doc.getElementById('zotseek-server-config-open-location');
    openServerConfigButton?.addEventListener('command', () => {
      const result = getLastServerModelConfigLoadResult();
      revealServerModelConfigLocation(
        result?.path || getServerModelConfigPath(),
        this.window,
      );
    });

    const saveChangedCloudSettings = async (): Promise<void> => {
      if (!saveCloudSettingsFromUI(doc)) return;
      if (getActiveModelSelectionId() === CLOUD_SLOT_SELECTION_ID) {
        embeddingPipeline.reset();
      }
      autoIndexManager.reload();
      await populateModelMenu(doc);
      refreshModelInputPolicy(doc);
      await renderCoverage(doc);
    };

    const cloudProvider = doc.getElementById('zotseek-cloud-provider') as HTMLSelectElement | null;
    cloudProvider?.addEventListener('change', async () => {
      const option = CLOUD_PROVIDER_OPTIONS.find(item => item.id === cloudProvider.value);
      const baseUrl = doc.getElementById('zotseek-cloud-base-url') as HTMLInputElement | null;
      if (option && baseUrl) baseUrl.value = option.defaultBaseUrl;
      await saveChangedCloudSettings();
    });

    for (const id of [
      'zotseek-cloud-base-url',
      'zotseek-cloud-model',
      'zotseek-cloud-dimensions',
      'zotseek-cloud-max-input-tokens',
      'zotseek-cloud-query-prefix',
      'zotseek-cloud-doc-prefix',
      'zotseek-cloud-batch-size',
    ]) {
      doc.getElementById(id)?.addEventListener('change', async () => {
        await saveChangedCloudSettings();
      });
    }

    const cloudSetKey = doc.getElementById('zotseek-cloud-set-key');
    cloudSetKey?.addEventListener('command', async () => {
      if (await promptAndSaveCloudApiKey(doc) &&
          getActiveModelSelectionId() === CLOUD_SLOT_SELECTION_ID) {
        embeddingPipeline.reset();
      }
      await populateModelMenu(doc);
    });

    const cloudRemoveKey = doc.getElementById('zotseek-cloud-remove-key');
    cloudRemoveKey?.addEventListener('command', async () => {
      const confirmed = Services.prompt.confirm(
        doc.defaultView || null,
        getString('pref-cloudRemoveApiKeyTitle'),
        getString('pref-cloudRemoveApiKeyMessage'),
      );
      if (!confirmed) return;
      try {
        const wasActive = getActiveModelSelectionId() === CLOUD_SLOT_SELECTION_ID;
        await cloudCredentialStore.clear();
        setCloudConnectionVerified(false);
        if (wasActive) await embeddingPipeline.setModel(DEFAULT_MODEL_ID);
        autoIndexManager.reload();
        await renderCloudSettings(doc);
        await populateModelMenu(doc);
        await renderCoverage(doc);
      } catch (error: any) {
        setCloudStatus(doc, getString('pref-cloudSecureStorageError', {
          error: error?.message || error,
        }));
      }
    });

    const cloudTest = doc.getElementById('zotseek-cloud-test');
    cloudTest?.addEventListener('command', async () => {
      await testCloudConnection(doc);
      await populateModelMenu(doc);
    });

    const cloudAutoIndex = doc.getElementById('zotseek-cloud-auto-index') as any;
    cloudAutoIndex?.addEventListener('command', () => {
      setCloudAutoIndexAllowed(cloudAutoIndex.checked === true);
      autoIndexManager.reload();
    });

    const defaultSearchMode = doc.getElementById('zotseek-pref-defaultSearchMode') as any;
    const saveDefaultSearchMode = () => {
      const mode = defaultSearchMode?.value;
      if (mode === 'hybrid' || mode === 'semantic' || mode === 'keyword') {
        Z.Prefs.set('extensions.zotero.zotseek.hybridSearch.mode', mode, true);
        this.logger.debug(`Default search mode changed to: ${mode}`);
      }
    };
    defaultSearchMode?.addEventListener('command', saveDefaultSearchMode);
    defaultSearchMode?.addEventListener('change', saveDefaultSearchMode);

    // Number inputs
    const numberInputs = [
      { id: 'zotseek-pref-maxChunksPerPaper', pref: 'zotseek.maxChunksPerPaper' },
      { id: 'zotseek-pref-topK', pref: 'zotseek.topK' },
      { id: 'zotseek-pref-minSimilarity', pref: 'zotseek.minSimilarityPercent' }
    ];

    for (const { id, pref } of numberInputs) {
      const input = doc.getElementById(id) as HTMLInputElement;
      if (input) {
        input.addEventListener('change', () => {
          const value = parseInt(input.value, 10);
          if (!isNaN(value)) {
            Z.Prefs.set(pref, value, true);
            this.logger.debug(`${pref} changed to: ${value}`);
          }
        });
      }
    }

    const maxTokensInput = doc.getElementById('zotseek-pref-maxTokens') as HTMLInputElement | null;
    if (maxTokensInput) {
      maxTokensInput.addEventListener('change', () => {
        const parsed = parseInt(maxTokensInput.value, 10);
        if (!Number.isFinite(parsed)) {
          refreshModelInputPolicy(doc);
          return;
        }
        const model = getModel(getActiveModelId());
        const hardLimit = model
          ? resolveModelInputPolicy(model).maxInputTokens ?? 8192
          : 8192;
        const requested = Math.max(50, Math.min(hardLimit, parsed));
        Z.Prefs.set('zotseek.maxTokens', requested, true);
        refreshModelInputPolicy(doc);
        this.logger.debug(`zotseek.maxTokens override changed to: ${requested}`);
      });
    }

    const resetTokens = doc.getElementById('zotseek-pref-resetMaxTokens') as any;
    resetTokens?.addEventListener('command', () => {
      Z.Prefs.clear('zotseek.maxTokens', true);
      refreshModelInputPolicy(doc);
      this.logger.debug('zotseek.maxTokens override cleared');
    });

    // Checkbox inputs
    const excludeBooksCheckbox = doc.getElementById('zotseek-pref-excludeBooks') as any;
    if (excludeBooksCheckbox) {
      excludeBooksCheckbox.addEventListener('command', () => {
        const checked = excludeBooksCheckbox.checked;
        Z.Prefs.set('zotseek.excludeBooks', checked, true);
        this.logger.info(`Exclude books changed to: ${checked}`);
      });
    }

    const autoCompactCheckbox = doc.getElementById('zotseek-pref-autoCompact') as any;
    if (autoCompactCheckbox) {
      autoCompactCheckbox.addEventListener('command', () => {
        const checked = autoCompactCheckbox.checked;
        Z.Prefs.set('zotseek.autoCompact', checked, true);
        this.logger.info(`Automatic compaction changed to: ${checked}`);
      });
    }

    const autoIndexCheckbox = doc.getElementById('zotseek-pref-autoIndex') as any;
    if (autoIndexCheckbox) {
      autoIndexCheckbox.addEventListener('command', () => {
        const checked = autoIndexCheckbox.checked;
        Z.Prefs.set('zotseek.autoIndex', checked, true);
        this.logger.info(`Auto-index changed to: ${checked}`);
        // Apply the one-shot startup maintenance preference.
        autoIndexManager.reload();
      });
    }

    const mcpServerCheckbox = doc.getElementById('zotseek-pref-mcpServer') as any;
    if (mcpServerCheckbox) {
      mcpServerCheckbox.addEventListener('command', () => {
        const checked = mcpServerCheckbox.checked;
        Z.Prefs.set('zotseek.mcpServer.enabled', checked, true);
        this.logger.info(`MCP server enabled changed to: ${checked}`);
        this.updateMcpServerVisibility(checked);
      });
    }

    // Index scope change
    const indexScopeMenu = doc.getElementById('zotseek-pref-indexScope') as any;
    if (indexScopeMenu) {
      indexScopeMenu.addEventListener('command', () => {
        const value = indexScopeMenu.selectedItem?.value;
        if (value) {
          Z.Prefs.set('zotseek.indexScope', value, true);
          this.logger.info(`Index scope changed to: ${value}`);
        }
      });
    }

    // Exclude tag input
    const excludeTagInput = doc.getElementById('zotseek-pref-excludeTag') as HTMLInputElement;
    if (excludeTagInput) {
      excludeTagInput.addEventListener('change', () => {
        const value = excludeTagInput.value.trim();
        Z.Prefs.set('zotseek.excludeTag', value, true);
        this.logger.info(`Exclude tag changed to: "${value}"`);
      });
    }

    // Button event listeners
    const refreshBtn = doc.getElementById('zotseek-refresh-stats');
    if (refreshBtn) {
      refreshBtn.addEventListener('command', () => this.loadStatsAndCheckMismatch());
    }

    const clearBtn = doc.getElementById('zotseek-clear-index');
    if (clearBtn) {
      clearBtn.addEventListener('command', () => this.clearIndex());
    }

    const rebuildBtn = doc.getElementById('zotseek-rebuild-index');
    if (rebuildBtn) {
      rebuildBtn.addEventListener('command', () => this.rebuildIndex());
    }

    const updateBtn = doc.getElementById('zotseek-update-index');
    if (updateBtn) {
      updateBtn.addEventListener('command', () => this.updateIndex());
    }

    const compactBtn = doc.getElementById('zotseek-compact-db');
    if (compactBtn) {
      compactBtn.addEventListener('command', () => this.compactDatabase());
    }

    const purgeOrphansBtn = doc.getElementById('zotseek-purge-orphans-btn');
    if (purgeOrphansBtn) {
      purgeOrphansBtn.addEventListener('command', () => this.purgeOrphans());
    }
  }

  /**
   * Load database health stats (orphan count) and update the label.
   */
  async loadHealthStats(): Promise<void> {
    if (!this.window) return;
    const doc = this.window.document;
    const Z = getZotero();
    if (!Z) return;

    try {
      const raw = await Z.DB.valueQueryAsync(
        'SELECT COUNT(*) FROM zotseek.orphan_items'
      );
      const count = Number(raw) || 0;
      const label = doc.getElementById('zotseek-orphan-count');
      if (label) {
        label.setAttribute('data-l10n-args', JSON.stringify({ count }));
        // Fallback text for environments where Fluent doesn't translate immediately.
        label.textContent = `Unresolved embeddings: ${count}`;
      }
      this.logger.debug(`Health stats loaded: ${count} orphans`);
    } catch (e: any) {
      this.logger.error(`loadHealthStats failed: ${e?.message || e}`);
    }
  }

  /**
   * Purge all orphan embeddings after user confirmation.
   */
  private async purgeOrphans(): Promise<void> {
    if (!this.window) return;
    const Z = getZotero();
    if (!Z) return;

    try {
      const before = Number(await Z.DB.valueQueryAsync(
        'SELECT COUNT(*) FROM zotseek.orphan_items'
      )) || 0;

      const confirmed = Services.prompt.confirm(
        this.window,
        'ZotSeek',
        'This will permanently delete embeddings for items not found in your current Zotero library. Continue?'
      );
      if (!confirmed) return;

      await Z.DB.executeTransaction(async () => {
        await Z.DB.queryAsync(
          `DELETE FROM zotseek.chunks WHERE item_pk IN (
             SELECT item_pk FROM zotseek.items WHERE library_key = 'orphan'
           )`
        );
        await Z.DB.queryAsync(
          `DELETE FROM zotseek.items WHERE library_key = 'orphan'`
        );
        await Z.DB.queryAsync(`DELETE FROM zotseek.orphan_items`);
      });

      this.logger.info(`Purged ${before} orphan entries`);

      // Refresh stats: orphan count and overall index stats (chunks/storage).
      await this.loadHealthStats();
      await this.loadStatsAndCheckMismatch();

      const pw = new Z.ProgressWindow({ closeOnClick: true });
      pw.changeHeadline('Orphans Purged');
      pw.addDescription(`Removed ${before} unresolved entries.`);
      pw.show();
      pw.startCloseTimer(4000);
    } catch (e: any) {
      this.logger.error(`purgeOrphans failed: ${e?.message || e}`);
      const pw = new Z.ProgressWindow({ closeOnClick: true });
      pw.changeHeadline('Purge Failed');
      pw.addDescription(e?.message || String(e));
      pw.show();
      pw.startCloseTimer(4000);
    }
  }

  /**
   * Load statistics and check for indexing mode mismatch
   */
  async loadStatsAndCheckMismatch(): Promise<void> {
    if (!this.window) return;
    const doc = this.window.document;
    const Z = getZotero();
    if (!Z?.ZotSeek) return;

    const setText = (id: string, value: string) => {
      const el = doc.getElementById(id);
      if (el) el.textContent = value;
    };

    setText('zotseek-stat-papers', '...');

    try {
      const stats = await Z.ZotSeek.getStats();
      
      // Update all statistics
      setText('zotseek-stat-papers', stats.indexedPapers.toLocaleString());
      setText('zotseek-stat-chunks', stats.totalChunks.toLocaleString());
      setText('zotseek-stat-storage', stats.storageSize);
      setText('zotseek-stat-dbpath', stats.databasePath || '-');
      setText('zotseek-stat-model-line', getString('pref-modelLine', { model: stats.modelId }));
      setText('zotseek-stat-avg-line', getString('pref-avgLine', { avg: stats.avgChunksPerPaper }));
      setText('zotseek-stat-lastindexed-line', getString('pref-lastIndexedLine', { date: stats.lastIndexed }));

      // Populate legacy compatibility fields without making their unlabeled
      // spans visible in the current status-card layout.
      const durationLabel = doc.getElementById('zotseek-stat-duration-label');
      const durationValue = doc.getElementById('zotseek-stat-duration');
      if (stats.lastIndexDuration) {
        setText('zotseek-stat-duration', stats.lastIndexDuration);
      }
      if (durationLabel) durationLabel.style.display = 'none';
      if (durationValue) durationValue.style.display = 'none';

      // Handle indexed mode display and mismatch warning
      const indexedModeLabel = doc.getElementById('zotseek-stat-indexedmode-label');
      const indexedModeValue = doc.getElementById('zotseek-stat-indexedmode');
      const warningBox = doc.getElementById('zotseek-indexmode-warning');

      if (stats.indexedMode) {
        const rawCurrentMode = Z.Prefs.get('zotseek.indexingMode', true);
        const currentMode: CanonicalIndexingMode =
          rawCurrentMode === 'notes' || rawCurrentMode === 'full'
            ? rawCurrentMode
            : 'abstract';
        const modeLabels: Record<CanonicalIndexingMode, string> = {
          'abstract': getString('pref-abstractOnly'),
          'notes': getString('pref-notes'),
          'full': getString('pref-fullPaper')
        };
        const storedIndexingMode = String(stats.indexedMode);
        const indexedModeDisplay = isCanonicalIndexingMode(storedIndexingMode)
          ? modeLabels[storedIndexingMode]
          : storedIndexingMode;
        const currentModeLabel = modeLabels[currentMode];

        setText('zotseek-stat-indexedmode', indexedModeDisplay);
        if (indexedModeLabel) indexedModeLabel.style.display = 'none';
        if (indexedModeValue) indexedModeValue.style.display = 'none';

        if (warningBox) {
          if (hasIndexingModeMismatch(
            storedIndexingMode,
            currentMode,
            stats.indexedPapers,
          )) {
            // Show warning - there's a mismatch
            warningBox.style.display = 'block';
            setText(
              'zotseek-indexmode-warning-description',
              getString('pref-indexModeMismatchDesc', {
                indexedMode: indexedModeDisplay,
                currentMode: currentModeLabel,
              }),
            );
          } else {
            // Hide warning - modes match or no papers indexed
            warningBox.style.display = 'none';
          }
        }
      } else {
        // No indexed mode stored (old index)
        if (indexedModeLabel) indexedModeLabel.style.display = 'none';
        if (indexedModeValue) indexedModeValue.style.display = 'none';
        if (warningBox) warningBox.style.display = 'none';
      }

      this.logger.debug('Stats loaded successfully');
    } catch (error) {
      setText('zotseek-stat-papers', 'Error');
      this.logger.error(`Failed to load stats: ${error}`);
    }
  }

  /**
   * Clear the index
   */
  private async clearIndex(): Promise<void> {
    const Z = getZotero();
    if (Z?.ZotSeek) {
      await Z.ZotSeek.clearIndex();
      // Refresh stats after clearing
      await this.loadStatsAndCheckMismatch();
    }
  }

  /**
   * Rebuild the index
   */
  private async rebuildIndex(): Promise<void> {
    const Z = getZotero();
    if (Z?.ZotSeek) {
      await Z.ZotSeek.rebuildIndex();
      // Stats will be refreshed after rebuild completes
    }
  }

  /**
   * Update the index
   */
  private updateIndex(): void {
    const Z = getZotero();
    if (Z?.ZotSeek) {
      Z.ZotSeek.indexLibrary();
      // Stats will be refreshed after indexing completes
    }
  }

  /**
   * Compact the database to reclaim space
   */
  async compactDatabase(): Promise<void> {
    if (!this.window) return;
    const Z = (this.window as any).Zotero;
    if (!Z?.ZotSeek?.compactDatabase) return;

    try {
      const result = await Z.ZotSeek.compactDatabase();
      // Show success as a brief progress window
      const pw = new Z.ProgressWindow({ closeOnClick: true });
      pw.changeHeadline(getString('pref-compacted'));
      pw.addDescription(result);
      pw.show();
      pw.startCloseTimer(4000);
      // Refresh stats to show new size and clear the "reclaim X MB" hint
      await this.loadStatsAndCheckMismatch();
      await this.loadCompactionInfo();
    } catch (e: any) {
      const pw = new Z.ProgressWindow({ closeOnClick: true });
      pw.changeHeadline(getString('pref-compactionFailed'));
      pw.addDescription(e?.message || String(e));
      pw.show();
      pw.startCloseTimer(4000);
    }
  }

  /**
   * Update the Compact Database button label with the current reclaimable
   * space, so users can see when compaction is worthwhile without clicking.
   * SQLite leaves freed pages inside the file after DROP/DELETE — those
   * pages accumulate after migrations and orphan purges, then go away on
   * VACUUM.
   */
  async loadCompactionInfo(): Promise<void> {
    if (!this.window) return;
    const Z = (this.window as any).Zotero;
    const btn = this.window.document.getElementById('zotseek-compact-db') as any;
    if (!btn) return;
    const baseLabel = 'Compact Database';

    if (!Z?.ZotSeek?.getReclaimableBytes) {
      btn.setAttribute('label', baseLabel);
      return;
    }

    try {
      const bytes = Number(await Z.ZotSeek.getReclaimableBytes()) || 0;
      // Below ~10 MB: keep the plain label; the cost of running VACUUM isn't
      // worth a single-digit-MB win, and the noisy "reclaim 2 MB" hint just
      // trains people to ignore it.
      if (bytes < 10 * 1024 * 1024) {
        btn.setAttribute('label', baseLabel);
        btn.removeAttribute('data-l10n-id');
        return;
      }
      const mb = bytes / (1024 * 1024);
      const display = mb >= 1024
        ? `${(mb / 1024).toFixed(1)} GB`
        : `${mb.toFixed(0)} MB`;
      btn.setAttribute('label', `${baseLabel} (reclaim ${display})`);
      // Override Fluent so our dynamic label isn't replaced at next pass.
      btn.removeAttribute('data-l10n-id');
      this.logger.debug(`Reclaimable space: ${display}`);
    } catch (e: any) {
      this.logger.warn(`loadCompactionInfo failed: ${e?.message || e}`);
      btn.setAttribute('label', baseLabel);
    }
  }

  /**
   * Helper to set menulist value
   */
  private setMenulistValue(menulistId: string, value: any): void {
    if (!this.window) return;
    const menulist = this.window.document.getElementById(menulistId) as any;
    if (!menulist) return;

    const strValue = String(value);
    const menupopup = menulist.querySelector('menupopup');
    if (menupopup) {
      const items = menupopup.querySelectorAll('menuitem');
      for (let i = 0; i < items.length; i++) {
        if (items[i].getAttribute('value') === strValue) {
          menulist.selectedIndex = i;
          break;
        }
      }
    }
  }

  /**
   * Helper to set input value
   */
  private setInputValue(inputId: string, value: any): void {
    if (!this.window) return;
    const input = this.window.document.getElementById(inputId) as HTMLInputElement;
    if (input && value !== undefined) {
      input.value = String(value);
    }
  }

  /**
   * Helper to set checkbox value
   */
  private setCheckboxValue(checkboxId: string, checked: boolean): void {
    if (!this.window) return;
    const checkbox = this.window.document.getElementById(checkboxId) as any;
    if (checkbox) {
      checkbox.checked = checked;
    }
  }

  /**
   * Show/hide the MCP server info box and warning based on enabled state
   * and whether Zotero's local HTTP server is active.
   */
  private updateMcpServerVisibility(enabled: boolean): void {
    if (!this.window) return;
    const doc = this.window.document;
    const infoDiv = doc.getElementById('zotseek-mcpserver-info') as HTMLElement | null;
    const warningEl = doc.getElementById('zotseek-mcpserver-warning') as HTMLElement | null;
    const cmdEl = doc.getElementById('zotseek-mcpserver-command') as HTMLElement | null;

    if (!enabled) {
      if (infoDiv) infoDiv.style.display = 'none';
      if (warningEl) warningEl.style.display = 'none';
      return;
    }

    // Check if Zotero's local HTTP server is running
    const Z = getZotero();
    const port = (Z as any)?.Server?.port;

    if (port) {
      if (infoDiv) infoDiv.style.display = 'block';
      if (warningEl) warningEl.style.display = 'none';
      // Update command with actual port if it differs from the default
      if (cmdEl && port !== 23119) {
        cmdEl.textContent = `claude mcp add --transport http --scope user zotseek http://localhost:${port}/zotseek/mcp`;
      } else if (cmdEl) {
        cmdEl.textContent = 'claude mcp add --transport http --scope user zotseek http://localhost:23119/zotseek/mcp';
      }
    } else {
      if (infoDiv) infoDiv.style.display = 'none';
      if (warningEl) warningEl.style.display = 'block';
    }
  }

  /**
   * Clean up when preference pane is closed
   */
  destroy(): void {
    teardownPrefsGroupSearchSync();
    this.window = null;
    this.logger.info('Preference pane destroyed');
  }
}

// Create singleton instance
export const preferencesManager = new PreferencesManager();

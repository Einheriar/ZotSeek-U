/**
 * Startup Index Manager
 *
 * Reconciles the ZotSeek index once after Zotero starts. It deliberately does
 * not register a Zotero.Notifier observer, poll the database, or react while a
 * user is editing a note.
 */

import { Logger } from '../utils/logger';
import { noteHTMLToIndexText } from '../utils/note-text';
import {
  CHUNK_STRATEGY_VERSION,
  PDF_SOURCE_IDENTITY_VERSION,
  getChunkOptionsFromPrefs,
  getIndexingMode,
} from '../utils/chunker';
import { identityFromItem, localItemIDFromIdentity } from './identity-resolver';
import {
  getActiveModel,
  getActiveModelId,
  getActiveModelSelectionId,
  CLOUD_SLOT_SELECTION_ID,
  SERVER_SLOT_SELECTION_ID,
} from './model-registry';
import {
  allowsStartupAutoIndex,
  hasCurrentCloudConsent,
  isCloudAutoIndexAllowed,
  isCloudConnectionVerified,
} from './cloud-model-config';
import { modelInputPolicyFingerprint, resolveModelInputPolicy } from './model-input-policy';
import { textExtractor } from './text-extractor';
import { isModifiedAfterVerification } from '../utils/timestamp';
import { normalizeStoredIndexingMode } from '../utils/indexing-mode';
import {
  isItemExcludedFromIndex,
  readIndexExclusionPolicy,
  type IndexExclusionPolicy,
} from '../utils/index-exclusion';
import type { StartupFingerprint, TextSourceType } from './vector-store-sqlite';
import {
  assessChangedNoteContent,
  assessIndexConfigFingerprint,
  assessQuickFreshness,
  assessStoredSourceTexts,
  freshnessIdentityKey,
  indexFreshnessTracker,
  metadataFingerprint,
  noteContentFingerprint,
  noteStateFingerprint,
  serializeIndexConfigFingerprint,
  type FreshnessIndexingMode,
  type IndexConfigSnapshot,
} from './index-freshness';

declare const Zotero: any;

/**
 * Result returned by an indexing callback.
 *
 * The array-only form remains supported for callers that do not expose a
 * pause state.  New callbacks can return this object so reconciliation can
 * preserve the distinction between a partial pause and a normal failure.
 */
export type IndexCallbackResult = {
  successfulIds: number[];
  paused: boolean;
};

type IndexCallback = (items: any[]) => Promise<number[] | IndexCallbackResult>;
type ItemProvider = () => Promise<any[]>;
type CompletionCallback = (result: StartupCheckResult) => void | Promise<void>;
type StartupConfigChangeCallback = (
  context: StartupConfigChangeContext,
) => StartupConfigChangeChoice | Promise<StartupConfigChangeChoice>;
type StartupRebuildCallback = () => void | Promise<void>;

type QuickSnapshot = {
  metadataFingerprint: string;
  noteStateFingerprint: string;
  notes: any[];
};

type ContentSnapshot = {
  noteContentFingerprint: string;
  summaryChunkTexts: string[];
  noteChunkTexts: string[];
};

type PurgeResult = {
  removed: number;
  failed: number;
};

export type StartupCheckResult = {
  checked: number;
  indexedNew: number;
  rebuilt: number;
  notesUpdated: number;
  baselined: number;
  removed: number;
  unchanged: number;
  outdated: number;
  failed: number;
  skipped: boolean;
  paused: boolean;
};

export type StartupConfigChangeChoice = 'update' | 'rebuild' | 'cancel';

export type StartupConfigChangeContext = {
  affected: number;
  rebuildRequired: number;
  checked: number;
};

export type ScopedReconciliationOptions = {
  allowWrites?: boolean;
  persistFreshness?: boolean;
  purgeMissingScope?: 'user' | 'all' | false;
  fullIndexCallback?: IndexCallback;
  noteIndexCallback?: IndexCallback;
  /** Treat every already-indexed eligible item as needing a full replacement. */
  forceFull?: boolean;
};

const STARTUP_DELAY_MS = 10_000;
const YIELD_EVERY_ITEMS = 50;
const SUMMARY_SOURCES: TextSourceType[] = ['summary', 'abstract', 'title_only'];

export class AutoIndexManager {
  private static instance: AutoIndexManager | null = null;

  private logger = new Logger('StartupIndexManager');
  private running = false;
  private checking = false;
  private chunkStrategyBlocked = false;
  private startupTimer: any = null;
  private generation = 0;

  private fullIndexCallback: IndexCallback | null = null;
  private noteIndexCallback: IndexCallback | null = null;
  private itemProvider: ItemProvider | null = null;
  private completionCallback: CompletionCallback | null = null;
  private startupConfigChangeCallback: StartupConfigChangeCallback | null = null;
  private startupRebuildCallback: StartupRebuildCallback | null = null;
  private vectorStore: any = null;

  private constructor() {}

  public static getInstance(): AutoIndexManager {
    if (!AutoIndexManager.instance) {
      AutoIndexManager.instance = new AutoIndexManager();
    }
    return AutoIndexManager.instance;
  }

  public setIndexCallback(callback: IndexCallback | null): void {
    this.fullIndexCallback = callback;
  }

  public setNoteIndexCallback(callback: IndexCallback | null): void {
    this.noteIndexCallback = callback;
  }

  public setItemProvider(provider: ItemProvider | null): void {
    this.itemProvider = provider;
  }

  public setCompletionCallback(callback: CompletionCallback | null): void {
    this.completionCallback = callback;
  }

  public setStartupConfigChangeCallback(callback: StartupConfigChangeCallback | null): void {
    this.startupConfigChangeCallback = callback;
  }

  public setStartupRebuildCallback(callback: StartupRebuildCallback | null): void {
    this.startupRebuildCallback = callback;
  }

  public setVectorStore(store: any): void {
    this.vectorStore = store;
  }

  public setChunkStrategyBlocked(blocked: boolean): void {
    this.chunkStrategyBlocked = blocked;
    if (blocked) {
      this.running = false;
      this.generation++;
      if (this.startupTimer) {
        clearTimeout(this.startupTimer);
        this.startupTimer = null;
      }
    }
  }

  private isEnabled(): boolean {
    try {
      return allowsStartupAutoIndex(
        Zotero.Prefs.get('zotseek.autoIndex', true) === true,
        getActiveModelSelectionId() === CLOUD_SLOT_SELECTION_ID,
        isCloudAutoIndexAllowed(),
        hasCurrentCloudConsent() && isCloudConnectionVerified(),
      );
    } catch {
      return false;
    }
  }

  /** Schedule exactly one reconciliation pass after Zotero's UI has settled. */
  public start(): void {
    if (this.running || !this.isEnabled() || this.chunkStrategyBlocked) return;
    this.running = true;
    const generation = ++this.generation;
    this.startupTimer = setTimeout(() => {
      this.startupTimer = null;
      if (!this.running || generation !== this.generation) return;
      void this.runCheck(true);
    }, STARTUP_DELAY_MS);
    this.logger.info('Startup index check scheduled; no realtime observers registered');
  }

  public stop(): void {
    this.running = false;
    this.generation++;
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
    this.logger.info('Startup index check stopped');
  }

  public reload(): void {
    if (this.isEnabled()) {
      if (!this.running) this.start();
    } else {
      this.stop();
    }
  }

  /** Manual entry point; runs the same one-shot reconciliation immediately. */
  public async runNow(options: { promptForConfigChanges?: boolean } = {}): Promise<StartupCheckResult> {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
    this.running = true;
    return this.runCheck(options.promptForConfigChanges === true);
  }

  private emptyResult(skipped = false): StartupCheckResult {
    return {
      checked: 0,
      indexedNew: 0,
      rebuilt: 0,
      notesUpdated: 0,
      baselined: 0,
      removed: 0,
      unchanged: 0,
      outdated: 0,
      failed: 0,
      skipped,
      paused: false,
    };
  }

  private normalizeIndexCallbackResult(
    callbackResult: number[] | IndexCallbackResult,
  ): IndexCallbackResult {
    if (Array.isArray(callbackResult)) {
      return { successfulIds: callbackResult, paused: false };
    }
    return {
      successfulIds: Array.isArray(callbackResult?.successfulIds)
        ? callbackResult.successfulIds
        : [],
      paused: callbackResult?.paused === true,
    };
  }

  private getConfigSnapshot(mode: FreshnessIndexingMode): IndexConfigSnapshot {
    const maxChunks = getChunkOptionsFromPrefs(Zotero).maxChunks ?? 100;
    const policy = resolveModelInputPolicy(
      getActiveModel(),
      Zotero.Prefs.get('zotseek.maxTokens', true),
    );
    return {
      indexContractVersion: 4,
      mode,
      maxChunksPerPaper: Number.isFinite(maxChunks) && maxChunks >= 1
        ? maxChunks
        : 100,
      chunkStrategyVersion: CHUNK_STRATEGY_VERSION,
      modelInputPolicy: modelInputPolicyFingerprint(policy),
      pdfSourceIdentityVersion: mode === 'full' ? PDF_SOURCE_IDENTITY_VERSION : 0,
    };
  }

  /** Expose the frozen runtime contract so write paths can prove mode-only changes. */
  public getConfigFingerprint(mode: FreshnessIndexingMode): string {
    return serializeIndexConfigFingerprint(this.getConfigSnapshot(mode));
  }

  private isScopedParent(item: any): boolean {
    if (!item || item.deleted || item.parentID) return false;
    if (typeof item.isRegularItem === 'function' && !item.isRegularItem()) return false;
    if (item.isNote?.() || item.isAttachment?.()) return false;
    return true;
  }

  private shouldProcess(item: any, exclusionPolicy = readIndexExclusionPolicy(Zotero)): boolean {
    if (!this.isScopedParent(item)) return false;
    const title = String(item.getField?.('title') || '').trim();
    if (!title) return false;
    return !isItemExcludedFromIndex(item, exclusionPolicy);
  }

  private async quickSnapshot(
    item: any,
    mode: FreshnessIndexingMode,
  ): Promise<QuickSnapshot> {
    const noteIDs: number[] = mode === 'abstract'
      ? []
      : (item.getNotes?.() || []);
    const loaded = noteIDs.length > 0 ? await Zotero.Items.getAsync(noteIDs) : [];
    const notes = (Array.isArray(loaded) ? loaded : [loaded])
      .filter((note: any) => note?.isNote?.() && !note.deleted)
      .sort((a: any, b: any) => String(a.key).localeCompare(String(b.key)));
    const parentIdentity = identityFromItem(item);
    if (parentIdentity) {
      notes.forEach((note: any) => indexFreshnessTracker.rememberChildNote(
        note,
        parentIdentity,
        identityFromItem(note),
      ));
    }
    return {
      metadataFingerprint: metadataFingerprint(item),
      noteStateFingerprint: noteStateFingerprint(notes, mode),
      notes,
    };
  }

  private async contentSnapshot(
    item: any,
    quick: QuickSnapshot,
    mode: FreshnessIndexingMode,
  ): Promise<ContentSnapshot> {
    const normalizedNotes = quick.notes.map((note: any) => ({
      key: String(note.key || ''),
      text: noteHTMLToIndexText(note.getNote?.() || ''),
    }));

    // Notes mode produces the same metadata/note text used by both Notes and
    // Full modes, without touching Zotero's PDF full-text APIs.
    const snapshotMode = mode === 'abstract' ? 'abstract' : 'notes';
    const extracted = await textExtractor.extractChunksFromItem(item, snapshotMode);
    return {
      noteContentFingerprint: noteContentFingerprint(normalizedNotes, mode),
      summaryChunkTexts: (extracted?.chunks || [])
        .filter(chunk => SUMMARY_SOURCES.includes(chunk.type as TextSourceType))
        .map(chunk => chunk.text),
      noteChunkTexts: (extracted?.chunks || [])
        .filter(chunk => chunk.type === 'note')
        .map(chunk => chunk.text),
    };
  }

  private async storedSourceTexts(identity: { libraryKey: string; itemKey: string }): Promise<{
    summary: string[];
    notes: string[];
  }> {
    const [summary, notes] = await Promise.all([
      this.vectorStore.getChunkTextsBySources(identity.libraryKey, identity.itemKey, SUMMARY_SOURCES),
      this.vectorStore.getChunkTextsBySources(identity.libraryKey, identity.itemKey, ['note']),
    ]);
    return { summary, notes };
  }

  private async persistFingerprint(
    item: any,
    quick: QuickSnapshot,
    content: ContentSnapshot,
    configFingerprint: string,
    modelId: string,
  ): Promise<void> {
    const identity = identityFromItem(item);
    if (!identity) return;
    const fingerprint: StartupFingerprint = {
      libraryKey: identity.libraryKey,
      itemKey: identity.itemKey,
      modelId,
      configFingerprint,
      metadataFingerprint: quick.metadataFingerprint,
      noteStateFingerprint: quick.noteStateFingerprint,
      noteContentFingerprint: content.noteContentFingerprint,
      checkedAt: new Date().toISOString(),
    };
    await this.vectorStore.setStartupFingerprint(fingerprint);
  }

  private async persistFingerprintSafely(
    item: any,
    quick: QuickSnapshot,
    content: ContentSnapshot,
    configFingerprint: string,
    modelId: string,
  ): Promise<boolean> {
    const identity = identityFromItem(item);
    try {
      await this.persistFingerprint(item, quick, content, configFingerprint, modelId);
      return true;
    } catch (error: any) {
      if (identity) indexFreshnessTracker.markDirty(identity);
      this.logger.warn(
        `Could not persist freshness for ` +
        `${identity?.libraryKey || 'unknown'}/${identity?.itemKey || item?.id || 'unknown'}: ` +
        `${error?.message || error}`,
      );
      return false;
    }
  }

  private async persistSuccessful(
    items: any[],
    successfulIds: number[],
    configFingerprint: string,
    snapshots: Map<number, { quick: QuickSnapshot; content?: ContentSnapshot }>,
    mode: FreshnessIndexingMode,
    modelId: string,
  ): Promise<Set<number>> {
    const successful = new Set(successfulIds);
    const persisted = new Set<number>();
    const configurationChanged =
      getActiveModelId() !== modelId ||
      getIndexingMode(Zotero) !== mode ||
      this.getConfigFingerprint(mode) !== configFingerprint;
    if (configurationChanged) {
      for (const item of items) {
        if (!successful.has(item.id)) continue;
        const identity = identityFromItem(item);
        if (identity) indexFreshnessTracker.markDirty(identity);
      }
      this.logger.warn('Index configuration changed during reconciliation; freshness remains outdated');
      return persisted;
    }
    for (const item of items) {
      if (!successful.has(item.id)) continue;
      const identity = identityFromItem(item);
      if (!identity) continue;
      try {
        const before = snapshots.get(item.id);
        const quick = await this.quickSnapshot(item, mode);
        const content = await this.contentSnapshot(item, quick, mode);
        if (before && (
          before.quick.metadataFingerprint !== quick.metadataFingerprint ||
          before.quick.noteStateFingerprint !== quick.noteStateFingerprint ||
          (before.content &&
            before.content.noteContentFingerprint !== content.noteContentFingerprint)
        )) {
          // The write completed, but Zotero changed again while extraction or
          // embedding was running. Keep the parent dirty for the next pass.
          indexFreshnessTracker.markDirty(identity);
          continue;
        }
        await this.persistFingerprint(item, quick, content, configFingerprint, modelId);
        indexFreshnessTracker.clearDirty(identity);
        persisted.add(item.id);
      } catch (error: any) {
        indexFreshnessTracker.markDirty(identity);
        this.logger.warn(`Could not persist freshness for ${identity.libraryKey}/${identity.itemKey}: ${error?.message || error}`);
      }
    }
    return persisted;
  }

  private async purgeMissingIndexedItems(
    indexed: Array<{ libraryKey: string; itemKey: string }>,
    scope: 'user' | 'all',
  ): Promise<PurgeResult> {
    const result: PurgeResult = { removed: 0, failed: 0 };
    for (const identity of indexed) {
      if (scope === 'user' && identity.libraryKey !== 'user') continue;
      if (localItemIDFromIdentity(identity) !== null) continue;
      try {
        await this.vectorStore.deleteItem(identity.libraryKey, identity.itemKey);
        indexFreshnessTracker.clearDirty(identity);
        result.removed++;
      } catch (error: any) {
        result.failed++;
        this.logger.warn(
          `Could not remove missing identity ${identity.libraryKey}/${identity.itemKey}: ` +
          `${error?.message || error}`,
        );
      }
    }
    return result;
  }

  private async getAllIndexedIdentities(
    activeModelId: string,
    activeIdentities: Array<{ libraryKey: string; itemKey: string }>,
  ): Promise<Array<{ libraryKey: string; itemKey: string }>> {
    const byKey = new Map(activeIdentities.map(identity => [
      freshnessIdentityKey(identity),
      identity,
    ]));
    if (typeof this.vectorStore.getPerModelStats !== 'function') {
      return Array.from(byKey.values());
    }
    const stats = await this.vectorStore.getPerModelStats();
    for (const stat of stats || []) {
      const modelId = String(stat?.modelId || '');
      if (!modelId || modelId === activeModelId) continue;
      const identities = await this.vectorStore.getIndexedIdentities(modelId);
      for (const identity of identities) {
        byKey.set(freshnessIdentityKey(identity), identity);
      }
    }
    return Array.from(byKey.values());
  }

  private async purgeExcludedIndexedItems(
    items: any[],
    indexed: Array<{ libraryKey: string; itemKey: string }>,
    exclusionPolicy: IndexExclusionPolicy,
    libraryScope: 'user' | 'all' | false,
  ): Promise<PurgeResult> {
    const result: PurgeResult = { removed: 0, failed: 0 };
    const indexedKeys = new Set(indexed.map(identity => freshnessIdentityKey(identity)));
    for (const item of items) {
      if (!isItemExcludedFromIndex(item, exclusionPolicy)) continue;
      const identity = identityFromItem(item);
      if (!identity || !indexedKeys.has(freshnessIdentityKey(identity))) continue;
      if (libraryScope === 'user' && identity.libraryKey !== 'user') continue;
      try {
        // Exclusion is a global policy, so remove every model partition and
        // fingerprint for this stable identity in one transaction.
        await this.vectorStore.deleteItem(identity.libraryKey, identity.itemKey);
        indexFreshnessTracker.clearDirty(identity);
        result.removed++;
      } catch (error: any) {
        indexFreshnessTracker.markDirty(identity);
        result.failed++;
        this.logger.warn(
          `Could not remove excluded identity ${identity.libraryKey}/${identity.itemKey}: ` +
          `${error?.message || error}`,
        );
      }
    }
    return result;
  }

  /** Reconcile only the explicit items supplied by a manual command. */
  public async reconcileItems(
    items: any[],
    options: ScopedReconciliationOptions = {},
  ): Promise<StartupCheckResult> {
    return this.reconcileProvidedItems(items, {
      ...options,
      allowWrites: options.allowWrites !== false,
      purgeMissingScope: options.purgeMissingScope || false,
    });
  }

  /**
   * Restore status after restart without adding items or invoking embedding.
   * Only identities already covered by the active model are inspected.
   */
  public async restoreIndexedFreshness(): Promise<StartupCheckResult> {
    if (!this.vectorStore) return this.emptyResult(true);
    try {
      const identities = await this.vectorStore.getIndexedIdentities(getActiveModelId());
      const items: any[] = [];
      for (const identity of identities) {
        const localID = localItemIDFromIdentity(identity);
        if (localID === null) continue;
        const item = Zotero.Items.get(localID);
        if (item) items.push(item);
      }
      // A later startup prompt must remain a true zero-write decision point.
      // If any indexed item proves that configuration changed, restore only
      // in-memory status and defer every fingerprint write until that choice.
      const configChanges = await this.inspectStartupConfigChanges(items);
      return this.reconcileProvidedItems(items, {
        allowWrites: false,
        persistFreshness: configChanges.affected === 0,
        purgeMissingScope: false,
      });
    } catch (error: any) {
      this.logger.error(`Freshness restore failed: ${error?.message || error}`);
      return this.emptyResult(true);
    }
  }

  private async inspectStartupConfigChanges(
    suppliedItems: any[],
  ): Promise<StartupConfigChangeContext> {
    if (!this.vectorStore) return { affected: 0, rebuildRequired: 0, checked: 0 };

    const mode = getIndexingMode(Zotero) as FreshnessIndexingMode;
    const configSnapshot = this.getConfigSnapshot(mode);
    const modelId = getActiveModelId();
    const exclusionPolicy = readIndexExclusionPolicy(Zotero);
    const storedMode = typeof this.vectorStore.getMetadata === 'function'
      ? normalizeStoredIndexingMode(await this.vectorStore.getMetadata('indexingMode'))
      : undefined;
    const storedModeChanged = storedMode !== undefined && storedMode !== mode;
    const indexedIdentities = await this.vectorStore.getIndexedIdentities(modelId);
    const indexed = new Set(indexedIdentities.map((identity: any) =>
      `${identity.libraryKey}\u0000${identity.itemKey}`));
    const suppliedKeys = new Set(suppliedItems
      .filter(item => this.shouldProcess(item, exclusionPolicy))
      .map(item => identityFromItem(item))
      .filter(Boolean)
      .map(identity => freshnessIdentityKey(identity!)));
    const scopedIndexedIdentities = indexedIdentities.filter((identity: any) =>
      suppliedKeys.has(freshnessIdentityKey(identity)));
    const indexStatus = typeof this.vectorStore.getIndexStatusByIdentity === 'function'
      ? await this.vectorStore.getIndexStatusByIdentity(scopedIndexedIdentities)
      : new Map<string, { wasTruncated: boolean }>();
    const seen = new Set<string>();
    let affected = 0;
    let rebuildRequired = 0;
    let checked = 0;

    for (const item of suppliedItems) {
      if (!this.shouldProcess(item, exclusionPolicy)) continue;
      const identity = identityFromItem(item);
      if (!identity) continue;
      const key = freshnessIdentityKey(identity);
      if (seen.has(key)) continue;
      seen.add(key);
      checked++;
      if (!indexed.has(key)) continue;
      const stored = await this.vectorStore.getStartupFingerprint(
        identity.libraryKey,
        identity.itemKey,
        modelId,
      );
      if (!stored && storedModeChanged) {
        affected++;
        rebuildRequired++;
        continue;
      }
      if (!stored) continue;
      const configAssessment = assessIndexConfigFingerprint(
        stored.configFingerprint,
        configSnapshot,
      );
      if (configAssessment === 'changed') {
        affected++;
        rebuildRequired++;
      } else if (configAssessment === 'max-chunks-increased') {
        affected++;
        const status = indexStatus.get(`${identity.libraryKey}|${identity.itemKey}`);
        // Missing status cannot prove that selective baseline advancement is safe.
        if (!status || status.wasTruncated) rebuildRequired++;
      }
    }

    return { affected, rebuildRequired, checked };
  }

  private async runCheck(promptForConfigChanges = false): Promise<StartupCheckResult> {
    if (!this.itemProvider) return this.emptyResult(true);
    try {
      const purgeMissingScope: 'user' | 'all' =
        Zotero.Prefs.get('zotseek.indexScope', true) === 'all' ? 'all' : 'user';
      const items = await this.itemProvider();
      if (promptForConfigChanges && this.startupConfigChangeCallback) {
        const context = await this.inspectStartupConfigChanges(items);
        if (context.affected > 0) {
          let choice: StartupConfigChangeChoice = 'cancel';
          try {
            choice = await this.startupConfigChangeCallback(context);
          } catch (error: any) {
            this.logger.warn(`Startup configuration decision failed: ${error?.message || error}`);
          }
          if (choice === 'rebuild') {
            if (this.startupRebuildCallback) {
              try {
                await this.startupRebuildCallback();
              } catch (error: any) {
                this.logger.error(`Startup rebuild failed: ${error?.message || error}`);
              }
            }
            const result = this.emptyResult(true);
            result.checked = context.checked;
            result.outdated = context.affected;
            return result;
          }
          if (choice !== 'update') {
            const result = this.emptyResult(true);
            result.checked = context.checked;
            result.outdated = context.affected;
            return result;
          }
        }
      }
      return this.reconcileProvidedItems(items, {
        allowWrites: true,
        purgeMissingScope,
      });
    } catch (error: any) {
      this.logger.error(`Startup item collection failed: ${error?.message || error}`);
      return this.emptyResult(true);
    }
  }

  private async reconcileProvidedItems(
    suppliedItems: any[],
    options: ScopedReconciliationOptions,
  ): Promise<StartupCheckResult> {
    const allowWrites = options.allowWrites !== false;
    const persistFreshness = options.persistFreshness !== false;
    const fullIndexCallback = options.fullIndexCallback || this.fullIndexCallback;
    const noteIndexCallback = options.noteIndexCallback || this.noteIndexCallback;
    if (this.checking || !this.vectorStore ||
        (allowWrites && (!fullIndexCallback || !noteIndexCallback))) {
      return this.emptyResult(true);
    }
    if (allowWrites && this.chunkStrategyBlocked) {
      this.logger.info('Reconciliation paused until the old chunk strategy is rebuilt');
      return this.emptyResult(true);
    }
    if (getActiveModelSelectionId() === SERVER_SLOT_SELECTION_ID &&
        getActiveModelId() === SERVER_SLOT_SELECTION_ID) {
      this.logger.info('Reconciliation skipped: the selected Local Server model is incomplete');
      return this.emptyResult(true);
    }

    this.checking = true;
    const result = this.emptyResult();
    const mode = getIndexingMode(Zotero) as FreshnessIndexingMode;
    const configSnapshot = this.getConfigSnapshot(mode);
    const configFingerprint = this.getConfigFingerprint(mode);
    const modelId = getActiveModelId();
    const exclusionPolicy = readIndexExclusionPolicy(Zotero);
    const storedMode = typeof this.vectorStore.getMetadata === 'function'
      ? normalizeStoredIndexingMode(await this.vectorStore.getMetadata('indexingMode'))
      : undefined;
    const storedModeChanged = storedMode !== undefined && storedMode !== mode;
    const snapshots = new Map<number, { quick: QuickSnapshot; content?: ContentSnapshot }>();

    try {
      const seen = new Set<string>();
      const scopedItems: any[] = [];
      const items: any[] = [];
      for (const item of suppliedItems) {
        if (!this.isScopedParent(item)) continue;
        const identity = identityFromItem(item);
        if (!identity) continue;
        const key = freshnessIdentityKey(identity);
        if (seen.has(key)) continue;
        seen.add(key);
        if (isItemExcludedFromIndex(item, exclusionPolicy)) {
          scopedItems.push(item);
        } else if (this.shouldProcess(item, exclusionPolicy)) {
          scopedItems.push(item);
          items.push(item);
        }
      }
      result.checked = scopedItems.length;

      const excludedItems = scopedItems.filter(item =>
        isItemExcludedFromIndex(item, exclusionPolicy));

      const indexedIdentities = await this.vectorStore.getIndexedIdentities(modelId);
      const indexed = new Set(indexedIdentities.map((identity: any) =>
        freshnessIdentityKey(identity)));
      const scopedIndexedIdentities = items
        .map(item => identityFromItem(item))
        .filter((identity): identity is { libraryKey: string; itemKey: string } =>
          !!identity && indexed.has(freshnessIdentityKey(identity)));
      const indexStatus = typeof this.vectorStore.getIndexStatusByIdentity === 'function'
        ? await this.vectorStore.getIndexStatusByIdentity(scopedIndexedIdentities)
        : new Map<string, { wasTruncated: boolean }>();
      let excludedOutdated = 0;

      if (allowWrites && (options.purgeMissingScope || excludedItems.length > 0)) {
        // Missing Zotero identities and exclusion rules are global across
        // embedding models, so inspect every partition before deleting.
        const allIndexedIdentities = await this.getAllIndexedIdentities(
          modelId,
          indexedIdentities,
        );
        if (options.purgeMissingScope) {
          const missing = await this.purgeMissingIndexedItems(
            allIndexedIdentities,
            options.purgeMissingScope,
          );
          result.removed += missing.removed;
          result.failed += missing.failed;
        }
        if (excludedItems.length > 0) {
          const excluded = await this.purgeExcludedIndexedItems(
            excludedItems,
            allIndexedIdentities,
            exclusionPolicy,
            options.purgeMissingScope || false,
          );
          result.removed += excluded.removed;
          result.failed += excluded.failed;
        }
      } else if (!allowWrites && excludedItems.length > 0) {
        excludedOutdated = excludedItems.filter(item => {
          const identity = identityFromItem(item);
          return !!identity && indexed.has(freshnessIdentityKey(identity));
        }).length;
      }

      const newItems: any[] = [];
      const rebuildItems: any[] = [];
      const noteItems: any[] = [];

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const identity = identityFromItem(item)!;
        const identityKey = `${identity.libraryKey}\u0000${identity.itemKey}`;

        if (!indexed.has(identityKey)) {
          const quick = await this.quickSnapshot(item, mode);
          snapshots.set(item.id, { quick });
          newItems.push(item);
          continue;
        }

        const quick = await this.quickSnapshot(item, mode);
        snapshots.set(item.id, { quick });
        if (options.forceFull === true) {
          indexFreshnessTracker.markDirty(identity);
          rebuildItems.push(item);
          continue;
        }
        const storedFingerprint = await this.vectorStore.getStartupFingerprint(
          identity.libraryKey,
          identity.itemKey,
          modelId,
        );
        if (!storedFingerprint && storedModeChanged) {
          indexFreshnessTracker.markDirty(identity);
          rebuildItems.push(item);
          continue;
        }
        const configAssessment = storedFingerprint
          ? assessIndexConfigFingerprint(
              storedFingerprint.configFingerprint,
              configSnapshot,
            )
          : null;
        const status = indexStatus.get(`${identity.libraryKey}|${identity.itemKey}`);
        const requiresConfigRebuild =
          configAssessment === 'changed' ||
          (configAssessment === 'max-chunks-increased' &&
            (!status || status.wasTruncated));
        const quickAssessment = assessQuickFreshness({
          indexed: true,
          mode,
          // Legacy-equal and safe max-chunk increases still need normal
          // Metadata/Note checks before their config fingerprint can advance.
          configFingerprint: requiresConfigRebuild
            ? configFingerprint
            : (storedFingerprint?.configFingerprint || configFingerprint),
          metadataFingerprint: quick.metadataFingerprint,
          noteStateFingerprint: quick.noteStateFingerprint,
          storedFingerprint,
        });

        if (quickAssessment === 'current') {
          const configFingerprintNeedsUpgrade = !!storedFingerprint &&
            storedFingerprint.configFingerprint !== configFingerprint;
          // Advance checkedAt only when the parent changed since verification,
          // avoiding writes for every unchanged item on every startup.
          if (persistFreshness && storedFingerprint &&
              (configFingerprintNeedsUpgrade ||
               isModifiedAfterVerification(item.dateModified, storedFingerprint.checkedAt))) {
            try {
              await this.vectorStore.setStartupFingerprint({
                ...storedFingerprint,
                configFingerprint,
                metadataFingerprint: quick.metadataFingerprint,
                noteStateFingerprint: quick.noteStateFingerprint,
                checkedAt: new Date().toISOString(),
              });
            } catch (error: any) {
              indexFreshnessTracker.markDirty(identity);
              result.failed++;
              this.logger.warn(
                `Could not advance config fingerprint for ` +
                `${identity.libraryKey}/${identity.itemKey}: ${error?.message || error}`,
              );
              continue;
            }
          }
          indexFreshnessTracker.clearDirty(identity);
          if (persistFreshness && configFingerprintNeedsUpgrade) result.baselined++;
          else result.unchanged++;
        } else if (quickAssessment === 'config-changed' ||
                   quickAssessment === 'metadata-changed') {
          indexFreshnessTracker.markDirty(identity);
          rebuildItems.push(item);
        } else if (quickAssessment === 'note-state-changed' && storedFingerprint) {
          const content = await this.contentSnapshot(item, quick, mode);
          snapshots.set(item.id, { quick, content });
          if (assessChangedNoteContent(storedFingerprint, content.noteContentFingerprint) === 'current') {
            if (persistFreshness) {
              const persisted = await this.persistFingerprintSafely(
                item,
                quick,
                content,
                configFingerprint,
                modelId,
              );
              if (!persisted) {
                result.failed++;
                continue;
              }
            }
            indexFreshnessTracker.clearDirty(identity);
            if (persistFreshness) result.baselined++;
            else result.unchanged++;
          } else {
            indexFreshnessTracker.markDirty(identity);
            noteItems.push(item);
          }
        } else {
          // Fingerprint-less indexes must be compared with the source text that
          // was actually embedded before a baseline can be trusted.
          const content = await this.contentSnapshot(item, quick, mode);
          snapshots.set(item.id, { quick, content });
          const stored = await this.storedSourceTexts(identity);
          const assessment = assessStoredSourceTexts(stored, {
            summary: content.summaryChunkTexts,
            notes: content.noteChunkTexts,
          });
          if (assessment === 'metadata-changed') {
            indexFreshnessTracker.markDirty(identity);
            rebuildItems.push(item);
          } else if (assessment === 'notes-changed') {
            indexFreshnessTracker.markDirty(identity);
            noteItems.push(item);
          } else {
            if (persistFreshness) {
              const persisted = await this.persistFingerprintSafely(
                item,
                quick,
                content,
                configFingerprint,
                modelId,
              );
              if (!persisted) {
                result.failed++;
                continue;
              }
            }
            indexFreshnessTracker.clearDirty(identity);
            if (persistFreshness) result.baselined++;
            else result.unchanged++;
          }
        }

        if ((index + 1) % YIELD_EVERY_ITEMS === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      const fullItems = [...newItems, ...rebuildItems];
      if (!allowWrites) {
        result.outdated = excludedOutdated + fullItems.length + noteItems.length + result.failed;
      } else {
        const configurationChanged =
          getActiveModelId() !== modelId ||
          getIndexingMode(Zotero) !== mode ||
          this.getConfigFingerprint(mode) !== configFingerprint;
        if (configurationChanged) {
          for (const item of items) {
            const identity = identityFromItem(item);
            if (identity && indexed.has(freshnessIdentityKey(identity))) {
              indexFreshnessTracker.markDirty(identity);
            }
          }
          result.outdated += items.filter(item => {
            const identity = identityFromItem(item);
            return !!identity && indexed.has(freshnessIdentityKey(identity));
          }).length;
          result.failed += fullItems.length + noteItems.length;
          result.skipped = true;
          this.logger.warn('Index configuration changed during freshness assessment; write callbacks skipped');
          return result;
        }
        if (fullItems.length > 0 && fullIndexCallback) {
          let callbackResult: IndexCallbackResult = {
            successfulIds: [],
            paused: false,
          };
          try {
            callbackResult = this.normalizeIndexCallbackResult(
              await fullIndexCallback(fullItems),
            );
          } catch (error: any) {
            this.logger.error(`Full-item reconciliation failed: ${error?.message || error}`);
          }
          const persisted = await this.persistSuccessful(
            fullItems,
            callbackResult.successfulIds,
            configFingerprint,
            snapshots,
            mode,
            modelId,
          );
          const newIDs = new Set(newItems.map(item => item.id));
          for (const id of persisted) {
            if (newIDs.has(id)) result.indexedNew++;
            else result.rebuilt++;
          }
          result.failed += fullItems.length - persisted.size;
          if (callbackResult.paused) {
            result.paused = true;
            // A paused full pass must not enter the Notes phase: the callback
            // may have stopped between items and the original scope must stay
            // recoverable for the next reconciliation.
            result.failed += noteItems.length;
            result.outdated = result.failed;
            return result;
          }
        }
        if (noteItems.length > 0 && noteIndexCallback) {
          let callbackResult: IndexCallbackResult = {
            successfulIds: [],
            paused: false,
          };
          try {
            callbackResult = this.normalizeIndexCallbackResult(
              await noteIndexCallback(noteItems),
            );
          } catch (error: any) {
            this.logger.error(`Note reconciliation failed: ${error?.message || error}`);
          }
          const persisted = await this.persistSuccessful(
            noteItems,
            callbackResult.successfulIds,
            configFingerprint,
            snapshots,
            mode,
            modelId,
          );
          result.notesUpdated = persisted.size;
          result.failed += noteItems.length - persisted.size;
          if (callbackResult.paused) result.paused = true;
        }
        result.outdated = result.failed;
      }

      this.logger.info(
        `Reconciliation complete: checked=${result.checked}, new=${result.indexedNew}, ` +
        `rebuilt=${result.rebuilt}, notes=${result.notesUpdated}, baseline=${result.baselined}, ` +
        `removed=${result.removed}, unchanged=${result.unchanged}, outdated=${result.outdated}, ` +
        `failed=${result.failed}`,
      );
      return result;
    } catch (error: any) {
      this.logger.error(`Reconciliation failed: ${error?.message || error}`);
      result.skipped = true;
      return result;
    } finally {
      this.checking = false;
      if (this.completionCallback) {
        try {
          await this.completionCallback(result);
        } catch (error: any) {
          this.logger.warn(`Reconciliation completion callback failed: ${error?.message || error}`);
        }
      }
    }
  }

  public getStatus(): {
    running: boolean;
    checking: boolean;
    pending: number;
    waiting: number;
    pendingNoteUpdates: number;
  } {
    return {
      running: this.running,
      checking: this.checking,
      pending: 0,
      waiting: 0,
      pendingNoteUpdates: 0,
    };
  }
}

export const autoIndexManager = AutoIndexManager.getInstance();

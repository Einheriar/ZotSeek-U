/**
 * Startup Index Manager
 *
 * Reconciles the ZotSeek index once after Zotero starts. It deliberately does
 * not register a Zotero.Notifier observer, poll the database, or react while a
 * user is editing a note.
 */

import { Logger } from '../utils/logger';
import { noteHTMLToText } from '../utils/note-text';
import { getIndexingMode } from '../utils/chunker';
import { identityFromItem, localItemIDFromIdentity } from './identity-resolver';
import { getActiveModelId } from './model-registry';
import { textExtractor } from './text-extractor';
import { isModifiedAfterVerification } from '../utils/timestamp';
import type { StartupFingerprint, TextSourceType } from './vector-store-sqlite';

declare const Zotero: any;

type IndexCallback = (items: any[]) => Promise<number[]>;
type ItemProvider = () => Promise<any[]>;
type CompletionCallback = (result: StartupCheckResult) => void | Promise<void>;

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

export type StartupCheckResult = {
  checked: number;
  indexedNew: number;
  rebuilt: number;
  notesUpdated: number;
  baselined: number;
  removed: number;
  unchanged: number;
  skipped: boolean;
};

const STARTUP_DELAY_MS = 10_000;
const YIELD_EVERY_ITEMS = 50;
const SUMMARY_SOURCES: TextSourceType[] = ['summary', 'abstract', 'title_only'];

function hashText(value: string): string {
  // Two independent 32-bit accumulators give a compact deterministic
  // fingerprint without requiring asynchronous crypto APIs.
  let h1 = 0xdeadbeef ^ value.length;
  let h2 = 0x41c6ce57 ^ value.length;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export class AutoIndexManager {
  private static instance: AutoIndexManager | null = null;

  private logger = new Logger('StartupIndexManager');
  private running = false;
  private checking = false;
  private startupTimer: any = null;
  private generation = 0;

  private fullIndexCallback: IndexCallback | null = null;
  private noteIndexCallback: IndexCallback | null = null;
  private itemProvider: ItemProvider | null = null;
  private completionCallback: CompletionCallback | null = null;
  private vectorStore: any = null;

  private constructor() {}

  public static getInstance(): AutoIndexManager {
    if (!AutoIndexManager.instance) {
      AutoIndexManager.instance = new AutoIndexManager();
    }
    return AutoIndexManager.instance;
  }

  public setIndexCallback(callback: IndexCallback): void {
    this.fullIndexCallback = callback;
  }

  public setNoteIndexCallback(callback: IndexCallback): void {
    this.noteIndexCallback = callback;
  }

  public setItemProvider(provider: ItemProvider): void {
    this.itemProvider = provider;
  }

  public setCompletionCallback(callback: CompletionCallback): void {
    this.completionCallback = callback;
  }

  public setVectorStore(store: any): void {
    this.vectorStore = store;
  }

  private isEnabled(): boolean {
    try {
      return Zotero.Prefs.get('zotseek.autoIndex', true) === true;
    } catch {
      return false;
    }
  }

  /** Schedule exactly one reconciliation pass after Zotero's UI has settled. */
  public start(): void {
    if (this.running || !this.isEnabled()) return;
    this.running = true;
    const generation = ++this.generation;
    this.startupTimer = setTimeout(() => {
      this.startupTimer = null;
      if (!this.running || generation !== this.generation) return;
      void this.runCheck();
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
  public async runNow(): Promise<StartupCheckResult> {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
    this.running = true;
    return this.runCheck();
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
      skipped,
    };
  }

  private getConfigFingerprint(): string {
    const mode = getIndexingMode(Zotero);
    const maxTokens = Zotero.Prefs.get('zotseek.maxTokens', true) ?? 450;
    const maxChunks = Zotero.Prefs.get('zotseek.maxChunksPerPaper', true) ?? 100;
    return hashText(JSON.stringify({ version: 1, mode, maxTokens, maxChunks }));
  }

  private shouldProcess(item: any): boolean {
    if (!item || item.deleted || item.parentID) return false;
    if (item.isNote?.() || item.isAttachment?.()) return false;
    const title = String(item.getField?.('title') || '').trim();
    if (!title) return false;

    const excludeBooks = Zotero.Prefs.get('zotseek.excludeBooks', true) ?? true;
    if (excludeBooks && item.itemType === 'book') return false;
    const excludeTag = Zotero.Prefs.get('zotseek.excludeTag', true);
    if (excludeTag && item.getTags?.()?.some((tag: any) => tag.tag === excludeTag)) return false;
    return true;
  }

  private metadataFingerprint(item: any): string {
    const tags = (item.getTags?.() || [])
      .map((tag: any) => String(tag?.tag || '').trim())
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b));
    return hashText(JSON.stringify({
      title: String(item.getField?.('title') || ''),
      abstract: String(item.getField?.('abstractNote') || ''),
      tags,
    }));
  }

  private async quickSnapshot(item: any): Promise<QuickSnapshot> {
    const noteIDs: number[] = getIndexingMode(Zotero) === 'abstract'
      ? []
      : (item.getNotes?.() || []);
    const loaded = noteIDs.length > 0 ? await Zotero.Items.getAsync(noteIDs) : [];
    const notes = (Array.isArray(loaded) ? loaded : [loaded])
      .filter((note: any) => note?.isNote?.() && !note.deleted)
      .sort((a: any, b: any) => String(a.key).localeCompare(String(b.key)));
    const state = notes.map((note: any) => [
      String(note.key || ''),
      String(note.version ?? ''),
      String(note.dateModified || note.getField?.('dateModified') || ''),
    ].join('\u0000')).join('\u0001');
    return {
      metadataFingerprint: this.metadataFingerprint(item),
      noteStateFingerprint: hashText(state),
      notes,
    };
  }

  private async contentSnapshot(item: any, quick: QuickSnapshot): Promise<ContentSnapshot> {
    const normalizedNotes = quick.notes.map((note: any) => ({
      key: String(note.key || ''),
      text: noteHTMLToText(note.getNote?.() || ''),
    }));
    const noteContentFingerprint = hashText(normalizedNotes
      .map(note => `${note.key}\u0000${note.text}`)
      .join('\u0001'));

    // Notes mode produces the same metadata/note text used by both Notes and
    // Full modes, without touching Zotero's PDF full-text APIs.
    const snapshotMode = getIndexingMode(Zotero) === 'abstract' ? 'abstract' : 'notes';
    const extracted = await textExtractor.extractChunksFromItem(item, snapshotMode);
    return {
      noteContentFingerprint,
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
    configFingerprint: string
  ): Promise<void> {
    const identity = identityFromItem(item);
    if (!identity) return;
    const fingerprint: StartupFingerprint = {
      libraryKey: identity.libraryKey,
      itemKey: identity.itemKey,
      modelId: getActiveModelId(),
      configFingerprint,
      metadataFingerprint: quick.metadataFingerprint,
      noteStateFingerprint: quick.noteStateFingerprint,
      noteContentFingerprint: content.noteContentFingerprint,
      checkedAt: new Date().toISOString(),
    };
    await this.vectorStore.setStartupFingerprint(fingerprint);
  }

  private async persistSuccessful(
    items: any[],
    successfulIds: number[],
    configFingerprint: string,
    snapshots: Map<number, { quick: QuickSnapshot; content: ContentSnapshot }>
  ): Promise<number> {
    const successful = new Set(successfulIds);
    let count = 0;
    for (const item of items) {
      if (!successful.has(item.id)) continue;
      let snapshot = snapshots.get(item.id);
      if (!snapshot) {
        const quick = await this.quickSnapshot(item);
        snapshot = { quick, content: await this.contentSnapshot(item, quick) };
      }
      await this.persistFingerprint(item, snapshot.quick, snapshot.content, configFingerprint);
      count++;
    }
    return count;
  }

  private async purgeMissingIndexedItems(
    indexed: Array<{ libraryKey: string; itemKey: string }>
  ): Promise<number> {
    const scope = Zotero.Prefs.get('zotseek.indexScope', true) === 'all' ? 'all' : 'user';
    let removed = 0;
    for (const identity of indexed) {
      if (scope === 'user' && identity.libraryKey !== 'user') continue;
      if (localItemIDFromIdentity(identity) !== null) continue;
      await this.vectorStore.deleteItem(identity.libraryKey, identity.itemKey);
      removed++;
    }
    return removed;
  }

  private async runCheck(): Promise<StartupCheckResult> {
    if (this.checking || !this.itemProvider || !this.vectorStore ||
        !this.fullIndexCallback || !this.noteIndexCallback) {
      return this.emptyResult(true);
    }

    this.checking = true;
    const result = this.emptyResult();
    const configFingerprint = this.getConfigFingerprint();
    const modelId = getActiveModelId();
    const snapshots = new Map<number, { quick: QuickSnapshot; content: ContentSnapshot }>();

    try {
      const items = (await this.itemProvider()).filter(item => this.shouldProcess(item));
      result.checked = items.length;
      const indexedIdentities = await this.vectorStore.getIndexedIdentities(modelId);
      result.removed = await this.purgeMissingIndexedItems(indexedIdentities);
      const indexed = new Set(indexedIdentities.map((identity: any) =>
        `${identity.libraryKey}\u0000${identity.itemKey}`));

      const newItems: any[] = [];
      const rebuildItems: any[] = [];
      const noteItems: any[] = [];

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const identity = identityFromItem(item);
        if (!identity) continue;
        const identityKey = `${identity.libraryKey}\u0000${identity.itemKey}`;

        if (!indexed.has(identityKey)) {
          newItems.push(item);
          continue;
        }

        const quick = await this.quickSnapshot(item);
        const storedFingerprint = await this.vectorStore.getStartupFingerprint(
          identity.libraryKey,
          identity.itemKey,
          modelId
        );

        if (storedFingerprint) {
          if (storedFingerprint.configFingerprint !== configFingerprint ||
              storedFingerprint.metadataFingerprint !== quick.metadataFingerprint) {
            rebuildItems.push(item);
          } else if (storedFingerprint.noteStateFingerprint === quick.noteStateFingerprint) {
            // The lightweight fingerprints prove indexed content is still
            // current. Advance checkedAt only when Zotero's parent item has
            // changed since the previous verification, avoiding thousands of
            // unnecessary writes on every otherwise-idle startup.
            if (isModifiedAfterVerification(item.dateModified, storedFingerprint.checkedAt)) {
              await this.vectorStore.setStartupFingerprint({
                ...storedFingerprint,
                checkedAt: new Date().toISOString(),
              });
            }
            result.unchanged++;
          } else {
            const content = await this.contentSnapshot(item, quick);
            snapshots.set(item.id, { quick, content });
            if (storedFingerprint.noteContentFingerprint === content.noteContentFingerprint) {
              await this.persistFingerprint(item, quick, content, configFingerprint);
              result.baselined++;
            } else {
              noteItems.push(item);
            }
          }
        } else {
          // First v10 startup: verify current text against the chunks that were
          // actually embedded. Never bless an unknown database blindly.
          const content = await this.contentSnapshot(item, quick);
          snapshots.set(item.id, { quick, content });
          const stored = await this.storedSourceTexts(identity);
          const metadataMatches = arraysEqual(stored.summary, content.summaryChunkTexts);
          const notesMatch = arraysEqual(stored.notes, content.noteChunkTexts);

          if (!metadataMatches) {
            rebuildItems.push(item);
          } else if (!notesMatch) {
            noteItems.push(item);
          } else {
            await this.persistFingerprint(item, quick, content, configFingerprint);
            result.baselined++;
          }
        }

        if ((index + 1) % YIELD_EVERY_ITEMS === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      if (newItems.length > 0) {
        const successful = await this.fullIndexCallback(newItems);
        result.indexedNew = await this.persistSuccessful(
          newItems, successful, configFingerprint, snapshots);
      }
      if (rebuildItems.length > 0) {
        const successful = await this.fullIndexCallback(rebuildItems);
        result.rebuilt = await this.persistSuccessful(
          rebuildItems, successful, configFingerprint, snapshots);
      }
      if (noteItems.length > 0) {
        const successful = await this.noteIndexCallback(noteItems);
        result.notesUpdated = await this.persistSuccessful(
          noteItems, successful, configFingerprint, snapshots);
      }

      this.logger.info(
        `Startup reconciliation complete: checked=${result.checked}, new=${result.indexedNew}, ` +
        `rebuilt=${result.rebuilt}, notes=${result.notesUpdated}, baseline=${result.baselined}, ` +
        `removed=${result.removed}, unchanged=${result.unchanged}`
      );
      return result;
    } catch (error: any) {
      this.logger.error(`Startup reconciliation failed: ${error?.message || error}`);
      result.skipped = true;
      return result;
    } finally {
      this.checking = false;
      if (this.completionCallback) {
        try {
          await this.completionCallback(result);
        } catch (error: any) {
          this.logger.warn(`Startup completion callback failed: ${error?.message || error}`);
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

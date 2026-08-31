/** Lightweight Zotero.Notifier bridge for index freshness. */

import { Logger } from '../utils/logger';
import { getIndexingMode } from '../utils/chunker';
import {
  identityFromItem,
  libraryKeyFromLocalID,
  type StableIdentity,
} from './identity-resolver';
import {
  indexFreshnessTracker,
  notificationAffectsIndexedMetadata,
} from './index-freshness';

declare const Zotero: any;

type UnresolvedDeleteCallback = () => unknown | Promise<unknown>;

export class IndexFreshnessNotifier {
  private logger = new Logger('IndexFreshnessNotifier');
  private observerID: string | null = null;
  private unresolvedDeleteCallback: UnresolvedDeleteCallback | null = null;
  private unresolvedDeleteTimer: ReturnType<typeof setTimeout> | null = null;

  private observer = {
    notify: (
      event: string,
      type: string,
      ids: Array<number | string>,
      extraData: Record<string, any>,
    ) => this.handleNotification(event, type, ids, extraData),
  };

  start(onUnresolvedDelete?: UnresolvedDeleteCallback): void {
    if (this.observerID) return;
    this.unresolvedDeleteCallback = onUnresolvedDelete || null;
    if (!Zotero?.Notifier?.registerObserver) {
      this.logger.warn('Zotero.Notifier unavailable; realtime freshness tracking disabled');
      return;
    }
    this.observerID = Zotero.Notifier.registerObserver(
      this.observer,
      ['item'],
      'zotseek-index-freshness',
    );
    this.logger.info('Registered item observer for index freshness');
  }

  stop(): void {
    if (this.unresolvedDeleteTimer) {
      clearTimeout(this.unresolvedDeleteTimer);
      this.unresolvedDeleteTimer = null;
    }
    if (this.observerID && Zotero?.Notifier?.unregisterObserver) {
      try {
        Zotero.Notifier.unregisterObserver(this.observerID);
      } catch (error: any) {
        this.logger.warn(`Could not unregister freshness observer: ${error?.message || error}`);
      }
    }
    this.observerID = null;
    this.unresolvedDeleteCallback = null;
  }

  private async handleNotification(
    event: string,
    type: string,
    ids: Array<number | string>,
    extraData: Record<string, any> = {},
  ): Promise<void> {
    if (type !== 'item') return;
    const mode = getIndexingMode(Zotero);
    let unresolvedDelete = false;

    for (const rawID of ids || []) {
      const id = Number(rawID);
      if (!Number.isFinite(id) || id <= 0) continue;

      let item: any = null;
      try {
        item = Zotero.Items.get(id);
      } catch {
        item = null;
      }

      if (item?.isNote?.()) {
        const parent = item.parentID ? Zotero.Items.get(item.parentID) : null;
        const parentIdentity = identityFromItem(parent);
        if (parentIdentity) {
          indexFreshnessTracker.rememberChildNote(
            item,
            parentIdentity,
            identityFromItem(item),
          );
          if (mode !== 'abstract') indexFreshnessTracker.markDirty(parentIdentity);
        }
        continue;
      }

      if (item?.isRegularItem?.()) {
        const identity = identityFromItem(item);
        if (!identity) continue;
        const unknownIsRelevant = mode !== 'abstract';
        const relevant = event === 'refresh' && mode === 'abstract'
          ? false
          : notificationAffectsIndexedMetadata(
              event,
              id,
              extraData,
              field => Zotero.ItemFields?.getName?.(field),
              unknownIsRelevant,
            );
        if (relevant) indexFreshnessTracker.markDirty(identity);
        continue;
      }

      if (event === 'delete') {
        const stableNoteIdentity = this.identityFromDeleteExtraData(id, extraData);
        const parentIdentity = indexFreshnessTracker.getRememberedParentForNote(
          id,
          stableNoteIdentity,
        );
        if (parentIdentity) {
          if (mode !== 'abstract') indexFreshnessTracker.markDirty(parentIdentity);
          indexFreshnessTracker.forgetChildNote(id, stableNoteIdentity);
        } else {
          // Zotero's permanent-delete payload contains only libraryID/key, not
          // parentID. A parent refresh normally accompanies it; if it does not,
          // recheck only already-indexed identities after this notifier batch.
          unresolvedDelete = true;
        }
      }
    }

    if (unresolvedDelete) this.scheduleUnresolvedDeleteCheck();
  }

  private identityFromDeleteExtraData(
    id: number,
    extraData: Record<string, any>,
  ): StableIdentity | null {
    const data = extraData?.[id] ?? extraData;
    const libraryID = Number(data?.libraryID);
    const itemKey = String(data?.key || '');
    if (!Number.isFinite(libraryID) || !itemKey) return null;
    const libraryKey = libraryKeyFromLocalID(libraryID);
    return libraryKey ? { libraryKey, itemKey } : null;
  }

  private scheduleUnresolvedDeleteCheck(): void {
    if (!this.unresolvedDeleteCallback || this.unresolvedDeleteTimer) return;
    this.unresolvedDeleteTimer = setTimeout(() => {
      this.unresolvedDeleteTimer = null;
      try {
        void Promise.resolve(this.unresolvedDeleteCallback?.()).catch((error: any) => {
          this.logger.warn(`Fallback freshness check failed: ${error?.message || error}`);
        });
      } catch (error: any) {
        this.logger.warn(`Fallback freshness check failed: ${error?.message || error}`);
      }
    }, 300);
  }
}

export const indexFreshnessNotifier = new IndexFreshnessNotifier();

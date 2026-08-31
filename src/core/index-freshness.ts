/**
 * Shared index-freshness primitives.
 *
 * Fingerprints describe the Zotero content that belongs to the active index
 * configuration. The in-memory tracker only records that a parent item needs
 * verification; it never starts extraction or embedding work.
 */

import type { StableIdentity } from './identity-resolver';
import type { StartupFingerprint } from './vector-store-sqlite';

export type FreshnessIndexingMode = 'abstract' | 'notes' | 'full';

export type QuickFreshnessAssessment =
  | 'unindexed'
  | 'current'
  | 'config-changed'
  | 'metadata-changed'
  | 'note-state-changed'
  | 'unverified';

export type VerifiedFreshnessAssessment =
  | 'current'
  | 'metadata-changed'
  | 'notes-changed';

export type FreshnessDisplayState =
  | 'not-indexed'
  | 'indexed'
  | 'partial'
  | 'outdated'
  | 'excluded';

export interface NoteStateLike {
  key?: unknown;
  version?: unknown;
  dateModified?: unknown;
  getField?: (field: string) => unknown;
}

export interface NoteContentLike {
  key: string;
  text: string;
}

export interface SourceTextSnapshot {
  summary: string[];
  notes: string[];
}

export function freshnessIdentityKey(identity: StableIdentity): string {
  return `${identity.libraryKey}\u0000${identity.itemKey}`;
}

export function hashFreshnessText(value: string): string {
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

export function metadataFingerprint(item: any): string {
  const tags = (item?.getTags?.() || [])
    .map((tag: any) => String(tag?.tag || '').trim())
    .filter(Boolean)
    .sort((a: string, b: string) => a.localeCompare(b));
  return hashFreshnessText(JSON.stringify({
    title: String(item?.getField?.('title') || ''),
    abstract: String(item?.getField?.('abstractNote') || ''),
    tags,
  }));
}

export function noteStateFingerprint(
  notes: NoteStateLike[],
  mode: FreshnessIndexingMode,
): string {
  if (mode === 'abstract') return hashFreshnessText('');
  const stableState = [...notes]
    .sort((a, b) => String(a.key || '').localeCompare(String(b.key || '')))
    .map(note => [
      String(note.key || ''),
      String(note.version ?? ''),
      String(note.dateModified || note.getField?.('dateModified') || ''),
    ].join('\u0000'))
    .join('\u0001');
  return hashFreshnessText(stableState);
}

export function noteContentFingerprint(
  notes: NoteContentLike[],
  mode: FreshnessIndexingMode,
): string {
  if (mode === 'abstract') return hashFreshnessText('');
  const stableContent = [...notes]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(note => `${note.key}\u0000${note.text}`)
    .join('\u0001');
  return hashFreshnessText(stableContent);
}

export function assessQuickFreshness(input: {
  indexed: boolean;
  mode: FreshnessIndexingMode;
  configFingerprint: string;
  metadataFingerprint: string;
  noteStateFingerprint: string;
  storedFingerprint: StartupFingerprint | null;
}): QuickFreshnessAssessment {
  if (!input.indexed) return 'unindexed';
  if (!input.storedFingerprint) return 'unverified';
  if (input.storedFingerprint.configFingerprint !== input.configFingerprint) {
    return 'config-changed';
  }
  if (input.storedFingerprint.metadataFingerprint !== input.metadataFingerprint) {
    return 'metadata-changed';
  }
  if (input.mode !== 'abstract' &&
      input.storedFingerprint.noteStateFingerprint !== input.noteStateFingerprint) {
    return 'note-state-changed';
  }
  return 'current';
}

export function assessChangedNoteContent(
  storedFingerprint: StartupFingerprint,
  currentNoteContentFingerprint: string,
): 'current' | 'notes-changed' {
  return storedFingerprint.noteContentFingerprint === currentNoteContentFingerprint
    ? 'current'
    : 'notes-changed';
}

export function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Safely classify an old index that predates persisted fingerprints. */
export function assessStoredSourceTexts(
  stored: SourceTextSnapshot,
  current: SourceTextSnapshot,
): VerifiedFreshnessAssessment {
  if (!arraysEqual(stored.summary, current.summary)) return 'metadata-changed';
  if (!arraysEqual(stored.notes, current.notes)) return 'notes-changed';
  return 'current';
}

/** Apply the documented status priority in one testable place. */
export function resolveFreshnessDisplayState(input: {
  excluded: boolean;
  covered: boolean;
  dirty: boolean;
  timestampOutdated: boolean;
  truncated: boolean;
}): FreshnessDisplayState {
  if (input.excluded) return 'excluded';
  if (!input.covered) return 'not-indexed';
  if (input.dirty || input.timestampOutdated) return 'outdated';
  if (input.truncated) return 'partial';
  return 'indexed';
}

type TrackerListener = (identity: StableIdentity, dirty: boolean) => void;

/** Process-local dirty state plus a best-effort Child Note parent cache. */
export class IndexFreshnessTracker {
  private dirty = new Set<string>();
  private listeners = new Set<TrackerListener>();
  private noteParentByLocalID = new Map<number, StableIdentity>();
  private noteParentByStableKey = new Map<string, StableIdentity>();

  markDirty(identity: StableIdentity): void {
    const key = freshnessIdentityKey(identity);
    if (this.dirty.has(key)) return;
    this.dirty.add(key);
    this.emit(identity, true);
  }

  clearDirty(identity: StableIdentity): void {
    const key = freshnessIdentityKey(identity);
    if (!this.dirty.delete(key)) return;
    this.emit(identity, false);
  }

  isDirty(identity: StableIdentity): boolean {
    return this.dirty.has(freshnessIdentityKey(identity));
  }

  clearAll(): void {
    const identities = Array.from(this.dirty).map(key => {
      const [libraryKey, itemKey] = key.split('\u0000');
      return { libraryKey, itemKey };
    });
    this.dirty.clear();
    identities.forEach(identity => this.emit(identity, false));
  }

  onChange(listener: TrackerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  rememberChildNote(
    note: any,
    parentIdentity: StableIdentity,
    stableNoteIdentity?: StableIdentity | null,
  ): void {
    const localID = Number(note?.id);
    if (Number.isFinite(localID) && localID > 0) {
      this.noteParentByLocalID.set(localID, parentIdentity);
    }
    if (stableNoteIdentity) {
      this.noteParentByStableKey.set(freshnessIdentityKey(stableNoteIdentity), parentIdentity);
    }
  }

  getRememberedParentForNote(
    localID: number,
    stableNoteIdentity?: StableIdentity | null,
  ): StableIdentity | null {
    const byID = this.noteParentByLocalID.get(localID);
    if (byID) return byID;
    if (!stableNoteIdentity) return null;
    return this.noteParentByStableKey.get(freshnessIdentityKey(stableNoteIdentity)) || null;
  }

  forgetChildNote(localID: number, stableNoteIdentity?: StableIdentity | null): void {
    this.noteParentByLocalID.delete(localID);
    if (stableNoteIdentity) {
      this.noteParentByStableKey.delete(freshnessIdentityKey(stableNoteIdentity));
    }
  }

  private emit(identity: StableIdentity, dirty: boolean): void {
    for (const listener of this.listeners) listener(identity, dirty);
  }
}

/**
 * A parent-item modify with no field details is how Zotero reports several
 * child-list changes, so it must be treated conservatively. When details are
 * present, ignore unrelated bibliographic fields.
 */
export function notificationAffectsIndexedMetadata(
  event: string,
  id: number,
  extraData: Record<string, any> | undefined,
  resolveFieldName?: (field: number) => string | undefined,
  treatUnknownAsRelevant = true,
): boolean {
  if (event !== 'modify') return ['add', 'refresh', 'trash', 'delete'].includes(event);
  const data = extraData?.[id] ?? extraData ?? {};
  const changed = data?.changed;
  if (!changed || typeof changed !== 'object') return treatUnknownAsRelevant;
  const keys = Object.keys(changed);
  if (keys.length === 0) return treatUnknownAsRelevant;

  for (const key of keys) {
    if (['title', 'abstractNote', 'tags', 'deleted', 'parentKey', 'note'].includes(key)) {
      return true;
    }
    const numeric = Number(key);
    if (Number.isInteger(numeric)) {
      const name = resolveFieldName?.(numeric);
      if (name === 'title' || name === 'abstractNote') return true;
    }
  }
  return false;
}

export const indexFreshnessTracker = new IndexFreshnessTracker();

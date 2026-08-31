import './helpers/zotero-stub';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { IndexFreshnessNotifier } from '../src/core/index-freshness-notifier';
import { indexFreshnessTracker } from '../src/core/index-freshness';
import { itemTreeIndexColumn } from '../src/ui/item-tree-column';

test('Notifier maps Child Note lifecycle events to only the parent stable identity', async () => {
  const zotero = installZoteroStub({ 'zotseek.indexingMode': 'notes' });
  const parent = {
    id: 10,
    key: 'PARENT01',
    libraryID: 1,
    isRegularItem: () => true,
    isNote: () => false,
  };
  const note = {
    id: 20,
    key: 'CHNOTE01',
    libraryID: 1,
    parentID: 10,
    isRegularItem: () => false,
    isNote: () => true,
  };
  const items = new Map<number, any>([[10, parent], [20, note]]);
  let observer: any = null;
  let unregistered: unknown = null;
  zotero.Libraries = {
    userLibraryID: 1,
    get: (id: number) => id === 1 ? { libraryType: 'user' } : null,
  };
  zotero.Items = { get: (id: number) => items.get(id) || null };
  zotero.ItemFields = { getName: (id: number) => id === 1 ? 'title' : 'date' };
  zotero.Notifier = {
    registerObserver: (candidate: any) => {
      observer = candidate;
      return 'freshness-observer';
    },
    unregisterObserver: (id: unknown) => { unregistered = id; },
  };

  const notifier = new IndexFreshnessNotifier();
  const identity = { libraryKey: 'user', itemKey: 'PARENT01' };
  notifier.start();
  assert.ok(observer);
  assert.equal((itemTreeIndexColumn as any).getCellText(note), '');

  for (const event of ['add', 'modify', 'trash']) {
    indexFreshnessTracker.clearDirty(identity);
    await observer.notify(event, 'item', [20], {});
    assert.equal(indexFreshnessTracker.isDirty(identity), true, event);
  }

  // The earlier events populated the stable parent cache. Zotero no longer
  // exposes the Note object during a permanent delete, so the cache must carry
  // the parent mapping across that final notification.
  indexFreshnessTracker.clearDirty(identity);
  items.delete(20);
  await observer.notify('delete', 'item', [20], {
    20: { libraryID: 1, key: 'CHNOTE01' },
  });
  assert.equal(indexFreshnessTracker.isDirty(identity), true);

  // Restoring the Note and changing indexed parent metadata are both relevant.
  items.set(20, note);
  indexFreshnessTracker.clearDirty(identity);
  await observer.notify('modify', 'item', [20], { 20: { changed: { deleted: true } } });
  assert.equal(indexFreshnessTracker.isDirty(identity), true);

  indexFreshnessTracker.clearDirty(identity);
  await observer.notify('modify', 'item', [10], { 10: { changed: { 1: 'old title' } } });
  assert.equal(indexFreshnessTracker.isDirty(identity), true);

  // Child Notes do not participate in abstract mode.
  zotero.Prefs.set('zotseek.indexingMode', 'abstract');
  indexFreshnessTracker.clearDirty(identity);
  await observer.notify('modify', 'item', [20], {});
  assert.equal(indexFreshnessTracker.isDirty(identity), false);

  // The excluded state uses the configured tag, not a hard-coded spelling.
  zotero.Prefs.set('zotseek.excludeTag', 'custom-exclude');
  (parent as any).getTags = () => [{ tag: 'custom-exclude' }];
  assert.equal((itemTreeIndexColumn as any).renderState(
    'indexed',
    parent,
    {
      indexedAt: '2026-08-30T00:00:00Z',
      checkedAt: '2026-08-31T00:00:00Z',
      wasTruncated: false,
    },
  ), '⊘');

  notifier.stop();
  assert.equal(unregistered, 'freshness-observer');
  indexFreshnessTracker.clearAll();
});

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import {
  METADATA_IDENTITY_CACHE_MAX_BYTES,
  MetadataIdentityCache,
  MetadataIdentitySnapshotCandidate,
  metadataIdentityScopeKey,
} from '../src/core/metadata-identity-cache';

function candidate(
  itemId: number,
  overrides: Partial<MetadataIdentitySnapshotCandidate> = {},
): MetadataIdentitySnapshotCandidate {
  return {
    id: String(itemId),
    itemId,
    libraryKey: 'user',
    itemKey: `ITEM${String(itemId).padStart(4, '0')}`,
    title: `Title ${itemId}`,
    doi: '',
    year: '2024',
    creators: [{ firstName: 'Test', lastName: 'Author' }],
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('bounded metadata identity cache', () => {
  test('keys every candidate-set input and keeps only the current scope', async () => {
    assert.notEqual(
      metadataIdentityScopeKey({ libraryId: 1, excludeBooks: true }),
      metadataIdentityScopeKey({ libraryId: 2, excludeBooks: true }),
    );
    assert.notEqual(
      metadataIdentityScopeKey({ libraryId: 1, collectionId: 10, excludeBooks: true }),
      metadataIdentityScopeKey({ libraryId: 1, collectionId: 11, excludeBooks: true }),
    );
    assert.notEqual(
      metadataIdentityScopeKey({ libraryId: 1, collectionId: 10, includeSubcollections: false, excludeBooks: true }),
      metadataIdentityScopeKey({ libraryId: 1, collectionId: 10, includeSubcollections: true, excludeBooks: true }),
    );
    assert.notEqual(
      metadataIdentityScopeKey({ libraryId: 1, collectionId: 10, candidateFilterKey: 'scope-a', excludeBooks: true }),
      metadataIdentityScopeKey({ libraryId: 1, collectionId: 10, candidateFilterKey: 'scope-b', excludeBooks: true }),
    );
    assert.notEqual(
      metadataIdentityScopeKey({ libraryId: 1, excludeBooks: true }),
      metadataIdentityScopeKey({ libraryId: 1, excludeBooks: false }),
    );

    const cache = new MetadataIdentityCache();
    let builds = 0;
    const builder = async () => [candidate(++builds)];
    const user = { libraryId: 1, excludeBooks: true };
    const group = { libraryId: 2, excludeBooks: true };

    assert.equal((await cache.getOrBuild(user, builder)).state, 'built');
    assert.equal((await cache.getOrBuild(user, builder)).state, 'hit');
    assert.equal(builds, 1);
    assert.equal((await cache.getOrBuild(group, builder)).state, 'built');
    assert.equal(builds, 2);
    assert.equal((await cache.getOrBuild(user, builder)).state, 'built');
    assert.equal(builds, 3);
  });

  test('shares a keyed first build between concurrent callers', async () => {
    const cache = new MetadataIdentityCache();
    const pending = deferred<MetadataIdentitySnapshotCandidate[]>();
    let builds = 0;
    const builder = async () => {
      builds++;
      return pending.promise;
    };
    const scope = { libraryId: 1, excludeBooks: true };

    const first = cache.getOrBuild(scope, builder);
    const second = cache.getOrBuild(scope, builder);
    pending.resolve([candidate(1)]);

    const [left, right] = await Promise.all([first, second]);
    assert.equal(builds, 1);
    assert.equal(left.snapshot, right.snapshot);
    assert.equal(left.snapshot?.candidates.length, 1);
  });

  test('never publishes a build invalidated while it is in flight', async () => {
    const cache = new MetadataIdentityCache();
    const pending = deferred<MetadataIdentitySnapshotCandidate[]>();
    const scope = { libraryId: 1, excludeBooks: true };
    const stale = cache.getOrBuild(scope, async () => pending.promise);
    cache.invalidate('test mutation');
    pending.resolve([candidate(1)]);

    assert.deepEqual(await stale, { state: 'unavailable', reason: 'stale-build' });
    const fresh = await cache.getOrBuild(scope, async () => [candidate(2)]);
    assert.equal(fresh.state, 'built');
    assert.deepEqual(fresh.snapshot?.candidates.map(value => value.itemId), [2]);
  });

  test('rejects an over-budget snapshot without publishing a partial result', async () => {
    const cache = new MetadataIdentityCache(256);
    let builds = 0;
    const builder = async () => {
      builds++;
      return [candidate(1, { title: 'x'.repeat(500) })];
    };
    const scope = { libraryId: 1, excludeBooks: true };

    const rejected = await cache.getOrBuild(scope, builder);
    assert.equal(rejected.state, 'unavailable');
    assert.match(rejected.reason ?? '', /exceeds 256 bytes/);
    assert.equal(rejected.snapshot, undefined);
    assert.equal((await cache.getOrBuild(scope, builder)).state, 'unavailable');
    assert.equal(builds, 1);
  });

  test('contains build failures until invalidation and then retries cleanly', async () => {
    const cache = new MetadataIdentityCache();
    let builds = 0;
    const scope = { libraryId: 1, excludeBooks: true };
    const builder = async () => {
      builds++;
      if (builds === 1) throw new Error('metadata unavailable');
      return [candidate(2)];
    };

    assert.equal((await cache.getOrBuild(scope, builder)).state, 'unavailable');
    assert.equal((await cache.getOrBuild(scope, builder)).state, 'unavailable');
    assert.equal(builds, 1);
    cache.invalidate('retry');
    assert.equal((await cache.getOrBuild(scope, builder)).state, 'built');
    assert.equal(builds, 2);
  });

  test('destroy prevents an old build from resurrecting and releases references', async () => {
    const cache = new MetadataIdentityCache();
    const pending = deferred<MetadataIdentitySnapshotCandidate[]>();
    const scope = { libraryId: 1, excludeBooks: true };
    const building = cache.getOrBuild(scope, async () => pending.promise);
    cache.destroy();
    pending.resolve([candidate(1)]);

    assert.deepEqual(await building, { state: 'unavailable', reason: 'stale-build' });
    assert.deepEqual(await cache.getOrBuild(scope, async () => [candidate(2)]), {
      state: 'unavailable',
      reason: 'destroyed',
    });
  });

  test('observes item and collection changes and unregisters on stop', async () => {
    const zotero = installZoteroStub();
    let observer: any;
    let observedTypes: string[] = [];
    const unregistered: string[] = [];
    zotero.Notifier = {
      registerObserver: (value: any, types: string[]) => {
        observer = value;
        observedTypes = types;
        return 'metadata-cache-observer';
      },
      unregisterObserver: (id: string) => unregistered.push(id),
    };
    const cache = new MetadataIdentityCache();
    const scope = { libraryId: 1, excludeBooks: true };
    let builds = 0;
    const builder = async () => [candidate(++builds)];

    cache.start();
    assert.deepEqual(observedTypes, ['item', 'collection-item', 'collection']);
    await cache.getOrBuild(scope, builder);
    await observer.notify('modify', 'collection-item', []);
    assert.equal((await cache.getOrBuild(scope, builder)).state, 'built');
    assert.equal(builds, 2);
    cache.stop();
    assert.deepEqual(unregistered, ['metadata-cache-observer']);
    assert.equal(METADATA_IDENTITY_CACHE_MAX_BYTES, 32 * 1024 * 1024);
  });
});

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { VectorStoreSQLite } from '../src/core/vector-store-sqlite';
import type { PaperEmbedding } from '../src/core/vector-store-sqlite';

interface Deferred<T = void> {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
  reject(reason?: unknown): void;
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, deny) => {
    resolve = accept;
    reject = deny;
  });
  return { promise, resolve, reject };
}

interface LexicalRow {
  itemPk: number;
  libraryKey: string;
  itemKey: string;
  chunkIndex: number;
  chunkText: string;
  sectionPaths: string | null;
  pdfAttachmentKey: string | null;
  textSource: 'summary' | 'note' | 'content';
}

function lexicalColumn(sql: string, rows: LexicalRow[]): unknown[] {
  if (/SELECT c\.item_pk\s/i.test(sql)) return rows.map(row => row.itemPk);
  if (/SELECT i\.library_key\s/i.test(sql)) return rows.map(row => row.libraryKey);
  if (/SELECT i\.item_key\s/i.test(sql)) return rows.map(row => row.itemKey);
  if (/SELECT c\.chunk_index\s/i.test(sql)) return rows.map(row => row.chunkIndex);
  if (/SELECT c\.chunk_text\s/i.test(sql)) return rows.map(row => row.chunkText);
  if (/SELECT c\.section_paths\s/i.test(sql)) return rows.map(row => row.sectionPaths);
  if (/SELECT c\.pdf_attachment_key\s/i.test(sql)) return rows.map(row => row.pdfAttachmentKey);
  if (/SELECT c\.text_source\s/i.test(sql)) return rows.map(row => row.textSource);
  throw new Error(`Unexpected lexical SQL: ${sql}`);
}

function lexicalRow(
  itemKey: string,
  chunkText: string,
  options: { itemPk?: number; libraryKey?: string; textSource?: LexicalRow['textSource'] } = {},
): LexicalRow {
  return {
    itemPk: options.itemPk ?? (itemKey === 'OLD00001' ? 1 : 2),
    libraryKey: options.libraryKey ?? 'user',
    itemKey,
    chunkIndex: 0,
    chunkText,
    sectionPaths: null,
    pdfAttachmentKey: null,
    textSource: options.textSource ?? 'note',
  };
}

function vectorRow(itemKey: string, embedding: number[]): PaperEmbedding {
  return {
    itemPk: itemKey === 'OLD00001' ? 1 : 2,
    libraryKey: 'user',
    itemKey,
    itemId: itemKey === 'OLD00001' ? 1 : 2,
    libraryId: 1,
    chunkIndex: 0,
    title: itemKey,
    chunkText: itemKey,
    textSource: 'note',
    embedding,
    modelId: 'multilingual-e5-base',
    indexedAt: '2026-09-03T00:00:00.000Z',
    contentHash: itemKey,
  };
}

function encodeFloat32(values: number[]): string {
  const bytes = new Uint8Array(new Float32Array(values).buffer);
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

function makeStore(): VectorStoreSQLite {
  const store = new VectorStoreSQLite();
  (store as any).initialized = true;
  (store as any).attached = true;
  (store as any).ensureInit = async () => {};
  (store as any).readLexicalIdentity = async (modelId: string) => ({
    databaseId: 'a'.repeat(32), revision: '0', modelId,
  });
  return store;
}

function installIdentityAwareStub(modelId = 'multilingual-e5-base') {
  const zotero = installZoteroStub({ 'zotseek.embeddingModel': modelId });
  zotero.Libraries = {
    userLibraryID: 1,
    get: (libraryId: number) => {
      if (libraryId === 1) return { libraryID: 1, libraryType: 'user' };
      if (libraryId === 2) return { libraryID: 2, libraryType: 'group', groupID: 42 };
      return undefined;
    },
  };
  zotero.Groups = { get: (groupId: number) => groupId === 42 ? { libraryID: 2 } : undefined };
  zotero.Items = {
    getIDFromLibraryAndKey: (libraryId: number, itemKey: string) => {
      if (libraryId === 2) return itemKey === 'GROUP001' ? 3 : undefined;
      return itemKey === 'OLD00001' ? 1 : 2;
    },
  };
  return zotero;
}

describe('Plan 40B cache publication and single-flight', () => {
  test('retains session text until explicit maintenance, sharing refresh with waiting searches', async () => {
    const zotero = installIdentityAwareStub();
    let rows = [lexicalRow('OLD00001', 'old evidence')];
    let reads = 0;
    let revision = '0';
    let gate: Deferred | undefined;
    const started = deferred();
    zotero.DB = { columnQueryAsync: async (sql: string) => {
      if (/SELECT c\.item_pk\s/i.test(sql)) { reads++; if (gate) started.resolve(); }
      if (gate) await gate.promise;
      return lexicalColumn(sql, rows);
    } };
    const store = makeStore();
    (store as any).readLexicalIdentity = async (modelId: string) => ({ databaseId: 'a'.repeat(32), revision, modelId });
    await store.prepareLexicalIndex();
    rows = [lexicalRow('NEW00002', 'new evidence')];
    revision = '1';
    (store as any).invalidateCache(true);
    assert.equal((await store.searchText('old')).length, 1);
    assert.equal((await store.searchText('new')).length, 0);
    gate = deferred();
    const refresh = store.prepareLexicalIndex();
    assert.equal(store.prepareLexicalIndex(), refresh);
    await started.promise;
    const waiting = store.searchText('new');
    gate.resolve();
    await refresh;
    assert.deepEqual((await waiting).map(h => h.itemKey), ['NEW00002']);
    assert.equal((await store.searchText('old')).length, 0);
    assert.equal(reads, 2);
  });

  test('builds a normalized active-model projection without loading full-text fields', async () => {
    const zotero = installIdentityAwareStub('multilingual-e5-base');
    const rows = [{
      itemPk: 1,
      libraryKey: 'user',
      itemKey: 'OLD00001',
      chunkIndex: 0,
      title: 'Projected title',
      textSource: 'summary' as const,
      embedding: encodeFloat32([3, 4]),
      pageNumber: 2,
      paragraphIndex: 1,
    }];
    const sqls: string[] = [];
    zotero.DB = {
      columnQueryAsync: async (sql: string, params: unknown[]) => {
        sqls.push(sql);
        assert.deepEqual(params, ['multilingual-e5-base']);
        if (/SELECT c\.item_pk\s/i.test(sql)) return rows.map(row => row.itemPk);
        if (/SELECT i\.library_key\s/i.test(sql)) return rows.map(row => row.libraryKey);
        if (/SELECT i\.item_key\s/i.test(sql)) return rows.map(row => row.itemKey);
        if (/SELECT c\.chunk_index\s/i.test(sql)) return rows.map(row => row.chunkIndex);
        if (/SELECT i\.title\s/i.test(sql)) return rows.map(row => row.title);
        if (/SELECT c\.text_source\s/i.test(sql)) return rows.map(row => row.textSource);
        if (/SELECT c\.embedding\s/i.test(sql)) return rows.map(row => row.embedding);
        if (/SELECT c\.page_number\s/i.test(sql)) return rows.map(row => row.pageNumber);
        if (/SELECT c\.paragraph_index\s/i.test(sql)) return rows.map(row => row.paragraphIndex);
        throw new Error(`Unexpected vector SQL: ${sql}`);
      },
    };
    const store = makeStore();

    const cached = await store.getAllCached();

    assert.equal(cached.length, 1);
    assert.equal(cached[0].modelId, 'multilingual-e5-base');
    assert.ok(cached[0].embedding instanceof Float32Array);
    assert.ok(Math.abs(cached[0].embedding[0] - 0.6) < 1e-6);
    assert.ok(Math.abs(cached[0].embedding[1] - 0.8) < 1e-6);
    assert.equal(cached[0].pageNumber, 2);
    assert.equal(cached[0].paragraphIndex, 1);
    assert.ok(sqls.every(sql => /c\.model_id = \?/i.test(sql)));
    assert.ok(sqls.every(sql => !/chunk_text|abstract|section_paths|content_hash|indexed_at/i.test(sql)));
  });

  test('uses a new active-model cache identity when the preference changes', async () => {
    const zotero = installIdentityAwareStub('multilingual-e5-base');
    const byModel: Record<string, string> = {
      'multilingual-e5-base': encodeFloat32([1, 0]),
      'bge-m3': encodeFloat32([0, 1]),
    };
    let reads = 0;
    zotero.DB = {
      columnQueryAsync: async (sql: string, params: string[]) => {
        reads++;
        const modelId = params[0];
        if (/SELECT c\.item_pk\s/i.test(sql)) return [1];
        if (/SELECT i\.library_key\s/i.test(sql)) return ['user'];
        if (/SELECT i\.item_key\s/i.test(sql)) return ['OLD00001'];
        if (/SELECT c\.chunk_index\s/i.test(sql)) return [0];
        if (/SELECT i\.title\s/i.test(sql)) return ['Model title'];
        if (/SELECT c\.text_source\s/i.test(sql)) return ['summary'];
        if (/SELECT c\.embedding\s/i.test(sql)) return [byModel[modelId]];
        if (/SELECT c\.page_number|SELECT c\.paragraph_index/i.test(sql)) return [null];
        throw new Error(`Unexpected vector SQL: ${sql}`);
      },
    };
    const store = makeStore();

    const first = await store.getAllCached();
    zotero.Prefs.set('zotseek.embeddingModel', 'bge-m3');
    const second = await store.getAllCached();

    assert.equal(first[0].modelId, 'multilingual-e5-base');
    assert.equal(second[0].modelId, 'bge-m3');
    assert.notEqual(first, second);
    assert.equal(reads, 18, 'each active model needs one nine-column projection');
  });

  test('yields during vector decoding and rejects publication invalidated by a timer', async () => {
    const zotero = installIdentityAwareStub();
    const store = makeStore();
    let projectionReads = 0;
    let version = 0;
    zotero.DB = {
      columnQueryAsync: async (sql: string) => {
        if (/SELECT c\.item_pk\s/i.test(sql)) projectionReads++;
        const value = /SELECT c\.item_pk\s/i.test(sql) ? 1
          : /SELECT i\.library_key\s/i.test(sql) ? 'user'
          : /SELECT i\.item_key\s/i.test(sql) ? 'OLD00001'
          : /SELECT c\.embedding\s/i.test(sql) ? encodeFloat32(version ? [0, 5] : [3, 4])
          : /SELECT c\.text_source\s/i.test(sql) ? 'summary'
          : /SELECT i\.title\s/i.test(sql) ? 'Projected title' : 0;
        return Array(48).fill(value);
      },
    };
    const originalNow = Date.now;
    let clock = originalNow();
    // Deterministically exhaust a slice without CPU busy-waiting in the test.
    Date.now = () => (clock += 9);
    let decoded = 0;
    let timerSawDecoding = false;
    const decode = (store as any).base64ToFloat32Embedding.bind(store);
    (store as any).base64ToFloat32Embedding = (value: string) => {
      decoded++;
      return decode(value);
    };
    try {
      const timer = new Promise<void>(resolve => setTimeout(() => {
        timerSawDecoding = decoded > 0 && decoded < 48;
        version = 1;
        (store as any).invalidateCache();
        resolve();
      }, 0));
      const [left, right] = await Promise.all([store.getAllCached(), store.getAllCached()]);
      await timer;
      assert.equal(timerSawDecoding, true, 'event loop must run before decoding completes');
      assert.equal(projectionReads, 2, 'one shared retry after invalidation');
      assert.equal(left, right, 'concurrent callers publish the same replacement');
      assert.equal(left.length, 48);
      assert.ok(left.every(row => row.embedding[0] === 0 && row.embedding[1] === 1));
    } finally {
      Date.now = originalNow;
    }
  });

  test('shares one lexical corpus build between concurrent cold searches', async () => {
    const zotero = installIdentityAwareStub();
    const gate = deferred();
    const started = deferred();
    const rows = [lexicalRow('NEW00002', 'shared lexical evidence')];
    let buildReads = 0;
    zotero.DB = {
      columnQueryAsync: async (sql: string) => {
        const snapshot = rows.map(row => ({ ...row }));
        if (/SELECT c\.item_pk\s/i.test(sql)) {
          buildReads++;
          started.resolve();
        }
        await gate.promise;
        return lexicalColumn(sql, snapshot);
      },
    };
    const store = makeStore();

    const first = store.searchText('shared');
    const second = store.searchText('shared');
    await started.promise;
    gate.resolve();
    const [left, right] = await Promise.all([first, second]);

    assert.equal(buildReads, 1, 'same model/generation must share one corpus read');
    assert.deepEqual(left.map(result => result.itemKey), ['NEW00002']);
    assert.deepEqual(right.map(result => result.itemKey), ['NEW00002']);
    assert.deepEqual((await store.searchText('shared')).map(result => result.itemKey), ['NEW00002']);
    assert.equal(buildReads, 1, 'a stable cache hit must not reread the corpus');
  });

  test('does not publish a lexical snapshot invalidated while it is building', async () => {
    const zotero = installIdentityAwareStub();
    const gate = deferred();
    const started = deferred();
    let blockFirstBuild = true;
    let rows = [lexicalRow('OLD00001', 'old evidence')];
    let buildReads = 0;
    zotero.DB = {
      columnQueryAsync: async (sql: string) => {
        const snapshot = rows.map(row => ({ ...row }));
        const shouldBlock = blockFirstBuild;
        if (/SELECT c\.item_pk\s/i.test(sql)) {
          buildReads++;
          started.resolve();
        }
        if (shouldBlock) await gate.promise;
        return lexicalColumn(sql, snapshot);
      },
    };
    const store = makeStore();

    const inFlight = store.searchText('new evidence');
    await started.promise;
    rows = [lexicalRow('NEW00002', 'new evidence')];
    store.invalidateCache();
    blockFirstBuild = false;
    gate.resolve();

    const results = await inFlight;
    assert.deepEqual(results.map(result => result.itemKey), ['NEW00002']);
    assert.equal(buildReads, 2, 'one invalidated build should be retried exactly once');
    assert.deepEqual(
      (await store.searchText('new evidence')).map(result => result.itemKey),
      ['NEW00002'],
      'the invalidated snapshot must not resurrect as the current cache',
    );
    assert.equal(buildReads, 2, 'the stable retry should be cached');
  });

  test('rechecks the active model before publishing a lexical cache', async () => {
    const zotero = installIdentityAwareStub('multilingual-e5-base');
    const gate = deferred();
    const started = deferred();
    let blockFirstBuild = true;
    let buildReads = 0;
    zotero.DB = {
      columnQueryAsync: async (sql: string, params: unknown[]) => {
        const modelId = String(params[0]);
        const snapshot = [modelId === 'bge-m3'
          ? lexicalRow('NEW00002', 'new model evidence')
          : lexicalRow('OLD00001', 'old model evidence')];
        const shouldBlock = blockFirstBuild;
        if (/SELECT c\.item_pk\s/i.test(sql)) {
          buildReads++;
          started.resolve();
        }
        if (shouldBlock) await gate.promise;
        return lexicalColumn(sql, snapshot);
      },
    };
    const store = makeStore();

    const inFlight = store.searchText('model evidence');
    await started.promise;
    zotero.Prefs.set('zotseek.embeddingModel', 'bge-m3');
    blockFirstBuild = false;
    gate.resolve();

    const results = await inFlight;
    assert.deepEqual(results.map(result => result.itemKey), ['NEW00002']);
    assert.equal(buildReads, 2);
  });

  test('degrades after two consecutive lexical invalidations without publishing stale data', async () => {
    const zotero = installIdentityAwareStub();
    const gates = [deferred(), deferred()];
    const started = [deferred(), deferred()];
    let currentBuild = -1;
    let rows = [lexicalRow('OLD00001', 'old evidence')];
    zotero.DB = {
      columnQueryAsync: async (sql: string) => {
        if (/SELECT c\.item_pk\s/i.test(sql)) {
          currentBuild++;
          started[currentBuild]?.resolve();
        }
        const buildNumber = currentBuild;
        const snapshot = rows.map(row => ({ ...row }));
        if (gates[buildNumber]) await gates[buildNumber].promise;
        return lexicalColumn(sql, snapshot);
      },
    };
    const store = makeStore();

    const inFlight = store.searchText('final evidence');
    await started[0].promise;
    rows = [lexicalRow('NEW00002', 'intermediate evidence')];
    store.invalidateCache();
    gates[0].resolve();
    await started[1].promise;
    rows = [lexicalRow('FINAL003', 'final evidence')];
    store.invalidateCache();
    gates[1].resolve();

    assert.deepEqual(await inFlight, [], 'bounded retry exhaustion should omit lexical evidence');
    assert.equal((store as any).lexicalCache, null, 'neither stale snapshot may be published');
    assert.equal((store as any).lexicalCacheBuilds.size, 0, 'completed builds must not leak');
    assert.deepEqual(
      (await store.searchText('final evidence')).map(result => result.itemKey),
      ['FINAL003'],
      'the next stable query should recover automatically',
    );
    assert.equal(currentBuild + 1, 3, 'two bounded attempts plus one later stable recovery');
  });

  test('clears a failed lexical build so a later query can recover', async () => {
    const zotero = installIdentityAwareStub();
    let buildReads = 0;
    const rows = [lexicalRow('NEW00002', 'recovered evidence')];
    zotero.DB = {
      columnQueryAsync: async (sql: string) => {
        if (/SELECT c\.item_pk\s/i.test(sql) && buildReads++ === 0) {
          throw new Error('synthetic lexical failure');
        }
        return lexicalColumn(sql, rows);
      },
    };
    const store = makeStore();

    assert.deepEqual(await store.searchText('recovered evidence'), []);
    assert.equal((store as any).lexicalCacheBuilds.size, 0);
    assert.deepEqual(
      (await store.searchText('recovered evidence')).map(result => result.itemKey),
      ['NEW00002'],
    );
  });

  test('shares one lexical index across library and source filters', async () => {
    const zotero = installIdentityAwareStub();
    const rows = [
      lexicalRow('NEW00002', 'shared filtered evidence', { itemPk: 2, textSource: 'note' }),
      lexicalRow('GROUP001', 'shared filtered evidence', {
        itemPk: 3,
        libraryKey: 'group:42',
        textSource: 'content',
      }),
    ];
    let buildReads = 0;
    zotero.DB = {
      columnQueryAsync: async (sql: string) => {
        if (/SELECT c\.item_pk\s/i.test(sql)) buildReads++;
        return lexicalColumn(sql, rows);
      },
    };
    const store = makeStore();

    const userNotes = await store.searchText('shared filtered', {
      libraryId: 1,
      textSources: ['note'],
    });
    const groupPdf = await store.searchText('shared filtered', {
      libraryId: 2,
      textSources: ['content'],
    });

    assert.deepEqual(userNotes.map(result => result.itemKey), ['NEW00002']);
    assert.deepEqual(groupPdf.map(result => result.itemKey), ['GROUP001']);
    assert.equal(buildReads, 1, 'request filters must not create separate corpus indexes');
  });

  test('does not restart or publish a lexical build after close begins', async () => {
    const zotero = installIdentityAwareStub();
    const gate = deferred();
    const started = deferred();
    const rows = [lexicalRow('OLD00001', 'old evidence')];
    let buildReads = 0;
    zotero.DB = {
      columnQueryAsync: async (sql: string) => {
        if (/SELECT c\.item_pk\s/i.test(sql)) {
          buildReads++;
          started.resolve();
        }
        await gate.promise;
        return lexicalColumn(sql, rows);
      },
    };
    const store = makeStore();
    (store as any).detachDatabase = async () => {};

    const inFlight = store.searchText('old evidence');
    await started.promise;
    await store.close();
    gate.resolve();

    assert.deepEqual(await inFlight, []);
    assert.equal(buildReads, 1, 'a closing store must not begin a retry read');
    assert.equal((store as any).lexicalCache, null);
    assert.equal((store as any).lexicalCacheBuilds.size, 0);
    assert.equal(store.isReady(), false);
  });

  test('shares one vector build between concurrent cold reads', async () => {
    installIdentityAwareStub();
    const store = makeStore();
    const gate = deferred();
    const started = deferred();
    let reads = 0;
    (store as any).buildVectorCache = async () => {
      reads++;
      started.resolve();
      await gate.promise;
      return [vectorRow('NEW00002', [0, 1])];
    };

    const first = store.getAllCached();
    const second = store.getAllCached();
    await started.promise;
    gate.resolve();
    const [left, right] = await Promise.all([first, second]);

    assert.equal(reads, 1);
    assert.deepEqual(left.map(result => result.itemKey), ['NEW00002']);
    assert.deepEqual(right.map(result => result.itemKey), ['NEW00002']);
    await store.getAllCached();
    assert.equal(reads, 1, 'a stable vector cache hit must not reread the database');
  });

  test('replaces a TTL-expired vector cache within the same generation', async () => {
    installIdentityAwareStub();
    const store = makeStore();
    (store as any).cache = {
      data: [vectorRow('OLD00001', [1, 0])],
      validAt: 0,
      generation: 0,
    };
    let reads = 0;
    (store as any).buildVectorCache = async () => {
      reads++;
      return [vectorRow('NEW00002', [0, 1])];
    };

    const refreshed = await store.getAllCached();

    assert.equal(reads, 1);
    assert.deepEqual(refreshed.map(result => result.itemKey), ['NEW00002']);
    assert.deepEqual(
      (await store.getAllCached()).map(result => result.itemKey),
      ['NEW00002'],
    );
    assert.equal(reads, 1, 'the refreshed object should become the warm cache');
  });

  test('shares vector cache misses and rejects an invalidated publication', async () => {
    installIdentityAwareStub();
    const store = makeStore();
    const gate = deferred();
    const started = deferred();
    let blockFirstBuild = true;
    let rows = [vectorRow('OLD00001', [1, 0])];
    let reads = 0;
    (store as any).buildVectorCache = async () => {
      reads++;
      const snapshot = rows.map(row => ({ ...row, embedding: [...row.embedding] }));
      if (blockFirstBuild) {
        started.resolve();
        await gate.promise;
      }
      return snapshot;
    };

    const first = store.getAllCached();
    const joined = store.getAllCached();
    await started.promise;
    rows = [vectorRow('NEW00002', [0, 1])];
    store.invalidateCache();
    blockFirstBuild = false;
    gate.resolve();

    const [left, right] = await Promise.all([first, joined]);
    assert.equal(reads, 2, 'joined old generation plus one shared retry');
    assert.deepEqual(left.map(result => result.itemKey), ['NEW00002']);
    assert.deepEqual(right.map(result => result.itemKey), ['NEW00002']);
    assert.deepEqual((await store.getAllCached()).map(result => result.itemKey), ['NEW00002']);
    assert.equal(reads, 2, 'stable vector retry should be cached');
  });

  test('preserves vector error semantics after two consecutive invalidations', async () => {
    installIdentityAwareStub();
    const store = makeStore();
    const gates = [deferred(), deferred()];
    const started = [deferred(), deferred()];
    let reads = 0;
    let rows = [vectorRow('OLD00001', [1, 0])];
    (store as any).buildVectorCache = async () => {
      const buildNumber = reads++;
      const snapshot = rows.map(row => ({ ...row, embedding: [...row.embedding] }));
      started[buildNumber]?.resolve();
      if (gates[buildNumber]) await gates[buildNumber].promise;
      return snapshot;
    };

    const inFlight = store.getAllCached();
    await started[0].promise;
    rows = [vectorRow('NEW00002', [0, 1])];
    store.invalidateCache();
    gates[0].resolve();
    await started[1].promise;
    rows = [vectorRow('FINAL003', [0.5, 0.5])];
    store.invalidateCache();
    gates[1].resolve();

    await assert.rejects(inFlight, /changed during both build attempts/);
    assert.equal((store as any).cache, null);
    assert.equal((store as any).vectorCacheBuilds.size, 0);
    assert.deepEqual(
      (await store.getAllCached()).map(result => result.itemKey),
      ['FINAL003'],
      'the next stable vector query should recover automatically',
    );
    assert.equal(reads, 3);
  });

  test('clears failed in-flight builds so later calls can retry', async () => {
    installIdentityAwareStub();
    const store = makeStore();
    let reads = 0;
    (store as any).buildVectorCache = async () => {
      reads++;
      if (reads === 1) throw new Error('synthetic read failure');
      return [vectorRow('NEW00002', [0, 1])];
    };

    await assert.rejects(store.getAllCached(), /synthetic read failure/);
    const recovered = await store.getAllCached();
    assert.equal(reads, 2);
    assert.deepEqual(recovered.map(result => result.itemKey), ['NEW00002']);
  });

  test('invalidates immediately after a committed putBatch even when verification fails', async () => {
    const zotero = installIdentityAwareStub();
    const store = makeStore();
    (store as any).cache = { data: [], validAt: Date.now() };
    (store as any).lexicalCache = { modelId: 'multilingual-e5-base', index: {} };
    (store as any).getOrCreateItemPk = async () => 1;
    (store as any).upsertItemModel = async () => {};
    zotero.DB = {
      executeTransaction: async (callback: () => Promise<void>) => callback(),
      queryAsync: async (sql: string) => {
        if (/SELECT COUNT\(\*\)/i.test(sql)) throw new Error('verification unavailable');
        return [];
      },
    };
    const embedding = vectorRow('NEW00002', [0, 1]);

    await assert.doesNotReject(store.putBatch([embedding]));
    assert.equal((store as any).cache, null);
    assert.ok((store as any).lexicalCache, 'ordinary writes preserve the session BM25 index');
  });
});

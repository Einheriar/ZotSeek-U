import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { AutoIndexManager } from '../src/core/auto-index-manager';

test('startup prepares BM25 even with automatic embedding disabled and releases early searches', async () => {
  installZoteroStub({ 'zotseek.autoIndex': false });
  const manager: any = new (AutoIndexManager as any)();
  let tick!: () => void;
  let gate!: Promise<void>;
  const events: string[] = [];
  const originalTimer = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  (globalThis as any).setTimeout = (callback: () => void, delay: number) => {
    assert.equal(delay, 10000);
    tick = callback;
    return 1;
  };
  (globalThis as any).clearTimeout = () => {};
  manager.setVectorStore({
    deferLexicalPreparation: (ready: Promise<void>) => { gate = ready; },
    prepareLexicalIndex: async () => { events.push('bm25'); },
  });
  manager.runCheck = async () => { events.push('semantic'); return manager.emptyResult(); };
  try {
    manager.start();
    let ready = false;
    void gate.then(() => { ready = true; });
    await Promise.resolve();
    assert.equal(ready, false);
    tick();
    await gate;
    assert.deepEqual(events, ['bm25']);
    manager.stop();
    manager.start({ skipReconciliation: true });
    manager.stop();
    await gate;
    assert.deepEqual(events, ['bm25'], 'cancelled timer does not build');
  } finally {
    manager.stop();
    globalThis.setTimeout = originalTimer;
    globalThis.clearTimeout = originalClear;
  }
});

test('manual update joins an active pass and refreshes BM25 only after semantic work', async () => {
  installZoteroStub();
  const manager: any = new (AutoIndexManager as any)();
  const events: string[] = [];
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  manager.runCheck = async () => {
    events.push('semantic-start');
    await pending;
    events.push('semantic-end');
    return manager.emptyResult();
  };
  manager.setVectorStore({ prepareLexicalIndex: async () => { events.push('bm25'); } });
  const first = manager.runNow();
  const second = manager.runNow();
  assert.deepEqual(events, ['semantic-start']);
  finish();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['semantic-start', 'semantic-end', 'bm25']);
  manager.stop();
});

test('skipped semantic work still prepares local BM25, but stopping an active pass does not', async () => {
  installZoteroStub();
  const manager: any = new (AutoIndexManager as any)();
  let prepared = 0;
  manager.setVectorStore({ prepareLexicalIndex: async () => { prepared++; } });
  await manager.runNow(); // No item provider: runCheck returns skipped.
  assert.equal(prepared, 1);
  manager.runCheck = async () => { manager.stop(); return manager.emptyResult(true); };
  await manager.runNow();
  assert.equal(prepared, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  itemIndexAttemptMetadataKey,
  readItemIndexAttempt,
  writeItemIndexAttempt,
} from '../src/core/item-indexing';
import type { ItemAttemptMetadataStore, ItemIndexAttempt } from '../src/core/item-indexing';

class MemoryMetadataStore implements ItemAttemptMetadataStore {
  values = new Map<string, unknown>();

  async getMetadata(key: string): Promise<unknown> {
    return this.values.get(key);
  }

  async setMetadata(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
}

function attempt(overrides: Partial<ItemIndexAttempt> = {}): ItemIndexAttempt {
  return {
    libraryKey: 'user',
    itemKey: 'ABCDEFGH',
    modelId: 'model-a',
    indexingMode: 'full',
    force: true,
    outcome: 'updated',
    attemptedAt: '2026-11-14T00:00:00.000Z',
    checked: 1,
    indexedNew: 0,
    rebuilt: 1,
    notesUpdated: 0,
    unchangedCount: 0,
    failedCount: 0,
    removed: 0,
    pdfDiagnostic: {
      status: 'selected',
      attachmentKey: 'PDFKEY12',
      reason: null,
      pagesIndexed: 3,
      pagesTotal: 3,
    },
    ...overrides,
  };
}

test('latest ordinary call does not erase the latest full PDF diagnostic', async () => {
  const store = new MemoryMetadataStore();
  const pdfAttempt = attempt();
  await writeItemIndexAttempt(store, pdfAttempt);

  const unchanged = attempt({
    force: false,
    pdfDiagnostic: undefined,
    pdfAttachmentKey: undefined,
    outcome: 'unchanged',
    attemptedAt: '2026-11-14T01:00:00.000Z',
    rebuilt: 0,
    unchangedCount: 1,
  });
  await writeItemIndexAttempt(store, unchanged);

  const history = await readItemIndexAttempt(store, 'user', 'ABCDEFGH', 'model-a');
  assert.equal(history.lastAttempt?.outcome, 'unchanged');
  assert.equal(history.lastAttempt?.pdfDiagnostic, undefined);
  assert.equal(history.lastPdfAttempt?.attemptedAt, pdfAttempt.attemptedAt);
  assert.equal(history.lastPdfAttempt?.pdfDiagnostic.attachmentKey, 'PDFKEY12');
});

test('attempt metadata is isolated by stable identity and model', async () => {
  const store = new MemoryMetadataStore();
  await writeItemIndexAttempt(store, attempt());
  await writeItemIndexAttempt(store, attempt({ modelId: 'model-b', outcome: 'failed' }));
  await writeItemIndexAttempt(store, attempt({ libraryKey: 'group:7' }));

  assert.equal((await readItemIndexAttempt(store, 'user', 'ABCDEFGH', 'model-a')).lastAttempt?.modelId, 'model-a');
  assert.equal((await readItemIndexAttempt(store, 'user', 'ABCDEFGH', 'model-b')).lastAttempt?.outcome, 'failed');
  assert.equal((await readItemIndexAttempt(store, 'group:7', 'ABCDEFGH', 'model-a')).lastAttempt?.libraryKey, 'group:7');
  assert.notEqual(
    itemIndexAttemptMetadataKey('user', 'ABCDEFGH', 'model-a'),
    itemIndexAttemptMetadataKey('group:7', 'ABCDEFGH', 'model-a'),
  );
});

test('missing attempt history is represented explicitly as null', async () => {
  const history = await readItemIndexAttempt(new MemoryMetadataStore(), 'user', 'ABCDEFGH', 'model-a');
  assert.deepEqual(history, { lastAttempt: null, lastPdfAttempt: null });
});

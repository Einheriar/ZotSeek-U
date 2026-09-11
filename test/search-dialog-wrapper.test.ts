import './helpers/zotero-stub';
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { ZotSeekDialogWithVTable } from '../src/ui/search-dialog-with-vtable';

const originalComponents = (globalThis as any).Components;
const originalDocument = (globalThis as any).document;
const originalWindow = (globalThis as any).window;

afterEach(() => {
  (globalThis as any).Components = originalComponents;
  (globalThis as any).document = originalDocument;
  (globalThis as any).window = originalWindow;
});

test('an existing VTable window receives query and exclusion through its controller', () => {
  (globalThis as any).Components = {
    utils: { isDeadWrapper: () => false },
  };
  const requests: unknown[][] = [];
  let focused = 0;
  const dialog = new ZotSeekDialogWithVTable();
  (dialog as any).window = {
    closed: false,
    focus: () => { focused++; },
    searchDialogVTable: {
      setInitialSearch: (...args: unknown[]) => { requests.push(args); },
    },
  };

  dialog.open('related work', 42);
  assert.equal(focused, 1);
  assert.deepEqual(requests, [['related work', 42]]);

  dialog.open(undefined, 43);
  assert.deepEqual(requests.at(-1), ['', 43]);
});

test('a reused-window query waits for the current search and then runs the latest request', async () => {
  (globalThis as any).document = { addEventListener: () => {} };
  (globalThis as any).window = { addEventListener: () => {} };
  const { ZotSeekDialogVTable } = await import('../src/ui/search-dialog-vtable');
  const input = { value: '' };
  const controller = new ZotSeekDialogVTable();
  (controller as any).window = {
    document: { getElementById: (id: string) => id === 'zotseek-query-1' ? input : null },
  };
  (controller as any).isSearching = true;
  (controller as any).lastQuery = 'cached-query-with-old-exclusion';
  const searches: string[] = [];
  (controller as any).performSearch = async () => { searches.push(input.value); };

  controller.setInitialSearch('first replacement', 42);
  controller.setInitialSearch('latest replacement', 43);
  assert.equal((controller as any).excludeItemId, 43);
  assert.equal((controller as any).lastQuery, '');
  assert.equal(input.value, 'latest replacement');
  assert.deepEqual(searches, []);

  (controller as any).isSearching = false;
  (controller as any).runQueuedInitialSearch();
  assert.deepEqual(searches, ['latest replacement']);
  assert.equal((controller as any).queuedInitialSearch, false);
});

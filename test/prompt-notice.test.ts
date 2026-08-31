import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { openDismissibleNotice } from '../src/utils/prompt-notice';

describe('dismissible informational prompt', () => {
  test('uses confirm so Cancel or the title-bar close path can dismiss it', () => {
    const calls: unknown[][] = [];
    const win = { confirm: () => true };
    const promptService = {
      confirm: (...args: unknown[]) => {
        calls.push(args);
        return false;
      },
    };

    assert.equal(openDismissibleNotice(promptService, win, 'ZotSeek', 'Old index'), true);
    assert.deepEqual(calls, [[win, 'ZotSeek', 'Old index']]);
  });

  test('falls back to the window confirm implementation', () => {
    const messages: string[] = [];
    const win = {
      confirm: (message: string) => {
        messages.push(message);
        return false;
      },
    };

    assert.equal(openDismissibleNotice(undefined, win, 'ZotSeek', 'Old index'), true);
    assert.deepEqual(messages, ['Old index']);
  });

  test('does nothing when no parent window is available', () => {
    assert.equal(openDismissibleNotice(undefined, undefined, 'ZotSeek', 'Old index'), false);
  });
});

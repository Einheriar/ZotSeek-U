import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { openIndexConfigChangePrompt } from '../src/ui/index-config-change-prompt';

const buttonConstants = {
  BUTTON_POS_0: 1,
  BUTTON_POS_1: 256,
  BUTTON_POS_2: 65536,
  BUTTON_TITLE_IS_STRING: 127,
};

describe('startup index configuration choice prompt', () => {
  test('maps update and rebuild explicitly, and treats cancel, Escape and close as cancel', () => {
    const expected = ['update', 'rebuild', 'cancel', 'cancel'];
    [0, 1, 2, -1].forEach((result, index) => {
      assert.equal(
        openIndexConfigChangePrompt(
          { ...buttonConstants, confirmEx: () => result },
          {},
          'title',
          'message',
          'update',
          'rebuild',
          'cancel',
        ),
        expected[index],
      );
    });
  });

  test('passes all three localized labels to confirmEx', () => {
    let args: unknown[] = [];
    openIndexConfigChangePrompt(
      { ...buttonConstants, confirmEx: (...received: unknown[]) => { args = received; return 2; } },
      {},
      'title',
      'message',
      'update-label',
      'rebuild-label',
      'cancel-label',
    );
    assert.equal(args[4], 'update-label');
    assert.equal(args[5], 'rebuild-label');
    assert.equal(args[6], 'cancel-label');
  });

  test('fallback offers only update or cancel and never infers rebuild', () => {
    assert.equal(
      openIndexConfigChangePrompt(
        { confirm: () => true }, {}, 'title', 'message', 'update', 'rebuild', 'cancel',
      ),
      'update',
    );
    assert.equal(
      openIndexConfigChangePrompt(
        { confirm: () => false }, {}, 'title', 'message', 'update', 'rebuild', 'cancel',
      ),
      'cancel',
    );
  });
});

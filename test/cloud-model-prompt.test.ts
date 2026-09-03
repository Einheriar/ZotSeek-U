import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  confirmCloudDisclosure,
  promptForCloudApiKey,
  type PromptServiceLike,
} from '../src/ui/cloud-model-prompt';

function prompt(overrides: Partial<PromptServiceLike> = {}): PromptServiceLike {
  return {
    confirm: () => true,
    promptPassword: (_parent, _title, _message, value) => {
      value.value = ' key-from-dialog ';
      return true;
    },
    ...overrides,
  };
}

describe('cloud model prompts', () => {
  test('returns the explicit consent decision', () => {
    assert.equal(confirmCloudDisclosure(prompt(), null, 'title', 'message'), true);
    assert.equal(confirmCloudDisclosure(prompt({ confirm: () => false }), null, 'title', 'message'), false);
  });

  test('uses password input and never accepts an empty key', () => {
    assert.equal(promptForCloudApiKey(prompt(), null, 'title', 'message'), 'key-from-dialog');
    assert.equal(promptForCloudApiKey(prompt({ promptPassword: () => false }), null, 'title', 'message'), null);
    assert.equal(promptForCloudApiKey(prompt({
      promptPassword: (_parent, _title, _message, value) => {
        value.value = '   ';
        return true;
      },
    }), null, 'title', 'message'), null);
  });
});

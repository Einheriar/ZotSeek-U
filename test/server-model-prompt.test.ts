import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getServerModelConfigurationGuidance,
  openServerModelConfigurationPrompt,
  revealFileLocation,
} from '../src/ui/server-model-prompt';

function componentsFor(file: any): any {
  return {
    classes: {
      '@mozilla.org/file/local;1': {
        createInstance: () => file,
      },
    },
    interfaces: { nsIFile: {} },
  };
}

describe('Server model configuration prompt', () => {
  test('renders UNKNOWN as localized summary data without forwarding raw validator text', () => {
    const guidance = getServerModelConfigurationGuidance({
      state: 'UNKNOWN',
      path: 'C:\\profile\\zotseek-server-models.json',
      errors: ['model: id must begin with "server:"', 'dimensions must be positive'],
    });

    assert.deepEqual(guidance, {
      key: 'serverConfigInvalidEntry',
      args: { errors: 2 },
    });
    assert.doesNotMatch(JSON.stringify(guidance), /dimensions must be positive/);
  });

  test('reveals only after the explicit open-location button is chosen', () => {
    const calls: unknown[][] = [];
    let revealCount = 0;
    const promptService = {
      BUTTON_POS_0: 1,
      BUTTON_POS_1: 256,
      BUTTON_TITLE_IS_STRING: 127,
      confirmEx: (...args: unknown[]) => {
        calls.push(args);
        return 0;
      },
    };

    assert.equal(openServerModelConfigurationPrompt(
      promptService,
      {},
      'Configuration required',
      'Edit the template',
      'Open file location',
      'Close',
      () => { revealCount += 1; },
    ), true);
    assert.equal(revealCount, 1);
    assert.equal(calls[0][3], 32639);
    assert.equal(calls[0][4], 'Open file location');
    assert.equal(calls[0][5], 'Close');
  });

  test('Close and the title-bar close result never reveal the file', () => {
    for (const result of [1, -1]) {
      let revealCount = 0;
      openServerModelConfigurationPrompt(
        { confirmEx: () => result },
        {},
        'Configuration required',
        'Edit the template',
        'Open file location',
        'Close',
        () => { revealCount += 1; },
      );
      assert.equal(revealCount, 0);
    }
  });
});

describe('Server model configuration file location', () => {
  test('selects an existing JSON file in the platform file manager', () => {
    let initializedPath = '';
    let revealed = false;
    const file = {
      initWithPath: (path: string) => { initializedPath = path; },
      exists: () => true,
      reveal: () => { revealed = true; },
    };

    assert.equal(revealFileLocation('C:\\profile\\zotseek-server-models.json', componentsFor(file)), true);
    assert.equal(initializedPath, 'C:\\profile\\zotseek-server-models.json');
    assert.equal(revealed, true);
  });

  test('opens the parent directory when the template itself is missing', () => {
    let parentRevealed = false;
    const file = {
      initWithPath: () => undefined,
      exists: () => false,
      parent: {
        exists: () => true,
        reveal: () => { parentRevealed = true; },
      },
    };

    assert.equal(revealFileLocation('C:\\profile\\missing.json', componentsFor(file)), true);
    assert.equal(parentRevealed, true);
  });

  test('fails safely when the platform file API is unavailable', () => {
    assert.equal(revealFileLocation('C:\\profile\\missing.json', undefined), false);
  });
});

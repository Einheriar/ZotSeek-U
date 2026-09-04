import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLocalModelMenuState,
  getModelDownloadPageUrl,
  openManualModelDownloadGuide,
  openModelDownloadChoicePrompt,
} from '../src/ui/model-download-prompt';

const buttonConstants = {
  BUTTON_POS_0: 1,
  BUTTON_POS_1: 256,
  BUTTON_POS_2: 65536,
  BUTTON_TITLE_IS_STRING: 127,
};

describe('local model menu state', () => {
  test('distinguishes built-in, installed and missing models', () => {
    assert.equal(getLocalModelMenuState({ bundled: true }, true), 'bundled');
    assert.equal(getLocalModelMenuState({ bundled: false }, true), 'installed');
    assert.equal(getLocalModelMenuState({ bundled: false }, false), 'download');
  });

  test('builds the allowlisted Hugging Face tree URL without changing its path', () => {
    assert.equal(
      getModelDownloadPageUrl({ hfPath: 'Xenova/bge-m3' }),
      'https://huggingface.co/Xenova/bge-m3/tree/main',
    );
  });

  test('uses a separate public download repository when configured', () => {
    assert.equal(
      getModelDownloadPageUrl({
        hfPath: 'Xenova/nomic-embed-text-v1.5',
        downloadHfPath: 'nomic-ai/nomic-embed-text-v1.5',
      }),
      'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5/tree/main',
    );
  });
});

describe('model download choice prompt', () => {
  test('maps the first two buttons and treats cancel, Escape and close as cancel', () => {
    const expected = ['automatic', 'manual', 'cancel', 'cancel'];
    [0, 1, 2, -1].forEach((result, index) => {
      assert.equal(
        openModelDownloadChoicePrompt(
          { ...buttonConstants, confirmEx: () => result },
          {},
          'title',
          'message',
          'automatic',
          'manual',
          'cancel',
        ),
        expected[index],
      );
    });
  });

  test('passes three explicit labels to confirmEx', () => {
    let args: unknown[] = [];
    openModelDownloadChoicePrompt(
      { ...buttonConstants, confirmEx: (...received: unknown[]) => { args = received; return 2; } },
      {},
      'title',
      'message',
      'automatic',
      'manual',
      'cancel',
    );
    assert.equal(args[4], 'automatic');
    assert.equal(args[5], 'manual');
    assert.equal(args[6], 'cancel');
  });
});

describe('manual download guide prompt', () => {
  test('opens only the explicitly selected destination', () => {
    for (const result of [0, 1, 2, -1]) {
      let pageCount = 0;
      let locationCount = 0;
      openManualModelDownloadGuide(
        { ...buttonConstants, confirmEx: () => result },
        {},
        'title',
        'message',
        'page',
        'location',
        'close',
        () => { pageCount++; },
        () => { locationCount++; },
      );
      assert.equal(pageCount, result === 0 ? 1 : 0);
      assert.equal(locationCount, result === 1 ? 1 : 0);
    }
  });
});

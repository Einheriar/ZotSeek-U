import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BriefPromptCustomizationError,
  BriefPromptCustomizer,
  normalizeBriefPromptCustomizationForm,
  parseBriefPromptPair,
} from '../src/core/brief-prompt-customizer';
import { BRIEF_BUNDLED_PROMPT_BASE_URI, BriefPromptStore, type BriefPromptStoreEnvironment } from '../src/core/brief-prompt-store';

const enc = (text: string) => new TextEncoder().encode(text);

function environment(): BriefPromptStoreEnvironment {
  const files = new Map<string, Uint8Array>();
  const bundled = new Map([
    [`${BRIEF_BUNDLED_PROMPT_BASE_URI}/standard-article-brief.md`, enc('# bundled standard')],
    [`${BRIEF_BUNDLED_PROMPT_BASE_URI}/review-article-brief.md`, enc('# bundled review')],
  ]);
  return {
    profileDir: '/profile',
    join: (...parts) => parts.join('/').replace(/\/+/g, '/'),
    exists: async path => files.has(path),
    read: async path => files.get(path) || (() => { throw new Error('missing'); })(),
    write: async (path, value) => { files.set(path, new Uint8Array(value)); },
    move: async (source, destination) => {
      const value = files.get(source); if (!value) throw new Error('missing temporary');
      files.set(destination, value); files.delete(source);
    },
    remove: async path => { files.delete(path); },
    makeDirectory: async _path => {},
    temporarySuffix: () => 'test',
    readBundled: async uri => bundled.get(uri) || (() => { throw new Error('missing bundled'); })(),
    getDownloadDirectory: () => '/downloads',
  };
}

describe('brief prompt customizer', () => {
  test('requires domain and output language while allowing optional reading habits', () => {
    assert.deepEqual(normalizeBriefPromptCustomizationForm({ domain: ' physics ', outputLanguage: ' English ', readingHabits: '  methods  ' }), {
      domain: 'physics', outputLanguage: 'English', readingHabits: 'methods',
    });
    assert.throws(() => normalizeBriefPromptCustomizationForm({ domain: '', outputLanguage: 'English' }), /domain.*required/);
    assert.throws(() => normalizeBriefPromptCustomizationForm({ domain: 'physics', outputLanguage: ' ' }), /language.*required/);
  });

  test('sends only bundled templates and form, and accepts the exact pair protocol', async () => {
    const calls: any[] = [];
    const store = new BriefPromptStore(environment());
    const customizer = new BriefPromptCustomizer({
      generate: (async (messages: any[]) => {
        calls.push(messages);
        return { content: JSON.stringify({ standard: '# custom standard', review: '# custom review' }) };
      }) as any,
    }, store);
    const result = await customizer.customize({ domain: 'psychology', outputLanguage: 'English', readingHabits: 'Focus on methods' }, { save: false });
    assert.deepEqual(result.prompts, { standard: '# custom standard', review: '# custom review' });
    const payload = JSON.parse(calls[0][1].content);
    assert.deepEqual(payload.form, { domain: 'psychology', outputLanguage: 'English', readingHabits: 'Focus on methods' });
    assert.deepEqual(payload.baselineTemplates, { standard: '# bundled standard', review: '# bundled review' });
    assert.equal(JSON.stringify(payload).includes('custom'), false);
  });

  test('performs at most one protocol correction and rejects extra output fields', async () => {
    let calls = 0;
    const customizer = new BriefPromptCustomizer({
      generate: (async (_messages: any[]) => {
        calls++;
        return { content: calls === 1 ? '```json\n{}\n```' : JSON.stringify({ standard: '# a', review: '# b', extra: 'no' }) };
      }) as any,
    }, new BriefPromptStore(environment()));
    await assert.rejects(
      () => customizer.customize({ domain: 'x', outputLanguage: '中文' }, { save: false }),
      BriefPromptCustomizationError,
    );
    assert.equal(calls, 2);
  });

  test('passes the shared AbortSignal to both protocol attempts', async () => {
    const controller = new AbortController();
    const options: any[] = [];
    let calls = 0;
    const customizer = new BriefPromptCustomizer({
      generate: async (_messages: any[], requestOptions: any) => {
        options.push(requestOptions);
        calls++;
        return { content: calls === 1 ? '{}' : JSON.stringify({ standard: '# a', review: '# b' }) };
      },
    } as any, new BriefPromptStore(environment()));
    const result = await customizer.customize(
      { domain: 'x', outputLanguage: '中文' },
      { save: false, signal: controller.signal },
    );
    assert.equal(result.correctedProtocol, true);
    assert.equal(options.length, 2);
    assert.equal(options[0].signal, controller.signal);
    assert.equal(options[1].signal, controller.signal);
  });

  test('rejects missing required form values and malformed pair values', async () => {
    const customizer = new BriefPromptCustomizer({ generate: async () => ({ content: '{}' }) } as any, new BriefPromptStore(environment()));
    await assert.rejects(() => customizer.customize({ domain: ' ', outputLanguage: 'English' }, { save: false }), /domain.*required/);
    assert.throws(() => parseBriefPromptPair({ standard: '# only' }), /exactly standard and review/);
    assert.throws(() => parseBriefPromptPair({ standard: '# a', review: '\uD800' }), /256 KiB|text|UTF-8|non-empty/);
  });
});

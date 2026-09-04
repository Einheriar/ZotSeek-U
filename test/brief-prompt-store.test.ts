import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import {
  BRIEF_BUNDLED_PROMPT_BASE_URI,
  BRIEF_PROMPT_MAX_BYTES,
  BriefPromptStore,
  BriefPromptStoreError,
  type BriefPromptStoreEnvironment,
} from '../src/core/brief-prompt-store';

function memoryEnvironment(
  initial: Record<string, Uint8Array> = {},
  bundled: Record<string, Uint8Array> = {
    [`${BRIEF_BUNDLED_PROMPT_BASE_URI}/standard-article-brief.md`]:
      new TextEncoder().encode('# Bundled standard prompt'),
    [`${BRIEF_BUNDLED_PROMPT_BASE_URI}/review-article-brief.md`]:
      new TextEncoder().encode('# Bundled review prompt'),
  },
) {
  const files = new Map<string, Uint8Array>(Object.entries(initial));
  const bundledFiles = new Map<string, Uint8Array>(Object.entries(bundled));
  const operations: string[] = [];
  let failMove = false;
  const environment: BriefPromptStoreEnvironment = {
    profileDir: '/profile',
    join: (...parts) => parts.join('/').replace(/\/{2,}/g, '/'),
    exists: async path => files.has(path),
    read: async path => {
      const value = files.get(path);
      if (!value) throw new Error('missing');
      return value;
    },
    write: async (path, content) => {
      operations.push(`write:${path}`);
      files.set(path, new Uint8Array(content));
    },
    move: async (source, destination) => {
      operations.push(`move:${source}:${destination}`);
      if (failMove) throw new Error('move failed');
      const value = files.get(source);
      if (!value) throw new Error('missing temporary file');
      files.set(destination, value);
      files.delete(source);
    },
    remove: async path => {
      operations.push(`remove:${path}`);
      files.delete(path);
    },
    makeDirectory: async path => { operations.push(`mkdir:${path}`); },
    temporarySuffix: () => 'test',
    readBundled: async uri => {
      const value = bundledFiles.get(uri);
      if (!value) throw new Error('missing bundled prompt');
      return value;
    },
  };
  return {
    environment,
    files,
    bundledFiles,
    operations,
    failNextMove: () => { failMove = true; },
  };
}

const encode = (value: string) => new TextEncoder().encode(value);

describe('brief prompt store', () => {
  let memory: ReturnType<typeof memoryEnvironment>;
  let store: BriefPromptStore;

  beforeEach(() => {
    memory = memoryEnvironment({
      '/imports/standard.md': encode('# 中文提示词'),
      '/imports/review.txt': encode('\uFEFF# Review prompt'),
    });
    store = new BriefPromptStore(memory.environment);
  });

  test('loads packaged Markdown defaults when the user has not imported overrides', async () => {
    const prompts = await store.loadRequired();
    assert.equal(prompts.standard.source, 'bundled');
    assert.equal(prompts.standard.content, '# Bundled standard prompt');
    assert.equal(
      prompts.standard.path,
      `${BRIEF_BUNDLED_PROMPT_BASE_URI}/standard-article-brief.md`,
    );
    assert.equal(prompts.review.source, 'bundled');
  });

  test('imports language-independent overrides into separate managed files', async () => {
    const standard = await store.importFromFile('standard', '/imports/standard.md');
    const review = await store.importFromFile('review', '/imports/review.txt');
    assert.equal(standard.path, '/profile/zotseek-brief-prompts/standard.md');
    assert.equal(standard.source, 'custom');
    assert.equal(standard.content, '# 中文提示词');
    assert.equal(review.path, '/profile/zotseek-brief-prompts/review.md');
    assert.equal(review.content, '# Review prompt');
    assert.match(standard.hash, /^[0-9a-f]{64}$/);
    assert.notEqual(standard.hash, review.hash);
    assert.deepEqual(
      Object.keys(await store.loadRequired()),
      ['standard', 'review'],
    );
  });

  test('rejects unsupported extensions, invalid UTF-8, empty files and oversized files', async () => {
    memory.files.set('/imports/prompt.pdf', encode('prompt'));
    memory.files.set('/imports/invalid.md', new Uint8Array([0xc3, 0x28]));
    memory.files.set('/imports/empty.md', encode('  \n'));
    memory.files.set('/imports/large.md', new Uint8Array(BRIEF_PROMPT_MAX_BYTES + 1));
    await assert.rejects(
      () => store.importFromFile('standard', '/imports/prompt.pdf'),
      /\.md or \.txt/,
    );
    await assert.rejects(
      () => store.importFromFile('standard', '/imports/invalid.md'),
      /valid UTF-8/,
    );
    await assert.rejects(
      () => store.importFromFile('standard', '/imports/empty.md'),
      /must not be empty/,
    );
    await assert.rejects(
      () => store.importFromFile('standard', '/imports/large.md'),
      /256 KiB/,
    );
  });

  test('reports a broken build when a packaged default is missing', async () => {
    const incomplete = memoryEnvironment({}, {
      [`${BRIEF_BUNDLED_PROMPT_BASE_URI}/standard-article-brief.md`]:
        encode('# Bundled standard prompt'),
    });
    const incompleteStore = new BriefPromptStore(incomplete.environment);
    await assert.rejects(() => incompleteStore.loadRequired(), /bundled literature-brief prompt/);
  });

  test('preserves the previous prompt and removes the temporary file when replacement fails', async () => {
    const destination = '/profile/zotseek-brief-prompts/standard.md';
    memory.files.set(destination, encode('previous prompt'));
    memory.failNextMove();
    await assert.rejects(
      () => store.importFromFile('standard', '/imports/standard.md'),
      BriefPromptStoreError,
    );
    assert.equal(new TextDecoder().decode(memory.files.get(destination)), 'previous prompt');
    assert.equal(memory.files.has(`${destination}.tmp-test`), false);
  });
});

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
  let downloadDirectory: string | undefined;
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
    getDownloadDirectory: async () => {
      if (!downloadDirectory) throw new Error('download directory unavailable');
      return downloadDirectory;
    },
  };
  return {
    environment,
    files,
    bundledFiles,
    operations,
    failNextMove: () => { failMove = true; },
    setDownloadDirectory: (path: string | undefined) => { downloadDirectory = path; },
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
    const mixedPair = await store.loadRequired();
    assert.equal(mixedPair.standard.source, 'custom');
    assert.equal(mixedPair.standard.content, '# 中文提示词');
    assert.equal(mixedPair.review.source, 'bundled');
    assert.equal(mixedPair.review.content, '# Bundled review prompt');

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

  test('publishes a complete pair behind one atomic active record', async () => {
    const published = await store.publishPair({ standard: '# Personal standard', review: '# Personal review' });
    assert.equal(published.status, 'enabled');
    assert.ok(published.version);
    const version = published.version;
    assert.equal((await store.loadRequired()).standard.content, '# Personal standard');
    assert.equal((await store.loadRequired()).review.content, '# Personal review');
    const activeBytes = memory.files.get(store.getActiveRecordPath());
    assert.ok(activeBytes);
    assert.match(new TextDecoder().decode(activeBytes), /"schema":1/);
    assert.equal(memory.files.has(store.getVersionPromptPath(version, 'standard')), true);
    assert.equal(memory.files.has(store.getVersionPromptPath(version, 'review')), true);
  });

  test('a single-slot import after paired publication preserves the other slot', async () => {
    await store.publishPair({ standard: '# old standard', review: '# old review' });
    const imported = await store.importFromFile('standard', '/imports/standard.md');
    assert.equal(imported.content, '# 中文提示词');
    const current = await store.loadRequired();
    assert.equal(current.standard.content, '# 中文提示词');
    assert.equal(current.review.content, '# old review');
  });

  test('downloads both files with safe non-overwriting names and reports partial failure', async () => {
    memory.setDownloadDirectory('/downloads');
    const result = await store.downloadPair({ standard: '# standard', review: '# review' });
    assert.equal(result.status, 'downloaded');
    assert.match(result.files.standard.path || '', /zotseek-brief-standard-.*\.md$/);
    assert.match(result.files.review.path || '', /zotseek-brief-review-.*\.md$/);
    assert.notEqual(result.files.standard.path, result.files.review.path);
    const save = await store.saveGeneratedPair({ standard: '# next standard', review: '# next review' });
    assert.equal(save.status, 'enabled');
    assert.equal((await store.loadRequired()).review.content, '# next review');
  });

  test('downloads packaged defaults before activating them and preserves custom prompts on download failure', async () => {
    await store.publishPair({ standard: '# custom standard', review: '# custom review' });

    memory.setDownloadDirectory('/downloads');
    const originalMove = memory.environment.move;
    memory.environment.move = async (source, destination, options) => {
      if (/zotseek-brief-review-.*\.md$/.test(destination)) throw new Error('review download failed');
      await originalMove(source, destination, options);
    };
    const failed = await store.saveBundledPair();
    assert.equal(failed.status, 'failed');
    assert.equal(failed.downloads.files.standard.status, 'downloaded');
    assert.equal(failed.downloads.files.review.status, 'failed');
    assert.equal((await store.loadRequired()).standard.content, '# custom standard');

    memory.environment.move = originalMove;
    const saved = await store.saveBundledPair();
    assert.equal(saved.status, 'enabled');
    assert.equal(saved.downloads.status, 'downloaded');
    assert.equal((await store.loadRequired()).standard.source, 'bundled');
    assert.equal((await store.loadRequired()).review.source, 'bundled');
    assert.equal(
      new TextDecoder().decode(memory.files.get(saved.downloads.files.standard.path || '')),
      '# Bundled standard prompt',
    );
    assert.equal(
      new TextDecoder().decode(memory.files.get(saved.downloads.files.review.path || '')),
      '# Bundled review prompt',
    );
  });

  test('cancellation before the active-record commit does not enable a partial pair', async () => {
    const controller = new AbortController();
    let writes = 0;
    const originalWrite = memory.environment.write;
    memory.environment.write = async (path, bytes) => {
      await originalWrite(path, bytes);
      writes++;
      if (writes === 2) controller.abort();
    };
    await assert.rejects(
      () => store.publishPair({ standard: '# cancelled standard', review: '# cancelled review' }, { signal: controller.signal }),
      /cancelled/,
    );
    assert.equal(await memory.environment.exists(store.getActiveRecordPath()), false);
    assert.equal((await store.loadRequired()).standard.source, 'bundled');
  });

  test('restores the validated bundled pair without deleting managed history', async () => {
    const published = await store.publishPair({ standard: '# custom standard', review: '# custom review' });
    assert.ok(published.version);
    const historicalStandard = store.getVersionPromptPath(published.version!, 'standard');
    const restored = await store.resetToBundled();
    assert.equal(restored.standard.source, 'bundled');
    assert.equal(restored.review.source, 'bundled');
    assert.equal(await memory.environment.exists(store.getActiveRecordPath()), false);
    assert.equal(await memory.environment.exists(historicalStandard), true);
    assert.equal((await store.loadRequired()).standard.content, '# Bundled standard prompt');
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { installZoteroStub } from './helpers/zotero-stub';
import { T0BM25Index } from '../src/core/lexical-search';
import { getLexicalSnapshotSize, loadLexicalSnapshot, persistLexicalSnapshot, validateLexicalSnapshot } from '../src/core/lexical-snapshot';

const identity = { databaseId: 'a'.repeat(32), revision: '7', modelId: 'test-model' };
const documents = [{ itemPk: 1, libraryKey: 'user', itemKey: 'ABCDEFGH', itemId: 91,
  chunkIndex: 0, chunkText: '支持 cooperation 协作', textSource: 'note' as const }];

test('JSON snapshot round trip, mismatch, corruption, cancellation and failed replacement', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'zotseek-snapshot-'));
  const z = installZoteroStub();
  z.DataDirectory = { dir };
  (globalThis as any).PathUtils = path;
  const io = {
    readUTF8: (p: string) => fs.readFile(p, 'utf8'),
    writeUTF8: async (p: string, s: string) => { await fs.writeFile(p, s); return Buffer.byteLength(s); },
    stat: fs.stat,
    move: fs.rename,
    remove: (p: string) => fs.rm(p, { force: true }),
  };
  (globalThis as any).IOUtils = io;
  try {
    assert.equal(await getLexicalSnapshotSize(), 0, 'no saved snapshot uses no disk space');
    const index = new T0BM25Index(documents);
    await persistLexicalSnapshot(identity, index, () => true);
    const file = path.join(dir, 'zotseek-lexical-snapshot.json');
    const original = await fs.readFile(file, 'utf8');
    assert.equal(await getLexicalSnapshotSize(), Buffer.byteLength(original));
    assert.equal(JSON.parse(original).header.revision, '7', 'file remains valid JSON');
    const restored = await loadLexicalSnapshot(identity);
    assert.ok(restored);
    assert.deepEqual(restored.stats, index.stats);
    assert.deepEqual(restored.search('协作'), index.search('协作').map(hit => ({ ...hit, itemId: undefined })));
    for (const mismatch of [{ revision: '8' }, { databaseId: 'b'.repeat(32) }, { modelId: 'other' }]) {
      assert.equal(await loadLexicalSnapshot({ ...identity, ...mismatch }), null);
    }
    await fs.writeFile(file, original.replace('支持', '反对'));
    assert.equal(await loadLexicalSnapshot(identity), null, 'equal-length content corruption is detected');
    await fs.writeFile(file, original.slice(0, -20));
    assert.equal(await getLexicalSnapshotSize(), Buffer.byteLength(original.slice(0, -20)), 'count actual bytes even for an invalid snapshot');
    assert.equal(await loadLexicalSnapshot(identity), null, 'truncation is a cache miss');
    await fs.writeFile(file, original);
    await persistLexicalSnapshot({ ...identity, revision: '8' }, index, () => false);
    assert.equal(await fs.readFile(file, 'utf8'), original, 'cancelled job cannot replace snapshot');
    io.move = async () => { throw new Error('disk failure'); };
    await persistLexicalSnapshot({ ...identity, revision: '8' }, index, () => true);
    assert.equal(await fs.readFile(file, 'utf8'), original, 'last complete snapshot survives failure');
    assert.deepEqual(await fs.readdir(dir), ['zotseek-lexical-snapshot.json']);
    io.move = fs.rename;
    await Promise.all([
      persistLexicalSnapshot({ ...identity, revision: '8' }, index, () => true),
      persistLexicalSnapshot({ ...identity, revision: '9' }, index, () => true),
    ]);
    assert.ok(await loadLexicalSnapshot({ ...identity, revision: '9' }));
    const many = new T0BM25Index(Array.from({ length: 180 }, (_, i) => ({ ...documents[0],
      itemPk: i + 1, itemKey: String(i), chunkText: documents[0].chunkText + '\n"quoted" shared ' + i })));
    await persistLexicalSnapshot(identity, many, () => true);
    const segmented = await loadLexicalSnapshot(identity);
    assert.ok(segmented);
    assert.deepEqual(segmented.stats, many.stats);
    assert.deepEqual(segmented.search('shared'), many.search('shared').map(h => ({ ...h, itemId: undefined })));
    const saved = await fs.readFile(file, 'utf8');
    const write = io.writeUTF8;
    let publishing = true;
    io.writeUTF8 = async (p, s) => { const bytes = await write(p, s); publishing = false; return bytes; };
    await persistLexicalSnapshot({ ...identity, revision: '10' }, index, () => publishing);
    assert.equal(await fs.readFile(file, 'utf8'), saved, 'closing during I/O cannot publish a completed temp file');
    io.writeUTF8 = write;
    const invalid = index.serialize() as any;
    invalid.postingOffsets[1] = 0xffffffff;
    assert.throws(() => validateLexicalSnapshot(invalid));
  } finally {
    delete (globalThis as any).IOUtils;
    delete (globalThis as any).PathUtils;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('cooperative builder preserves synchronous ranking and can cancel', async () => {
  const corpus = Array.from({ length: 200 }, (_, i) => ({ ...documents[0], itemPk: i + 1,
    itemKey: String(i), chunkText: documents[0].chunkText + ' shared '.repeat(i % 13) }));
  const sync = new T0BM25Index(corpus);
  const cooperative = await T0BM25Index.buildAsync(corpus);
  assert.deepEqual(cooperative.stats, sync.stats);
  for (const query of ['协作', 'shared', 'cooperation 协作']) {
    assert.deepEqual(cooperative.search(query), sync.search(query));
  }
  await assert.rejects(T0BM25Index.buildAsync(corpus, () => false), /cancelled/);
});

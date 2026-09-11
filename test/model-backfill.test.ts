import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import * as ts from 'typescript';

// Exercise the actual coordinating method without booting the plugin lifecycle.
const source = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
const plugin = ast.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === 'ZotSeekPlugin') as ts.ClassDeclaration;
const method = plugin.members.find(n => ts.isMethodDeclaration(n) && n.name.getText(ast) === 'reindexForActiveModel')!;
const compiled = ts.transpileModule(`class Harness { ${method.getText(ast)} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function harness() {
  let activeModel = 'cloud:test';
  let operationToken: symbol | null = null;
  const valid = { id: 1 }, excluded = { id: 2, excluded: true };
  const calls: any[][] = [];
  const Harness = new Function('getActiveModelId', 'getZotero', 'Zotero',
    'readIndexExclusionPolicy', 'localItemIDFromIdentity', 'isItemExcludedFromIndex', 'getString',
    `${compiled}; return Harness;`)(
    () => activeModel, () => ({}), { Items: { get: (id: number) => id === 1 ? valid : id === 2 ? excluded : null } },
    () => ({}), (identity: any) => identity.localID, (item: any) => !!item.excluded, () => 'error',
  );
  const h = new Harness();
  Object.assign(h, {
    indexing: false, indexOperationActive: false,
    logger: { debug() {}, error() {} }, showAlert() {},
    isIndexOperationBusy() { return h.indexing || h.indexOperationActive; },
    tryBeginIndexOperation() {
      if (h.indexing || h.indexOperationActive) return null;
      operationToken = Symbol('test-index-operation');
      h.indexOperationActive = true;
      return operationToken;
    },
    endIndexOperation(token: symbol) {
      assert.equal(token, operationToken);
      operationToken = null;
      h.indexOperationActive = false;
    },
    ensureOperationalModel: () => true, ensureChunkStrategyWritable: async () => true,
    ensureStoreReady: async () => {},
    vectorStore: { getItemsMissingModel: async (model: string) => {
      assert.equal(model, 'cloud:test');
      return [{ localID: 1 }, { localID: 2 }, { localID: 3 }, { localID: null }];
    } },
    indexItems: async (...args: any[]) => {
      assert.equal(h.indexOperationActive, true);
      assert.equal(h.indexing, false);
      assert.equal(args[3], operationToken);
      calls.push([args[0]]);
    },
  });
  return { h, calls, valid, setModel: (model: string) => { activeModel = model; } };
}

describe('new-model coverage backfill', () => {
  test('hands only resolvable eligible missing items to fingerprint-aware reconciliation', async () => {
    const { h, calls, valid } = harness();
    await h.reindexForActiveModel();
    assert.deepEqual(calls, [[[valid]]]);
  });
  test('does not run while another operation owns either lock', async () => {
    for (const lock of ['indexing', 'indexOperationActive']) {
      const { h, calls } = harness(); h[lock] = true;
      await h.reindexForActiveModel(); assert.equal(calls.length, 0); assert.equal(h[lock], true);
    }
  });
  test('releases discovery locks when strategy is not writable', async () => {
    const { h, calls } = harness(); h.ensureChunkStrategyWritable = async () => false;
    await h.reindexForActiveModel();
    assert.equal(calls.length, 0); assert.equal(h.indexing, false); assert.equal(h.indexOperationActive, false);
  });
  test('does not redirect paid backfill after a model change during discovery', async () => {
    const { h, calls, setModel } = harness();
    h.ensureStoreReady = async () => setModel('cloud:other');
    await h.reindexForActiveModel(); assert.equal(calls.length, 0);
  });
  test('empty coverage never broadens to a library index request', async () => {
    const { h, calls } = harness(); h.vectorStore.getItemsMissingModel = async () => [];
    await h.reindexForActiveModel(); assert.equal(calls.length, 0);
  });
  test('discovery errors release locks and do not start embedding', async () => {
    const { h, calls } = harness(); h.ensureStoreReady = async () => { throw new Error('test'); };
    await h.reindexForActiveModel();
    assert.equal(calls.length, 0); assert.equal(h.indexing, false); assert.equal(h.indexOperationActive, false);
  });
});

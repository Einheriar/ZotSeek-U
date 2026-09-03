import { selfTest, scenario, assertEq, assertTrue } from '../self-test';
import { vectorStoreSQLite } from '../../core/vector-store-sqlite';
import { getActiveModelId } from '../../core/model-registry';

declare const Zotero: any;

const LK = 'user';
const IK = 'ZZTESTKEY';          // synthetic test item key (won't resolve to a real item)
function fakeEmbedding(modelId: string, dims: number) {
  return {
    libraryKey: LK, itemKey: IK, title: 'Test', abstract: undefined,
    modelId, indexedAt: new Date().toISOString(), contentHash: 'h',
    chunkIndex: 0, textSource: 'abstract' as const,
    embedding: new Array(dims).fill(0.1),
  };
}

selfTest.register('task-37c-model-aware-store', async () => {
  await vectorStoreSQLite.deleteItem(LK, IK).catch(() => {});
  await vectorStoreSQLite.put(fakeEmbedding('nomic-embed-text-v1.5', 768));
  await vectorStoreSQLite.put(fakeEmbedding('bge-m3', 1024));
  return [
    await scenario('same item holds chunks for two models', async () => {
      const n = await Zotero.DB.valueQueryAsync(
        `SELECT COUNT(DISTINCT c.model_id) FROM zotseek.chunks c
         JOIN zotseek.items i ON c.item_pk = i.item_pk
         WHERE i.library_key = ? AND i.item_key = ?`, [LK, IK]);
      assertEq(Number(n), 2);
    }),
    await scenario('item_models has one row per model', async () => {
      const n = await Zotero.DB.valueQueryAsync(
        `SELECT COUNT(*) FROM zotseek.item_models im
         JOIN zotseek.items i ON im.item_pk = i.item_pk
         WHERE i.library_key = ? AND i.item_key = ?`, [LK, IK]);
      assertEq(Number(n), 2);
    }),
    await scenario('getAll preserves both model partitions', async () => {
      const all = await vectorStoreSQLite.getAll();
      const mine = all.filter((e: any) => e.itemKey === IK);
      assertTrue(mine.length >= 2, 'both model chunks present in getAll()');
      const models = new Set(mine.map((e: any) => e.modelId));
      assertTrue(models.has('nomic-embed-text-v1.5') && models.has('bge-m3'),
        'getAll() exposes both model partitions');
    }),
    await scenario('getAllCached returns only the active model partition', async () => {
      const activeModelId = getActiveModelId();
      const all = await (vectorStoreSQLite as any).getAllCached();
      assertTrue(all.every((e: any) => e.modelId === activeModelId),
        `cache rows must use active model ${activeModelId}`);
    }),
    await scenario('coverage counts items per model', async () => {
      const cov = await vectorStoreSQLite.getCoverage('bge-m3');
      assertTrue(cov.covered >= 1, 'bge-m3 coverage should include the test item');
      assertTrue(cov.total >= cov.covered, 'total >= covered');
    }),
    await scenario('deleteChunksForItem scopes to one model', async () => {
      await vectorStoreSQLite.deleteChunksForItem(LK, IK, 'bge-m3');
      const left = await Zotero.DB.columnQueryAsync(
        `SELECT DISTINCT c.model_id FROM zotseek.chunks c
         JOIN zotseek.items i ON c.item_pk = i.item_pk
         WHERE i.library_key = ? AND i.item_key = ?`, [LK, IK]);
      assertEq(left.join(','), 'nomic-embed-text-v1.5');
    }),
    await scenario('deleteModelEmbeddings removes only that model', async () => {
      // re-add bge-m3 so we can delete it library-wide
      await vectorStoreSQLite.put(fakeEmbedding('bge-m3', 1024));
      await vectorStoreSQLite.deleteModelEmbeddings('bge-m3');
      const left = await Zotero.DB.valueQueryAsync(
        `SELECT COUNT(DISTINCT c.model_id) FROM zotseek.chunks c
         JOIN zotseek.items i ON c.item_pk = i.item_pk
         WHERE i.library_key = ? AND i.item_key = ?`, [LK, IK]);
      assertEq(Number(left), 1);
    }),
    await scenario('getStats reports the active short model id', async () => {
      const stats = await vectorStoreSQLite.getStats();
      // The suite does not choose a model; getStats must reflect the current
      // operational preference rather than a synthetic partition.
      assertEq(stats.modelId, getActiveModelId());
    }),
    await scenario('cleanup', async () => {
      await vectorStoreSQLite.deleteItem(LK, IK);
      assertTrue(true);
    }),
  ];
});

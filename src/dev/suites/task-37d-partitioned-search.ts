import { selfTest, scenario, assertEq, assertTrue } from '../self-test';
import { vectorStoreSQLite } from '../../core/vector-store-sqlite';
import { getActiveModelId } from '../../core/model-registry';

declare const Zotero: any;

selfTest.register('task-37d-partitioned-search', async () => {
  // Seed two synthetic items, each indexed under a different model id.
  const mk = (key: string, modelId: string, dims: number) => ({
    libraryKey: 'user', itemKey: key, title: 'P', abstract: undefined,
    modelId, indexedAt: new Date().toISOString(), contentHash: 'h',
    chunkIndex: 0, textSource: 'abstract' as const, embedding: new Array(dims).fill(0.2),
  });
  await vectorStoreSQLite.deleteItem('user', 'ZZPART_A').catch(() => {});
  await vectorStoreSQLite.deleteItem('user', 'ZZPART_B').catch(() => {});
  await vectorStoreSQLite.put(mk('ZZPART_A', 'nomic-embed-text-v1.5', 768));
  await vectorStoreSQLite.put(mk('ZZPART_B', 'bge-m3', 1024));
  return [
    await scenario('getAll preserves both model partitions', async () => {
      const all = await vectorStoreSQLite.getAll();
      const mine = all.filter((e: any) => e.itemKey === 'ZZPART_A' || e.itemKey === 'ZZPART_B');
      const seen = new Set(mine.map((e: any) => e.modelId));
      assertTrue(seen.has('nomic-embed-text-v1.5') && seen.has('bge-m3'),
        'getAll() should expose both model partitions');
    }),
    await scenario('getAllCached returns only the active model partition', async () => {
      const active = getActiveModelId();
      const all = await (vectorStoreSQLite as any).getAllCached();
      assertTrue(all.every((e: any) => e.modelId === active),
        `cache rows must use active model ${active}`);
    }),
    await scenario('cleanup', async () => {
      await vectorStoreSQLite.deleteItem('user', 'ZZPART_A');
      await vectorStoreSQLite.deleteItem('user', 'ZZPART_B');
      assertTrue(true);
    }),
  ];
});

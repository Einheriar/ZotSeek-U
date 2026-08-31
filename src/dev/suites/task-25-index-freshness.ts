/**
 * Runtime checks for Plan 25's atomic replacement boundary.
 *
 * The suite writes only temporary ZotSeek rows for an otherwise unindexed
 * regular Zotero item. It never modifies the Zotero item or its Child Notes,
 * and every scenario removes the temporary rows in finally.
 */

import { selfTest, scenario, assertEq, assertTrue } from '../self-test';
import { vectorStoreSQLite, type PaperEmbedding } from '../../core/vector-store-sqlite';
import { getActiveModel, getActiveModelId } from '../../core/model-registry';

declare const Zotero: any;

const DB = 'zotseek';
const OTHER_MODEL_ID = 'plan25-selftest-other-model';

async function pickUnindexedUserItem(): Promise<any | null> {
  const indexed = new Set<string>(((await Zotero.DB.columnQueryAsync(
    `SELECT item_key FROM ${DB}.items WHERE library_key = 'user'`,
  )) || []).map((key: any) => String(key)));
  const items = (await Zotero.Items.getAll(
    Zotero.Libraries.userLibraryID,
    false,
    true,
  )) || [];
  return items.find((item: any) =>
    item?.key &&
    !item.deleted &&
    item.isRegularItem?.() &&
    !indexed.has(item.key),
  ) || null;
}

function makeEmbedding(
  item: any,
  modelId: string,
  chunkIndex: number,
  textSource: PaperEmbedding['textSource'],
  chunkText: string,
): PaperEmbedding {
  return {
    itemId: item.id,
    libraryKey: 'user',
    itemKey: item.key,
    libraryId: item.libraryID,
    chunkIndex,
    title: 'Plan 25 self-test item',
    abstract: 'Temporary ZotSeek-only row',
    chunkText,
    textSource,
    embedding: new Array(getActiveModel().dimensions).fill(0),
    modelId,
    indexedAt: new Date().toISOString(),
    contentHash: `plan25-${modelId}-${chunkText}`,
    wasTruncated: false,
    pagesIndexed: textSource === 'fulltext' ? 1 : 0,
    pagesTotal: textSource === 'fulltext' ? 1 : 0,
  };
}

async function chunkTexts(itemKey: string, modelId: string): Promise<string[]> {
  const values = await Zotero.DB.columnQueryAsync(`
    SELECT COALESCE(c.chunk_text, '')
    FROM ${DB}.chunks c
    INNER JOIN ${DB}.items i ON i.item_pk = c.item_pk
    WHERE i.library_key = 'user' AND i.item_key = ? AND c.model_id = ?
    ORDER BY c.chunk_index
  `, [itemKey, modelId]);
  return (values || []).map((value: any) => String(value));
}

selfTest.register('task-25-index-freshness', async () => {
  const sample = await pickUnindexedUserItem();
  return [
    await scenario('active-model replacement preserves another model partition', async () => {
      assertTrue(sample, 'no unindexed regular user-library item available');
      const activeModelId = getActiveModelId();
      await vectorStoreSQLite.deleteItem('user', sample.key);
      try {
        await vectorStoreSQLite.replaceItemModelChunks([
          makeEmbedding(sample, activeModelId, 0, 'summary', 'summary-old'),
          makeEmbedding(sample, activeModelId, 1, 'note', 'note-old'),
          makeEmbedding(sample, activeModelId, 2, 'fulltext', 'pdf-old'),
        ]);
        await vectorStoreSQLite.replaceItemModelChunks([
          makeEmbedding(sample, OTHER_MODEL_ID, 0, 'summary', 'other-model-summary'),
        ]);
        await vectorStoreSQLite.replaceItemModelChunks([
          makeEmbedding(sample, activeModelId, 0, 'summary', 'summary-old'),
          makeEmbedding(sample, activeModelId, 1, 'note', 'note-new'),
          makeEmbedding(sample, activeModelId, 2, 'fulltext', 'pdf-old'),
        ]);

        assertEq(
          JSON.stringify(await chunkTexts(sample.key, activeModelId)),
          JSON.stringify(['summary-old', 'note-new', 'pdf-old']),
        );
        assertEq(
          JSON.stringify(await chunkTexts(sample.key, OTHER_MODEL_ID)),
          JSON.stringify(['other-model-summary']),
        );
      } finally {
        await vectorStoreSQLite.deleteItem('user', sample.key);
      }
    }),

    await scenario('failed replacement rolls back and keeps the old complete chunks', async () => {
      assertTrue(sample, 'no unindexed regular user-library item available');
      const activeModelId = getActiveModelId();
      await vectorStoreSQLite.deleteItem('user', sample.key);
      try {
        await vectorStoreSQLite.replaceItemModelChunks([
          makeEmbedding(sample, activeModelId, 0, 'summary', 'summary-before-failure'),
          makeEmbedding(sample, activeModelId, 1, 'note', 'note-before-failure'),
        ]);

        let failed = false;
        try {
          await vectorStoreSQLite.replaceItemModelChunks([
            makeEmbedding(sample, activeModelId, 0, 'summary', 'replacement-a'),
            makeEmbedding(sample, activeModelId, 0, 'note', 'replacement-b'),
          ]);
        } catch {
          failed = true;
        }
        assertTrue(failed, 'duplicate chunk keys must fail the replacement transaction');
        assertEq(
          JSON.stringify(await chunkTexts(sample.key, activeModelId)),
          JSON.stringify(['summary-before-failure', 'note-before-failure']),
          'transaction rollback must restore the previous active-model chunks',
        );
      } finally {
        await vectorStoreSQLite.deleteItem('user', sample.key);
      }
    }),
  ];
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { VectorStoreSQLite } from '../src/core/vector-store-sqlite';

test('schema 12 adds nullable PDF provenance without rewriting legacy rows', async () => {
  const zotero = installZoteroStub();
  const statements: string[] = [];
  zotero.DB = {
    queryAsync: async (sql: string) => {
      statements.push(sql.trim());
      if (sql.includes('table_info(chunks)')) {
        return [{ name: 'item_pk' }, { name: 'section_paths' }];
      }
      return [];
    },
  };

  await (new VectorStoreSQLite() as any).migrateToV12();

  assert.equal(
    statements.some(sql => sql === 'ALTER TABLE zotseek.chunks ADD COLUMN pdf_attachment_key TEXT'),
    true,
  );
  assert.equal(
    statements.some(sql => sql.includes("VALUES ('schema_version', '12')")),
    true,
  );
  assert.equal(statements.some(sql => /UPDATE\s+zotseek\.chunks/iu.test(sql)), false);
});

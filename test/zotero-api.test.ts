import './helpers/zotero-stub';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { ZoteroAPI } from '../src/utils/zotero-api';

type PageResult = { totalPages?: number; text?: string } | Error;

function installPdfScenario(
  attachmentIds: number[],
  pageResults: Record<number, Record<number, PageResult>>,
) {
  const zotero = installZoteroStub();
  const calls: Array<{ attachmentId: number; pageIndex: number }> = [];
  let fulltextCalls = 0;
  const parent = {
    id: 1,
    isRegularItem: () => true,
    getAttachments: () => attachmentIds,
  };
  const attachments = new Map(attachmentIds.map((id) => [id, {
    id,
    isPDFAttachment: () => true,
  }]));
  zotero.Items.get = (id: number) => id === parent.id ? parent : attachments.get(id);
  zotero.Fulltext = {
    getPages: async () => {
      fulltextCalls++;
      throw new Error('Fulltext.getPages must not gate PDFWorker extraction');
    },
  };
  zotero.PDFWorker = {
    getFullText: async (attachmentId: number, pages: number[]) => {
      const pageIndex = pages[0];
      calls.push({ attachmentId, pageIndex });
      const result = pageResults[attachmentId]?.[pageIndex];
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return {
    calls,
    getFulltextCalls: () => fulltextCalls,
  };
}

test('discovers physical pages from the first PDFWorker response without Fulltext database state', async () => {
  const scenario = installPdfScenario([10], {
    10: {
      0: { totalPages: 3, text: 'first page' },
      1: { totalPages: 3, text: '' },
      2: { totalPages: 3, text: 'third page' },
    },
  });

  const pages = await new ZoteroAPI().getFullTextByPage(1);

  assert.deepEqual(pages, [
    { pageNumber: 1, text: 'first page' },
    { pageNumber: 2, text: '' },
    { pageNumber: 3, text: 'third page' },
  ]);
  assert.deepEqual(scenario.calls, [
    { attachmentId: 10, pageIndex: 0 },
    { attachmentId: 10, pageIndex: 1 },
    { attachmentId: 10, pageIndex: 2 },
  ]);
  assert.equal(scenario.getFulltextCalls(), 0);
});

test('preserves a failed physical page slot and continues extracting later pages', async () => {
  installPdfScenario([10], {
    10: {
      0: { totalPages: 3, text: 'first page' },
      1: new Error('page failed'),
      2: { totalPages: 3, text: 'third page' },
    },
  });

  assert.deepEqual(await new ZoteroAPI().getFullTextByPage(1), [
    { pageNumber: 1, text: 'first page' },
    { pageNumber: 2, text: '' },
    { pageNumber: 3, text: 'third page' },
  ]);
});

test('keeps a PDF when its first page is whitespace but a later page contains text', async () => {
  const scenario = installPdfScenario([10, 20], {
    10: {
      0: { totalPages: 2, text: '\f \r\n' },
      1: { totalPages: 2, text: 'text from the second physical page' },
    },
    20: {
      0: { totalPages: 1, text: 'text from a later attachment' },
    },
  });

  assert.deepEqual(await new ZoteroAPI().getFullTextByPage(1), [
    { pageNumber: 1, text: '\f \r\n' },
    { pageNumber: 2, text: 'text from the second physical page' },
  ]);
  assert.deepEqual(scenario.calls, [
    { attachmentId: 10, pageIndex: 0 },
    { attachmentId: 10, pageIndex: 1 },
  ]);
});

test('skips an empty PDF and keeps the first later attachment that contains text', async () => {
  const scenario = installPdfScenario([10, 20], {
    10: {
      0: { totalPages: 2, text: '' },
      1: { totalPages: 2, text: '   ' },
    },
    20: {
      0: { totalPages: 1, text: 'text from second PDF' },
    },
  });

  assert.deepEqual(await new ZoteroAPI().getFullTextByPage(1), [
    { pageNumber: 1, text: 'text from second PDF' },
  ]);
  assert.deepEqual(scenario.calls, [
    { attachmentId: 10, pageIndex: 0 },
    { attachmentId: 10, pageIndex: 1 },
    { attachmentId: 20, pageIndex: 0 },
  ]);
});

test('continues to another PDF when the first attachment probe fails', async () => {
  installPdfScenario([10, 20], {
    10: {
      0: new Error('probe failed'),
    },
    20: {
      0: { totalPages: 1, text: 'usable text' },
    },
  });

  assert.deepEqual(await new ZoteroAPI().getFullTextByPage(1), [
    { pageNumber: 1, text: 'usable text' },
  ]);
});

test('returns null when every PDF is empty or has an invalid page count', async () => {
  installPdfScenario([10, 20], {
    10: {
      0: { totalPages: 0, text: '' },
    },
    20: {
      0: { totalPages: 2, text: '' },
      1: { totalPages: 2, text: '' },
    },
  });

  assert.equal(await new ZoteroAPI().getFullTextByPage(1), null);
});

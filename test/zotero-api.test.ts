import './helpers/zotero-stub';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { mapPdfPageText, ZoteroAPI } from '../src/utils/zotero-api';

type PageResult = { totalPages?: number; text?: string } | Error;

test('library and collection scope discovery preserve books for exclusion cleanup', async () => {
  const zotero = installZoteroStub({ 'zotseek.excludeBooks': true });
  const searches: Array<Array<[string, string, unknown?]>> = [];
  zotero.Search = class {
    libraryID: number | undefined;
    private conditions: Array<[string, string, unknown?]> = [];

    constructor() {
      searches.push(this.conditions);
    }

    addCondition(field: string, operator: string, value?: unknown) {
      this.conditions.push([field, operator, value]);
    }

    async search() {
      return [1, 2];
    }
  };
  zotero.Items.getAsync = async (ids: number[]) => ids.map(id => ({ id }));

  const api = new ZoteroAPI();
  assert.deepEqual((await api.getLibraryItems(1)).map(item => item.id), [1, 2]);
  assert.deepEqual((await api.getCollectionItems(10, 1)).map(item => item.id), [1, 2]);
  assert.equal(searches.length, 2);
  for (const conditions of searches) {
    assert.equal(conditions.some(([field, operator, value]) =>
      field === 'itemType' && operator === 'isNot' && value === 'book'), false);
  }
});

function installPdfScenario(
  attachmentIds: number[],
  pageResults: Record<number, Record<number, PageResult>>,
  options: {
    parentTitle?: string;
    fileNames?: Record<number, string>;
  } = {},
) {
  const zotero = installZoteroStub();
  const calls: Array<{ attachmentId: number; pageIndex: number }> = [];
  let fulltextCalls = 0;
  const parent = {
    id: 1,
    isRegularItem: () => true,
    getAttachments: () => attachmentIds,
    getField: (field: string) => field === 'title'
      ? options.parentTitle ?? 'Target article title'
      : '',
  };
  const attachments = new Map(attachmentIds.map((id) => [id, {
    id,
    key: `ATT${id}`,
    isPDFAttachment: () => true,
    getFilePath: async () => `C:\\Zotero\\storage\\ATT${id}\\${options.fileNames?.[id] ?? `paper-${id}.pdf`}`,
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
    attachment: (id: number) => attachments.get(id)!,
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

  const result = await new ZoteroAPI().getPdfWorkerTextByAttachment(scenario.attachment(10) as any);

  assert.deepEqual(result.pages, [
    { pageNumber: 1, text: 'first page' },
    { pageNumber: 2, text: '' },
    { pageNumber: 3, text: 'third page' },
  ]);
  assert.equal(result.status, 'ok');
  assert.equal(result.pagesTotal, 3);
  assert.deepEqual(scenario.calls, [
    { attachmentId: 10, pageIndex: 0 },
    { attachmentId: 10, pageIndex: 1 },
    { attachmentId: 10, pageIndex: 2 },
  ]);
  assert.equal(scenario.getFulltextCalls(), 0);
});

test('preserves a failed physical page slot and continues extracting later pages', async () => {
  const scenario = installPdfScenario([10], {
    10: {
      0: { totalPages: 3, text: 'first page' },
      1: new Error('page failed'),
      2: { totalPages: 3, text: 'third page' },
    },
  });

  const result = await new ZoteroAPI().getPdfWorkerTextByAttachment(scenario.attachment(10) as any);
  assert.deepEqual(result.pages, [
    { pageNumber: 1, text: 'first page' },
    { pageNumber: 2, text: '' },
    { pageNumber: 3, text: 'third page' },
  ]);
  assert.equal(result.status, 'degraded');
});

test('selects a main PDF when its first page is whitespace but its second page has article evidence', async () => {
  const scenario = installPdfScenario([10, 20], {
    10: {
      0: { totalPages: 2, text: '\f \r\n' },
      1: { totalPages: 2, text: 'Research Article\nTarget article title\nAbstract\nIntroduction' },
    },
    20: {
      0: { totalPages: 1, text: 'Supporting Information\nSupplementary methods' },
    },
  }, {
    fileNames: { 20: 'paper_mmc1.pdf' },
  });

  const selected = await new ZoteroAPI().getSelectedMainPdfText(1);
  assert.equal(selected?.selection.selectedAttachmentId, 10);
  assert.deepEqual(selected?.selectedText?.pages, [
    { pageNumber: 1, text: '\f \r\n' },
    { pageNumber: 2, text: 'Research Article\nTarget article title\nAbstract\nIntroduction' },
  ]);
  assert.deepEqual(scenario.calls, [
    { attachmentId: 10, pageIndex: 0 },
    { attachmentId: 10, pageIndex: 1 },
    { attachmentId: 20, pageIndex: 0 },
  ]);
});

test('does not use first-readable fallback and selects the only high-confidence main', async () => {
  const scenario = installPdfScenario([10, 20], {
    10: {
      0: { totalPages: 2, text: '' },
      1: { totalPages: 2, text: '   ' },
    },
    20: {
      0: { totalPages: 1, text: 'Research Article\nTarget article title\nAbstract\nIntroduction' },
    },
  });

  const selected = await new ZoteroAPI().getSelectedMainPdfText(1);
  assert.equal(selected?.selection.selectedAttachmentId, 20);
  assert.equal(selected?.selection.predictions[0].role, 'unknown');
  assert.deepEqual(scenario.calls, [
    { attachmentId: 10, pageIndex: 0 },
    { attachmentId: 10, pageIndex: 1 },
    { attachmentId: 20, pageIndex: 0 },
  ]);
});

test('continues to another PDF when the first attachment probe fails', async () => {
  const scenario = installPdfScenario([10, 20], {
    10: {
      0: new Error('probe failed'),
    },
    20: {
      0: { totalPages: 1, text: 'Research Article\nTarget article title\nAbstract' },
    },
  });

  const selected = await new ZoteroAPI().getSelectedMainPdfText(1);
  assert.equal(selected?.selection.selectedAttachmentId, 20);
  assert.equal(selected?.selection.predictions[0].parserStatus, 'failed');
  assert.equal(selected?.selectedText?.pages[0].pageNumber, 1);
  assert.deepEqual(scenario.calls, [
    { attachmentId: 10, pageIndex: 0 },
    { attachmentId: 20, pageIndex: 0 },
  ]);
});

test('abstains when every PDF is empty or has an invalid page count', async () => {
  installPdfScenario([10, 20], {
    10: {
      0: { totalPages: 0, text: '' },
    },
    20: {
      0: { totalPages: 2, text: '' },
      1: { totalPages: 2, text: '' },
    },
  });

  const selected = await new ZoteroAPI().getSelectedMainPdfText(1);
  assert.equal(selected?.selectedText, null);
  assert.equal(selected?.selection.decision, 'abstain');
  assert.equal(selected?.selection.abstainReason, 'no-main');
});

test('compatibility page API returns only selector-approved main pages', async () => {
  const scenario = installPdfScenario([10, 20], {
    10: {
      0: { totalPages: 1, text: 'Supporting Online Material\nTarget article title' },
    },
    20: {
      0: { totalPages: 1, text: 'Research Article\nTarget article title\nAbstract' },
    },
  }, {
    fileNames: { 10: 'target_som.pdf', 20: 'target.pdf' },
  });

  assert.deepEqual(await new ZoteroAPI().getFullTextByPage(1), [
    { pageNumber: 1, text: 'Research Article\nTarget article title\nAbstract' },
  ]);
  assert.deepEqual(scenario.calls, [
    { attachmentId: 10, pageIndex: 0 },
    { attachmentId: 20, pageIndex: 0 },
  ]);
  assert.equal(scenario.getFulltextCalls(), 0);
});

test('maps form-feed boundaries to the explicitly requested physical pages', () => {
  assert.deepEqual(mapPdfPageText('page two\fpage four', [2, 4]), [
    { page: 2, text: 'page two' },
    { page: 4, text: 'page four' },
  ]);
  assert.equal(mapPdfPageText('collapsed', [1, 2]), null);
});

test('reads a complete Zotero cache without invoking PDFWorker', async () => {
  const zotero = installZoteroStub();
  let workerCalls = 0;
  zotero.Fulltext = {
    getPages: async () => ({ indexedPages: 3, total: 3 }),
    getItemCacheFile: () => ({ path: 'cache', exists: () => true }),
  };
  zotero.File = { getContentsAsync: async () => 'one\ftwo\fthree' };
  zotero.PDFWorker = {
    getFullText: async () => {
      workerCalls++;
      throw new Error('must not run');
    },
  };

  const result = await new ZoteroAPI().readPdfAttachment({ id: 10, key: 'PDFKEY12' } as any, null);
  assert.equal(result.status, 'ok');
  assert.equal(result.source, 'zotero-fulltext-cache');
  assert.equal(result.complete, true);
  assert.equal(workerCalls, 0);
  assert.deepEqual(result.pages.map(page => page.page), [1, 2, 3]);
});

test('fills all missing requested pages with one batched PDFWorker call', async () => {
  const zotero = installZoteroStub();
  const calls: Array<number[] | null> = [];
  zotero.Fulltext = {
    getPages: async () => ({ indexedPages: 2, total: 5 }),
    getItemCacheFile: () => ({ path: 'cache', exists: () => true }),
  };
  zotero.File = { getContentsAsync: async () => 'one\ftwo' };
  zotero.PDFWorker = {
    getFullText: async (_id: number, pages: number[] | null) => {
      calls.push(pages);
      return { totalPages: 5, text: 'four\ffive', extractedPages: 2 };
    },
  };

  const result = await new ZoteroAPI().readPdfAttachment(
    { id: 10, key: 'PDFKEY12' } as any,
    [1, 4, 5],
  );
  assert.equal(result.status, 'ok');
  assert.equal(result.source, 'cache+pdfworker');
  assert.deepEqual(calls, [[3, 4]]);
  assert.deepEqual(result.pages, [
    { page: 1, text: 'one' },
    { page: 4, text: 'four' },
    { page: 5, text: 'five' },
  ]);
});

test('uses one whole-document PDFWorker call when no cache is available', async () => {
  const zotero = installZoteroStub();
  const calls: Array<number[] | null> = [];
  zotero.Fulltext = {
    getPages: async () => null,
    getItemCacheFile: () => ({ path: 'missing', exists: () => false }),
  };
  zotero.PDFWorker = {
    getFullText: async (_id: number, pages: number[] | null) => {
      calls.push(pages);
      return { totalPages: 2, text: 'one\ftwo', extractedPages: 2 };
    },
  };

  const result = await new ZoteroAPI().readPdfAttachment({ id: 10, key: 'PDFKEY12' } as any, null);
  assert.equal(result.status, 'ok');
  assert.equal(result.source, 'pdfworker');
  assert.deepEqual(calls, [null]);
});

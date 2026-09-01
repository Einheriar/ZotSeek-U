import './helpers/zotero-stub';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { ZoteroAPI } from '../src/utils/zotero-api';

type PageResult = { totalPages?: number; text?: string } | Error;

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

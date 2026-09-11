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

test('keeps an unbounded whole-document read for non-server callers', async () => {
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

test('bounded full reads probe one page before batching when total pages are unknown', async () => {
  const zotero = installZoteroStub();
  const calls: number[][] = [];
  zotero.Fulltext = {
    getPages: async () => null,
    getItemCacheFile: () => ({ path: 'missing', exists: () => false }),
  };
  zotero.PDFWorker = {
    getFullText: async (_id: number, pages: number[]) => {
      calls.push(pages);
      return {
        totalPages: 2,
        text: pages.map(page => `page ${page + 1}`).join('\f'),
        extractedPages: pages.length,
      };
    },
  };

  const result = await new ZoteroAPI().readPdfAttachment(
    { id: 10, key: 'PDFKEY12' } as any,
    null,
    { batchPages: 20, maxPages: 100, maxCharacters: 300_000 },
  );
  assert.equal(result.status, 'ok');
  assert.equal(result.complete, true);
  assert.deepEqual(calls, [[0], [1]]);
  assert.deepEqual(result.pages.map(page => page.page), [1, 2]);
});

test('worker trim loses empty edge pages; sequential fallback preserves physical pages and limits', async () => {
  for (const texts of [['title', '', 'third', 'fourth'], ['title', 'second', 'third', ''], ['title', '', '', '']]) {
    const zotero = installZoteroStub();
    const calls: number[][] = [];
    let active = 0;
    let maxActive = 0;
    zotero.Fulltext = { getPages: async () => null };
    zotero.PDFWorker = {
      getFullText: async (_id: number, indexes: number[]) => {
        calls.push(indexes);
        maxActive = Math.max(maxActive, ++active);
        await Promise.resolve();
        active--;
        return { totalPages: 5, extractedPages: indexes.length,
          text: indexes.map(i => texts[i] + '\n\n').join('\f').trim().normalize('NFC') };
      },
    };
    const result = await new ZoteroAPI().readPdfAttachment({ id: 10, key: 'PDFKEY12' } as any,
      null, { batchPages: 3, maxPages: 4, maxCharacters: 300_000 });
    assert.equal(result.status, 'partial');
    assert.equal(result.nextPage, 5);
    assert.equal(result.limitReason, 'page_limit');
    assert.deepEqual(result.pages, texts.map((text, i) => ({ page: i + 1, text })));
    assert.deepEqual(calls, [[0], [1, 2, 3], [1], [2], [3]]);
    assert.equal(maxActive, 1);
  }
});

test('ambiguous worker ranges reread exact pages and preserve embedded form feeds', async () => {
  const zotero = installZoteroStub();
  const calls: number[][] = [];
  zotero.Fulltext = { getPages: async () => ({ indexedPages: 0, total: 4 }) };
  zotero.PDFWorker = { getFullText: async (_id: number, indexes: number[]) => {
    calls.push(indexes);
    return { totalPages: 4, extractedPages: indexes.length,
      text: indexes.map(i => i === 1 ? 'a\fb' : 'four').join('\f') };
  } };
  const result = await new ZoteroAPI().readPdfAttachment({ id: 10, key: 'PDFKEY12' } as any, [2, 4]);
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.pages, [{ page: 2, text: 'a\fb' }, { page: 4, text: 'four' }]);
  assert.deepEqual(calls, [[1, 3], [1], [3]]);
});

test('single-page fallback rejects failures and inconsistent output without manufacturing pages', async () => {
  for (const bad of [new Error('worker failed'), { totalPages: 3, text: 'x' },
    { totalPages: 2, text: null }, { totalPages: 2, text: '', extractedPages: 0 }]) {
    const zotero = installZoteroStub();
    const calls: number[][] = [];
    zotero.Fulltext = { getPages: async () => null };
    zotero.PDFWorker = { getFullText: async (_id: number, indexes: number[]) => {
      calls.push(indexes);
      if (indexes.length === 2) return { totalPages: 2, text: 'collapsed' };
      if (bad instanceof Error) throw bad;
      return bad;
    } };
    const result = await new ZoteroAPI().readPdfAttachment({ id: 10, key: 'PDFKEY12' } as any, [1, 2]);
    assert.equal(result.status, 'failed');
    assert.deepEqual(result.pages, []);
    assert.deepEqual(calls, [[0, 1], [0]]);
  }
});

test('bounded full reads use sequential batches and stop at the page limit', async () => {
  const zotero = installZoteroStub();
  const calls: number[][] = [];
  zotero.Fulltext = {
    getPages: async () => ({ indexedPages: 0, total: 125 }),
    getItemCacheFile: () => ({ path: 'missing', exists: () => false }),
  };
  zotero.PDFWorker = {
    getFullText: async (_id: number, pages: number[]) => {
      calls.push(pages);
      return {
        totalPages: 125,
        text: pages.map(page => `page ${page + 1}`).join('\f'),
        extractedPages: pages.length,
      };
    },
  };

  const result = await new ZoteroAPI().readPdfAttachment(
    { id: 10, key: 'PDFKEY12' } as any,
    null,
    { batchPages: 20, maxPages: 100, maxCharacters: 300_000 },
  );
  assert.equal(result.status, 'partial');
  assert.equal(result.complete, false);
  assert.equal(result.limitReason, 'page_limit');
  assert.equal(result.nextPage, 101);
  assert.equal(result.totalPages, 125);
  assert.equal(result.pages.length, 100);
  assert.equal(calls.length, 5);
  assert.deepEqual(calls.map(pages => pages.length), [20, 20, 20, 20, 20]);
  assert.deepEqual(calls[0], Array.from({ length: 20 }, (_, index) => index));
  assert.deepEqual(calls[4], Array.from({ length: 20 }, (_, index) => index + 80));
});

test('bounded full reads stop on a physical-page boundary at the character threshold', async () => {
  const zotero = installZoteroStub();
  const calls: number[][] = [];
  zotero.Fulltext = {
    getPages: async () => ({ indexedPages: 0, total: 10 }),
    getItemCacheFile: () => ({ path: 'missing', exists: () => false }),
  };
  zotero.PDFWorker = {
    getFullText: async (_id: number, pages: number[]) => {
      calls.push(pages);
      return {
        totalPages: 10,
        text: pages.map(() => 'x'.repeat(100_000)).join('\f'),
        extractedPages: pages.length,
      };
    },
  };

  const result = await new ZoteroAPI().readPdfAttachment(
    { id: 10, key: 'PDFKEY12' } as any,
    null,
    { batchPages: 20, maxPages: 100, maxCharacters: 300_000 },
  );
  assert.equal(result.status, 'partial');
  assert.equal(result.limitReason, 'character_limit');
  assert.equal(result.nextPage, 4);
  assert.deepEqual(result.pages.map(page => page.page), [1, 2, 3]);
  assert.deepEqual(calls.map(pages => pages.length), [10]);
});

test('bounded full reads also limit a complete Zotero cache without invoking PDFWorker', async () => {
  const zotero = installZoteroStub();
  let workerCalls = 0;
  zotero.Fulltext = {
    getPages: async () => ({ indexedPages: 120, total: 120 }),
    getItemCacheFile: () => ({ path: 'cache', exists: () => true }),
  };
  zotero.File = {
    getContentsAsync: async () => Array.from({ length: 120 }, (_, index) => `page ${index + 1}`).join('\f'),
  };
  zotero.PDFWorker = {
    getFullText: async () => {
      workerCalls++;
      throw new Error('must not run');
    },
  };

  const result = await new ZoteroAPI().readPdfAttachment(
    { id: 10, key: 'PDFKEY12' } as any,
    null,
    { batchPages: 20, maxPages: 100, maxCharacters: 300_000 },
  );
  assert.equal(result.status, 'partial');
  assert.equal(result.source, 'zotero-fulltext-cache');
  assert.equal(result.limitReason, 'page_limit');
  assert.equal(result.nextPage, 101);
  assert.equal(result.pages.length, 100);
  assert.equal(workerCalls, 0);
});

test('opens the exact indexed PDF attachment and falls back only without provenance', async () => {
  const zotero = installZoteroStub();
  const opens: unknown[][] = [];
  let bestCalls = 0;
  const best = { id: 10, key: 'BESTPDF1', parentID: 1, isPDFAttachment: () => true };
  const exact = { id: 20, key: 'EXACTPDF', parentID: 1, isPDFAttachment: () => true };
  const parent = {
    id: 1,
    key: 'PARENT01',
    libraryID: 7,
    getBestAttachment: async () => { bestCalls++; return best; },
  };
  zotero.Items.get = (id: number) => id === 1 ? parent : id === 10 ? best : id === 20 ? exact : null;
  zotero.Items.getIDFromLibraryAndKey = (libraryID: number, key: string) =>
    libraryID === 7 && key === exact.key ? exact.id : false;
  zotero.Reader = { open: async (...args: unknown[]) => { opens.push(args); } };

  const api = new ZoteroAPI();
  await api.openPDFToPage(1, 7, exact.key);
  assert.deepEqual(opens, [[20, { pageIndex: 6 }]]);
  assert.equal(bestCalls, 0);

  await api.openPDFToPage(1, 3, 'MISSING1');
  assert.equal(opens.length, 1, 'invalid exact provenance must not open a different PDF');
  assert.equal(bestCalls, 0);

  await api.openPDFToPage(1, 2);
  assert.deepEqual(opens.at(-1), [10, { pageIndex: 1 }]);
  assert.equal(bestCalls, 1);
});

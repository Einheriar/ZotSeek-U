import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
// http-tools pulls in the search engine and the embedding pipeline, which touch
// the Zotero global while their module bodies are evaluated. This import
// installs the stub as a side effect and MUST stay above the one below: import
// hoisting means a function call here would run too late.
import { installZoteroStub } from './helpers/zotero-stub';
import {
  applySearchResultFilter,
  buildLibraryCollectionTree,
  GET_ITEM_PDF_FULL_READ_LIMITS,
  isAllowedOrigin,
  parsePdfPageRange,
  runFindSimilarTool,
  runGetItemTool,
  runGetLibraryMapTool,
  runSearchTool,
  type ToolResultItem,
} from '../src/server/http-tools';
import { SERVER_SLOT_SELECTION_ID } from '../src/core/model-registry';

// Only the pure guard is exercised here; the search tools themselves need a
// real index and live in the in-Zotero suite (src/dev/suites/mcp-server.ts).

describe('isAllowedOrigin', () => {
  test('accepts a request with no Origin header at all', () => {
    // curl and other non-browser clients send none; Zotero's own gate handles
    // browser traffic before the endpoint is reached.
    assert.equal(isAllowedOrigin(undefined), true);
    assert.equal(isAllowedOrigin(null), true);
    assert.equal(isAllowedOrigin(''), true);
  });

  test('accepts every loopback spelling, with and without a port', () => {
    for (const origin of [
      'http://localhost',
      'http://localhost:23119',
      'https://localhost:3000',
      'http://127.0.0.1',
      'http://127.0.0.1:8080',
      'http://[::1]',
      'http://[::1]:23119',
    ]) {
      assert.equal(isAllowedOrigin(origin), true, `${origin} should be allowed`);
    }
  });

  test('is case-insensitive on the scheme and host', () => {
    assert.equal(isAllowedOrigin('HTTP://LOCALHOST:23119'), true);
  });

  test('rejects remote origins', () => {
    for (const origin of ['https://evil.example', 'http://192.168.1.10', 'https://zotero.org']) {
      assert.equal(isAllowedOrigin(origin), false, `${origin} should be rejected`);
    }
  });

  test('rejects hosts that merely embed a loopback name', () => {
    // The guard must anchor, or `localhost.evil.com` would pass as local.
    for (const origin of [
      'http://localhost.evil.example',
      'http://notlocalhost',
      'http://127.0.0.1.evil.example',
      'https://evil.example/?x=http://localhost',
    ]) {
      assert.equal(isAllowedOrigin(origin), false, `${origin} should be rejected`);
    }
  });

  test('rejects non-http schemes pointing at loopback', () => {
    assert.equal(isAllowedOrigin('file://localhost'), false);
    assert.equal(isAllowedOrigin('ws://localhost:23119'), false);
  });
});

describe('incomplete Server slot over MCP/REST tools', () => {
  test('returns a configuration error for semantic search without opening UI', async () => {
    installZoteroStub({ 'zotseek.embeddingModel': SERVER_SLOT_SELECTION_ID });
    await assert.rejects(
      runSearchTool({ query: 'test', mode: 'semantic' }),
      /model information is incomplete[\s\S]*zotseek-server-models\.json/,
    );
  });

  test('returns the same configuration error for find_similar', async () => {
    installZoteroStub({ 'zotseek.embeddingModel': SERVER_SLOT_SELECTION_ID });
    await assert.rejects(
      runFindSimilarTool({ item_key: 'ABCDEFGH' }),
      /Server \(NONE\).*restart Zotero/,
    );
  });
});

function result(overrides: Partial<ToolResultItem> = {}): ToolResultItem {
  return {
    itemKey: 'ABCDEFGH',
    libraryKey: 'user',
    title: 'Paper',
    score: 1,
    semanticScore: null,
    bm25Score: null,
    matchedChunk: null,
    metadata: {
      title: 'Paper',
      year: 2024,
      publicationTitle: 'Nature Communications',
      creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' }],
    },
    ...overrides,
  };
}

describe('search structured post-filter', () => {
  test('filters the existing ranked window without reordering it', () => {
    const ranked = [
      result({ itemKey: 'AAAAAAA1' }),
      result({
        itemKey: 'BBBBBBB2',
        metadata: {
          title: 'Older paper',
          year: 2019,
          bookTitle: 'Nature Handbook',
          creators: [{ creatorType: 'author', name: 'OpenAI Research' }],
        },
      }),
    ];
    assert.deepEqual(
      applySearchResultFilter(ranked, { year_from: 2020, journal: 'nature' })
        .map(item => item.itemKey),
      ['AAAAAAA1'],
    );
  });

  test('normalizes Unicode/case and supports full creator candidates', () => {
    assert.equal(applySearchResultFilter([result()], { author: 'LOVELACE, ADA', exact: true }).length, 1);
    assert.equal(applySearchResultFilter([result()], { journal: 'Nature', exact: true }).length, 0);
    assert.equal(applySearchResultFilter([result()], { journal: 'nature' }).length, 1);
  });

  test('rejects invalid ranges and empty text filters', () => {
    assert.throws(() => applySearchResultFilter([], { year_from: 2025, year_to: 2024 }), /must not exceed/);
    assert.throws(() => applySearchResultFilter([], { author: '   ' }), /non-empty/);
  });
});

describe('PDF page range grammar', () => {
  test('accepts one page or one continuous range', () => {
    assert.deepEqual(parsePdfPageRange('3'), [3]);
    assert.deepEqual(parsePdfPageRange('3-5'), [3, 4, 5]);
  });

  test('rejects invalid and oversized ranges', () => {
    for (const value of ['0', '-1', '5-3', '1,3', '1-21']) {
      assert.throws(() => parsePdfPageRange(value), /pdf_pages/);
    }
  });
});

describe('get_item normalized read contract', () => {
  test('returns complete unfiltered Child Note structure and a stable missing-PDF state', async () => {
    const zotero = installZoteroStub();
    const note = {
      id: 2,
      key: 'NOTEKEY1',
      isNote: () => true,
      getNoteTitle: () => '',
      getNote: () => '<h2>Basic Information</h2><p>DOI line</p><h2>References</h2><p>Reference A</p>',
    };
    const parent = {
      id: 1,
      key: 'PARENT01',
      libraryID: 1,
      itemType: 'journalArticle',
      isRegularItem: () => true,
      isNote: () => false,
      isAttachment: () => false,
      getField: (field: string) => ({
        title: 'Target paper',
        abstractNote: 'Full abstract',
        date: '2024-03-01',
        publicationTitle: 'Journal of Tests',
      } as Record<string, string>)[field] || '',
      getCreators: () => [{ creatorType: 'author', firstName: 'Ada', lastName: 'Lovelace' }],
      getTags: () => [{ tag: 'beta' }, { tag: 'alpha' }],
      getCollections: () => [],
      getAttachments: () => [],
      getNotes: () => [2],
      getBestAttachment: async () => null,
      relatedItems: [],
    };
    zotero.Libraries = { userLibraryID: 1 };
    zotero.Items = {
      get: (id: number) => id === 1 ? parent : id === 2 ? note : null,
      getByLibraryAndKey: (libraryId: number, key: string) =>
        libraryId === 1 && key === 'PARENT01' ? parent : null,
    };
    zotero.Collections = { get: () => null };
    zotero.ZoteroStyle = {
      data: {
        views: {
          localStorage: {
            cache: {},
            get: () => ({ sciif: '6.25', sci: 'Q2' }),
          },
        },
      },
    };

    const response = await runGetItemTool({
      item_key: 'parent01',
      include_notes: true,
      include_pdf: 'pages',
      pdf_pages: '1',
    });
    assert.equal(response.metadata.abstractNote, 'Full abstract');
    assert.deepEqual(response.journalMetrics, {
      provider: 'zotero-style',
      impactFactor: 6.25,
      sciQuartile: 'Q2',
    });
    assert.deepEqual(response.tags, ['alpha', 'beta']);
    assert.equal(response.notes?.[0].text.includes('Reference A'), true);
    assert.deepEqual(response.notes?.[0].sectionPaths, [
      ['Basic Information'],
      ['References'],
    ]);
    assert.equal(response.pdf?.status, 'missing');
  });

  test('uses only an explicitly validated PDF child key for exact links', async () => {
    const zotero = installZoteroStub();
    const pdf = {
      id: 10,
      key: 'PDF00001',
      libraryID: 1,
      parentID: 1,
      attachmentContentType: 'application/pdf',
      attachmentFilename: 'paper.pdf',
      isAttachment: () => true,
      isPDFAttachment: () => true,
    };
    const otherPdf = {
      ...pdf,
      id: 11,
      key: 'PDF00002',
      parentID: 99,
    };
    const parent = {
      id: 1,
      key: 'PARENT01',
      libraryID: 1,
      itemType: 'journalArticle',
      isRegularItem: () => true,
      isNote: () => false,
      isAttachment: () => false,
      getField: (field: string) => field === 'title' ? 'Target paper' : '',
      getCreators: () => [],
      getTags: () => [],
      getCollections: () => [],
      getAttachments: () => [10],
      getNotes: () => [],
      getBestAttachment: async () => {
        throw new Error('exact key must bypass best-attachment selection');
      },
      relatedItems: [],
    };
    zotero.Libraries = { userLibraryID: 1 };
    zotero.Server = { port: 23119 };
    zotero.Items = {
      get: (id: number) => id === 1 ? parent : id === 10 ? pdf : id === 11 ? otherPdf : null,
      getByLibraryAndKey: (libraryId: number, key: string) => {
        if (libraryId !== 1) return null;
        if (key === 'PARENT01') return parent;
        if (key === 'PDF00001') return pdf;
        if (key === 'PDF00002') return otherPdf;
        return null;
      },
    };
    zotero.Collections = { get: () => null };

    const response = await runGetItemTool({
      item_key: 'PARENT01',
      pdf_attachment_key: 'PDF00001',
    });
    assert.equal(response.links?.openPdf, 'zotero://open-pdf/library/items/PDF00001');

    await assert.rejects(
      runGetItemTool({ item_key: 'PARENT01', pdf_attachment_key: 'PDF00002' }),
      /must identify a PDF attachment belonging to the requested parent/,
    );
  });

  test('applies the shared full-PDF limits to get_item server reads', async () => {
    const zotero = installZoteroStub();
    const calls: number[][] = [];
    const pdf = {
      id: 10,
      key: 'PDF00001',
      libraryID: 1,
      parentID: 1,
      attachmentContentType: 'application/pdf',
      attachmentFilename: 'paper.pdf',
      isAttachment: () => true,
      isPDFAttachment: () => true,
    };
    const parent = {
      id: 1,
      key: 'PARENT01',
      libraryID: 1,
      itemType: 'journalArticle',
      isRegularItem: () => true,
      isNote: () => false,
      isAttachment: () => false,
      getField: (field: string) => field === 'title' ? 'Long paper' : '',
      getCreators: () => [],
      getTags: () => [],
      getCollections: () => [],
      getAttachments: () => [10],
      getNotes: () => [],
      relatedItems: [],
    };
    zotero.Libraries = { userLibraryID: 1 };
    zotero.Items = {
      get: (id: number) => id === 1 ? parent : id === 10 ? pdf : null,
      getByLibraryAndKey: (libraryId: number, key: string) => {
        if (libraryId !== 1) return null;
        if (key === 'PARENT01') return parent;
        if (key === 'PDF00001') return pdf;
        return null;
      },
    };
    zotero.Collections = { get: () => null };
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

    const response = await runGetItemTool({
      item_key: 'PARENT01',
      pdf_attachment_key: 'PDF00001',
      include_pdf: 'full',
    });
    assert.deepEqual(GET_ITEM_PDF_FULL_READ_LIMITS, {
      batchPages: 20,
      maxPages: 100,
      maxCharacters: 300_000,
    });
    assert.equal(response.pdf?.status, 'partial');
    assert.equal(response.pdf?.limitReason, 'page_limit');
    assert.equal(response.pdf?.nextPage, 101);
    assert.equal(response.pdf?.pages.length, 100);
    assert.equal(calls.length, 5);
  });

  test('returns only the detected reference-list pages from a bounded tail scan', async () => {
    const zotero = installZoteroStub();
    const calls: number[][] = [];
    const pdf = {
      id: 10,
      key: 'PDF00001',
      libraryID: 1,
      parentID: 1,
      attachmentContentType: 'application/pdf',
      attachmentFilename: 'paper.pdf',
      isAttachment: () => true,
      isPDFAttachment: () => true,
    };
    const parent = {
      id: 1,
      key: 'PARENT01',
      libraryID: 1,
      itemType: 'journalArticle',
      isRegularItem: () => true,
      isNote: () => false,
      isAttachment: () => false,
      getField: (field: string) => field === 'title' ? 'Paper with references' : '',
      getCreators: () => [],
      getTags: () => [],
      getCollections: () => [],
      getAttachments: () => [10],
      getNotes: () => [],
      relatedItems: [],
    };
    zotero.Libraries = { userLibraryID: 1 };
    zotero.Items = {
      get: (id: number) => id === 1 ? parent : id === 10 ? pdf : null,
      getByLibraryAndKey: (libraryId: number, key: string) => {
        if (libraryId !== 1) return null;
        if (key === 'PARENT01') return parent;
        if (key === 'PDF00001') return pdf;
        return null;
      },
    };
    zotero.Collections = { get: () => null };
    zotero.Fulltext = {
      getPages: async () => ({ indexedPages: 0, total: 30 }),
      getItemCacheFile: () => ({ path: 'missing', exists: () => false }),
    };
    const textForPage = (physicalPage: number) => {
      if (physicalPage === 25) {
        return 'References\n[1] Smith, A. (2021). Journal 2(1), 10-20. doi:10.1000/one';
      }
      if (physicalPage === 26) return '[2] Jones, B. (2022). University Press.';
      if (physicalPage === 29) return 'Acknowledgements\nThanks to the participants.';
      if (physicalPage >= 27) return '';
      return `Body page ${physicalPage}`;
    };
    zotero.PDFWorker = {
      getFullText: async (_id: number, pages: number[]) => {
        calls.push(pages);
        return {
          totalPages: 30,
          text: pages.map(page => textForPage(page + 1)).join('\f'),
          extractedPages: pages.length,
        };
      },
    };

    const response = await runGetItemTool({
      item_key: 'PARENT01',
      pdf_attachment_key: 'PDF00001',
      include_pdf: 'references',
    });

    assert.equal(response.pdf?.status, 'ok');
    assert.deepEqual(response.pdf?.pages.map(page => page.page), [25, 26]);
    assert.match(response.pdf?.pages[0].text || '', /^References/);
    assert.equal(response.pdf?.pages.some(page => page.text.includes('Body page')), false);
    assert.deepEqual(response.pdf?.referenceDetection && {
      from: response.pdf.referenceDetection.scannedFromPage,
      to: response.pdf.referenceDetection.scannedToPage,
    }, { from: 11, to: 30 });
    assert.equal(calls.length, 2);
  });

  test('matches one complete Unicode-normalized tag with case preserved', () => {
    const tagged = result() as ToolResultItem & { tags: string[] };
    tagged.tags = ['Méthodes', 'Review'];
    assert.equal(applySearchResultFilter([tagged], { tag: 'Méthodes' }).length, 1);
    assert.equal(applySearchResultFilter([tagged], { tag: 'review' }).length, 0);
    assert.equal(applySearchResultFilter([tagged], { tag: 'Rev' }).length, 0);
  });
});

describe('library map and collection scope', () => {
  test('builds every collection into a deterministic nested tree', () => {
    const tree = buildLibraryCollectionTree([
      { id: 3, key: 'CHILD002', name: 'Beta', libraryID: 1, parentID: 1 },
      { id: 1, key: 'ROOT0001', name: 'Root', libraryID: 1 },
      { id: 4, key: 'ROOT0002', name: 'Another root', libraryID: 1 },
      { id: 2, key: 'CHILD001', name: 'Alpha', libraryID: 1, parentKey: 'ROOT0001' },
    ], 1);
    assert.deepEqual(tree, [
      { collectionKey: 'ROOT0002', name: 'Another root', children: [] },
      {
        collectionKey: 'ROOT0001', name: 'Root', children: [
          { collectionKey: 'CHILD001', name: 'Alpha', children: [] },
          { collectionKey: 'CHILD002', name: 'Beta', children: [] },
        ],
      },
    ]);
  });

  test('rejects missing parents and cycles instead of returning a partial map', () => {
    assert.throws(() => buildLibraryCollectionTree([
      { id: 1, key: 'ROOT0001', name: 'Broken', libraryID: 1, parentID: 99 },
    ], 1), /missing parent/);
    assert.throws(() => buildLibraryCollectionTree([
      { id: 1, key: 'ROOT0001', name: 'One', libraryID: 1, parentID: 2 },
      { id: 2, key: 'ROOT0002', name: 'Two', libraryID: 1, parentID: 1 },
    ], 1), /cycle/);
  });

  test('returns a live library name and complete collection tree', async () => {
    const zotero = installZoteroStub();
    zotero.Libraries = {
      userLibraryID: 1,
      get: () => ({ libraryType: 'user', name: 'Personal Library' }),
    };
    zotero.Collections = {
      getByLibrary: () => [{ id: 1, key: 'ROOT0001', name: 'Root', libraryID: 1 }],
    };
    assert.deepEqual(await runGetLibraryMapTool({}), {
      libraryKey: 'user',
      name: 'Personal Library',
      collections: [{ collectionKey: 'ROOT0001', name: 'Root', children: [] }],
    });
  });

  test('canonicalizes a valid group library identity in map output', async () => {
    const zotero = installZoteroStub();
    zotero.Groups = { getLibraryIDFromGroupID: (groupId: number) => groupId === 42 ? 7 : false };
    zotero.Libraries = { userLibraryID: 1, get: () => ({ name: 'Research Group' }) };
    zotero.Collections = { getByLibrary: () => [] };
    assert.deepEqual(await runGetLibraryMapTool({ library_key: 'group: 42' }), {
      libraryKey: 'group:42', name: 'Research Group', collections: [],
    });
  });
});

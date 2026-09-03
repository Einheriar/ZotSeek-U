import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
// http-tools pulls in the search engine and the embedding pipeline, which touch
// the Zotero global while their module bodies are evaluated. This import
// installs the stub as a side effect and MUST stay above the one below: import
// hoisting means a function call here would run too late.
import { installZoteroStub } from './helpers/zotero-stub';
import {
  applySearchResultFilter,
  isAllowedOrigin,
  parsePdfPageRange,
  runFindSimilarTool,
  runGetItemTool,
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

    const response = await runGetItemTool({
      item_key: 'parent01',
      include_notes: true,
      include_pdf: 'pages',
      pdf_pages: '1',
    });
    assert.equal(response.metadata.abstractNote, 'Full abstract');
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
});

import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  PDF_PAGE_FURNITURE_STRATEGY_ID,
  PDF_REFERENCE_REGION_STRATEGY_ID,
  assertPdfReferencePipelineModes,
  extractPdfReferencePages,
  preprocessPdfPages,
} from '../src/utils/pdf-preprocessor';
import type { PageText } from '../src/utils/chunker';

function page(pageNumber: number, lines: string[]): PageText {
  return { pageNumber, text: lines.join('\n') };
}

function bandPage(pageNumber: number, first: string, last = `unique footer ${pageNumber}`): PageText {
  return page(pageNumber, [
    first,
    `ordinary body A for physical page ${pageNumber}`,
    `ordinary body B for physical page ${pageNumber}`,
    `ordinary body C for physical page ${pageNumber}`,
    `ordinary body D for physical page ${pageNumber}`,
    `ordinary body E for physical page ${pageNumber}`,
    last,
  ]);
}

describe('PDF main-text preprocessor', () => {
  test('rejects References v2 plus legacy chunker filtering', () => {
    assert.throws(
      () => assertPdfReferencePipelineModes('v2', 'legacy'),
      /requires pdfReferenceFiltering=off/,
    );
    assert.doesNotThrow(() => assertPdfReferencePipelineModes('v2', 'off'));
    assert.doesNotThrow(() => assertPdfReferencePipelineModes('off', 'legacy'));
  });

  test('runs References v2 by default and preserves visible block joining semantics', () => {
    const pages = [
      page(1, ['Article title', '', 'Abstract body']),
      page(2, ['Methods', '', 'Ordinary DOI 10.1234/body remains in the article']),
      page(3, ['Results', 'Body evidence']),
      page(4, ['Discussion', 'Body conclusion']),
      page(5, [
        'References',
        '[1] Smith, A. (2021). Journal 2(1), 10-20. doi:10.1000/one',
        '[2] Jones, B. (2022). University Press.',
      ]),
      page(6, ['Acknowledgements', 'Thanks to the participants.']),
    ];
    const before = JSON.stringify(pages);
    const result = preprocessPdfPages(pages, { pdfPageFurnitureFiltering: 'off' });

    assert.equal(result.diagnostics.referenceMode, 'v2');
    assert.equal(result.diagnostics.referenceRegionCount, 1);
    assert.equal(result.pages[0].text, 'Article title\nAbstract body');
    assert.equal(result.pages[4].text, '');
    assert.equal(result.pages[5].text, 'Acknowledgements\nThanks to the participants.');
    assert.match(result.pages[1].text, /10\.1234\/body/);
    assert.ok(result.ignoredBlocks.some(block => block.role === 'reference-heading'));
    assert.ok(result.ignoredBlocks.every(block => block.strategyId === PDF_REFERENCE_REGION_STRATEGY_ID));
    assert.equal(JSON.stringify(pages), before);
    assert.deepEqual(result.pages.map(item => item.pageNumber), [1, 2, 3, 4, 5, 6]);
  });

  test('returns the inverse page-aligned References v2 view for explicit reads', () => {
    const result = extractPdfReferencePages([
      page(21, ['Discussion', 'Body conclusion']),
      page(22, [
        'References',
        '[1] Smith, A. (2021). Journal 2(1), 10-20. doi:10.1000/one',
      ]),
      page(23, ['[2] Jones, B. (2022). University Press.']),
      page(24, ['Acknowledgements', 'Thanks to the participants.']),
    ]);

    assert.equal(result.regions.length, 1);
    assert.deepEqual(result.pages, [
      page(22, [
        'References',
        '[1] Smith, A. (2021). Journal 2(1), 10-20. doi:10.1000/one',
      ]),
      page(23, ['[2] Jones, B. (2022). University Press.']),
    ]);
  });

  test('does not invent a reference list when References v2 has no reliable heading', () => {
    const result = extractPdfReferencePages([
      page(1, ['Body cites Smith (2021) and includes doi:10.1000/body.']),
      page(2, ['Discussion of references in ordinary prose.']),
    ]);
    assert.deepEqual(result, { pages: [], regions: [] });
  });

  test('keeps References content byte-for-byte when the component is explicitly off', () => {
    const pages = [
      page(1, ['Body']),
      page(2, ['References', '[1] Smith (2020). doi:10.1000/example']),
    ];
    const result = preprocessPdfPages(pages, {
      pdfReferenceRegionFiltering: 'off',
      pdfPageFurnitureFiltering: 'off',
    });

    assert.deepEqual(result.pages, pages);
    assert.equal(result.ignoredBlocks.length, 0);
    assert.equal(result.diagnostics.referenceRegionCount, 0);
  });

  test('runs F v1 by default, preserves page one text, and reproduces the accepted-risk group ID', () => {
    const pages = [3, 4, 5, 7, 9].map(pageNumber => bandPage(
      pageNumber,
      pageNumber === 4
        ? 'Parent–child interbrain synchrony'
        : 'PARENT–CHILD INTERBRAIN SYNCHRONY',
    ));
    const result = preprocessPdfPages(pages, {
      documentKey: 'UVMK4XCF',
      pdfReferenceRegionFiltering: 'off',
    });
    const group = result.diagnostics.pageFurnitureGroups.find(item =>
      item.signature === 'parent–child interbrain synchrony'
    );

    assert.equal(group?.groupId, '0f4c49f26243bd04');
    assert.equal(group?.ignoredByDefault, true);
    assert.equal(result.diagnostics.ignoredPageFurnitureLineCount, 5);
    assert.ok(result.pages.every(item => !/interbrain synchrony/i.test(item.text)));
    assert.ok(result.ignoredBlocks.every(block => block.strategyId === PDF_PAGE_FURNITURE_STRATEGY_ID));
  });

  test('protects repeated table headers and verified page slots', () => {
    const pages = [2, 3, 4, 5].map(pageNumber => page(pageNumber, [
      'Table 2',
      'Author (year) Study design N',
      `row A ${pageNumber}`,
      `row B ${pageNumber}`,
      `row C ${pageNumber}`,
      `row D ${pageNumber}`,
      `unique footer ${pageNumber}`,
    ]));
    const result = preprocessPdfPages(pages, {
      documentKey: 'TABLE',
      pdfReferenceRegionFiltering: 'off',
    });
    const tableGroup = result.diagnostics.pageFurnitureGroups.find(item =>
      item.signature === 'author (year) study design n'
    );

    assert.equal(tableGroup?.ignoredByDefault, false);
    assert.equal(tableGroup?.decisionReason, 'table-context-protected');
    assert.ok(result.pages.every(item => item.text.includes('Author (year) Study design N')));
    assert.equal(result.diagnostics.pageSlotsPreserved, true);
  });

  test('supports independent F off and is idempotent on already processed pages', () => {
    const pages = [1, 2, 3, 4].map(pageNumber => bandPage(
      pageNumber,
      'REPEATED JOURNAL HEADER',
    ));
    const off = preprocessPdfPages(pages, {
      pdfReferenceRegionFiltering: 'off',
      pdfPageFurnitureFiltering: 'off',
    });
    const first = preprocessPdfPages(pages, {
      documentKey: 'HEADER',
      pdfReferenceRegionFiltering: 'off',
    });
    const second = preprocessPdfPages(first.pages, {
      documentKey: 'HEADER',
      pdfReferenceRegionFiltering: 'off',
    });

    assert.deepEqual(off.pages, pages);
    assert.match(first.pages[0].text, /REPEATED JOURNAL HEADER/);
    assert.ok(first.pages.slice(1).every(item => !item.text.includes('REPEATED JOURNAL HEADER')));
    assert.deepEqual(
      second.pages.map(item => ({ pageNumber: item.pageNumber, text: item.text })),
      first.pages.map(item => ({ pageNumber: item.pageNumber, text: item.text })),
    );
  });

  test('is deterministic for the same raw input', () => {
    const pages = [1, 2, 3, 4].map(pageNumber => bandPage(
      pageNumber,
      'REPEATED RUNNING HEADER',
    ));
    const options = { documentKey: 'DETERMINISTIC' } as const;

    assert.deepEqual(preprocessPdfPages(pages, options), preprocessPdfPages(pages, options));
  });
});

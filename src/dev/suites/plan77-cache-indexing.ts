import { selfTest, scenario, assertEq, assertTrue } from '../self-test';

declare const Zotero: any;
declare const IOUtils: any;
declare const PathUtils: any;

const OCR_SOURCE = 'zotero-fulltext-cache';

async function loadPlan77Files(): Promise<{ request: any; fixture: any }> {
  const requestPath = PathUtils.join(Zotero.Profile.dir, 'plan77-request.json');
  const request = JSON.parse(await IOUtils.readUTF8(requestPath));
  if (request.syncDisabled !== true || request.cloudDisabled !== true || request.httpPort !== 23177) {
    throw new Error('Plan 77 runtime safety flags or port are not enabled');
  }
  if (Zotero.DataDirectory.dir !== request.dataDir) {
    throw new Error('Plan 77 suite is running against the wrong Zotero data directory');
  }
  const fixture = JSON.parse(await IOUtils.readUTF8(PathUtils.join(request.base, 'fixture.json')));
  return { request, fixture };
}

async function searchItemChunks(query: string, itemKey: string): Promise<any[]> {
  const results = await Zotero.ZotSeek.api.search(query, {
    topK: 100,
    minSimilarity: -1,
    returnAllChunks: true,
  });
  return results.filter((result: any) => result.itemKey === itemKey);
}

function assertOcrPagesPresent(results: any[], fixture: any): void {
  for (const [page, marker] of [
    [2, 'PLAN77_OCR_PAGE_TWO_CANARY'],
    [3, 'PLAN77_OCR_PAGE_THREE_CANARY'],
  ] as Array<[number, string]>) {
    assertTrue(results.some(result => result.pageNumber === page &&
      result.pdfAttachmentKey === fixture.pdfAttachmentKey &&
      String(result.chunkText || '').includes(marker)),
    `OCR marker ${marker} was not indexed with PDF page ${page} and the exact attachment key`);
  }
}

async function waitForHttpProbe(request: any): Promise<any> {
  const readyPath = PathUtils.join(request.base, 'http-ready.json');
  const resultsPath = PathUtils.join(request.base, 'http-results.json');
  const fixture = JSON.parse(await IOUtils.readUTF8(PathUtils.join(request.base, 'fixture.json')));
  await IOUtils.writeUTF8(readyPath, JSON.stringify({
    port: request.httpPort,
    libraryKey: 'user',
    itemKey: fixture.itemKey,
    pdfAttachmentKey: fixture.pdfAttachmentKey,
    pdfTextSource: OCR_SOURCE,
  }));
  const deadline = Date.now() + 300000;
  while (Date.now() < deadline && !(await IOUtils.exists(resultsPath))) {
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assertTrue(await IOUtils.exists(resultsPath), 'external Plan 77 HTTP/MCP probe did not finish');
  return JSON.parse(await IOUtils.readUTF8(resultsPath));
}

selfTest.register('plan77-cache-indexing', async () => {
  const { request, fixture } = await loadPlan77Files();
  const api = Zotero.ZotSeek?.api;
  const scenarios = [];

  if (request.stage === 2) {
    scenarios.push(await scenario('cache failure reason and previous OCR chunks survive a Zotero restart', async () => {
      const status = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
      assertTrue(status.indexed, 'previous cache-based index is no longer available');
      assertTrue(status.chunkCount > 0, 'previous cache-based chunks were removed');
      assertEq(status.pdfAttachmentKey, fixture.pdfAttachmentKey, 'previous PDF source was not preserved');
      assertEq(status.lastAttempt?.outcome, 'failed', 'latest failed cache attempt did not persist');
      assertEq(status.lastAttempt?.pdfTextSource, OCR_SOURCE, 'failed source parameter did not persist');
      assertEq(status.lastAttempt?.reason?.code, 'pdf_cache_unavailable', 'cache-missing failure reason did not persist');
      assertEq(status.lastPdfAttempt?.pdfTextSource, OCR_SOURCE, 'latest PDF diagnostic lost the cache source');
      assertOcrPagesPresent(
        await searchItemChunks('PLAN77_OCR_PAGE_TWO_CANARY', fixture.itemKey),
        fixture,
      );
      assertTrue(!(await IOUtils.exists(fixture.cachePath)), 'synthetic cache unexpectedly reappeared after restart');
    }));
    return scenarios;
  }

  scenarios.push(await scenario('PDFWorker contains only cover text while Zotero cache holds three OCR pages', async () => {
    const audit = JSON.parse(await IOUtils.readUTF8(PathUtils.join(request.base, 'cache-seed-audit.json')));
    assertEq(audit.pdfWorkerPages.length, 3, 'PDFWorker probe did not cover all physical pages');
    assertTrue(audit.pdfWorkerPages[0].text.includes('COVER_VISIBLE_CANARY'), 'PDFWorker did not read the synthetic cover text');
    assertTrue(audit.pdfWorkerPages.slice(1).every((page: any) => !page.text.includes('PLAN77_OCR_PAGE_')),
      'OCR-only page marker leaked into PDFWorker text');
    assertEq(audit.ocrCache.indexedPages, 3, 'Zotero Fulltext row does not record three indexed pages');
    assertEq(audit.ocrCache.totalPages, 3, 'Zotero Fulltext row does not record three total pages');
    assertEq(audit.ocrCache.cachePageCount, 3, '.zotero-ft-cache does not contain three physical pages');
    assertEq(audit.ocrCache.processed, true, 'Zotero Fulltext cache writer did not process the synthetic OCR payload');
    assertEq(fixture.pdfTotalPages, 3, 'fixture physical page count is not three');
  }));

  scenarios.push(await scenario('JavaScript API indexes OCR-only cache text with physical page and PDF provenance', async () => {
    const result = await api.indexItem({
      libraryKey: fixture.libraryKey,
      itemKey: fixture.itemKey,
      force: true,
      pdfAttachmentKey: fixture.pdfAttachmentKey,
      pdfTextSource: OCR_SOURCE,
    });
    assertTrue(['indexed', 'updated'].includes(result.outcome),
      `Cache-source index failed: ${JSON.stringify(result)}`);
    assertEq(result.pdfTextSource, OCR_SOURCE, 'API result omitted the one-call source parameter');
    assertEq(result.pdfDiagnostic?.textSource, OCR_SOURCE, 'PDF diagnostic did not report the cache source');
    const status = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    assertEq(status.pdfAttachmentKey, fixture.pdfAttachmentKey, 'indexed chunks did not keep the requested attachment');
    assertEq(status.lastAttempt?.pdfTextSource, OCR_SOURCE, 'cache source was not saved in attempt history');
    assertTrue(status.pagesIndexed >= 3, `Expected OCR chunks on all three pages; got ${status.pagesIndexed}`);
    assertOcrPagesPresent(await searchItemChunks('PLAN77_OCR_PAGE_TWO_CANARY', fixture.itemKey), fixture);
    assertOcrPagesPresent(await searchItemChunks('PLAN77_OCR_PAGE_THREE_CANARY', fixture.itemKey), fixture);
  }));

  scenarios.push(await scenario('omitting pdfTextSource keeps the PDFWorker default', async () => {
    const result = await api.indexItem({
      libraryKey: fixture.libraryKey,
      itemKey: fixture.itemKey,
      force: true,
      pdfAttachmentKey: fixture.pdfAttachmentKey,
    });
    assertTrue(['indexed', 'updated'].includes(result.outcome), `Default PDFWorker request failed: ${JSON.stringify(result)}`);
    assertEq(result.pdfDiagnostic?.textSource, 'pdfworker', 'omitted source did not use PDFWorker');
    const current = await searchItemChunks('PLAN77_OCR_PAGE_TWO_CANARY', fixture.itemKey);
    assertTrue(!current.some(result => String(result.chunkText || '').includes('PLAN77_OCR_PAGE_TWO_CANARY')),
      'default PDFWorker indexing included cache-only OCR text');
  }));

  scenarios.push(await scenario('REST and MCP accept the explicit cache source, including MCP version info', async () => {
    const result = await api.indexItem({
      libraryKey: fixture.libraryKey,
      itemKey: fixture.itemKey,
      force: true,
      pdfAttachmentKey: fixture.pdfAttachmentKey,
      pdfTextSource: OCR_SOURCE,
    });
    assertTrue(['indexed', 'updated'].includes(result.outcome), 'could not restore cache-source index before HTTP checks');
    assertOcrPagesPresent(await searchItemChunks('PLAN77_OCR_PAGE_TWO_CANARY', fixture.itemKey), fixture);
    const http = await waitForHttpProbe(request);
    assertTrue(!http.error, `HTTP/MCP probe failed during ${http.phase}: ${http.error || ''}`);
    assertEq(http.rest?.post?.status, 200, 'REST cache-source POST did not return 200');
    assertEq(http.rest?.post?.payload?.pdfTextSource, OCR_SOURCE, 'REST result lost pdfTextSource');
    assertEq(http.rest?.get?.status, 200, 'REST status GET did not return 200');
    assertEq(http.rest?.get?.payload?.lastAttempt?.pdfTextSource, OCR_SOURCE, 'REST status did not expose cached source');
    assertEq(http.mcp?.initialize?.status, 200, 'MCP initialize did not return 200');
    assertEq(http.mcp?.initialize?.payload?.serverInfo?.version, request.expectedPluginVersion,
      'MCP initialize serverInfo version does not match v0.2.7');
    assertEq(http.mcp?.initialize?.payload?.serverInfo?.name, 'zotseek', 'MCP initialize serverInfo name is wrong');
    assertEq(http.mcp?.toolsList?.status, 200, 'MCP tools/list did not return 200');
    const indexTool = http.mcp?.toolsList?.payload?.tools?.find((tool: any) => tool.name === 'index_item');
    assertTrue(indexTool?.inputSchema?.properties?.pdf_text_source?.enum?.includes(OCR_SOURCE),
      'MCP index_item schema omitted zotero-fulltext-cache');
    assertEq(http.mcp?.indexItem?.status, 200, 'MCP cache-source index_item did not return 200');
    assertEq(http.mcp?.indexItem?.payload?.pdfDiagnostic?.textSource, OCR_SOURCE,
      'MCP cache-source result reported the wrong source');
    assertEq(http.mcp?.itemStatus?.status, 200, 'MCP get_item_index_status did not return 200');
    assertEq(http.mcp?.itemStatus?.payload?.lastAttempt?.pdfTextSource, OCR_SOURCE,
      'MCP status did not expose the cached source');
  }));

  scenarios.push(await scenario('invalid page boundaries fail without replacing existing OCR chunks', async () => {
    const before = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    await Zotero.File.putContentsAsync(fixture.cachePath, 'PLAN77_INVALID_CACHE_WITHOUT_PAGE_BOUNDARIES');
    const result = await api.indexItem({
      libraryKey: fixture.libraryKey,
      itemKey: fixture.itemKey,
      force: true,
      pdfAttachmentKey: fixture.pdfAttachmentKey,
      pdfTextSource: OCR_SOURCE,
    });
    assertEq(result.outcome, 'failed', 'invalid cache boundaries were accepted');
    assertEq(result.reason?.code, 'pdf_cache_invalid', 'invalid cache failure reason was not specific');
    const after = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    assertEq(after.chunkCount, before.chunkCount, 'invalid cache failure changed prior chunk count');
    assertEq(after.pdfAttachmentKey, fixture.pdfAttachmentKey, 'invalid cache failure changed prior PDF provenance');
    assertOcrPagesPresent(await searchItemChunks('PLAN77_OCR_PAGE_TWO_CANARY', fixture.itemKey), fixture);
  }));

  scenarios.push(await scenario('missing cache fails and preserves the last successful OCR index', async () => {
    const before = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    await IOUtils.remove(fixture.cachePath);
    const result = await api.indexItem({
      libraryKey: fixture.libraryKey,
      itemKey: fixture.itemKey,
      force: true,
      pdfAttachmentKey: fixture.pdfAttachmentKey,
      pdfTextSource: OCR_SOURCE,
    });
    assertEq(result.outcome, 'failed', 'missing cache did not fail');
    assertEq(result.reason?.code, 'pdf_cache_unavailable', 'missing cache failure reason was not specific');
    const after = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    assertEq(after.chunkCount, before.chunkCount, 'missing cache failure changed prior chunk count');
    assertEq(after.pdfAttachmentKey, fixture.pdfAttachmentKey, 'missing cache failure changed prior PDF provenance');
    assertEq(after.lastAttempt?.pdfTextSource, OCR_SOURCE, 'failed cache source was not saved');
    assertOcrPagesPresent(await searchItemChunks('PLAN77_OCR_PAGE_TWO_CANARY', fixture.itemKey), fixture);
  }));

  return scenarios;
});

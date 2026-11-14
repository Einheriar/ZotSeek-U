import { selfTest, scenario, assertEq, assertTrue } from '../self-test';
import { PDF_SOURCES } from '../../core/search-policy';

declare const Zotero: any;
declare const IOUtils: any;
declare const PathUtils: any;

async function loadFixture(): Promise<any> {
  const requestPath = PathUtils.join(Zotero.Profile.dir, 'plan76-request.json');
  const fixturePath = PathUtils.join(JSON.parse(await IOUtils.readUTF8(requestPath)).base, 'fixture.json');
  const fixture = JSON.parse(await IOUtils.readUTF8(fixturePath));
  const request = JSON.parse(await IOUtils.readUTF8(requestPath));
  if (request.cloudDisabled !== true || request.syncDisabled !== true) {
    throw new Error('Plan 76 runtime safety flags are not enabled');
  }
  if (Zotero.DataDirectory.dir !== request.dataDir) {
    throw new Error('Plan 76 suite is running against the wrong Zotero data directory');
  }
  return fixture;
}

selfTest.register('plan76-item-indexing', async () => {
  const fixture = await loadFixture();
  const [pdfOne, pdfTwo] = fixture.pdfAttachmentKeys;
  const api = Zotero.ZotSeek?.api;
  const scenarios = [];

  scenarios.push(await scenario('PDFWorker returns synthetic text from both attached PDFs', async () => {
    const requestPath = PathUtils.join(Zotero.Profile.dir, 'plan76-request.json');
    const request = JSON.parse(await IOUtils.readUTF8(requestPath));
    const probe = JSON.parse(await IOUtils.readUTF8(PathUtils.join(request.base, 'pdfworker-probe.json')));
    assertTrue(probe.one?.textLength > 100, `PDFWorker one: ${JSON.stringify(probe.one)}`);
    assertTrue(probe.two?.textLength > 100, `PDFWorker two: ${JSON.stringify(probe.two)}`);
  }));

  scenarios.push(await scenario('real REST POST, GET and MCP tools/list use the isolated HTTP server', async () => {
    const requestPath = PathUtils.join(Zotero.Profile.dir, 'plan76-request.json');
    const request = JSON.parse(await IOUtils.readUTF8(requestPath));
    const readyPath = PathUtils.join(request.base, 'http-ready.json');
    const resultPath = PathUtils.join(request.base, 'http-results.json');
    assertEq(Zotero.Server?.port, 23176, 'runtime HTTP server is not on the isolated port');
    await IOUtils.writeUTF8(readyPath, JSON.stringify({
      port: Zotero.Server?.port,
      libraryKey: fixture.libraryKey,
      itemKey: fixture.itemKey,
      pdfAttachmentKey: pdfOne,
    }));
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline && !(await IOUtils.exists(resultPath))) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assertTrue(await IOUtils.exists(resultPath), 'external HTTP probe did not finish');
    const result = JSON.parse(await IOUtils.readUTF8(resultPath));
    assertTrue(!result.error, `external HTTP probe failed: ${result.error || ''}`);
    assertEq(result.post?.status, 200, 'REST POST did not return 200');
    assertTrue(['indexed', 'updated'].includes(result.post?.payload?.outcome), 'REST POST did not index the item');
    assertEq(result.get?.status, 200, 'REST GET did not return 200');
    assertEq(result.get?.payload?.pdfAttachmentKey, pdfOne, 'REST GET did not report the selected PDF source');
    assertTrue(result.mcp?.toolNames?.includes('index_item'), 'MCP tools/list omitted index_item');
    assertTrue(result.mcp?.toolNames?.includes('get_item_index_status'), 'MCP tools/list omitted get_item_index_status');
    assertEq(result.mcp?.indexItem?.outcome, 'unchanged', 'MCP index_item did not return unchanged');
    assertEq(result.mcp?.itemStatus?.pdfAttachmentKey, pdfOne, 'MCP status did not report the selected PDF source');
  }));

  scenarios.push(await scenario('selected PDF one indexes with real SQLite and local embedding', async () => {
    assertEq(Zotero.Prefs.get('zotseek.indexingMode', true), 'full', 'runtime must use Full mode');
    assertEq(Zotero.Prefs.get('zotseek.embeddingModel', true), 'multilingual-e5-base', 'runtime must use bundled local E5');
    assertTrue(typeof api?.indexItem === 'function', 'indexItem API is unavailable');
    assertTrue(typeof api?.getItemIndexStatus === 'function', 'getItemIndexStatus API is unavailable');
    const result = await api.indexItem({
      libraryKey: fixture.libraryKey,
      itemKey: fixture.itemKey,
      force: true,
      pdfAttachmentKey: pdfOne,
    });
    assertTrue(['indexed', 'updated'].includes(result.outcome),
      `Unexpected forced outcome: ${result.outcome}; PDF=${JSON.stringify(result.pdfDiagnostic)}; attempt=${JSON.stringify(result.reason)}`);
    assertEq(result.pdfAttachmentKey, pdfOne, 'request PDF key was not reported');
    const status = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    assertEq(status.pdfAttachmentKey, pdfOne, 'chunks did not retain the selected PDF key');
    assertTrue(status.chunkCount > 0, 'successful PDF indexing produced no chunks');
    assertTrue(status.pagesIndexed > 0, 'successful PDF indexing produced no physical pages');
    assertTrue(status.sources.some((source: string) => PDF_SOURCES.includes(source as any)), 'status did not report PDF text chunks');
    assertEq(status.lastAttempt?.outcome, result.outcome, 'latest attempt was not persisted');
  }));

  scenarios.push(await scenario('ordinary call reports unchanged and does not revalidate the PDF', async () => {
    const result = await api.indexItem({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    assertEq(result.outcome, 'unchanged', 'unchanged indexed item was unexpectedly rebuilt');
    const status = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    assertEq(status.pdfAttachmentKey, pdfOne, 'ordinary call changed the prior PDF source');
    assertEq(status.lastPdfAttempt?.pdfAttachmentKey, pdfOne, 'ordinary call overwrote PDF attempt history');
  }));

  scenarios.push(await scenario('one-call PDF selection switches to the second attached version', async () => {
    const result = await api.indexItem({
      libraryKey: fixture.libraryKey,
      itemKey: fixture.itemKey,
      pdfAttachmentKey: pdfTwo,
    });
    assertTrue(['indexed', 'updated'].includes(result.outcome), `Explicit second PDF failed: ${result.outcome}`);
    assertEq(result.pdfAttachmentKey, pdfTwo, 'single-call PDF override was ignored');
    const status = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    assertEq(status.pdfAttachmentKey, pdfTwo, 'saved chunks did not switch to second PDF');
    assertTrue(fixture.pdfAttachmentKeys.includes(status.pdfAttachmentKey), 'unknown PDF source was saved');
  }));

  scenarios.push(await scenario('invalid PDF request records a reason and preserves the previous chunks', async () => {
    const before = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    let result: any;
    try {
      result = await api.indexItem({
        libraryKey: fixture.libraryKey,
        itemKey: fixture.itemKey,
        pdfAttachmentKey: 'BADPDF01',
      });
    } catch (error: any) {
      result = { outcome: 'failed', reason: { message: error?.message || String(error) } };
    }
    assertEq(result.outcome, 'failed', 'invalid PDF key was not rejected');
    const after = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    assertEq(after.chunkCount, before.chunkCount, 'failed replacement changed previous chunks');
    assertEq(after.pdfAttachmentKey, pdfTwo, 'failed replacement changed the previous PDF source');
    assertEq(after.lastAttempt?.outcome, 'failed', 'latest failure was not persisted');
    assertTrue(!!after.lastAttempt?.reason?.message, 'failure reason was not persisted');
  }));

  scenarios.push(await scenario('force without an attachment manually retries with automatic selection', async () => {
    const result = await api.indexItem({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey, force: true });
    assertTrue(['indexed', 'updated'].includes(result.outcome), `Manual retry failed: ${result.outcome}`);
    assertEq(result.pdfAttachmentKey, undefined, 'auto-selected source should not be echoed as a request parameter');
    const status = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    assertEq(status.pdfAttachmentKey, pdfOne, 'automatic selector did not recover the unique main PDF');
    assertTrue(fixture.pdfAttachmentKeys.includes(status.pdfAttachmentKey), 'unknown PDF source was saved');
    assertEq(status.lastAttempt?.outcome, result.outcome, 'success did not replace the failure record');
    assertEq(status.lastAttempt?.reason, undefined, 'success retained a stale failure reason');
  }));

  scenarios.push(await scenario('latest failure is persisted with the previously successful source intact', async () => {
    const before = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    const failed = await api.indexItem({
      libraryKey: fixture.libraryKey,
      itemKey: fixture.itemKey,
      pdfAttachmentKey: 'BADPDF01',
    });
    assertEq(failed.outcome, 'failed', 'invalid PDF key was not rejected');
    const after = await api.getItemIndexStatus({ libraryKey: fixture.libraryKey, itemKey: fixture.itemKey });
    assertEq(after.chunkCount, before.chunkCount, 'failed replacement changed previous chunks');
    assertEq(after.pdfAttachmentKey, pdfOne, 'failed replacement changed the selected main PDF');
    assertEq(after.lastAttempt?.outcome, 'failed', 'latest failure was not persisted');
    assertTrue(!!after.lastAttempt?.reason?.message, 'failure reason was not persisted');
  }));

  return scenarios;
});

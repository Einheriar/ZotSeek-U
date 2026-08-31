/**
 * Dev-only Plan 11B capture of Zotero's current PDFWorker page text.
 *
 * The exporter writes private full text to a caller-selected new directory.
 * It never writes Zotero items, ZotSeek SQLite rows, embeddings, or prefs.
 */

declare const Zotero: any;
declare const IOUtils: any;
declare const PathUtils: any;

interface PdfBenchmarkExportOptions {
  corpusManifestPath: string;
  outputDir: string;
  strategy?: 'zotseek-default-cache-gated' | 'pdfworker-direct';
}

interface CorpusParent {
  libraryKey: string;
  itemKey: string;
}

interface CorpusAttachment {
  caseId: string;
  libraryKey: string;
  parentKey: string;
  attachmentKey: string;
}

interface CorpusManifest {
  schemaVersion: number;
  collection: string;
  parents: CorpusParent[];
  attachments: CorpusAttachment[];
}

interface CapturedPage {
  pageNumber: number;
  status: 'ok' | 'empty' | 'failed';
  text: string;
  error?: string;
}

interface CapturedAttachment {
  schemaVersion: 1;
  capture: 'zotseek-default-cache-gated' | 'pdfworker-direct';
  libraryKey: string;
  parentKey: string;
  attachmentKey: string;
  attachmentItemID: number;
  title: string;
  status: 'ok' | 'degraded' | 'empty' | 'failed';
  pagesTotal: number | null;
  pageCountSource: 'zotero-fulltext-database' | 'pdfworker-probe';
  pages: CapturedPage[];
  durationMs: number;
  error?: string;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function isAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\\\');
}

async function writeJSON(path: string, value: unknown): Promise<void> {
  await IOUtils.writeUTF8(path, `${JSON.stringify(value)}\n`);
}

function captureStatus(pages: CapturedPage[]): CapturedAttachment['status'] {
  const ok = pages.filter(page => page.status === 'ok').length;
  const failed = pages.filter(page => page.status === 'failed').length;
  if (failed > 0) return ok > 0 ? 'degraded' : 'failed';
  return ok > 0 ? 'ok' : 'empty';
}

async function captureAttachment(
  libraryKey: string,
  parentKey: string,
  attachment: any,
  strategy: 'zotseek-default-cache-gated' | 'pdfworker-direct',
): Promise<CapturedAttachment> {
  const startedAt = Date.now();
  if (strategy === 'pdfworker-direct') {
    try {
      // PDFWorker reports the physical page count with every response. Probing
      // page zero avoids using Zotero.Fulltext.getPages(), whose value comes
      // from fulltextItems and is absent until Zotero has indexed the PDF.
      const firstPageResult = await Zotero.PDFWorker.getFullText(
        attachment.id,
        [0],
        false,
        null,
      );
      const pagesTotal = Number(firstPageResult?.totalPages ?? 0);
      if (!Number.isFinite(pagesTotal) || pagesTotal <= 0) {
        return {
          schemaVersion: 1,
          capture: strategy,
          libraryKey,
          parentKey,
          attachmentKey: attachment.key,
          attachmentItemID: attachment.id,
          title: String(attachment.getField?.('title') || ''),
          status: 'empty',
          pagesTotal: Number.isFinite(pagesTotal) ? pagesTotal : null,
          pageCountSource: 'pdfworker-probe',
          pages: [],
          durationMs: Date.now() - startedAt,
        };
      }

      const firstPageText = typeof firstPageResult?.text === 'string'
        ? firstPageResult.text
        : '';
      const pages: CapturedPage[] = [{
        pageNumber: 1,
        status: firstPageText.trim().length > 0 ? 'ok' : 'empty',
        text: firstPageText,
      }];
      for (let pageIndex = 1; pageIndex < pagesTotal; pageIndex++) {
        try {
          const result = await Zotero.PDFWorker.getFullText(
            attachment.id,
            [pageIndex],
            false,
            null,
          );
          const text = typeof result?.text === 'string' ? result.text : '';
          pages.push({
            pageNumber: pageIndex + 1,
            status: text.trim().length > 0 ? 'ok' : 'empty',
            text,
          });
        } catch (error) {
          pages.push({
            pageNumber: pageIndex + 1,
            status: 'failed',
            text: '',
            error: errorText(error),
          });
        }
      }

      return {
        schemaVersion: 1,
        capture: strategy,
        libraryKey,
        parentKey,
        attachmentKey: attachment.key,
        attachmentItemID: attachment.id,
        title: String(attachment.getField?.('title') || ''),
        status: captureStatus(pages),
        pagesTotal,
        pageCountSource: 'pdfworker-probe',
        pages,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        schemaVersion: 1,
        capture: strategy,
        libraryKey,
        parentKey,
        attachmentKey: attachment.key,
        attachmentItemID: attachment.id,
        title: String(attachment.getField?.('title') || ''),
        status: 'failed',
        pagesTotal: null,
        pageCountSource: 'pdfworker-probe',
        pages: [],
        durationMs: Date.now() - startedAt,
        error: `PDFWorker probe failed: ${errorText(error)}`,
      };
    }
  }

  let pagesTotal: number | null = null;
  try {
    const pageInfo = await Zotero.Fulltext.getPages(attachment.id);
    pagesTotal = Number(pageInfo?.total ?? 0);
    if (!Number.isFinite(pagesTotal) || pagesTotal < 0) pagesTotal = null;
  } catch (error) {
    return {
      schemaVersion: 1,
      capture: strategy,
      libraryKey,
      parentKey,
      attachmentKey: attachment.key,
      attachmentItemID: attachment.id,
      title: String(attachment.getField?.('title') || ''),
      status: 'failed',
      pagesTotal: null,
      pageCountSource: 'zotero-fulltext-database',
      pages: [],
      durationMs: Date.now() - startedAt,
      error: `getPages failed: ${errorText(error)}`,
    };
  }

  if (!pagesTotal || pagesTotal <= 0) {
    return {
      schemaVersion: 1,
      capture: strategy,
      libraryKey,
      parentKey,
      attachmentKey: attachment.key,
      attachmentItemID: attachment.id,
      title: String(attachment.getField?.('title') || ''),
      status: 'empty',
      pagesTotal,
      pageCountSource: 'zotero-fulltext-database',
      pages: [],
      durationMs: Date.now() - startedAt,
    };
  }

  const pages: CapturedPage[] = [];
  for (let pageIndex = 0; pageIndex < pagesTotal; pageIndex++) {
    try {
      const result = await Zotero.PDFWorker.getFullText(
        attachment.id,
        [pageIndex],
        false,
        null,
      );
      const text = typeof result?.text === 'string' ? result.text : '';
      pages.push({
        pageNumber: pageIndex + 1,
        status: text.trim().length > 0 ? 'ok' : 'empty',
        text,
      });
    } catch (error) {
      pages.push({
        pageNumber: pageIndex + 1,
        status: 'failed',
        text: '',
        error: errorText(error),
      });
    }
  }

  return {
    schemaVersion: 1,
    capture: strategy,
    libraryKey,
    parentKey,
    attachmentKey: attachment.key,
    attachmentItemID: attachment.id,
    title: String(attachment.getField?.('title') || ''),
    status: captureStatus(pages),
    pagesTotal,
    pageCountSource: 'zotero-fulltext-database',
    pages,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Capture every PDF attachment belonging to the frozen corpus parents.
 * Refuses to reuse an existing output directory so a prior run cannot be
 * silently mixed with a different Zotero/PDFWorker version.
 */
export async function exportPdfWorkerCollection(
  options: PdfBenchmarkExportOptions,
): Promise<Record<string, unknown>> {
  const corpusManifestPath = String(options?.corpusManifestPath || '');
  const outputDir = String(options?.outputDir || '');
  const strategy = options?.strategy || 'zotseek-default-cache-gated';
  if (!corpusManifestPath || !outputDir) {
    throw new Error('corpusManifestPath and outputDir are required');
  }
  if (strategy !== 'zotseek-default-cache-gated' && strategy !== 'pdfworker-direct') {
    throw new Error(`Unsupported PDF benchmark strategy: ${strategy}`);
  }
  if (!isAbsolutePath(corpusManifestPath) || !isAbsolutePath(outputDir)) {
    throw new Error('corpusManifestPath and outputDir must be absolute paths');
  }
  if (!await IOUtils.exists(corpusManifestPath)) {
    throw new Error(`Corpus manifest not found: ${corpusManifestPath}`);
  }
  if (await IOUtils.exists(outputDir)) {
    throw new Error(`Output directory already exists and will not be overwritten: ${outputDir}`);
  }

  const manifest = JSON.parse(await IOUtils.readUTF8(corpusManifestPath)) as CorpusManifest;
  if (
    manifest.schemaVersion !== 1
    || !Array.isArray(manifest.parents)
    || !Array.isArray(manifest.attachments)
  ) {
    throw new Error('Unsupported or invalid Plan 11B corpus manifest');
  }
  if (manifest.parents.length !== 150) {
    throw new Error(`Expected the frozen 150-parent corpus, got ${manifest.parents.length}`);
  }
  if (manifest.parents.some(parent => parent.libraryKey !== 'user')) {
    throw new Error('The first Plan 11B exporter currently supports only the user-library corpus');
  }
  if (manifest.attachments.length !== 154) {
    throw new Error(`Expected the frozen 154-attachment inventory, got ${manifest.attachments.length}`);
  }

  const attachmentsDir = PathUtils.join(outputDir, 'attachments');
  await IOUtils.makeDirectory(attachmentsDir, { createAncestors: true, ignoreExisting: false });
  const startedAt = Date.now();
  const cases: Array<Record<string, unknown>> = [];
  let parentMissing = 0;
  let attachmentMissing = 0;
  let attachmentCount = 0;
  const attachmentsByParent = new Map<string, CorpusAttachment[]>();
  for (const attachment of manifest.attachments) {
    const existing = attachmentsByParent.get(attachment.parentKey) || [];
    existing.push(attachment);
    attachmentsByParent.set(attachment.parentKey, existing);
  }

  for (let parentIndex = 0; parentIndex < manifest.parents.length; parentIndex++) {
    const parentIdentity = manifest.parents[parentIndex];
    const parent = Zotero.Items.getByLibraryAndKey(
      Zotero.Libraries.userLibraryID,
      parentIdentity.itemKey,
    );
    if (!parent?.isRegularItem?.()) {
      parentMissing++;
      cases.push({
        libraryKey: 'user',
        parentKey: parentIdentity.itemKey,
        status: 'parent-missing',
      });
      continue;
    }

    const expectedAttachments = attachmentsByParent.get(parent.key) || [];
    for (const expectedAttachment of expectedAttachments) {
      const attachment = Zotero.Items.getByLibraryAndKey(
        Zotero.Libraries.userLibraryID,
        expectedAttachment.attachmentKey,
      );
      if (
        !attachment?.isPDFAttachment?.()
        || Number(attachment.parentID) !== Number(parent.id)
      ) {
        attachmentMissing++;
        cases.push({
          libraryKey: 'user',
          parentKey: parent.key,
          attachmentKey: expectedAttachment.attachmentKey,
          status: 'attachment-missing',
        });
        continue;
      }
      attachmentCount++;
      const captured = await captureAttachment('user', parent.key, attachment, strategy);
      const relativePath = `attachments/${attachment.key}.json`;
      await writeJSON(PathUtils.join(outputDir, ...relativePath.split('/')), captured);
      cases.push({
        libraryKey: 'user',
        parentKey: parent.key,
        attachmentKey: attachment.key,
        status: captured.status,
        pagesTotal: captured.pagesTotal,
        successfulPages: captured.pages.filter(page => page.status === 'ok').length,
        emptyPages: captured.pages.filter(page => page.status === 'empty').length,
        failedPages: captured.pages.filter(page => page.status === 'failed').length,
        durationMs: captured.durationMs,
        artifact: relativePath,
      });
    }

    if ((parentIndex + 1) % 10 === 0 || parentIndex + 1 === manifest.parents.length) {
      Zotero.debug(
        `[ZotSeek Plan11B] PDFWorker capture ${parentIndex + 1}/${manifest.parents.length} parents, ` +
        `${attachmentCount} PDF attachments`,
      );
    }
  }

  const summary = {
    schemaVersion: 1,
    capture: strategy,
    generatedAt: new Date().toISOString(),
    zoteroVersion: String(Zotero.version || 'unknown'),
    platform: String(Zotero.platform || 'unknown'),
    collection: manifest.collection,
    corpusManifestPath,
    parentCount: manifest.parents.length,
    parentMissing,
    attachmentCount,
    attachmentMissing,
    statusCounts: {
      ok: cases.filter(item => item.status === 'ok').length,
      degraded: cases.filter(item => item.status === 'degraded').length,
      empty: cases.filter(item => item.status === 'empty').length,
      failed: cases.filter(item => item.status === 'failed').length,
      parentMissing: cases.filter(item => item.status === 'parent-missing').length,
      attachmentMissing: cases.filter(item => item.status === 'attachment-missing').length,
    },
    durationMs: Date.now() - startedAt,
    privacy: 'This directory contains private full PDF text and must not be committed.',
    cases,
  };
  await writeJSON(PathUtils.join(outputDir, 'capture-manifest.json'), summary);
  Zotero.debug(
    `[ZotSeek Plan11B] PDFWorker capture completed: ${attachmentCount} attachments → ${outputDir}`,
  );
  return summary;
}

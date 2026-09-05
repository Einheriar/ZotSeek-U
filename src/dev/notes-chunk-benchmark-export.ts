/**
 * Dev-only Plan 54 export of the production-normalized Metadata + Notes source.
 *
 * This deliberately stops before chunking. The offline runner owns the five
 * experimental chunk-size arms, so the current production soft-min behavior
 * cannot leak into the comparison.
 */

import { buildIndexedMetadataSnapshot, type IndexedMetadataSnapshot } from '../utils/indexed-metadata';
import { noteHTMLToStructuredText, type StructuredNoteText } from '../utils/note-text';

declare const Zotero: any;
declare const IOUtils: any;
declare const PathUtils: any;

interface NotesChunkBenchmarkExportOptions {
  corpusManifestPath: string;
  outputDir: string;
}

interface CorpusParent {
  library_key?: string;
  libraryKey?: string;
  item_key?: string;
  itemKey?: string;
}

export interface NormalizedNoteSourceRecord {
  schemaVersion: 1;
  libraryKey: string;
  itemKey: string;
  itemId: number;
  title: string;
  metadata: IndexedMetadataSnapshot;
  notes: Array<{
    noteKey: string;
    noteId: number;
    structured: StructuredNoteText;
  }>;
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\\\');
}

async function writeJSONL(path: string, records: unknown[]): Promise<void> {
  await IOUtils.writeUTF8(path, `${records.map(record => JSON.stringify(record)).join('\n')}\n`);
}

function parentIdentity(parent: CorpusParent): { libraryKey: string; itemKey: string } {
  return {
    libraryKey: String(parent.library_key ?? parent.libraryKey ?? ''),
    itemKey: String(parent.item_key ?? parent.itemKey ?? ''),
  };
}

function belongsToCollection(item: any, collectionId: number): boolean {
  const collections = item?.getCollections?.() || [];
  return collections.some((value: unknown) => Number(value) === Number(collectionId));
}

/**
 * Read exactly the frozen 150 parent items from the specified collection.
 * Only the new output directory is written; Zotero items, preferences and
 * ZotSeek's SQLite database are never opened for writing here.
 */
export async function exportNotesChunkBenchmark(
  options: NotesChunkBenchmarkExportOptions,
): Promise<Record<string, unknown>> {
  const corpusManifestPath = String(options?.corpusManifestPath || '');
  const outputDir = String(options?.outputDir || '');
  if (!corpusManifestPath || !outputDir) {
    throw new Error('corpusManifestPath and outputDir are required');
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

  const lines = (await IOUtils.readUTF8(corpusManifestPath))
    .split(/\r?\n/u)
    .map((line: string) => line.trim())
    .filter(Boolean)
    .map((line: string) => JSON.parse(line) as CorpusParent);
  invariant(lines.length === 150, `Expected the frozen 150-parent corpus, got ${lines.length}`);

  const identities = lines.map(parentIdentity);
  invariant(identities.every((identity: { libraryKey: string; itemKey: string }) =>
    identity.libraryKey === 'user' && identity.itemKey),
    'Plan 54 currently supports only user-library parents with stable item keys');
  const identityKeys = identities.map((identity: { libraryKey: string; itemKey: string }) =>
    `${identity.libraryKey}|${identity.itemKey}`);
  invariant(new Set(identityKeys).size === identityKeys.length, 'Corpus manifest contains duplicate parents');

  const collectionKey = 'KFN9TUXS';
  const collection = Zotero.Collections.getByLibraryAndKey(
    Zotero.Libraries.userLibraryID,
    collectionKey,
  );
  invariant(collection, `Plan 54 collection not found: ${collectionKey}`);

  await IOUtils.makeDirectory(outputDir, { createAncestors: true, ignoreExisting: false });
  const records: NormalizedNoteSourceRecord[] = [];
  let summaryWithBody = 0;
  let noteCount = 0;
  let structuredNoteCount = 0;
  let filteredReferenceChars = 0;
  let filteredBasicChars = 0;
  let filteredPreambleChars = 0;
  const startedAt = Date.now();

  for (let index = 0; index < identities.length; index += 1) {
    const identity = identities[index];
    const item = Zotero.Items.getByLibraryAndKey(
      Zotero.Libraries.userLibraryID,
      identity.itemKey,
    );
    invariant(item?.isRegularItem?.(), `Corpus parent is missing or not regular: ${identity.itemKey}`);
    invariant(belongsToCollection(item, collection.id),
      `Corpus parent is outside collection ${collectionKey}: ${identity.itemKey}`);

    const metadata = buildIndexedMetadataSnapshot(item, 'Untitled');
    if (metadata.body) summaryWithBody += 1;
    const noteIDs = item.getNotes?.() || [];
    const loaded = await Zotero.Items.getAsync(noteIDs);
    const notes = (Array.isArray(loaded) ? loaded : [loaded])
      .filter((note: any) => !!note && !!note.isNote?.())
      .sort((left: any, right: any) => String(left.key).localeCompare(String(right.key)));
    const normalizedNotes = notes.map((note: any) => ({
      noteKey: String(note.key),
      noteId: Number(note.id),
      structured: noteHTMLToStructuredText(String(note.getNote?.() || '')),
    })).filter(note => note.structured.indexText.length >= 3);

    noteCount += normalizedNotes.length;
    structuredNoteCount += normalizedNotes.filter(note =>
      note.structured.meaningfulHeadingCount > 0 && !note.structured.onlyGenericRoot).length;
    for (const note of normalizedNotes) {
      filteredReferenceChars += note.structured.filteredReferenceChars;
      filteredBasicChars += note.structured.filteredBasicChars;
      filteredPreambleChars += note.structured.filteredPreambleChars;
    }
    records.push({
      schemaVersion: 1,
      libraryKey: identity.libraryKey,
      itemKey: identity.itemKey,
      itemId: Number(item.id),
      title: metadata.title,
      metadata,
      notes: normalizedNotes,
    });

    if ((index + 1) % 10 === 0 || index + 1 === identities.length) {
      Zotero.debug(`[ZotSeek Plan54] normalized source export ${index + 1}/${identities.length}`);
    }
  }

  records.sort((left, right) =>
    `${left.libraryKey}|${left.itemKey}`.localeCompare(`${right.libraryKey}|${right.itemKey}`));
  await writeJSONL(PathUtils.join(outputDir, 'normalized-source.jsonl'), records);
  await IOUtils.writeUTF8(
    PathUtils.join(outputDir, 'source-summary.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      collectionKey,
      parentCount: records.length,
      summaryWithBody,
      noteCount,
      structuredNoteCount,
      plainNoteCount: noteCount - structuredNoteCount,
      filteredReferenceChars,
      filteredBasicChars,
      filteredPreambleChars,
      durationMs: Date.now() - startedAt,
      privacy: 'Contains private normalized Zotero Metadata and Note text; do not commit or upload.',
    }, null, 2)}\n`,
  );

  const result = {
    schemaVersion: 1,
    collectionKey,
    parentCount: records.length,
    summaryWithBody,
    noteCount,
    structuredNoteCount,
    plainNoteCount: noteCount - structuredNoteCount,
    filteredReferenceChars,
    filteredBasicChars,
    filteredPreambleChars,
    outputDir,
    durationMs: Date.now() - startedAt,
  };
  Zotero.debug(`[ZotSeek Plan54] normalized source export completed: ${records.length} parents`);
  return result;
}

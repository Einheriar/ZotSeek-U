import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { markdownToSafeHtml } from '../src/core/brief-markdown';
import { BriefSourceBuilder } from '../src/core/brief-source-builder';
import { BriefNoteWriter } from '../src/core/brief-note-writer';
import { BriefGenerationRunner } from '../src/core/brief-generation-runner';

function parent() {
  return {
    id: 7,
    key: 'PARENT1',
    libraryKey: 'user',
    itemType: 'journalArticle',
    title: 'An article',
    abstractNote: 'An abstract',
  };
}

function pdf() { return { id: 8, key: 'PDF1', attachmentContentType: 'application/pdf', parentID: 7 }; }

describe('brief core pipeline', () => {
  test('renders a restricted Markdown subset and removes dangerous HTML/URLs', () => {
    const html = markdownToSafeHtml('# Heading\n\n[ok](https://example.test) [bad](javascript:alert(1))\n\n<img src="x" onerror="boom"><script>alert(1)</script>');
    assert.match(html, /<h1>Heading<\/h1>/);
    assert.match(html, /href="https:\/\/example.test"/);
    assert.doesNotMatch(html, /javascript:|<img|<script|onerror/iu);
  });

  test('uses exact PDF pages and enforces non-whitespace Unicode threshold', async () => {
    const attachment = pdf();
    const source = new BriefSourceBuilder({
      identityOf: value => ({ libraryKey: (value as any).libraryKey, itemKey: (value as any).key }),
      selectMainPdf: () => attachment,
      readPdf: () => ({
        status: 'partial', attachmentKey: 'PDF1', complete: false, totalPages: 2,
        pages: [{ page: 1, text: '😀'.repeat(99) }, { page: 2, text: 'a' }],
      }),
      preprocess: pages => ({ pages: pages.map(page => ({ ...page })), diagnostics: {} as any, ignoredBlocks: [] }),
    });
    const result = await source.build({ parent: parent() });
    assert.equal(result.status, 'ready');
    if (result.status === 'ready') {
      assert.equal(result.evidence.textCodePoints, 100);
      assert.match(result.evidence.formattedText, /\[PDF p\.1\]/);
      assert.equal(result.evidence.coverage, 'partial');
    }
  });

  test('applies the 99/100/101 non-whitespace code-point boundary after cleanup', async () => {
    for (const count of [99, 100, 101]) {
      const source = new BriefSourceBuilder({
        identityOf: value => ({ libraryKey: (value as any).libraryKey, itemKey: (value as any).key }),
        selectMainPdf: () => pdf(),
        readPdf: () => ({
          status: 'ok', attachmentKey: 'PDF1', complete: true, totalPages: 1,
          pages: [{ page: 1, text: `  ${'😀'.repeat(count)} \n\t` }],
        }),
        preprocess: pages => ({ pages: pages.map(page => ({ ...page })), diagnostics: {} as any, ignoredBlocks: [] }),
      });
      const result = await source.build({ parent: parent() });
      assert.equal(result.status, count < 100 ? 'insufficient_text' : 'ready');
      if ('evidence' in result && result.evidence) assert.equal(result.evidence.textCodePoints, count);
    }
  });

  test('maps a failed selected-main-PDF result to a PDF read failure', async () => {
    const source = new BriefSourceBuilder({
      identityOf: value => ({ libraryKey: (value as any).libraryKey, itemKey: (value as any).key }),
      selectMainPdf: () => ({
        selection: { decision: 'selected' },
        selectedText: { status: 'failed', attachmentKey: 'PDF1', pages: [], pagesTotal: null },
      }),
      readPdf: () => { throw new Error('must not read a failed selection twice'); },
      preprocess: pages => ({ pages: pages.map(page => ({ ...page })), diagnostics: {} as any, ignoredBlocks: [] }),
    });
    assert.deepEqual(await source.build({ parent: parent() }), {
      status: 'failed', reason: 'pdf_read_failed', error: undefined,
    });
  });

  test('treats a missing main PDF as a non-billable skip', async () => {
    let classifierCalls = 0;
    const runner = new BriefGenerationRunner({
      sourceBuilder: { build: async () => ({ status: 'failed', reason: 'no_main_pdf' }) },
      classify: async () => { classifierCalls++; return []; },
      client: { generate: async () => { throw new Error('must not generate'); } } as any,
    });
    assert.deepEqual(await runner.run({ target: { parent: parent() }, settings: {
      provider: 'test', model: 'test', maxInputTokens: 5000, maxOutputTokens: 100,
      promptPair: { standard: 'standard', review: 'review' },
    } }), { status: 'skipped', reason: 'no_main_pdf' });
    assert.equal(classifierCalls, 0);
  });

  test('falls back on provider context errors and forwards existing-note consent', async () => {
    const evidence: any = {
      parent: { title: 'An article', abstract: 'An abstract', identity: { libraryKey: 'user', itemKey: 'PARENT1' }, itemKey: 'PARENT1', libraryKey: 'user', value: parent() },
      attachment: pdf(), attachmentKey: 'PDF1', pages: [{ page: 1, text: 'a'.repeat(100) }], formattedText: '[PDF p.1]\n' + 'a'.repeat(100), textCodePoints: 100, pageCount: 1, indexedPages: 1, totalPages: 1, coverage: 'complete', readStatus: 'ok',
    };
    const calls: any[] = [];
    let noteInput: any;
    const runner = new BriefGenerationRunner({
      sourceBuilder: { build: async () => ({ status: 'ready', evidence }) },
      classify: async () => [{ key: 'user|PARENT1', kind: 'standard' }],
      client: {
        generate: async (messages: any[]) => {
          calls.push(messages);
          if (calls.length === 1) throw Object.assign(new Error('payload too large'), { status: 413, category: 'context-limit' });
          return { content: calls.length === 2 ? 'summary' : 'brief' };
        },
      } as any,
      noteWriter: { write: async (input: any) => { noteInput = input; return { id: 1 }; } },
    });
    // The classifier is injected, so generation calls are: article then the
    // layered retry's segment summary and final merge.
    const result = await runner.run({ source: evidence, allowExistingNotes: true, settings: {
      provider: 'test', model: 'test', maxInputTokens: 5000, maxOutputTokens: 100,
      promptPair: { standard: 'standard', review: 'review' },
    } });
    assert.equal(result.status, 'success');
    assert.equal(calls.length, 3);
    assert.equal(noteInput.allowExistingNotes, true);
  });

  test('does not split surrogate pairs in layered evidence requests', async () => {
    const text = '😀'.repeat(1500);
    const evidence: any = {
      parent: { title: 'Emoji article', abstract: 'Abstract', identity: { libraryKey: 'user', itemKey: 'PARENT1' }, itemKey: 'PARENT1', libraryKey: 'user', value: parent() },
      attachment: pdf(), attachmentKey: 'PDF1', pages: [{ page: 1, text }], formattedText: `[PDF p.1]\n${text}`, textCodePoints: 1500, pageCount: 1, indexedPages: 1, totalPages: 1, coverage: 'complete', readStatus: 'ok',
    };
    const messagesSeen: any[][] = [];
    const runner = new BriefGenerationRunner({
      sourceBuilder: { build: async () => ({ status: 'ready', evidence }) },
      classify: async () => [{ key: 'user|PARENT1', kind: 'standard' }],
      client: { generate: async (messages: any[]) => { messagesSeen.push(messages); return { content: 'summary' }; } } as any,
    });
    const result = await runner.run({ source: evidence, writeNote: false, settings: {
      provider: 'test', model: 'test', maxInputTokens: 3000, maxOutputTokens: 100,
      promptPair: { standard: 'standard', review: 'review' },
    } });
    assert.equal(result.status, 'success');
    for (const messages of messagesSeen) {
      const value = messages.map(message => message.content).join('\n');
      assert.doesNotMatch(value, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u);
    }
  });

  test('maps a Child Note race at the write boundary to an existing-note skip', async () => {
    const evidence: any = {
      parent: { title: 'An article', abstract: 'An abstract', identity: { libraryKey: 'user', itemKey: 'PARENT1' }, itemKey: 'PARENT1', libraryKey: 'user', value: parent() },
      attachment: pdf(), attachmentKey: 'PDF1', pages: [{ page: 1, text: 'a'.repeat(100) }], formattedText: `[PDF p.1]\n${'a'.repeat(100)}`, textCodePoints: 100, pageCount: 1, indexedPages: 1, totalPages: 1, coverage: 'complete', readStatus: 'ok',
    };
    const runner = new BriefGenerationRunner({
      sourceBuilder: { build: async () => ({ status: 'ready', evidence }) },
      classify: async () => [{ key: 'user|PARENT1', kind: 'standard' }],
      client: { generate: async () => ({ content: 'brief' }) } as any,
      noteWriter: { write: async () => { throw Object.assign(new Error('The brief parent already has a Child Note.'), { code: 'BRIEF_NOTE_WRITER_ERROR' }); } },
    });
    const result = await runner.run({ source: evidence, settings: {
      provider: 'test', model: 'test', maxInputTokens: 5000, maxOutputTokens: 100,
      promptPair: { standard: 'standard', review: 'review' },
    } });
    assert.equal(result.status, 'skipped');
    if (result.status === 'skipped') assert.equal(result.reason, 'existing_note');
  });

  test('writer checks the commit boundary and always creates a new note', async () => {
    const created: any[] = [];
    const writer = new BriefNoteWriter({
      createChildNote: () => { const note: any = { setNote(value: string) { this.value = value; } }; created.push(note); return note; },
      commitNote: async note => { note.committed = true; },
      identityOf: value => ({ libraryKey: (value as any).libraryKey, itemKey: (value as any).key }),
      canWrite: () => true,
      hasAnyChildNotes: () => false,
    });
    const result = await writer.write({
      parent: parent(),
      evidence: {
        parent: { title: 'An article', abstract: 'An abstract', identity: { libraryKey: 'user', itemKey: 'PARENT1' }, itemKey: 'PARENT1', libraryKey: 'user', value: parent() },
        attachment: pdf(), attachmentKey: 'PDF1', pages: [{ page: 1, text: 'x' }], formattedText: '[PDF p.1]\nx', textCodePoints: 100, pageCount: 1, indexedPages: 1, totalPages: 1, coverage: 'complete', readStatus: 'ok',
      },
      markdown: '## Result\n\nA finding.', provider: 'test', model: 'test-model', classification: 'standard', promptSlot: 'standard', promptHash: 'a'.repeat(64), pipelineVersion: 1,
      allowExistingNotes: true,
    });
    assert.equal(created.length, 1);
    assert.equal((result as any).committed, true);
    assert.match((result as any).value, /ZotSeek 文献简报/);
  });
});

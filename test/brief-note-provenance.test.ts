import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  appendBriefNoteProvenance,
  parseBriefNoteProvenance,
  serializeBriefNoteProvenance,
  type BriefNoteProvenanceInput,
} from '../src/core/brief-note-provenance';

const provenance: BriefNoteProvenanceInput = {
  generatedAt: '2026-09-04T12:00:00.000Z',
  provider: 'alibaba-bailian',
  model: 'deepseek-v4-flash-0731',
  classification: 'review',
  promptHash: 'a'.repeat(64),
  pipelineVersion: 1,
  pdfAttachmentKey: 'PDFKEY1',
  pageCount: 18,
};

describe('brief Note provenance', () => {
  test('round-trips versioned audit metadata in an HTML comment', () => {
    const html = appendBriefNoteProvenance('<h1>ZotSeek 文献简报</h1>', provenance);
    assert.match(html, /<!-- zotseek-brief-provenance /);
    assert.deepEqual(parseBriefNoteProvenance(html), {
      schemaVersion: 1,
      generator: 'zotseek',
      ...provenance,
    });
  });

  test('escapes HTML comment delimiters without changing parsed values', () => {
    const comment = serializeBriefNoteProvenance({
      ...provenance,
      model: 'model--candidate<unsafe>',
    });
    assert.equal(comment.slice(4, -3).includes('--'), false);
    assert.equal(parseBriefNoteProvenance(comment)?.model, 'model--candidate<unsafe>');
  });

  test('does not recognize malformed or unrelated comments', () => {
    assert.equal(parseBriefNoteProvenance('<p>Manual note</p>'), null);
    assert.equal(
      parseBriefNoteProvenance('<!-- zotseek-brief-provenance {"generator":"zotseek"} -->'),
      null,
    );
  });

  test('rejects invalid fields and empty Note HTML', () => {
    assert.throws(
      () => serializeBriefNoteProvenance({ ...provenance, promptHash: 'short' }),
      /provenance is invalid/,
    );
    assert.throws(
      () => appendBriefNoteProvenance(' ', provenance),
      /must not be empty/,
    );
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  noteHTMLFirstHeading,
  noteHTMLToStructuredText,
} from '../src/utils/note-text';

const html = `
  <h1>Academic Brief</h1>
  <p>citation preamble</p>
  <h2>Basic Information</h2>
  <p>DOI: 10.1000/example</p>
  <h2>Analysis</h2>
  <p>Main claim</p>
  <h2>References</h2>
  <p>Reference A</p>
`;

test('read-side Note structure preserves sections excluded from indexing', () => {
  const indexed = noteHTMLToStructuredText(html);
  const readable = noteHTMLToStructuredText(html, { filterIndexSubtrees: false });

  assert.equal(indexed.filteredText.includes('Reference A'), false);
  assert.equal(readable.visibleText.includes('Reference A'), true);
  assert.deepEqual(readable.sections.map(section => section.path), [
    [],
    ['Basic Information'],
    ['Analysis'],
    ['References'],
  ]);
  assert.equal(readable.sections.flatMap(section => section.paragraphs).includes('DOI: 10.1000/example'), true);
  assert.equal(noteHTMLFirstHeading(html), 'Academic Brief');
});

test('read-side Note structure keeps visible MathML/LaTeX annotation text', () => {
  const readable = noteHTMLToStructuredText(
    '<h2>Equation</h2><p><math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2</annotation></semantics></math></p>',
    { filterIndexSubtrees: false },
  );
  assert.equal(readable.visibleText.includes('x^2'), true);
});

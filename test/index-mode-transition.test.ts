import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { planModeTransitionReuse } from '../src/core/index-mode-transition';
import type { PaperEmbedding, TextSourceType } from '../src/core/vector-store-sqlite';
import type { Chunk, ChunkType } from '../src/utils/chunker';

function targetChunk(
  index: number,
  text: string,
  type: ChunkType,
  sectionPaths?: string[][],
): Chunk {
  return { index, text, type, sectionPaths };
}

function storedChunk(
  index: number,
  text: string,
  textSource: TextSourceType,
  sectionPaths?: string[][],
  modelId = 'model-a',
): PaperEmbedding {
  return {
    itemId: 1,
    libraryKey: 'user',
    itemKey: 'ITEM0001',
    chunkIndex: index,
    title: 'Paper',
    chunkText: text,
    sectionPaths,
    textSource,
    embedding: [index + 0.25],
    modelId,
    indexedAt: '2026-09-02T00:00:00Z',
    contentHash: 'old',
  };
}

describe('index mode transition reuse planning', () => {
  test('reuses an identical Full Summary when targeting Abstract', () => {
    const target = [targetChunk(0, 'Title\n\nA useful abstract.', 'summary')];
    const existing = [
      storedChunk(0, target[0].text, 'summary'),
      storedChunk(1, 'Note', 'note'),
      storedChunk(2, 'PDF', 'content'),
    ];
    const plan = planModeTransitionReuse(target, existing, 'model-a');

    assert.equal(plan.reusableByTargetIndex.size, 1);
    assert.equal(plan.chunksToEmbed.length, 0);
  });

  test('re-embeds only the Abstract Summary when Full metadata contains extra text', () => {
    const target = [targetChunk(0, 'Title', 'summary')];
    const existing = [
      storedChunk(0, 'Title\n\nShort abstract.\n\nTags: EEG', 'summary'),
      storedChunk(1, 'PDF', 'content'),
    ];
    const plan = planModeTransitionReuse(target, existing, 'model-a');

    assert.equal(plan.reusableByTargetIndex.size, 0);
    assert.deepEqual(plan.chunksToEmbed.map(chunk => chunk.index), [0]);
  });

  test('reuses the shared Summary and embeds Notes when expanding Abstract to Notes', () => {
    const target = [
      targetChunk(0, 'Title\n\nAbstract\n\nTags: EEG', 'summary'),
      targetChunk(1, 'Reading note', 'note'),
    ];
    const existing = [storedChunk(0, 'Title\n\nAbstract\n\nTags: EEG', 'summary')];
    const plan = planModeTransitionReuse(target, existing, 'model-a');

    assert.equal(plan.reusableByTargetIndex.size, 1);
    assert.deepEqual(
      plan.chunksToEmbed.map(chunk => chunk.text),
      ['Reading note'],
    );
  });

  test('reuses the shared Summary and embeds Notes and PDF when expanding Abstract to Full', () => {
    const target = [
      targetChunk(0, 'Title\n\nAbstract\n\nTags: EEG', 'summary'),
      targetChunk(1, 'Reading note', 'note'),
      targetChunk(2, 'PDF passage', 'content'),
    ];
    const existing = [storedChunk(0, 'Title\n\nAbstract\n\nTags: EEG', 'summary')];
    const plan = planModeTransitionReuse(target, existing, 'model-a');

    assert.equal(plan.reusableByTargetIndex.size, 1);
    assert.deepEqual(
      plan.chunksToEmbed.map(chunk => chunk.text),
      ['Reading note', 'PDF passage'],
    );
  });

  test('reuses the shared Summary when shrinking Notes to Abstract', () => {
    const target = [targetChunk(0, 'Title\n\nAbstract\n\nTags: EEG', 'summary')];
    const existing = [
      storedChunk(0, 'Title\n\nAbstract\n\nTags: EEG', 'summary'),
      storedChunk(1, 'Reading note', 'note'),
    ];
    const plan = planModeTransitionReuse(target, existing, 'model-a');

    assert.equal(plan.reusableByTargetIndex.size, 1);
    assert.deepEqual(plan.chunksToEmbed, []);
  });

  test('reuses Notes when expanding to Full and embeds only the new PDF', () => {
    const target = [
      targetChunk(0, 'Metadata', 'summary'),
      ...Array.from({ length: 30 }, (_, index) =>
        targetChunk(index + 1, `Note ${index}`, 'note')),
      targetChunk(31, 'PDF passage', 'content'),
    ];
    const existing = [
      storedChunk(0, 'Metadata', 'summary'),
      ...Array.from({ length: 40 }, (_, index) =>
        storedChunk(index + 1, `Note ${index}`, 'note')),
    ];
    const plan = planModeTransitionReuse(target, existing, 'model-a');

    assert.equal(plan.reusableByTargetIndex.size, 31);
    assert.deepEqual(plan.chunksToEmbed.map(chunk => chunk.text), ['PDF passage']);
  });

  test('reuses the first 30 Full Notes and embeds only additional Notes', () => {
    const target = [
      targetChunk(0, 'Metadata', 'summary'),
      ...Array.from({ length: 40 }, (_, index) =>
        targetChunk(index + 1, `Note ${index}`, 'note')),
    ];
    const existing = [
      storedChunk(0, 'Metadata', 'summary'),
      ...Array.from({ length: 30 }, (_, index) =>
        storedChunk(index + 1, `Note ${index}`, 'note')),
      storedChunk(31, 'PDF passage', 'content'),
    ];
    const plan = planModeTransitionReuse(target, existing, 'model-a');

    assert.equal(plan.reusableByTargetIndex.size, 31);
    assert.deepEqual(
      plan.chunksToEmbed.map(chunk => chunk.text),
      Array.from({ length: 10 }, (_, index) => `Note ${index + 30}`),
    );
  });

  test('does not reuse a different model or different structured Note paths', () => {
    const target = [targetChunk(0, 'Evidence', 'note', [['Findings']])];
    const existing = [
      storedChunk(5, 'Evidence', 'note', [['Methods']]),
      storedChunk(6, 'Evidence', 'note', [['Findings']], 'model-b'),
    ];
    const plan = planModeTransitionReuse(target, existing, 'model-a');

    assert.equal(plan.reusableByTargetIndex.size, 0);
    assert.equal(plan.chunksToEmbed.length, 1);
  });

  test('preserves duplicate multiplicity instead of reusing one vector twice', () => {
    const target = [
      targetChunk(0, 'Same note', 'note'),
      targetChunk(1, 'Same note', 'note'),
    ];
    const existing = [storedChunk(7, 'Same note', 'note')];
    const plan = planModeTransitionReuse(target, existing, 'model-a');

    assert.equal(plan.reusableByTargetIndex.size, 1);
    assert.deepEqual(plan.chunksToEmbed.map(chunk => chunk.index), [1]);
  });

  test('accepts historical Summary source aliases only at the Summary boundary', () => {
    const target = [
      targetChunk(0, 'Title only', 'summary'),
      targetChunk(1, 'Body', 'content'),
    ];
    const existing = [
      storedChunk(4, 'Title only', 'title_only'),
      storedChunk(5, 'Body', 'abstract'),
    ];
    const plan = planModeTransitionReuse(target, existing, 'model-a');

    assert.equal(plan.reusableByTargetIndex.has(0), true);
    assert.equal(plan.reusableByTargetIndex.has(1), false);
    assert.deepEqual(plan.chunksToEmbed.map(chunk => chunk.index), [1]);
  });
});

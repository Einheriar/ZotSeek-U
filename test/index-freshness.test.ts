import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessChangedNoteContent,
  assessIndexConfigFingerprint,
  assessModeOnlyIndexConfigTransition,
  assessQuickFreshness,
  assessStoredSourceTexts,
  IndexFreshnessTracker,
  legacyIndexConfigFingerprint,
  metadataFingerprint,
  noteContentFingerprint,
  noteStateFingerprint,
  notificationAffectsIndexedMetadata,
  resolveFreshnessDisplayState,
  serializeIndexConfigFingerprint,
} from '../src/core/index-freshness';
import type { IndexConfigSnapshot } from '../src/core/index-freshness';
import type { StartupFingerprint } from '../src/core/vector-store-sqlite';

const note = (key: string, version: number, dateModified: string) => ({
  key,
  version,
  dateModified,
});

function stored(overrides: Partial<StartupFingerprint> = {}): StartupFingerprint {
  return {
    libraryKey: 'user',
    itemKey: 'PARENT01',
    modelId: 'model',
    configFingerprint: 'config',
    metadataFingerprint: 'metadata',
    noteStateFingerprint: noteStateFingerprint([note('A', 1, '2026-01-01')], 'notes'),
    noteContentFingerprint: noteContentFingerprint([{ key: 'A', text: 'alpha' }], 'notes'),
    checkedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('shared freshness fingerprints', () => {
  test('classifies comparable config snapshots and preserves legacy compatibility', () => {
    const base: IndexConfigSnapshot = {
      indexContractVersion: 4,
      mode: 'full',
      maxChunksPerPaper: 100,
      chunkStrategyVersion: 6,
      modelInputPolicy: 'policy-v1',
      pdfSourceIdentityVersion: 0,
    };
    const current = { ...base, maxChunksPerPaper: 101 };

    assert.equal(
      assessIndexConfigFingerprint(serializeIndexConfigFingerprint(current), current),
      'current',
    );
    assert.equal(
      assessIndexConfigFingerprint(legacyIndexConfigFingerprint(current), current),
      'legacy-current',
    );
    assert.equal(
      assessIndexConfigFingerprint(serializeIndexConfigFingerprint(base), current),
      'max-chunks-increased',
    );
    assert.equal(
      assessIndexConfigFingerprint(
        serializeIndexConfigFingerprint(current),
        base,
      ),
      'changed',
    );

    for (const incompatible of [
      { ...base, mode: 'notes' as const },
      { ...base, chunkStrategyVersion: 7 },
      { ...base, modelInputPolicy: 'policy-v2' },
    ]) {
      assert.equal(
        assessIndexConfigFingerprint(
          serializeIndexConfigFingerprint(incompatible),
          current,
        ),
        'changed',
      );
    }
    assert.equal(
      assessIndexConfigFingerprint(legacyIndexConfigFingerprint(base), current),
      'changed',
    );
    assert.equal(
      assessIndexConfigFingerprint('zotseek-index-config:v1:{bad', current),
      'changed',
    );
  });

  test('requires PDF provenance refresh only for an existing Full fingerprint', () => {
    const currentFull: IndexConfigSnapshot = {
      indexContractVersion: 4,
      mode: 'full',
      maxChunksPerPaper: 100,
      chunkStrategyVersion: 7,
      modelInputPolicy: 'policy-v1',
      pdfSourceIdentityVersion: 1,
    };
    const oldFull = serializeIndexConfigFingerprint({
      ...currentFull,
      pdfSourceIdentityVersion: 0,
    });
    assert.equal(assessIndexConfigFingerprint(oldFull, currentFull), 'changed');
    assert.equal(
      assessIndexConfigFingerprint(legacyIndexConfigFingerprint(currentFull), currentFull),
      'changed',
    );

    const notes = { ...currentFull, mode: 'notes' as const, pdfSourceIdentityVersion: 0 };
    assert.equal(
      assessIndexConfigFingerprint(serializeIndexConfigFingerprint(notes), notes),
      'current',
    );
    assert.equal(
      assessIndexConfigFingerprint(legacyIndexConfigFingerprint(notes), notes),
      'legacy-current',
    );
  });

  test('proves only modern configuration changes whose sole difference is mode', () => {
    const base: IndexConfigSnapshot = {
      indexContractVersion: 4,
      mode: 'full',
      maxChunksPerPaper: 100,
      chunkStrategyVersion: 7,
      modelInputPolicy: 'policy-v1',
      pdfSourceIdentityVersion: 0,
    };
    const notes = { ...base, mode: 'notes' as const };

    assert.deepEqual(
      assessModeOnlyIndexConfigTransition(
        serializeIndexConfigFingerprint(base),
        serializeIndexConfigFingerprint(notes),
      ),
      { fromMode: 'full', toMode: 'notes' },
    );
    assert.deepEqual(
      assessModeOnlyIndexConfigTransition(
        serializeIndexConfigFingerprint(notes),
        serializeIndexConfigFingerprint({ ...base, pdfSourceIdentityVersion: 1 }),
      ),
      { fromMode: 'notes', toMode: 'full' },
    );
    assert.equal(
      assessModeOnlyIndexConfigTransition(
        serializeIndexConfigFingerprint(base),
        serializeIndexConfigFingerprint({ ...notes, maxChunksPerPaper: 120 }),
      ),
      null,
    );
    assert.equal(
      assessModeOnlyIndexConfigTransition(
        legacyIndexConfigFingerprint(base),
        serializeIndexConfigFingerprint(notes),
      ),
      null,
    );
    assert.equal(
      assessModeOnlyIndexConfigTransition(
        serializeIndexConfigFingerprint(base),
        serializeIndexConfigFingerprint(base),
      ),
      null,
    );
  });

  test('sorts Child Notes by stable key before hashing', () => {
    const a = note('A', 1, '2026-01-01');
    const b = note('B', 2, '2026-01-02');
    assert.equal(
      noteStateFingerprint([b, a], 'notes'),
      noteStateFingerprint([a, b], 'notes'),
    );
    assert.equal(
      noteContentFingerprint([{ key: 'B', text: 'beta' }, { key: 'A', text: 'alpha' }], 'full'),
      noteContentFingerprint([{ key: 'A', text: 'alpha' }, { key: 'B', text: 'beta' }], 'full'),
    );
  });

  test('classifies add, edit, and delete as note-state changes', () => {
    const fingerprint = stored();
    for (const notes of [
      [note('A', 1, '2026-01-01'), note('B', 1, '2026-01-02')],
      [note('A', 2, '2026-01-03')],
      [],
    ]) {
      assert.equal(assessQuickFreshness({
        indexed: true,
        mode: 'notes',
        configFingerprint: 'config',
        metadataFingerprint: 'metadata',
        noteStateFingerprint: noteStateFingerprint(notes, 'notes'),
        storedFingerprint: fingerprint,
      }), 'note-state-changed');
    }
  });

  test('abstract mode ignores Child Note changes', () => {
    const fingerprint = stored({
      noteStateFingerprint: noteStateFingerprint([], 'abstract'),
      noteContentFingerprint: noteContentFingerprint([], 'abstract'),
    });
    assert.equal(assessQuickFreshness({
      indexed: true,
      mode: 'abstract',
      configFingerprint: 'config',
      metadataFingerprint: 'metadata',
      noteStateFingerprint: noteStateFingerprint([note('NEW', 9, '2026-08-30')], 'abstract'),
      storedFingerprint: fingerprint,
    }), 'current');
  });

  test('detects title, abstract, and tag metadata changes deterministically', () => {
    const item = (title: string, abstract: string, tags: string[]) => ({
      getField: (field: string) => field === 'title' ? title : abstract,
      getTags: () => tags.map(tag => ({ tag })),
    });
    const original = metadataFingerprint(item('Title', 'Abstract', ['b', 'a']));
    assert.equal(original, metadataFingerprint(item('Title', 'Abstract', ['a', 'b'])));
    for (const changed of [
      metadataFingerprint(item('New title', 'Abstract', ['a', 'b'])),
      metadataFingerprint(item('Title', 'New abstract', ['a', 'b'])),
      metadataFingerprint(item('Title', 'Abstract', ['a', 'c'])),
    ]) {
      assert.notEqual(original, changed);
      assert.equal(assessQuickFreshness({
        indexed: true,
        mode: 'notes',
        configFingerprint: 'config',
        metadataFingerprint: changed,
        noteStateFingerprint: stored().noteStateFingerprint,
        storedFingerprint: stored({ metadataFingerprint: original }),
      }), 'metadata-changed');
    }
  });

  test('baselines a state-only Note change when normalized content is equal', () => {
    const fingerprint = stored();
    assert.equal(
      assessChangedNoteContent(fingerprint, noteContentFingerprint([{ key: 'A', text: 'alpha' }], 'notes')),
      'current',
    );
    assert.equal(
      assessChangedNoteContent(fingerprint, noteContentFingerprint([{ key: 'A', text: 'changed' }], 'notes')),
      'notes-changed',
    );
  });

  test('verifies fingerprint-less indexes against stored source text', () => {
    const storedTexts = { summary: ['summary'], notes: ['note'] };
    assert.equal(assessStoredSourceTexts(storedTexts, storedTexts), 'current');
    assert.equal(
      assessStoredSourceTexts(storedTexts, { summary: ['new summary'], notes: ['note'] }),
      'metadata-changed',
    );
    assert.equal(
      assessStoredSourceTexts(storedTexts, { summary: ['summary'], notes: ['new note'] }),
      'notes-changed',
    );
  });
});

describe('dirty tracker and status priority', () => {
  test('tracks dirty state by stable identity and remembers deleted-note parents', () => {
    const tracker = new IndexFreshnessTracker();
    const parent = { libraryKey: 'user', itemKey: 'PARENT01' };
    const noteIdentity = { libraryKey: 'user', itemKey: 'NOTE0001' };
    tracker.markDirty(parent);
    assert.equal(tracker.isDirty(parent), true);
    tracker.clearDirty(parent);
    assert.equal(tracker.isDirty(parent), false);
    tracker.rememberChildNote({ id: 42 }, parent, noteIdentity);
    assert.deepEqual(tracker.getRememberedParentForNote(42), parent);
    assert.deepEqual(tracker.getRememberedParentForNote(99, noteIdentity), parent);
  });

  test('applies excluded and outdated ahead of partial', () => {
    assert.equal(resolveFreshnessDisplayState({
      excluded: true, covered: true, dirty: true, timestampOutdated: true, truncated: true,
    }), 'excluded');
    assert.equal(resolveFreshnessDisplayState({
      excluded: false, covered: true, dirty: true, timestampOutdated: false, truncated: true,
    }), 'outdated');
    assert.equal(resolveFreshnessDisplayState({
      excluded: false, covered: true, dirty: false, timestampOutdated: false, truncated: true,
    }), 'partial');
    assert.equal(resolveFreshnessDisplayState({
      excluded: false, covered: false, dirty: true, timestampOutdated: true, truncated: true,
    }), 'not-indexed');
  });

  test('filters explicit unrelated parent metadata notifications', () => {
    const fieldNames: Record<number, string> = { 1: 'title', 2: 'date' };
    const resolve = (id: number) => fieldNames[id];
    assert.equal(notificationAffectsIndexedMetadata('modify', 7, { 7: { changed: { tags: [] } } }, resolve), true);
    assert.equal(notificationAffectsIndexedMetadata('modify', 7, { 7: { changed: { 1: 'old' } } }, resolve), true);
    assert.equal(notificationAffectsIndexedMetadata('modify', 7, { 7: { changed: { 2: 'old' } } }, resolve), false);
    assert.equal(notificationAffectsIndexedMetadata('modify', 7, { 7: {} }, resolve, false), false);
  });
});

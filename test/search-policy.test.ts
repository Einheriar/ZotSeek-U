import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allocatePrimaryWithAlternateTail,
  analyzeMetadataIdentity,
  classifyMetadataIdentity,
  normalizeProductIndexingMode,
  resolveProductHybridPolicy,
} from '../src/core/search-policy';

describe('indexing-mode product search policy', () => {
  test('selects the three defaults while preserving explicit overrides', () => {
    assert.equal(resolveProductHybridPolicy('abstract'), 'abstract-identity-semantic');
    assert.equal(resolveProductHybridPolicy('notes'), 'notes-identity-h1');
    assert.equal(resolveProductHybridPolicy('full'), 'full-identity-notes2-pdf');
    assert.equal(resolveProductHybridPolicy('full', 'semantic'), 'explicit-semantic');
    assert.equal(resolveProductHybridPolicy('notes', 'keyword'), 'explicit-keyword');
    assert.equal(normalizeProductIndexingMode('translated-label'), 'abstract');
  });

  test('implements Notes-2 then PDF-tail with de-duplication and fallback', () => {
    const notes = ['N1', 'DUP', 'N3', 'N4'];
    const pdf = ['DUP', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];
    assert.deepEqual(
      allocatePrimaryWithAlternateTail(notes, pdf, 10, 2, value => value),
      ['N1', 'DUP', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'],
    );
    assert.deepEqual(
      allocatePrimaryWithAlternateTail(['N1', 'N2', 'N3'], ['P1'], 5, 2, value => value),
      ['N1', 'N2', 'P1', 'N3'],
    );
    assert.deepEqual(
      allocatePrimaryWithAlternateTail(['N1', 'N2'], ['P1', 'P2'], 1, 2, value => value),
      ['N1'],
    );
  });
});

describe('metadata identity navigation', () => {
  const candidates = [
    {
      id: 'A',
      title: 'A Semantic Anchor Study',
      doi: '10.1000/anchor',
      year: '2020',
      creators: [{ firstName: 'Ada', lastName: 'Lovelace' }],
    },
    {
      id: 'B',
      title: 'Reliable Notes on Neural Oscillation',
      doi: '10.1000/notes',
      year: '2021',
      creators: [{ firstName: 'Ada', lastName: 'Lovelace' }],
    },
    {
      id: 'C',
      title: 'Unrelated Document',
      year: '2019',
      creators: [{ firstName: 'Bruno', lastName: 'Smith' }],
    },
  ];

  test('grants DOI, exact title and distinctive title-fragment navigation', () => {
    assert.deepEqual(classifyMetadataIdentity('https://doi.org/10.1000/notes', candidates)?.candidates.map(x => x.id), ['B']);
    assert.deepEqual(classifyMetadataIdentity('A Semantic Anchor Study', candidates)?.candidates.map(x => x.id), ['A']);
    assert.deepEqual(classifyMetadataIdentity('Notes on Neural Oscillation', candidates)?.candidates.map(x => x.id), ['B']);
  });

  test('treats author and author-year as collections', () => {
    const author = classifyMetadataIdentity('Ada Lovelace', candidates);
    assert.equal(author?.kind, 'author-set');
    assert.deepEqual(author?.candidates.map(x => x.id), ['A', 'B']);
    const authorYear = classifyMetadataIdentity('Ada Lovelace 2021', candidates);
    assert.equal(authorYear?.kind, 'author-year-set');
    assert.deepEqual(authorYear?.candidates.map(x => x.id), ['B']);
  });

  test('abstains for year-only, weak fragments and ambiguous title phrases', () => {
    assert.equal(classifyMetadataIdentity('2021', candidates), null);
    assert.equal(classifyMetadataIdentity('Study', candidates), null);
    assert.equal(classifyMetadataIdentity('Neural Oscillation', candidates), null);
    assert.equal(classifyMetadataIdentity('Li', [{
      id: 'D', title: 'Different Work', year: '2022',
      creators: [{ firstName: 'Ming', lastName: 'Li' }],
    }]), null);
    assert.equal(classifyMetadataIdentity('Reliable Notes on', [
      candidates[1],
      { ...candidates[1], id: 'D', title: 'Reliable Notes on Another Topic' },
    ]), null);
  });

  test('marks only queries whose result could change under a narrower candidate gate', () => {
    assert.equal(analyzeMetadataIdentity('unrelated concept query', candidates).hasPotentialMatch, false);
    assert.equal(analyzeMetadataIdentity('A Semantic Anchor Study', candidates).hasPotentialMatch, true);
    assert.deepEqual(analyzeMetadataIdentity('Reliable Notes on', [
      candidates[1],
      { ...candidates[1], id: 'D', title: 'Reliable Notes on Another Topic' },
    ]), { match: null, hasPotentialMatch: true });
  });
});

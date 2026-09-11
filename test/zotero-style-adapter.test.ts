import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { installZoteroStub } from './helpers/zotero-stub';
import { readZoteroStyleJournalMetrics } from '../src/server/zotero-style-adapter';

describe('optional Zotero Style journal metrics', () => {
  test('omits enrichment when Style is absent or its cache is not ready', async () => {
    const zotero = installZoteroStub();
    assert.equal(await readZoteroStyleJournalMetrics({ key: 'ITEM0001' }), undefined);

    zotero.ZoteroStyle = {
      data: { views: { localStorage: { get: () => ({ sciif: '8.9', sci: 'Q1' }) } } },
    };
    assert.equal(await readZoteroStyleJournalMetrics({ key: 'ITEM0001' }), undefined);
  });

  test('normalizes the legacy runtime cache without refreshing', async () => {
    const zotero = installZoteroStub();
    const calls: Array<[string, string]> = [];
    zotero.ZoteroStyle = {
      data: {
        views: {
          localStorage: {
            cache: {},
            get: (item: { key: string }, key: string) => {
              calls.push([item.key, key]);
              return { sciif: '8.90', sci: ' q1 ' };
            },
          },
        },
      },
    };

    assert.deepEqual(await readZoteroStyleJournalMetrics({ key: 'ITEM0001' }), {
      provider: 'zotero-style',
      impactFactor: 8.9,
      sciQuartile: 'Q1',
    });
    assert.deepEqual(calls, [['ITEM0001', 'publication']]);
  });

  test('reads Style 6 rank data by its configured publication title', async () => {
    const zotero = installZoteroStub({
      'zoterostyle.publicationColumn.fields': 'conferenceName, publicationTitle',
    });
    zotero.ZoteroStyle = { api: {} };
    zotero.DataDirectory = { dir: 'D:/Zotero_file/' };
    const paths: string[] = [];
    zotero.File = {
      getContentsAsync: async (path: string) => {
        paths.push(path);
        return JSON.stringify({
          'Conference on Tests': { rank: { sciif: '7.40', sci: ' q3 ' } },
          'Journal of Tests': { rank: { sciif: '1.2', sci: 'Q4' } },
        });
      },
    };
    const item = {
      getField: (field: string) => field === 'conferenceName'
        ? 'Conference on Tests'
        : field === 'publicationTitle' ? 'Journal of Tests' : '',
    };

    assert.deepEqual(await readZoteroStyleJournalMetrics(item), {
      provider: 'zotero-style',
      impactFactor: 7.4,
      sciQuartile: 'Q3',
    });
    assert.deepEqual(await readZoteroStyleJournalMetrics(item), {
      provider: 'zotero-style',
      impactFactor: 7.4,
      sciQuartile: 'Q3',
    });
    assert.deepEqual(paths, ['D:/Zotero_file/zoterostyle.json']);
  });

  test('uses AddonManager when another extension global is compartment-hidden', async () => {
    const zotero = installZoteroStub();
    zotero.DataDirectory = { dir: 'D:/Zotero_file' };
    zotero.File = {
      getContentsAsync: async () => JSON.stringify({
        'Journal of Tests': { rank: { sciif: '4.2', sci: 'Q2' } },
      }),
    };
    const imports: string[] = [];
    (globalThis as any).ChromeUtils = {
      importESModule: (uri: string) => {
        imports.push(uri);
        return { AddonManager: { getAddonByID: async () => ({ isActive: true }) } };
      },
    };
    const item = {
      getField: (field: string) => field === 'publicationTitle' ? 'Journal of Tests' : '',
    };

    try {
      assert.deepEqual(await readZoteroStyleJournalMetrics(item), {
        provider: 'zotero-style',
        impactFactor: 4.2,
        sciQuartile: 'Q2',
      });
      assert.deepEqual(imports, ['resource://gre/modules/AddonManager.sys.mjs']);
    } finally {
      delete (globalThis as any).ChromeUtils;
    }
  });

  test('returns partial data and rejects malformed cached values', async () => {
    const zotero = installZoteroStub();
    let cachedValue: { sciif: unknown; sci: unknown } = { sciif: '', sci: 'Q2' };
    const storage = {
      cache: {},
      get: () => cachedValue,
    };
    zotero.ZoteroStyle = { data: { views: { localStorage: storage } } };
    assert.deepEqual(await readZoteroStyleJournalMetrics({ key: 'ITEM0001' }), {
      provider: 'zotero-style',
      sciQuartile: 'Q2',
    });

    cachedValue = { sciif: 0, sci: 'Q5' };
    assert.deepEqual(await readZoteroStyleJournalMetrics({ key: 'ITEM0001' }), {
      provider: 'zotero-style',
      impactFactor: 0,
    });

    cachedValue = { sciif: '-1', sci: '一区' };
    assert.equal(await readZoteroStyleJournalMetrics({ key: 'ITEM0001' }), undefined);

    cachedValue = { sciif: 'Infinity', sci: null };
    assert.equal(await readZoteroStyleJournalMetrics({ key: 'ITEM0001' }), undefined);
  });

  test('contains incompatible Style failures', async () => {
    const zotero = installZoteroStub();
    zotero.ZoteroStyle = {
      data: {
        views: {
          localStorage: {
            cache: {},
            get: () => { throw new Error('Style changed its internal storage'); },
          },
        },
      },
    };
    assert.equal(await readZoteroStyleJournalMetrics({ key: 'ITEM0001' }), undefined);
  });
});

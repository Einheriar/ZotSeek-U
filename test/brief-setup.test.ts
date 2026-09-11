import './helpers/zotero-stub';
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { installZoteroStub } from './helpers/zotero-stub';
import {
  BRIEF_SETUP_VERSION,
  getBriefSetupSnapshot,
  markBriefSetupChoice,
} from '../src/core/brief-setup';
import { BRIEF_ENABLED_PREF, BriefService } from '../src/core/brief-service';
import { briefPromptStore } from '../src/core/brief-prompt-store';

describe('brief first-use setup', () => {
  beforeEach(() => installZoteroStub());

  test('reads and writes the same absolute enabled preference branch', () => {
    const zotero = installZoteroStub();
    const keyFor = (key: string, global?: boolean) => global ? key : `extensions.zotero.${key}`;
    zotero.Prefs.get = (key: string, global?: boolean) => zotero.prefs.get(keyFor(key, global));
    zotero.Prefs.set = (key: string, value: unknown, global?: boolean) => {
      zotero.prefs.set(keyFor(key, global), value);
    };
    const service = new BriefService();
    assert.equal(service.isEnabled(), false);
    service.setEnabled(true);
    assert.equal(service.isEnabled(), true);
    assert.equal(zotero.prefs.get(BRIEF_ENABLED_PREF), true);
    service.setEnabled(false);
    assert.equal(service.isEnabled(), false);
  });

  test('validates settings before cancelling active work', () => {
    const service = new BriefService();
    let cancellations = 0;
    (service as any).cancelAll = () => { cancellations++; };

    assert.throws(() => service.updateSettings({
      modelName: '',
      maxInputTokens: 32000,
      maxOutputTokens: 8192,
      thinkingEnabled: false,
    }), /model name/i);
    assert.equal(cancellations, 0);

    service.updateSettings({
      modelName: 'brief-model',
      maxInputTokens: 32000,
      maxOutputTokens: 8192,
      thinkingEnabled: false,
    });
    assert.equal(cancellations, 1);
  });

  test('distinguishes disabled, service and prompt setup states', () => {
    assert.equal(getBriefSetupSnapshot({
      enabled: false,
      connectionVerified: false,
      promptsAvailable: true,
    }).status, 'disabled');
    assert.equal(getBriefSetupSnapshot({
      enabled: true,
      connectionVerified: false,
      promptsAvailable: true,
    }).status, 'service_required');
    assert.equal(getBriefSetupSnapshot({
      enabled: true,
      connectionVerified: true,
      promptsAvailable: true,
    }).status, 'prompts_required');
  });

  test('requires an explicit built-in, customized or imported choice', () => {
    for (const choice of ['bundled', 'customized', 'imported'] as const) {
      installZoteroStub();
      markBriefSetupChoice(choice);
      const snapshot = getBriefSetupSnapshot({
        enabled: true,
        connectionVerified: true,
        promptsAvailable: true,
      });
      assert.equal(snapshot.status, 'ready');
      assert.equal(snapshot.choice, choice);
    }
  });

  test('keeps setup incomplete when prompts disappear and detects damaged state', () => {
    const zotero = installZoteroStub();
    markBriefSetupChoice('customized');
    assert.equal(getBriefSetupSnapshot({
      enabled: true,
      connectionVerified: true,
      promptsAvailable: false,
    }).status, 'prompts_required');

    zotero.prefs.set('zotseek.brief.setup.choice', 'unknown-choice');
    const damaged = getBriefSetupSnapshot({
      enabled: true,
      connectionVerified: true,
      promptsAvailable: true,
    });
    assert.equal(damaged.status, 'damaged');
    assert.equal(damaged.damageReason, 'choice');
  });

  test('distinguishes future setup versions and damaged prompt storage', () => {
    const zotero = installZoteroStub();
    zotero.prefs.set('zotseek.brief.setup.choice', 'bundled');
    zotero.prefs.set('zotseek.brief.setup.version', BRIEF_SETUP_VERSION + 1);
    const futureVersion = getBriefSetupSnapshot({
      enabled: true,
      connectionVerified: true,
      promptsAvailable: true,
    });
    assert.equal(futureVersion.status, 'damaged');
    assert.equal(futureVersion.damageReason, 'version');

    zotero.prefs.set('zotseek.brief.setup.version', 'not-a-version');
    const malformedVersion = getBriefSetupSnapshot({
      enabled: true,
      connectionVerified: true,
      promptsAvailable: true,
    });
    assert.equal(malformedVersion.status, 'damaged');
    assert.equal(malformedVersion.damageReason, 'version');

    zotero.prefs.set('zotseek.brief.setup.version', BRIEF_SETUP_VERSION);
    const damagedPrompts = getBriefSetupSnapshot({
      enabled: true,
      connectionVerified: true,
      promptsAvailable: false,
      promptsDamaged: true,
    });
    assert.equal(damagedPrompts.status, 'damaged');
    assert.equal(damagedPrompts.damageReason, 'prompts');
  });

  test('keeps a damaged active prompt profile recoverable through status', async () => {
    const zotero = installZoteroStub();
    zotero.prefs.set(BRIEF_ENABLED_PREF, true);
    markBriefSetupChoice('customized');
    const originalLoadRequired = briefPromptStore.loadRequired;
    const originalLoadBundledRequired = briefPromptStore.loadBundledRequired;
    (briefPromptStore as any).loadRequired = async () => {
      throw new Error('active prompt integrity failure');
    };
    (briefPromptStore as any).loadBundledRequired = async () => ({
      standard: {
        slot: 'standard', source: 'bundled', content: '# standard',
        hash: 'a'.repeat(64), byteLength: 10, path: 'chrome://standard.md',
      },
      review: {
        slot: 'review', source: 'bundled', content: '# review',
        hash: 'b'.repeat(64), byteLength: 8, path: 'chrome://review.md',
      },
    });
    try {
      const status = await new BriefService().getStatus();
      assert.equal(status.setup.status, 'damaged');
      assert.equal(status.setup.damageReason, 'prompts');
      assert.equal(status.prompts.standard.source, 'bundled');
      assert.equal(status.prompts.review.source, 'bundled');
    } finally {
      (briefPromptStore as any).loadRequired = originalLoadRequired;
      (briefPromptStore as any).loadBundledRequired = originalLoadBundledRequired;
    }
  });

  test('requires revalidation after provider service changes without losing the choice', () => {
    markBriefSetupChoice('bundled');
    const snapshot = getBriefSetupSnapshot({
      enabled: true,
      connectionVerified: false,
      promptsAvailable: true,
    });
    assert.equal(snapshot.status, 'service_required');
    assert.equal(snapshot.choice, 'bundled');
  });
});

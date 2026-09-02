import { test } from 'node:test';
import assert from 'node:assert/strict';

test('stable progress exposes a localized one-shot safe-stop control', async () => {
  const attrs = new Map<string, string>();
  const listeners = new Map<string, () => void>();
  let appendedButton: any = null;
  let closeCalls = 0;

  const button = {
    setAttribute: (name: string, value: string) => attrs.set(name, value),
    removeAttribute: (name: string) => attrs.delete(name),
    addEventListener: (name: string, listener: () => void) => listeners.set(name, listener),
  };
  const headline = {
    appendChild: (element: any) => { appendedButton = element; },
    getBoundingClientRect: () => ({ height: 20 }),
  };
  const textBox = { querySelectorAll: () => [] };
  const fakeWindow: any = {
    closed: false,
    outerHeight: 120,
    outerWidth: 320,
    screenX: 0,
    screenY: 0,
    screen: { availTop: 0 },
    resizeTo: () => undefined,
    moveTo: () => undefined,
  };
  const fakeDocument: any = {
    defaultView: fakeWindow,
    getElementById: (id: string) => {
      if (id === 'zotero-progress-text-headline') return headline;
      if (id === 'zotero-progress-text-box') return textBox;
      return null;
    },
    createXULElement: () => button,
  };
  fakeWindow.document = fakeDocument;

  class FakeItemProgress {
    _hbox = { ownerDocument: fakeDocument };
    _image = { dataset: {}, style: { backgroundImage: '' } };
    setProgress(): void { /* no-op */ }
    setText(): void { /* no-op */ }
    setItemTypeAndIcon(): void { /* no-op */ }
  }

  class FakeProgressWindow {
    ItemProgress = FakeItemProgress;
    changeHeadline(): void { /* no-op */ }
    show(): void { /* no-op */ }
    close(): void { closeCalls++; }
    startCloseTimer(): void { /* no-op */ }
  }

  const previousZotero = (globalThis as any).Zotero;
  (globalThis as any).Zotero = {
    ProgressWindow: FakeProgressWindow,
    getMainWindow: () => ({
      screenY: 0,
      outerHeight: 800,
      setTimeout: (callback: () => void) => callback(),
    }),
    debug: () => undefined,
    logError: () => undefined,
  };

  try {
    const { StableProgressWindow } = await import('../src/utils/stable-progress');
    let stopRequests = 0;
    const progress = new StableProgressWindow({
      title: '索引',
      stopLabel: '暂停索引',
      stoppingLabel: '正在暂停…',
      stopTooltip: '稍后继续',
      stopCallback: () => { stopRequests++; },
    });

    assert.equal(appendedButton, button);
    assert.equal(attrs.get('label'), '暂停索引');
    assert.equal(attrs.get('tooltiptext'), '稍后继续');

    listeners.get('command')?.();
    assert.equal(stopRequests, 1);
    assert.equal(progress.isStopRequested(), true);
    assert.equal(attrs.get('label'), '正在暂停…');
    assert.equal(attrs.get('disabled'), 'true');

    listeners.get('click')?.();
    assert.equal(stopRequests, 1);

    progress.markStopped();
    assert.equal(closeCalls, 1);
  } finally {
    (globalThis as any).Zotero = previousZotero;
  }
});

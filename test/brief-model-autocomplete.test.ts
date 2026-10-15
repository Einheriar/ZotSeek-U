import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { attachBriefModelAutocomplete } from '../src/ui/brief-model-autocomplete';

describe('brief native autocomplete bridge', () => {
  it('isolates providers, preserves model IDs, commits free typing and releases registrations', () => {
    const globals = globalThis as any;
    const previous = [globals.Components, globals.ChromeUtils, globals.Services];
    const registered = new Map<string, any>();
    let nextId = 0;
    const registrar = {
      registerFactory(cid: any, _title: string, _contract: string, factory: any) {
        registered.set(String(cid), factory);
      },
      unregisterFactory(cid: any) { registered.delete(String(cid)); },
    };
    globals.ChromeUtils = { generateQI: () => function (this: any) { return this; } };
    globals.Services = { uuid: { generateUUID: () => `{${++nextId}}` } };
    globals.Components = {
      manager: { QueryInterface: () => registrar },
      interfaces: { nsIAutoCompleteResult: { RESULT_SUCCESS: 1, RESULT_NOMATCH: 2 } },
      classes: {
        '@mozilla.org/autocomplete/simple-result;1': { createInstance: () => ({
          matches: [] as any[], matchCount: 0,
          setSearchString() {}, setDefaultIndex() {}, setSearchResult() {},
          appendMatch(...args: any[]) { this.matches.push(args); this.matchCount++; },
        }) },
      },
    };
    const field = () => {
      const events = new Map<string, Array<() => void>>();
      const unload = new Set<() => void>();
      let saved = 0;
      const input: any = {
        value: '', isConnected: true, setAttribute() {}, detachController() {},
        attachController() {}, mController: { startSearch() {} },
        addEventListener(name: string, callback: () => void) {
          events.set(name, [...events.get(name) || [], callback]);
        },
        dispatchEvent(event: any) { for (const callback of events.get(event.type) || []) callback(); },
      };
      const doc: any = {
        defaultView: {
          customElements: { get: () => true }, Event: class { constructor(public type: string) {} },
          addEventListener(_name: string, callback: () => void) { unload.add(callback); },
          removeEventListener(_name: string, callback: () => void) { unload.delete(callback); },
        },
        getElementById: () => ({ attributes: [], value: 'original-model', replaceWith() {} }),
        createElementNS: () => input,
      };
      return { input, doc, unload, saved: () => saved,
        onSave() { input.addEventListener('change', () => { saved++; }); } };
    };
    try {
      const a = field();
      const b = field();
      let models = [{ id: 'deepseek-v4.1-flash', displayName: 'DeepSeek-V4.1-Flash 中文模型', verifiedCapability: true }];
      const first = attachBriefModelAutocomplete(a.doc, 'a', () => models);
      const second = attachBriefModelAutocomplete(b.doc, 'b', () => [
        { id: 'model-b', verifiedCapability: true },
      ]);
      assert.equal(registered.size, 2);
      const search = (factory: any, query: string) => {
        let result: any;
        factory.startSearch(query, '', null, { onSearchResult(_source: any, value: any) { result = value; } });
        return result.matches;
      };
      const factories = [...registered.values()];
      const matches = search(factories[0], '中文');
      assert.equal(matches[0][0], 'deepseek-v4.1-flash');
      assert.equal(matches[0][5], 'deepseek-v4.1-flash');
      assert.equal(matches[0][4], 'deepseek-v4.1-flash', 'finalCompleteValue must be the ID, not the display label');
      assert.equal(matches[0][2], '', 'image must not receive a popup style');
      assert.equal(matches[0][3], 'generic');
      assert.match(JSON.parse(matches[0][1]).secondary, /DeepSeek-V4.1-Flash 中文模型/);
      // Emulate native final-value completion before the change handler saves.
      a.input.value = matches[0][4];
      a.input.dispatchEvent({ type: 'textEntered' });
      assert.equal(a.input.value, 'deepseek-v4.1-flash');
      assert.equal(search(factories[1], 'deepseek-v4.1-flash').length, 0);
      models = [{ id: 'new-provider-model', displayName: '', verifiedCapability: true }];
      assert.equal(search(factories[0], 'deepseek-v4.1-flash').length, 0);
      assert.equal(search(factories[0], 'new-provider')[0][0], 'new-provider-model');

      a.onSave();
      a.input.value = 'unlisted-custom-model';
      a.input.dispatchEvent({ type: 'blur' });
      assert.equal(a.saved(), 1);
      assert.equal(a.input.value, 'unlisted-custom-model');
      a.input.dispatchEvent({ type: 'blur' });
      assert.equal(a.saved(), 1, 'unchanged blur must not save twice');
      a.input.value = 'selected-model';
      a.input.dispatchEvent({ type: 'textEntered' });
      assert.equal(a.saved(), 2);
      first.destroy();
      first.destroy();
      assert.equal(registered.size, 1);
      for (const callback of b.unload) callback();
      assert.equal(registered.size, 0);
      second.destroy();
    } finally {
      [globals.Components, globals.ChromeUtils, globals.Services] = previous;
    }
  });
});

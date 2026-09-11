/** Bridge provider model suggestions to Zotero's chrome-window autocomplete. */
import { filterBriefModelSuggestions, type BriefModelSuggestion } from '../core/brief-model-discovery';
import { getString } from '../utils/locale';

declare const Components: any;
declare const ChromeUtils: any;
declare const Services: any;

export interface BriefModelAutocomplete {
  refresh(): void;
  destroy(): void;
}

export function attachBriefModelAutocomplete(
  doc: Document,
  id: string,
  suggestions: () => readonly BriefModelSuggestion[],
): BriefModelAutocomplete {
  const win = doc.defaultView as any;
  const original = doc.getElementById(id) as HTMLInputElement;
  if (!original) throw new Error('Missing brief model input: ' + id);
  // Plain HTML datalist uses content actors, unavailable in a chrome window.
  // Register the lazy native element before constructing its HTML extension.
  if (!win.customElements.get('autocomplete-input')) (doc as any).createXULElement('autocomplete-input');
  const input = (doc as any).createElementNS('http://www.w3.org/1999/xhtml', 'input', {
    is: 'autocomplete-input',
  });
  for (const attribute of Array.from(original.attributes)) {
    if (attribute.name !== 'list') input.setAttribute(attribute.name, attribute.value);
  }
  const { classes: Cc, interfaces: Ci } = Components;
  const registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
  const cid = Services.uuid.generateUUID();
  const name = 'zotseek-brief-' + cid.toString().replace(/[{}]/g, '');
  let disposed = false;
  const factory = {
    QueryInterface: ChromeUtils.generateQI(['nsIFactory', 'nsIAutoCompleteSearch']),
    createInstance(iid: any) { return this.QueryInterface(iid); },
    stopSearch() { /* Searches only filter the current in-memory provider list. */ },
    startSearch(query: string, _params: string, _previous: any, listener: any) {
      const result = Cc['@mozilla.org/autocomplete/simple-result;1']
        .createInstance(Ci.nsIAutoCompleteSimpleResult);
      result.setSearchString(query);
      result.setDefaultIndex(-1);
      for (const model of disposed ? [] : filterBriefModelSuggestions(suggestions(), query)) {
        const display = model.displayName && model.displayName !== model.id
          ? `${model.id} — ${model.displayName}` : model.id;
        const label = model.verifiedCapability
          ? display : `${display} · ${getString('pref-brief-model-needs-test')}`;
        // Display labels must never replace the provider's exact model ID.
        result.appendMatch(model.id, '', '', '', label, model.id);
      }
      result.setSearchResult(result.matchCount
        ? Ci.nsIAutoCompleteResult.RESULT_SUCCESS : Ci.nsIAutoCompleteResult.RESULT_NOMATCH);
      listener.onSearchResult(this, result);
    },
  };
  // Each field owns its search provider; no shared "simple" result can leak
  // between preferences, the wizard, or Zotero's own autocomplete controls.
  registrar.registerFactory(cid, 'ZotSeek brief model suggestions',
    '@mozilla.org/autocomplete/search;1?name=' + name, factory);
  const controller: BriefModelAutocomplete = {
    refresh() {
      if (!disposed && input.isConnected && doc.activeElement === input) {
        input.attachController();
        input.mController.startSearch(input.value);
      }
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      try {
        if (input._popup) input.closePopup();
        input.detachController();
      } finally {
        registrar.unregisterFactory(cid, factory);
        win.removeEventListener('unload', controller.destroy);
      }
    },
  };
  try {
    input.setAttribute('autocompletesearch', name);
    input.setAttribute('maxrows', '6');
    input.setAttribute('completedefaultindex', 'false');
    input.setAttribute('forcecomplete', 'false');
    input.setAttribute('notifylegacyevents', 'true');
    input.value = original.value;
    original.replaceWith(input);
    let committedValue = input.value;
    input.addEventListener('change', () => { committedValue = input.value; });
    const commit = () => {
      if (input.value !== committedValue) {
        input.dispatchEvent(new win.Event('change', { bubbles: true }));
      }
    };
    // Chrome autocomplete completion and free typing do not consistently emit
    // the ordinary HTML change event. Preserve both existing save paths.
    input.addEventListener('textEntered', commit);
    input.addEventListener('blur', commit);
    win.addEventListener('unload', controller.destroy, { once: true });
  } catch (error) {
    controller.destroy();
    throw error;
  }
  return controller;
}

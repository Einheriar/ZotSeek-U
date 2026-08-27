/** Shared modal prompt for explicit UI actions that require a ready Server model. */

import { getString } from '../utils/locale';
import {
  formatServerModelConfigErrors,
  getSelectedServerModelConfigurationIssue,
} from '../core/server-model-config';

declare const Services: any;
declare const Zotero: any;

export function showServerModelConfigurationPromptIfNeeded(): boolean {
  const issue = getSelectedServerModelConfigurationIssue();
  if (!issue) return false;
  const win = typeof Zotero !== 'undefined' ? Zotero.getMainWindow?.() : null;
  Services.prompt.alert(
    win || null,
    getString('serverConfigRequiredTitle'),
    getString('serverConfigRequiredMessage', {
      state: issue.state,
      path: issue.path,
      errors: formatServerModelConfigErrors(issue.errors),
    }),
  );
  return true;
}

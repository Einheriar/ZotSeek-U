/**
 * ZotSeek Search Dialog with VirtualizedTable
 * Provides a UI for semantic search queries using native Zotero table
 */

import { Logger } from '../utils/logger';
import { searchEngine, SearchResult } from '../core/search-engine';
import { ZoteroAPI } from '../utils/zotero-api';
import { getZotero } from '../utils/zotero-helper';

declare const Zotero: any;
declare const Services: any;
declare const Components: any;

export class ZotSeekDialogWithVTable {
  private logger: Logger;
  private zoteroAPI: ZoteroAPI;
  private window: any = null;
  private searchResults: SearchResult[] = [];
  
  constructor() {
    this.logger = new Logger('ZotSeekDialogVTable');
    this.zoteroAPI = new ZoteroAPI();
  }

  /**
   * Open the semantic search dialog with VirtualizedTable
   * @param initialQuery - Optional query to pre-fill and auto-search (e.g., from PDF text selection)
   * @param excludeItemId - Optional item ID to exclude from results (e.g., the paper being read)
   */
  public open(initialQuery?: string, excludeItemId?: number): void {
    try {
      if (this.isWindowOpen()) {
        // Bring existing window to front
        this.window.focus();

        // Reuse the controller contract rather than duplicating its input IDs.
        // Exclusion is applied even when no new query text was supplied.
        if (initialQuery !== undefined || excludeItemId !== undefined) {
          (this.window as any).searchDialogVTable?.setInitialSearch?.(
            initialQuery || '',
            excludeItemId,
          );
        }
        return;
      }

      const Z = getZotero();
      if (!Z) {
        this.logger.error('Zotero not available');
        return;
      }

      // Open dialog window with VirtualizedTable version
      // Pass initialQuery and excludeItemId as window arguments
      this.window = Z.getMainWindow().openDialog(
        'chrome://zotseek/content/searchDialogVTable.xhtml',
        'zotseek-dialog-vtable',
        'chrome,centerscreen,resizable,dialog=no',
        {
          initialQuery: initialQuery || '',
          excludeItemId: excludeItemId
        }
      );

      this.logger.info(`Search dialog opened${initialQuery ? ' with initial query' : ''}${excludeItemId ? ` (excluding item ${excludeItemId})` : ''}`);
    } catch (error) {
      this.logger.error('Failed to open search dialog:', error);
      this.showError('Failed to open search dialog');
    }
  }

  /**
   * Check if the search window is open
   */
  private isWindowOpen(): boolean {
    return this.window && !this.window.closed && !Components.utils.isDeadWrapper(this.window);
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    const Z = getZotero();
    if (!Z) return;

    const ps = Services.prompt || Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);
    
    ps.alert(
      Z.getMainWindow(),
      'ZotSeek Error',
      message
    );
  }
}

// Export singleton instance
export const searchDialogWithVTable = new ZotSeekDialogWithVTable();

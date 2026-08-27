/**
 * ZotSeek Search Dialog
 * Provides a UI for semantic search queries
 */

import { Logger } from '../utils/logger';
import { searchEngine, SearchResult } from '../core/search-engine';
import { ZoteroAPI } from '../utils/zotero-api';
import { showServerModelConfigurationPromptIfNeeded } from './server-model-prompt';

declare const Zotero: any;
declare const Services: any;
declare const Components: any;

export class ZotSeekDialog {
  private logger: Logger;
  private zoteroAPI: ZoteroAPI;
  private window: any = null;
  private searchResults: SearchResult[] = [];
  
  constructor() {
    this.logger = new Logger('ZotSeekDialog');
    this.zoteroAPI = new ZoteroAPI();
  }

  /**
   * Open the semantic search dialog
   */
  public open(): void {
    try {
      if (this.isWindowOpen()) {
        // Bring existing window to front
        this.window.focus();
        return;
      }

      const windowArgs = {
        searchCallback: (query: string) => this.performSearch(query),
        openItemCallback: (itemId: number) => this.openItem(itemId),
        _initPromise: Zotero.Promise.defer(),
      };

      // Open dialog window
      this.window = Zotero.getMainWindow().openDialog(
        'chrome://zotseek/content/searchDialog.xhtml',
        'zotseek-dialog',
        'chrome,centerscreen,resizable,dialog=no',
        windowArgs
      );

      this.logger.info('Search dialog opened');
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
   * Perform semantic search
   */
  private async performSearch(query: string): Promise<SearchResult[]> {
    if (showServerModelConfigurationPromptIfNeeded()) return [];
    try {
      this.logger.info('Performing semantic search for:', query);
      
      // Show progress in the dialog
      if (this.isWindowOpen()) {
        this.window.showProgress('Initializing search engine...');
      }

      // Ensure the search engine is initialized
      if (!searchEngine.isReady()) {
        this.logger.info('Initializing embedding pipeline...');
        if (this.isWindowOpen()) {
          this.window.showProgress('Loading AI model (first time may take a few seconds)...');
        }
        await searchEngine.init();
      }

      // Show search progress
      if (this.isWindowOpen()) {
        this.window.showProgress('Searching...');
      }

      // Perform the search
      const results = await searchEngine.search(query);
      this.searchResults = results;

      // Update the dialog with results
      if (this.isWindowOpen()) {
        this.window.displayResults(results);
      }

      this.logger.info(`Found ${results.length} results`);
      return results;
    } catch (error) {
      this.logger.error('Search failed:', error);
      if (this.isWindowOpen()) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.window.showError('Search failed: ' + errorMessage);
      }
      throw error;
    }
  }

  /**
   * Open an item from search results
   */
  private openItem(itemId: number): void {
    try {
      this.zoteroAPI.selectItem(itemId);
      this.logger.info('Opened item:', itemId);
    } catch (error) {
      this.logger.error('Failed to open item:', error);
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    const ps = Services.prompt || Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);
    
    ps.alert(
      Zotero.getMainWindow(),
      'ZotSeek Error',
      message
    );
  }
}

// Export singleton instance
export const searchDialog = new ZotSeekDialog();

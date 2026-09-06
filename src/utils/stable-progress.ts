/**
 * Stable progress window implementation using zotero-plugin-toolkit
 * This replaces the crashing native implementation
 */

import { ProgressWindowHelper } from 'zotero-plugin-toolkit';
import { Logger } from './logger';

// Set default icon for all progress windows
ProgressWindowHelper.setIconURI(
  'default',
  `chrome://zotseek/content/icons/favicon.png`
);

export interface StableProgressOptions {
  title: string;
  closeOnClick?: boolean;
  cancelCallback?: () => void;
  stopCallback?: () => boolean | void;
  stopLabel?: string;
  stoppingLabel?: string;
  stopTooltip?: string;
  /** Treat a user-closing popup as cancellation while work is active. */
  cancelOnWindowClose?: boolean;
}

// Cap on visible checkpoint lines. Every createLine makes Zotero's _move()
// sizeToContent + bottom-anchor the popup, while our resizeTo keeps the top
// edge fixed, so unbounded line growth ratchets the window upward off-screen
// (issue #14). Older checkpoints rotate out instead of adding lines.
const MAX_CHECKPOINT_LINES = 4;

/**
 * Stable progress window with dynamic height sizing
 */
export class StableProgressWindow {
  private progressWindow: any;
  private progressWin: any = null; // The actual window object
  private logger: Logger;
  private cancelled = false;
  private cancelCallback?: () => void;
  private currentLine: any;
  private startTime: number;
  private stopCallback?: () => boolean | void;
  private stopLabel: string;
  private stoppingLabel: string;
  private stopTooltip: string;
  private stopState: 'running' | 'pausing' | 'paused' = 'running';
  private stopButton: any = null;
  private progressLookupWarningLogged = false;
  private cancelOnWindowClose = false;
  private closeListenerAttached = false;
  private programmaticClose = false;

  // Pause/resume state
  private paused = false;
  private resumeResolver: (() => void) | null = null;
  private pausedAt: number = 0;
  private totalPausedMs: number = 0;

  // Track checkpoint lines for reverse-order display (newest first)
  private checkpointTexts: string[] = [];
  private checkpointStartIndex: number = -1; // Index of first checkpoint line in toolkit's lines array
  private checkpointLineCount = 0; // Lines actually created (capped at MAX_CHECKPOINT_LINES)
  
  constructor(options: StableProgressOptions) {
    this.logger = new Logger('StableProgress');
    this.cancelCallback = options.cancelCallback;
    this.stopCallback = options.stopCallback;
    this.stopLabel = options.stopLabel || '';
    this.stoppingLabel = options.stoppingLabel || '';
    this.stopTooltip = options.stopTooltip || '';
    this.cancelOnWindowClose = options.cancelOnWindowClose === true;
    this.startTime = Date.now();
    
    try {
      // Create the progress window with toolkit
      this.progressWindow = new ProgressWindowHelper(options.title, {
        closeOnClick: options.closeOnClick ?? false,
        closeTime: -1, // Don't auto-close
      });
      
      // Create initial progress line
      this.currentLine = this.progressWindow.createLine({
        text: 'Initializing...',
        type: 'default',
        progress: 0,
      });
      
      // Show the window
      this.progressWindow.show();

      // Resize the window after it loads
      // Must use setTimeout because the window isn't ready immediately after show()
      const Z = (globalThis as any).Zotero;
      const mainWindow = Z?.getMainWindow?.();

      const doInitialResize = () => {
        this.ensureSize();
      };

      // Use the main window's setTimeout for reliable execution
      if (mainWindow?.setTimeout) {
        mainWindow.setTimeout(doInitialResize, 100);
      } else if (typeof setTimeout !== 'undefined') {
        setTimeout(doInitialResize, 100);
      }

      this.logger.debug(`Progress window created: ${options.title}`);
    } catch (error) {
      this.logger.error('Failed to create progress window:', error);
      // Fall back to console logging
      this.useFallback();
    }
  }
  
  /**
   * Update progress with text and percentage
   */
  updateProgress(text: string, percent?: number | null, additionalInfo?: string[]): void {
    if (this.cancelled) return;
    
    try {
      // Build the full text
      let fullText = text;
      if (additionalInfo && additionalInfo.length > 0) {
        fullText += '\n' + additionalInfo.join('\n');
      }
      
      // Update the progress line
      if (this.progressWindow && this.currentLine) {
        this.progressWindow.changeLine({
          text: fullText,
          progress: percent ?? 0,
        });
        this.ensureSize();
      } else {
        // Fallback to logging
        this.logger.info(`Progress: ${fullText} (${percent ?? 0}%)`);
      }
    } catch (error) {
      this.logger.error('Failed to update progress:', error);
      this.useFallback();
    }
  }
  
  /**
   * Set headline (title) of the progress window
   */
  setHeadline(text: string): void {
    if (this.cancelled) return;
    
    try {
      // Toolkit doesn't have changeHeadline, so we update the line text
      this.updateProgress(text, null);
    } catch (error) {
      this.logger.error('Failed to set headline:', error);
    }
  }
  
  /**
   * Add a status line with optional icon
   */
  addLine(text: string, icon?: 'chrome://zotero/skin/tick.png' | 'chrome://zotero/skin/cross.png'): void {
    if (this.cancelled) return;

    try {
      // Determine type based on icon
      let type: 'default' | 'success' | 'fail' = 'default';
      if (icon?.includes('tick')) {
        type = 'success';
      } else if (icon?.includes('cross')) {
        type = 'fail';
      }

      // Create a new line for status messages
      if (this.progressWindow) {
        this.progressWindow.createLine({
          text,
          type,
          progress: 100,
        });
        this.ensureSize();
      } else {
        this.logger.info(`Status: ${text}`);
      }
    } catch (error) {
      this.logger.error('Failed to add line:', error);
    }
  }

  /**
   * Add a checkpoint line in reverse order (newest first)
   * This keeps the most recent checkpoint visible at the top of the checkpoint section
   */
  addCheckpointLine(text: string): void {
    if (this.cancelled) return;

    try {
      if (!this.progressWindow) {
        this.logger.info(`Checkpoint: ${text}`);
        return;
      }

      // Keep only the texts that can still be displayed
      this.checkpointTexts.push(text);
      if (this.checkpointTexts.length > MAX_CHECKPOINT_LINES) {
        this.checkpointTexts.shift();
      }

      // Create a new line only while under the cap; afterwards texts rotate
      // through the existing lines so the window height stays bounded
      if (this.checkpointLineCount === 0) {
        this.checkpointStartIndex = this.progressWindow.lines?.length || 0;
      }
      if (this.checkpointLineCount < MAX_CHECKPOINT_LINES) {
        this.progressWindow.createLine({
          text: '', // Will be filled by the update below
          type: 'success',
          progress: 100,
        });
        this.checkpointLineCount++;
      }

      // Update the visible checkpoint lines in reverse order (newest first)
      for (let i = 0; i < this.checkpointLineCount; i++) {
        this.progressWindow.changeLine({
          idx: this.checkpointStartIndex + i,
          text: this.checkpointTexts[this.checkpointTexts.length - 1 - i] ?? '',
          type: 'success',
          progress: 100,
        });
      }
      this.ensureSize();
    } catch (error) {
      this.logger.error('Failed to add checkpoint line:', error);
    }
  }
  
  /**
   * Complete the progress with success message
   */
  complete(message?: string, autoClose = true): void {
    if (this.cancelled) return;
    
    try {
      if (this.progressWindow) {
        // Update to success state
        this.progressWindow.changeLine({
          text: message || 'Complete!',
          type: 'success',
          progress: 100,
        });
        this.ensureSize();

        // Auto-close after delay (15 seconds to allow reading stats)
        if (autoClose) {
          this.programmaticClose = true;
          this.progressWindow.startCloseTimer(15000);
        }
      } else {
        this.logger.info(`Complete: ${message || 'Done'}`);
      }
    } catch (error) {
      this.logger.error('Failed to complete progress:', error);
    }
  }
  
  /**
   * Show error and optionally close
   */
  error(message: string, autoClose = false): void {
    try {
      if (this.progressWindow) {
        // Update to error state
        this.progressWindow.changeLine({
          text: message,
          type: 'fail',
          progress: 100,
        });
        this.ensureSize();

        // Keep error visible longer
        if (autoClose) {
          this.programmaticClose = true;
          this.progressWindow.startCloseTimer(8000);
        }
      } else {
        this.logger.error(`Error shown: ${message}`);
      }
    } catch (error) {
      this.logger.error('Failed to show error:', error);
    }
  }
  
  /**
   * Close the progress window
   */
  close(): void {
    try {
      if (this.progressWindow) {
        this.programmaticClose = true;
        this.progressWindow.close();
        this.logger.debug('Progress window closed');
      }
    } catch (error) {
      this.logger.error('Failed to close progress window:', error);
    }
  }
  
  /**
   * Check if cancelled
   */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /** Return true after the user has requested a safe indexing stop. */
  isStopRequested(): boolean {
    return this.stopState !== 'running';
  }

  /**
   * Request a one-shot safe stop. The indexing loop owns the actual stop
   * boundary and calls markStopped() only after no more writes can begin.
   */
  requestStop(): void {
    if (this.stopState !== 'running') return;
    try {
      if (this.stopCallback?.() === false) return;
    } catch (error: any) {
      this.logger.error(`Safe indexing stop was rejected: ${error?.message || error}`);
      return;
    }
    if (this.paused) {
      this.paused = false;
      this.totalPausedMs += Date.now() - this.pausedAt;
      this.pausedAt = 0;
    }
    if (this.resumeResolver) {
      this.resumeResolver();
      this.resumeResolver = null;
    }
    this.stopState = 'pausing';
    this.logger.info('Safe indexing stop requested by user');
    this.updateStopButtonState();
  }

  /** Mark the task stopped and close only this progress window. */
  markStopped(): void {
    if (this.stopState === 'running') return;
    this.stopState = 'paused';
    this.updateStopButtonState();
    this.close();
  }
  
  /**
   * Cancel the operation
   */
  cancel(): void {
    this.cancelled = true;
    this.paused = false;
    this.logger.info('Progress cancelled by user');

    // Unblock waitIfPaused() so the loop can reach the cancel check
    if (this.resumeResolver) {
      this.resumeResolver();
      this.resumeResolver = null;
    }

    if (this.cancelCallback) {
      this.cancelCallback();
    }

    this.close();
  }

  /**
   * Pause the operation
   */
  pause(): void {
    if (this.paused || this.cancelled) return;
    this.paused = true;
    this.pausedAt = Date.now();
    this.logger.info('Progress paused by user');
  }

  /**
   * Resume the operation
   */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.totalPausedMs += Date.now() - this.pausedAt;
    this.pausedAt = 0;
    this.logger.info('Progress resumed by user');

    if (this.resumeResolver) {
      this.resumeResolver();
      this.resumeResolver = null;
    }
  }

  /**
   * Wait if paused. Resolves immediately if not paused.
   * Call this at checkpoint boundaries in the indexing loop.
   */
  async waitIfPaused(): Promise<void> {
    if (!this.paused) return;
    return new Promise<void>(resolve => {
      this.resumeResolver = resolve;
    });
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Fallback to console logging
   */
  private useFallback(): void {
    this.logger.warn('Using console logging fallback for progress');
    this.progressWindow = null;
  }

  /** Find the native window that owns this helper's first progress line. */
  private findProgressWindow(): any {
    // Validate cached reference is still open
    if (this.progressWin) {
      try {
        if (!this.progressWin.closed) return this.progressWin;
      } catch {
        // Window was destroyed
      }
      this.progressWin = null;
      this.stopButton = null;
    }

    try {
      // ProgressWindowHelper.win is the Zotero.ProgressWindow wrapper, whose
      // real window is private. Its ItemProgress objects do retain the exact
      // owning DOM through _hbox, avoiding locale-dependent title matching.
      const lines = (this.progressWindow as any)?.lines;
      if (Array.isArray(lines)) {
        for (const line of lines) {
          const doc = line?._hbox?.ownerDocument;
          const win = doc?.defaultView;
          if (win && !win.closed) {
            this.progressWin = win;
            this.attachCloseCancellation(win);
            this.progressLookupWarningLogged = false;
            return win;
          }
        }
      }
      if (!this.progressLookupWarningLogged) {
        this.logger.warn('Progress window DOM is not ready; controls will retry on the next update');
        this.progressLookupWarningLogged = true;
      }
    } catch (error: any) {
      if (!this.progressLookupWarningLogged) {
        this.logger.warn(`Could not resolve the exact progress window: ${error?.message || error}`);
        this.progressLookupWarningLogged = true;
      }
    }
    return null;
  }

  private attachCloseCancellation(win: any): void {
    if (!this.cancelOnWindowClose || this.closeListenerAttached) return;
    this.closeListenerAttached = true;
    win.addEventListener('unload', () => {
      if (this.programmaticClose || this.cancelled) return;
      this.cancelled = true;
      try {
        if (this.cancelCallback) this.cancelCallback();
        else this.stopCallback?.();
      } catch (error: any) {
        this.logger.error(`Progress close cancellation failed: ${error?.message || error}`);
      }
    }, { once: true });
  }

  // Window size constraints
  private readonly minHeight = 120;
  private readonly maxHeight = 400;

  /**
   * Resize window to fit content and stay within main Zotero window bounds
   */
  private ensureSize(): void {
    try {
      const win = this.findProgressWindow();
      if (!win) return;

      const doc = win.document;
      const Z = (globalThis as any).Zotero;
      const mainWindow = Z?.getMainWindow?.();

      // Calculate actual content height
      let targetHeight = win.outerHeight;
      const textBox = doc.getElementById('zotero-progress-text-box');
      if (textBox) {
        // Get all child item boxes and sum their heights
        const items = textBox.querySelectorAll('.zotero-progress-item-hbox');
        const headline = doc.getElementById('zotero-progress-text-headline');

        let contentHeight = headline ? headline.getBoundingClientRect().height : 20;
        items.forEach((item: Element) => {
          contentHeight += (item as HTMLElement).getBoundingClientRect().height + 4; // 4px gap
        });

        // Add padding
        targetHeight = Math.ceil(contentHeight) + 40; // 40px padding for margins

        // Clamp between min and max height
        targetHeight = Math.max(this.minHeight, Math.min(this.maxHeight, targetHeight));

        // ±2px tolerance: under Windows display scaling outerHeight rarely
        // round-trips resizeTo exactly, and resizing on every update feeds
        // the position drift
        if (Math.abs(win.outerHeight - targetHeight) > 2) {
          win.resizeTo(win.outerWidth, targetHeight);
        }
      }

      // Re-anchor the bottom edge to the main window bottom. Zotero's own
      // _move() bottom-anchors after sizeToContent while resizeTo above keeps
      // the top edge fixed; correcting in one direction only lets the window
      // ratchet upward off-screen (issue #14), so always re-anchor
      if (mainWindow) {
        const mainBottom = mainWindow.screenY + mainWindow.outerHeight;
        let newY = mainBottom - targetHeight - 10; // 10px padding from bottom
        const availTop = win.screen?.availTop ?? 0;
        if (newY < availTop) newY = availTop;
        if (Math.abs(win.screenY - newY) > 2) {
          win.moveTo(win.screenX, newY);
        }
      }

      // Inject the one-shot safe-stop control if this task enabled it.
      this.injectStopButton();
    } catch (error: any) {
      this.logger.debug(`Could not resize progress window: ${error?.message || error}`);
    }
  }

  /** Inject a localized one-shot safe-stop button into this exact window. */
  private injectStopButton(): void {
    if (!this.stopCallback || this.stopButton) return;
    if (!this.stopLabel || !this.stoppingLabel || !this.stopTooltip) {
      this.logger.error('Safe-stop control requires localized labels and tooltip');
      return;
    }

    try {
      const win = this.findProgressWindow();
      if (!win) return;
      const doc = win.document;
      const headline = doc.getElementById('zotero-progress-text-headline');
      if (!headline) {
        this.logger.warn('Progress headline not ready; safe-stop control will retry');
        return;
      }

      const button = typeof doc.createXULElement === 'function'
        ? doc.createXULElement('button')
        : doc.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'button');
      button.setAttribute('id', 'zotseek-stop-indexing');
      button.setAttribute('label', this.stopLabel);
      button.setAttribute('tooltiptext', this.stopTooltip);
      button.setAttribute('style', 'margin-inline-start: 8px;');
      button.addEventListener('command', () => this.requestStop());
      button.addEventListener('click', () => this.requestStop());
      headline.appendChild(button);
      this.stopButton = button;
      this.updateStopButtonState();
      this.logger.debug('Safe-stop control attached to progress window');
    } catch (error: any) {
      this.logger.warn(`Could not inject safe-stop control: ${error?.message || error}`);
    }
  }

  private updateStopButtonState(): void {
    if (!this.stopButton) return;
    try {
      const pausing = this.stopState !== 'running';
      this.stopButton.setAttribute('label', pausing ? this.stoppingLabel : this.stopLabel);
      if (pausing) this.stopButton.setAttribute('disabled', 'true');
      else this.stopButton.removeAttribute('disabled');
      this.stopButton.setAttribute('tooltiptext', pausing ? this.stoppingLabel : this.stopTooltip);
    } catch (error: any) {
      this.logger.debug(`Could not update safe-stop control: ${error?.message || error}`);
    }
  }

  /**
   * Calculate and format ETA
   */
  formatETA(current: number, total: number): string {
    if (current === 0) return '';
    
    const currentPause = this.paused ? (Date.now() - this.pausedAt) : 0;
    const elapsed = Date.now() - this.startTime - this.totalPausedMs - currentPause;
    const avgTimePerItem = elapsed / current;
    const remaining = total - current;
    const etaMs = remaining * avgTimePerItem;
    
    const etaMin = Math.floor(etaMs / 60000);
    const etaSec = Math.floor((etaMs % 60000) / 1000);
    
    return etaMin > 0 ? `${etaMin}m ${etaSec}s` : `${etaSec}s`;
  }
  
  /**
   * Update with ETA calculation
   */
  updateProgressWithETA(text: string, current: number, total: number): void {
    const percent = Math.round((current / total) * 100);
    const eta = this.formatETA(current, total);
    
    const additionalInfo = [
      `${current}/${total} items`,
      eta ? `ETA: ${eta}` : ''
    ].filter(Boolean);
    
    this.updateProgress(text, percent, additionalInfo);
  }
}

/**
 * Quick notification helper
 */
export function showQuickNotification(
  message: string,
  type: 'default' | 'success' | 'fail' = 'default',
  duration = 5000
): void {
  try {
    new ProgressWindowHelper('Semantic Search')
      .createLine({
        text: message,
        type,
        progress: 100,
      })
      .show(duration);
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

/** Pure task scheduler for manual and collection literature-brief generation. */

import {
  createBriefGenerationTaskContext,
  type BriefGenerationTaskContext,
} from './brief-generation-client';

export const BRIEF_COLLECTION_BATCH_SIZE = 3;
export type BriefSchedulerMode = 'manual' | 'collection';
export type BriefTaskStatus = 'success' | 'failed' | 'skipped' | 'cancelled';
export type BriefTaskSkipReason = 'existing-note' | 'no-text' | 'not-eligible' | 'cancelled-before-start' | 'unknown';

export interface BriefTaskSkip { status: 'skipped'; reason: BriefTaskSkipReason | string; }
export interface BriefGenerationTask<T = void> {
  /** Stable parent-item identity. */
  key: string;
  /** A pre-scan can skip a task without invoking its runner. */
  skipReason?: BriefTaskSkipReason | string;
  /** The context is shared by all stages of one task. */
  run(context?: BriefGenerationTaskContext): Promise<T | BriefTaskSkip>;
}
export interface BriefTaskOutcome<T = void> {
  key: string;
  status: BriefTaskStatus;
  value?: T;
  error?: unknown;
  reason?: BriefTaskSkipReason | string;
}
export interface BriefSchedulerCounts { success: number; failed: number; skipped: number; cancelled: number; }
export interface BriefSchedulerProgress {
  mode: BriefSchedulerMode;
  total: number;
  completed: number;
  activeKeys: string[];
  queuedKeys: string[];
  latest?: Pick<BriefTaskOutcome, 'key' | 'status' | 'reason'>;
  counts: BriefSchedulerCounts;
}
export interface BriefGenerationSchedulerDependencies {
  onProgress?: (progress: BriefSchedulerProgress) => void;
  cancelInFlight?: () => void;
}

export class BriefSchedulerBusyError extends Error {
  readonly code = 'BRIEF_SCHEDULER_BUSY' as const;
  constructor(message: string) { super(message); this.name = 'BriefSchedulerBusyError'; }
}
export class BriefSchedulerDuplicateError extends Error {
  readonly code = 'BRIEF_SCHEDULER_DUPLICATE' as const;
  constructor() { super('A literature-brief task for this parent item is already queued or running.'); this.name = 'BriefSchedulerDuplicateError'; }
}
interface PendingManualTask<T> { task: BriefGenerationTask<T>; resolve(outcome: BriefTaskOutcome<T>): void; }
function emptyCounts(): BriefSchedulerCounts { return { success: 0, failed: 0, skipped: 0, cancelled: 0 }; }
function incrementCount(counts: BriefSchedulerCounts, status: BriefTaskStatus): void {
  if (status === 'success') counts.success++;
  else if (status === 'failed') counts.failed++;
  else if (status === 'skipped') counts.skipped++;
  else counts.cancelled++;
}
function isSkip<T>(value: T | BriefTaskSkip): value is BriefTaskSkip {
  return !!value && typeof value === 'object' && (value as BriefTaskSkip).status === 'skipped'
    && typeof (value as BriefTaskSkip).reason === 'string' && !!(value as BriefTaskSkip).reason.trim();
}
function outcomeFromValue<T>(key: string, value: T | BriefTaskSkip): BriefTaskOutcome<T> {
  if (isSkip(value)) return { key, status: 'skipped', reason: value.reason };
  // Runner results are deliberately accepted at this boundary so a runner can
  // report a committed success, skip, failure, or cancellation without making
  // the scheduler mistake the discriminated result for a successful value.
  if (value && typeof value === 'object') {
    const status = (value as { status?: unknown }).status;
    if (status === 'cancelled' || status === 'failed') {
      const result = value as { reason?: unknown; error?: unknown };
      return {
        key,
        status,
        ...(typeof result.reason === 'string' ? { reason: result.reason } : {}),
        ...(result.error !== undefined ? { error: result.error } : {}),
      };
    }
  }
  return { key, status: 'success', value: value as T };
}
function assertTasks<T>(tasks: readonly BriefGenerationTask<T>[]): void {
  const keys = new Set<string>();
  for (const task of tasks) {
    if (!task || typeof task.key !== 'string' || !task.key.trim() || typeof task.run !== 'function') throw new Error('Literature-brief task is invalid.');
    if (keys.has(task.key)) throw new BriefSchedulerDuplicateError();
    keys.add(task.key);
  }
}
// The progress checkpoint line explains skips (no text, existing note) inline,
// so the latest event carries the outcome's structured reason as well.
function latestOf<T>(outcome: BriefTaskOutcome<T>): Pick<BriefTaskOutcome, 'key' | 'status' | 'reason'> {
  return { key: outcome.key, status: outcome.status, ...(outcome.reason ? { reason: outcome.reason } : {}) };
}

export class BriefGenerationScheduler<T = void> {
  private readonly manualQueue: PendingManualTask<T>[] = [];
  private manualActive: PendingManualTask<T> | null = null;
  private manualTotal = 0;
  private manualCompleted = 0;
  private manualCancelRequested = false;
  private collectionActive = false;
  private collectionCancelRequested = false;
  private collectionActiveKeys = new Set<string>();
  private activeContexts = new Set<BriefGenerationTaskContext>();
  private manualCounts = emptyCounts();
  private collectionCounts = emptyCounts();
  constructor(private readonly dependencies: BriefGenerationSchedulerDependencies = {}) {}

  private progress(progress: BriefSchedulerProgress): void {
    try {
      this.dependencies.onProgress?.({ ...progress, activeKeys: [...progress.activeKeys], queuedKeys: [...progress.queuedKeys], counts: { ...progress.counts } });
    } catch { /* UI teardown must not reject a business task or leave busy state set. */ }
  }
  isManualActive(): boolean { return this.manualActive !== null || this.manualQueue.length > 0; }
  isCollectionActive(): boolean { return this.collectionActive; }

  enqueueManual(task: BriefGenerationTask<T>): Promise<BriefTaskOutcome<T>> {
    assertTasks([task]);
    if (this.collectionActive) throw new BriefSchedulerBusyError('A collection literature-brief job is already running.');
    if (this.manualCancelRequested) throw new BriefSchedulerBusyError('Manual literature-brief cancellation is still in progress.');
    if (this.manualActive?.task.key === task.key || this.manualQueue.some(p => p.task.key === task.key)) throw new BriefSchedulerDuplicateError();
    if (!this.isManualActive()) { this.manualTotal = 0; this.manualCompleted = 0; this.manualCancelRequested = false; this.manualCounts = emptyCounts(); }
    this.manualTotal++;
    const completion = new Promise<BriefTaskOutcome<T>>(resolve => this.manualQueue.push({ task, resolve }));
    this.emitManualProgress(); void this.pumpManualQueue(); return completion;
  }
  private emitManualProgress(latest?: Pick<BriefTaskOutcome, 'key' | 'status' | 'reason'>): void {
    this.progress({ mode: 'manual', total: this.manualTotal, completed: this.manualCompleted, activeKeys: this.manualActive ? [this.manualActive.task.key] : [], queuedKeys: this.manualQueue.map(p => p.task.key), counts: this.manualCounts, ...(latest ? { latest } : {}) });
  }
  private async pumpManualQueue(): Promise<void> {
    if (this.manualActive) return;
    const pending = this.manualQueue.shift(); if (!pending) return;
    this.manualActive = pending; this.emitManualProgress();
    const context = createBriefGenerationTaskContext(); this.activeContexts.add(context);
    let outcome: BriefTaskOutcome<T>;
    try {
      if (pending.task.skipReason) outcome = { key: pending.task.key, status: 'skipped', reason: pending.task.skipReason };
      else {
        const value = await pending.task.run(context);
        outcome = outcomeFromValue(pending.task.key, value);
      }
    } catch (error) {
      outcome = { key: pending.task.key, status: this.manualCancelRequested ? 'cancelled' : 'failed', error };
    }
    this.activeContexts.delete(context); this.manualActive = null; this.manualCompleted++; incrementCount(this.manualCounts, outcome.status);
    pending.resolve(outcome); this.emitManualProgress(latestOf(outcome));
    if (this.manualQueue.length > 0) void this.pumpManualQueue(); else this.manualCancelRequested = false;
  }
  cancelManual(): void {
    if (!this.isManualActive()) return;
    this.manualCancelRequested = true; for (const context of this.activeContexts) context.cancel();
    if (this.manualActive) this.dependencies.cancelInFlight?.();
    while (this.manualQueue.length > 0) {
      const pending = this.manualQueue.shift()!; const outcome: BriefTaskOutcome<T> = { key: pending.task.key, status: 'cancelled', reason: 'cancelled-before-start' };
      this.manualCompleted++; incrementCount(this.manualCounts, outcome.status); pending.resolve(outcome); this.emitManualProgress(latestOf(outcome));
    }
  }

  async runCollection(tasks: readonly BriefGenerationTask<T>[]): Promise<BriefTaskOutcome<T>[]> {
    assertTasks(tasks);
    if (this.collectionActive) throw new BriefSchedulerBusyError('A collection literature-brief job is already running.');
    if (this.isManualActive()) throw new BriefSchedulerBusyError('Manual literature-brief tasks must finish before starting a collection job.');
    this.collectionActive = true; this.collectionCancelRequested = false; this.collectionCounts = emptyCounts();
    const outcomes: BriefTaskOutcome<T>[] = []; let completed = 0;
    try {
      for (let offset = 0; offset < tasks.length; offset += BRIEF_COLLECTION_BATCH_SIZE) {
        if (this.collectionCancelRequested) {
          const remaining = tasks.slice(offset);
          for (let index = 0; index < remaining.length; index++) {
            const outcome: BriefTaskOutcome<T> = { key: remaining[index].key, status: 'cancelled', reason: 'cancelled-before-start' };
            outcomes.push(outcome); completed++; incrementCount(this.collectionCounts, outcome.status);
            this.emitCollectionProgress(tasks.length, completed, remaining.slice(index + 1), latestOf(outcome));
          }
          break;
        }
        const batch = tasks.slice(offset, offset + BRIEF_COLLECTION_BATCH_SIZE); this.collectionActiveKeys = new Set(batch.map(task => task.key));
        this.emitCollectionProgress(tasks.length, completed, tasks.slice(offset + batch.length));
        const batchOutcomes = await Promise.all(batch.map(async task => {
          const context = createBriefGenerationTaskContext(); this.activeContexts.add(context);
          let outcome: BriefTaskOutcome<T>;
          try {
            if (task.skipReason) outcome = { key: task.key, status: 'skipped', reason: task.skipReason };
            else {
              const value = await task.run(context);
              outcome = outcomeFromValue(task.key, value);
            }
          } catch (error) {
            outcome = { key: task.key, status: this.collectionCancelRequested ? 'cancelled' : 'failed', error };
          }
          this.activeContexts.delete(context); this.collectionActiveKeys.delete(task.key); completed++; incrementCount(this.collectionCounts, outcome.status);
          this.emitCollectionProgress(tasks.length, completed, tasks.slice(offset + batch.length), latestOf(outcome)); return outcome;
        }));
        outcomes.push(...batchOutcomes);
      }
      return outcomes;
    } finally { this.collectionActiveKeys.clear(); this.activeContexts.clear(); this.collectionActive = false; this.collectionCancelRequested = false; }
  }
  private emitCollectionProgress(total: number, completed: number, queued: readonly BriefGenerationTask<T>[], latest?: Pick<BriefTaskOutcome, 'key' | 'status' | 'reason'>): void {
    this.progress({ mode: 'collection', total, completed, activeKeys: [...this.collectionActiveKeys], queuedKeys: queued.map(task => task.key), counts: this.collectionCounts, ...(latest ? { latest } : {}) });
  }
  cancelCollection(): void {
    if (!this.collectionActive) return;
    this.collectionCancelRequested = true; for (const context of this.activeContexts) context.cancel();
    if (this.collectionActiveKeys.size > 0) this.dependencies.cancelInFlight?.();
  }
}

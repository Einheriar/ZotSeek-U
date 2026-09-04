/** Pure task scheduler for manual and collection literature-brief generation. */

export const BRIEF_COLLECTION_BATCH_SIZE = 3;

export type BriefSchedulerMode = 'manual' | 'collection';
export type BriefTaskStatus = 'success' | 'failed' | 'cancelled';

export interface BriefGenerationTask<T = void> {
  /** Stable parent-item identity. */
  key: string;
  run(): Promise<T>;
}

export interface BriefTaskOutcome<T = void> {
  key: string;
  status: BriefTaskStatus;
  value?: T;
  error?: unknown;
}

export interface BriefSchedulerProgress {
  mode: BriefSchedulerMode;
  total: number;
  completed: number;
  activeKeys: string[];
  queuedKeys: string[];
  latest?: Pick<BriefTaskOutcome, 'key' | 'status'>;
}

export interface BriefGenerationSchedulerDependencies {
  onProgress?: (progress: BriefSchedulerProgress) => void;
  /** Abort the generation client's currently in-flight requests. */
  cancelInFlight?: () => void;
}

export class BriefSchedulerBusyError extends Error {
  readonly code = 'BRIEF_SCHEDULER_BUSY' as const;

  constructor(message: string) {
    super(message);
    this.name = 'BriefSchedulerBusyError';
  }
}

export class BriefSchedulerDuplicateError extends Error {
  readonly code = 'BRIEF_SCHEDULER_DUPLICATE' as const;

  constructor() {
    super('A literature-brief task for this parent item is already queued or running.');
    this.name = 'BriefSchedulerDuplicateError';
  }
}

interface PendingManualTask<T> {
  task: BriefGenerationTask<T>;
  resolve(outcome: BriefTaskOutcome<T>): void;
}

function assertTasks<T>(tasks: readonly BriefGenerationTask<T>[]): void {
  const keys = new Set<string>();
  for (const task of tasks) {
    if (!task || typeof task.key !== 'string' || !task.key.trim() ||
        typeof task.run !== 'function') {
      throw new Error('Literature-brief task is invalid.');
    }
    if (keys.has(task.key)) {
      throw new BriefSchedulerDuplicateError();
    }
    keys.add(task.key);
  }
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

  constructor(private readonly dependencies: BriefGenerationSchedulerDependencies = {}) {}

  private progress(progress: BriefSchedulerProgress): void {
    this.dependencies.onProgress?.({
      ...progress,
      activeKeys: [...progress.activeKeys],
      queuedKeys: [...progress.queuedKeys],
    });
  }

  isManualActive(): boolean {
    return this.manualActive !== null || this.manualQueue.length > 0;
  }

  isCollectionActive(): boolean {
    return this.collectionActive;
  }

  enqueueManual(task: BriefGenerationTask<T>): Promise<BriefTaskOutcome<T>> {
    assertTasks([task]);
    if (this.collectionActive) {
      throw new BriefSchedulerBusyError(
        'A collection literature-brief job is already running.',
      );
    }
    if (this.manualCancelRequested) {
      throw new BriefSchedulerBusyError(
        'Manual literature-brief cancellation is still in progress.',
      );
    }
    if (this.manualActive?.task.key === task.key ||
        this.manualQueue.some(pending => pending.task.key === task.key)) {
      throw new BriefSchedulerDuplicateError();
    }
    if (!this.isManualActive()) {
      this.manualTotal = 0;
      this.manualCompleted = 0;
      this.manualCancelRequested = false;
    }
    this.manualTotal++;
    const completion = new Promise<BriefTaskOutcome<T>>(resolve => {
      this.manualQueue.push({ task, resolve });
    });
    this.emitManualProgress();
    void this.pumpManualQueue();
    return completion;
  }

  private emitManualProgress(latest?: Pick<BriefTaskOutcome, 'key' | 'status'>): void {
    this.progress({
      mode: 'manual',
      total: this.manualTotal,
      completed: this.manualCompleted,
      activeKeys: this.manualActive ? [this.manualActive.task.key] : [],
      queuedKeys: this.manualQueue.map(pending => pending.task.key),
      ...(latest ? { latest } : {}),
    });
  }

  private async pumpManualQueue(): Promise<void> {
    if (this.manualActive) return;
    const pending = this.manualQueue.shift();
    if (!pending) return;
    this.manualActive = pending;
    this.emitManualProgress();
    let outcome: BriefTaskOutcome<T>;
    try {
      const value = await pending.task.run();
      outcome = { key: pending.task.key, status: 'success', value };
    } catch (error) {
      outcome = {
        key: pending.task.key,
        status: this.manualCancelRequested ? 'cancelled' : 'failed',
        error,
      };
    }
    this.manualActive = null;
    this.manualCompleted++;
    pending.resolve(outcome);
    this.emitManualProgress({ key: outcome.key, status: outcome.status });
    if (this.manualQueue.length > 0) {
      void this.pumpManualQueue();
    } else {
      this.manualCancelRequested = false;
    }
  }

  cancelManual(): void {
    if (!this.isManualActive()) return;
    this.manualCancelRequested = true;
    if (this.manualActive) this.dependencies.cancelInFlight?.();
    while (this.manualQueue.length > 0) {
      const pending = this.manualQueue.shift()!;
      const outcome: BriefTaskOutcome<T> = {
        key: pending.task.key,
        status: 'cancelled',
      };
      this.manualCompleted++;
      pending.resolve(outcome);
      this.emitManualProgress({ key: outcome.key, status: outcome.status });
    }
  }

  async runCollection(
    tasks: readonly BriefGenerationTask<T>[],
  ): Promise<BriefTaskOutcome<T>[]> {
    assertTasks(tasks);
    if (this.collectionActive) {
      throw new BriefSchedulerBusyError(
        'A collection literature-brief job is already running.',
      );
    }
    if (this.isManualActive()) {
      throw new BriefSchedulerBusyError(
        'Manual literature-brief tasks must finish before starting a collection job.',
      );
    }
    this.collectionActive = true;
    this.collectionCancelRequested = false;
    const outcomes: BriefTaskOutcome<T>[] = [];
    let completed = 0;
    try {
      for (let offset = 0; offset < tasks.length; offset += BRIEF_COLLECTION_BATCH_SIZE) {
        if (this.collectionCancelRequested) {
          const remaining = tasks.slice(offset);
          for (let index = 0; index < remaining.length; index++) {
            const task = remaining[index];
            const outcome: BriefTaskOutcome<T> = { key: task.key, status: 'cancelled' };
            outcomes.push(outcome);
            completed++;
            this.emitCollectionProgress(
              tasks.length,
              completed,
              remaining.slice(index + 1),
              { key: outcome.key, status: outcome.status },
            );
          }
          break;
        }
        const batch = tasks.slice(offset, offset + BRIEF_COLLECTION_BATCH_SIZE);
        this.collectionActiveKeys = new Set(batch.map(task => task.key));
        this.emitCollectionProgress(tasks.length, completed, tasks.slice(offset + batch.length));
        const batchOutcomes = await Promise.all(batch.map(async task => {
          let outcome: BriefTaskOutcome<T>;
          try {
            const value = await task.run();
            outcome = { key: task.key, status: 'success', value };
          } catch (error) {
            outcome = {
              key: task.key,
              status: this.collectionCancelRequested ? 'cancelled' : 'failed',
              error,
            };
          }
          this.collectionActiveKeys.delete(task.key);
          completed++;
          this.emitCollectionProgress(
            tasks.length,
            completed,
            tasks.slice(offset + batch.length),
            { key: outcome.key, status: outcome.status },
          );
          return outcome;
        }));
        outcomes.push(...batchOutcomes);
      }
      return outcomes;
    } finally {
      this.collectionActiveKeys.clear();
      this.collectionActive = false;
      this.collectionCancelRequested = false;
    }
  }

  private emitCollectionProgress(
    total: number,
    completed: number,
    queued: readonly BriefGenerationTask<T>[],
    latest?: Pick<BriefTaskOutcome, 'key' | 'status'>,
  ): void {
    this.progress({
      mode: 'collection',
      total,
      completed,
      activeKeys: [...this.collectionActiveKeys],
      queuedKeys: queued.map(task => task.key),
      ...(latest ? { latest } : {}),
    });
  }

  cancelCollection(): void {
    if (!this.collectionActive) return;
    this.collectionCancelRequested = true;
    if (this.collectionActiveKeys.size > 0) this.dependencies.cancelInFlight?.();
  }
}

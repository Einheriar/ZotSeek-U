import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BRIEF_COLLECTION_BATCH_SIZE,
  BriefGenerationScheduler,
  BriefSchedulerBusyError,
  BriefSchedulerDuplicateError,
  type BriefGenerationTask,
} from '../src/core/brief-generation-scheduler';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail('Expected scheduler state was not reached.');
}

describe('brief generation scheduler', () => {
  test('runs manual tasks FIFO with concurrency one and in-flight parent deduplication', async () => {
    const scheduler = new BriefGenerationScheduler<string>();
    const first = deferred<string>();
    const second = deferred<string>();
    const started: string[] = [];
    const task = (key: string, gate: ReturnType<typeof deferred<string>>) => ({
      key,
      run: async () => {
        started.push(key);
        return await gate.promise;
      },
    });
    const firstResult = scheduler.enqueueManual(task('a', first));
    const secondResult = scheduler.enqueueManual(task('b', second));
    assert.throws(
      () => scheduler.enqueueManual(task('a', deferred<string>())),
      BriefSchedulerDuplicateError,
    );
    await flush();
    assert.deepEqual(started, ['a']);
    first.resolve('A');
    assert.deepEqual(await firstResult, { key: 'a', status: 'success', value: 'A' });
    await flush();
    assert.deepEqual(started, ['a', 'b']);
    second.resolve('B');
    await secondResult;
    await flush();

    const again = scheduler.enqueueManual({ key: 'a', run: async () => 'A2' });
    assert.deepEqual(await again, { key: 'a', status: 'success', value: 'A2' });
  });

  test('runs collection tasks in batches of three with a barrier between batches', async () => {
    assert.equal(BRIEF_COLLECTION_BATCH_SIZE, 3);
    const scheduler = new BriefGenerationScheduler<number>();
    const gates = Array.from({ length: 5 }, () => deferred<number>());
    const started: number[] = [];
    const tasks: BriefGenerationTask<number>[] = gates.map((gate, index) => ({
      key: String(index),
      run: async () => {
        started.push(index);
        return await gate.promise;
      },
    }));
    const pending = scheduler.runCollection(tasks);
    await flush();
    assert.deepEqual(started, [0, 1, 2]);
    gates[0].resolve(0);
    gates[1].resolve(1);
    await flush();
    assert.deepEqual(started, [0, 1, 2]);
    gates[2].resolve(2);
    await waitFor(() => started.length === 5);
    assert.deepEqual(started, [0, 1, 2, 3, 4]);
    gates[3].resolve(3);
    gates[4].resolve(4);
    assert.deepEqual((await pending).map(result => result.status), [
      'success', 'success', 'success', 'success', 'success',
    ]);
  });

  test('keeps failures local to one collection task', async () => {
    const scheduler = new BriefGenerationScheduler<number>();
    const outcomes = await scheduler.runCollection([
      { key: 'a', run: async () => 1 },
      { key: 'b', run: async () => { throw new Error('failed'); } },
      { key: 'c', run: async () => 3 },
      { key: 'd', run: async () => 4 },
    ]);
    assert.deepEqual(outcomes.map(result => result.status), [
      'success', 'failed', 'success', 'success',
    ]);
  });

  test('keeps manual and collection modes mutually exclusive', async () => {
    const scheduler = new BriefGenerationScheduler<void>();
    const manualGate = deferred<void>();
    const manual = scheduler.enqueueManual({ key: 'manual', run: () => manualGate.promise });
    await assert.rejects(
      () => scheduler.runCollection([{ key: 'collection', run: async () => undefined }]),
      BriefSchedulerBusyError,
    );
    manualGate.resolve();
    await manual;

    const collectionGate = deferred<void>();
    const collection = scheduler.runCollection([
      { key: 'collection', run: () => collectionGate.promise },
    ]);
    await flush();
    assert.throws(
      () => scheduler.enqueueManual({ key: 'manual-2', run: async () => undefined }),
      BriefSchedulerBusyError,
    );
    collectionGate.resolve();
    await collection;
  });

  test('cancels queued manual tasks and future collection batches', async () => {
    let cancelCalls = 0;
    const scheduler = new BriefGenerationScheduler<void>({
      cancelInFlight: () => { cancelCalls++; },
    });
    const manualGate = deferred<void>();
    const active = scheduler.enqueueManual({ key: 'a', run: () => manualGate.promise });
    const queued = scheduler.enqueueManual({ key: 'b', run: async () => undefined });
    scheduler.cancelManual();
    assert.equal((await queued).status, 'cancelled');
    assert.throws(
      () => scheduler.enqueueManual({ key: 'c', run: async () => undefined }),
      BriefSchedulerBusyError,
    );
    manualGate.reject(new Error('aborted'));
    assert.equal((await active).status, 'cancelled');
    assert.equal(cancelCalls, 1);

    const gates = Array.from({ length: 4 }, () => deferred<void>());
    const collection = scheduler.runCollection(gates.map((gate, index) => ({
      key: String(index),
      run: () => gate.promise,
    })));
    await flush();
    scheduler.cancelCollection();
    gates[0].reject(new Error('aborted'));
    gates[1].reject(new Error('aborted'));
    gates[2].reject(new Error('aborted'));
    const outcomes = await collection;
    assert.deepEqual(outcomes.map(outcome => outcome.status), [
      'cancelled', 'cancelled', 'cancelled', 'cancelled',
    ]);
    assert.equal(cancelCalls, 2);
  });

  test('reports cancelled tasks that never started as completed progress', async () => {
    const progress: any[] = [];
    const scheduler = new BriefGenerationScheduler<void>({
      onProgress: event => { progress.push(event); },
    });
    const gates = Array.from({ length: 4 }, () => deferred<void>());
    const pending = scheduler.runCollection(gates.map((gate, index) => ({
      key: String(index),
      run: () => gate.promise,
    })));
    await flush();
    scheduler.cancelCollection();
    gates[0].resolve();
    gates[1].resolve();
    gates[2].resolve();
    await pending;
    const final = progress.at(-1);
    assert.equal(final.completed, 4);
    assert.deepEqual(final.activeKeys, []);
    assert.deepEqual(final.queuedKeys, []);
    assert.deepEqual(final.latest, { key: '3', status: 'cancelled' });
  });
});

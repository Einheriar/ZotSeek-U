import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/zotero-stub';
import { EmbeddingPipeline } from '../src/core/embedding-pipeline';

class FakeChromeWorker {
  static latest: FakeChromeWorker | null = null;
  static instances: FakeChromeWorker[] = [];

  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  messages: any[] = [];
  terminateCalls = 0;

  constructor(_path: string) {
    FakeChromeWorker.latest = this;
    FakeChromeWorker.instances.push(this);
  }

  postMessage(message: any): void {
    this.messages.push(message);
  }

  terminate(): void { this.terminateCalls++; }
}

const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
let activeTimers: Set<number>;
let nextTimerId: number;

beforeEach(() => {
  activeTimers = new Set();
  nextTimerId = 1;
  FakeChromeWorker.latest = null;
  FakeChromeWorker.instances = [];
  (globalThis as any).ChromeWorker = FakeChromeWorker;
  (globalThis as any).setTimeout = (() => {
    const timerId = nextTimerId++;
    activeTimers.add(timerId);
    return timerId;
  }) as unknown as typeof setTimeout;
  (globalThis as any).clearTimeout = ((timerId: number) => {
    activeTimers.delete(Number(timerId));
  }) as unknown as typeof clearTimeout;
});

afterEach(() => {
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClearTimeout;
  delete (globalThis as any).ChromeWorker;
});

async function createReadyPipeline(): Promise<{
  pipeline: EmbeddingPipeline;
  worker: FakeChromeWorker;
}> {
  const pipeline = new EmbeddingPipeline();
  const initPromise = (pipeline as any).initWorker();
  const worker = FakeChromeWorker.latest;
  assert.ok(worker);
  assert.equal(activeTimers.size, 1, 'worker initialization should own one timer');
  worker.onmessage!({
    data: { type: 'status', status: 'ready', message: 'Ready' },
  });
  await initPromise;
  assert.equal(activeTimers.size, 0, 'ready should clear the initialization timer');
  return { pipeline, worker };
}

test('worker success and job errors clear their embedding timeout immediately', async () => {
  const { pipeline, worker } = await createReadyPipeline();

  const successPromise = (pipeline as any).embedWithWorker('document', 'doc');
  const successMessage = worker.messages.at(-1);
  assert.equal(activeTimers.size, 1);
  worker.onmessage!({
    data: {
      type: 'embedding',
      jobId: successMessage.jobId,
      embedding: [0.1, 0.2],
      modelId: 'multilingual-e5-base',
      processingTimeMs: 5,
    },
  });
  assert.deepEqual(await successPromise, {
    embedding: [0.1, 0.2],
    modelId: 'multilingual-e5-base',
    processingTimeMs: 5,
  });
  assert.equal(activeTimers.size, 0);
  assert.equal((pipeline as any).pendingJobs.size, 0);

  const failurePromise = (pipeline as any).embedWithWorker('document', 'doc');
  const failureMessage = worker.messages.at(-1);
  assert.equal(activeTimers.size, 1);
  worker.onmessage!({
    data: { type: 'error', jobId: failureMessage.jobId, error: 'inference failed' },
  });
  await assert.rejects(failurePromise, /inference failed/);
  assert.equal(activeTimers.size, 0);
  assert.equal((pipeline as any).pendingJobs.size, 0);

  pipeline.destroy();
});

test('reset and synchronous postMessage failures release pending timers', async () => {
  const pipeline = new EmbeddingPipeline();
  const messages: any[] = [];
  (pipeline as any).worker = {
    postMessage: (message: any) => messages.push(message),
    terminate: () => {},
  };

  const pending = (pipeline as any).embedWithWorker('document', 'doc');
  const resetRejection = assert.rejects(pending, /Pipeline reset/);
  assert.equal(messages.length, 1);
  assert.equal(activeTimers.size, 1);
  pipeline.reset();
  await resetRejection;
  assert.equal(activeTimers.size, 0);
  assert.equal((pipeline as any).pendingJobs.size, 0);

  (pipeline as any).worker = {
    postMessage: () => { throw new Error('post failed'); },
    terminate: () => {},
  };
  await assert.rejects(
    (pipeline as any).embedWithWorker('document', 'doc'),
    /post failed/,
  );
  assert.equal(activeTimers.size, 0);
  assert.equal((pipeline as any).pendingJobs.size, 0);
});

test('concurrent identical query embeddings share one in-flight job and clean up after success', async () => {
  const pipeline = new EmbeddingPipeline();
  (pipeline as any).ready = true;
  (pipeline as any).model = { id: 'model-a' };

  let calls = 0;
  let resolveEmbedding: ((result: any) => void) | undefined;
  (pipeline as any).embed = () => {
    calls++;
    return new Promise(resolve => { resolveEmbedding = resolve; });
  };

  const first = pipeline.embedQuery('exact query');
  const second = pipeline.embedQuery('exact query');
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal((pipeline as any).queryEmbeddingsInFlight.size, 1);

  const result = { embedding: [1, 0], modelId: 'model-a', processingTimeMs: 1 };
  resolveEmbedding!(result);
  assert.deepEqual(await first, result);
  assert.deepEqual(await second, result);
  assert.equal((pipeline as any).queryEmbeddingsInFlight.size, 0);
});

test('failed query embedding is removed so a later identical query retries', async () => {
  const pipeline = new EmbeddingPipeline();
  (pipeline as any).ready = true;
  (pipeline as any).model = { id: 'model-a' };

  let calls = 0;
  (pipeline as any).embed = async () => {
    calls++;
    if (calls === 1) throw new Error('query failed');
    return { embedding: [1, 0], modelId: 'model-a', processingTimeMs: 1 };
  };

  await assert.rejects(pipeline.embedQuery('retry query'), /query failed/);
  assert.equal((pipeline as any).queryEmbeddingsInFlight.size, 0);
  assert.deepEqual(await pipeline.embedQuery('retry query'), {
    embedding: [1, 0], modelId: 'model-a', processingTimeMs: 1,
  });
  assert.equal(calls, 2);
});

test('reset and model change prevent stale query cleanup from deleting a newer flight', async () => {
  const pipeline = new EmbeddingPipeline();
  (pipeline as any).ready = true;
  (pipeline as any).model = { id: 'model-a' };

  let calls = 0;
  const resolvers: Array<(result: any) => void> = [];
  (pipeline as any).embed = () => {
    calls++;
    return new Promise(resolve => { resolvers.push(resolve); });
  };

  const oldQuery = pipeline.embedQuery('same query');
  await Promise.resolve();
  assert.equal((pipeline as any).queryEmbeddingsInFlight.size, 1);

  pipeline.reset();
  (pipeline as any).model = { id: 'model-b' };
  (pipeline as any).ready = true;
  const newQuery = pipeline.embedQuery('same query');
  await Promise.resolve();
  assert.equal(calls, 2);
  assert.deepEqual([...((pipeline as any).queryEmbeddingsInFlight as Map<string, Promise<unknown>>).keys()], [
    'model-b\u0000same query',
  ]);

  resolvers[0]({ embedding: [1, 0], modelId: 'model-a', processingTimeMs: 1 });
  await oldQuery;
  assert.equal((pipeline as any).queryEmbeddingsInFlight.size, 1);
  resolvers[1]({ embedding: [0, 1], modelId: 'model-b', processingTimeMs: 1 });
  await newQuery;
  assert.equal((pipeline as any).queryEmbeddingsInFlight.size, 0);
});

test('reset during query initialization invalidates the pre-reset registration', async () => {
  const pipeline = new EmbeddingPipeline();
  (pipeline as any).model = { id: 'model-a' };

  let resolveOldInit: (() => void) | undefined;
  let initCalls = 0;
  (pipeline as any).init = () => {
    initCalls++;
    if (initCalls === 1) {
      return new Promise<void>(resolve => { resolveOldInit = resolve; });
    }
    return Promise.resolve();
  };

  let embedCalls = 0;
  let resolveEmbedding: ((result: any) => void) | undefined;
  (pipeline as any).embed = () => {
    embedCalls++;
    return new Promise(resolve => { resolveEmbedding = resolve; });
  };

  const preResetQuery = pipeline.embedQuery('same query');
  await Promise.resolve();
  pipeline.reset();
  (pipeline as any).model = { id: 'model-b' };
  const currentQuery = pipeline.embedQuery('same query');
  await Promise.resolve();
  assert.equal(embedCalls, 1);
  assert.deepEqual([...((pipeline as any).queryEmbeddingsInFlight as Map<string, Promise<unknown>>).keys()], [
    'model-b\u0000same query',
  ]);

  resolveOldInit!();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(embedCalls, 1);
  const result = { embedding: [0, 1], modelId: 'model-b', processingTimeMs: 1 };
  resolveEmbedding!(result);
  assert.deepEqual(await preResetQuery, result);
  assert.deepEqual(await currentQuery, result);
  assert.equal((pipeline as any).queryEmbeddingsInFlight.size, 0);
});

test('concurrent jobs rejected by one worker share exactly one recovery worker', async () => {
  const { pipeline, worker: failedWorker } = await createReadyPipeline();
  (pipeline as any).ready = true;
  (pipeline as any).workerReady = true;
  (pipeline as any).inputPolicy = { supportsExactTokenCount: false, maxInputTokens: null };

  const first = pipeline.embed('first document');
  const second = pipeline.embed('second document');
  await Promise.resolve();
  assert.equal(failedWorker.messages.filter(message => message.type === 'embed').length, 2);

  failedWorker.onerror!({ message: 'worker crashed' });
  for (let turn = 0; turn < 8 && FakeChromeWorker.instances.length < 2; turn++) {
    await Promise.resolve();
  }
  assert.equal(FakeChromeWorker.instances.length, 2, 'only one replacement worker is created');
  assert.equal(failedWorker.terminateCalls, 1);

  const recoveredWorker = FakeChromeWorker.latest!;
  recoveredWorker.onmessage!({ data: { type: 'status', status: 'ready', message: 'Ready' } });
  for (let turn = 0; turn < 8; turn++) await Promise.resolve();
  const jobs = recoveredWorker.messages.filter(message => message.type === 'embed');
  assert.equal(jobs.length, 2);
  for (const [index, job] of jobs.entries()) {
    recoveredWorker.onmessage!({
      data: {
        type: 'embedding',
        jobId: job.jobId,
        embedding: [index + 1, 0],
        modelId: 'multilingual-e5-base',
        processingTimeMs: 1,
      },
    });
  }
  await Promise.all([first, second]);
  assert.equal(FakeChromeWorker.instances.length, 2);
  pipeline.destroy();
});

test('reset cancels an in-flight recovery and stale worker events cannot revive it', async () => {
  const { pipeline } = await createReadyPipeline();
  (pipeline as any).ready = true;
  (pipeline as any).workerReady = true;

  const recovery = (pipeline as any).recoverWorker();
  await Promise.resolve();
  const staleReplacement = FakeChromeWorker.latest!;
  assert.equal(FakeChromeWorker.instances.length, 2);

  pipeline.reset();
  staleReplacement.onmessage!({ data: { type: 'status', status: 'ready', message: 'late ready' } });
  await assert.rejects(recovery, /Pipeline reset|lifecycle changed|superseded/);
  assert.equal((pipeline as any).ready, false);
  assert.equal((pipeline as any).workerReady, false);
  assert.equal((pipeline as any).worker, null);

  const freshInit = pipeline.init();
  const freshWorker = FakeChromeWorker.latest!;
  assert.notEqual(freshWorker, staleReplacement);
  freshWorker.onmessage!({ data: { type: 'status', status: 'ready', message: 'Ready' } });
  await freshInit;
  assert.equal((pipeline as any).ready, true);
  pipeline.destroy();
});

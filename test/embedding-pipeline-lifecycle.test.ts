import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/zotero-stub';
import { EmbeddingPipeline } from '../src/core/embedding-pipeline';

class FakeChromeWorker {
  static latest: FakeChromeWorker | null = null;

  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  messages: any[] = [];

  constructor(_path: string) {
    FakeChromeWorker.latest = this;
  }

  postMessage(message: any): void {
    this.messages.push(message);
  }

  terminate(): void {}
}

const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
let activeTimers: Set<number>;
let nextTimerId: number;

beforeEach(() => {
  activeTimers = new Set();
  nextTimerId = 1;
  FakeChromeWorker.latest = null;
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

import { selfTest, scenario, assertTrue, assertEq } from '../self-test';
import { getModel } from '../../core/model-registry';
import { isModelOnDisk, ensureModelDownloaded, removeModelFiles } from '../../core/model-download';
import { embeddingPipeline } from '../../core/embedding-pipeline';

selfTest.register('task-37e-model-download', async () => {
  const nomic = getModel('nomic-embed-text-v1.5')!;
  return [
    await scenario('download the smallest model end-to-end', async () => {
      await removeModelFiles(nomic).catch(() => {});
      assertTrue(!(await isModelOnDisk(nomic)), 'should start absent');
      let lastDone = 0;
      await ensureModelDownloaded(nomic, (done) => { lastDone = done; });
      assertTrue(await isModelOnDisk(nomic), 'should be on disk after download');
      assertTrue(lastDone > 0, 'progress callback fired');
    }),
    await scenario('load the downloaded model via resource:// and embed', async () => {
      // Switch the pipeline to the downloaded model; the worker loads it from
      // resource://zotseek-models/. A successful embed of the right dimension
      // proves the download + resource substitution + worker load chain works.
      try {
        await embeddingPipeline.setModel('nomic-embed-text-v1.5');
        const r = await embeddingPipeline.embedQuery('a test sentence');
        assertEq(r.embedding.length, 768, 'Nomic should produce 768-dim vectors');
        assertEq(r.modelId, 'nomic-embed-text-v1.5', 'modelId should be the short id');
      } finally {
        // Always restore the default model so the rest of the session is unaffected.
        await embeddingPipeline.setModel('multilingual-e5-base');
      }
    }),
    await scenario('removeModelFiles deletes the directory', async () => {
      await removeModelFiles(nomic);
      assertTrue(!(await isModelOnDisk(nomic)), 'should be gone after remove');
    }),
  ];
});

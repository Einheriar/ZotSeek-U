/**
 * Embedding Worker - ChromeWorker for Transformers.js v3
 *
 * Parameterized by model config passed in the `init` message.
 * Runs in a ChromeWorker thread with privileged access.
 */

declare const self: any;
declare const postMessage: (data: any) => void;
declare const addEventListener: (type: string, handler: (event: any) => void) => void;

// Set up globals that Transformers.js expects
(globalThis as any).self = globalThis;
(globalThis as any).window = globalThis;
if (typeof navigator === 'undefined') {
  (globalThis as any).navigator = {
    userAgent: 'Zotero ChromeWorker',
    hardwareConcurrency: 4,
    language: 'en-US',
    languages: ['en-US', 'en'],
  };
}

// Detect WebGPU availability for GPU acceleration
const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
let useWebGPU = false; // Will be set after actual GPU adapter check

// Import Transformers.js v3
import { pipeline, env } from '@huggingface/transformers';
import { prepareWorkerInput } from '../core/worker-input';
import type { ModelQuantization } from '../core/model-input-config';

// CRITICAL: Configure wasmPaths BEFORE any pipeline initialization
env.backends.onnx.wasm.wasmPaths = 'chrome://zotseek/content/wasm/';

// Configure for local/bundled operation
env.allowRemoteModels = false;
env.allowLocalModels = true;

// Disable browser caching (not available in ChromeWorker)
env.useBrowserCache = false;
(env as any).useCache = false;

// Use multiple threads for faster embedding
// ChromeWorker supports SharedArrayBuffer in Zotero 8+'s privileged context (Firefox 140+)
env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 4;

// Log configuration
postMessage({
  type: 'log',
  level: 'info',
  message: 'Transformers.js v3 environment configured',
  data: {
    wasmPaths: env.backends.onnx.wasm.wasmPaths,
    webGPUDetected: hasWebGPU,
    numThreads: env.backends.onnx.wasm.numThreads,
  }
});

// Worker state
let embeddingPipeline: any = null;
let isLoading = false;

// Per-init model config -- set from the init message before loading
let CURRENT: {
  modelId: string;
  hfPath: string;
  pooling: 'mean' | 'cls';
  normalize: boolean;
  queryPrefix: string;
  docPrefix: string;
  basePath: string;
  quantization: ModelQuantization;
  webgpu?: boolean;    // experimental opt-in (zotseek.webgpu.enabled)
} | null = null;

function modelOptions() {
  if (!CURRENT) throw new Error('Model config missing');
  if (CURRENT.quantization === 'server-managed') {
    throw new Error('Server-managed quantization cannot be loaded in the local worker');
  }
  return {
    quantized: CURRENT.quantization === 'q8',
    dtype: CURRENT.quantization,
    local_files_only: true,
  } as const;
}

/**
 * Check if WebGPU is actually available and working
 */
async function checkWebGPUAvailability(): Promise<boolean> {
  if (!hasWebGPU) return false;

  try {
    const gpu = (navigator as any).gpu;
    if (!gpu) return false;

    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      postMessage({
        type: 'log',
        level: 'info',
        message: 'WebGPU: No adapter available',
      });
      return false;
    }

    // adapter.info is the current spec; requestAdapterInfo() was removed
    // from the spec but may still exist on older engines.
    const adapterInfo = adapter.info || (await adapter.requestAdapterInfo?.()) || {};
    postMessage({
      type: 'log',
      level: 'info',
      message: 'WebGPU adapter found',
      data: {
        vendor: adapterInfo.vendor || 'unknown',
        architecture: adapterInfo.architecture || 'unknown',
        device: adapterInfo.device || 'unknown',
      }
    });

    return true;
  } catch (error: any) {
    postMessage({
      type: 'log',
      level: 'info',
      message: 'WebGPU check failed',
      data: { error: error.message || String(error) }
    });
    return false;
  }
}

/**
 * Initialize the embedding pipeline
 * Tries WebGPU first for GPU acceleration, falls back to WASM (CPU)
 */
async function initPipeline(): Promise<void> {
  if (embeddingPipeline || isLoading) return;

  if (!CURRENT) {
    postMessage({
      type: 'log',
      level: 'error',
      message: 'initPipeline called before CURRENT model config was set',
    });
    postMessage({ type: 'error', error: 'Model config missing -- send init message with model config first' });
    return;
  }

  isLoading = true;
  const startTime = Date.now();

  // Apply per-model base path (chrome:// for bundled, resource:// for downloaded)
  env.localModelPath = CURRENT.basePath;

  // WebGPU is opt-in via zotseek.webgpu.enabled (resolved on the main
  // thread and passed in the init message). Even where WebGPU exists
  // (Zotero 11+ / Firefox 153), the WASM path is currently faster, so
  // detection alone must not switch the device.
  if (CURRENT.webgpu && CURRENT.quantization === 'fp16') {
    useWebGPU = await checkWebGPUAvailability();
  } else {
    useWebGPU = false;
    if (hasWebGPU) {
      postMessage({
        type: 'log',
        level: 'info',
        message: CURRENT.webgpu
          ? 'WebGPU requested but no FP16 model artifact is configured; using WASM/Q8'
          : 'WebGPU detected but not enabled (zotseek.webgpu.enabled is off)',
      });
    }
  }

  const deviceType = useWebGPU ? 'webgpu' : 'wasm';
  const deviceLabel = useWebGPU ? 'GPU (WebGPU)' : 'CPU (WASM)';

  postMessage({
    type: 'log',
    level: 'info',
    message: `Loading embedding model on ${deviceLabel}`,
    data: { modelId: CURRENT.modelId, hfPath: CURRENT.hfPath, device: deviceType }
  });

  postMessage({ type: 'status', status: 'loading', message: `Loading model on ${deviceLabel}...` });

  // Try WebGPU first, fall back to WASM if it fails
  if (useWebGPU) {
    try {
      // On WebGPU, q8 weights are a trap: onnxruntime-web has no WebGPU
      // kernels for the integer-quantized matmuls, so they fall back to CPU
      // node-by-node with a GPU<->CPU transfer around each -- measured ~11x
      // SLOWER than plain WASM. GPU needs fp16 weights (model_fp16.onnx).
      embeddingPipeline = await pipeline('feature-extraction', CURRENT.hfPath, {
        ...modelOptions(),
        dtype: 'fp16',
        device: 'webgpu',
      });

      const loadTime = Date.now() - startTime;
      postMessage({
        type: 'log',
        level: 'info',
        message: `Model loaded on GPU in ${loadTime}ms`,
        data: { modelId: CURRENT.modelId, loadTimeMs: loadTime, device: 'webgpu' }
      });

      postMessage({ type: 'status', status: 'ready', message: `Model loaded on GPU (${loadTime}ms)` });
      isLoading = false;
      return;
    } catch (error: any) {
      postMessage({
        type: 'log',
        level: 'warn',
        message: 'WebGPU failed, falling back to CPU',
        data: { error: error.message || String(error) }
      });
      useWebGPU = false;
      // Continue to WASM fallback
    }
  }

  // WASM (CPU) fallback
  try {
    embeddingPipeline = await pipeline('feature-extraction', CURRENT.hfPath, modelOptions());

    const loadTime = Date.now() - startTime;
    postMessage({
      type: 'log',
      level: 'info',
      message: `Model loaded on CPU in ${loadTime}ms`,
      data: { modelId: CURRENT.modelId, loadTimeMs: loadTime, device: 'wasm' }
    });

    postMessage({ type: 'status', status: 'ready', message: `Model loaded on CPU (${loadTime}ms)` });
  } catch (error: any) {
    const loadTime = Date.now() - startTime;

    postMessage({
      type: 'log',
      level: 'error',
      message: `Failed to load model after ${loadTime}ms`,
      data: {
        error: error.message || String(error),
        stack: error.stack,
      }
    });

    postMessage({ type: 'error', error: `Failed to load model: ${error.message}` });
  } finally {
    isLoading = false;
  }
}

/**
 * Generate embedding for text
 *
 * @param jobId - Unique job identifier
 * @param text - Text to embed
 * @param kind - 'query' for search queries, 'doc' for documents
 */
async function generateEmbedding(jobId: string, text: string, kind: 'query' | 'doc' = 'doc'): Promise<void> {
  if (!embeddingPipeline) {
    postMessage({ type: 'error', jobId, error: 'Pipeline not initialized' });
    return;
  }

  if (!CURRENT) {
    postMessage({ type: 'error', jobId, error: 'Model config missing' });
    return;
  }

  try {
    const startTime = Date.now();

    const prepared = prepareWorkerInput(text, kind, CURRENT);
    // Preserve the full source string. Transformers.js feature extraction
    // enables tokenizer truncation and applies the model's model_max_length;
    // normal indexing has already split long chunks without dropping tails.
    const output = await embeddingPipeline(prepared, {
      pooling: CURRENT.pooling,
      normalize: CURRENT.normalize,
    });

    const embedding = Array.from(output.data as Float32Array);  // 768 dimensions
    if (typeof output.dispose === 'function') output.dispose();  // Free the WASM tensor promptly
    const processingTimeMs = Date.now() - startTime;

    postMessage({
      type: 'embedding',
      jobId,
      embedding,
      modelId: CURRENT.modelId,
      processingTimeMs,
    });
  } catch (error: any) {
    postMessage({
      type: 'log',
      level: 'error',
      message: 'Failed to generate embedding',
      data: { error: error.message || String(error) }
    });
    postMessage({ type: 'error', jobId, error: error.message || String(error) });
  }
}

/**
 * Handle messages from main thread
 */
addEventListener('message', async (event: MessageEvent) => {
  const { type, jobId, data } = event.data;

  switch (type) {
    case 'init':
      // Store model config from the init message, then load the pipeline
      CURRENT = event.data.model;
      await initPipeline();
      break;

    case 'embed':
      if (!embeddingPipeline) {
        await initPipeline();
      }
      if (embeddingPipeline) {
        // data.kind is 'query' or 'doc'; fall back to isQuery for backward compat
        const kind: 'query' | 'doc' = data?.kind ?? (data?.isQuery ? 'query' : 'doc');
        await generateEmbedding(jobId, data.text, kind);
      } else {
        postMessage({ type: 'error', jobId, error: 'Pipeline not initialized' });
      }
      break;

    case 'ping':
      postMessage({ type: 'pong', jobId });
      break;

    default:
      postMessage({ type: 'error', jobId, error: `Unknown message type: ${type}` });
  }
});

// Signal that worker script is loaded
postMessage({
  type: 'log',
  level: 'info',
  message: 'Embedding worker initialized (awaiting model config via init message)',
  data: { webGPUAvailable: hasWebGPU }
});
postMessage({ type: 'status', status: 'initialized', message: `Worker loaded (WebGPU ${hasWebGPU ? 'detected' : 'not available'})` });

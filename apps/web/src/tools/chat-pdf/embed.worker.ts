import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import { chunkPages, type Chunk, type PageText } from './chunker';
import { retrievalQuery } from './retrieve';
import { configureLocalOnnx } from '@/lib/onnxEnv';

export interface Index {
  chunks: Chunk[];
  vectors: Float32Array[];
}
export type Work = { pages: PageText[] } | { query: string; previous?: string };
export type Reply =
  { progress: string } | { index: Index } | { vector: Float32Array } | { error: string };

let engine: FeatureExtractionPipeline | undefined;
const CACHE_KEY = 'transformers-cache';
let device: 'webgpu' | 'wasm' = 'gpu' in navigator ? 'webgpu' : 'wasm';

async function loadEngine() {
  if (engine) return engine;
  postMessage({ progress: 'Loading local embedding model…' });
  const { env, pipeline } = await import('@huggingface/transformers');
  configureLocalOnnx(env, __VENDOR__.models, CACHE_KEY, true);
  if (device === 'webgpu') {
    const gpu = (navigator as Navigator & { gpu: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!(await gpu.requestAdapter().catch(() => null))) device = 'wasm';
  }
  const create = () =>
    pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      device,
      dtype: 'q8',
      progress_callback(event) {
        if (event.status === 'progress' && event.total) {
          postMessage({
            progress: `Loading model · ${event.file} · ${Math.round(event.progress)}%`,
          });
        }
      },
    });
  try {
    engine = await create();
  } catch (error) {
    if (device === 'webgpu') {
      device = 'wasm';
      try {
        engine = await create();
        return engine;
      } catch {
        // fall through to the cache reset below
      }
    }
    // A failed or interrupted earlier download can leave a broken copy in the
    // browser cache, and every later attempt then fails the same way. Drop it
    // and try once more with a fresh download that bypasses the cache.
    console.warn('Embedding model failed to load; retrying without the cache.', error);
    await clearModelCache();
    env.useBrowserCache = false;
    engine = await create();
  }
  return engine;
}

async function clearModelCache(): Promise<void> {
  if (typeof caches !== 'undefined') await caches.delete(CACHE_KEY).catch(() => false);
}

function describe(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

async function embed(texts: string[]): Promise<Float32Array[]> {
  const model = await loadEngine();
  try {
    const result = await model(texts, { pooling: 'mean', normalize: true });
    const width = result.dims[1];
    if (!width || !(result.data instanceof Float32Array)) throw new Error('Invalid embedding.');
    const data = result.data;
    return texts.map((_, i) => data.slice(i * width, (i + 1) * width));
  } catch (error) {
    if (device !== 'webgpu') throw error;
    device = 'wasm';
    await model.dispose();
    engine = undefined;
    return embed(texts);
  }
}

self.onmessage = async ({ data }: MessageEvent<Work>) => {
  try {
    const model = await loadEngine();
    if ('query' in data) {
      const query = retrievalQuery(
        data.query,
        data.previous,
        (text) => model.tokenizer.encode(text, { add_special_tokens: false }),
        (ids) => model.tokenizer.decode(ids),
      );
      const [vector] = await embed([query]);
      postMessage({ vector });
      return;
    }
    const chunks = chunkPages(data.pages, (text) => model.tokenizer.encode(text).length);
    const vectors: Float32Array[] = [];
    for (let i = 0; i < chunks.length; i += 16) {
      vectors.push(...(await embed(chunks.slice(i, i + 16).map((chunk) => chunk.text))));
      postMessage({ progress: `Embedding · ${vectors.length} of ${chunks.length} excerpts` });
    }
    self.postMessage({ index: { chunks, vectors } }, { transfer: vectors.map((v) => v.buffer) });
  } catch (error) {
    postMessage({
      error:
        error instanceof Error && error.message.startsWith('A sentence')
          ? error.message
          : `Could not run the local embedding model (${describe(error)}). Press "Clear stored data" and try again.`,
    });
  }
};

import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import { chunkPages, type Chunk, type PageText } from './chunker';

export interface Index { chunks: Chunk[]; vectors: Float32Array[] }
export type Work = { pages: PageText[] } | { query: string };
export type Reply = { progress: string } | { index: Index } | { vector: Float32Array } | { error: string };

let engine: FeatureExtractionPipeline | undefined;
let device: 'webgpu' | 'wasm' = 'gpu' in navigator ? 'webgpu' : 'wasm';

async function loadEngine() {
  if (engine) return engine;
  postMessage({ progress: 'Loading local embedding model…' });
  const { env, pipeline } = await import('@huggingface/transformers');
  env.allowRemoteModels = false;
  env.localModelPath = '/vendor/models/';
  const wasm = env.backends.onnx.wasm;
  if (wasm) {
    wasm.wasmPaths = new URL('/vendor/onnx/', self.location.origin).href;
    wasm.numThreads = 1;
  }
  const create = () => pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    device, dtype: 'q8',
    progress_callback(event) {
      if (event.status === 'progress' && event.total) {
        postMessage({ progress: `Loading model · ${event.file} · ${Math.round(event.progress)}%` });
      }
    },
  });
  try {
    engine = await create();
  } catch (error) {
    if (device === 'wasm') throw error;
    device = 'wasm';
    engine = await create();
  }
  engine.tokenizer.model_max_length = 256;
  return engine;
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
      const [vector] = await embed([data.query]);
      postMessage({ vector });
      return;
    }
    const chunks = chunkPages(data.pages, text => model.tokenizer.encode(text).length);
    const vectors: Float32Array[] = [];
    for (let i = 0; i < chunks.length; i += 16) {
      vectors.push(...await embed(chunks.slice(i, i + 16).map(chunk => chunk.text)));
      postMessage({ progress: `Embedding · ${vectors.length} of ${chunks.length} excerpts` });
    }
    self.postMessage({ index: { chunks, vectors } }, { transfer: vectors.map(v => v.buffer) });
  } catch (error) {
    postMessage({ error: error instanceof Error && error.message.startsWith('A sentence')
      ? error.message : 'Could not run the local embedding model. Check the model download and try again.' });
  }
};

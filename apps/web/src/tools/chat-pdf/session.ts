import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Index, Reply, Work } from './embed.worker';

export class DocumentSession {
  readonly lifetime = new AbortController();
  answer?: AbortController;
  pdf?: PDFDocumentProxy;
  index?: Index;
  private worker?: Worker;

  // Only one indexing or retrieval operation runs in a session at a time.
  run(work: Work, signal: AbortSignal, progress: (s: string) => void): Promise<Index | Float32Array> {
    signal.throwIfAborted();
    const worker = this.worker ??= new Worker(new URL('./embed.worker.ts', import.meta.url), { type: 'module' });
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        signal.removeEventListener('abort', abort);
        worker.onmessage = null;
        worker.onerror = null;
      };
      const abort = () => {
        cleanup();
        worker.terminate();
        this.worker = undefined;
        reject(signal.reason);
      };
      signal.addEventListener('abort', abort, { once: true });
      worker.onerror = () => {
        cleanup();
        worker.terminate();
        this.worker = undefined;
        reject(new Error('The embedding worker could not start. Reload and try again.'));
      };
      worker.onmessage = ({ data }: MessageEvent<Reply>) => {
        if ('progress' in data) return progress(data.progress);
        cleanup();
        if ('error' in data) reject(new Error(data.error));
        else resolve('index' in data ? data.index : data.vector);
      };
      worker.postMessage(work);
    });
  }

  dispose() {
    this.lifetime.abort();
    this.answer?.abort();
    this.worker?.terminate();
    this.index = undefined;
    void this.pdf?.loadingTask.destroy();
  }
}

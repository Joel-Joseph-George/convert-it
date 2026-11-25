import { create } from 'zustand';
import { getToolById } from '../registry/tools';
import { runConversion } from '../engines/registry';
import { createZipArchive, ZipFileEntry } from '../engines/zipUtil';
import { EngineError } from '../engines/types';
import { runServerConversion } from '../server/serverConversion';

export type QueueItemStatus =
  | 'ready'
  | 'converting'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface QueueItemResult {
  filename: string;
  blob?: Blob;
  url?: string;
  sizeBytes: number;
}

export interface QueueItem {
  id: string;
  file: File;
  status: QueueItemStatus;
  progress: number;
  targetFormat: string;
  result?: QueueItemResult;
  error?: {
    code: string;
    message: string;
  };
  abortController?: AbortController;
}

export interface QueueState {
  items: Record<string, QueueItem[]>;
  selectedFormat: Record<string, string>;
  options: Record<string, Record<string, string | number | boolean>>;

  addFiles: (toolId: string, files: File[], defaultFormat: string) => void;
  removeItem: (toolId: string, itemId: string) => void;
  clearQueue: (toolId: string) => void;
  updateItem: (
    toolId: string,
    itemId: string,
    updates: Partial<QueueItem>
  ) => void;
  setTargetFormat: (toolId: string, format: string) => void;
  setOption: (
    toolId: string,
    optionId: string,
    value: string | number | boolean
  ) => void;
  initOptions: (
    toolId: string,
    defaults: Record<string, string | number | boolean>
  ) => void;
  cancelItem: (toolId: string, itemId: string) => void;
  /** Re-queue one failed/cancelled item; joins the running batch if there is one. */
  retryItem: (toolId: string, itemId: string) => void;
  startConversion: (toolId: string) => Promise<void>;
  downloadAllZip: (toolId: string) => Promise<void>;
}

// Tools with a batch currently running. A second startConversion call while one is
// running is a no-op: the running loop re-reads the store and picks up any items that
// became ready (new files, retries) instead of converting them twice.
const runningTools = new Set<string>();

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: {},
  selectedFormat: {},
  options: {},

  addFiles: (toolId: string, files: File[], defaultFormat: string) => {
    const current = get().items[toolId] || [];
    const activeFormat = get().selectedFormat[toolId] || defaultFormat;

    const newItems: QueueItem[] = files.map((file) => ({
      id: generateId(),
      file,
      status: 'ready',
      progress: 0,
      targetFormat: activeFormat,
    }));

    // Cap at 20 files per batch as per spec Section 6.3
    const updated = [...current, ...newItems].slice(0, 20);

    set((state) => ({
      items: {
        ...state.items,
        [toolId]: updated,
      },
      selectedFormat: {
        ...state.selectedFormat,
        [toolId]: activeFormat,
      },
    }));
  },

  removeItem: (toolId: string, itemId: string) => {
    const current = get().items[toolId] || [];
    const itemToRemove = current.find((i) => i.id === itemId);
    if (itemToRemove?.abortController) {
      itemToRemove.abortController.abort();
    }
    if (itemToRemove?.result?.url) {
      URL.revokeObjectURL(itemToRemove.result.url);
    }

    set((state) => ({
      items: {
        ...state.items,
        [toolId]: current.filter((item) => item.id !== itemId),
      },
    }));
  },

  clearQueue: (toolId: string) => {
    const current = get().items[toolId] || [];
    for (const item of current) {
      if (item.abortController) {
        item.abortController.abort();
      }
      if (item.result?.url) {
        URL.revokeObjectURL(item.result.url);
      }
    }

    set((state) => ({
      items: {
        ...state.items,
        [toolId]: [],
      },
    }));
  },

  updateItem: (
    toolId: string,
    itemId: string,
    updates: Partial<QueueItem>
  ) => {
    set((state) => {
      const current = state.items[toolId] || [];
      return {
        items: {
          ...state.items,
          [toolId]: current.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
          ),
        },
      };
    });
  },

  setTargetFormat: (toolId: string, format: string) => {
    set((state) => {
      const current = state.items[toolId] || [];
      const updatedItems = current.map((item) =>
        item.status === 'ready' ? { ...item, targetFormat: format } : item
      );

      return {
        selectedFormat: {
          ...state.selectedFormat,
          [toolId]: format,
        },
        items: {
          ...state.items,
          [toolId]: updatedItems,
        },
      };
    });
  },

  setOption: (toolId, optionId, value) => {
    set((state) => {
      const currentOptions = state.options[toolId] || {};
      return {
        options: {
          ...state.options,
          [toolId]: {
            ...currentOptions,
            [optionId]: value,
          },
        },
      };
    });
  },

  initOptions: (toolId, defaults) => {
    set((state) => {
      if (state.options[toolId]) return state;
      return {
        options: {
          ...state.options,
          [toolId]: defaults,
        },
      };
    });
  },

  cancelItem: (toolId: string, itemId: string) => {
    const current = get().items[toolId] || [];
    const item = current.find((i) => i.id === itemId);
    if (item?.abortController) {
      item.abortController.abort();
    }
    get().updateItem(toolId, itemId, { status: 'cancelled' });
  },

  retryItem: (toolId: string, itemId: string) => {
    const item = (get().items[toolId] || []).find((i) => i.id === itemId);
    if (!item || (item.status !== 'failed' && item.status !== 'cancelled')) return;
    get().updateItem(toolId, itemId, { status: 'ready', progress: 0, error: undefined });
    void get().startConversion(toolId);
  },

  startConversion: async (toolId: string) => {
    const tool = getToolById(toolId);
    if (!tool) return;
    if (runningTools.has(toolId)) return;

    // "Convert remaining files" also retries failed items.
    for (const item of get().items[toolId] || []) {
      if (item.status === 'failed') {
        get().updateItem(toolId, item.id, { status: 'ready', progress: 0, error: undefined });
      }
    }

    runningTools.add(toolId);
    try {
      if (tool.id === 'merge-pdf' || tool.id === 'images-to-pdf') {
        await runCombined(toolId);
      } else {
        // Always take the next item from the live store, so removed/cleared items are
        // skipped and retried or newly added ones join this run.
        for (;;) {
          const next = (get().items[toolId] || []).find((i) => i.status === 'ready');
          if (!next) break;
          await runSingle(toolId, next);
        }
      }
    } finally {
      runningTools.delete(toolId);
    }
  },

  downloadAllZip: async (toolId: string) => {
    const current = get().items[toolId] || [];
    const doneItems = current.filter(
      (i) => i.status === 'done' && i.result?.blob
    );
    if (doneItems.length === 0) return;

    const entries: ZipFileEntry[] = [];
    for (const item of doneItems) {
      if (item.result?.blob) {
        const arrayBuf = await item.result.blob.arrayBuffer();
        entries.push({
          name: item.result.filename,
          data: new Uint8Array(arrayBuf),
        });
      }
    }

    const zipBlob = await createZipArchive(entries);
    const zipUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = `${toolId}_converted_files.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(zipUrl), 60000);
  },
}));

function itemExists(toolId: string, itemId: string): boolean {
  return (useQueueStore.getState().items[toolId] || []).some((i) => i.id === itemId);
}

function toErrorInfo(err: unknown): { code: string; message: string } {
  if (err instanceof EngineError) return { code: err.code, message: err.message };
  if (err && typeof err === 'object' && 'code' in err) {
    return {
      code: String((err as { code: unknown }).code),
      message: String((err as { message?: unknown }).message ?? 'Server error'),
    };
  }
  if (err instanceof Error) return { code: 'CONVERSION_FAILED', message: err.message };
  return { code: 'CONVERSION_FAILED', message: 'Conversion failed' };
}

/** Tools that combine every file into one output (merge-pdf, images-to-pdf). */
async function runCombined(toolId: string): Promise<void> {
  const { getState } = useQueueStore;
  const tool = getToolById(toolId);
  if (!tool) return;
  const pending = (getState().items[toolId] || []).filter((i) => i.status === 'ready');
  if (pending.length === 0) return;

  const controller = new AbortController();
  pending.forEach((item) => {
    getState().updateItem(toolId, item.id, {
      status: 'converting',
      progress: 10,
      abortController: controller,
      error: undefined,
    });
  });

  try {
    const results = await runConversion(
      tool,
      pending.map((p) => p.file),
      getState().options[toolId] || {},
      tool.outputs[0]?.value || 'pdf',
      {
        onProgress: (prog) => {
          pending.forEach((item) => getState().updateItem(toolId, item.id, { progress: prog }));
        },
        signal: controller.signal,
      }
    );

    const firstResult = results[0];
    if (!firstResult) {
      throw new EngineError('CONVERSION_FAILED', 'The converter finished without producing a file.');
    }
    // The combined file belongs to the first item still in the queue.
    const owner = pending.find((item) => itemExists(toolId, item.id));
    if (!owner) return;
    const url = URL.createObjectURL(firstResult.blob);
    pending.forEach((item) => {
      getState().updateItem(toolId, item.id, {
        status: 'done',
        progress: 100,
        abortController: undefined,
        result:
          item.id === owner.id
            ? {
                filename: firstResult.filename,
                blob: firstResult.blob,
                url,
                sizeBytes: firstResult.sizeBytes,
              }
            : undefined,
      });
    });
  } catch (err) {
    const isCancelled = controller.signal.aborted;
    pending.forEach((item) => {
      getState().updateItem(toolId, item.id, {
        status: isCancelled ? 'cancelled' : 'failed',
        abortController: undefined,
        error: toErrorInfo(err),
      });
    });
  }
}

async function runSingle(toolId: string, item: QueueItem): Promise<void> {
  const { getState } = useQueueStore;
  const tool = getToolById(toolId);
  if (!tool) return;

  const controller = new AbortController();
  getState().updateItem(toolId, item.id, {
    status: 'converting',
    progress: 0,
    abortController: controller,
    error: undefined,
  });

  const ctx = {
    onProgress: (prog: number) => getState().updateItem(toolId, item.id, { progress: prog }),
    signal: controller.signal,
  };
  const toolOptions = getState().options[toolId] || {};

  try {
    let res: { filename: string; blob: Blob; sizeBytes: number } | undefined;
    if (tool.engine.kind === 'server') {
      // Server engines with more than one output (e.g. PDF → XLSX or CSV) need the choice.
      res = await runServerConversion(
        tool.id,
        item.file,
        { ...toolOptions, format: item.targetFormat },
        ctx
      );
    } else {
      const results = await runConversion(tool, [item.file], toolOptions, item.targetFormat, ctx);
      res = results[0];
    }

    if (!res) {
      throw new EngineError('CONVERSION_FAILED', 'The converter finished without producing a file.');
    }
    // Removed or cancelled while converting: drop the result instead of leaking a URL.
    if (controller.signal.aborted || !itemExists(toolId, item.id)) return;

    const url = URL.createObjectURL(res.blob);
    getState().updateItem(toolId, item.id, {
      status: 'done',
      progress: 100,
      abortController: undefined,
      result: { filename: res.filename, blob: res.blob, url, sizeBytes: res.sizeBytes },
    });
  } catch (err: unknown) {
    getState().updateItem(toolId, item.id, {
      status: controller.signal.aborted ? 'cancelled' : 'failed',
      abortController: undefined,
      error: toErrorInfo(err),
    });
  }
}

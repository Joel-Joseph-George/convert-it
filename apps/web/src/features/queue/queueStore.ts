import { create } from 'zustand';
import { getToolById } from '../registry/tools';
import { combinesFiles, defaultStep, runWorkflow, type Step } from '../workflows/conversion';
import { rememberRun } from '../workflows/library';
import { createZipArchive, ZipFileEntry } from '../engines/zipUtil';

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
  historyError: string;
  startConversion: (toolId: string, tail?: Step[], replay?: { first: Step; files: File[] }) => Promise<void>;
  downloadAllZip: (toolId: string) => Promise<void>;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: {},
  selectedFormat: {},
  options: {},
  historyError: '',

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
        item.status === 'ready' || item.status === 'failed' ? { ...item, targetFormat: format } : item
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

  startConversion: async (toolId, tail = [], replay) => {
    const tool = getToolById(toolId);
    if (!tool) return;

    const current = get().items[toolId] || [];
    if (current.some(item => item.status === 'converting')) {
      if (replay) throw new Error('Wait for the current conversion to finish.');
      return;
    }
    const first = replay?.first ?? defaultStep(tool);
    const options = replay ? first.options : { ...first.options, ...get().options[toolId] };
    let pending = current.filter(item => item.status === 'ready' || item.status === 'failed');
    if (replay) {
      if (current.length + replay.files.length > 20) {
        throw new Error('Clear some queue items to make room for this run.');
      }
      pending = replay.files.map(file => ({
        id: generateId(), file, status: 'ready', progress: 0, targetFormat: first.format,
      }));
      set(state => ({ items: { ...state.items, [toolId]: [...current, ...pending] } }));
    }
    if (!pending.length) return;
    const groups = [first, ...tail].some(combinesFiles) ? [pending] : pending.map(item => [item]);
    const jobs = groups.map(group => {
      const controller = new AbortController();
      for (const item of group) {
        get().updateItem(toolId, item.id, {
          status: 'converting', progress: 0, abortController: controller, error: undefined,
        });
      }
      return { group, controller };
    });

    for (const { group, controller } of jobs) {
      const files = group.map(item => item.file);
      const steps = [{ toolId, format: group[0]?.targetFormat ?? first.format, options }, ...tail];
      try {
        const outputs = await runWorkflow(steps, files, {
          signal: controller.signal,
          onProgress: progress => group.forEach(item => get().updateItem(toolId, item.id, { progress })),
        });
        controller.signal.throwIfAborted();
        group.forEach((item, index) => {
          const output = outputs[index];
          get().updateItem(toolId, item.id, {
            status: 'done', progress: 100, abortController: undefined,
            result: output ? { ...output, url: URL.createObjectURL(output.blob) } : undefined,
          });
        });
        try {
          await rememberRun(steps, files);
          set({ historyError: '' });
        } catch {
          set({ historyError: 'Conversion finished. Browser storage could not save this run.' });
        }
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error
          ? String(error.code) : 'CONVERSION_FAILED';
        const message = error && typeof error === 'object' && 'message' in error
          ? String(error.message) : 'Conversion failed';
        for (const item of group) {
          get().updateItem(toolId, item.id, {
            status: controller.signal.aborted ? 'cancelled' : 'failed',
            abortController: undefined, error: { code, message },
          });
        }
      }
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

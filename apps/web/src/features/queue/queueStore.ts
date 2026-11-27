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
  /** Re-queue one failed/cancelled item; runs after the current batch if one is running. */
  retryItem: (toolId: string, itemId: string) => void;
  /** Chained steps after the tool's own step, per tool. */
  tails: Record<string, Step[]>;
  setTail: (toolId: string, steps: Step[]) => void;
  historyError: Record<string, string>;
  serverMaxUploadMB?: number;
  setServerMaxUploadMB: (mb: number | undefined) => void;
  startConversion: (toolId: string, opts?: { ids?: string[]; record?: boolean }) => Promise<void>;
  /** Queues a stored run's inputs and settings on its tool; throws if it cannot. */
  prepareReplay: (steps: Step[], files: File[]) => { toolId: string; ids: string[] };
  downloadAllZip: (toolId: string) => Promise<void>;
}

/** Tools whose queue is being processed; guards against overlapping runs. */
const running = new Set<string>();
/** Items retried while their tool was running; converted once that run finishes. */
const retryAfterRun = new Map<string, Set<string>>();

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: {},
  selectedFormat: {},
  options: {},
  tails: {},
  historyError: {},

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

  retryItem: (toolId, itemId) => {
    const item = (get().items[toolId] || []).find((i) => i.id === itemId);
    if (!item || (item.status !== 'failed' && item.status !== 'cancelled')) return;
    get().updateItem(toolId, itemId, { status: 'ready', progress: 0, error: undefined });
    if (running.has(toolId)) {
      // Don't start a second loop over the same queue; pick it up when this run ends.
      const ids = retryAfterRun.get(toolId) ?? new Set<string>();
      ids.add(itemId);
      retryAfterRun.set(toolId, ids);
      return;
    }
    void get().startConversion(toolId, { ids: [itemId] });
  },

  startConversion: async (toolId, { ids, record = true } = {}) => {
    const tool = getToolById(toolId);
    if (!tool || running.has(toolId)) return;
    const isPending = (item: QueueItem | undefined): item is QueueItem =>
      !!item &&
      (item.status === 'ready' || item.status === 'failed') &&
      (!ids || ids.includes(item.id));
    const pending = (get().items[toolId] || []).filter((item) => isPending(item));
    if (!pending.length) return;
    const tail = get().tails[toolId] ?? [];
    const first = defaultStep(tool);
    const options = { ...first.options, ...get().options[toolId] };
    const groups = [first, ...tail].some(combinesFiles) ? [pending] : pending.map((item) => [item]);
    const workflowLimits = { serverMaxUploadMB: get().serverMaxUploadMB };
    let recordedSteps: Step[] | undefined;
    const recordedFiles: File[] = [];

    running.add(toolId);
    try {
      for (const candidates of groups) {
        // Skip items the user cancelled or removed while they were waiting.
        const latest = get().items[toolId] || [];
        const group = candidates
          .map((candidate) => latest.find((item) => item.id === candidate.id))
          .filter(isPending);
        if (!group.length) continue;
        const controller = new AbortController();
        for (const item of group) {
          get().updateItem(toolId, item.id, {
            status: 'converting', progress: 0, abortController: controller, error: undefined,
          });
        }
        const files = group.map((item) => item.file);
        const steps = [{ toolId, format: group[0]?.targetFormat ?? first.format, options }, ...tail];
        try {
          const outputs = await runWorkflow(steps, files, {
            signal: controller.signal,
            onProgress: (progress) => group.forEach((item) => get().updateItem(toolId, item.id, { progress })),
          }, workflowLimits);
          controller.signal.throwIfAborted();
          const stillQueued = new Set((get().items[toolId] || []).map((item) => item.id));
          group.forEach((item, index) => {
            const output = outputs[index];
            // Removed while converting: don't create an object URL nobody will revoke.
            if (!stillQueued.has(item.id)) return;
            get().updateItem(toolId, item.id, {
              status: 'done', progress: 100, abortController: undefined,
              result: output ? { ...output, url: URL.createObjectURL(output.blob) } : undefined,
            });
          });
          recordedSteps = steps;
          recordedFiles.push(...files);
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
    } finally {
      running.delete(toolId);
    }

    const retried = retryAfterRun.get(toolId);
    retryAfterRun.delete(toolId);
    const retryRun = retried?.size
      ? get().startConversion(toolId, { ids: [...retried], record })
      : undefined;

    // One history entry per run (not per file); replays don't add duplicates.
    if (record && recordedSteps && recordedFiles.length) {
      let historyError = '';
      try {
        await rememberRun(recordedSteps, recordedFiles);
      } catch {
        historyError = 'Conversion finished. Browser storage could not save this run.';
      }
      set((state) => ({ historyError: { ...state.historyError, [toolId]: historyError } }));
    }
    await retryRun;
  },

  prepareReplay: (steps, files) => {
    const [initial, ...following] = steps;
    const tool = initial && getToolById(initial.toolId);
    if (!initial || !tool) throw new Error('This tool is no longer available.');
    if (running.has(tool.id)) throw new Error('Wait for the current conversion to finish.');
    const current = get().items[tool.id] || [];
    if (current.length + files.length > 20) {
      throw new Error('Clear some queue items to make room for this run.');
    }
    const withDefaults = (step: Step): Step => {
      const stepTool = getToolById(step.toolId);
      if (!stepTool) throw new Error('This tool is no longer available.');
      return { ...step, options: { ...defaultStep(stepTool).options, ...step.options } };
    };
    const tail = following.map(withDefaults);
    const added: QueueItem[] = files.map((file) => ({
      id: generateId(), file, status: 'ready', progress: 0, targetFormat: initial.format,
    }));
    set((state) => ({
      items: { ...state.items, [tool.id]: [...current, ...added] },
      selectedFormat: { ...state.selectedFormat, [tool.id]: initial.format },
      options: { ...state.options, [tool.id]: withDefaults(initial).options },
      tails: { ...state.tails, [tool.id]: tail },
    }));
    return { toolId: tool.id, ids: added.map((item) => item.id) };
  },

  setTail: (toolId, steps) => {
    set((state) => ({ tails: { ...state.tails, [toolId]: steps } }));
  },

  setServerMaxUploadMB: (mb) => {
    set({ serverMaxUploadMB: mb });
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

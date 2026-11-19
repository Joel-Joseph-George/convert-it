import { create } from 'zustand';

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
  startFakeConversion: (toolId: string) => void;
  cancelItem: (toolId: string, itemId: string) => void;
}

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
      // Also update uncompleted queue items
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
    get().updateItem(toolId, itemId, { status: 'cancelled' });
  },

  // Fake conversion progress runner for Phase 1 demonstration
  startFakeConversion: (toolId: string) => {
    const current = get().items[toolId] || [];
    const pending = current.filter(
      (i) => i.status === 'ready' || i.status === 'failed'
    );
    if (pending.length === 0) return;

    pending.forEach((item, index) => {
      // Stagger start
      setTimeout(() => {
        get().updateItem(toolId, item.id, {
          status: 'converting',
          progress: 10,
        });

        let prog = 10;
        const interval = setInterval(() => {
          prog += 25;
          if (prog < 100) {
            get().updateItem(toolId, item.id, { progress: prog });
          } else {
            clearInterval(interval);
            const baseName = item.file.name.substring(
              0,
              item.file.name.lastIndexOf('.')
            ) || item.file.name;
            const ext = item.targetFormat;
            const dummyBlob = new Blob(['sample-converted-data'], {
              type: 'application/octet-stream',
            });
            const url = URL.createObjectURL(dummyBlob);

            get().updateItem(toolId, item.id, {
              status: 'done',
              progress: 100,
              result: {
                filename: `${baseName}.${ext}`,
                blob: dummyBlob,
                url,
                sizeBytes: item.file.size * 0.85,
              },
            });
          }
        }, 150);
      }, index * 200);
    });
  },
}));

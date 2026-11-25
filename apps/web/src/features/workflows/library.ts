import type { Step } from './conversion';

export interface Preset extends Step {
  name: string;
}

export interface RecentRun {
  id: number;
  created: number;
  names: string[];
  steps: Step[];
}

const HISTORY_LIMIT = 20;
export const libraryChanged = 'convertit-library-changed';
let connection: Promise<IDBDatabase> | undefined;

function database(): Promise<IDBDatabase> {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('convertit-conversions', 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        db.createObjectStore('presets', { keyPath: ['toolId', 'name'] });
        db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('inputs');
      };
      open.onsuccess = () => {
        const db = open.result;
        db.onversionchange = () => {
          db.close();
          connection = undefined;
        };
        resolve(db);
      };
      open.onerror = () => reject(open.error);
    }).catch((error) => {
      connection = undefined;
      throw error;
    });
  }
  return connection;
}

async function write(
  stores: string[],
  operation: (tx: IDBTransaction) => void
) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error('Browser storage is unavailable.'));
    operation(tx);
  });
  window.dispatchEvent(new Event(libraryChanged));
}

async function read<T>(
  store: string,
  query: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = query(db.transaction(store).objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const listPresets = (): Promise<Preset[]> =>
  read('presets', (store) => store.getAll());
export const savePreset = (preset: Preset) =>
  write(['presets'], (tx) => tx.objectStore('presets').put(preset));
export const deletePreset = (preset: Preset) =>
  write(['presets'], (tx) =>
    tx.objectStore('presets').delete([preset.toolId, preset.name])
  );
export const listHistory = (): Promise<RecentRun[]> =>
  read('history', (store) => store.getAll());
export const loadInputs = (id: number): Promise<File[] | undefined> =>
  read('inputs', (store) => store.get(id));

export function rememberRun(steps: Step[], files: File[]) {
  return write(['history', 'inputs'], (tx) => {
    const history = tx.objectStore('history');
    const inputs = tx.objectStore('inputs');
    const entry = history.add({
      created: Date.now(),
      names: files.map((file) => file.name),
      steps,
    });
    entry.onsuccess = () => {
      inputs.put(files, entry.result);
      const keys = history.getAllKeys();
      keys.onsuccess = () => {
        for (const id of keys.result.slice(
          0,
          Math.max(0, keys.result.length - HISTORY_LIMIT)
        )) {
          history.delete(id);
          inputs.delete(id);
        }
      };
    };
  });
}

export function clearHistory() {
  return write(['history', 'inputs'], (tx) => {
    tx.objectStore('history').clear();
    tx.objectStore('inputs').clear();
  });
}

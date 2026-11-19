import { create } from 'zustand';
import type { Index } from './embed.worker';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  pages?: number[];
}
interface ChatState {
  file: File | null;
  status: 'empty' | 'indexing' | 'ready' | 'asking';
  progress: string;
  messages: Message[];
}
export const emptyState: ChatState = { file: null, status: 'empty', progress: '', messages: [] };
export const useChat = create<ChatState>(() => emptyState);

export async function fingerprint(data: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Schema version includes the tokenizer, weights, and chunking strategy.
const STORE = 'minilm-q8-v1';
let database: Promise<IDBDatabase> | undefined;
function openIndex() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('convertit-chat-pdf', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error: unknown) => {
    database = undefined;
    throw error;
  });
  return database;
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openIndex();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error ?? new Error('Local storage is unavailable.'));
    tx.onerror = () => reject(tx.error);
  });
}
export const readIndex = (key: string): Promise<Index | undefined> =>
  transaction('readonly', (store) => store.get(key));
export const saveIndex = (key: string, index: Index) =>
  transaction('readwrite', (store) => store.put(index, key));
export const clearIndexes = () => transaction('readwrite', (store) => store.clear());

/**
 * Passes a dropped file (and what the user wants to do with it) from the
 * home page to the editor without a round trip through the URL.
 */
export type EditorIntent = 'passport' | 'crop' | 'resize' | 'compress';

export interface EditorHandoff {
  file?: File;
  intent?: EditorIntent;
}

let pending: EditorHandoff | null = null;

export function setEditorHandoff(next: EditorHandoff): void {
  pending = next;
}

/** Read without clearing, so React StrictMode's double render sees the same value. */
export function peekEditorHandoff(): EditorHandoff | null {
  return pending;
}

export function clearEditorHandoff(): void {
  pending = null;
}

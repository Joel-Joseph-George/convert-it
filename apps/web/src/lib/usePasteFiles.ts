import * as React from "react";

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement && target.type !== "file")
  );
}

/**
 * Call `onFiles` with files pasted anywhere on the page (Ctrl/Cmd+V of a copied
 * file or screenshot). Pastes into text fields are left alone.
 */
export function usePasteFiles(
  onFiles: (files: File[]) => void,
  enabled = true,
): void {
  const callback = React.useRef(onFiles);
  React.useEffect(() => {
    callback.current = onFiles;
  });

  React.useEffect(() => {
    if (!enabled) return;
    const handlePaste = (event: ClipboardEvent): void => {
      if (isTextTarget(event.target)) return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      callback.current(files);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [enabled]);
}

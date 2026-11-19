import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Button } from '@/components/ui/button';

export function PagePreview({ doc, page, close }: { doc: PDFDocumentProxy; page: number; close: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let rendering: RenderTask | undefined;
    heading.current?.focus();
    setFailed(false);
    void doc.getPage(page).then(async pdfPage => {
      if (!active || !canvas.current) return;
      const viewport = pdfPage.getViewport({ scale: 1.3 });
      canvas.current.width = Math.ceil(viewport.width);
      canvas.current.height = Math.ceil(viewport.height);
      rendering = pdfPage.render({ canvas: canvas.current, viewport });
      await rendering.promise;
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; rendering?.cancel(); };
  }, [doc, page]);
  return <aside aria-label="Source page" className="min-w-0 space-y-3 rounded-card border border-border bg-card p-4"
    onKeyDown={e => { if (e.key === 'Escape') close(); }}>
    <div className="flex items-center justify-between">
      <h2 tabIndex={-1} ref={heading} className="font-semibold">Page {page}</h2>
      <Button size="sm" variant="ghost" onClick={close}>Close preview</Button>
    </div>
    {failed ? <p role="alert">Could not display this page.</p> :
      <canvas ref={canvas} aria-label={`PDF page ${page}`} className="h-auto w-full" />}
  </aside>;
}

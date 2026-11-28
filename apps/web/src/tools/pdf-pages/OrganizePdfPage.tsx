import * as React from "react";
import type * as PdfJs from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  Loader2,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/tool/DropZone";
import { downloadBlob } from "@/tools/image-editor/render";
import { cn } from "@/lib/utils";
import {
  applyPageEdits,
  baseName,
  movePage,
  openPreview,
  PdfPageError,
  renderPreview,
} from "./pdfPages";
import { ErrorBanner, ToolPageHeader } from "./ToolPageHeader";

const MAX_FILE_MB = 100;
const THUMB_WIDTH = 160;

interface PageItem {
  /** Stable key for React and drag-and-drop. */
  key: string;
  /** 0-based page index in the original PDF. */
  source: number;
  /** Extra clockwise rotation (0/90/180/270). */
  rotation: number;
}

interface Thumb {
  url: string;
  width: number;
  height: number;
}

function initialPages(count: number): PageItem[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `p${i}`,
    source: i,
    rotation: 0,
  }));
}

export default function OrganizePdfPage(): React.ReactElement {
  const [file, setFile] = React.useState<File | null>(null);
  const [bytes, setBytes] = React.useState<ArrayBuffer | null>(null);
  const [pages, setPages] = React.useState<PageItem[]>([]);
  const [pageCount, setPageCount] = React.useState(0);
  const [thumbs, setThumbs] = React.useState<Record<number, Thumb>>({});
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);
  const [dragOver, setDragOver] = React.useState<number | null>(null);
  const taskRef = React.useRef<PdfJs.PDFDocumentLoadingTask | null>(null);

  React.useEffect(() => () => void taskRef.current?.destroy(), []);

  const open = async (next: File): Promise<void> => {
    setError(null);
    setLoading(true);
    await taskRef.current?.destroy();
    setThumbs({});
    try {
      const data = await next.arrayBuffer();
      const task = await openPreview(data);
      taskRef.current = task;
      const pdf = await task.promise.catch((err: unknown) => {
        throw new PdfPageError(
          err instanceof Error && err.name === "PasswordException"
            ? "This PDF is password protected. Unlock it first with Unlock PDF."
            : "Could not read this PDF.",
        );
      });
      setFile(next);
      setBytes(data);
      setPageCount(pdf.numPages);
      setPages(initialPages(pdf.numPages));
      setLoading(false);
      // Thumbnails appear one by one so large PDFs show something quickly.
      for (let p = 1; p <= pdf.numPages; p++) {
        if (taskRef.current !== task) return;
        const canvas = await renderPreview(pdf, p, THUMB_WIDTH);
        const thumb = {
          url: canvas.toDataURL("image/jpeg", 0.8),
          width: canvas.width,
          height: canvas.height,
        };
        setThumbs((prev) => ({ ...prev, [p - 1]: thumb }));
      }
    } catch (err) {
      setError(
        err instanceof PdfPageError ? err.message : "Could not read this PDF.",
      );
      setFile(null);
      setLoading(false);
    }
  };

  const update = (
    index: number,
    change: (page: PageItem) => PageItem | null,
  ): void => {
    setPages((prev) => {
      const next = prev.slice();
      const page = next[index];
      if (!page) return prev;
      const changed = change(page);
      if (changed) next[index] = changed;
      else next.splice(index, 1);
      return next;
    });
  };

  const rotate = (page: PageItem, by: number): PageItem => ({
    ...page,
    rotation: (((page.rotation + by) % 360) + 360) % 360,
  });

  const save = async (): Promise<void> => {
    if (!bytes || !file) return;
    setSaving(true);
    setError(null);
    try {
      const out = await applyPageEdits(bytes, pages);
      downloadBlob(
        new Blob([out.slice().buffer], { type: "application/pdf" }),
        `${baseName(file.name)}_organized.pdf`,
      );
    } catch (err) {
      setError(
        err instanceof PdfPageError ? err.message : "Could not save the PDF.",
      );
    } finally {
      setSaving(false);
    }
  };

  const changed =
    pages.length !== pageCount ||
    pages.some((p, i) => p.source !== i || p.rotation !== 0);

  return (
    <div className="space-y-6">
      <ToolPageHeader
        title="Organize PDF pages"
        description="Drag pages into a new order, rotate or delete them, then save a new PDF."
      />

      {error && <ErrorBanner message={error} />}

      {!file ? (
        loading ? (
          <div className="flex h-64 items-center justify-center gap-3 rounded-card border border-border bg-card text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Opening PDF…</span>
          </div>
        ) : (
          <DropZone
            onFilesAdded={(files) => files[0] && void open(files[0])}
            acceptedExtensions={["pdf"]}
            maxFileSizeMB={MAX_FILE_MB}
            multiple={false}
            categoryName="a PDF"
          />
        )
      ) : (
        <section className="space-y-4 rounded-card border border-border bg-card p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p
                className="truncate text-sm font-medium text-foreground"
                title={file.name}
              >
                {file.name}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {pages.length} of {pageCount} pages
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Rotate all pages"
                className="flex items-center gap-0.5 rounded-btn border border-border bg-card pl-2.5 pr-0.5"
              >
                <span className="mr-1 text-xs text-muted-foreground">
                  Rotate all
                </span>
                <IconButton
                  label="Rotate all pages left"
                  onClick={() =>
                    setPages((prev) => prev.map((p) => rotate(p, -90)))
                  }
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton
                  label="Rotate all pages right"
                  onClick={() =>
                    setPages((prev) => prev.map((p) => rotate(p, 90)))
                  }
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </IconButton>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={!changed}
                onClick={() => setPages(initialPages(pageCount))}
              >
                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void taskRef.current?.destroy();
                  taskRef.current = null;
                  setFile(null);
                  setBytes(null);
                  setPages([]);
                }}
              >
                <FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
                Other PDF
              </Button>
              <Button
                size="sm"
                onClick={() => void save()}
                disabled={saving || pages.length === 0}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save PDF
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Drag a page to move it, or use the arrow buttons. Changes only apply
            when you save.
          </p>

          {pages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Every page was deleted. Press Reset to bring them back.
            </p>
          ) : (
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {pages.map((page, index) => {
                const thumb = thumbs[page.source];
                const sideways = page.rotation % 180 !== 0;
                // Shrink sideways thumbnails so they still fit their square.
                const scale =
                  thumb && sideways
                    ? Math.min(thumb.width, thumb.height) /
                      Math.max(thumb.width, thumb.height)
                    : 1;
                return (
                  <li
                    key={page.key}
                    draggable
                    onDragStart={(e) => {
                      setDragFrom(index);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(index));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(index);
                    }}
                    onDragLeave={() =>
                      setDragOver((v) => (v === index ? null : v))
                    }
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragFrom !== null)
                        setPages((prev) => movePage(prev, dragFrom, index));
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    aria-label={`Page ${page.source + 1}, position ${index + 1}`}
                    className={cn(
                      "group flex cursor-grab flex-col gap-2 rounded-btn border bg-background p-2 transition-colors active:cursor-grabbing",
                      dragOver === index && dragFrom !== index
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border",
                      dragFrom === index && "opacity-40",
                    )}
                  >
                    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[6px] bg-muted/50">
                      {thumb ? (
                        <img
                          src={thumb.url}
                          alt=""
                          draggable={false}
                          className="max-h-full max-w-full shadow-sm transition-transform"
                          style={{
                            transform: `rotate(${page.rotation}deg) scale(${scale})`,
                          }}
                        />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {page.source + 1}
                        {page.rotation ? ` · ${page.rotation}°` : ""}
                      </span>
                      <div className="flex items-center">
                        <IconButton
                          label={`Move page ${page.source + 1} earlier`}
                          disabled={index === 0}
                          onClick={() =>
                            setPages((prev) => movePage(prev, index, index - 1))
                          }
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          label={`Move page ${page.source + 1} later`}
                          disabled={index === pages.length - 1}
                          onClick={() =>
                            setPages((prev) => movePage(prev, index, index + 1))
                          }
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          label={`Rotate page ${page.source + 1}`}
                          onClick={() => update(index, (p) => rotate(p, 90))}
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          label={`Delete page ${page.source + 1}`}
                          onClick={() => update(index, () => null)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

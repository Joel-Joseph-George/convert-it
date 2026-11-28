import * as React from "react";
import type * as PdfJs from "pdfjs-dist";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  Loader2,
  PenLine,
  Type,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/tool/DropZone";
import { downloadBlob } from "@/tools/image-editor/render";
import { cn } from "@/lib/utils";
import type { FractionRect } from "@/features/engines/pdfGeometry";
import {
  applyStamps,
  baseName,
  openPreview,
  PdfPageError,
  renderPreview,
} from "./pdfPages";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";
import {
  canvasToStamp,
  SIGNATURE_FONT,
  textToStamp,
  trimCanvas,
  type StampImage,
} from "./stampImages";
import { ErrorBanner, ToolPageHeader } from "./ToolPageHeader";

const MAX_FILE_MB = 100;
const PREVIEW_WIDTH = 900;
const INKS = [
  { value: "#111827", label: "Black" },
  { value: "#1d4ed8", label: "Blue" },
];

interface PlacedStamp extends StampImage {
  id: number;
  page: number;
  rect: FractionRect;
}

type Mode = "draw" | "type";

let nextStampId = 1;

export default function SignPdfPage(): React.ReactElement {
  const [file, setFile] = React.useState<File | null>(null);
  const [bytes, setBytes] = React.useState<ArrayBuffer | null>(null);
  const [pdf, setPdf] = React.useState<PdfJs.PDFDocumentProxy | null>(null);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [preview, setPreview] = React.useState<{
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const [stamps, setStamps] = React.useState<PlacedStamp[]>([]);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [mode, setMode] = React.useState<Mode>("draw");
  const [ink, setInk] = React.useState(INKS[0]?.value ?? "#111827");
  const [typedName, setTypedName] = React.useState("");
  const [text, setText] = React.useState("");
  const [hasInk, setHasInk] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const taskRef = React.useRef<PdfJs.PDFDocumentLoadingTask | null>(null);
  const padRef = React.useRef<SignaturePadHandle | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const stampsRef = React.useRef(stamps);
  stampsRef.current = stamps;

  React.useEffect(
    () => () => {
      void taskRef.current?.destroy();
      stampsRef.current.forEach((s) => URL.revokeObjectURL(s.url));
    },
    [],
  );

  // Render the current page whenever it changes.
  React.useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    void renderPreview(pdf, pageIndex + 1, PREVIEW_WIDTH).then((canvas) => {
      if (!cancelled) {
        setPreview({
          url: canvas.toDataURL("image/jpeg", 0.9),
          width: canvas.width,
          height: canvas.height,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, pageIndex]);

  const open = async (next: File): Promise<void> => {
    setError(null);
    setLoading(true);
    await taskRef.current?.destroy();
    try {
      const data = await next.arrayBuffer();
      const task = await openPreview(data);
      taskRef.current = task;
      const doc = await task.promise.catch((err: unknown) => {
        throw new PdfPageError(
          err instanceof Error && err.name === "PasswordException"
            ? "This PDF is password protected. Unlock it first with Unlock PDF."
            : "Could not read this PDF.",
        );
      });
      setFile(next);
      setBytes(data);
      setPdf(doc);
      setPageIndex(0);
      setPreview(null);
      setStamps([]);
    } catch (err) {
      setError(
        err instanceof PdfPageError ? err.message : "Could not read this PDF.",
      );
    } finally {
      setLoading(false);
    }
  };

  /** Put a new stamp in the middle of the current page. */
  const place = (image: StampImage, widthFraction: number): void => {
    if (!preview) return;
    const pageAspect = preview.height / preview.width;
    let w = widthFraction;
    let h = (w * image.aspect) / pageAspect;
    if (h > 0.5) {
      h = 0.5;
      w = (h * pageAspect) / image.aspect;
    }
    // Step each new item down a little so they don't land on top of each other.
    const onPage = stamps.filter((s) => s.page === pageIndex).length;
    const y = Math.min(1 - h, Math.max(0, 0.45 - h / 2 + (onPage % 6) * 0.07));
    const stamp: PlacedStamp = {
      ...image,
      id: nextStampId++,
      page: pageIndex,
      rect: { x: (1 - w) / 2, y, w, h },
    };
    setStamps((prev) => [...prev, stamp]);
    setSelected(stamp.id);
  };

  const addSignature = async (): Promise<void> => {
    setError(null);
    if (mode === "draw") {
      const canvas = padRef.current?.canvas();
      const trimmed = canvas ? trimCanvas(canvas) : null;
      if (!trimmed) return setError("Draw your signature first.");
      place(await canvasToStamp(trimmed), 0.3);
    } else {
      const image = await textToStamp(typedName, {
        signature: true,
        color: ink,
      });
      if (!image) return setError("Type your name first.");
      place(image, 0.3);
    }
  };

  const addText = async (value: string): Promise<void> => {
    setError(null);
    const image = await textToStamp(value, { color: ink });
    if (!image) return setError("Type some text first.");
    // About 12 pt on a letter/A4 page.
    const pageAspect = preview ? preview.height / preview.width : 1.3;
    place(image, Math.min(0.9, (0.018 * pageAspect) / image.aspect));
  };

  const removeStamp = (id: number): void => {
    setStamps((prev) => {
      const gone = prev.find((s) => s.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((s) => s.id !== id);
    });
    setSelected(null);
  };

  /** Drag to move, or drag the corner handle to resize (keeping proportions). */
  const startDrag = (
    e: React.PointerEvent,
    stamp: PlacedStamp,
    resize: boolean,
  ): void => {
    e.preventDefault();
    e.stopPropagation();
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return;
    setSelected(stamp.id);
    const start = { x: e.clientX, y: e.clientY, rect: stamp.rect };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const pxAspect = stamp.aspect * (stage.width / stage.height);
    const onMove = (ev: PointerEvent): void => {
      const dx = (ev.clientX - start.x) / stage.width;
      const dy = (ev.clientY - start.y) / stage.height;
      let rect: FractionRect;
      if (resize) {
        const w = Math.min(1 - start.rect.x, Math.max(0.03, start.rect.w + dx));
        const h = Math.min(1 - start.rect.y, w * pxAspect);
        rect = { ...start.rect, w: h / pxAspect, h };
      } else {
        rect = {
          ...start.rect,
          x: Math.min(1 - start.rect.w, Math.max(0, start.rect.x + dx)),
          y: Math.min(1 - start.rect.h, Math.max(0, start.rect.y + dy)),
        };
      }
      setStamps((prev) =>
        prev.map((s) => (s.id === stamp.id ? { ...s, rect } : s)),
      );
    };
    const onUp = (): void => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  /** Arrow keys nudge the selected stamp; Delete removes it. */
  const onStampKey = (e: React.KeyboardEvent, stamp: PlacedStamp): void => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeStamp(stamp.id);
      return;
    }
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const rect = {
      ...stamp.rect,
      x: Math.min(1 - stamp.rect.w, Math.max(0, stamp.rect.x + move[0])),
      y: Math.min(1 - stamp.rect.h, Math.max(0, stamp.rect.y + move[1])),
    };
    setStamps((prev) =>
      prev.map((s) => (s.id === stamp.id ? { ...s, rect } : s)),
    );
  };

  const save = async (): Promise<void> => {
    if (!bytes || !file) return;
    setSaving(true);
    setError(null);
    try {
      const out = await applyStamps(
        bytes,
        stamps.map(({ page, rect, png }) => ({ page, rect, png })),
      );
      downloadBlob(
        new Blob([out.slice().buffer], { type: "application/pdf" }),
        `${baseName(file.name)}_signed.pdf`,
      );
    } catch (err) {
      setError(
        err instanceof PdfPageError ? err.message : "Could not save the PDF.",
      );
    } finally {
      setSaving(false);
    }
  };

  const pageCount = pdf?.numPages ?? 0;
  const pageStamps = stamps.filter((s) => s.page === pageIndex);
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <ToolPageHeader
        title="Sign PDF"
        description="Draw or type your signature, add text or today's date, and drag them into place."
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
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 space-y-3 rounded-card border border-border bg-card p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-medium text-foreground"
                  title={file.name}
                >
                  {file.name}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {stamps.length} item{stamps.length === 1 ? "" : "s"} placed
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="iconSm"
                  aria-label="Previous page"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[88px] text-center font-mono text-xs text-muted-foreground">
                  Page {pageIndex + 1} of {pageCount}
                </span>
                <Button
                  variant="ghost"
                  size="iconSm"
                  aria-label="Next page"
                  disabled={pageIndex >= pageCount - 1}
                  onClick={() => setPageIndex((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-center rounded-btn bg-muted/50 p-2 sm:p-4">
              {preview ? (
                <div
                  ref={stageRef}
                  data-testid="sign-stage"
                  className="relative w-full max-w-[720px] select-none shadow-md"
                  onPointerDown={() => setSelected(null)}
                >
                  <img
                    src={preview.url}
                    alt={`Page ${pageIndex + 1}`}
                    className="block w-full"
                    draggable={false}
                  />
                  {pageStamps.map((stamp) => (
                    <div
                      key={stamp.id}
                      role="button"
                      tabIndex={0}
                      aria-label="Placed item. Drag to move, arrow keys to nudge, Delete to remove."
                      onPointerDown={(e) => startDrag(e, stamp, false)}
                      onKeyDown={(e) => onStampKey(e, stamp)}
                      onFocus={() => setSelected(stamp.id)}
                      className={cn(
                        "absolute cursor-move touch-none outline-none",
                        selected === stamp.id
                          ? "ring-2 ring-primary ring-offset-1"
                          : "hover:ring-1 hover:ring-primary/50",
                      )}
                      style={{
                        left: `${stamp.rect.x * 100}%`,
                        top: `${stamp.rect.y * 100}%`,
                        width: `${stamp.rect.w * 100}%`,
                        height: `${stamp.rect.h * 100}%`,
                      }}
                    >
                      <img
                        src={stamp.url}
                        alt=""
                        draggable={false}
                        className="h-full w-full"
                      />
                      {selected === stamp.id && (
                        <>
                          <button
                            type="button"
                            aria-label="Remove"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => removeStamp(stamp.id)}
                            className="absolute -top-8 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <span
                            aria-hidden
                            onPointerDown={(e) => startDrag(e, stamp, true)}
                            className="absolute -bottom-3.5 -right-3.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-primary shadow"
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-96 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <Panel title="Signature">
              <div className="grid grid-cols-2 rounded-btn bg-muted p-0.5 text-xs font-medium">
                {(
                  [
                    ["draw", "Draw", PenLine],
                    ["type", "Type", Type],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => {
                      setMode(value);
                      setHasInk(false);
                    }}
                    className={cn(
                      "flex h-8 items-center justify-center gap-1.5 rounded-[8px] transition-colors",
                      mode === value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              {mode === "draw" ? (
                <SignaturePad ref={padRef} color={ink} onChange={setHasInk} />
              ) : (
                <div className="space-y-2">
                  <input
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Your name"
                    aria-label="Your name"
                    className="h-9 w-full rounded-btn border border-border bg-card px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p
                    className="min-h-[56px] truncate rounded-btn border border-dashed border-border bg-white px-3 py-2 text-3xl"
                    style={{ fontFamily: SIGNATURE_FONT, color: ink }}
                  >
                    {typedName || " "}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ink</span>
                {INKS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={`${option.label} ink`}
                    aria-pressed={ink === option.value}
                    onClick={() => setInk(option.value)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 ring-1 ring-border",
                      ink === option.value ? "border-primary" : "border-card",
                    )}
                    style={{ backgroundColor: option.value }}
                  />
                ))}
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => void addSignature()}
                disabled={mode === "draw" ? !hasInk : !typedName.trim()}
              >
                Place signature on page {pageIndex + 1}
              </Button>
            </Panel>

            <Panel title="Text and date">
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void addText(text)}
                  placeholder="Name, initials, a note…"
                  aria-label="Text to add"
                  className="h-9 min-w-0 flex-1 rounded-btn border border-border bg-card px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void addText(text)}
                  disabled={!text.trim()}
                >
                  Add
                </Button>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => void addText(today)}
              >
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                Add today&apos;s date
              </Button>
            </Panel>

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => void save()}
                disabled={saving || stamps.length === 0}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Save signed PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => {
                  void taskRef.current?.destroy();
                  taskRef.current = null;
                  stamps.forEach((s) => URL.revokeObjectURL(s.url));
                  setFile(null);
                  setPdf(null);
                  setBytes(null);
                  setStamps([]);
                }}
              >
                <FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
                Open a different PDF
              </Button>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                This adds a picture of your signature, like signing a printout.
                It is not a certified digital signature.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="space-y-3 rounded-card border border-border bg-card p-4">
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

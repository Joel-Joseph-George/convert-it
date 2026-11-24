import * as React from 'react';
import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  FlipHorizontal,
  FlipVertical,
  ImagePlus,
  Loader2,
  Printer,
  RotateCcw,
  RotateCw,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EngineBadge } from '@/components/shared/EngineBadge';
import { PrivacyLine } from '@/components/shared/PrivacyLine';
import { DropZone } from '@/components/tool/DropZone';
import { cn } from '@/lib/utils';
import { CropStage } from './CropStage';
import {
  ASPECT_PRESETS,
  PASSPORT_PRESETS,
  PRINT_DPI,
  getPassportPreset,
  mmToPx,
} from './presets';
import {
  buildPrintSheet,
  centeredCrop,
  decodeImage,
  downloadBlob,
  encode,
  formatBytes,
  ImageDecodeError,
  renderOutput,
  transformSource,
  type CropRect,
  type OutputFormat,
  type Transform,
} from './render';
import { clearEditorHandoff, peekEditorHandoff } from './handoff';

type CropMode = { kind: 'aspect'; id: string } | { kind: 'passport'; id: string };

const ACCEPTED = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'avif', 'gif', 'bmp'];
const MAX_FILE_MB = 50;
const DEFAULT_PASSPORT_ID = 'in';
const MAX_OUTPUT_PX = 8000;
const FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'jpg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
];

interface Estimate {
  bytes: number;
  quality: number;
  metTarget: boolean;
  url: string;
}

function baseName(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name || 'image';
}

export default function ImageEditorPage(): React.ReactElement {
  const [initial] = React.useState(() => peekEditorHandoff());
  React.useEffect(() => clearEditorHandoff(), []);

  const [fileName, setFileName] = React.useState('');
  const [original, setOriginal] = React.useState<HTMLCanvasElement | null>(null);
  const [source, setSource] = React.useState<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [mode, setMode] = React.useState<CropMode>(() =>
    initial?.intent === 'passport' ? { kind: 'passport', id: DEFAULT_PASSPORT_ID } : { kind: 'aspect', id: 'free' }
  );
  const [crop, setCrop] = React.useState<CropRect>({ x: 0, y: 0, w: 1, h: 1 });
  const [outWidth, setOutWidth] = React.useState<number | null>(null);
  const [format, setFormat] = React.useState<OutputFormat>('jpg');
  const [quality, setQuality] = React.useState(90);
  const [maxKB, setMaxKB] = React.useState(initial?.intent === 'compress' ? '200' : '');
  const [estimate, setEstimate] = React.useState<Estimate | null>(null);
  const [estimating, setEstimating] = React.useState(false);
  const [busy, setBusy] = React.useState<null | 'download' | 'sheet'>(null);
  const changeInputRef = React.useRef<HTMLInputElement | null>(null);

  const passport = mode.kind === 'passport' ? getPassportPreset(mode.id) : undefined;
  const ratio = passport
    ? passport.widthMm / passport.heightMm
    : (ASPECT_PRESETS.find((p) => p.id === mode.id)?.ratio ?? null);

  const loadFile = React.useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        throw new ImageDecodeError(`This photo is larger than ${MAX_FILE_MB} MB.`);
      }
      const canvas = await decodeImage(file);
      setOriginal(canvas);
      setSource(canvas);
      setFileName(file.name);
      setOutWidth(null);
      setFormat(/\.png$/i.test(file.name) ? 'png' : 'jpg');
    } catch (err) {
      setError(
        err instanceof ImageDecodeError ? err.message : 'Something went wrong while opening this photo.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (initial?.file) void loadFile(initial.file);
  }, [initial, loadFile]);

  // A new image or a new ratio starts from the largest centred crop.
  React.useEffect(() => {
    if (source) setCrop(centeredCrop(source.width, source.height, ratio));
  }, [source, ratio]);

  // Passport photos are always printed on white, so default to JPG.
  React.useEffect(() => {
    if (passport) setFormat('jpg');
  }, [passport]);

  const cropW = Math.max(1, Math.round(crop.w));
  const cropH = Math.max(1, Math.round(crop.h));
  const outW = passport ? mmToPx(passport.widthMm) : Math.min(outWidth ?? cropW, MAX_OUTPUT_PX);
  const outH = passport
    ? mmToPx(passport.heightMm)
    : Math.max(1, Math.min(Math.round((outW * crop.h) / crop.w), MAX_OUTPUT_PX));
  const background = format === 'jpg' || passport ? '#ffffff' : undefined;
  const maxBytes = Number(maxKB) > 0 ? Number(maxKB) * 1024 : undefined;
  const q = quality / 100;

  // Live size estimate, debounced while the crop is being dragged.
  React.useEffect(() => {
    if (!source) return;
    let cancelled = false;
    setEstimating(true);
    const t = window.setTimeout(async () => {
      try {
        const canvas = renderOutput(source, crop, outW, outH, background);
        const res = await encode(canvas, format, q, maxBytes);
        if (cancelled) return;
        const url = URL.createObjectURL(res.blob);
        setEstimate((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { bytes: res.blob.size, quality: res.quality, metTarget: res.metTarget, url };
        });
      } catch {
        // The estimate is advisory; the download path reports real errors.
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [source, crop, outW, outH, background, format, q, maxBytes]);

  const estimateUrlRef = React.useRef<string | null>(null);
  estimateUrlRef.current = estimate?.url ?? null;
  React.useEffect(
    () => () => {
      if (estimateUrlRef.current) URL.revokeObjectURL(estimateUrlRef.current);
    },
    []
  );

  const applyTransform = (op: Transform): void => {
    if (!source) return;
    setSource(transformSource(source, op));
  };

  const resetAll = (): void => {
    if (!original) return;
    setSource(original);
    setOutWidth(null);
    setMode({ kind: 'aspect', id: 'free' });
  };

  const handleDownload = async (): Promise<void> => {
    if (!source) return;
    setBusy('download');
    setError(null);
    try {
      const canvas = renderOutput(source, crop, outW, outH, background);
      const res = await encode(canvas, format, q, maxBytes);
      const suffix = passport ? `passport-${passport.id}` : 'edited';
      downloadBlob(res.blob, `${baseName(fileName)}-${suffix}.${format}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handlePrintSheet = async (): Promise<void> => {
    if (!source || !passport) return;
    setBusy('sheet');
    setError(null);
    try {
      const photo = renderOutput(source, crop, outW, outH, '#ffffff');
      const sheet = buildPrintSheet(photo, passport);
      const res = await encode(sheet, 'jpg', 0.95);
      downloadBlob(res.blob, `${baseName(fileName)}-passport-${passport.id}-4x6.jpg`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          to="/tools"
          search={{ q: '', category: 'image' }}
          className="flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Tools</span>
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">Image</span>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Image editor
          </h1>
          <EngineBadge engine="browser" />
        </div>
        <p className="text-sm text-muted-foreground">
          Crop, resize, rotate and make passport photos. Set a file size limit for upload forms.
        </p>
        <PrivacyLine engine="browser" />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-card border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!source ? (
        loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-card border border-border bg-card text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Opening photo…</span>
          </div>
        ) : (
          <div className="space-y-4">
            {passport && (
              <p className="rounded-btn border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Passport photo: </span>
                use a well-lit, front-facing photo against a plain light background.
              </p>
            )}
            <DropZone
              onFilesAdded={(files) => files[0] && void loadFile(files[0])}
              acceptedExtensions={ACCEPTED}
              maxFileSizeMB={MAX_FILE_MB}
              multiple={false}
              categoryName="a photo"
            />
          </div>
        )
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Stage */}
          <section className="min-w-0 space-y-3 rounded-card border border-border bg-card p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground" title={fileName}>
                  {fileName}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {source.width} × {source.height} px
                </p>
              </div>
              <div className="flex items-center gap-1">
                <ToolButton label="Rotate left" onClick={() => applyTransform('rotate-left')}>
                  <RotateCcw className="h-4 w-4" />
                </ToolButton>
                <ToolButton label="Rotate right" onClick={() => applyTransform('rotate-right')}>
                  <RotateCw className="h-4 w-4" />
                </ToolButton>
                <ToolButton label="Flip horizontal" onClick={() => applyTransform('flip-h')}>
                  <FlipHorizontal className="h-4 w-4" />
                </ToolButton>
                <ToolButton label="Flip vertical" onClick={() => applyTransform('flip-v')}>
                  <FlipVertical className="h-4 w-4" />
                </ToolButton>
                <span className="mx-1 h-5 w-px bg-border" />
                <ToolButton label="Reset all edits" onClick={resetAll}>
                  <Undo2 className="h-4 w-4" />
                </ToolButton>
                <ToolButton label="Open a different photo" onClick={() => changeInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" />
                </ToolButton>
                <input
                  ref={changeInputRef}
                  type="file"
                  accept={ACCEPTED.map((e) => `.${e}`).join(',')}
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void loadFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            <div className="relative rounded-btn bg-muted/50 p-3 sm:p-5">
              <CropStage source={source} crop={crop} onCropChange={setCrop} ratio={ratio} passport={passport} />
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-btn bg-background/70">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
              <span>
                Crop {cropW} × {cropH} px
              </span>
              <span className="hidden sm:inline">Drag the corners to resize · arrow keys nudge</span>
            </div>
          </section>

          {/* Controls */}
          <aside className="space-y-4">
            <Panel title="Crop">
              <div className="grid grid-cols-2 rounded-btn bg-muted p-0.5 text-xs font-medium">
                {(['aspect', 'passport'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      setMode(k === 'aspect' ? { kind: 'aspect', id: 'free' } : { kind: 'passport', id: DEFAULT_PASSPORT_ID })
                    }
                    className={cn(
                      'h-8 rounded-[8px] transition-colors',
                      mode.kind === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {k === 'aspect' ? 'Aspect ratio' : 'Passport'}
                  </button>
                ))}
              </div>

              {mode.kind === 'aspect' ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {ASPECT_PRESETS.map((p) => (
                    <Chip key={p.id} selected={mode.id === p.id} onClick={() => setMode({ kind: 'aspect', id: p.id })}>
                      {p.label}
                    </Chip>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs text-muted-foreground">Country / document</span>
                    <select
                      value={mode.id}
                      onChange={(e) => setMode({ kind: 'passport', id: e.target.value })}
                      className="h-9 w-full rounded-btn border border-input bg-card px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {PASSPORT_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} · {p.widthMm}×{p.heightMm} mm
                        </option>
                      ))}
                    </select>
                  </label>
                  {passport && (
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Head height {passport.headMinMm}–{passport.headMaxMm} mm. Line the face up with the oval,
                      with the top of the head just below the oval&apos;s top. Check the official rules before
                      you submit.
                    </p>
                  )}
                </div>
              )}
            </Panel>

            <Panel title="Size">
              {passport ? (
                <div className="space-y-1 text-xs">
                  <p className="font-mono text-foreground">
                    {outW} × {outH} px
                  </p>
                  <p className="text-muted-foreground">
                    {passport.widthMm} × {passport.heightMm} mm at {PRINT_DPI} DPI
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-end gap-2">
                    <NumberField
                      label="Width"
                      value={outW}
                      onCommit={(v) => setOutWidth(Math.min(v, MAX_OUTPUT_PX))}
                    />
                    <span className="pb-2 text-xs text-muted-foreground">×</span>
                    <NumberField
                      label="Height"
                      value={outH}
                      onCommit={(v) => setOutWidth(Math.min(Math.round((v * crop.w) / crop.h), MAX_OUTPUT_PX))}
                    />
                    <span className="pb-2 text-xs text-muted-foreground">px</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 0.75, 0.5, 0.25].map((p) => (
                      <Chip
                        key={p}
                        selected={outW === Math.round(cropW * p)}
                        onClick={() => setOutWidth(p === 1 ? null : Math.max(1, Math.round(cropW * p)))}
                      >
                        {p * 100}%
                      </Chip>
                    ))}
                  </div>
                  {outW > cropW && (
                    <p className="text-[11px] text-warning">Larger than the crop, so it will look softer.</p>
                  )}
                </>
              )}
            </Panel>

            <Panel title="Export">
              <div className="grid grid-cols-3 gap-1.5">
                {FORMATS.map((f) => (
                  <Chip key={f.value} selected={format === f.value} onClick={() => setFormat(f.value)} mono>
                    {f.label}
                  </Chip>
                ))}
              </div>

              <label className={cn('block space-y-1.5', format === 'png' && 'opacity-50')}>
                <span className="flex justify-between text-xs text-muted-foreground">
                  <span>Quality</span>
                  <span className="font-mono text-foreground">{format === 'png' ? 'Lossless' : `${quality}%`}</span>
                </span>
                <input
                  type="range"
                  min={30}
                  max={100}
                  step={5}
                  value={quality}
                  disabled={format === 'png'}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full accent-[var(--primary)]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">Max file size (optional)</span>
                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    placeholder="e.g. 50"
                    value={maxKB}
                    onChange={(e) => setMaxKB(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                    className="h-9 w-full rounded-btn border border-input bg-card px-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">KB</span>
                </div>
              </label>

              <div className="flex items-center gap-3 rounded-btn border border-border bg-muted/40 p-2">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-muted">
                  {estimate && <img src={estimate.url} alt="Output preview" className="max-h-full max-w-full object-contain" />}
                </div>
                <div className="min-w-0 space-y-0.5 text-xs">
                  <p className="font-mono text-foreground">
                    {outW} × {outH} · {estimate ? formatBytes(estimate.bytes) : '—'}
                    {estimating && <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin text-muted-foreground" />}
                  </p>
                  {maxBytes && estimate ? (
                    estimate.metTarget ? (
                      <p className="flex items-center gap-1 text-success">
                        <Check className="h-3 w-3" /> Under {maxKB} KB at {Math.round(estimate.quality * 100)}% quality
                      </p>
                    ) : (
                      <p className="text-warning">
                        {format === 'png'
                          ? 'PNG cannot be squeezed further. Try JPG or WebP.'
                          : `Can't reach ${maxKB} KB. Try a smaller size.`}
                      </p>
                    )
                  ) : (
                    <p className="text-muted-foreground">Estimated download size</p>
                  )}
                </div>
              </div>

              <Button className="h-10 w-full gap-2" onClick={() => void handleDownload()} disabled={busy !== null}>
                {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download {format.toUpperCase()}
              </Button>

              {passport && (
                <Button
                  variant="secondary"
                  className="h-10 w-full gap-2"
                  onClick={() => void handlePrintSheet()}
                  disabled={busy !== null}
                >
                  {busy === 'sheet' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                  4×6 in print sheet
                </Button>
              )}
            </Panel>
          </aside>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="space-y-3 rounded-card border border-border bg-card p-4">
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Chip({
  selected,
  onClick,
  children,
  mono,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  mono?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-chip px-2 text-xs font-medium transition-colors',
        mono && 'font-mono',
        selected
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Button type="button" variant="ghost" size="iconSm" aria-label={label} title={label} onClick={onClick}>
      {children}
    </Button>
  );
}

/** Number input that keeps a draft while typing and commits on blur or Enter. */
function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
}): React.ReactElement {
  const [draft, setDraft] = React.useState(String(value));
  React.useEffect(() => setDraft(String(value)), [value]);

  const commit = (): void => {
    const n = Math.round(Number(draft));
    if (Number.isFinite(n) && n >= 1) onCommit(n);
    else setDraft(String(value));
  };

  return (
    <label className="block flex-1 space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="h-9 w-full rounded-btn border border-input bg-card px-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

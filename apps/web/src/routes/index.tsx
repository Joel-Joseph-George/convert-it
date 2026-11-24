import * as React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Crop, ImagePlus, Minimize2, Scaling, ShieldCheck, UserSquare } from 'lucide-react';
import { PopularToolsStrip } from '@/components/tool/PopularToolsStrip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { setEditorHandoff, type EditorIntent } from '@/tools/image-editor/handoff';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|avif|gif|bmp)$/i;

const INTENTS: {
  intent: EditorIntent;
  title: string;
  detail: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { intent: 'passport', title: 'Passport photo', detail: '35×45 mm, 2×2 in and more', Icon: UserSquare },
  { intent: 'crop', title: 'Crop', detail: '1:1, 4:5, 16:9 or free', Icon: Crop },
  { intent: 'resize', title: 'Resize', detail: 'Exact pixels or a percentage', Icon: Scaling },
  { intent: 'compress', title: 'Reduce to KB', detail: 'Hit upload-form size limits', Icon: Minimize2 },
];

function isImage(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXT.test(file.name);
}

function HomePage(): React.ReactElement {
  const navigate = useNavigate();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const openEditor = (file?: File, intent?: EditorIntent): void => {
    setEditorHandoff({ file, intent });
    void navigate({ to: '/tools/$toolId', params: { toolId: 'image-editor' } });
  };

  const handleFile = (file: File | undefined): void => {
    if (!file) return;
    if (isImage(file)) openEditor(file);
    else void navigate({ to: '/tools', search: { q: '', category: 'all' } });
  };

  return (
    <div className="mx-auto max-w-content space-y-10">
      {/* Hero */}
      <div className="space-y-4 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span>FREE</span>
          <span>•</span>
          <span>NO ADS</span>
          <span>•</span>
          <span>NO SIGN-UP</span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Edit photos without uploading them.
        </h1>

        <p className="mx-auto max-w-md text-base text-muted-foreground">
          Crop, resize and make passport photos right in your browser. Your photo never leaves your device.
        </p>
      </div>

      {/* Primary drop target */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          'flex flex-col items-center justify-center rounded-card border border-dashed px-6 py-12 text-center transition-colors sm:py-14',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border-dashed bg-card/60 hover:border-primary/50 hover:bg-card'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="sr-only"
          aria-label="Choose a photo to edit"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div className="flex h-12 w-12 items-center justify-center rounded-btn bg-primary/10 text-primary">
          <ImagePlus className="h-6 w-6 stroke-[1.75]" />
        </div>
        <p className="mt-4 text-base font-medium text-foreground">Drop a photo to start editing</p>
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP or iPhone HEIC · up to 50 MB</p>
        <Button className="mt-5 gap-2" onClick={() => inputRef.current?.click()}>
          <span>Choose a photo</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick starts */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {INTENTS.map(({ intent, title, detail, Icon }) => (
          <button
            key={intent}
            type="button"
            onClick={() => openEditor(undefined, intent)}
            className="flex flex-col items-start gap-2 rounded-card border border-border bg-card p-3 text-left transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-muted hover:shadow-sm motion-safe:hover:-translate-y-0.5"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-btn bg-primary/10 text-primary">
              <Icon className="h-3.5 w-3.5 stroke-[1.75]" />
            </span>
            <span className="space-y-0.5">
              <span className="block text-xs font-medium text-foreground">{title}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">{detail}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Other converters */}
      <PopularToolsStrip />

      {/* Private by Architecture Callout */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-card border border-border bg-card p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Private by Architecture</span>
          </div>
          <p className="max-w-md text-xs text-muted-foreground">
            Photo editing and most conversions run on your own device using the browser&apos;s canvas and
            WebAssembly. Nothing is uploaded.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 text-center text-xs sm:w-auto">
          <div className="flex-1 rounded-btn border border-border bg-muted px-3 py-2 sm:flex-initial">
            <div className="font-semibold text-foreground">100%</div>
            <div className="text-[10px] text-muted-foreground">In-Memory</div>
          </div>
          <div className="flex-1 rounded-btn border border-border bg-muted px-3 py-2 sm:flex-initial">
            <div className="font-semibold text-foreground">0 bps</div>
            <div className="text-[10px] text-muted-foreground">Telemetry</div>
          </div>
        </div>
      </div>
    </div>
  );
}

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CropRect } from './render';
import type { PassportPreset } from './presets';

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface DragState {
  handle: Handle;
  pointerId: number;
  startX: number;
  startY: number;
  start: CropRect;
}

export interface CropStageProps {
  source: HTMLCanvasElement;
  crop: CropRect;
  onCropChange: (crop: CropRect) => void;
  /** Locked width/height ratio, or null for free crop. */
  ratio: number | null;
  passport?: PassportPreset;
  className?: string;
}

const MAX_STAGE_HEIGHT = 560;

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/** Apply a drag delta (in source pixels) to a crop rect. */
function applyDrag(
  handle: Handle,
  s: CropRect,
  dx: number,
  dy: number,
  W: number,
  H: number,
  ratio: number | null,
  minSize: number
): CropRect {
  if (handle === 'move') {
    return { ...s, x: clamp(s.x + dx, 0, W - s.w), y: clamp(s.y + dy, 0, H - s.h) };
  }

  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  // Anchor is the opposite edge/corner, which stays put.
  const ax = sx >= 0 ? s.x : s.x + s.w;
  const ay = sy >= 0 ? s.y : s.y + s.h;
  const maxW = sx > 0 ? W - ax : sx < 0 ? ax : W;
  const maxH = sy > 0 ? H - ay : sy < 0 ? ay : H;

  let w = sx === 0 ? s.w : clamp(s.w + sx * dx, minSize, maxW);
  let h = sy === 0 ? s.h : clamp(s.h + sy * dy, minSize, maxH);

  if (ratio) {
    h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    if (h < minSize) {
      h = minSize;
      w = h * ratio;
    }
  }

  return {
    x: sx > 0 ? ax : sx < 0 ? ax - w : s.x,
    y: sy > 0 ? ay : sy < 0 ? ay - h : s.y,
    w,
    h,
  };
}

const CORNERS: Handle[] = ['nw', 'ne', 'sw', 'se'];
const EDGES: Handle[] = ['n', 's', 'e', 'w'];

const HANDLE_POS: Record<Exclude<Handle, 'move'>, string> = {
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
  ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
  sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
  se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
  s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
  e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
};

export const CropStage: React.FC<CropStageProps> = ({
  source,
  crop,
  onCropChange,
  ratio,
  passport,
  className,
}) => {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const [containerW, setContainerW] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerW(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = source.width;
  const H = source.height;
  const maxH = Math.min(MAX_STAGE_HEIGHT, typeof window !== 'undefined' ? window.innerHeight * 0.62 : MAX_STAGE_HEIGHT);
  const scale = containerW > 0 ? Math.min(containerW / W, maxH / H) : 0;
  const dw = Math.round(W * scale);
  const dh = Math.round(H * scale);
  const minSize = Math.max(16, scale > 0 ? 28 / scale : 16);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dw === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(dw * dpr);
    canvas.height = Math.round(dh * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }, [source, dw, dh]);

  const onPointerDown = (handle: Handle) => (e: React.PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      handle,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      start: crop,
    };
  };

  const onPointerMove = (e: React.PointerEvent): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || scale === 0) return;
    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;
    onCropChange(applyDrag(drag.handle, drag.start, dx, dy, W, H, ratio, minSize));
  };

  const onPointerUp = (e: React.PointerEvent): void => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const step = (e.shiftKey ? 20 : 2) / (scale || 1);
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onCropChange(applyDrag('move', crop, m[0], m[1], W, H, ratio, minSize));
  };

  const box = {
    left: crop.x * scale,
    top: crop.y * scale,
    width: crop.w * scale,
    height: crop.h * scale,
  };

  const handles = ratio ? CORNERS : [...CORNERS, ...EDGES];

  // Face guide for passport photos: an oval sized to the middle of the
  // allowed head-height range, crown placed a little below the top edge.
  let guide: React.CSSProperties | null = null;
  if (passport) {
    const headRatio = (passport.headMinMm + passport.headMaxMm) / 2 / passport.heightMm;
    const headH = box.height * headRatio;
    const headW = headH * 0.74;
    const top = box.height * (1 - headRatio) * 0.38;
    guide = { width: headW, height: headH, top, left: (box.width - headW) / 2 };
  }

  return (
    <div ref={wrapRef} className={cn('w-full', className)}>
      {scale > 0 && (
        <div
          className="relative mx-auto touch-none select-none"
          style={{ width: dw, height: dh }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Image + dimmed surround, clipped to the image bounds */}
          <div className="absolute inset-0 overflow-hidden rounded-[4px] bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
            <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
            <div
              className="pointer-events-none absolute"
              style={{ ...box, boxShadow: '0 0 0 9999px rgba(12,10,9,0.58)' }}
            />
          </div>

          {/* Interactive crop box, unclipped so edge handles stay grabbable */}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Crop area. Drag to move, use arrow keys to nudge."
            aria-valuetext={`${Math.round(crop.w)} by ${Math.round(crop.h)} pixels`}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown('move')}
            className="absolute cursor-move outline-none ring-primary focus-visible:ring-2"
            style={box}
          >
            <div className="pointer-events-none absolute inset-0 border border-white/90" />
            {/* Rule-of-thirds grid */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-y-0 left-1/3 border-l border-white/30" />
              <div className="absolute inset-y-0 left-2/3 border-l border-white/30" />
              <div className="absolute inset-x-0 top-1/3 border-t border-white/30" />
              <div className="absolute inset-x-0 top-2/3 border-t border-white/30" />
            </div>

            {guide && (
              <>
                <div
                  className="pointer-events-none absolute rounded-[50%] border-2 border-dashed border-white/85"
                  style={guide}
                />
                <span className="pointer-events-none absolute inset-x-0 bottom-1.5 text-center text-[10px] font-medium text-white/90 drop-shadow">
                  Fit face inside the oval
                </span>
              </>
            )}

            {handles.map((h) => (
              <span
                key={h}
                onPointerDown={onPointerDown(h)}
                className={cn(
                  'absolute z-10 flex h-6 w-6 items-center justify-center',
                  HANDLE_POS[h as Exclude<Handle, 'move'>]
                )}
              >
                <span
                  className={cn(
                    'block rounded-[3px] border border-primary bg-white shadow-sm',
                    h.length === 2 ? 'h-3 w-3' : h === 'n' || h === 's' ? 'h-1.5 w-5' : 'h-5 w-1.5'
                  )}
                />
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

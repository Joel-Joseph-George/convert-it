import * as React from "react";
import { Eraser } from "lucide-react";

/** A canvas you draw a signature on with a mouse, finger or pen. */
export interface SignaturePadHandle {
  canvas: () => HTMLCanvasElement | null;
  clear: () => void;
}

export const SignaturePad = React.forwardRef<
  SignaturePadHandle,
  { color: string; onChange: (hasInk: boolean) => void }
>(function SignaturePad({ color, onChange }, ref) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawing = React.useRef(false);
  const last = React.useRef<{ x: number; y: number } | null>(null);
  const scale = 3; // draw at 3× for a crisp result when printed

  const clear = React.useCallback(() => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onChange(false);
  }, [onChange]);

  React.useImperativeHandle(
    ref,
    () => ({ canvas: () => canvasRef.current, clear }),
    [clear],
  );

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
    };
  };

  const stroke = (to: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4 * scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    last.current = to;
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-btn border border-dashed border-border bg-white">
        <canvas
          ref={canvasRef}
          width={360 * scale}
          height={140 * scale}
          aria-label="Signature drawing area"
          className="block h-[140px] w-full touch-none cursor-crosshair"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = point(e);
            stroke({ x: last.current.x + 0.1, y: last.current.y + 0.1 });
            onChange(true);
          }}
          onPointerMove={(e) => drawing.current && stroke(point(e))}
          onPointerUp={() => {
            drawing.current = false;
            last.current = null;
          }}
          onPointerCancel={() => {
            drawing.current = false;
            last.current = null;
          }}
        />
        <span className="pointer-events-none absolute bottom-6 left-4 right-4 border-b border-zinc-300" />
      </div>
      <button
        type="button"
        onClick={clear}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Eraser className="h-3.5 w-3.5" />
        Clear
      </button>
    </div>
  );
});

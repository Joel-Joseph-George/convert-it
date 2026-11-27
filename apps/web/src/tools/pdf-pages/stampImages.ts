import "@fontsource/dancing-script/600.css";

/** Turn signatures and text into tightly-cropped transparent PNGs for stamping. */

export const SIGNATURE_FONT = '"Dancing Script", cursive';
const TEXT_FONT = "Inter, system-ui, sans-serif";
/** Render text big so it stays sharp when printed. */
const TEXT_PX = 120;

export interface StampImage {
  png: Uint8Array;
  url: string;
  /** Height / width of the image. */
  aspect: number;
}

/** Crop a canvas to its non-transparent pixels plus a little padding. Null if empty. */
export function trimCanvas(
  source: HTMLCanvasElement,
  padding = 8,
): HTMLCanvasElement | null {
  const ctx = source.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = source;
  const data = ctx.getImageData(0, 0, width, height).data;
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(width - 1, right + padding);
  bottom = Math.min(height - 1, bottom + padding);
  const out = document.createElement("canvas");
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out
    .getContext("2d")
    ?.drawImage(
      source,
      left,
      top,
      out.width,
      out.height,
      0,
      0,
      out.width,
      out.height,
    );
  return out;
}

export async function canvasToStamp(
  canvas: HTMLCanvasElement,
): Promise<StampImage> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Could not create the image.");
  return {
    png: new Uint8Array(await blob.arrayBuffer()),
    url: URL.createObjectURL(blob),
    aspect: canvas.height / canvas.width,
  };
}

export async function textToStamp(
  text: string,
  options: { signature?: boolean; color: string },
): Promise<StampImage | null> {
  const value = text.trim();
  if (!value) return null;
  const font = `${options.signature ? 600 : 500} ${options.signature ? TEXT_PX * 1.3 : TEXT_PX}px ${
    options.signature ? SIGNATURE_FONT : TEXT_FONT
  }`;
  // The handwriting font is a web font: make sure it's loaded before drawing.
  await document.fonts.load(font, value).catch(() => undefined);
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;
  measure.font = font;
  const width = Math.ceil(measure.measureText(value).width) + TEXT_PX;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.ceil(TEXT_PX * 2.2);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = font;
  ctx.fillStyle = options.color;
  ctx.textBaseline = "middle";
  ctx.fillText(value, TEXT_PX / 2, canvas.height / 2);
  const trimmed = trimCanvas(canvas, 12);
  return trimmed ? canvasToStamp(trimmed) : null;
}

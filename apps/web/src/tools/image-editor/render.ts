/**
 * Canvas helpers for the image editor. Everything here runs in the browser;
 * nothing is uploaded.
 */
import { mmToPx, PRINT_DPI, type PassportPreset } from './presets';

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type OutputFormat = 'jpg' | 'png' | 'webp';

export const FORMAT_MIME: Record<OutputFormat, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Larger sources are scaled down so canvases stay within mobile Safari limits. */
const MAX_SOURCE_PIXELS = 24_000_000;

export class ImageDecodeError extends Error {}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
}

function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable in this browser.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

function isHeic(file: File): boolean {
  return /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type);
}

async function loadViaImageElement(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decode a file into a canvas, applying EXIF orientation. */
export async function decodeImage(file: File): Promise<HTMLCanvasElement> {
  let blob: Blob = file;
  if (isHeic(file)) {
    const mod = await import('heic2any');
    const heic2any = mod.default || mod;
    const out = await heic2any({ blob: file, toType: 'image/png' });
    const first = Array.isArray(out) ? out[0] : out;
    if (!first) throw new ImageDecodeError('Could not read this HEIC photo.');
    blob = first;
  }

  let source: CanvasImageSource;
  let width: number;
  let height: number;
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  } catch {
    try {
      const img = await loadViaImageElement(blob);
      source = img;
      width = img.naturalWidth;
      height = img.naturalHeight;
    } catch {
      throw new ImageDecodeError('This file is not an image your browser can open.');
    }
  }

  const scale = Math.min(1, Math.sqrt(MAX_SOURCE_PIXELS / (width * height)));
  const canvas = makeCanvas(width * scale, height * scale);
  ctx2d(canvas).drawImage(source, 0, 0, canvas.width, canvas.height);
  if ('close' in source && typeof source.close === 'function') source.close();
  return canvas;
}

export type Transform = 'rotate-left' | 'rotate-right' | 'flip-h' | 'flip-v';

/** Return a new canvas with the transform baked in. */
export function transformSource(src: HTMLCanvasElement, op: Transform): HTMLCanvasElement {
  const rotate = op === 'rotate-left' || op === 'rotate-right';
  const out = rotate ? makeCanvas(src.height, src.width) : makeCanvas(src.width, src.height);
  const ctx = ctx2d(out);
  switch (op) {
    case 'rotate-right':
      ctx.translate(out.width, 0);
      ctx.rotate(Math.PI / 2);
      break;
    case 'rotate-left':
      ctx.translate(0, out.height);
      ctx.rotate(-Math.PI / 2);
      break;
    case 'flip-h':
      ctx.translate(out.width, 0);
      ctx.scale(-1, 1);
      break;
    case 'flip-v':
      ctx.translate(0, out.height);
      ctx.scale(1, -1);
      break;
  }
  ctx.drawImage(src, 0, 0);
  return out;
}

/**
 * Crop and resize. Large downscales are done in halving steps, which looks
 * noticeably sharper than a single drawImage.
 */
export function renderOutput(
  src: HTMLCanvasElement,
  crop: CropRect,
  outW: number,
  outH: number,
  background?: string
): HTMLCanvasElement {
  let stage = makeCanvas(crop.w, crop.h);
  ctx2d(stage).drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, stage.width, stage.height);

  while (stage.width / 2 >= outW && stage.height / 2 >= outH) {
    const half = makeCanvas(stage.width / 2, stage.height / 2);
    ctx2d(half).drawImage(stage, 0, 0, half.width, half.height);
    stage = half;
  }

  const out = makeCanvas(outW, outH);
  const ctx = ctx2d(out);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.drawImage(stage, 0, 0, out.width, out.height);
  return out;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The browser could not encode this image.'))),
      FORMAT_MIME[format],
      format === 'png' ? undefined : quality
    );
  });
}

export interface EncodeResult {
  blob: Blob;
  /** Quality actually used (0–1). */
  quality: number;
  /** False when a size limit was asked for and could not be reached. */
  metTarget: boolean;
}

/**
 * Encode at the requested quality. With a byte limit, binary-search the
 * highest quality that fits under it (JPG/WebP only).
 */
export async function encode(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
  maxBytes?: number
): Promise<EncodeResult> {
  const first = await canvasToBlob(canvas, format, quality);
  if (!maxBytes || first.size <= maxBytes) {
    return { blob: first, quality, metTarget: !maxBytes || first.size <= maxBytes };
  }
  if (format === 'png') return { blob: first, quality, metTarget: false };

  let lo = 0.05;
  let hi = quality;
  let best: Blob | null = null;
  let bestQ = lo;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, format, mid);
    if (blob.size <= maxBytes) {
      best = blob;
      bestQ = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  if (best) return { blob: best, quality: bestQ, metTarget: true };
  const smallest = await canvasToBlob(canvas, format, 0.05);
  return { blob: smallest, quality: 0.05, metTarget: smallest.size <= maxBytes };
}

/** Tile passport photos onto a 6×4 in sheet at 300 DPI with cut lines. */
export function buildPrintSheet(photo: HTMLCanvasElement, preset: PassportPreset): HTMLCanvasElement {
  const sheet = makeCanvas(6 * PRINT_DPI, 4 * PRINT_DPI);
  const ctx = ctx2d(sheet);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheet.width, sheet.height);

  const pw = mmToPx(preset.widthMm);
  const ph = mmToPx(preset.heightMm);
  const gap = mmToPx(3);
  const margin = mmToPx(4);
  const cols = Math.max(1, Math.floor((sheet.width - margin * 2 + gap) / (pw + gap)));
  const rows = Math.max(1, Math.floor((sheet.height - margin * 2 + gap) / (ph + gap)));
  const gridW = cols * pw + (cols - 1) * gap;
  const gridH = rows * ph + (rows - 1) * gap;
  const ox = Math.round((sheet.width - gridW) / 2);
  const oy = Math.round((sheet.height - gridH) / 2);

  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ox + c * (pw + gap);
      const y = oy + r * (ph + gap);
      ctx.drawImage(photo, x, y, pw, ph);
      ctx.strokeRect(x - 0.5, y - 0.5, pw + 1, ph + 1);
    }
  }
  return sheet;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Largest crop of the given ratio, centred in a w×h image. */
export function centeredCrop(w: number, h: number, ratio: number | null): CropRect {
  if (!ratio) return { x: 0, y: 0, w, h };
  let cw = w;
  let ch = w / ratio;
  if (ch > h) {
    ch = h;
    cw = h * ratio;
  }
  return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
}

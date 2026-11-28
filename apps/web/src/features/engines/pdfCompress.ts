import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  type PDFObject,
} from "pdf-lib";
import { unzlibSync } from "fflate";
import { EngineError } from "./types";

/**
 * Compress a PDF by re-encoding its embedded photos as smaller JPEGs. Text,
 * vector graphics and fonts are untouched, so the result stays searchable.
 * Only 8-bit RGB/Gray images in JPEG (DCTDecode) or Flate streams are touched;
 * anything else (CMYK, indexed, masks, 16-bit) is left as it is.
 */

export type CompressionLevel = "low" | "balanced" | "high";

export const COMPRESSION_SETTINGS: Record<
  CompressionLevel,
  { quality: number; maxSide: number }
> = {
  low: { quality: 0.8, maxSide: 3000 },
  balanced: { quality: 0.65, maxSide: 2000 },
  high: { quality: 0.45, maxSide: 1400 },
};

/** Images smaller than this aren't worth touching. */
const MIN_IMAGE_BYTES = 10 * 1024;

export interface CompressStats {
  images: number;
  recompressed: number;
}

function filterNames(dict: PDFDict): string[] {
  const filter = dict.lookup(PDFName.of("Filter"));
  if (filter instanceof PDFName) return [filter.decodeText()];
  if (filter instanceof PDFArray) {
    return filter
      .asArray()
      .map((f) => (f instanceof PDFName ? f.decodeText() : "?"));
  }
  return [];
}

function numberOf(dict: PDFDict | undefined, key: string): number | undefined {
  const value = dict?.lookup(PDFName.of(key));
  return value instanceof PDFNumber ? value.asNumber() : undefined;
}

/** Number of colour components for DeviceRGB/DeviceGray (or ICCBased with N=1/3); else null. */
function componentsOf(
  colorSpace: PDFObject | undefined,
  doc: PDFDocument,
): 1 | 3 | null {
  if (colorSpace instanceof PDFName) {
    const name = colorSpace.decodeText();
    if (name === "DeviceRGB") return 3;
    if (name === "DeviceGray") return 1;
    return null;
  }
  if (colorSpace instanceof PDFArray && colorSpace.size() === 2) {
    const kind = colorSpace.lookup(0);
    const profile = colorSpace.lookup(1);
    if (
      kind instanceof PDFName &&
      kind.decodeText() === "ICCBased" &&
      profile instanceof PDFRawStream
    ) {
      const n = numberOf(profile.dict, "N");
      return n === 3 ? 3 : n === 1 ? 1 : null;
    }
  }
  if (colorSpace instanceof PDFRef)
    return componentsOf(doc.context.lookup(colorSpace), doc);
  return null;
}

/**
 * Undo PNG row predictors (PDF /Predictor 10–15) for 8-bit samples.
 * Each row is prefixed with a filter-type byte.
 */
export function unpredictPng(
  data: Uint8Array,
  colors: number,
  columns: number,
): Uint8Array {
  const bpp = colors;
  const rowBytes = colors * columns;
  const rows = Math.floor(data.length / (rowBytes + 1));
  const out = new Uint8Array(rows * rowBytes);
  for (let r = 0; r < rows; r++) {
    const type = data[r * (rowBytes + 1)] ?? 0;
    const src = r * (rowBytes + 1) + 1;
    const dst = r * rowBytes;
    for (let i = 0; i < rowBytes; i++) {
      const raw = data[src + i] ?? 0;
      const left = i >= bpp ? (out[dst + i - bpp] ?? 0) : 0;
      const up = r > 0 ? (out[dst - rowBytes + i] ?? 0) : 0;
      const upLeft =
        r > 0 && i >= bpp ? (out[dst - rowBytes + i - bpp] ?? 0) : 0;
      let value: number;
      switch (type) {
        case 1:
          value = raw + left;
          break;
        case 2:
          value = raw + up;
          break;
        case 3:
          value = raw + ((left + up) >> 1);
          break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          break;
        }
        default:
          value = raw;
      }
      out[dst + i] = value & 0xff;
    }
  }
  return out;
}

/** Raw 8-bit samples (1 or 3 per pixel) to RGBA. */
export function samplesToRgba(
  samples: Uint8Array,
  components: 1 | 3,
  width: number,
  height: number,
): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  for (let p = 0; p < width * height; p++) {
    if (components === 1) {
      const g = samples[p] ?? 0;
      rgba[p * 4] = g;
      rgba[p * 4 + 1] = g;
      rgba[p * 4 + 2] = g;
    } else {
      rgba[p * 4] = samples[p * 3] ?? 0;
      rgba[p * 4 + 1] = samples[p * 3 + 1] ?? 0;
      rgba[p * 4 + 2] = samples[p * 3 + 2] ?? 0;
    }
    rgba[p * 4 + 3] = 255;
  }
  return rgba;
}

async function decodeImage(
  stream: PDFRawStream,
  doc: PDFDocument,
): Promise<ImageBitmap | null> {
  const dict = stream.dict;
  if (dict.lookup(PDFName.of("ImageMask"))?.toString() === "true") return null;
  if (dict.lookup(PDFName.of("Decode"))) return null;
  if (numberOf(dict, "BitsPerComponent") !== 8) return null;
  const components = componentsOf(dict.lookup(PDFName.of("ColorSpace")), doc);
  if (!components) return null;
  const width = numberOf(dict, "Width") ?? 0;
  const height = numberOf(dict, "Height") ?? 0;
  if (width < 1 || height < 1) return null;

  const filters = filterNames(dict);
  if (filters.length === 1 && filters[0] === "DCTDecode") {
    return createImageBitmap(
      new Blob([stream.contents.slice()], { type: "image/jpeg" }),
    );
  }
  if (filters.length === 1 && filters[0] === "FlateDecode") {
    let samples: Uint8Array = unzlibSync(stream.contents);
    const params = dict.lookup(PDFName.of("DecodeParms"));
    const predictor =
      params instanceof PDFDict ? (numberOf(params, "Predictor") ?? 1) : 1;
    if (predictor >= 10) {
      const colors =
        params instanceof PDFDict
          ? (numberOf(params, "Colors") ?? components)
          : components;
      const columns =
        params instanceof PDFDict
          ? (numberOf(params, "Columns") ?? width)
          : width;
      if (colors !== components || columns !== width) return null;
      samples = unpredictPng(samples, colors, columns);
    } else if (predictor !== 1) {
      return null; // TIFF predictor: rare, skip
    }
    if (samples.length < width * height * components) return null;
    const rgba = samplesToRgba(samples, components, width, height);
    return createImageBitmap(new ImageData(rgba, width, height));
  }
  return null;
}

async function encodeJpeg(
  bitmap: ImageBitmap,
  maxSide: number,
  quality: number,
) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new EngineError(
      "CONVERSION_FAILED",
      "Canvas is unavailable in this browser.",
    );
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
}

export async function compressPdf(
  input: ArrayBuffer,
  level: CompressionLevel,
  onProgress: (pct: number) => void = () => {},
  signal?: AbortSignal,
): Promise<{ bytes: Uint8Array; stats: CompressStats }> {
  const { quality, maxSide } = COMPRESSION_SETTINGS[level];
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(input, { updateMetadata: false });
  } catch (err) {
    if (err instanceof Error && /encrypted/i.test(err.message)) {
      throw new EngineError(
        "INVALID_OPTIONS",
        "This PDF is password protected. Unlock it first.",
      );
    }
    throw new EngineError("FILE_CORRUPT", "Could not read this PDF.");
  }

  const images = doc.context
    .enumerateIndirectObjects()
    .filter(
      (entry): entry is [PDFRef, PDFRawStream] =>
        entry[1] instanceof PDFRawStream &&
        entry[1].dict.lookup(PDFName.of("Subtype")) === PDFName.of("Image"),
    );

  const stats: CompressStats = { images: images.length, recompressed: 0 };
  for (const [index, [ref, stream]] of images.entries()) {
    if (signal?.aborted)
      throw new EngineError("CONVERSION_CANCELLED", "Cancelled.");
    onProgress(Math.round((index / Math.max(1, images.length)) * 90));
    if (stream.contents.length < MIN_IMAGE_BYTES) continue;

    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await decodeImage(stream, doc);
      if (!bitmap) continue;
      const encoded = await encodeJpeg(bitmap, maxSide, quality);
      if (encoded.bytes.length >= stream.contents.length * 0.9) continue;

      const dict = stream.dict;
      const replacement = doc.context.stream(encoded.bytes, {
        Type: "XObject",
        Subtype: "Image",
        Width: encoded.width,
        Height: encoded.height,
        ColorSpace: "DeviceRGB",
        BitsPerComponent: 8,
        Filter: "DCTDecode",
      });
      // Keep the soft mask (transparency) and any optional-content settings.
      for (const key of ["SMask", "OC", "Interpolate"]) {
        const value = dict.get(PDFName.of(key));
        if (value) replacement.dict.set(PDFName.of(key), value);
      }
      doc.context.assign(ref, replacement);
      stats.recompressed += 1;
    } catch {
      // An image we can't decode stays as it was.
    } finally {
      bitmap?.close();
    }
  }

  const bytes = await doc.save({ useObjectStreams: true });
  onProgress(100);
  return { bytes, stats };
}

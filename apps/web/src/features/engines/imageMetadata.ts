import { EngineError } from "./types";

/**
 * Remove EXIF/XMP/IPTC metadata (camera, GPS location, dates, comments) from
 * JPEG, PNG and WebP files without re-encoding the pixels. Colour profiles are
 * kept so colours don't shift, and a JPEG's rotation flag is kept so the photo
 * still displays the right way up.
 */

export type ImageKind = "jpeg" | "png" | "webp";

export function detectKind(bytes: Uint8Array): ImageKind | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP")
    return "webp";
  return null;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** EXIF orientation (1–8) from a JPEG APP1 Exif segment payload, or 1. */
export function readExifOrientation(exif: Uint8Array): number {
  // exif starts with "Exif\0\0" then a TIFF header.
  const tiff = 6;
  if (exif.length < tiff + 8) return 1;
  const little = exif[tiff] === 0x49;
  const view = new DataView(exif.buffer, exif.byteOffset, exif.byteLength);
  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > exif.length) return 1;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > exif.length) break;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

/** A minimal APP1 Exif segment that only says how the photo is rotated. */
export function orientationSegment(orientation: number): Uint8Array {
  const payload = new Uint8Array([
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00, // "Exif\0\0"
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08, // TIFF, big-endian, IFD at 8
    0x00,
    0x01, // one entry
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01, // Orientation, SHORT, count 1
    0x00,
    orientation,
    0x00,
    0x00, // value
    0x00,
    0x00,
    0x00,
    0x00, // no next IFD
  ]);
  const length = payload.length + 2;
  return concat([
    new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff]),
    payload,
  ]);
}

/** JPEG APPn segments that carry metadata rather than image data. */
function isMetadataSegment(marker: number, payload: Uint8Array): boolean {
  if (marker === 0xfe) return true; // COM
  if (marker === 0xe1) return true; // APP1: Exif or XMP
  if (marker === 0xed) return true; // APP13: Photoshop / IPTC
  if (marker >= 0xe3 && marker <= 0xef && marker !== 0xee) {
    // APP3–APP15 (not APP14 Adobe, which affects colour decoding): vendor metadata.
    return true;
  }
  return marker === 0xe2 && !ascii(payload, 0, 12).startsWith("ICC_PROFILE"); // APP2 other than ICC (e.g. MPF)
}

export function stripJpeg(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let orientation = 1;
  let insertAt = -1;
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff)
      throw new EngineError("FILE_CORRUPT", "This JPEG looks damaged.");
    const marker = bytes[i + 1] ?? 0;
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0xda || marker === 0xd9) {
      // Start of scan: the rest is image data.
      parts.push(bytes.subarray(i));
      break;
    }
    const length = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    const end = i + 2 + length;
    const payload = bytes.subarray(i + 4, end);
    if (isMetadataSegment(marker, payload)) {
      if (marker === 0xe1 && ascii(payload, 0, 4) === "Exif") {
        orientation = readExifOrientation(payload);
      }
    } else {
      parts.push(bytes.subarray(i, end));
      // Put the orientation right after JFIF (APP0) if there is one, else first.
      if (marker === 0xe0) insertAt = parts.length;
    }
    i = end;
  }
  if (orientation !== 1)
    parts.splice(
      insertAt > 0 ? insertAt : 1,
      0,
      orientationSegment(orientation),
    );
  return concat(parts);
}

const PNG_METADATA_CHUNKS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

export function stripPng(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= bytes.length) {
    const length = view.getUint32(i);
    const type = ascii(bytes, i + 4, 4);
    const end = i + 12 + length;
    if (!PNG_METADATA_CHUNKS.has(type)) parts.push(bytes.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return concat(parts);
}

export function stripWebp(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= bytes.length) {
    const type = ascii(bytes, i, 4);
    const size = view.getUint32(i + 4, true);
    const end = i + 8 + size + (size % 2);
    if (type !== "EXIF" && type !== "XMP ") {
      const chunk = bytes.slice(i, Math.min(end, bytes.length));
      if (type === "VP8X" && chunk.length > 8) {
        chunk[8] = (chunk[8] ?? 0) & ~0x0c; // clear the EXIF and XMP flags
      }
      chunks.push(chunk);
    }
    i = end;
  }
  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(bytes.subarray(0, 12));
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  return concat([header, body]);
}

export function stripMetadata(bytes: Uint8Array): Uint8Array {
  switch (detectKind(bytes)) {
    case "jpeg":
      return stripJpeg(bytes);
    case "png":
      return stripPng(bytes);
    case "webp":
      return stripWebp(bytes);
    default:
      throw new EngineError(
        "UNSUPPORTED_FILE_TYPE",
        "Only JPEG, PNG and WebP photos are supported.",
      );
  }
}

export interface MetadataSummary {
  camera?: string;
  taken?: string;
  software?: string;
  location?: { latitude: number; longitude: number };
  /** How many metadata fields the file has in total. */
  fieldCount: number;
}

/** Read the metadata worth warning about. Empty summary if there's none or it can't be read. */
export async function readMetadata(file: File): Promise<MetadataSummary> {
  try {
    const exifr = (await import("exifr")).default;
    const tags = (await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      xmp: true,
      iptc: true,
      icc: false,
      jfif: false,
      ihdr: false,
    })) as Record<string, unknown> | undefined;
    if (!tags) return { fieldCount: 0 };
    const text = (v: unknown) =>
      typeof v === "string" && v.trim() ? v.trim() : undefined;
    const camera =
      [text(tags.Make), text(tags.Model)].filter(Boolean).join(" ") ||
      undefined;
    const date = tags.DateTimeOriginal ?? tags.CreateDate;
    const latitude =
      typeof tags.latitude === "number" ? tags.latitude : undefined;
    const longitude =
      typeof tags.longitude === "number" ? tags.longitude : undefined;
    return {
      camera,
      taken:
        date instanceof Date && !Number.isNaN(date.getTime())
          ? date.toLocaleString()
          : text(date),
      software: text(tags.Software),
      location:
        latitude !== undefined && longitude !== undefined
          ? { latitude, longitude }
          : undefined,
      fieldCount: Object.keys(tags).length,
    };
  } catch {
    return { fieldCount: 0 };
  }
}

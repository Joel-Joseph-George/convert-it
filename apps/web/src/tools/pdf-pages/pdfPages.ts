import { PDFDocument, degrees } from "pdf-lib";
import type * as PdfJs from "pdfjs-dist";
import {
  displayRectToPdf,
  type FractionRect,
} from "@/features/engines/pdfGeometry";

/** Shared helpers for the Organize PDF and Sign PDF pages. */

export class PdfPageError extends Error {}

/** One page in the output: which source page, and extra clockwise rotation. */
export interface PageEdit {
  source: number;
  rotation: number;
}

async function loadForEditing(
  bytes: ArrayBuffer | Uint8Array,
): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (err) {
    if (err instanceof Error && /encrypted/i.test(err.message)) {
      throw new PdfPageError(
        "This PDF is password protected. Unlock it first with Unlock PDF.",
      );
    }
    throw new PdfPageError("Could not read this PDF.");
  }
}

/** Build a new PDF from `edits`: pages in that order, each with its added rotation. */
export async function applyPageEdits(
  bytes: ArrayBuffer | Uint8Array,
  edits: PageEdit[],
): Promise<Uint8Array> {
  if (edits.length === 0) throw new PdfPageError("Keep at least one page.");
  const src = await loadForEditing(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    src,
    edits.map((e) => e.source),
  );
  copied.forEach((page, i) => {
    const extra = edits[i]?.rotation ?? 0;
    page.setRotation(
      degrees((((page.getRotation().angle + extra) % 360) + 360) % 360),
    );
    out.addPage(page);
  });
  return out.save();
}

/** Move one item to another position (used for page reordering). */
export function movePage<T>(items: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  )
    return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

/** An image (PNG) placed on a page, positioned as fractions of the displayed page. */
export interface Stamp {
  page: number;
  rect: FractionRect;
  png: Uint8Array;
}

export async function applyStamps(
  bytes: ArrayBuffer | Uint8Array,
  stamps: Stamp[],
): Promise<Uint8Array> {
  const doc = await loadForEditing(bytes);
  const cache = new Map<
    Uint8Array,
    Awaited<ReturnType<PDFDocument["embedPng"]>>
  >();
  for (const stamp of stamps) {
    const page = doc.getPage(stamp.page);
    let image = cache.get(stamp.png);
    if (!image) {
      image = await doc.embedPng(stamp.png);
      cache.set(stamp.png, image);
    }
    const place = displayRectToPdf(
      page.getRotation().angle,
      page.getCropBox(),
      stamp.rect,
    );
    page.drawImage(image, {
      x: place.x,
      y: place.y,
      width: place.width,
      height: place.height,
      rotate: degrees(place.rotate),
    });
  }
  return doc.save();
}

/** Open a PDF for previews with pdf.js (worker served from /vendor). */
export async function openPreview(
  bytes: ArrayBuffer,
): Promise<PdfJs.PDFDocumentLoadingTask> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${__VENDOR__.pdfjs}/pdf.worker.min.mjs`;
  return pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) });
}

/** Render a page (as displayed, with its own rotation) to a canvas `width` CSS px wide. */
export async function renderPreview(
  pdf: PdfJs.PDFDocumentProxy,
  pageNumber: number,
  width: number,
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: (width / base.width) * ratio });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PdfPageError("Canvas is unavailable in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

export function baseName(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name || "document";
}

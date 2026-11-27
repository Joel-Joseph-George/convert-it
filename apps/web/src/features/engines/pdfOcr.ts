import { PDFDocument, degrees } from "pdf-lib";
import type * as PdfJs from "pdfjs-dist";
import { EngineError } from "./types";
import { wholePagePlacement } from "./pdfGeometry";

/**
 * OCR for scanned PDFs with tesseract.js (English), fully in the browser.
 * The searchable PDF keeps every original page as it is and adds Tesseract's
 * invisible text layer on top, so it looks identical but can be searched/copied.
 */

const OCR_DPI = 200;

export interface OcrOutput {
  pdf?: Uint8Array;
  text: string;
}

function absolute(path: string): string {
  return new URL(path, window.location.origin).href;
}

async function createOcrWorker(onStatus: (pct: number) => void) {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: absolute(`${__VENDOR__.tesseract}/worker.min.js`),
    corePath: absolute(`${__VENDOR__.tesseract}/core`),
    langPath: absolute(`${__VENDOR__.tesseract}/lang`),
    gzip: true,
    logger: (m) => {
      if (m.status === "recognizing text") onStatus(m.progress);
    },
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    user_defined_dpi: String(OCR_DPI),
  });
  return worker;
}

async function renderPage(
  pdf: PdfJs.PDFDocumentProxy,
  pageNumber: number,
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: OCR_DPI / 72 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new EngineError(
      "CONVERSION_FAILED",
      "Canvas is unavailable in this browser.",
    );
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

export async function ocrPdf(
  input: ArrayBuffer,
  wantPdf: boolean,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<OcrOutput> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${__VENDOR__.pdfjs}/pdf.worker.min.mjs`;

  let out: PDFDocument | undefined;
  if (wantPdf) {
    try {
      out = await PDFDocument.load(input.slice(0), { updateMetadata: false });
    } catch (err) {
      if (err instanceof Error && /encrypted/i.test(err.message)) {
        throw new EngineError(
          "INVALID_OPTIONS",
          "This PDF is password protected. Unlock it first.",
        );
      }
      throw new EngineError("FILE_CORRUPT", "Could not read this PDF.");
    }
  }

  const task = pdfjs.getDocument({ data: new Uint8Array(input.slice(0)) });
  let pageCount = 1;
  let current = 0;
  const report = (pagePct: number) =>
    onProgress(
      Math.min(99, Math.round(((current + pagePct) / pageCount) * 95)),
    );
  const worker = await createOcrWorker(report);
  const texts: string[] = [];
  try {
    const pdf = await task.promise;
    pageCount = pdf.numPages;
    for (let p = 1; p <= pdf.numPages; p++) {
      if (signal?.aborted)
        throw new EngineError("CONVERSION_CANCELLED", "Cancelled.");
      current = p - 1;
      const canvas = await renderPage(pdf, p);
      const { data } = await worker.recognize(
        canvas,
        { pdfTextOnly: true },
        { text: true, pdf: wantPdf },
      );
      texts.push(`--- Page ${p} ---\n${(data.text ?? "").trim()}\n`);

      if (out && data.pdf) {
        const layer = await PDFDocument.load(new Uint8Array(data.pdf));
        const [embedded] = await out.embedPdf(layer, [0]);
        const page = out.getPage(p - 1);
        if (embedded) {
          // pdf.js renders the crop box, so the text layer covers exactly that.
          const place = wholePagePlacement(
            page.getRotation().angle,
            page.getCropBox(),
          );
          page.drawPage(embedded, { ...place, rotate: degrees(place.rotate) });
        }
      }
    }
  } catch (err) {
    if (err instanceof EngineError) throw err;
    throw new EngineError(
      "CONVERSION_FAILED",
      `Text recognition failed: ${(err as Error).message}`,
    );
  } finally {
    await worker.terminate().catch(() => undefined);
    await task.destroy();
  }

  const text = texts.join("\n");
  if (!text.replace(/--- Page \d+ ---/g, "").trim()) {
    throw new EngineError(
      "CONVERSION_FAILED",
      "No text was found in this PDF.",
    );
  }
  const pdf = out ? await out.save() : undefined;
  onProgress(100);
  return { pdf, text };
}

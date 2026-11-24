import { PDFDocument, degrees, type PDFImage } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { BrowserEngine, ConvertContext, ConvertResult, EngineError } from './types';
import { createZipArchive } from './zipUtil';

// Configure local worker source for pdfjs-dist (zero third-party CDN requests)
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
}

const A4: [number, number] = [595.28, 841.89];
const PAGE_MARGIN = 36;

function baseNameOf(file: File): string {
  return file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
}

function pdfResult(bytes: Uint8Array, filename: string): ConvertResult {
  return {
    filename,
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
    mime: 'application/pdf',
    sizeBytes: bytes.byteLength,
  };
}

/**
 * Parse a 1-based page list such as "1-3, 5, 8-" into 0-based indices,
 * in the order given, without duplicates. "all" or "" means every page.
 */
export function parsePageRange(input: string, pageCount: number): number[] {
  const text = input.trim().toLowerCase();
  if (!text || text === 'all') return Array.from({ length: pageCount }, (_, i) => i);

  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of text.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(/^(\d*)\s*-\s*(\d*)$/);
    let from: number;
    let to: number;
    if (m) {
      from = m[1] ? Number(m[1]) : 1;
      to = m[2] ? Number(m[2]) : pageCount;
    } else if (/^\d+$/.test(part)) {
      from = to = Number(part);
    } else {
      throw new EngineError('INVALID_OPTIONS', `"${part}" is not a page number or range like 2-5.`);
    }
    if (from < 1 || to < from) {
      throw new EngineError('INVALID_OPTIONS', `"${part}" is not a valid page range.`);
    }
    for (let p = from; p <= Math.min(to, pageCount); p++) {
      if (!seen.has(p - 1)) {
        seen.add(p - 1);
        out.push(p - 1);
      }
    }
  }
  if (out.length === 0) {
    throw new EngineError('INVALID_OPTIONS', `No pages in that range. This PDF has ${pageCount} pages.`);
  }
  return out;
}

async function mergePdfs(files: File[], ctx: ConvertContext): Promise<ConvertResult[]> {
  try {
    const mergedPdf = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      if (ctx.signal?.aborted) throw new EngineError('CONVERSION_CANCELLED', 'Cancelled.');
      const f = files[i];
      if (!f) continue;
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
      ctx.onProgress(Math.round(((i + 1) / files.length) * 90));
    }
    const bytes = await mergedPdf.save();
    ctx.onProgress(100);
    return [pdfResult(bytes, 'merged_document.pdf')];
  } catch (err) {
    if (err instanceof EngineError) throw err;
    throw new EngineError('FILE_CORRUPT', `Failed to merge PDFs: ${(err as Error).message}`);
  }
}

/**
 * Re-encode formats pdf-lib can't embed (WebP, AVIF, GIF…). Opaque images become
 * JPEG to keep the PDF small; images with transparency become PNG.
 */
async function reencode(file: File): Promise<{ bytes: ArrayBuffer; kind: 'png' | 'jpg' }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new EngineError('FILE_CORRUPT', `Could not read image ${file.name}.`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx2d = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx2d) throw new EngineError('CONVERSION_FAILED', 'Canvas is unavailable in this browser.');
  ctx2d.drawImage(bitmap, 0, 0);
  bitmap.close();

  const pixels = ctx2d.getImageData(0, 0, canvas.width, canvas.height).data;
  let transparent = false;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] !== 255) {
      transparent = true;
      break;
    }
  }
  const kind = transparent ? 'png' : 'jpg';
  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, kind === 'png' ? 'image/png' : 'image/jpeg', 0.92)
  );
  if (!blob) throw new EngineError('CONVERSION_FAILED', `Could not convert ${file.name} for the PDF.`);
  return { bytes: await blob.arrayBuffer(), kind };
}

async function embedImage(doc: PDFDocument, file: File): Promise<PDFImage> {
  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer.slice(0, 4));
  // Sniff the bytes rather than trusting the extension.
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
    return doc.embedPng(buffer);
  }
  if (head[0] === 0xff && head[1] === 0xd8) {
    return doc.embedJpg(buffer);
  }
  const { bytes, kind } = await reencode(file);
  return kind === 'png' ? doc.embedPng(bytes) : doc.embedJpg(bytes);
}

async function imagesToPdf(
  files: File[],
  options: Record<string, string | number | boolean>,
  ctx: ConvertContext
): Promise<ConvertResult[]> {
  const fitToA4 = (options.fit ?? 'fit') === 'fit';
  try {
    const pdfDoc = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      if (ctx.signal?.aborted) throw new EngineError('CONVERSION_CANCELLED', 'Cancelled.');
      const f = files[i];
      if (!f) continue;
      const image = await embedImage(pdfDoc, f);

      if (fitToA4) {
        // A4 in the image's orientation, image scaled to fit inside the margins and centred.
        const landscape = image.width > image.height;
        const [pw, ph] = landscape ? [A4[1], A4[0]] : A4;
        const scale = Math.min((pw - PAGE_MARGIN * 2) / image.width, (ph - PAGE_MARGIN * 2) / image.height);
        const w = image.width * scale;
        const h = image.height * scale;
        pdfDoc.addPage([pw, ph]).drawImage(image, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
      } else {
        pdfDoc
          .addPage([image.width, image.height])
          .drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }
      ctx.onProgress(Math.round(((i + 1) / files.length) * 90));
    }
    const bytes = await pdfDoc.save();
    ctx.onProgress(100);
    return [pdfResult(bytes, 'images_document.pdf')];
  } catch (err) {
    if (err instanceof EngineError) throw err;
    throw new EngineError('FILE_CORRUPT', `Failed to bundle images into PDF: ${(err as Error).message}`);
  }
}

async function splitPdf(file: File, range: string): Promise<ConvertResult> {
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const indices = parsePageRange(range, src.getPageCount());
  const base = baseNameOf(file);
  const everyPage = !range.trim() || range.trim().toLowerCase() === 'all';

  if (!everyPage) {
    // One PDF containing just the chosen pages, in the order given.
    const out = await PDFDocument.create();
    (await out.copyPages(src, indices)).forEach((p) => out.addPage(p));
    const label = indices.length === 1 ? `page-${(indices[0] ?? 0) + 1}` : 'pages';
    return pdfResult(await out.save(), `${base}_${label}.pdf`);
  }

  // "all": one PDF per page, zipped.
  const entries = [];
  for (const idx of indices) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [idx]);
    if (page) out.addPage(page);
    entries.push({ name: `${base}_page-${idx + 1}.pdf`, data: await out.save() });
  }
  const zip = await createZipArchive(entries);
  return { filename: `${base}_pages.zip`, blob: zip, mime: 'application/zip', sizeBytes: zip.size };
}

export const pdfEngine: BrowserEngine = {
  id: 'pdf-engine',
  async run(
    files: File[],
    options: Record<string, string | number | boolean>,
    targetFormat: string,
    ctx: ConvertContext
  ): Promise<ConvertResult[]> {
    if (files.length === 0) return [];
    if (ctx.signal?.aborted) {
      throw new EngineError('CONVERSION_CANCELLED', 'Operation was cancelled.');
    }

    const allPdfs = files.every((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (ctx.toolId === 'merge-pdf' || (!ctx.toolId && files.length > 1 && allPdfs)) {
      return mergePdfs(files, ctx);
    }
    if (ctx.toolId === 'images-to-pdf' || (!ctx.toolId && !allPdfs)) {
      return imagesToPdf(files, options, ctx);
    }

    // Single-PDF operations: split, rotate, remove pages.
    const results: ConvertResult[] = [];
    const total = files.length;

    for (let i = 0; i < total; i++) {
      if (ctx.signal?.aborted) throw new EngineError('CONVERSION_CANCELLED', 'Cancelled.');
      const file = files[i];
      if (!file) continue;

      try {
        if (ctx.toolId === 'split-pdf' || typeof options.pageRange === 'string') {
          results.push(await splitPdf(file, String(options.pageRange ?? 'all')));
          ctx.onProgress(Math.round(((i + 1) / total) * 100));
          continue;
        }

        const pdfDoc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });

        if (options.angle !== undefined) {
          const angleNum = Number(options.angle || 90);
          pdfDoc.getPages().forEach((p) => {
            p.setRotation(degrees((p.getRotation().angle + angleNum) % 360));
          });
        }

        if (typeof options.pagesToRemove === 'string' && options.pagesToRemove.trim()) {
          const count = pdfDoc.getPageCount();
          const toRemove = parsePageRange(options.pagesToRemove, count).sort((a, b) => b - a);
          if (toRemove.length >= count) {
            throw new EngineError('INVALID_OPTIONS', 'That would remove every page. Keep at least one.');
          }
          toRemove.forEach((idx) => pdfDoc.removePage(idx));
        }

        results.push(pdfResult(await pdfDoc.save(), `${baseNameOf(file)}_converted.${targetFormat || 'pdf'}`));
        ctx.onProgress(Math.round(((i + 1) / total) * 100));
      } catch (err) {
        if (err instanceof EngineError) throw err;
        throw new EngineError('FILE_CORRUPT', `Failed to process PDF ${file.name}: ${(err as Error).message}`);
      }
    }

    return results;
  },
};

async function renderPageImage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  format: 'png' | 'jpg'
): Promise<Blob> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) throw new EngineError('CONVERSION_FAILED', 'Canvas is unavailable in this browser.');
  // PDF pages are white paper; without this JPGs get a black background.
  ctx2d.fillStyle = '#ffffff';
  ctx2d.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx2d, viewport }).promise;
  page.cleanup();
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, mime, 0.92));
  if (!blob) throw new EngineError('CONVERSION_FAILED', `Could not encode page ${pageNumber}.`);
  return blob;
}

export const pdfRenderEngine: BrowserEngine = {
  id: 'pdf-render',
  async run(
    files: File[],
    options: Record<string, string | number | boolean>,
    targetFormat: string,
    ctx: ConvertContext
  ): Promise<ConvertResult[]> {
    const results: ConvertResult[] = [];
    const total = files.length;

    for (let i = 0; i < total; i++) {
      if (ctx.signal?.aborted) throw new EngineError('CONVERSION_CANCELLED', 'Cancelled.');
      const file = files[i];
      if (!file) continue;

      const baseName = baseNameOf(file);
      let task: pdfjsLib.PDFDocumentLoadingTask | undefined;

      try {
        const buffer = await file.arrayBuffer();
        task = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdf = await task.promise;

        if (targetFormat === 'txt') {
          let fullText = '';
          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            const pageText = content.items
              .map((item) => ('str' in item ? (item.str as string) : ''))
              .join(' ');
            fullText += `--- Page ${p} ---\n${pageText}\n\n`;
          }
          const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
          results.push({ filename: `${baseName}.txt`, blob, mime: 'text/plain', sizeBytes: blob.size });
        } else if (targetFormat === 'png' || targetFormat === 'jpg') {
          const dpi = Number(options.dpi) || 150;
          const scale = dpi / 72;
          const mime = targetFormat === 'jpg' ? 'image/jpeg' : 'image/png';

          if (pdf.numPages === 1) {
            const blob = await renderPageImage(pdf, 1, scale, targetFormat);
            results.push({ filename: `${baseName}.${targetFormat}`, blob, mime, sizeBytes: blob.size });
          } else {
            const entries = [];
            for (let p = 1; p <= pdf.numPages; p++) {
              if (ctx.signal?.aborted) throw new EngineError('CONVERSION_CANCELLED', 'Cancelled.');
              const blob = await renderPageImage(pdf, p, scale, targetFormat);
              entries.push({
                name: `${baseName}_page-${String(p).padStart(String(pdf.numPages).length, '0')}.${targetFormat}`,
                data: new Uint8Array(await blob.arrayBuffer()),
              });
              ctx.onProgress(Math.round((p / pdf.numPages) * 95));
            }
            const zip = await createZipArchive(entries);
            results.push({ filename: `${baseName}_pages.zip`, blob: zip, mime: 'application/zip', sizeBytes: zip.size });
          }
        } else {
          throw new EngineError('UNSUPPORTED_FILE_TYPE', `Unsupported output "${targetFormat}" for PDF pages.`);
        }

        ctx.onProgress(Math.round(((i + 1) / total) * 100));
      } catch (err) {
        if (err instanceof EngineError) throw err;
        throw new EngineError('FILE_CORRUPT', `Failed to read PDF ${file.name}: ${(err as Error).message}`);
      } finally {
        // Release the document and its worker-side memory.
        await task?.destroy();
      }
    }

    return results;
  },
};

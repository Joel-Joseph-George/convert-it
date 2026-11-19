import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { BrowserEngine, ConvertContext, ConvertResult, EngineError } from './types';

// Configure local worker source for pdfjs-dist (zero third-party CDN requests)
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
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

    // 1. Merge PDF Tool
    if (files.length > 1 && files.every((f) => f.name.toLowerCase().endsWith('.pdf'))) {
      try {
        const mergedPdf = await PDFDocument.create();
        for (let i = 0; i < files.length; i++) {
          if (ctx.signal?.aborted) throw new EngineError('CONVERSION_CANCELLED', 'Cancelled.');
          const f = files[i];
          if (!f) continue;
          const buffer = await f.arrayBuffer();
          const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
          const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
          ctx.onProgress(Math.round(((i + 1) / files.length) * 90));
        }

        const mergedBytes = await mergedPdf.save();
        ctx.onProgress(100);

        return [
          {
            filename: 'merged_document.pdf',
            blob: new Blob([mergedBytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
            mime: 'application/pdf',
            sizeBytes: mergedBytes.byteLength,
          },
        ];
      } catch (err) {
        if (err instanceof EngineError) throw err;
        throw new EngineError('FILE_CORRUPT', `Failed to merge PDFs: ${(err as Error).message}`);
      }
    }

    // 2. Images to PDF Tool
    if (files.some((f) => /\.(png|jpe?g|webp)$/i.test(f.name))) {
      try {
        const pdfDoc = await PDFDocument.create();
        for (let i = 0; i < files.length; i++) {
          if (ctx.signal?.aborted) throw new EngineError('CONVERSION_CANCELLED', 'Cancelled.');
          const f = files[i];
          if (!f) continue;
          const buffer = await f.arrayBuffer();

          let image;
          if (f.name.toLowerCase().endsWith('.png')) {
            image = await pdfDoc.embedPng(buffer);
          } else {
            image = await pdfDoc.embedJpg(buffer);
          }

          const page = pdfDoc.addPage([image.width, image.height]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
          });
          ctx.onProgress(Math.round(((i + 1) / files.length) * 90));
        }

        const pdfBytes = await pdfDoc.save();
        ctx.onProgress(100);

        return [
          {
            filename: 'images_document.pdf',
            blob: new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
            mime: 'application/pdf',
            sizeBytes: pdfBytes.byteLength,
          },
        ];
      } catch (err) {
        if (err instanceof EngineError) throw err;
        throw new EngineError('FILE_CORRUPT', `Failed to bundle images into PDF: ${(err as Error).message}`);
      }
    }

    // 3. Single PDF Operations: Split, Rotate, Remove
    const results: ConvertResult[] = [];
    const total = files.length;

    for (let i = 0; i < total; i++) {
      if (ctx.signal?.aborted) throw new EngineError('CONVERSION_CANCELLED', 'Cancelled.');
      const file = files[i];
      if (!file) continue;

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

      try {
        const buffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

        // Rotate
        if (options.angle !== undefined) {
          const angleNum = Number(options.angle || 90);
          const pages = pdfDoc.getPages();
          pages.forEach((p) => {
            const currentRotation = p.getRotation().angle;
            p.setRotation(degrees((currentRotation + angleNum) % 360));
          });
        }

        // Remove Pages
        if (typeof options.pagesToRemove === 'string' && options.pagesToRemove.trim()) {
          const indicesToRemove = options.pagesToRemove
            .split(',')
            .map((s) => parseInt(s.trim(), 10) - 1)
            .filter((idx) => !isNaN(idx) && idx >= 0 && idx < pdfDoc.getPageCount())
            .sort((a, b) => b - a); // Remove backwards so indices remain valid

          for (const idx of indicesToRemove) {
            pdfDoc.removePage(idx);
          }
        }

        const outBytes = await pdfDoc.save();
        results.push({
          filename: `${baseName}_converted.${targetFormat || 'pdf'}`,
          blob: new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
          mime: 'application/pdf',
          sizeBytes: outBytes.byteLength,
        });

        ctx.onProgress(Math.round(((i + 1) / total) * 100));
      } catch (err) {
        if (err instanceof EngineError) throw err;
        throw new EngineError('FILE_CORRUPT', `Failed to process PDF ${file.name}: ${(err as Error).message}`);
      }
    }

    return results;
  },
};

export const pdfRenderEngine: BrowserEngine = {
  id: 'pdf-render',
  async run(
    files: File[],
    _options: Record<string, string | number | boolean>,
    targetFormat: string,
    ctx: ConvertContext
  ): Promise<ConvertResult[]> {
    const results: ConvertResult[] = [];
    const total = files.length;

    for (let i = 0; i < total; i++) {
      if (ctx.signal?.aborted) throw new EngineError('CONVERSION_CANCELLED', 'Cancelled.');
      const file = files[i];
      if (!file) continue;

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

      try {
        const buffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdf = await loadingTask.promise;

        if (targetFormat === 'txt') {
          // Extract text from each page
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
          results.push({
            filename: `${baseName}.txt`,
            blob,
            mime: 'text/plain',
            sizeBytes: blob.size,
          });
        }

        ctx.onProgress(Math.round(((i + 1) / total) * 100));
      } catch (err) {
        if (err instanceof EngineError) throw err;
        throw new EngineError('FILE_CORRUPT', `Failed to extract text from PDF: ${(err as Error).message}`);
      }
    }

    return results;
  },
};

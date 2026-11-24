import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
import { parsePageRange, pdfEngine } from '@/features/engines/pdfEngine';

describe('PDF Engine', () => {
  async function createSamplePdf(pageCount = 1): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      doc.addPage([200, 200]);
    }
    return doc.save();
  }

  it('merges multiple PDF documents into a single PDF', async () => {
    const pdf1Bytes = await createSamplePdf(2);
    const pdf2Bytes = await createSamplePdf(3);

    const file1 = new File([pdf1Bytes.buffer as ArrayBuffer], 'part1.pdf', { type: 'application/pdf' });
    const file2 = new File([pdf2Bytes.buffer as ArrayBuffer], 'part2.pdf', { type: 'application/pdf' });

    let progressRecorded = 0;
    const results = await pdfEngine.run([file1, file2], {}, 'pdf', {
      onProgress: (p) => {
        progressRecorded = p;
      },
    });

    expect(results.length).toBe(1);
    const res = results[0];
    expect(res).toBeDefined();
    if (!res) return;
    expect(res.filename).toBe('merged_document.pdf');
    expect(res.mime).toBe('application/pdf');
    expect(progressRecorded).toBe(100);

    const mergedDoc = await PDFDocument.load(await res.blob.arrayBuffer());
    expect(mergedDoc.getPageCount()).toBe(5);
  });

  it('rotates PDF pages by specified angle', async () => {
    const pdfBytes = await createSamplePdf(1);
    const file = new File([pdfBytes.buffer as ArrayBuffer], 'single.pdf', { type: 'application/pdf' });

    const results = await pdfEngine.run([file], { angle: 90 }, 'pdf', {
      onProgress: () => {},
    });

    expect(results.length).toBe(1);
    const res = results[0];
    expect(res).toBeDefined();
    if (!res) return;
    const rotatedDoc = await PDFDocument.load(await res.blob.arrayBuffer());
    const page = rotatedDoc.getPage(0);
    expect(page.getRotation().angle).toBe(90);
  });

  it('removes specified pages from PDF', async () => {
    const pdfBytes = await createSamplePdf(3);
    const file = new File([pdfBytes.buffer as ArrayBuffer], 'multi.pdf', { type: 'application/pdf' });

    // Remove page 2 (1-based index)
    const results = await pdfEngine.run([file], { pagesToRemove: '2' }, 'pdf', {
      onProgress: () => {},
    });

    expect(results.length).toBe(1);
    const res = results[0];
    expect(res).toBeDefined();
    if (!res) return;
    const updatedDoc = await PDFDocument.load(await res.blob.arrayBuffer());
    expect(updatedDoc.getPageCount()).toBe(2);
  });

  it('parses page ranges in the order given, without duplicates', () => {
    expect(parsePageRange('all', 3)).toEqual([0, 1, 2]);
    expect(parsePageRange('3, 1-2, 2', 5)).toEqual([2, 0, 1]);
    expect(parsePageRange('4-', 5)).toEqual([3, 4]);
    expect(() => parsePageRange('abc', 5)).toThrow(/not a page number/);
    expect(() => parsePageRange('9', 5)).toThrow(/No pages/);
  });

  it('split keeps only the requested pages', async () => {
    const file = new File([(await createSamplePdf(3)).buffer as ArrayBuffer], 'doc.pdf');
    const [res] = await pdfEngine.run([file], { pageRange: '2' }, 'pdf', {
      onProgress: () => {},
      toolId: 'split-pdf',
    });
    expect(res?.filename).toBe('doc_page-2.pdf');
    const out = await PDFDocument.load(await (res?.blob as Blob).arrayBuffer());
    expect(out.getPageCount()).toBe(1);
  });

  it('split "all" returns a ZIP with one PDF per page', async () => {
    const file = new File([(await createSamplePdf(3)).buffer as ArrayBuffer], 'doc.pdf');
    const [res] = await pdfEngine.run([file], { pageRange: 'all' }, 'pdf', {
      onProgress: () => {},
      toolId: 'split-pdf',
    });
    expect(res?.filename).toBe('doc_pages.zip');
    const entries = unzipSync(new Uint8Array(await (res?.blob as Blob).arrayBuffer()));
    expect(Object.keys(entries)).toEqual(['doc_page-1.pdf', 'doc_page-2.pdf', 'doc_page-3.pdf']);
  });

  it('images to PDF fits images on A4 by default and keeps size when asked', async () => {
    // 1×1 PNG
    const png = Uint8Array.from(
      atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
      (c) => c.charCodeAt(0)
    );
    const file = new File([png], 'dot.png', { type: 'image/png' });
    for (const [fit, size] of [['fit', [595, 842]], ['original', [1, 1]]] as const) {
      const [res] = await pdfEngine.run([file], { fit }, 'pdf', {
        onProgress: () => {},
        toolId: 'images-to-pdf',
      });
      const page = (await PDFDocument.load(await (res?.blob as Blob).arrayBuffer())).getPage(0);
      expect([Math.round(page.getWidth()), Math.round(page.getHeight())]).toEqual(size);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { pdfEngine } from '@/features/engines/pdfEngine';

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
});

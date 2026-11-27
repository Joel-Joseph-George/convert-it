import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import type { PageText } from './chunker';

GlobalWorkerOptions.workerSrc = `${__VENDOR__.pdfjs}/pdf.worker.min.mjs`;

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const task = getDocument({ data, useSystemFonts: true });
  try {
    return await task.promise;
  } catch (error) {
    await task.destroy();
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new Error('This PDF is password-protected. Open an unlocked copy to chat.');
    }
    throw new Error('This PDF could not be opened. Try another copy.');
  }
}

export async function extractPages(doc: PDFDocumentProxy, progress: (page: number) => void) {
  const pages: PageText[] = [];
  for (let page = 1; page <= doc.numPages; page++) {
    const pdfPage = await doc.getPage(page);
    const content = await pdfPage.getTextContent();
    let text = '';
    let lastY: number | undefined;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = item.transform[5];
      if (lastY !== undefined && Math.abs(lastY - y) > Math.max(item.height, 1) * 1.7)
        text += '\n\n';
      text += item.str + (item.hasEOL ? '\n' : ' ');
      lastY = y;
    }
    pages.push({ page, text: text.trim() });
    pdfPage.cleanup();
    progress(page);
  }
  if (pages.reduce((n, p) => n + p.text.replace(/\s/g, '').length, 0) < 8) {
    throw new Error(
      'This PDF has no selectable text to search. Try a text-based PDF or run OCR first.',
    );
  }
  return pages;
}

import { describe, it, expect } from 'vitest';
import { textEngine } from '@/features/engines/textEngine';

describe('Text Engine', () => {
  it('converts Markdown to HTML', async () => {
    const mdContent = '# ConvertIt Title\n\nThis is **bold** text and [a link](https://example.com).';
    const file = new File([mdContent], 'document.md', { type: 'text/markdown' });

    let progressRecorded = 0;
    const results = await textEngine.run([file], {}, 'html', {
      onProgress: (p) => {
        progressRecorded = p;
      },
    });

    expect(results.length).toBe(1);
    const res = results[0];
    expect(res).toBeDefined();
    if (!res) return;
    expect(res.filename).toBe('document.html');
    expect(res.mime).toBe('text/html');
    expect(progressRecorded).toBe(100);

    const htmlText = await res.blob.text();
    expect(htmlText).toContain('<h1>ConvertIt Title</h1>');
    expect(htmlText).toContain('<strong>bold</strong>');
    expect(htmlText).toContain('<a href="https://example.com">a link</a>');
  });

  it('converts HTML to Markdown', async () => {
    const htmlContent = '<h1>Converted Header</h1><p>Sample paragraph with <em>italic</em> text.</p>';
    const file = new File([htmlContent], 'page.html', { type: 'text/html' });

    let progressRecorded = 0;
    const results = await textEngine.run([file], {}, 'md', {
      onProgress: (p) => {
        progressRecorded = p;
      },
    });

    expect(results.length).toBe(1);
    const res = results[0];
    expect(res).toBeDefined();
    if (!res) return;
    expect(res.filename).toBe('page.md');
    expect(res.mime).toBe('text/markdown');
    expect(progressRecorded).toBe(100);

    const mdText = await res.blob.text();
    expect(mdText).toContain('# Converted Header');
    expect(mdText).toContain('italic');
  });
});

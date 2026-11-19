import { describe, it, expect } from 'vitest';
import { deduplicateFilenames, runConversion } from '@/features/engines/registry';
import { getToolById } from '@/features/registry/tools';
import { ConvertResult } from '@/features/engines/types';

describe('Filename Deduplication & Limits Enforcement', () => {
  it('deduplicates colliding filenames with (1), (2) suffixes', () => {
    const dummyBlob = new Blob(['data'], { type: 'text/plain' });
    const inputs: ConvertResult[] = [
      { filename: 'output.txt', blob: dummyBlob, mime: 'text/plain', sizeBytes: 4 },
      { filename: 'output.txt', blob: dummyBlob, mime: 'text/plain', sizeBytes: 4 },
      { filename: 'output.txt', blob: dummyBlob, mime: 'text/plain', sizeBytes: 4 },
      { filename: 'other.txt', blob: dummyBlob, mime: 'text/plain', sizeBytes: 4 },
    ];

    const deduplicated = deduplicateFilenames(inputs);
    expect(deduplicated[0]?.filename).toBe('output.txt');
    expect(deduplicated[1]?.filename).toBe('output (1).txt');
    expect(deduplicated[2]?.filename).toBe('output (2).txt');
    expect(deduplicated[3]?.filename).toBe('other.txt');
  });

  it('rejects files exceeding tool maxFileSizeMB limit with FILE_TOO_LARGE error', async () => {
    const tool = getToolById('markdown-to-html');
    expect(tool).toBeDefined();
    if (!tool) return;

    // Create a mock file larger than markdown-to-html limit (10MB)
    const largeSize = (tool.limits.maxFileSizeMB + 1) * 1024 * 1024;
    const largeFile = new File([''], 'huge.md', { type: 'text/markdown' });
    Object.defineProperty(largeFile, 'size', { value: largeSize });

    await expect(
      runConversion(tool, [largeFile], {}, 'html', { onProgress: () => {} })
    ).rejects.toThrow(/exceeds the limit/i);
  });

  it('aborts operation when AbortSignal is cancelled', async () => {
    const tool = getToolById('markdown-to-html');
    expect(tool).toBeDefined();
    if (!tool) return;

    const file = new File(['# Title'], 'doc.md', { type: 'text/markdown' });
    const controller = new AbortController();
    controller.abort(); // pre-abort

    await expect(
      runConversion(tool, [file], {}, 'html', {
        onProgress: () => {},
        signal: controller.signal,
      })
    ).rejects.toThrow(/cancelled/i);
  });
});

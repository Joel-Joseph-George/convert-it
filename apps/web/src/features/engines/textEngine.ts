import { marked } from 'marked';
import TurndownService from 'turndown';
import { BrowserEngine, ConvertContext, ConvertResult, EngineError } from './types';

export const textEngine: BrowserEngine = {
  id: 'text-engine',
  async run(
    files: File[],
    _options: Record<string, string | number | boolean>,
    targetFormat: string,
    ctx: ConvertContext
  ): Promise<ConvertResult[]> {
    const results: ConvertResult[] = [];
    const total = files.length;
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });

    for (let i = 0; i < total; i++) {
      if (ctx.signal?.aborted) {
        throw new EngineError('CONVERSION_CANCELLED', 'Operation was cancelled.');
      }

      const file = files[i];
      if (!file) continue;

      try {
        const text = await file.text();
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        let convertedText = '';
        let mime = 'text/plain';

        if (targetFormat === 'html') {
          convertedText = await marked.parse(text);
          mime = 'text/html';
        } else if (targetFormat === 'md') {
          convertedText = turndownService.turndown(text);
          mime = 'text/markdown';
        } else {
          convertedText = text;
        }

        const blob = new Blob([convertedText], { type: mime });
        results.push({
          filename: `${baseName}.${targetFormat}`,
          blob,
          mime,
          sizeBytes: blob.size,
        });

        ctx.onProgress(Math.round(((i + 1) / total) * 100));
      } catch (err) {
        if (err instanceof EngineError) throw err;
        throw new EngineError(
          'CONVERSION_FAILED',
          `Failed to process text file ${file.name}: ${(err as Error).message}`
        );
      }
    }

    return results;
  },
};

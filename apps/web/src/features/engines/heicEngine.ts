import { BrowserEngine, ConvertContext, ConvertResult, EngineError } from './types';

export const heicEngine: BrowserEngine = {
  id: 'heic-engine',
  async run(
    files: File[],
    options: Record<string, string | number | boolean>,
    targetFormat: string,
    ctx: ConvertContext
  ): Promise<ConvertResult[]> {
    const results: ConvertResult[] = [];
    const total = files.length;
    const qualityNum = (Number(options.quality ?? 90)) / 100;
    const toType = targetFormat === 'png' ? 'image/png' : 'image/jpeg';
    const ext = targetFormat === 'png' ? 'png' : 'jpg';

    // Lazy-load heic2any only when needed
    const heicModule = await import('heic2any');
    const heic2any = heicModule.default || heicModule;

    for (let i = 0; i < total; i++) {
      if (ctx.signal?.aborted) {
        throw new EngineError('CONVERSION_CANCELLED', 'Operation was cancelled.');
      }

      const file = files[i];
      if (!file) continue;

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

      try {
        const conversionResult = await heic2any({
          blob: file,
          toType,
          quality: qualityNum,
        });

        const outputBlob = Array.isArray(conversionResult)
          ? conversionResult[0]
          : conversionResult;

        if (!outputBlob) {
          throw new EngineError('CONVERSION_FAILED', `Failed to decode HEIC file ${file.name}`);
        }

        results.push({
          filename: `${baseName}.${ext}`,
          blob: outputBlob,
          mime: toType,
          sizeBytes: outputBlob.size,
        });

        ctx.onProgress(Math.round(((i + 1) / total) * 100));
      } catch (err) {
        if (err instanceof EngineError) throw err;
        throw new EngineError(
          'FILE_CORRUPT',
          `Could not transcode HEIC image ${file.name}: ${(err as Error).message}`
        );
      }
    }

    return results;
  },
};

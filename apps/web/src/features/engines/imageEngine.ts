import { BrowserEngine, ConvertContext, ConvertResult, EngineError } from './types';

function getMimeFromFormat(format: string): string {
  switch (format.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    default:
      return 'image/png';
  }
}

export async function isFormatSupported(mimeType: string): Promise<boolean> {
  if (typeof document === 'undefined') return true;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const dataUrl = canvas.toDataURL(mimeType);
  return dataUrl.startsWith(`data:${mimeType}`);
}

export const imageEngine: BrowserEngine = {
  id: 'image-engine',
  async run(
    files: File[],
    options: Record<string, string | number | boolean>,
    targetFormat: string,
    ctx: ConvertContext
  ): Promise<ConvertResult[]> {
    const results: ConvertResult[] = [];
    const total = files.length;

    const rawQuality = options.quality ?? 85;
    const qualityNum = Math.min(100, Math.max(10, Number(rawQuality))) / 100;
    const resizeWidth = Number(options.resize || 0);
    const scalePercentage = Number(options.percentage || 100);
    const scaleMultiplier = Number(options.scale || 1);

    for (let i = 0; i < total; i++) {
      if (ctx.signal?.aborted) {
        throw new EngineError('CONVERSION_CANCELLED', 'Operation was cancelled.');
      }

      const file = files[i];
      if (!file) continue;

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const effectiveFormat =
        targetFormat === 'same'
          ? file.name.split('.').pop()?.toLowerCase() || 'png'
          : targetFormat;
      const targetMime = getMimeFromFormat(effectiveFormat);

      try {
        let bitmap: ImageBitmap;
        try {
          bitmap = await createImageBitmap(file);
        } catch {
          throw new EngineError('FILE_CORRUPT', `Could not decode image ${file.name}.`);
        }

        let targetWidth = bitmap.width;
        let targetHeight = bitmap.height;

        if (resizeWidth > 0 && targetWidth > 0) {
          const ratio = targetHeight / targetWidth;
          targetWidth = resizeWidth;
          targetHeight = Math.round(resizeWidth * ratio);
        } else if (scalePercentage !== 100 && scalePercentage > 0) {
          targetWidth = Math.round(targetWidth * (scalePercentage / 100));
          targetHeight = Math.round(targetHeight * (scalePercentage / 100));
        } else if (scaleMultiplier > 1) {
          targetWidth = Math.round(targetWidth * scaleMultiplier);
          targetHeight = Math.round(targetHeight * scaleMultiplier);
        }

        // Draw to Canvas
        let blob: Blob | null = null;

        if (typeof OffscreenCanvas !== 'undefined') {
          const offscreen = new OffscreenCanvas(targetWidth, targetHeight);
          const offCtx = offscreen.getContext('2d');
          if (!offCtx) throw new EngineError('CONVERSION_FAILED', 'Failed to create 2D canvas context.');

          // If converting to JPEG, fill white background to prevent black background on transparent PNGs
          if (targetMime === 'image/jpeg') {
            offCtx.fillStyle = '#FFFFFF';
            offCtx.fillRect(0, 0, targetWidth, targetHeight);
          }

          offCtx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
          blob = await offscreen.convertToBlob({
            type: targetMime,
            quality: qualityNum,
          });
        } else if (typeof document !== 'undefined') {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const canvasCtx = canvas.getContext('2d');
          if (!canvasCtx) throw new EngineError('CONVERSION_FAILED', 'Failed to create 2D canvas context.');

          if (targetMime === 'image/jpeg') {
            canvasCtx.fillStyle = '#FFFFFF';
            canvasCtx.fillRect(0, 0, targetWidth, targetHeight);
          }

          canvasCtx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

          blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), targetMime, qualityNum);
          });
        }

        bitmap.close();

        if (!blob) {
          throw new EngineError(
            'CONVERSION_FAILED',
            `Browser failed to encode image to ${effectiveFormat.toUpperCase()}.`
          );
        }

        results.push({
          filename: `${baseName}.${effectiveFormat}`,
          blob,
          mime: targetMime,
          sizeBytes: blob.size,
        });

        ctx.onProgress(Math.round(((i + 1) / total) * 100));
      } catch (err) {
        if (err instanceof EngineError) throw err;
        throw new EngineError(
          'CONVERSION_FAILED',
          `Image conversion failed for ${file.name}: ${(err as Error).message}`
        );
      }
    }

    return results;
  },
};

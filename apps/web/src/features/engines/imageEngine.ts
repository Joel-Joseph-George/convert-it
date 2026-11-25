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

const COMPRESSION_QUALITY: Record<string, number> = { low: 0.9, balanced: 0.75, high: 0.55 };

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

function isSvg(file: File): boolean {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
}

/** SVGs can't go through createImageBitmap, so load them through an <img>. */
async function decodeSvg(file: File): Promise<Decoded> {
  const text = await file.text();
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    if (!width || !height) {
      // No width/height attributes: fall back to the viewBox, then a sensible default.
      const vb = text.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
      width = vb ? Number(vb[1]) : 512;
      height = vb ? Number(vb[2]) : 512;
    }
    return { source: img, width, height, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new EngineError('FILE_CORRUPT', `Could not read SVG ${file.name}.`);
  }
}

async function decode(file: File): Promise<Decoded> {
  if (isSvg(file)) return decodeSvg(file);
  try {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    throw new EngineError('FILE_CORRUPT', `Could not decode image ${file.name}.`);
  }
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

    const compressionLevel =
      typeof options.compressionLevel === 'string'
        ? options.compressionLevel
        : ctx.toolId === 'image-compress'
          ? 'balanced'
          : undefined;
    const rawQuality = options.quality ?? 85;
    const qualityNum = compressionLevel
      ? (COMPRESSION_QUALITY[compressionLevel] ?? COMPRESSION_QUALITY.balanced ?? 0.75)
      : Math.min(100, Math.max(10, Number(rawQuality))) / 100;
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
        const bitmap = await decode(file);

        let targetWidth = bitmap.width;
        let targetHeight = bitmap.height;

        if (resizeWidth > 0 && targetWidth > 0) {
          const ratio = targetHeight / targetWidth;
          targetWidth = options.onlyShrink ? Math.min(targetWidth, resizeWidth) : resizeWidth;
          targetHeight = Math.max(1, Math.round(targetWidth * ratio));
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

          offCtx.drawImage(bitmap.source, 0, 0, targetWidth, targetHeight);
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

          canvasCtx.drawImage(bitmap.source, 0, 0, targetWidth, targetHeight);

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

        // Browsers silently fall back to PNG for formats they can't encode (e.g. AVIF).
        if (blob.type && blob.type !== targetMime) {
          throw new EngineError(
            'UNSUPPORTED_FILE_TYPE',
            `This browser can't create ${effectiveFormat.toUpperCase()} files. Pick another format.`
          );
        }

        // Compressing must never make a file bigger: hand back the original instead.
        const sameFormat = getMimeFromFormat(file.name.split('.').pop() || '') === targetMime;
        if (compressionLevel && sameFormat && blob.size >= file.size) {
          blob = file;
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

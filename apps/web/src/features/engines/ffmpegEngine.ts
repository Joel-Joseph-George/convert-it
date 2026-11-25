import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { BrowserEngine, ConvertContext, ConvertResult, EngineError } from './types';

// One shared FFmpeg worker (~31 MB). `loadPromise` memoises loading so concurrent
// callers share it; it is cleared on failure or termination so the next job reloads.
let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
// Progress goes to whichever job currently owns the instance (see runExclusive).
let progressHandler: ((pct: number) => void) | null = null;
// Jobs run one at a time on the single worker so progress and files don't mix.
let jobChain: Promise<unknown> = Promise.resolve();

function getFFmpeg(): Promise<FFmpeg> {
  if (loadPromise) return loadPromise;

  const instance = new FFmpeg();
  instance.on('progress', ({ progress }) => {
    // FFmpeg progress is 0..1
    const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
    progressHandler?.(pct);
  });

  const promise = (async (): Promise<FFmpeg> => {
    try {
      // Load single-threaded core from local public vendor assets (zero CDN requests)
      // Blob URLs let the worker import the core in both the Vite dev server and production
      // (dev refuses to serve /public files as JS modules).
      await instance.load({
        coreURL: await toBlobURL('/vendor/ffmpeg/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL('/vendor/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
      });
      ffmpegInstance = instance;
      return instance;
    } catch (err) {
      instance.terminate();
      throw new EngineError(
        'CONVERSION_FAILED',
        `Failed to initialize WebAssembly FFmpeg core: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  })();
  loadPromise = promise;
  // A failed load must not be cached: the next job tries again with a fresh worker.
  promise.catch(() => {
    if (loadPromise === promise) loadPromise = null;
  });
  return promise;
}

/** Stop any running transcode and drop the worker; the next job loads a fresh one. */
function terminateFFmpeg(): void {
  const instance = ffmpegInstance;
  ffmpegInstance = null;
  loadPromise = null;
  progressHandler = null;
  instance?.terminate();
}

function cancelledError(): EngineError {
  return new EngineError('CONVERSION_CANCELLED', 'Operation was cancelled.');
}

/**
 * Run a job with exclusive use of the shared FFmpeg worker. Progress is routed to this
 * job's ctx, and aborting the signal terminates the worker so the transcode really stops.
 */
async function runExclusive<T>(ctx: ConvertContext, job: (ffmpeg: FFmpeg) => Promise<T>): Promise<T> {
  const previous = jobChain;
  let release!: () => void;
  jobChain = new Promise<void>((resolve) => {
    release = resolve;
  });

  try {
    await previous.catch(() => {});
    if (ctx.signal?.aborted) throw cancelledError();

    const ffmpeg = await getFFmpeg();
    if (ctx.signal?.aborted) throw cancelledError();

    const onAbort = (): void => terminateFFmpeg();
    ctx.signal?.addEventListener('abort', onAbort, { once: true });
    progressHandler = ctx.onProgress;
    try {
      return await job(ffmpeg);
    } catch (err) {
      if (ctx.signal?.aborted) throw cancelledError();
      throw err;
    } finally {
      ctx.signal?.removeEventListener('abort', onAbort);
      if (progressHandler === ctx.onProgress) progressHandler = null;
    }
  } finally {
    release();
  }
}

let fileCounter = 0;
function uniqueName(prefix: string, ext: string): string {
  fileCounter += 1;
  return `${prefix}_${Date.now()}_${fileCounter}.${ext}`;
}

function getAudioMime(format: string): string {
  switch (format.toLowerCase()) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'aac':
      return 'audio/aac';
    case 'flac':
      return 'audio/flac';
    case 'ogg':
      return 'audio/ogg';
    case 'm4a':
      return 'audio/mp4';
    default:
      return 'audio/mpeg';
  }
}

function getVideoMime(format: string): string {
  switch (format.toLowerCase()) {
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'gif':
      return 'image/gif';
    default:
      return 'video/mp4';
  }
}

export const ffmpegAudioEngine: BrowserEngine = {
  id: 'ffmpeg-audio',
  async run(
    files: File[],
    options: Record<string, string | number | boolean>,
    targetFormat: string,
    ctx: ConvertContext
  ): Promise<ConvertResult[]> {
    return runExclusive(ctx, async (ffmpeg) => {
      const results: ConvertResult[] = [];

      const bitrate = options.bitrate ? String(options.bitrate) : '320';
      const channels = options.channels === 'mono' ? '1' : '2';

      // Process one file at a time as per spec Section 6.3
      for (const file of files) {
        if (ctx.signal?.aborted) throw cancelledError();

        const ext = file.name.split('.').pop()?.toLowerCase() || 'tmp';
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const inputName = uniqueName('input', ext);
        const outputName = uniqueName('output', targetFormat);

        try {
          const fileData = await fetchFile(file);
          await ffmpeg.writeFile(inputName, fileData);

          const args = ['-i', inputName];

          if (targetFormat === 'mp3') {
            args.push('-b:a', `${bitrate}k`, '-ac', channels);
          } else if (targetFormat === 'wav') {
            args.push('-ac', channels);
          } else if (targetFormat === 'flac') {
            args.push('-ac', channels);
          } else if (targetFormat === 'aac' || targetFormat === 'm4a') {
            args.push('-c:a', 'aac', '-b:a', `${bitrate}k`, '-ac', channels);
          } else if (targetFormat === 'ogg') {
            args.push('-c:a', 'libvorbis', '-b:a', `${bitrate}k`, '-ac', channels);
          }

          args.push(outputName);

          const code = await ffmpeg.exec(args);
          if (code !== 0) {
            throw new EngineError('CONVERSION_FAILED', `FFmpeg transcode exited with code ${code}`);
          }

          const outData = (await ffmpeg.readFile(outputName)) as Uint8Array;
          const mime = getAudioMime(targetFormat);
          const outputBlob = new Blob([outData.buffer as ArrayBuffer], { type: mime });

          results.push({
            filename: `${baseName}.${targetFormat}`,
            blob: outputBlob,
            mime,
            sizeBytes: outputBlob.size,
          });

          // Free memory between files as instructed
          await ffmpeg.deleteFile(inputName);
          await ffmpeg.deleteFile(outputName);
        } catch (err) {
          if (ctx.signal?.aborted) throw cancelledError();
          await ffmpeg.deleteFile(inputName).catch(() => {});
          await ffmpeg.deleteFile(outputName).catch(() => {});
          if (err instanceof EngineError) throw err;
          throw new EngineError(
            'CONVERSION_FAILED',
            `Audio conversion failed for ${file.name}: ${(err as Error).message}`
          );
        }
      }

      return results;
    });
  },
};

export const ffmpegVideoEngine: BrowserEngine = {
  id: 'ffmpeg-video',
  async run(
    files: File[],
    options: Record<string, string | number | boolean>,
    targetFormat: string,
    ctx: ConvertContext
  ): Promise<ConvertResult[]> {
    return runExclusive(ctx, async (ffmpeg) => {
      const results: ConvertResult[] = [];

      const crf = options.crf ? String(options.crf) : '23';
      const fps = options.fps ? String(options.fps) : '15';
      const scaleWidth = options.scaleWidth ? String(options.scaleWidth) : '480';

      for (const file of files) {
        if (ctx.signal?.aborted) throw cancelledError();

        const ext = file.name.split('.').pop()?.toLowerCase() || 'tmp';
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const inputName = uniqueName('v_input', ext);
        const outputName = uniqueName('v_output', targetFormat);

        try {
          const fileData = await fetchFile(file);
          await ffmpeg.writeFile(inputName, fileData);

          const args = ['-i', inputName];

          if (targetFormat === 'gif') {
            // Never enlarge: cap at the source width. Height -2 keeps it even.
            args.push('-vf', `fps=${fps},scale='min(iw,${scaleWidth})':-2:flags=lanczos`);
          } else if (targetFormat === 'mp4') {
            args.push('-c:v', 'libx264', '-crf', crf, '-preset', 'ultrafast', '-c:a', 'aac');
          } else if (targetFormat === 'webm') {
            args.push('-c:v', 'libvpx', '-crf', crf, '-b:v', '1M', '-c:a', 'libvorbis');
          }

          args.push(outputName);

          const code = await ffmpeg.exec(args);
          if (code !== 0) {
            throw new EngineError('CONVERSION_FAILED', `FFmpeg video execution failed with code ${code}`);
          }

          const outData = (await ffmpeg.readFile(outputName)) as Uint8Array;
          const mime = getVideoMime(targetFormat);
          const outputBlob = new Blob([outData.buffer as ArrayBuffer], { type: mime });

          results.push({
            filename: `${baseName}.${targetFormat}`,
            blob: outputBlob,
            mime,
            sizeBytes: outputBlob.size,
          });

          await ffmpeg.deleteFile(inputName);
          await ffmpeg.deleteFile(outputName);
        } catch (err) {
          if (ctx.signal?.aborted) throw cancelledError();
          await ffmpeg.deleteFile(inputName).catch(() => {});
          await ffmpeg.deleteFile(outputName).catch(() => {});
          if (err instanceof EngineError) throw err;
          throw new EngineError(
            'CONVERSION_FAILED',
            `Video processing failed for ${file.name}: ${(err as Error).message}`
          );
        }
      }

      return results;
    });
  },
};

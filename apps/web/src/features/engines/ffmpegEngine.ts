import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { BrowserEngine, ConvertContext, ConvertResult, EngineError } from './types';

let ffmpegInstance: FFmpeg | null = null;
let isLoaded = false;

async function getFFmpeg(ctx: ConvertContext): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance;
  }

  ffmpegInstance = new FFmpeg();

  ffmpegInstance.on('progress', ({ progress }) => {
    // FFmpeg progress is 0..1
    const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
    ctx.onProgress(pct);
  });

  try {
    // Load single-threaded core from local public vendor assets (zero CDN requests)
    await ffmpegInstance.load({
      coreURL: '/vendor/ffmpeg/ffmpeg-core.js',
      wasmURL: '/vendor/ffmpeg/ffmpeg-core.wasm',
    });
    isLoaded = true;
    return ffmpegInstance;
  } catch (err) {
    isLoaded = false;
    throw new EngineError(
      'CONVERSION_FAILED',
      `Failed to initialize WebAssembly FFmpeg core: ${(err as Error).message}`
    );
  }
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
    const results: ConvertResult[] = [];
    const ffmpeg = await getFFmpeg(ctx);

    const bitrate = options.bitrate ? String(options.bitrate) : '320';
    const channels = options.channels === 'mono' ? '1' : '2';

    // Process one file at a time as per spec Section 6.3
    for (const file of files) {
      if (ctx.signal?.aborted) {
        throw new EngineError('CONVERSION_CANCELLED', 'Operation was cancelled.');
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'tmp';
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const inputName = `input_${Date.now()}.${ext}`;
      const outputName = `output_${Date.now()}.${targetFormat}`;

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
        try {
          await ffmpeg.deleteFile(inputName).catch(() => {});
          await ffmpeg.deleteFile(outputName).catch(() => {});
        } catch {
          // ignore cleanup errors
        }
        if (err instanceof EngineError) throw err;
        throw new EngineError(
          'CONVERSION_FAILED',
          `Audio conversion failed for ${file.name}: ${(err as Error).message}`
        );
      }
    }

    return results;
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
    const results: ConvertResult[] = [];
    const ffmpeg = await getFFmpeg(ctx);

    const crf = options.crf ? String(options.crf) : '23';
    const fps = options.fps ? String(options.fps) : '15';
    const scaleWidth = options.scaleWidth ? String(options.scaleWidth) : '480';

    for (const file of files) {
      if (ctx.signal?.aborted) {
        throw new EngineError('CONVERSION_CANCELLED', 'Operation was cancelled.');
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'tmp';
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const inputName = `v_input_${Date.now()}.${ext}`;
      const outputName = `v_output_${Date.now()}.${targetFormat}`;

      try {
        const fileData = await fetchFile(file);
        await ffmpeg.writeFile(inputName, fileData);

        const args = ['-i', inputName];

        if (targetFormat === 'gif') {
          args.push('-vf', `fps=${fps},scale=${scaleWidth}:-1:flags=lanczos`);
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
        try {
          await ffmpeg.deleteFile(inputName).catch(() => {});
          await ffmpeg.deleteFile(outputName).catch(() => {});
        } catch {
          // ignore
        }
        if (err instanceof EngineError) throw err;
        throw new EngineError(
          'CONVERSION_FAILED',
          `Video processing failed for ${file.name}: ${(err as Error).message}`
        );
      }
    }

    return results;
  },
};

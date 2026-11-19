import { BrowserEngine, ConvertContext, ConvertResult, EngineError } from './types';
import { dataEngine } from './dataEngine';
import { textEngine } from './textEngine';
import { imageEngine } from './imageEngine';
import { heicEngine } from './heicEngine';
import { pdfEngine, pdfRenderEngine } from './pdfEngine';
import { ffmpegAudioEngine, ffmpegVideoEngine } from './ffmpegEngine';
import { ToolDefinition } from '../registry/types';

const ENGINES: Record<string, BrowserEngine> = {
  'sheetjs-data': dataEngine,
  'text-engine': textEngine,
  'image-engine': imageEngine,
  'heic-engine': heicEngine,
  'pdf-engine': pdfEngine,
  'pdf-render': pdfRenderEngine,
  'ffmpeg-audio': ffmpegAudioEngine,
  'ffmpeg-video': ffmpegVideoEngine,
};

export function getEngine(id: string): BrowserEngine | undefined {
  return ENGINES[id];
}

export function deduplicateFilenames(results: ConvertResult[]): ConvertResult[] {
  const seen = new Map<string, number>();

  return results.map((res) => {
    const dotIdx = res.filename.lastIndexOf('.');
    const base = dotIdx !== -1 ? res.filename.substring(0, dotIdx) : res.filename;
    const ext = dotIdx !== -1 ? res.filename.substring(dotIdx) : '';

    const count = seen.get(res.filename) || 0;
    seen.set(res.filename, count + 1);

    if (count === 0) {
      return res;
    }

    return {
      ...res,
      filename: `${base} (${count})${ext}`,
    };
  });
}

export async function runConversion(
  tool: ToolDefinition,
  files: File[],
  options: Record<string, string | number | boolean>,
  targetFormat: string,
  ctx: ConvertContext
): Promise<ConvertResult[]> {
  // 1. Verify file size limit
  const maxBytes = tool.limits.maxFileSizeMB * 1024 * 1024;
  for (const file of files) {
    if (file.size > maxBytes) {
      throw new EngineError(
        'FILE_TOO_LARGE',
        `File "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the limit of ${tool.limits.maxFileSizeMB} MB.`
      );
    }
  }

  // 2. Fetch browser engine
  const engine = getEngine(tool.engine.id);
  if (!engine) {
    throw new EngineError(
      'TOOL_DISABLED',
      `Browser engine "${tool.engine.id}" is not available.`
    );
  }

  // 3. Execute conversion
  const results = await engine.run(files, options, targetFormat, ctx);

  // 4. Handle filename collision logic per Section 6.3
  return deduplicateFilenames(results);
}

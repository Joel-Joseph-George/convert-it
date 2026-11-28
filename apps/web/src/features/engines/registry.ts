import { BrowserEngine, ConvertContext, ConvertResult, EngineError } from './types';
import { ToolDefinition } from '../registry/types';

// Dynamic engine loaders for code-splitting (Phase 6 performance pass)
const ENGINE_LOADERS: Record<string, () => Promise<BrowserEngine>> = {
  'sheetjs-data': async () => (await import('./dataEngine')).dataEngine,
  'text-engine': async () => (await import('./textEngine')).textEngine,
  'image-engine': async () => (await import('./imageEngine')).imageEngine,
  'heic-engine': async () => (await import('./heicEngine')).heicEngine,
  'pdf-engine': async () => (await import('./pdfEngine')).pdfEngine,
  'pdf-render': async () => (await import('./pdfEngine')).pdfRenderEngine,
  'pdf-compress': async () => (await import('./pdfToolsEngine')).pdfCompressEngine,
  'pdf-security': async () => (await import('./pdfToolsEngine')).pdfSecurityEngine,
  'pdf-ocr': async () => (await import('./pdfToolsEngine')).pdfOcrEngine,
  'image-metadata': async () => (await import('./imageToolsEngine')).imageMetadataEngine,
  'bg-removal': async () => (await import('./imageToolsEngine')).bgRemovalEngine,
  'ffmpeg-audio': async () => (await import('./ffmpegEngine')).ffmpegAudioEngine,
  'ffmpeg-video': async () => (await import('./ffmpegEngine')).ffmpegVideoEngine,
};

export async function getEngine(id: string): Promise<BrowserEngine | undefined> {
  const loader = ENGINE_LOADERS[id];
  if (!loader) return undefined;
  return loader();
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

  // 2. Fetch browser engine asynchronously
  const engine = await getEngine(tool.engine.id);
  if (!engine) {
    throw new EngineError(
      'TOOL_DISABLED',
      `Browser engine "${tool.engine.id}" is not available.`
    );
  }

  // 3. Execute conversion
  const results = await engine.run(files, options, targetFormat, { ...ctx, toolId: tool.id });

  // 4. Handle filename collision logic per Section 6.3
  return deduplicateFilenames(results);
}

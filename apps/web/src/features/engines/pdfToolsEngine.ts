import {
  BrowserEngine,
  ConvertContext,
  ConvertResult,
  EngineError,
} from "./types";
import type { CompressionLevel } from "./pdfCompress";

/** Engines for Compress PDF, Protect/Unlock PDF and OCR PDF (all in the browser). */

type Options = Record<string, string | number | boolean>;

function baseNameOf(file: File): string {
  return file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
}

function pdfResult(bytes: Uint8Array, filename: string): ConvertResult {
  const blob = new Blob([bytes.slice().buffer], { type: "application/pdf" });
  return { filename, blob, mime: "application/pdf", sizeBytes: blob.size };
}

/** Run `one` for each file, reporting overall progress and honouring cancel. */
async function eachFile(
  files: File[],
  ctx: ConvertContext,
  one: (file: File, progress: (pct: number) => void) => Promise<ConvertResult>,
): Promise<ConvertResult[]> {
  const results: ConvertResult[] = [];
  for (const [i, file] of files.entries()) {
    if (ctx.signal?.aborted)
      throw new EngineError("CONVERSION_CANCELLED", "Cancelled.");
    const progress = (pct: number) =>
      ctx.onProgress(Math.round(((i + pct / 100) / files.length) * 100));
    results.push(await one(file, progress));
    progress(100);
  }
  return results;
}

export const pdfCompressEngine: BrowserEngine = {
  id: "pdf-compress",
  run(files, options: Options, _format, ctx) {
    const level = (
      ["low", "balanced", "high"].includes(String(options.level))
        ? options.level
        : "balanced"
    ) as CompressionLevel;
    return eachFile(files, ctx, async (file, progress) => {
      const { compressPdf } = await import("./pdfCompress");
      const { bytes } = await compressPdf(
        await file.arrayBuffer(),
        level,
        progress,
        ctx.signal,
      );
      // Never hand back a bigger file than the user gave us.
      if (bytes.byteLength >= file.size) {
        return {
          filename: `${baseNameOf(file)}_compressed.pdf`,
          blob: file,
          mime: "application/pdf",
          sizeBytes: file.size,
        };
      }
      return pdfResult(bytes, `${baseNameOf(file)}_compressed.pdf`);
    });
  },
};

export const pdfSecurityEngine: BrowserEngine = {
  id: "pdf-security",
  run(files, options: Options, _format, ctx) {
    const password = String(options.password ?? "");
    return eachFile(files, ctx, async (file) => {
      const { protectPdf, unlockPdf } = await import("./pdfSecurity");
      const input = new Uint8Array(await file.arrayBuffer());
      if (ctx.toolId === "unlock-pdf") {
        return pdfResult(
          await unlockPdf(input, password),
          `${baseNameOf(file)}_unlocked.pdf`,
        );
      }
      if (ctx.toolId === "protect-pdf") {
        if (password.length < 4) {
          throw new EngineError(
            "INVALID_OPTIONS",
            "Use a password of at least 4 characters.",
          );
        }
        const allow = options.allowPrintCopy !== false;
        return pdfResult(
          await protectPdf(input, password, allow),
          `${baseNameOf(file)}_protected.pdf`,
        );
      }
      throw new EngineError("TOOL_DISABLED", "Unknown PDF security tool.");
    });
  },
};

export const pdfOcrEngine: BrowserEngine = {
  id: "pdf-ocr",
  run(files, _options, format, ctx) {
    return eachFile(files, ctx, async (file, progress) => {
      const { ocrPdf } = await import("./pdfOcr");
      const wantPdf = format !== "txt";
      const { pdf, text } = await ocrPdf(
        await file.arrayBuffer(),
        wantPdf,
        progress,
        ctx.signal,
      );
      if (wantPdf && pdf) return pdfResult(pdf, `${baseNameOf(file)}_ocr.pdf`);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      return {
        filename: `${baseNameOf(file)}.txt`,
        blob,
        mime: "text/plain",
        sizeBytes: blob.size,
      };
    });
  },
};

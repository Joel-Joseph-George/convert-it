import { BrowserEngine, ConvertResult, EngineError } from "./types";
import type { BgReply, BgRequest } from "../../workers/bgRemoval.worker";

/** Engines for Remove photo metadata and Remove background. */

function baseNameOf(file: File): string {
  return file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
}

const MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const EXT: Record<string, string> = { jpeg: "jpg", png: "png", webp: "webp" };

export const imageMetadataEngine: BrowserEngine = {
  id: "image-metadata",
  async run(files, _options, _format, ctx) {
    const { detectKind, stripMetadata } = await import("./imageMetadata");
    const results: ConvertResult[] = [];
    for (const [i, file] of files.entries()) {
      if (ctx.signal?.aborted)
        throw new EngineError("CONVERSION_CANCELLED", "Cancelled.");
      const input = new Uint8Array(await file.arrayBuffer());
      const kind = detectKind(input);
      if (!kind) {
        throw new EngineError(
          "UNSUPPORTED_FILE_TYPE",
          `${file.name} isn't a JPEG, PNG or WebP image.`,
        );
      }
      const output = stripMetadata(input);
      const blob = new Blob([output.slice().buffer], { type: MIME[kind] });
      results.push({
        filename: `${baseNameOf(file)}_clean.${EXT[kind]}`,
        blob,
        mime: blob.type,
        sizeBytes: blob.size,
      });
      ctx.onProgress(Math.round(((i + 1) / files.length) * 100));
    }
    return results;
  },
};

let worker: Worker | undefined;
let nextId = 1;

function removeBackgroundInWorker(
  image: Blob,
  signal?: AbortSignal,
): Promise<{ width: number; height: number; rgba: Uint8ClampedArray }> {
  worker ??= new Worker(
    new URL("../../workers/bgRemoval.worker.ts", import.meta.url),
    {
      type: "module",
    },
  );
  const w = worker;
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      w.removeEventListener("message", onMessage);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      // Stop the model mid-run; the next call starts a fresh worker.
      w.terminate();
      if (worker === w) worker = undefined;
      reject(new EngineError("CONVERSION_CANCELLED", "Cancelled."));
    };
    const onMessage = ({ data }: MessageEvent<BgReply>) => {
      if (data.id !== id || "progress" in data) return;
      cleanup();
      if ("error" in data) {
        reject(
          new EngineError(
            "CONVERSION_FAILED",
            `Background removal failed: ${data.error}`,
          ),
        );
      } else {
        resolve(data);
      }
    };
    w.addEventListener("message", onMessage);
    signal?.addEventListener("abort", onAbort, { once: true });
    w.postMessage({ id, image } satisfies BgRequest);
  });
}

/**
 * Below this, the model found no subject (e.g. a photo without a person): the
 * largest solid region it kept covers less than this share of the image.
 */
const MIN_SUBJECT_SHARE = 0.03;

/**
 * Share of the image covered by the largest connected region the mask keeps,
 * measured on a grid of at most 96×96 cells. A person is one big region;
 * a failed cut-out is empty or scattered specks.
 */
export function largestSubjectShare(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const step = Math.max(1, Math.ceil(Math.max(width, height) / 96));
  const cols = Math.ceil(width / step);
  const rows = Math.ceil(height / step);
  const solid = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let count = 0;
      for (let y = r * step; y < Math.min(height, (r + 1) * step); y++) {
        for (let x = c * step; x < Math.min(width, (c + 1) * step); x++) {
          sum += rgba[(y * width + x) * 4 + 3] ?? 0;
          count++;
        }
      }
      solid[r * cols + c] = count && sum / count >= 128 ? 1 : 0;
    }
  }
  let largest = 0;
  const stack: number[] = [];
  for (let start = 0; start < solid.length; start++) {
    if (solid[start] !== 1) continue;
    solid[start] = 2;
    stack.push(start);
    let size = 0;
    while (stack.length) {
      const cell = stack.pop() ?? 0;
      size++;
      const r = Math.floor(cell / cols);
      const c = cell % cols;
      for (const [nr, nc] of [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ] as const) {
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        const next = nr * cols + nc;
        if (solid[next] === 1) {
          solid[next] = 2;
          stack.push(next);
        }
      }
    }
    largest = Math.max(largest, size);
  }
  return largest / Math.max(1, cols * rows);
}

const BACKGROUNDS: Record<string, string | null> = {
  transparent: null,
  white: "#ffffff",
  black: "#000000",
};

export const bgRemovalEngine: BrowserEngine = {
  id: "bg-removal",
  async run(files, options, format, ctx) {
    const results: ConvertResult[] = [];
    const target = format === "jpg" || format === "webp" ? format : "png";
    const mime = target === "jpg" ? "image/jpeg" : `image/${target}`;
    // JPG can't be transparent, so it gets a white background.
    const background =
      BACKGROUNDS[String(options.background)] ??
      (target === "jpg" ? "#ffffff" : null);
    for (const [i, file] of files.entries()) {
      if (ctx.signal?.aborted)
        throw new EngineError("CONVERSION_CANCELLED", "Cancelled.");
      ctx.onProgress(Math.round(((i + 0.1) / files.length) * 100));
      const { width, height, rgba } = await removeBackgroundInWorker(
        file,
        ctx.signal,
      );
      if (largestSubjectShare(rgba, width, height) < MIN_SUBJECT_SHARE) {
        throw new EngineError(
          "NO_SUBJECT",
          `No person was found in ${file.name}. Remove background works on photos of people.`,
        );
      }
      const canvas = new OffscreenCanvas(width, height);
      const c2d = canvas.getContext("2d");
      if (!c2d)
        throw new EngineError(
          "CONVERSION_FAILED",
          "Canvas is unavailable in this browser.",
        );
      const cutout = await createImageBitmap(
        new ImageData(new Uint8ClampedArray(rgba), width, height),
      );
      if (background) {
        c2d.fillStyle = background;
        c2d.fillRect(0, 0, width, height);
      }
      c2d.drawImage(cutout, 0, 0);
      cutout.close();
      const blob = await canvas.convertToBlob({ type: mime, quality: 0.92 });
      results.push({
        filename: `${baseNameOf(file)}_no-bg.${target}`,
        blob,
        mime,
        sizeBytes: blob.size,
      });
      ctx.onProgress(Math.round(((i + 1) / files.length) * 100));
    }
    return results;
  },
};

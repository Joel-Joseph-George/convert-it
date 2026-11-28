// Versioned URL paths for the large same-origin assets in public/vendor.
// Each path includes the package version (or model revision), so the files can be
// served with `Cache-Control: immutable` and an upgrade still changes the URL.
// Used by copy-vendor.mjs / chat-assets.mjs (where to write) and vite.config.ts
// (exposed to the app as __VENDOR__).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const MODEL_REVISION = "751bff37182d3f1213fa05d7196b954e230abad9";

// Background removal (portrait matting), Apache-2.0.
export const BG_MODEL_ID = "Xenova/modnet";
export const BG_MODEL_REVISION = "fa2fa546052fba4c08921230a26cc69a333fca12";

/**
 * Directory of an installed package (workspace or repo-root node_modules).
 * With `parent`, a copy nested under that package wins (e.g. tesseract.js-core
 * pinned by tesseract.js).
 */
export function packageDir(name, parent) {
  const candidates = [
    ...(parent ? [path.join(packageDir(parent), "node_modules", name)] : []),
    path.join(webDir, "node_modules", name),
    path.join(webDir, "..", "..", "node_modules", name),
  ];
  const dir = candidates.find((p) =>
    fs.existsSync(path.join(p, "package.json")),
  );
  if (!dir) throw new Error(`Package ${name} is not installed`);
  return dir;
}

function version(name, parent) {
  return JSON.parse(
    fs.readFileSync(
      path.join(packageDir(name, parent), "package.json"),
      "utf8",
    ),
  ).version;
}

/** URL paths (no trailing slash) the app loads vendor files from. */
export function vendorPaths() {
  return {
    ffmpeg: `/vendor/ffmpeg/${version("@ffmpeg/core")}`,
    pdfjs: `/vendor/pdfjs/${version("pdfjs-dist")}`,
    onnx: `/vendor/onnx/${version("onnxruntime-web")}`,
    models: `/vendor/models/${MODEL_REVISION.slice(0, 12)}`,
    bgModels: `/vendor/bg-models/${BG_MODEL_REVISION.slice(0, 12)}`,
    tesseract: `/vendor/tesseract/${version("tesseract.js")}-${version("tesseract.js-core", "tesseract.js")}`,
    qpdf: `/vendor/qpdf/${version("@neslinesli93/qpdf-wasm")}`,
  };
}

/** public/ directory on disk for a vendor URL path. */
export function publicDir(urlPath) {
  return path.join(webDir, "public", urlPath);
}

/** Remove other versions next to `keepDir` so old copies don't pile up in builds. */
export function pruneSiblings(keepDir) {
  const parent = path.dirname(keepDir);
  if (!fs.existsSync(parent)) return;
  for (const entry of fs.readdirSync(parent)) {
    const full = path.join(parent, entry);
    if (full !== keepDir) fs.rmSync(full, { recursive: true, force: true });
  }
}

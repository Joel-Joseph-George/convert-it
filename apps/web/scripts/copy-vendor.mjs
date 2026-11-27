// Copy ffmpeg.wasm and the pdf.js worker into public/vendor under versioned paths.
import fs from "node:fs";
import path from "node:path";
import {
  packageDir,
  publicDir,
  pruneSiblings,
  vendorPaths,
} from "./vendor-paths.mjs";

const paths = vendorPaths();

const ffmpegOut = publicDir(paths.ffmpeg);
pruneSiblings(ffmpegOut);
fs.mkdirSync(ffmpegOut, { recursive: true });
const ffmpegSource = path.join(packageDir("@ffmpeg/core"), "dist/esm");
for (const file of fs.readdirSync(ffmpegSource)) {
  if (file.startsWith("ffmpeg-core.")) {
    fs.copyFileSync(path.join(ffmpegSource, file), path.join(ffmpegOut, file));
  }
}

const pdfjsOut = publicDir(paths.pdfjs);
pruneSiblings(pdfjsOut);
fs.mkdirSync(pdfjsOut, { recursive: true });
fs.copyFileSync(
  path.join(packageDir("pdfjs-dist"), "build/pdf.worker.min.mjs"),
  path.join(pdfjsOut, "pdf.worker.min.mjs"),
);

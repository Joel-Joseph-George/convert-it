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

// OCR: tesseract.js worker, its LSTM-only cores (the .wasm.js builds embed the wasm;
// the worker picks relaxed-SIMD, SIMD or plain), and English trained data (best_int).
const tesseractOut = publicDir(paths.tesseract);
pruneSiblings(tesseractOut);
fs.mkdirSync(path.join(tesseractOut, "core"), { recursive: true });
fs.mkdirSync(path.join(tesseractOut, "lang"), { recursive: true });
fs.copyFileSync(
  path.join(packageDir("tesseract.js"), "dist/worker.min.js"),
  path.join(tesseractOut, "worker.min.js"),
);
const coreDir = packageDir("tesseract.js-core", "tesseract.js");
for (const file of fs.readdirSync(coreDir)) {
  if (/^tesseract-core(-simd|-relaxedsimd)?-lstm\.wasm\.js$/.test(file)) {
    fs.copyFileSync(
      path.join(coreDir, file),
      path.join(tesseractOut, "core", file),
    );
  }
}
fs.copyFileSync(
  path.join(
    packageDir("@tesseract.js-data/eng"),
    "4.0.0_best_int/eng.traineddata.gz",
  ),
  path.join(tesseractOut, "lang", "eng.traineddata.gz"),
);

// Password protect / unlock: qpdf compiled to wasm.
const qpdfOut = publicDir(paths.qpdf);
pruneSiblings(qpdfOut);
fs.mkdirSync(qpdfOut, { recursive: true });
fs.copyFileSync(
  path.join(packageDir("@neslinesli93/qpdf-wasm"), "dist/qpdf.wasm"),
  path.join(qpdfOut, "qpdf.wasm"),
);

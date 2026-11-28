// Prepare same-origin assets before dev/build. No model host is contacted by the browser.
import { mkdir, access, writeFile, rename, copyFile } from "node:fs/promises";
import path from "node:path";
import {
  BG_MODEL_ID,
  BG_MODEL_REVISION,
  MODEL_ID,
  MODEL_REVISION,
  packageDir,
  publicDir,
  pruneSiblings,
  vendorPaths,
} from "./vendor-paths.mjs";

const paths = vendorPaths();

// Both builds are needed: the runtime picks the asyncify one (WebGPU) on most browsers
// and the plain one on Safari < 26 without WebGPU. Only the chosen one is downloaded.
const onnxOut = publicDir(paths.onnx);
pruneSiblings(onnxOut);
await mkdir(onnxOut, { recursive: true });
const runtime = path.join(packageDir("onnxruntime-web"), "dist");
for (const variant of ["", ".asyncify"]) {
  for (const ext of ["mjs", "wasm"]) {
    const name = "ort-wasm-simd-threaded" + variant + "." + ext;
    await copyFile(path.join(runtime, name), path.join(onnxOut, name));
  }
}

/** Download model files from Hugging Face once; later runs reuse them. */
async function fetchModel(outDir, id, revision, files) {
  const folder = path.join(outDir, id);
  for (const name of files) {
    const target = path.join(folder, name);
    if (
      await access(target).then(
        () => true,
        () => false,
      )
    )
      continue;
    await mkdir(path.dirname(target), { recursive: true });
    const url = `https://huggingface.co/${id}/resolve/${revision}/${name}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
    if (!res.ok)
      throw new Error(`Model asset ${name} returned HTTP ${res.status}`);
    const temp = target + "." + process.pid + ".tmp";
    await writeFile(temp, new Uint8Array(await res.arrayBuffer()));
    await rename(temp, target);
  }
}

const modelsOut = publicDir(paths.models);
pruneSiblings(modelsOut);
await fetchModel(modelsOut, MODEL_ID, MODEL_REVISION, [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/model_quantized.onnx",
]);

// Background removal model (Remove background tool).
const bgOut = publicDir(paths.bgModels);
pruneSiblings(bgOut);
await fetchModel(bgOut, BG_MODEL_ID, BG_MODEL_REVISION, [
  "config.json",
  "preprocessor_config.json",
  // The worker loads the full-precision model (dtype fp32).
  "onnx/model.onnx",
]);

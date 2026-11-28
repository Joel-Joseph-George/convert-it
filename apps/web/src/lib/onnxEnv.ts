import type { env as TransformersEnv } from "@huggingface/transformers";

/**
 * Point transformers.js at the same-origin ONNX runtime and model files in
 * public/vendor, so no model host or CDN is contacted from the browser.
 * Shared by the PDF chat embedder and the background remover.
 */
export function configureLocalOnnx(
  env: typeof TransformersEnv,
  modelRoot: string,
  cacheKey: string,
  allowRemoteModels = false,
): void {
  env.cacheKey = cacheKey;
  env.allowRemoteModels = allowRemoteModels;
  env.allowLocalModels = true;
  env.localModelPath = modelRoot + "/";
  const wasm = env.backends.onnx.wasm;
  if (wasm) {
    // Keep the runtime's platform choice while serving both files from this site.
    const baseline =
      typeof wasm.wasmPaths === "object" &&
      String(wasm.wasmPaths.mjs).endsWith("threaded.mjs");
    const name = baseline
      ? "ort-wasm-simd-threaded"
      : "ort-wasm-simd-threaded.asyncify";
    const base = new URL(`${__VENDOR__.onnx}/${name}`, self.location.origin)
      .href;
    wasm.wasmPaths = { mjs: base + ".mjs", wasm: base + ".wasm" };
    wasm.numThreads = 1;
  }
}

/** WebGPU if the browser has a usable adapter, else WASM. */
export async function pickDevice(): Promise<"webgpu" | "wasm"> {
  if (!("gpu" in navigator)) return "wasm";
  const gpu = (
    navigator as Navigator & { gpu: { requestAdapter(): Promise<unknown> } }
  ).gpu;
  return (await gpu.requestAdapter().catch(() => null)) ? "webgpu" : "wasm";
}

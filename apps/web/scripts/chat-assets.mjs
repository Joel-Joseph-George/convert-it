// Prepare same-origin assets before dev/build. No model host is contacted by the browser.
import { mkdir, access, writeFile, rename, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const vendor = fileURLToPath(new URL('../public/vendor/', import.meta.url));
const require = createRequire(import.meta.url);
const runtime = path.dirname(require.resolve('onnxruntime-web'));
await mkdir(path.join(vendor, 'onnx'), { recursive: true });
for (const variant of ['', '.asyncify']) {
  for (const ext of ['mjs', 'wasm']) {
    const name = 'ort-wasm-simd-threaded' + variant + '.' + ext;
    await copyFile(path.join(runtime, name), path.join(vendor, 'onnx', name));
  }
}

const model = 'Xenova/all-MiniLM-L6-v2';
const revision = '751bff37182d3f1213fa05d7196b954e230abad9';
const folder = path.join(vendor, 'models', model);
await mkdir(path.join(folder, 'onnx'), { recursive: true });
for (const name of [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/model_quantized.onnx',
]) {
  const target = path.join(folder, name);
  if (
    await access(target).then(
      () => true,
      () => false,
    )
  )
    continue;
  const url = `https://huggingface.co/${model}/resolve/${revision}/${name}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`Model asset ${name} returned HTTP ${res.status}`);
  const temp = target + '.' + process.pid + '.tmp';
  await writeFile(temp, new Uint8Array(await res.arrayBuffer()));
  await rename(temp, target);
}

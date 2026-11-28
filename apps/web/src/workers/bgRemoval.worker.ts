/// <reference lib="webworker" />
import type { BackgroundRemovalPipeline } from "@huggingface/transformers";
import { pickDevice, configureLocalOnnx } from "@/lib/onnxEnv";

/** Background removal (MODNet portrait matting) off the main thread. */

export type BgRequest = { id: number; image: Blob };
export type BgReply =
  | { id: number; progress: string }
  | { id: number; width: number; height: number; rgba: Uint8ClampedArray }
  | { id: number; error: string };

const MODEL = "Xenova/modnet";
let segmenter: Promise<BackgroundRemovalPipeline> | undefined;

function load(id: number): Promise<BackgroundRemovalPipeline> {
  segmenter ??= (async () => {
    postMessage({
      id,
      progress: "Loading the background removal model…",
    } satisfies BgReply);
    const { env, pipeline } = await import("@huggingface/transformers");
    configureLocalOnnx(env, __VENDOR__.bgModels, "convertit-bg-model");
    const create = (device: "webgpu" | "wasm") =>
      pipeline("background-removal", MODEL, {
        device,
        dtype: "fp32",
      }) as Promise<BackgroundRemovalPipeline>;
    const device = await pickDevice();
    try {
      return await create(device);
    } catch (error) {
      if (device === "wasm") throw error;
      return create("wasm");
    }
  })();
  segmenter.catch(() => {
    segmenter = undefined;
  });
  return segmenter;
}

self.onmessage = async ({ data }: MessageEvent<BgRequest>) => {
  const { id, image } = data;
  try {
    const run = await load(id);
    postMessage({ id, progress: "Finding the subject…" } satisfies BgReply);
    const { RawImage } = await import("@huggingface/transformers");
    const input = await RawImage.fromBlob(image);
    const result = (await run(input)) as InstanceType<typeof RawImage>;
    const rgba = result.channels === 4 ? result : result.rgba();
    const pixels = new Uint8ClampedArray(rgba.data);
    postMessage(
      {
        id,
        width: rgba.width,
        height: rgba.height,
        rgba: pixels,
      } satisfies BgReply,
      {
        transfer: [pixels.buffer],
      },
    );
  } catch (error) {
    postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    } satisfies BgReply);
  }
};

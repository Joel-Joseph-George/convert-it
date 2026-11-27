/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Versioned URL paths of the files in public/vendor (see scripts/vendor-paths.mjs). */
declare const __VENDOR__: {
  ffmpeg: string;
  pdfjs: string;
  onnx: string;
  models: string;
};

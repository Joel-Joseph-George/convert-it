export declare const MODEL_ID: string;
export declare const MODEL_REVISION: string;
export declare const BG_MODEL_ID: string;
export declare const BG_MODEL_REVISION: string;
export declare function packageDir(name: string, parent?: string): string;
export declare function vendorPaths(): {
  ffmpeg: string;
  pdfjs: string;
  onnx: string;
  models: string;
  bgModels: string;
  tesseract: string;
  qpdf: string;
};
export declare function publicDir(urlPath: string): string;
export declare function pruneSiblings(keepDir: string): void;

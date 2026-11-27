export declare const MODEL_ID: string;
export declare const MODEL_REVISION: string;
export declare function packageDir(name: string): string;
export declare function vendorPaths(): {
  ffmpeg: string;
  pdfjs: string;
  onnx: string;
  models: string;
};
export declare function publicDir(urlPath: string): string;
export declare function pruneSiblings(keepDir: string): void;

export interface ConvertContext {
  onProgress: (progress: number) => void;
  signal?: AbortSignal;
  /** Registry id of the tool being run, for engines shared by several tools. */
  toolId?: string;
}

export interface ConvertResult {
  filename: string;
  blob: Blob;
  mime: string;
  sizeBytes: number;
}

export interface BrowserEngine {
  id: string;
  run: (
    files: File[],
    options: Record<string, string | number | boolean>,
    targetFormat: string,
    ctx: ConvertContext
  ) => Promise<ConvertResult[]>;
}

export class EngineError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

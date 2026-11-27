import { PDFDocument } from "pdf-lib";
import { EngineError } from "./types";

/** Add or remove PDF passwords with qpdf compiled to WebAssembly (AES-256). */

interface QpdfInstance {
  callMain: (args: string[]) => number;
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
  };
}

async function runQpdf(
  input: Uint8Array,
  args: string[],
): Promise<{ code: number; output?: Uint8Array }> {
  const { default: createModule } = await import("@neslinesli93/qpdf-wasm");
  // A fresh instance per run: Emscripten programs aren't meant to run main() twice.
  const qpdf = (await createModule({
    locateFile: () => `${__VENDOR__.qpdf}/qpdf.wasm`,
    // qpdf's own messages go to the console; we rely on exit codes instead.
    print: () => undefined,
    printErr: () => undefined,
  } as never)) as unknown as QpdfInstance;
  qpdf.FS.writeFile("/in.pdf", input);
  let code: number;
  try {
    code = qpdf.callMain([...args, "/in.pdf", "/out.pdf"]);
  } catch {
    code = 2;
  }
  if (code !== 0 && code !== 3) return { code };
  return { code, output: qpdf.FS.readFile("/out.pdf") };
}

/** Whether the PDF has an encryption dictionary (password or permissions). */
export async function isEncrypted(input: Uint8Array): Promise<boolean> {
  try {
    const doc = await PDFDocument.load(input, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    return doc.isEncrypted;
  } catch {
    throw new EngineError("FILE_CORRUPT", "Could not read this PDF.");
  }
}

export async function protectPdf(
  input: Uint8Array,
  password: string,
  allowPrintAndCopy: boolean,
): Promise<Uint8Array> {
  if (!password)
    throw new EngineError(
      "INVALID_OPTIONS",
      "Enter a password to protect the PDF with.",
    );
  if (await isEncrypted(input)) {
    throw new EngineError(
      "INVALID_OPTIONS",
      "This PDF already has a password. Unlock it first.",
    );
  }
  // A random owner password, so the permission limits can't be lifted with the open password.
  const owner = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const limits = allowPrintAndCopy
    ? []
    : ["--print=none", "--extract=n", "--modify=none"];
  const { output } = await runQpdf(input, [
    "--encrypt",
    `--user-password=${password}`,
    `--owner-password=${owner}`,
    "--bits=256",
    ...limits,
    "--",
  ]);
  if (!output)
    throw new EngineError("CONVERSION_FAILED", "Could not encrypt this PDF.");
  return output;
}

export async function unlockPdf(
  input: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  if (!(await isEncrypted(input))) {
    throw new EngineError(
      "INVALID_OPTIONS",
      "This PDF isn't password protected.",
    );
  }
  const { output } = await runQpdf(
    input,
    password ? [`--password=${password}`, "--decrypt"] : ["--decrypt"],
  );
  if (!output) {
    throw new EngineError(
      "INVALID_OPTIONS",
      password
        ? "That password is wrong."
        : "This PDF needs its password to open. Enter it and try again.",
    );
  }
  return output;
}

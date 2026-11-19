import { zipSync, strToU8 } from 'fflate';

export interface ZipFileEntry {
  name: string;
  data: Uint8Array | string;
}

export async function createZipArchive(
  entries: ZipFileEntry[]
): Promise<Blob> {
  const zipData: Record<string, Uint8Array> = {};

  for (const entry of entries) {
    if (typeof entry.data === 'string') {
      zipData[entry.name] = strToU8(entry.data);
    } else {
      zipData[entry.name] = entry.data;
    }
  }

  const zipped = zipSync(zipData);
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

import { zipSync, strToU8 } from 'fflate';

export interface ZipFileEntry {
  name: string;
  data: Uint8Array | string;
}

/**
 * Give every entry a distinct name: `a.webp`, `a (1).webp`, `a (2).webp`.
 * Compared case-insensitively so extraction on macOS/Windows doesn't overwrite files.
 */
export function dedupeZipNames(names: string[]): string[] {
  const taken = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let candidate = name;
    for (let n = 1; taken.has(candidate.toLowerCase()); n++) {
      candidate = `${base} (${n})${ext}`;
    }
    taken.add(candidate.toLowerCase());
    return candidate;
  });
}

export async function createZipArchive(
  entries: ZipFileEntry[]
): Promise<Blob> {
  const zipData: Record<string, Uint8Array> = {};
  const names = dedupeZipNames(entries.map((e) => e.name));

  entries.forEach((entry, i) => {
    const name = names[i] as string;
    zipData[name] = typeof entry.data === 'string' ? strToU8(entry.data) : entry.data;
  });

  const zipped = zipSync(zipData);
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

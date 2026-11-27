import { TOOLS } from "@/features/registry/tools";
import type { ToolDefinition } from "@/features/registry/types";
import { isYouTubeUrl } from "@/features/youtube/url";

/** Cache the service worker writes shared content to (see public/sw.js). */
export const SHARE_CACHE = "convertit-share";
const META_KEY = "/share-inbox/meta";

export interface SharedContent {
  text: string;
  files: File[];
}

interface ShareMeta {
  text: string;
  files: { key: string; name: string; type: string }[];
}

/** Read and clear what the service worker stored from a "Share → ConvertIt". */
export async function takeSharedContent(): Promise<SharedContent> {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = ["title", "text", "url"]
    .map((k) => params.get(k) ?? "")
    .join(" ");
  if (typeof caches === "undefined")
    return { text: fromQuery.trim(), files: [] };

  const cache = await caches.open(SHARE_CACHE);
  const metaResponse = await cache.match(META_KEY);
  if (!metaResponse) return { text: fromQuery.trim(), files: [] };

  const meta = (await metaResponse.json()) as ShareMeta;
  const files: File[] = [];
  for (const entry of meta.files) {
    const res = await cache.match(entry.key);
    if (res)
      files.push(
        new File([await res.blob()], entry.name, { type: entry.type }),
      );
  }
  await caches.delete(SHARE_CACHE);
  return { text: `${meta.text} ${fromQuery}`.trim(), files };
}

/** First http(s) link in shared text (apps often put the URL in "text", not "url"). */
export function extractUrl(text: string): string | null {
  return text.match(/https?:\/\/\S+/)?.[0] ?? null;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** The first tool (registry order) that accepts the first shared file. */
export function pickToolForFiles(files: File[]): ToolDefinition | null {
  const first = files[0];
  if (!first) return null;
  const ext = extensionOf(first.name);
  return TOOLS.find((tool) => tool.inputs.extensions.includes(ext)) ?? null;
}

/** Files the chosen tool can take. */
export function filesForTool(tool: ToolDefinition, files: File[]): File[] {
  const accepted = files.filter((f) =>
    tool.inputs.extensions.includes(extensionOf(f.name)),
  );
  return tool.inputs.multiple ? accepted : accepted.slice(0, 1);
}

export function isSharedYouTubeLink(text: string): string | null {
  const url = extractUrl(text);
  return url && isYouTubeUrl(url) ? url : null;
}

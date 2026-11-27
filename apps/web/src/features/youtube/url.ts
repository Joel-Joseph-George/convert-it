const YOUTUBE_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
];

/** True for a YouTube link that points at a video (not just the bare domain). */
export function isYouTubeUrl(input: string): boolean {
  try {
    const parsed = new URL(
      input.startsWith("http") ? input : `https://${input}`,
    );
    const host = parsed.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.includes(host)) return false;
    return host === "youtu.be"
      ? parsed.pathname.length > 1
      : parsed.searchParams.has("v") ||
          /^\/(shorts|live)\/./.test(parsed.pathname);
  } catch {
    return false;
  }
}

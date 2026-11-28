# ConvertIt API Service

FastAPI backend for ConvertIt. Handles media extraction, server-side document conversions, job queues, and progress reporting.

## YouTube on hosted servers

YouTube often blocks requests from datacenter IPs (Render, Fly, etc.) with a
"Sign in to confirm you're not a bot" check. When that happens the API returns
`UPSTREAM_BLOCKED`, and the logs show an `ytdlp_error` line with the redacted reason.

To get it working from a hosted server:

1. **JavaScript runtime** — the Docker image ships Deno, which yt-dlp needs to solve
   YouTube's player challenges. Without it, many formats are missing.
2. **Cookies** — export a `cookies.txt` (Netscape format) for youtube.com from a
   browser profile you don't mind using, upload it as a Render *Secret File*
   (e.g. `/etc/secrets/yt-cookies.txt`), and set `YT_COOKIES_FILE` to that path.
   Cookies expire, so you'll need to refresh them every so often.
   Each operation uses an in-memory copy so the mount can stay read-only.
   `GET /api/health` reports `ytCookiesFileAvailable` when the configured file
   is readable and nonempty. Session validity requires an upstream check.
3. **Proxy (optional)** — if cookies aren't enough, set `YT_PROXY` to a residential proxy.
4. **Keep yt-dlp fresh** — YouTube changes often; redeploy (rebuild the image) to pick up
   a newer `yt-dlp` when downloads start failing.

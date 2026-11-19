#!/usr/bin/env python3
"""YouTube Extraction Smoke Test Script.

Validates that yt-dlp is correctly installed, not blocked by YouTube anti-bot checks,
and capable of extracting metadata from a candidate host.
"""

import os
import sys

try:
    import yt_dlp
except ImportError:
    print("ERROR: yt-dlp is not installed. Install with: pip install yt-dlp", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    ytdlp_ver = yt_dlp.version.__version__
    print(f"=== ConvertIt YouTube Smoke Test ===")
    print(f"yt-dlp version: {ytdlp_ver}")
    print(f"Python version: {sys.version.split()[0]}")

    test_url = os.environ.get("SMOKE_TEST_URL", "https://www.youtube.com/watch?v=jNQXAC9IVRw")
    print(f"Target URL:     {test_url}")

    cookies_file = os.environ.get("YT_COOKIES_FILE")
    proxy = os.environ.get("YT_PROXY")

    ydl_opts: dict[str, object] = {
        "quiet": True,
        "noplaylist": True,
        "extract_flat": False,
        "no_warnings": True,
    }

    if cookies_file and os.path.exists(cookies_file):
        print(f"Using cookies:  {cookies_file}")
        ydl_opts["cookiefile"] = cookies_file

    if proxy:
        print(f"Using proxy:    {proxy}")
        ydl_opts["proxy"] = proxy

    print("Extracting metadata...")
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(test_url, download=False)
            if not info:
                print("FAILED: Extraction returned empty metadata.", file=sys.stderr)
                sys.exit(1)

            title = info.get("title", "Unknown Title")
            duration = info.get("duration", 0)
            formats = info.get("formats", [])

            print("\n[SUCCESS] Extraction successful!")
            print(f"  Title:    {title}")
            print(f"  Duration: {duration}s")
            print(f"  Formats:  {len(formats)} streams detected")
            sys.exit(0)

    except yt_dlp.utils.DownloadError as e:
        print(f"\n[FAILURE] DownloadError from yt-dlp:\n  {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n[FAILURE] Unexpected error:\n  {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

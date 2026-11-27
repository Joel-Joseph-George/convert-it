"""Render the PWA icons (public/icons/*.png) from the favicon glyph. Pure stdlib.

Run: python3 apps/web/scripts/make-icons.py
"""

import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
BG = (0x4F, 0x46, 0xE5)  # brand indigo
FG = (0xFF, 0xFF, 0xFF)
# favicon.svg path "m8 3 4 8 5-5 5 15H2L8 3z" in its 24-unit box
GLYPH = [(8, 3), (12, 11), (17, 6), (22, 21), (2, 21)]


def seg_dist(px: float, py: float, a: tuple[float, float], b: tuple[float, float]) -> float:
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def render(size: int, glyph_frac: float, radius_frac: float) -> bytes:
    scale = size * glyph_frac / 20  # glyph is 20 units wide
    cx = cy = size / 2
    pts = [(cx + (x - 12) * scale, cy + (y - 12) * scale) for x, y in GLYPH]
    segs = list(zip(pts, pts[1:] + pts[:1], strict=True))
    half = 2.4 * scale / 2
    radius = size * radius_frac
    rows = []
    for j in range(size):
        row = bytearray([0])
        py = j + 0.5
        for i in range(size):
            px = i + 0.5
            # rounded-rect background coverage (signed distance)
            qx = max(abs(px - cx) - (cx - radius), 0)
            qy = max(abs(py - cy) - (cy - radius), 0)
            bg_a = max(0.0, min(1.0, radius - math.hypot(qx, qy) + 0.5)) if radius else 1.0
            d = min(seg_dist(px, py, a, b) for a, b in segs)
            fg_a = max(0.0, min(1.0, half - d + 0.5))
            color = [round(BG[k] * (1 - fg_a) + FG[k] * fg_a) for k in range(3)]
            row += bytes(color + [round(255 * bg_a)])
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", raw) + chunk(b"IEND", b"")


OUT.mkdir(parents=True, exist_ok=True)
(OUT / "icon-192.png").write_bytes(render(192, 0.6, 0.22))
(OUT / "icon-512.png").write_bytes(render(512, 0.6, 0.22))
# Maskable: full-bleed background, glyph inside the 80% safe zone
(OUT / "icon-maskable-512.png").write_bytes(render(512, 0.48, 0))
(OUT / "apple-touch-icon.png").write_bytes(render(180, 0.56, 0))
print("wrote", sorted(p.name for p in OUT.iterdir()))

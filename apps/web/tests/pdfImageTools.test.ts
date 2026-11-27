import { describe, it, expect } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import {
  displayRectToPdf,
  displaySize,
  wholePagePlacement,
} from "@/features/engines/pdfGeometry";
import { samplesToRgba, unpredictPng } from "@/features/engines/pdfCompress";
import {
  detectKind,
  orientationSegment,
  readExifOrientation,
  stripJpeg,
  stripPng,
  stripWebp,
} from "@/features/engines/imageMetadata";
import { isEncrypted } from "@/features/engines/pdfSecurity";
import { largestSubjectShare } from "@/features/engines/imageToolsEngine";
import {
  applyPageEdits,
  applyStamps,
  movePage,
} from "@/tools/pdf-pages/pdfPages";
import { withoutSecrets } from "@/features/workflows/library";
import { getToolById, TOOLS } from "@/features/registry/tools";
import { validateRegistry } from "@/features/registry/validate";
import { nextTools } from "@/features/workflows/conversion";
import { pickToolForFiles } from "@/features/share/shareInbox";

// 1×1 red PNG
const PNG_1PX = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

async function makePdf(
  sizes: [number, number][],
  rotations: number[] = [],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  sizes.forEach(([w, h], i) => {
    const page = doc.addPage([w, h]);
    page.drawText(`Page ${i + 1}`, { x: 20, y: 20 });
    if (rotations[i]) page.setRotation(degrees(rotations[i] ?? 0));
  });
  return doc.save();
}

describe("pdfGeometry", () => {
  const box = { x: 0, y: 0, width: 600, height: 800 };

  it("swaps width and height for sideways pages", () => {
    expect(displaySize(90, box)).toEqual({ width: 800, height: 600 });
    expect(displaySize(180, box)).toEqual({ width: 600, height: 800 });
  });

  it("places a top-left rect on an unrotated page with y flipped", () => {
    expect(
      displayRectToPdf(0, box, { x: 0.1, y: 0.1, w: 0.2, h: 0.1 }),
    ).toEqual({
      x: 60,
      y: 640,
      width: 120,
      height: 80,
      rotate: 0,
    });
  });

  it("maps the displayed top-left corner to the right unrotated corner for every rotation", () => {
    // A tiny rect at the displayed top-left: its bottom-left anchor is just under that corner.
    const r = { x: 0, y: 0, w: 0.0001, h: 0.0001 };
    const near = (a: number, b: number) => Math.abs(a - b) < 1;
    // Turning the page clockwise moves its bottom-left (90), bottom-right (180) or top-right (270) corner to the top-left.
    const p90 = displayRectToPdf(90, box, r);
    expect(near(p90.x, 0) && near(p90.y, 0)).toBe(true);
    const p180 = displayRectToPdf(180, box, r);
    expect(near(p180.x, 600) && near(p180.y, 0)).toBe(true);
    const p270 = displayRectToPdf(270, box, r);
    expect(near(p270.x, 600) && near(p270.y, 800)).toBe(true);
  });

  it("covers the whole page, honouring a crop box offset", () => {
    expect(
      wholePagePlacement(0, { x: 10, y: 20, width: 100, height: 200 }),
    ).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 200,
      rotate: 0,
    });
    expect(
      wholePagePlacement(90, { x: 0, y: 0, width: 100, height: 200 }),
    ).toMatchObject({
      x: 100,
      y: 0,
      width: 200,
      height: 100,
      rotate: 90,
    });
  });
});

describe("organize and sign PDF", () => {
  it("reorders, rotates and drops pages", async () => {
    const input = await makePdf([
      [100, 100],
      [200, 200],
      [300, 300],
    ]);
    const out = await PDFDocument.load(
      await applyPageEdits(input, [
        { source: 2, rotation: 90 },
        { source: 0, rotation: 0 },
      ]),
    );
    expect(out.getPageCount()).toBe(2);
    expect(out.getPage(0).getWidth()).toBe(300);
    expect(out.getPage(0).getRotation().angle).toBe(90);
    expect(out.getPage(1).getWidth()).toBe(100);
  });

  it("adds rotation on top of an existing page rotation", async () => {
    const input = await makePdf([[100, 100]], [270]);
    const out = await PDFDocument.load(
      await applyPageEdits(input, [{ source: 0, rotation: 180 }]),
    );
    expect(out.getPage(0).getRotation().angle).toBe(90);
  });

  it("refuses to save with no pages", async () => {
    await expect(
      applyPageEdits(await makePdf([[100, 100]]), []),
    ).rejects.toThrow(/at least one/);
  });

  it("moves items", () => {
    expect(movePage(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(movePage(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(movePage(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });

  it("stamps an image onto the chosen page", async () => {
    const input = await makePdf([
      [600, 800],
      [600, 800],
    ]);
    const out = await applyStamps(input, [
      { page: 1, rect: { x: 0.5, y: 0.5, w: 0.2, h: 0.1 }, png: PNG_1PX },
    ]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(out.length).toBeGreaterThan(input.length);
    // The image is only added to page 2's resources.
    const resources = (i: number) =>
      doc.getPage(i).node.Resources()?.toString() ?? "";
    expect(resources(1)).toMatch(/\/Image-\d+/);
    expect(resources(0)).not.toMatch(/\/Image-\d+/);
  });
});

describe("Compress PDF helpers", () => {
  it("undoes PNG Sub and Up predictors", () => {
    // 2 rows × 2 RGB pixels. Row 1: Sub filter; row 2: Up filter.
    const data = Uint8Array.from([
      1,
      10,
      20,
      30,
      5,
      5,
      5, // Sub: second pixel = first + 5
      2,
      1,
      1,
      1,
      1,
      1,
      1, // Up: each byte = above + 1
    ]);
    expect(Array.from(unpredictPng(data, 3, 2))).toEqual([
      10, 20, 30, 15, 25, 35, 11, 21, 31, 16, 26, 36,
    ]);
  });

  it("expands gray and RGB samples to RGBA", () => {
    expect(Array.from(samplesToRgba(Uint8Array.from([7]), 1, 1, 1))).toEqual([
      7, 7, 7, 255,
    ]);
    expect(
      Array.from(samplesToRgba(Uint8Array.from([1, 2, 3]), 3, 1, 1)),
    ).toEqual([1, 2, 3, 255]);
  });
});

function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

describe("Remove photo metadata", () => {
  const exifWithRotation = Array.from(orientationSegment(6).subarray(4)); // payload only
  const jpeg = Uint8Array.from([
    0xff,
    0xd8,
    ...segment(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...segment(0xe1, exifWithRotation),
    ...segment(0xe1, [
      ...ascii("http://ns.adobe.com/xap/1.0/"),
      0,
      ...ascii("<x:xmpmeta/>"),
    ]),
    ...segment(0xe2, [...ascii("ICC_PROFILE"), 0, 1, 1, 9, 9]),
    ...segment(0xfe, ascii("secret comment")),
    ...segment(0xdb, [0, ...new Array(64).fill(1)]),
    0xff,
    0xda,
    0,
    2,
    0x11,
    0x22,
    0x33,
    0xff,
    0xd9,
  ]);

  it("detects formats", () => {
    expect(detectKind(jpeg)).toBe("jpeg");
    expect(detectKind(Uint8Array.from([1, 2, 3, 4]))).toBeNull();
  });

  it("reads EXIF orientation", () => {
    expect(readExifOrientation(Uint8Array.from(exifWithRotation))).toBe(6);
  });

  it("drops EXIF, XMP and comments but keeps JFIF, ICC, rotation and image data", () => {
    const out = stripJpeg(jpeg);
    const text = String.fromCharCode(...out);
    expect(text).not.toContain("xmpmeta");
    expect(text).not.toContain("secret comment");
    expect(text).toContain("JFIF");
    expect(text).toContain("ICC_PROFILE");
    // Orientation kept in a minimal EXIF right after JFIF.
    const jfifEnd = 2 + 2 + 16;
    expect(out[jfifEnd]).toBe(0xff);
    expect(out[jfifEnd + 1]).toBe(0xe1);
    expect(
      readExifOrientation(
        out.subarray(jfifEnd + 4, jfifEnd + 4 + exifWithRotation.length),
      ),
    ).toBe(6);
    // Scan data untouched.
    expect(Array.from(out.subarray(out.length - 9))).toEqual([
      0xff, 0xda, 0, 2, 0x11, 0x22, 0x33, 0xff, 0xd9,
    ]);
  });

  it("adds no EXIF when the photo is upright", () => {
    const upright = Uint8Array.from([
      0xff,
      0xd8,
      ...segment(0xe1, Array.from(orientationSegment(1).subarray(4))),
      0xff,
      0xda,
      0,
      2,
      0xff,
      0xd9,
    ]);
    expect(Array.from(stripJpeg(upright))).toEqual([
      0xff, 0xd8, 0xff, 0xda, 0, 2, 0xff, 0xd9,
    ]);
  });

  function pngChunk(type: string, data: number[]): number[] {
    const len = data.length;
    return [
      len >>> 24,
      (len >> 16) & 255,
      (len >> 8) & 255,
      len & 255,
      ...ascii(type),
      ...data,
      0,
      0,
      0,
      0,
    ];
  }

  it("drops PNG text and EXIF chunks", () => {
    const png = Uint8Array.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...pngChunk("IHDR", new Array(13).fill(0)),
      ...pngChunk("tEXt", ascii("Author\0me")),
      ...pngChunk("eXIf", [1, 2, 3]),
      ...pngChunk("iCCP", [9]),
      ...pngChunk("IDAT", [7, 7]),
      ...pngChunk("IEND", []),
    ]);
    const text = String.fromCharCode(...stripPng(png));
    expect(text).not.toContain("tEXt");
    expect(text).not.toContain("eXIf");
    expect(text).toContain("iCCP");
    expect(text).toContain("IDAT");
    expect(text).toContain("IEND");
  });

  function riffChunk(type: string, data: number[]): number[] {
    const len = data.length;
    const pad = len % 2 ? [0] : [];
    return [
      ...ascii(type),
      len & 255,
      (len >> 8) & 255,
      (len >> 16) & 255,
      len >>> 24,
      ...data,
      ...pad,
    ];
  }

  it("drops WebP EXIF/XMP chunks, clears their flags and fixes the RIFF size", () => {
    const body = [
      ...ascii("WEBP"),
      ...riffChunk("VP8X", [0x0c | 0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ...riffChunk("VP8 ", [1, 2, 3, 4]),
      ...riffChunk("EXIF", [5, 6, 7]),
      ...riffChunk("XMP ", [8]),
    ];
    const size = body.length;
    const webp = Uint8Array.from([
      ...ascii("RIFF"),
      size & 255,
      (size >> 8) & 255,
      0,
      0,
      ...body,
    ]);
    const out = stripWebp(webp);
    const text = String.fromCharCode(...out);
    expect(text).not.toContain("EXIF");
    expect(text).not.toContain("XMP ");
    expect(out[20]).toBe(0x10); // alpha flag kept, EXIF/XMP flags cleared
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8);
  });
});

describe("Remove background", () => {
  /** A width×height RGBA buffer whose alpha is 255 where `keep(x, y)` is true. */
  const mask = (
    width: number,
    height: number,
    keep: (x: number, y: number) => boolean,
  ) => {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        rgba[(y * width + x) * 4 + 3] = keep(x, y) ? 255 : 0;
    return rgba;
  };

  it("sees one solid subject", () => {
    const share = largestSubjectShare(
      mask(100, 100, (x, y) => x >= 25 && x < 75 && y >= 20),
      100,
      100,
    );
    expect(share).toBeCloseTo(0.4, 1);
  });

  it("treats scattered specks or an empty mask as no subject", () => {
    expect(
      largestSubjectShare(
        mask(100, 100, (x, y) => (x + y) % 2 === 0),
        100,
        100,
      ),
    ).toBeLessThan(0.03);
    expect(
      largestSubjectShare(
        mask(100, 100, () => false),
        100,
        100,
      ),
    ).toBe(0);
  });
});

describe("Protect / unlock PDF", () => {
  it("knows when a PDF is not encrypted", async () => {
    expect(await isEncrypted(await makePdf([[100, 100]]))).toBe(false);
  });
});

describe("Registry and storage for the new tools", () => {
  it("registers every new tool with a valid definition", () => {
    for (const id of [
      "organize-pdf",
      "compress-pdf",
      "ocr-pdf",
      "sign-pdf",
      "protect-pdf",
      "unlock-pdf",
      "remove-background",
      "remove-metadata",
    ]) {
      expect(getToolById(id), id).toBeDefined();
    }
    expect(validateRegistry(TOOLS)).toEqual([]);
  });

  it("never stores passwords in presets or history", () => {
    const step = {
      toolId: "protect-pdf",
      format: "pdf",
      options: { password: "hunter2", allowPrintCopy: true },
    };
    expect(withoutSecrets(step).options).toEqual({ allowPrintCopy: true });
    const other = {
      toolId: "compress-pdf",
      format: "pdf",
      options: { level: "high" },
    };
    expect(withoutSecrets(other)).toBe(other);
  });

  it("doesn't offer custom-page tools as chained steps", () => {
    const ids = nextTools({
      toolId: "merge-pdf",
      format: "pdf",
      options: {},
    }).map((t) => t.id);
    expect(ids).toContain("compress-pdf");
    expect(ids).not.toContain("organize-pdf");
    expect(ids).not.toContain("sign-pdf");
  });

  it("still sends shared PDFs to a queue tool", () => {
    expect(pickToolForFiles([new File(["x"], "a.pdf")])?.id).toBe("merge-pdf");
  });
});

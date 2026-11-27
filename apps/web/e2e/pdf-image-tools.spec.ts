import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument, degrees } from "pdf-lib";

/**
 * End-to-end checks for the PDF tools (#17) and image tools (#18): each test
 * drives the real UI and then inspects the file that was downloaded.
 */

async function downloaded(page: Page, click: () => Promise<void>) {
  const pending = page.waitForEvent("download");
  await click();
  const download = await pending;
  const path = await download.path();
  if (!path) throw new Error("Download missing");
  return { name: download.suggestedFilename(), bytes: await readFile(path) };
}

/** A JPEG drawn in the browser: optional text lines and/or photo-like noise. */
async function canvasJpeg(
  page: Page,
  options: {
    width: number;
    height: number;
    lines?: string[];
    noise?: boolean;
    quality?: number;
  },
): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ width, height, lines, noise, quality }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      if (noise) {
        const img = ctx.getImageData(0, 0, width, height);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = (i / 4) % width;
          img.data[i] = (v * 7 + Math.random() * 80) & 255;
          img.data[i + 1] = (Math.random() * 255) & 255;
          img.data[i + 2] = ((i / 4 / width) * 3) & 255;
        }
        ctx.putImageData(img, 0, 0);
      }
      if (lines) {
        ctx.fillStyle = "#000000";
        ctx.font = "bold 64px Arial, sans-serif";
        lines.forEach((line, i) => ctx.fillText(line, 80, 160 + i * 110));
      }
      const blob = await new Promise<Blob>((r) =>
        canvas.toBlob((b) => r(b ?? new Blob()), "image/jpeg", quality ?? 0.95),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      bytes.forEach((b) => (binary += String.fromCharCode(b)));
      return btoa(binary);
    },
    options,
  );
  return Buffer.from(base64, "base64");
}

async function pdfWithImage(
  jpeg: Buffer,
  size: [number, number] = [612, 792],
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const image = await doc.embedJpg(jpeg);
  doc
    .addPage(size)
    .drawImage(image, { x: 0, y: 0, width: size[0], height: size[1] });
  return Buffer.from(await doc.save());
}

async function pdfWithPages(count: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) {
    doc
      .addPage([200 + i * 100, 400])
      .drawText(`Page ${i + 1}`, { x: 20, y: 200, size: 24 });
  }
  return Buffer.from(await doc.save());
}

/** Minimal big-endian EXIF with camera, rotation and GPS, inserted after SOI. */
function withExif(jpeg: Buffer): Buffer {
  const tiff = Buffer.alloc(180);
  tiff.write("MM", 0, "ascii");
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  const entry = (
    at: number,
    tag: number,
    type: number,
    count: number,
    value: number,
  ) => {
    tiff.writeUInt16BE(tag, at);
    tiff.writeUInt16BE(type, at + 2);
    tiff.writeUInt32BE(count, at + 4);
    if (type === 3 && count === 1) tiff.writeUInt16BE(value, at + 8);
    else tiff.writeUInt32BE(value, at + 8);
  };
  tiff.writeUInt16BE(4, 8);
  entry(10, 0x010f, 2, 8, 62); // Make
  entry(22, 0x0110, 2, 8, 70); // Model
  entry(34, 0x0112, 3, 1, 1); // Orientation
  entry(46, 0x8825, 4, 1, 78); // GPS IFD
  tiff.write("TestCam\0", 62, "ascii");
  tiff.write("Model X\0", 70, "ascii");
  tiff.writeUInt16BE(4, 78);
  entry(80, 0x0001, 2, 2, 0);
  tiff.write("N\0", 88, "ascii");
  entry(92, 0x0002, 5, 3, 132);
  entry(104, 0x0003, 2, 2, 0);
  tiff.write("E\0", 112, "ascii");
  entry(116, 0x0004, 5, 3, 156);
  [
    [52, 1],
    [31, 1],
    [0, 1],
    [13, 1],
    [24, 1],
    [0, 1],
  ].forEach(([n, d], i) => {
    tiff.writeUInt32BE(n ?? 0, 132 + i * 8);
    tiff.writeUInt32BE(d ?? 1, 136 + i * 8);
  });
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const header = Buffer.from([
    0xff,
    0xe1,
    (payload.length + 2) >> 8,
    (payload.length + 2) & 255,
  ]);
  return Buffer.concat([
    jpeg.subarray(0, 2),
    header,
    payload,
    jpeg.subarray(2),
  ]);
}

async function convertAndDownload(page: Page) {
  await page.getByRole("button", { name: "Convert remaining files" }).click();
  const button = page.getByRole("button", { name: "Download", exact: true });
  await expect(button).toBeVisible({ timeout: 60_000 });
  return downloaded(page, () => button.click());
}

test("Organize PDF: reorder, rotate and delete pages", async ({ page }) => {
  await page.goto("/tools/organize-pdf");
  await page.locator("input[type=file]").setInputFiles({
    name: "three.pdf",
    mimeType: "application/pdf",
    buffer: await pdfWithPages(3),
  });
  await expect(page.getByLabel("Page 3, position 3")).toBeVisible();
  await page.getByRole("button", { name: "Move page 3 earlier" }).click();
  await page.getByRole("button", { name: "Move page 3 earlier" }).click();
  await page.getByRole("button", { name: "Rotate page 3" }).click();
  await page.getByRole("button", { name: "Delete page 2" }).click();
  await expect(page.getByText("2 of 3 pages")).toBeVisible();

  const { name, bytes } = await downloaded(page, () =>
    page.getByRole("button", { name: "Save PDF" }).click(),
  );
  expect(name).toBe("three_organized.pdf");
  const out = await PDFDocument.load(bytes);
  expect(out.getPageCount()).toBe(2);
  expect(out.getPage(0).getWidth()).toBe(400); // was page 3
  expect(out.getPage(0).getRotation().angle).toBe(90);
  expect(out.getPage(1).getWidth()).toBe(200); // page 1
});

test("Sign PDF: typed signature and date are stamped on the page", async ({
  page,
}) => {
  const input = await pdfWithPages(2);
  await page.goto("/tools/sign-pdf");
  await page.locator("input[type=file]").setInputFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: input,
  });
  await expect(page.getByAltText("Page 1")).toBeVisible();
  await page.getByRole("button", { name: "Type" }).click();
  await page.getByLabel("Your name").fill("Ada Lovelace");
  await page.getByRole("button", { name: "Place signature on page 1" }).click();
  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("button", { name: "Add today's date" }).click();
  await expect(page.getByText("2 items placed")).toBeVisible();

  // Drag the date stamp a little; it should stay on the page.
  const stamp = page.getByRole("button", { name: /Placed item/ }).first();
  const box = await stamp.boundingBox();
  if (!box) throw new Error("stamp not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 40,
    box.y + box.height / 2 + 60,
    { steps: 5 },
  );
  await page.mouse.up();

  const { name, bytes } = await downloaded(page, () =>
    page.getByRole("button", { name: "Save signed PDF" }).click(),
  );
  expect(name).toBe("contract_signed.pdf");
  const out = await PDFDocument.load(bytes);
  expect(out.getPageCount()).toBe(2);
  for (const i of [0, 1]) {
    expect(out.getPage(i).node.Resources()?.toString()).toMatch(/\/Image-\d+/);
  }
});

test("Compress PDF: a photo-heavy PDF gets smaller and keeps its pages", async ({
  page,
}) => {
  const input = await pdfWithImage(
    await canvasJpeg(page, { width: 2400, height: 3200, noise: true }),
  );
  await page.goto("/tools/compress-pdf");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "photos.pdf",
      mimeType: "application/pdf",
      buffer: input,
    });
  const { name, bytes } = await convertAndDownload(page);
  expect(name).toBe("photos_compressed.pdf");
  expect(bytes.length).toBeLessThan(input.length * 0.6);
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
});

test("Protect PDF then Unlock PDF with the right password", async ({
  page,
}) => {
  await page.goto("/tools/protect-pdf");
  await page.locator("input[type=file]").setInputFiles({
    name: "private.pdf",
    mimeType: "application/pdf",
    buffer: await pdfWithPages(1),
  });
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  await page.getByLabel("Password").fill("open-sesame");
  const locked = await convertAndDownload(page);
  expect(locked.name).toBe("private_protected.pdf");
  await expect(PDFDocument.load(locked.bytes)).rejects.toThrow(/encrypted/i);

  await page.goto("/tools/unlock-pdf");
  await page.locator("input[type=file]").setInputFiles({
    name: "private_protected.pdf",
    mimeType: "application/pdf",
    buffer: locked.bytes,
  });
  await page.getByLabel("Current password").fill("wrong");
  await page.getByRole("button", { name: "Convert remaining files" }).click();
  await expect(page.getByText("That password is wrong.")).toBeVisible({
    timeout: 30_000,
  });

  await page.getByLabel("Current password").fill("open-sesame");
  await page.getByRole("button", { name: "Convert remaining files" }).click();
  const button = page.getByRole("button", { name: "Download", exact: true });
  await expect(button).toBeVisible({ timeout: 30_000 });
  const unlocked = await downloaded(page, () => button.click());
  expect(unlocked.name).toBe("private_protected_unlocked.pdf");
  expect((await PDFDocument.load(unlocked.bytes)).getPageCount()).toBe(1);
});

test("OCR PDF: text in a scanned page is recognized", async ({ page }) => {
  test.setTimeout(120_000);
  const scan = await pdfWithImage(
    await canvasJpeg(page, {
      width: 1275,
      height: 1650,
      lines: ["HELLO CONVERTIT", "SCANNED INVOICE 2026"],
    }),
  );
  await page.goto("/tools/ocr-pdf");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "scan.pdf",
      mimeType: "application/pdf",
      buffer: scan,
    });

  const searchable = await convertAndDownload(page);
  expect(searchable.name).toBe("scan_ocr.pdf");
  const doc = await PDFDocument.load(searchable.bytes);
  expect(doc.getPageCount()).toBe(1);
  expect(searchable.bytes.length).toBeGreaterThan(scan.length);

  await page.getByRole("button", { name: "Clear all" }).click();
  await page.getByRole("button", { name: "Text (.txt)" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "scan.pdf",
      mimeType: "application/pdf",
      buffer: scan,
    });
  const text = await convertAndDownload(page);
  expect(text.name).toBe("scan.txt");
  const content = text.bytes.toString("utf8").toUpperCase();
  expect(content).toContain("HELLO");
  expect(content).toContain("INVOICE");
});

test("Remove photo metadata: shows the GPS location, then strips it losslessly", async ({
  page,
}) => {
  await page.goto("/tools/remove-metadata");
  const photo = withExif(
    await canvasJpeg(page, { width: 320, height: 200, noise: true }),
  );
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "holiday.jpg",
      mimeType: "image/jpeg",
      buffer: photo,
    });
  await expect(page.getByText(/Location 52\.5/)).toBeVisible();
  await expect(page.getByText("TestCam Model X")).toBeVisible();

  const { name, bytes } = await convertAndDownload(page);
  expect(name).toBe("holiday_clean.jpg");
  expect(bytes.includes(Buffer.from("TestCam"))).toBe(false);
  expect(bytes.includes(Buffer.from("Exif"))).toBe(false);
  // Image data is untouched: everything from the first DQT on is identical.
  const dqt = (b: Buffer) => b.indexOf(Buffer.from([0xff, 0xdb]));
  expect(bytes.subarray(dqt(bytes)).equals(photo.subarray(dqt(photo)))).toBe(
    true,
  );
});

test("Compress image to a target size", async ({ page }) => {
  await page.goto("/tools/image-compress");
  await page.getByLabel("Compression level").selectOption("target");
  await page.getByLabel("Maximum size (KB)").fill("60");
  await page.getByRole("button", { name: "JPG", exact: true }).click();
  const photo = await canvasJpeg(page, {
    width: 1600,
    height: 1200,
    noise: true,
    quality: 0.98,
  });
  expect(photo.length).toBeGreaterThan(300 * 1024);
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "big.jpg", mimeType: "image/jpeg", buffer: photo });
  const { bytes } = await convertAndDownload(page);
  expect(bytes.length).toBeLessThanOrEqual(60 * 1024);
});

test("Remove background: produces a same-size PNG with transparency", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/tools/remove-background");
  const base64 = await page.evaluate(async () => {
    // A simple figure (head and shoulders) on a coloured backdrop.
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#6fb3e0";
    ctx.fillRect(0, 0, 384, 512);
    ctx.fillStyle = "#e8b98f";
    ctx.beginPath();
    ctx.ellipse(192, 190, 70, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#333a56";
    ctx.beginPath();
    ctx.ellipse(192, 520, 170, 210, 0, 0, Math.PI * 2);
    ctx.fill();
    const data = canvas.toDataURL("image/png");
    return data.slice(data.indexOf(",") + 1);
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  });
  const { name, bytes } = await convertAndDownload(page);
  expect(name).toBe("portrait_no-bg.png");
  const [width, height, transparent] = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let clear = 0;
    for (let i = 3; i < pixels.length; i += 4)
      if ((pixels[i] ?? 255) < 128) clear++;
    return [bitmap.width, bitmap.height, clear / (pixels.length / 4)];
  }, Array.from(bytes));
  expect([width, height]).toEqual([384, 512]);
  // Background gone, figure kept.
  expect(transparent).toBeGreaterThan(0.1);
  expect(transparent).toBeLessThan(0.98);
});

test("Remove background: a photo with no person gets a clear message", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/tools/remove-background");
  // A plain sky: nothing to cut out.
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    const sky = ctx.createLinearGradient(0, 0, 0, 300);
    sky.addColorStop(0, "#4a90d9");
    sky.addColorStop(1, "#cfe6f7");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 400, 300);
    const data = canvas.toDataURL("image/jpeg", 0.92);
    return data.slice(data.indexOf(",") + 1);
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "sky.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(base64, "base64"),
  });
  await page.getByRole("button", { name: "Convert remaining files" }).click();
  await expect(page.getByText(/No person was found in sky\.jpg/)).toBeVisible({
    timeout: 60_000,
  });
});

test("Image editor: social size preset sets the exact output size", async ({
  page,
}) => {
  await page.goto("/tools/image-editor");
  const photo = await canvasJpeg(page, {
    width: 2000,
    height: 1500,
    noise: true,
  });
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({ name: "shot.jpg", mimeType: "image/jpeg", buffer: photo });
  await page.getByRole("button", { name: "Social" }).click();
  await page.getByLabel("Post or banner").selectOption("yt-thumb");
  await expect(page.getByText("1280 × 720 px")).toBeVisible();
});

test("rotated pages: a signature placed on a sideways page lands upright", async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 600]).setRotation(degrees(90));
  const input = Buffer.from(await doc.save());
  await page.goto("/tools/sign-pdf");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "sideways.pdf",
      mimeType: "application/pdf",
      buffer: input,
    });
  await expect(page.getByAltText("Page 1")).toBeVisible();
  // Displayed page is landscape (600 × 400).
  const img = await page.getByAltText("Page 1").boundingBox();
  expect(img && img.width > img.height).toBe(true);
  await page.getByLabel("Text to add").fill("OK");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const { bytes } = await downloaded(page, () =>
    page.getByRole("button", { name: "Save signed PDF" }).click(),
  );
  const out = await PDFDocument.load(bytes);
  expect(out.getPage(0).getRotation().angle).toBe(90);
  expect(out.getPage(0).node.Resources()?.toString()).toMatch(/\/Image-\d+/);
});

import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

test('image presets persist the format, quality and maximum width', async ({
  page,
}) => {
  await page.goto('/tools/image-convert');
  await page.getByLabel('Quality', { exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button', { name: 'Advanced parameters' }).click();
  await page.getByLabel('Resize width (px)').fill('1920');
  await page.getByLabel('Use resize width as a maximum').check({ force: true });
  await page.getByText('Tool presets', { exact: true }).click();
  await page.getByLabel('Preset name').fill('WebP 80% max 1920px');
  await page.getByRole('button', { name: 'Save preset' }).click();
  await expect(page.getByText('Preset saved.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'JPG', exact: true }).click();
  await page.getByText('Tool presets', { exact: true }).click();
  await page.getByRole('button', { name: 'Apply WebP 80% max 1920px' }).click();
  await expect(page.getByLabel('Quality', { exact: true })).toHaveValue('80');
  await page.getByRole('button', { name: 'Advanced parameters' }).click();
  await expect(page.getByLabel('Resize width (px)')).toHaveValue('1920');
  await expect(page.getByLabel('Use resize width as a maximum')).toBeChecked();
  await page.locator('input[type=file]').setInputFiles({
    name: 'small.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 8;
        const data = canvas.toDataURL();
        return data.slice(data.indexOf(',') + 1);
      }),
      'base64'
    ),
  });
  await page.getByRole('button', { name: 'Convert remaining files' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  const output = await download;
  expect(output.suggestedFilename()).toBe('small.webp');
  const path = await output.path();
  if (!path) throw new Error('Missing WebP download');
  const bytes = await readFile(path);
  expect(
    await page.evaluate(async (data) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
      return [bitmap.width, bitmap.height];
    }, Array.from(bytes))
  ).toEqual([16, 8]);
});

test('storage failure leaves the completed conversion downloadable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get: () => {
        throw new DOMException('Storage disabled', 'SecurityError');
      },
    });
  });
  await page.goto('/tools/csv-to-json');
  await page.locator('input[type=file]').setInputFiles({
    name: 'people.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name\nJane'),
  });
  await page.getByRole('button', { name: 'Convert remaining files' }).click();
  await expect(
    page.getByRole('button', { name: 'Download', exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(/Browser storage could not save this run/)
  ).toBeVisible();
});

test('HEIC images become one PDF and replay locally after a refresh', async ({
  page,
}) => {
  const posts: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST') posts.push(req.url());
  });
  await page.goto('/tools/heic-to-jpg');
  const buffer = await readFile(
    fileURLToPath(new URL('./fixtures/sample.heic', import.meta.url))
  );
  await page
    .locator('input[type=file]')
    .setInputFiles(
      ['first.heic', 'second.heic'].map((name) => ({
        name,
        mimeType: 'image/heic',
        buffer,
      }))
    );
  await page.getByLabel('Next conversion').selectOption('images-to-pdf');
  await page.getByLabel('Page fit').selectOption('original');
  await page.getByRole('button', { name: 'Convert remaining files' }).click();
  async function checkPdf() {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const result = await download;
    expect(result.suggestedFilename()).toMatch(/\.pdf$/);
    const path = await result.path();
    if (!path) throw new Error('Missing PDF download');
    const doc = await PDFDocument.load(await readFile(path));
    expect(doc.getPages().map((p) => p.getSize())).toEqual([
      { width: 64, height: 48 },
      { width: 64, height: 48 },
    ]);
  }
  await checkPdf();
  await page.goto('/tools/csv-to-json');
  await page.getByText('Recent conversions', { exact: true }).click();
  await page.getByRole('button', { name: 'Re-run', exact: true }).click();
  await expect(page).toHaveURL(/heic-to-jpg$/);
  await checkPdf();
  expect(posts).toEqual([]);
  await page.getByText('Recent conversions', { exact: true }).click();
  await page.getByRole('button', { name: 'Clear all history' }).click();
  await expect(page.getByText('No recent conversions.')).toBeVisible();
  await page.reload();
  await page.getByText('Recent conversions', { exact: true }).click();
  await expect(page.getByText('No recent conversions.')).toBeVisible();
});

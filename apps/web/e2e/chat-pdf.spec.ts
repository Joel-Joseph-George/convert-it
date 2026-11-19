import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./fixtures/handbook.pdf', import.meta.url));

test('indexes a PDF locally, streams a cited answer, and opens its source', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const question = 'What color marks the mountain trail?';
  const externalRequests: string[] = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => {
    externalRequests.push(new URL(route.request().url()).origin);
    return route.abort();
  });
  await page.route('**/api/chat', async (route) => {
    const body = route.request().postDataJSON();
    expect(Object.keys(body).sort()).toEqual(['chunks', 'history', 'question']);
    expect(body.question).toBe(question);
    expect(body.history).toEqual([]);
    expect(body.chunks.length).toBeLessThanOrEqual(5);
    expect(body.chunks[0]).toEqual({ page: 10, text: expect.stringContaining('Blue triangles') });
    await route.fulfill({
      contentType: 'text/event-stream',
      body: 'event: token\ndata: {"token":"Blue triangles "}\n\nevent: token\ndata: {"token":"[p. 10]"}\n\nevent: done\ndata: {}\n\n',
    });
  });
  await page.goto('/tools/chat-pdf');
  await page.locator('input[type=file]').setInputFiles(fixture);
  const input = page.getByLabel('Ask about this PDF');
  await expect(input).toBeVisible({ timeout: 90_000 });
  await page.keyboard.press('Control+k');
  await expect(input).toBeFocused();
  await input.fill(question);
  await input.press('Enter');
  await expect(page.getByText('Blue triangles', { exact: false })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '[p. 10]', exact: true }).click();
  await expect(page.getByLabel('PDF page 10')).toBeVisible();
  await page.reload();
  // Reopen from IndexedDB even when model files cannot be loaded.
  await page.route('**/vendor/models/**', (r) => r.abort());
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(input).toBeVisible();
  await page.getByRole('button', { name: 'Clear stored data' }).click();
  await expect(page.getByRole('status')).toHaveText('Stored PDF indexes cleared.');
  expect(externalRequests).toEqual([]);
});

import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const fixture = fileURLToPath(new URL('../e2e/fixtures/handbook.pdf', import.meta.url));
const cases = JSON.parse(
  await readFile(new URL('../e2e/fixtures/retrieval.json', import.meta.url), 'utf8'),
);
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  let retrieved = [];
  await page.route('**/api/chat', async (route) => {
    retrieved = route
      .request()
      .postDataJSON()
      .chunks.map((chunk) => chunk.page);
    await route.fulfill({
      contentType: 'text/event-stream',
      body: 'event: token\ndata: {"token":"Evaluated."}\n\nevent: done\ndata: {}\n\n',
    });
  });
  let hits = 0;
  for (const item of cases) {
    await page.goto(server.resolvedUrls.local[0] + 'tools/chat-pdf');
    await page.locator('input[type=file]').setInputFiles(fixture);
    const field = page.getByLabel('Ask about this PDF');
    await field.waitFor({ timeout: 90_000 });
    retrieved = [];
    await field.fill(item.question);
    await field.press('Enter');
    await page.getByRole('heading', { name: 'Answer', exact: true }).waitFor({ timeout: 30_000 });
    if (retrieved.includes(item.page)) hits++;
    console.log(
      `Page ${item.page} | retrieved ${retrieved.join(', ') || 'none'} | ${item.question}`,
    );
  }
  console.log(
    `Top-5 hit rate: ${hits}/${cases.length} (${((100 * hits) / cases.length).toFixed(0)}%)`,
  );
} finally {
  await browser?.close();
  await server.close();
}

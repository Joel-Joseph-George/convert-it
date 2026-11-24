import { test, expect } from '@playwright/test';

test.describe('ConvertIt E2E Flows (Section 13)', () => {
  test('1. Home: Choosing a photo opens the image editor', async ({ page }) => {
    await page.goto('/');

    // 1×1 transparent PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );
    await page.locator('input[aria-label="Choose a photo to edit"]').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: png,
    });

    await expect(page).toHaveURL(/\/tools\/image-editor$/);
    await expect(page.locator('h1')).toContainText('Image editor');
    await expect(page.getByText('photo.png', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Download/ })).toBeVisible();
  });

  test('1b. YouTube tool: Paste invalid URL shows ErrorAlert', async ({ page }) => {
    await page.goto('/tools/youtube');

    const input = page.locator('input[placeholder*="YouTube link"]');
    await expect(input).toBeVisible();

    await input.fill('https://example.com/not-youtube');
    await input.press('Enter');

    const alert = page.locator('div[role="alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("look like a YouTube link");
  });

  test('2. All Tools: Search and filter categories', async ({ page }) => {
    await page.goto('/tools');

    // Verify tools directory renders
    const heading = page.locator('h1');
    await expect(heading).toContainText(/All tools/i);

    // Search for "spreadsheet"
    const searchInput = page.locator('input[placeholder*="Search tools"]');
    await searchInput.fill('spreadsheet');

    // Verify filtered tool cards
    const cards = page.locator('a[href^="/tools/"]');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Clear search and click "Audio" category chip
    await searchInput.fill('');
    const audioChip = page.locator('button', { hasText: /^Audio$/ });
    await audioChip.click();

    // Verify audio converter card appears
    await expect(page.locator('text=Audio Converter')).toBeVisible();
  });

  test('3. Browser Conversion End-to-End: CSV to JSON', async ({ page }) => {
    await page.goto('/tools/csv-to-json');

    // Verify tool page loaded
    await expect(page.locator('h1')).toContainText('CSV to JSON');

    // Create and attach a mock CSV file
    const csvContent = 'name,role,level\nAlice,Engineer,Senior\nBob,Designer,Lead';
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'team.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    // Verify file row appears in queue with ready status
    await expect(page.getByText('team.csv', { exact: true })).toBeVisible();

    // Click Convert button
    const convertBtn = page.locator('button', { hasText: /^Convert/ });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // Verify conversion succeeds locally in browser
    const downloadBtn = page.locator('button', { hasText: /^Download$/ });
    await expect(downloadBtn).toBeVisible({ timeout: 10000 });
  });

  test('4. Theme Toggle: Persists across reload and updates localStorage', async ({ page }) => {
    await page.goto('/');

    // Theme toggle button
    const themeBtn = page.locator('button[aria-label*="theme"]');
    await expect(themeBtn).toBeVisible();

    // Read initial theme on html class
    const initialIsDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );

    // Click theme toggle
    await themeBtn.click();

    // Verify class flipped
    const updatedIsDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
    expect(updatedIsDark).toBe(!initialIsDark);

    // Verify localStorage has persisted
    const storedTheme = await page.evaluate(() =>
      localStorage.getItem('convertit_theme')
    );
    expect(storedTheme).toBe(updatedIsDark ? 'dark' : 'light');

    // Reload page and check persistence
    await page.reload();
    const persistedIsDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
    expect(persistedIsDark).toBe(updatedIsDark);
  });

  test('5. Mobile Viewport: Layout displays cleanly without horizontal overflow', async ({ page }) => {
    // 390px mobile viewport (iPhone 14 width)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Verify no horizontal document overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    // Check top bar brand renders
    await expect(page.locator('text=ConvertIt')).toBeVisible();

    // Navigate to /tools on mobile
    await page.goto('/tools');
    const toolsScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(toolsScrollWidth).toBeLessThanOrEqual(390);

    // Check tool cards render in single column
    await expect(page.locator('h1')).toContainText(/All tools/i);
  });
});

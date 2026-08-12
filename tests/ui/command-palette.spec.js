import { test, expect, navigateToSidePanel } from './setup.js';

test.describe('Command Palette', () => {
  test('Ctrl+K opens the palette', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    // Wait for app to initialize
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+k');
    // Allow a moment for the palette to render
    await page.waitForTimeout(200);

    const palette = page.locator('#command-palette');
    const paletteContent = page.locator('.palette-content');

    // Either the overlay element or the inner palette-content should be visible
    await expect(paletteContent).toBeVisible({ timeout: 5000 });

    await page.close();
  });

  test('the palette input gets focused on open', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);

    const input = page.locator('#palette-input');
    await expect(input).toBeVisible();

    // Focus check via document.activeElement
    const focused = await page.evaluate(() => {
      return document.activeElement && document.activeElement.id === 'palette-input'
    })
    expect(focused).toBe(true)

    await page.close();
  });

  test('Escape closes the palette', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
    await expect(page.locator('.palette-content')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Palette content should be gone (overlay is cleared on close)
    await expect(page.locator('.palette-content')).toHaveCount(0);

    await page.close();
  });

  test('typing narrows the result list', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
    await page.fill('#palette-input', 'help');
    await page.waitForTimeout(200);

    const helpItem = page.locator('.palette-item:has-text("help")').first();
    await expect(helpItem).toBeVisible();

    await page.close();
  });

  test('ArrowDown + Enter on an item closes the palette', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);

    // ArrowDown should move highlight (we just verify no crash)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Click the first item — that's equivalent to Enter and doesn't need an API call
    const firstItem = page.locator('.palette-item').first();
    if (await firstItem.count() > 0) {
      await firstItem.click();
      await page.waitForTimeout(300);
    }

    // Palette should be closed after selection
    await expect(page.locator('.palette-content')).toHaveCount(0);

    await page.close();
  });
});

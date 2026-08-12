import { test, expect, navigateToSidePanel } from './setup.js';

test.describe('Code Pane', () => {
  test('is initially hidden', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const codePane = page.locator('#code-pane');
    await expect(codePane).toBeHidden();

    await page.close();
  });

  test('Ctrl+J toggles the code pane open', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);
    await page.waitForTimeout(500);

    const codePane = page.locator('#code-pane');
    await expect(codePane).toBeHidden();

    await page.keyboard.press('Control+j');
    // Allow drawer transition (300ms)
    await page.waitForTimeout(400);

    // Code pane should now be visible (drawer-open class added)
    await expect(codePane).toBeVisible();

    await page.keyboard.press('Control+j');
    await page.waitForTimeout(400);
    await expect(codePane).toBeHidden();

    await page.close();
  });

  test('code pane has 3 tabs: Output, Terminal, Preview', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+j');
    await page.waitForTimeout(400);

    const tabs = page.locator('.code-tab');
    const count = await tabs.count();
    expect(count).toBe(3);

    const labels = await tabs.allTextContents()
    expect(labels.some(l => /output/i.test(l))).toBe(true);
    expect(labels.some(l => /terminal/i.test(l))).toBe(true);
    expect(labels.some(l => /preview/i.test(l))).toBe(true);

    await page.close();
  });

  test('clicking a tab switches the active content', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+j');
    await page.waitForTimeout(400);

    // Click Terminal tab
    const terminalTab = page.locator('.code-tab', { hasText: /terminal/i }).first();
    await terminalTab.click();
    await page.waitForTimeout(200);

    // The Terminal tab should now be active
    await expect(terminalTab).toHaveClass(/active/);

    await page.close();
  });

  test('Close button closes the code pane', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+j');
    await page.waitForTimeout(400);
    await expect(page.locator('#code-pane')).toBeVisible();

    await page.locator('#close-code-pane').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#code-pane')).toBeHidden();

    await page.close();
  });
});

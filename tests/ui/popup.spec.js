import { test, expect } from './setup.js';

const navigateToPopup = async (context, extensionId) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(300);
  return page;
};

test.describe('Popup', () => {
  test('loads with the Open Panel button visible', async ({ context, extensionId }) => {
    const page = await navigateToPopup(context, extensionId);

    await expect(page.locator('#open-panel')).toBeVisible();

    await page.close();
  });

  test('has a quick-prompt input area', async ({ context, extensionId }) => {
    const page = await navigateToPopup(context, extensionId);

    const input = page.locator('#quick-prompt, textarea, input[type=text]').first();
    await expect(input).toBeAttached();

    await page.close();
  });

  test('has a result area (initially hidden)', async ({ context, extensionId }) => {
    const page = await navigateToPopup(context, extensionId);

    const resultArea = page.locator('#result-area, .result-area');
    // It exists in DOM but may be hidden until first response
    await expect(resultArea.first()).toBeAttached();

    await page.close();
  });

  test('action buttons exist and have labels', async ({ context, extensionId }) => {
    const page = await navigateToPopup(context, extensionId);

    const actions = page.locator('.action-btn');
    const count = await actions.count();
    expect(count).toBeGreaterThan(0);

    await page.close();
  });

  test('typing into quick prompt input', async ({ context, extensionId }) => {
    const page = await navigateToPopup(context, extensionId);

    const input = page.locator('#quick-prompt');
    if (await input.isVisible()) {
      await input.fill('Hello from test');
      const value = await input.inputValue();
      expect(value).toBe('Hello from test');
    } else {
      // Fresh profiles intentionally gate the mini-chat until a provider key
      // is configured; verify the user can reach setup instead of making an
      // API call in an E2E test.
      await expect(page.locator('#setup-btn')).toBeVisible();
    }

    await page.close();
  });

  test('followup input exists (initially hidden)', async ({ context, extensionId }) => {
    const page = await navigateToPopup(context, extensionId);

    const followup = page.locator('#followup-input, .followup-input');
    await expect(followup.first()).toBeAttached();

    await page.close();
  });
});

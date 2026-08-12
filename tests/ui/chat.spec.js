import { test, expect, navigateToSidePanel } from './setup.js';

test.describe('Chat Interface', () => {
  test('should load chat interface', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    await expect(page.locator('#message-input')).toBeVisible();
    await expect(page.locator('#send-btn')).toBeVisible();
    await expect(page.locator('#messages')).toBeAttached();

    await page.close();
  });

  test('should have model selector', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const modelSelect = page.locator('#model-select');
    await expect(modelSelect).toBeVisible();

    const optionCount = await modelSelect.locator('option').count();
    expect(optionCount).toBeGreaterThan(0);

    await page.close();
  });

  test('should have settings button', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    await expect(page.locator('#settings-btn')).toBeVisible();

    await page.close();
  });

  test('should have 5 chat mode buttons', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const modeButtons = page.locator('.mode-btn');
    await expect(modeButtons).toHaveCount(5); // smart, reasoning, study, search, agent

    await page.close();
  });

  test('should switch between modes', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const reasoningBtn = page.locator('.mode-btn[data-mode="reasoning"]');
    await reasoningBtn.click();

    await expect(reasoningBtn).toHaveClass(/active/);

    const smartBtn = page.locator('.mode-btn[data-mode="smart"]');
    await smartBtn.click();

    await expect(smartBtn).toHaveClass(/active/);

    await page.close();
  });

  test('should accept text input', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const messageInput = page.locator('#message-input');
    await messageInput.fill('Test message');

    const inputValue = await messageInput.inputValue();
    expect(inputValue).toBe('Test message');

    await page.close();
  });

  test('should have accessible input element', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const messageInput = page.locator('#message-input');
    const hasAriaLabel = await messageInput.evaluate(el =>
      el.hasAttribute('aria-label') ||
      el.hasAttribute('placeholder') ||
      el.hasAttribute('title')
    );
    expect(hasAriaLabel).toBe(true);

    await page.close();
  });
});

test.describe('Options Page', () => {
  test('should load options page', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options/options.html`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#provider-select')).toBeVisible();
    await expect(page.locator('#save-settings')).toBeVisible();

    await page.close();
  });

  test('should list all providers', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options/options.html`);
    await page.waitForLoadState('domcontentloaded');

    const providerSelect = page.locator('#provider-select');
    const optionCount = await providerSelect.locator('option').count();
    expect(optionCount).toBeGreaterThanOrEqual(11); // 10 providers + "Choose..." placeholder

    await page.close();
  });
});

test.describe('Popup', () => {
  test('should load popup', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#open-panel')).toBeVisible();

    await page.close();
  });
});

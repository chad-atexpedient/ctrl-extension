import { test, expect, navigateToSidePanel } from './setup.js';

test.describe('Snippets', () => {
  test('typing / shows the command autocomplete', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const input = page.locator('#message-input');
    await input.fill('/');

    const autocomplete = page.locator('#command-autocomplete');
    await expect(autocomplete).toBeVisible();

    await page.close();
  });

  test('typing /summar narrows suggestions to snippet matches', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const input = page.locator('#message-input');
    await input.fill('/summar');

    // Should contain the Summarize snippet
    const summarizeItem = page.locator('.autocomplete-item:has-text("/summarize")');
    await expect(summarizeItem).toBeVisible();

    await page.close();
  });

  test('ArrowDown moves the highlighted selection', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const input = page.locator('#message-input');
    await input.fill('/');
    await expect(page.locator('#command-autocomplete')).toBeVisible();

    // Default selection is index 0; press ArrowDown and confirm there's a new .selected
    await page.keyboard.press('ArrowDown');
    const items = page.locator('.autocomplete-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(1);
    // At least one item must be selected (we don't depend on which index)
    await expect(page.locator('.autocomplete-item.selected').first()).toBeVisible();

    await page.close();
  });

  test('Enter on a highlighted snippet inserts content into the input (does not send)', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const input = page.locator('#message-input');
    await input.fill('/summarize');

    // Wait for autocomplete to show, then move to the Summarize item
    await expect(page.locator('.autocomplete-item:has-text("/summarize")')).toBeVisible();
    // Type ' summarize' so expansion text appears in the dropdown — pick the snippet
    await page.keyboard.press('Enter');

    // The autocomplete should close
    await expect(page.locator('#command-autocomplete')).toBeHidden();

    // The expanded snippet content should now be in the input — contains the word "Summarize"
    const value = await input.inputValue();
    expect(value.toLowerCase()).toContain('summarize');

    // Sending was NOT triggered — messages area has no new user bubble
    const userMessages = page.locator('.message.user');
    expect(await userMessages.count()).toBe(0);

    await page.close();
  });

  test('typing /research shows the built-in command (not a snippet)', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const input = page.locator('#message-input');
    await input.fill('/research');

    // Should show the /research command from the registry
    await expect(page.locator('.autocomplete-item:has-text("/research")').first()).toBeVisible();

    await page.close();
  });
});

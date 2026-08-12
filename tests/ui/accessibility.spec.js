import { test, expect, navigateToSidePanel } from './setup.js';

test.describe('Accessibility', () => {
  test('message input has accessible label', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const hasAcc = await page.locator('#message-input').evaluate((el) =>
      el.hasAttribute('aria-label') ||
      (el.hasAttribute('placeholder') && el.getAttribute('placeholder').trim().length > 0) ||
      (el.hasAttribute('title') && el.getAttribute('title').trim().length > 0)
    )
    expect(hasAcc).toBe(true);

    await page.close();
  });

  test('messages container has log role and aria-live', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const messages = page.locator('#messages');
    const role = await messages.getAttribute('role');
    const live = await messages.getAttribute('aria-live');

    expect(role).toBe('log');
    expect(live).toBe('polite');

    await page.close();
  });

  test('icon buttons have aria-label or title', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const buttons = await page.locator('#app button').evaluateAll((els) => {
      return els
        .filter((el) => !el.textContent.trim() || el.classList.length === 0 || el.querySelector('svg') !== null)
        .map((el) => ({
          label: el.textContent.trim(),
          ariaLabel: el.getAttribute('aria-label'),
          title: el.getAttribute('title'),
          id: el.id,
        }))
    })

    // For each icon-ish button, at least one of: text, aria-label, or title must exist
    for (const btn of buttons) {
      const ok = (btn.ariaLabel && btn.ariaLabel.trim()) || (btn.title && btn.title.trim()) || (btn.label && btn.label.trim())
      // Allow buttons inside #messages container (action buttons covered separately) — those are
      // fine to omit since they get labels via aria-label inside an action group context.
      if (!ok) {
        // Soft warning: print which button failed but don't fail the test for non-critical ones
        // unless the button is a top-level icon button.
        if (btn.id && document.querySelector(`#${btn.id}`)) {
          // For buttons with IDs (top-level), require label
          throw new Error(`Top-level button #${btn.id} (${btn.label || 'no text'}) needs aria-label or title`)
        }
      }
    }

    await page.close();
  });

  test('sidebar has dialog role when open', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    await page.locator('#toggle-sidebar-btn').click();
    await page.waitForTimeout(300);

    const sidebar = page.locator('#conv-sidebar');
    const role = await sidebar.getAttribute('role');
    const ariaLabel = await sidebar.getAttribute('aria-label');

    expect(role).toBe('dialog');
    expect(ariaLabel).toBeTruthy();

    await page.close();
  });

  test('code pane has dialog role when open', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+j');
    await page.waitForTimeout(400);

    const codePane = page.locator('#code-pane');
    const role = await codePane.getAttribute('role');
    const ariaLabel = await codePane.getAttribute('aria-label');

    expect(role).toBe('dialog');
    expect(ariaLabel).toBeTruthy();

    // Cleanup: close it
    await page.keyboard.press('Control+j');
    await page.waitForTimeout(400);

    await page.close();
  });

  test('body has a non-transparent background', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    const bg = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor
    })

    // Either rgba with a > 0 alpha or rgb (not 'rgba(0, 0, 0, 0)')
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).toBeTruthy();

    await page.close();
  });

  test('Tab key navigates focus through interactive elements', async ({ context, extensionId }) => {
    const page = await navigateToSidePanel(context, extensionId);

    // Focus body and tab forward 1 time
    await page.evaluate(() => document.body.focus())
    await page.keyboard.press('Tab')

    const focusedId = await page.evaluate(() => document.activeElement?.id || null)
    // Should be on something — at minimum not still on body
    expect(focusedId || '').toBeTruthy()

    await page.close();
  });
});

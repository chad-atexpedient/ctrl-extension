import { test as base, expect, chromium } from '@playwright/test';
import path from 'path';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// setup.js lives in tests/ui; the extension root is two levels up.
const EXTENSION_PATH = path.resolve(__dirname, '../../');

// The manifest pins a public "key", so the unpacked extension ID is
// deterministic: the first 16 bytes of SHA-256 of the DER key, each nibble
// mapped to a-p. Chrome computes IDs exactly this way for unpacked
// extensions that declare a key.
function computeExtensionId(manifest) {
  const keyDer = Buffer.from(manifest.key, 'base64');
  const hash = createHash('sha256').update(keyDer).digest();
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += String.fromCharCode(97 + (hash[i] >> 4));
    id += String.fromCharCode(97 + (hash[i] & 0xf));
  }
  return id;
}

const manifestJson = JSON.parse(readFileSync(path.join(EXTENSION_PATH, 'manifest.json'), 'utf8'));

export const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      // Use Playwright's bundled Chromium: MV3 extensions load reliably in
      // its headless mode, whereas newer system Chrome builds refuse
      // --load-extension in headless sessions.
      channel: 'chromium',
      headless: process.env.PLAYWRIGHT_HEADLESS === '1',
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let extensionId;
    for (let i = 0; i < 20; i++) {
      // Wait for service workers (extensions) to register — they show up here
      const workers = context.serviceWorkers();
      if (workers.length > 0) {
        // The service worker URL is chrome-extension://<id>/background/...
        const url = workers[0].url();
        const match = url.match(/chrome-extension:\/\/([a-z]+)\//);
        if (match) {
          extensionId = match[1];
          break;
        }
      }
      // Fallback to chrome://extensions scraping
      let page;
      try {
        page = await context.newPage();
        await page.goto('chrome://extensions');
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        // chrome://extensions may be unreachable in headless; don't block on it
        const id = await page.evaluate(() => {
          const manager = document.querySelector('extensions-manager');
          if (manager && manager.shadowRoot) {
            const list = manager.shadowRoot.querySelector('extensions-item-list');
            if (list && list.shadowRoot) {
              const item = list.shadowRoot.querySelector('extensions-item');
              return item ? item.id : null;
            }
          }
          return null;
        }).catch(() => null);
        if (id) { extensionId = id; break }
      } catch {} finally {
        if (page) await page.close().catch(() => {})
      }
      await new Promise(r => setTimeout(r, 500));
    }
    if (!extensionId) {
      // The manifest pins a public key, so the ID is deterministic even when
      // the service worker is idle and chrome://extensions is unreachable.
      if (manifestJson.key) {
        extensionId = computeExtensionId(manifestJson);
      } else {
        throw new Error(
          'Could not find extension ID. Make sure:\n' +
          '  1. The extension loads cleanly via "Load unpacked" in chrome://extensions\n' +
          '  2. The manifest.json is valid\n' +
          '  3. Not running with --headless=new restriction (try `npm run test:ui:headed`)'
        );
      }
    }
    await use(extensionId);
  },
});

export { expect };

export async function navigateToSidePanel(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#message-input', { timeout: 10000 });
  // New profiles show first-run surfaces. Dismiss them so feature tests can
  // interact with the underlying UI instead of duplicating setup logic.
  await page.waitForTimeout(1000);
  const skipSetup = page.locator('#onboarding-skip');
  if (await skipSetup.isVisible().catch(() => false)) {
    await skipSetup.click({ force: true });
  }
  const consentDismiss = page.locator('#consent-banner .consent-banner-dismiss');
  if (await consentDismiss.isVisible().catch(() => false)) {
    await consentDismiss.click({ force: true });
  }
  await page.waitForTimeout(200);
  return page;
}

export async function navigateToOptions(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options/options.html`);
  await page.waitForLoadState('domcontentloaded');
  return page;
}

export const testData = {
  messages: {
    simple: 'Hello',
    code: 'Write a JavaScript function',
    markdown: 'Write text with **bold** and *italic*',
  },
  modes: ['chat', 'presentation', 'data', 'mvp', 'research'],
};

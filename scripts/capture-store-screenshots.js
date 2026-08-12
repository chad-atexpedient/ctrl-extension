#!/usr/bin/env node
/**
 * Capture clean, non-sensitive store screenshots from a headed Chromium run.
 * This intentionally never submits prompts to a provider.
 */

import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const output = join(root, 'store-assets', 'screenshots')
mkdirSync(output, { recursive: true })

const context = await chromium.launchPersistentContext('', {
  headless: false,
  viewport: { width: 1280, height: 800 },
  args: [
    `--disable-extensions-except=${root}`,
    `--load-extension=${root}`,
    '--no-first-run',
    '--no-default-browser-check',
  ],
})

try {
  let extensionId = null
  for (let i = 0; i < 20 && !extensionId; i++) {
    const worker = context.serviceWorkers()[0]
    extensionId = worker?.url().match(/chrome-extension:\/\/([a-z]+)\//)?.[1] || null
    if (!extensionId) await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (!extensionId) throw new Error('Extension service worker did not register. Run this command headed.')

  const panel = await context.newPage()
  await panel.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`)
  await panel.waitForSelector('#message-input', { timeout: 15000 })
  await panel.waitForTimeout(1200)
  const skipSetup = panel.locator('#onboarding-skip')
  const onboarding = panel.locator('#onboarding-overlay')
  if (await onboarding.isVisible().catch(() => false)) {
    if (await skipSetup.isVisible().catch(() => false)) {
      await skipSetup.click({ force: true })
    } else {
      await panel.evaluate(() => document.getElementById('onboarding-overlay')?.classList.add('hidden'))
    }
    await panel.waitForTimeout(300)
  }
  const consentDismiss = panel.locator('#consent-banner .consent-banner-dismiss')
  if (await consentDismiss.isVisible().catch(() => false)) {
    await consentDismiss.click({ force: true })
    await panel.waitForTimeout(200)
  }
  await panel.screenshot({ path: join(output, '01-sidepanel-chat.png') })

  await panel.locator('#toggle-sidebar-btn').click()
  await panel.waitForTimeout(300)
  await panel.screenshot({ path: join(output, '02-sidebar-snippets.png') })

  await panel.locator('#close-sidebar').click()
  await panel.keyboard.press('Control+j')
  await panel.waitForTimeout(400)
  await panel.screenshot({ path: join(output, '03-code-drawer.png') })
  await panel.close()

  const popup = await context.newPage()
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`)
  await popup.waitForSelector('#open-panel', { timeout: 15000 })
  await popup.screenshot({ path: join(output, '04-popup.png') })
  await popup.close()

  const options = await context.newPage()
  await options.goto(`chrome-extension://${extensionId}/options/options.html`)
  await options.waitForLoadState('domcontentloaded')
  await options.screenshot({ path: join(output, '05-options.png') })
  await options.close()

  console.log(`Screenshots written to ${output}`)
} finally {
  await context.close()
}

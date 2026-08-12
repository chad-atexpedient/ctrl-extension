#!/usr/bin/env node
/** Validate every distributable manifest without contacting a store. */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const errors = []

function readManifest(relativePath) {
  const path = join(root, relativePath)
  if (!existsSync(path)) {
    errors.push(`${relativePath} does not exist`)
    return null
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    errors.push(`${relativePath} is invalid JSON: ${error.message}`)
    return null
  }
}

const manifests = [
  ['manifest.json', 'chrome'],
  ['platform/manifests/manifest.firefox.json', 'firefox'],
  ['platform/manifests/manifest.safari.json', 'safari'],
]

for (const [relativePath, target] of manifests) {
  const manifest = readManifest(relativePath)
  if (!manifest) continue
  if (manifest.version !== pkg.version) {
    errors.push(`${relativePath} version ${manifest.version} does not match package ${pkg.version}`)
  }
  if (!manifest.name || !manifest.description || !manifest.icons) {
    errors.push(`${relativePath} is missing name, description, or icons`)
  }
  if (target === 'chrome') {
    if (manifest.manifest_version !== 3) errors.push('Chrome manifest must be MV3')
    if (manifest.host_permissions?.some((p) => p === 'https://*/v1/*' || p === 'https://*/api/*')) {
      errors.push('Chrome manifest still contains broad required API host permissions')
    }
    if (!manifest.optional_host_permissions?.length) errors.push('Chrome manifest needs optional custom-provider hosts')
  }
  if (target === 'firefox') {
    if (!manifest.browser_specific_settings?.gecko?.id) errors.push('Firefox manifest needs a stable Gecko extension id')
    if (!manifest.sidebar_action?.default_panel) errors.push('Firefox manifest needs sidebar_action.default_panel')
    if (!manifest.background?.scripts?.length) errors.push('Firefox manifest needs background scripts')
  }
  if (target === 'safari') {
    if (manifest.side_panel || manifest.permissions?.includes('debugger')) {
      errors.push('Safari manifest must not require Chrome sidePanel/debugger APIs')
    }
  }
}

const requiredFiles = [
  'platform/browser-api.js',
  'background/firefox-bootstrap.js',
  '_locales/en/messages.json',
  'PRIVACY-POLICY.md',
]
for (const relativePath of requiredFiles) {
  if (!existsSync(join(root, relativePath))) errors.push(`Missing required distribution file: ${relativePath}`)
}

if (errors.length) {
  console.error(errors.map((error) => `✗ ${error}`).join('\n'))
  process.exit(1)
}

console.log(`✓ Distribution manifests and required assets are valid for v${pkg.version}`)

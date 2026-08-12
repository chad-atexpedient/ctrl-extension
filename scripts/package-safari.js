#!/usr/bin/env node
/**
 * Generate the native Safari Web Extension Xcode project on macOS.
 *
 * This command intentionally does not pretend Safari is a drop-in Chromium
 * target: Safari requires Xcode, signing, and manual validation of the
 * sidebar/debugger fallbacks before App Store submission.
 */

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const output = process.env.SAFARI_PROJECT_DIR || join(root, 'safari', 'CTRL Extension')
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

if (process.platform !== 'darwin') {
  console.error('Safari conversion requires macOS with Xcode and xcrun installed.')
  console.error('Use `npm run package:safari` to create the source zip, then run `npm run safari:convert` on macOS.')
  process.exit(2)
}

mkdirSync(output, { recursive: true })
const staging = mkdtempSync(join(root, 'dist', 'safari-staging-'))
cpSync(root, staging, {
  recursive: true,
  filter: (source) => {
    const relative = source.slice(root.length + 1).replaceAll('\\', '/')
    return !relative.startsWith('node_modules/') &&
      !relative.startsWith('.git/') &&
      !relative.startsWith('dist/') &&
      !relative.startsWith('tests/') &&
      !relative.startsWith('test-results/') &&
      !relative.startsWith('scripts/') &&
      !relative.startsWith('platform/manifests/') &&
      !relative.startsWith('store-assets/') &&
      !relative.startsWith('safari/')
  },
})
writeFileSync(
  join(staging, 'manifest.json'),
  `${readFileSync(join(root, 'platform', 'manifests', 'manifest.safari.json'), 'utf8').trim()}\n`,
)

const result = spawnSync('xcrun', [
  'safari-web-extension-converter',
  staging,
  '--project-location', output,
  '--app-name', 'CTRL Extension',
  '--bundle-identifier', 'com.ctrl.extension.safari',
  '--swift',
], { stdio: 'inherit' })

rmSync(staging, { recursive: true, force: true })
if (result.status !== 0) process.exit(result.status || 1)
console.log(`Safari Xcode project generated in ${output}`)

#!/usr/bin/env node
/**
 * Generate the public/private key pair used to keep a self-hosted Chromium
 * extension ID stable. The private key is intentionally written outside this
 * repository by default and must never be committed or uploaded.
 */

import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const home = process.env.USERPROFILE || process.env.HOME || root
const privatePath = process.env.CTRL_EXTENSION_KEY_PATH || join(home, '.ctrl-extension', 'extension-key.pem')
const writeManifest = process.argv.includes('--write-manifest')

if (existsSync(privatePath)) {
  console.error(`Refusing to overwrite existing private key: ${privatePath}`)
  process.exit(1)
}

mkdirSync(dirname(privatePath), { recursive: true })
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

writeFileSync(privatePath, privateKey, { encoding: 'utf8', mode: 0o600 })
const publicKeyBase64 = publicKey.toString('base64')

console.log(`Private key written to: ${privatePath}`)
console.log('Public manifest key:')
console.log(publicKeyBase64)

if (writeManifest) {
  const manifestPath = join(root, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.key = publicKeyBase64
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Added public key to ${manifestPath}`)
} else {
  console.log('No manifest changed. Re-run with --write-manifest after reviewing the public key.')
}

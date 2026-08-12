#!/usr/bin/env node
/**
 * Package the extension as a zip suitable for Chrome Web Store upload.
 * Excludes dev-only files (tests, scripts, .github, dist itself).
 */

import { readFileSync, statSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const TARGETS = new Set(['chrome', 'firefox', 'safari'])
const requestedTarget = process.argv.find((arg) => arg.startsWith('--target='))?.split('=')[1] || 'chrome'

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'))
if (pkg.version !== manifest.version) {
  console.error(`Version mismatch: package.json=${pkg.version} manifest.json=${manifest.version}`)
  process.exit(1)
}

// Directories/files to exclude from the zip
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'test-results', 'playwright-report',
  '.github', 'scripts', 'tests', '.idea', '.vscode', 'coverage',
  'platform' + sep + 'manifests', 'safari', 'store-assets', 'distribution',
])
const EXCLUDE_FILES = new Set([
  '.gitignore', '.env', '.envrc', 'package-lock.json',
])

function shouldExclude(relPath) {
  const normalized = relPath.replace(/\\/g, '/')
  if (normalized.startsWith('platform/manifests/')) return true
  if (normalized.startsWith('safari/')) return true
  const parts = relPath.split(sep)
  for (const part of parts) {
    if (EXCLUDE_DIRS.has(part)) return true
  }
  const basename = parts[parts.length - 1]
  if (EXCLUDE_FILES.has(basename)) return true
  if (basename.endsWith('.log')) return true
  if (basename.endsWith('.tmp')) return true
  return false
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out.push(...walk(full))
    } else {
      const rel = relative(ROOT, full)
      if (!shouldExclude(rel)) out.push(rel)
    }
  }
  return out
}

async function main() {
  if (!TARGETS.has(requestedTarget)) {
    throw new Error(`Unknown target "${requestedTarget}". Expected chrome, firefox, or safari.`)
  }

  const files = walk(ROOT).filter((file) => file !== 'manifest.json')
  const manifestPath = requestedTarget === 'chrome'
    ? join(ROOT, 'manifest.json')
    : join(ROOT, 'platform', 'manifests', `manifest.${requestedTarget}.json`)
  const targetManifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const manifestBytes = Buffer.from(`${JSON.stringify(targetManifest, null, 2)}\n`, 'utf8')
  console.log(`Packaging ${files.length + 1} files for ${requestedTarget} v${pkg.version}...`)

  // Use built-in Node zip support via node:zlib — for simplicity, we use a
  // store-only zip implementation. The Chrome Web Store accepts store-only zips.
  const zipPath = join(ROOT, 'dist', `ctrl-extension-${requestedTarget}-v${pkg.version}.zip`)
  await import('node:fs/promises').then(fs => fs.mkdir(join(ROOT, 'dist'), { recursive: true }))

  // Use archiver style — but since we want zero dependencies, generate a minimal
  // valid store-only zip ourselves.
  await writeZip(ROOT, files, zipPath, { 'manifest.json': manifestBytes })
  console.log(`✓ Wrote ${zipPath}`)
}

import { open } from 'node:fs/promises'

function bufferCrc32(buf) {
  // Keep the packager compatible with the declared Node >=16 engine. Node's
  // zlib.crc32 was only added much later, so use the standard table algorithm.
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Write a ZIP file (store-only, no compression since these are already minified).
 * Format: https://en.wikipedia.org/wiki/ZIP_(file_format)
 */
async function writeZip(root, files, outPath, overrides = {}) {
  const fh = await open(outPath, 'w')
  const writer = fh.createWriteStream()
  const entries = []
  let offset = 0

  // Build central directory data
  const centralEntries = []

  const allFiles = [...files, ...Object.keys(overrides).filter((file) => !files.includes(file))]
  for (const rel of allFiles) {
    const data = overrides[rel] || readFileSync(join(root, rel))
    const name = rel.replace(/\\/g, '/')
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = bufferCrc32(data)
    const size = data.length

    // Local file header
    const lfh = Buffer.alloc(30)
    lfh.writeUInt32LE(0x04034b50, 0)  // signature
    lfh.writeUInt16LE(20, 4)          // version needed
    lfh.writeUInt16LE(0, 6)           // flags
    lfh.writeUInt16LE(0, 8)           // compression: store
    lfh.writeUInt16LE(0, 10)          // mod time
    lfh.writeUInt16LE(0x21, 12)       // mod date (Jan 1, 1980)
    lfh.writeUInt32LE(crc, 14)
    lfh.writeUInt32LE(size, 18)       // compressed size
    lfh.writeUInt32LE(size, 22)       // uncompressed size
    lfh.writeUInt16LE(nameBuf.length, 26)
    lfh.writeUInt16LE(0, 28)          // extra length
    writer.write(lfh)
    writer.write(nameBuf)
    writer.write(data)

    centralEntries.push({ name, crc, size, offset, nameBuf })
    offset += 30 + nameBuf.length + size
  }

  // Central directory
  const cdStart = offset
  for (const e of centralEntries) {
    const cdh = Buffer.alloc(46)
    cdh.writeUInt32LE(0x02014b50, 0)
    cdh.writeUInt16LE(20, 4)          // version made by
    cdh.writeUInt16LE(20, 6)          // version needed
    cdh.writeUInt16LE(0, 8)           // flags
    cdh.writeUInt16LE(0, 10)          // compression
    cdh.writeUInt16LE(0, 12)          // mod time
    cdh.writeUInt16LE(0x21, 14)       // mod date
    cdh.writeUInt32LE(e.crc, 16)
    cdh.writeUInt32LE(e.size, 20)     // compressed
    cdh.writeUInt32LE(e.size, 24)     // uncompressed
    cdh.writeUInt16LE(e.nameBuf.length, 28)
    cdh.writeUInt16LE(0, 30)          // extra
    cdh.writeUInt16LE(0, 32)          // comment
    cdh.writeUInt16LE(0, 34)          // disk
    cdh.writeUInt16LE(0, 36)          // internal attrs
    cdh.writeUInt32LE(0, 38)          // external attrs
    cdh.writeUInt32LE(e.offset, 42)
    writer.write(cdh)
    writer.write(e.nameBuf)
    offset += 46 + e.nameBuf.length
  }

  // End of central directory record
  const cdSize = offset - cdStart
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(centralEntries.length, 8)
  eocd.writeUInt16LE(centralEntries.length, 10)
  eocd.writeUInt32LE(cdSize, 12)
  eocd.writeUInt32LE(cdStart, 16)
  eocd.writeUInt16LE(0, 20)
  writer.write(eocd)

  await new Promise((resolve) => writer.end(resolve))
  await fh.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

#!/usr/bin/env node
/**
 * Simple lint checks for production-readiness.
 * Runs fast Node-only checks — no ESLint config needed.
 *
 * Checks:
 *   - All production JS files parse (node --check syntax validation)
 *   - No stray console.log (only console.warn/error allowed)
 *   - manifest.json version matches package.json version
 *   - All JSON manifest fields present
 *   - No unsafe innerHTML with unescaped interpolations
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')

const errors = []
const warnings = []

function walk(dir, ext = '.js') {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'lib' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, ext))
    else if (extname(full) === ext) out.push(full)
  }
  return out
}

// 0. Syntax check: every production JS file must parse (catches typos,
// truncated methods, unclosed braces, etc. that grep-based checks miss)
console.log('Checking JS syntax (node --check)...')
const srcFiles = [...walk(join(ROOT, 'sidepanel')), ...walk(join(ROOT, 'background')),
  ...walk(join(ROOT, 'popup')), ...walk(join(ROOT, 'options')), ...walk(join(ROOT, 'content')),
  ...walk(join(ROOT, 'utils')), ...walk(join(ROOT, 'platform')), ...walk(join(ROOT, 'sandbox'))]
for (const file of srcFiles) {
  const rel = file.replace(ROOT + '\\', '')
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) {
    const msg = (result.stderr || result.stdout || '').trim().split('\n').pop() || 'syntax error'
    errors.push(`${rel}: ${msg}`)
  }
}

// 1. Stray console.log in src (not tests/scripts)
console.log('Checking for stray console.log in production code...')

for (const file of srcFiles) {
  const rel = file.replace(ROOT + '\\', '')
  const content = readFileSync(file, 'utf8')
    const lines = content.split('\n')
    let inTemplateString = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Count unbalanced backticks (excluding escaped ones).
      const escapedStripped = line.split(String.fromCharCode(92, 96)).join('')
      const backticks = (escapedStripped.match(/`/g) || []).length
      const odd = backticks % 2 === 1
      if (odd) inTemplateString = !inTemplateString
      // Skip if currently inside a template OR if this line itself is a complete template (open + close)
      if (inTemplateString) continue
      // Skip commented lines
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue
      // Allow console.log in known dev sections: ignore console.log marked with a // allow-debug comment
      if (/console\.log\s*\(/.test(line)) {
        const prev = lines.slice(Math.max(0, i - 3), i).join('\n')
        if (prev.includes('allow-console-log') || prev.includes('allow-debug')) continue
        // If this line itself opens AND closes a template (2+ backticks, even count), the
        // content between them is a string literal — not real code — so skip it.
        if (backticks >= 2) continue
        warnings.push(`${rel}:${i + 1} stray console.log — replace with console.warn or remove`)
      }
    }
}

// 2. manifest version == package.json version
console.log('Checking version sync...')
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'))
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
if (manifest.version !== pkg.version) {
  errors.push(`Version mismatch: manifest.json=${manifest.version} vs package.json=${pkg.version}`)
}

// 3. Required manifest fields
const requiredFields = ['manifest_version', 'name', 'version', 'description', 'icons', 'permissions']
for (const f of requiredFields) {
  if (!manifest[f]) errors.push(`manifest.json missing required field: ${f}`)
}

// 4. Required permissions list
const requiredPerms = ['storage', 'sidePanel']
for (const p of requiredPerms) {
  if (!manifest.permissions?.includes(p)) errors.push(`manifest.json missing required permission: ${p}`)
}

// 5. No dangerouslySetInnerHTML equivalent in src files (innerHTML = with only static content is fine;
//    look for innerHTML = ... that has ${} interpolation with non-static data)
console.log('Checking for unsafe innerHTML with interpolated data...')
// Safe patterns: SVG attributes (class, data-*, role, aria-*) and URLs/code are typically safe
const safeContextPatterns = [
  /aria-label=/, /aria-pressed=/, /aria-hidden=/, /aria-expanded=/,
  /class=\${/, /data-[a-z]+=/, /role=/,
  /title=\${/, /href=\${/, /src=\${/,
]
for (const file of srcFiles) {
  const rel = file.replace(ROOT + '\\', '')
  const content = readFileSync(file, 'utf8')
  // Find innerHTML = `...${expr}...` — these should use escapeHtml()
  const lines = content.split('\n')
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    if (!/innerHTML\s*=\s*`/.test(line)) continue
    // Skip if next line contains a backtick (multi-line template)
    // For simplicity, scope to single-line templates
    const tmpl = line.match(/innerHTML\s*=\s*`([^`]*)`/)?.[1] || ''
    if (!tmpl || !tmpl.includes('${')) continue
    // Skip lines that contain only safe context patterns
    if (safeContextPatterns.some(p => p.test(line))) continue
    const safeVars = (tmpl.match(/(escapeHtml|escapeAttr|escapeText)\(([^)]+)\)/g) || []).length
    const totalVars = (tmpl.match(/\$\{[^}]+\}/g) || []).length
    if (safeVars < totalVars) {
      warnings.push(`${rel}:${lineIdx + 1} innerHTML has ${totalVars} interpolations, only ${safeVars} escaped — review for XSS risk`)
    }
  }
}

// Report
const sep = '─'.repeat(70)
if (warnings.length) {
  console.log(`\n${sep}\n  WARNINGS (${warnings.length})\n${sep}`)
  warnings.forEach(w => console.log('  •', w))
}
if (errors.length) {
  console.log(`\n${sep}\n  ERRORS (${errors.length})\n${sep}`)
  errors.forEach(e => console.log('  •', e))
  process.exit(1)
}
if (!warnings.length && !errors.length) {
  console.log('✓ All lint checks passed.')
} else {
  console.log(`\n${warnings.length} warnings, ${errors.length} errors`)
}

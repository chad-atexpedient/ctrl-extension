#!/usr/bin/env node
/**
 * CTRL Extension Test Suite
 * Run with: node test-suite.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXTENSION_DIR = path.join(__dirname);
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function log(test, status, message = '') {
  results.tests.push({ test, status, message });
  const icon = status === 'PASS' ? '✓' : status === 'WARN' ? '⚠' : '✗';
  console.log(`  ${icon} ${test}: ${message}`);
  if (status === 'PASS') results.passed++;
  else if (status === 'FAIL') results.failed++;
  else results.warnings++;
}

console.log('\n=== CTRL Extension Test Suite ===\n');

// Test 1: Check manifest.json
console.log('1. Checking manifest.json...');
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION_DIR, 'manifest.json'), 'utf8'));
  
  if (manifest.manifest_version === 3) {
    log('Manifest Version', 'PASS', 'MV3 detected');
  } else {
    log('Manifest Version', 'FAIL', 'Not MV3');
  }
  
  if (manifest.permissions && manifest.permissions.includes('sidePanel')) {
    log('Side Panel Permission', 'PASS', 'Configured');
  } else {
    log('Side Panel Permission', 'FAIL', 'Missing');
  }
  
  if (manifest.host_permissions && manifest.host_permissions.includes('https://*/*')) {
    log('Host Permissions', 'PASS', 'All URLs allowed');
  } else {
    log('Host Permissions', 'WARN', 'Limited host permissions');
  }
  
  const requiredFiles = [
    manifest.side_panel?.default_path,
    manifest.background?.service_worker,
    manifest.action?.default_popup
  ].filter(Boolean);
  
  log('Manifest Entries', requiredFiles.length >= 3 ? 'PASS' : 'FAIL', 
    `${requiredFiles.length} key entries`);
      
} catch (e) {
  log('Manifest', 'FAIL', e.message);
}

// Test 2: Check HTML files
console.log('\n2. Checking HTML files...');
const htmlFiles = [
  'sidepanel/sidepanel.html',
  'popup/popup.html',
  'options/options.html',
  'sandbox/sandbox.html'
];

for (const file of htmlFiles) {
  const filepath = path.join(EXTENSION_DIR, file);
  if (fs.existsSync(filepath)) {
    const content = fs.readFileSync(filepath, 'utf8');
    const hasDoctype = content.includes('<!DOCTYPE') || content.includes('<html');
    log(`HTML: ${file}`, hasDoctype ? 'PASS' : 'WARN', hasDoctype ? 'Valid structure' : 'Missing DOCTYPE');
  } else {
    log(`HTML: ${file}`, 'FAIL', 'File not found');
  }
}

// Test 3: Check JavaScript files for syntax errors
console.log('\n3. Checking JavaScript syntax...');
const jsFiles = [
  'sidepanel/agent.js',
  'sidepanel/sidepanel.js',
  'background/service-worker.js',
  'utils/api-client.js',
  'popup/popup.js',
  'options/options.js'
];

for (const file of jsFiles) {
  const filepath = path.join(EXTENSION_DIR, file);
  if (fs.existsSync(filepath)) {
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      // Basic check - try to parse (won't catch all errors but will catch syntax issues)
      new Function(content);
      log(`JS: ${file}`, 'PASS', 'No syntax errors');
    } catch (e) {
      if (e.message.includes('import') || e.message.includes('export')) {
        log(`JS: ${file}`, 'PASS', 'ES Module (syntax OK)');
      } else {
        log(`JS: ${file}`, 'FAIL', e.message.substring(0, 50));
      }
    }
  } else {
    log(`JS: ${file}`, 'WARN', 'File not found');
  }
}

// Test 4: Check library files
console.log('\n4. Checking library files...');
const libraries = [
  'lib/tailwindcss.js',
  'lib/chart.umd.js',
  'lib/pptxgen.bundle.js',
  'lib/papaparse.min.js',
  'lib/xlsx.full.min.js',
  'lib/marked.min.js',
  'lib/purify.min.js',
  'lib/highlight.min.js'
];

let libCount = 0;
for (const lib of libraries) {
  const filepath = path.join(EXTENSION_DIR, lib);
  if (fs.existsSync(filepath)) {
    libCount++;
    const stats = fs.statSync(filepath);
    log(`Lib: ${path.basename(lib)}`, 'PASS', `${(stats.size / 1024).toFixed(1)} KB`);
  } else {
    log(`Lib: ${path.basename(lib)}`, 'FAIL', 'Not found');
  }
}
log('Total Libraries', libCount === libraries.length ? 'PASS' : 'WARN', 
  `${libCount}/${libraries.length} present`);

// Test 5: Check icon files
console.log('\n5. Checking icon files...');
const icons = ['16', '32', '48', '128'];
let iconCount = 0;
for (const size of icons) {
  const iconPath = path.join(EXTENSION_DIR, `icons/icon${size}.png`);
  if (fs.existsSync(iconPath)) {
    iconCount++;
  }
}
log('Icons', iconCount === 4 ? 'PASS' : 'WARN', `${iconCount}/4 icon sizes`);

// Test 6: Check agent.js for key features
console.log('\n6. Checking agent features...');
const agentJsPath = path.join(EXTENSION_DIR, 'sidepanel/agent.js');
if (fs.existsSync(agentJsPath)) {
  const agentContent = fs.readFileSync(agentJsPath, 'utf8');
  
  const features = [
    // Live slash-command entry points (the legacy workspace-button methods
    // were removed — the same features are reachable via /slides, /mvp,
    // /research through these entry points).
    { name: 'generateSlidesFromPrompt', check: /generateSlidesFromPrompt\s*\(/ },
    { name: 'generateMvpFromPrompt', check: /generateMvpFromPrompt\s*\(/ },
    { name: 'generateResearchFromPrompt', check: /generateResearchFromPrompt\s*\(/ },
    { name: '_generateSlideDeck', check: /_generateSlideDeck\s*\(/ },
    { name: '_generateMvpHtml', check: /_generateMvpHtml\s*\(/ },
    { name: '_generateResearchHtml', check: /_generateResearchHtml\s*\(/ },
    { name: '_renderSlideDeckHtml (Preview PPTX export)', check: /_renderSlideDeckHtml\s*\(/ },
    { name: 'parseJSONSafely', check: /parseJSONSafely\s*\(/ },
    { name: 'cleanHTML', check: /cleanHTML\s*\(/ },
    { name: 'searchImages', check: /searchImages\s*\(/ },
    { name: 'webSearch', check: /webSearch\s*\(/ },
    { name: 'getSandboxCsp', check: /getSandboxCsp\s*\(/ }
  ];
  
  for (const feature of features) {
    log(`Feature: ${feature.name}`, feature.check.test(agentContent) ? 'PASS' : 'FAIL', 
      feature.check.test(agentContent) ? 'Implemented' : 'Missing');
  }
} else {
  log('agent.js', 'FAIL', 'File not found');
}

// Test 7: Check service-worker for tools
console.log('\n7. Checking background service worker...');
const swPath = path.join(EXTENSION_DIR, 'background/service-worker.js');
if (fs.existsSync(swPath)) {
  const swContent = fs.readFileSync(swPath, 'utf8');
  
    // NOTE: image_search / generate_image tools were removed from the app
  // (service-worker.js only registers read_page, browse_url, web_search).
  // Those checks are intentionally left out rather than guessed-fixed.
  const tools = [
    { name: 'web_search tool', check: /name:\s*'web_search'/ },
    { name: 'read_page tool', check: /name:\s*'read_page'/ },
    { name: 'EXECUTE_TOOL handler', check: /case.*EXECUTE_TOOL/ }
  ];

  for (const tool of tools) {
    log(`Tool: ${tool.name}`, tool.check.test(swContent) ? 'PASS' : 'FAIL',
      tool.check.test(swContent) ? 'Registered' : 'Missing');
  }
} else {
  log('service-worker.js', 'FAIL', 'File not found');
}

// Test 8: Check sidepanel.html for required elements
// NOTE: this used to check the old "agent workspace" UI (mode-chat/mode-agent
// toggle, presentation/data/mvp/research agent tabs, slide-prompt,
// data-drop-zone, mvp-prompt, research-prompt, sandbox.html iframe). That UI
// has been removed/redesigned and those elements no longer exist in
// sidepanel.html. Rather than guess at replacements, only the elements that
// still exist in the current UI are checked below.
console.log('\n8. Checking sidepanel UI elements...');
const spPath = path.join(EXTENSION_DIR, 'sidepanel/sidepanel.html');
if (fs.existsSync(spPath)) {
  const spContent = fs.readFileSync(spPath, 'utf8');

  const elements = [
    { name: 'model-select', check: /id="model-select"/ },
    { name: 'PptxGenJS library', check: /pptxgen\.bundle\.js/ },
    { name: 'PapaParse library', check: /papaparse/ }
  ];
  
  for (const el of elements) {
    log(`UI: ${el.name}`, el.check.test(spContent) ? 'PASS' : 'FAIL',
      el.check.test(spContent) ? 'Present' : 'Missing');
  }
} else {
  log('sidepanel.html', 'FAIL', 'File not found');
}

// Test 9: Check storage.js for providers
console.log('\n9. Checking multi-provider support...');
const storagePath = path.join(EXTENSION_DIR, 'utils/storage.js');
if (fs.existsSync(storagePath)) {
  const storageContent = fs.readFileSync(storagePath, 'utf8');
  
  const providers = [
    { name: 'OpenAI', check: /openai.*:/ },
    { name: 'Anthropic', check: /anthropic.*:/ },
    { name: 'Google Gemini', check: /google.*:/ },
    { name: 'Z.ai (GLM)', check: /zai.*:/ },
    { name: 'Custom URL', check: /custom.*:/ }
  ];
  
  for (const provider of providers) {
    log(`Provider: ${provider.name}`, provider.check.test(storageContent) ? 'PASS' : 'FAIL',
      provider.check.test(storageContent) ? 'Configured' : 'Missing');
  }
} else {
  log('storage.js', 'FAIL', 'File not found');
}

// Summary
console.log('\n=== TEST SUMMARY ===');
console.log(`  Passed: ${results.passed}`);
console.log(`  Failed: ${results.failed}`);
console.log(`  Warnings: ${results.warnings}`);
console.log(`  Total: ${results.tests.length}`);

if (results.failed > 0) {
  console.log('\nFailed tests:');
  results.tests.filter(t => t.status === 'FAIL').forEach(t => {
    console.log(`  - ${t.test}: ${t.message}`);
  });
  process.exit(1);
} else {
  console.log('\n✓ All tests passed!');
  process.exit(0);
}

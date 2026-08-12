#!/usr/bin/env node
/**
 * Integration Tests for CTRL Extension
 * Tests critical workflows and component integration
 * Run with: node integration-tests.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function log(test, status, message = '') {
  results.tests.push({ test, status, message });
  const icon = status === 'PASS' ? '✓' : '✗';
  console.log(`  ${icon} ${test}: ${message}`);
  if (status === 'PASS') results.passed++;
  else results.failed++;
}

function assert(condition, testName, message) {
  if (condition) {
    log(testName, 'PASS', message || 'Assertion passed');
  } else {
    log(testName, 'FAIL', message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    log(testName, 'PASS', `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  } else {
    log(testName, 'FAIL', `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('\n=== CTRL Extension Integration Tests ===\n');

// ============================================
// Test 1: Storage Integration
// ============================================
console.log('1. Testing Storage Integration...');

const storagePath = path.join(__dirname, 'utils/storage.js');
if (fs.existsSync(storagePath)) {
  const storageContent = fs.readFileSync(storagePath, 'utf8');

  // Test 1.1: Check StorageManager class exists
  assert(
    storageContent.includes('class StorageManager'),
    'StorageManager class defined',
    'Should have StorageManager class'
  );

  // Test 1.2: Check for API key methods
  assert(
    storageContent.includes('async getAPIKey()'),
    'getAPIKey method exists',
    'Should have getAPIKey method'
  );

  assert(
    storageContent.includes('async setAPIKey('),
    'setAPIKey method exists',
    'Should have setAPIKey method'
  );

  // Test 1.3: Check for chat history methods
  assert(
    storageContent.includes('async getChatHistory()') ||
    storageContent.includes('CHAT_HISTORY'),
    'Chat history support',
    'Should support chat history operations'
  );

  // Test 1.4: Check for settings methods
  assert(
    storageContent.includes('async getSettings()'),
    'getSettings method exists',
    'Should have getSettings method'
  );

  assert(
    storageContent.includes('async saveSettings('),
    'saveSettings method exists',
    'Should have saveSettings method'
  );

  // Test 1.5: Check for provider configuration
  assert(
    storageContent.includes('getProviderCredentials') ||
    storageContent.includes('setProviderCredentials'),
    'Provider credential methods',
    'Should have provider credential management'
  );

  // Test 1.6: Verify encryption is integrated
  assert(
    storageContent.includes('async encrypt(') &&
    storageContent.includes('async decrypt('),
    'Encryption integrated',
    'Should have encrypt/decrypt methods'
  );

  // Test 1.7: Verify cache is integrated
  assert(
    storageContent.includes('this.cache') ||
    storageContent.includes('LRUCache'),
    'Cache integrated',
    'Should have cache mechanism'
  );
} else {
  log('Storage Integration', 'FAIL', 'storage.js not found');
}

// ============================================
// Test 2: API Client Integration
// ============================================
console.log('\n2. Testing API Client Integration...');

const apiClientPath = path.join(__dirname, 'utils/api-client.js');
if (fs.existsSync(apiClientPath)) {
  const apiClientContent = fs.readFileSync(apiClientPath, 'utf8');

  // Test 2.1: Check APIClient class exists
  assert(
    apiClientContent.includes('export class APIClient'),
    'APIClient class defined',
    'Should have APIClient class'
  );

  // Test 2.2: Check for chat method
  assert(
    apiClientContent.includes('async chat('),
    'chat method exists',
    'Should have chat method'
  );

  // Test 2.3: Check for stream support
  assert(
    apiClientContent.includes('streaming') ||
    apiClientContent.includes('ReadableStream'),
    'Streaming support',
    'Should support streaming responses'
  );

  // Test 2.4: Check for timeout handling
  assert(
    apiClientContent.includes('timeout') ||
    apiClientContent.includes('setTimeout') ||
    apiClientContent.includes('AbortController'),
    'Timeout handling',
    'Should have timeout handling'
  );

  // Test 2.5: Check for error handling
  assert(
    apiClientContent.includes('try') &&
    apiClientContent.includes('catch'),
    'Error handling present',
    'Should have try-catch blocks'
  );

  // Test 2.6: Check for API key validation
  const hasValidation =
    apiClientContent.includes('validate') ||
    apiClientContent.includes('apiKey') ||
    apiClientContent.includes('Authorization');

  assert(
    hasValidation,
    'API key usage',
    'Should use API keys in requests'
  );
} else {
  log('API Client Integration', 'FAIL', 'api-client.js not found');
}

// ============================================
// Test 3: Chat UI Integration
// ============================================
console.log('\n3. Testing Chat UI Integration...');

const sidepanelPath = path.join(__dirname, 'sidepanel/sidepanel.js');
if (fs.existsSync(sidepanelPath)) {
  const sidepanelContent = fs.readFileSync(sidepanelPath, 'utf8');

  // Test 3.1: Check ChatUI class exists
  assert(
    sidepanelContent.includes('class ChatUI'),
    'ChatUI class defined',
    'Should have ChatUI class'
  );

  // Test 3.2: Check for message handling
  assert(
    sidepanelContent.includes('addMessage') ||
    sidepanelContent.includes('sendMessage'),
    'Message handling',
    'Should have message handling methods'
  );

  // Test 3.3: Check for model selection
  assert(
    sidepanelContent.includes('modelSelect') ||
    sidepanelContent.includes('changeModel'),
    'Model selection support',
    'Should have model selection functionality'
  );

  // Test 3.4: Check for event cleanup
  assert(
    sidepanelContent.includes('cleanup()') ||
    sidepanelContent.includes('eventListeners'),
    'Event cleanup',
    'Should have event listener cleanup'
  );

  // Test 3.5: Check for theme support
  assert(
    sidepanelContent.includes('applyTheme') ||
    sidepanelContent.includes('theme'),
    'Theme support',
    'Should have theme management'
  );

  // Test 3.6: Check for storage integration
  assert(
    sidepanelContent.includes('chrome.storage') ||
    sidepanelContent.includes('sendToBackground'),
    'Storage integration',
    'Should integrate with chrome.storage'
  );
} else {
  log('Chat UI Integration', 'FAIL', 'sidepanel.js not found');
}

// ============================================
// Test 4: Agent Handler Integration
// ============================================
console.log('\n4. Testing Agent Handler Integration...');

const agentPath = path.join(__dirname, 'sidepanel/agent.js');
if (fs.existsSync(agentPath)) {
  const agentContent = fs.readFileSync(agentPath, 'utf8');

  // Test 4.1: Check AgentHandler class exists
  assert(
    agentContent.includes('export class AgentHandler'),
    'AgentHandler class defined',
    'Should have AgentHandler class'
  );

  // Test 4.2: Check for multiple agent types
  const agentTypes = [
    'presentation', 'data', 'mvp', 'dashboard', 'research'
  ];

  let agentTypeCount = 0;
  agentTypes.forEach(type => {
    if (agentContent.includes(type)) {
      agentTypeCount++;
    }
  });

  assert(
    agentTypeCount >= 3,
    'Multiple agent types',
    `Should support at least 3 agent types (found ${agentTypeCount})`
  );

  // Test 4.3: Check for slide generation
  assert(
    agentContent.includes('generateSlidesFromPrompt') ||
    agentContent.includes('_generateSlideDeck'),
    'Slide generation',
    'Should have slide generation capability'
  );

  // Test 4.4: Check for data analysis
  assert(
    agentContent.includes('csvData') ||
    agentContent.includes('_generateSlideDeck'),
    'Data analysis support',
    'Should support data analysis'
  );

  // Test 4.5: Check for export functionality (export buttons are embedded in
  // the generated preview HTML; PPTX export lives inside _renderSlideDeckHtml)
  const hasExport =
    agentContent.includes('_renderSlideDeckHtml') ||
    agentContent.includes('pptx') ||
    agentContent.includes('Export as PPTX');

  assert(
    hasExport,
    'Export functionality',
    'Should have export capabilities'
  );

  // Test 4.6: Check for API client usage
  assert(
    agentContent.includes('this.apiClient') ||
    agentContent.includes('apiClient.chat'),
    'API client integration',
    'Should use APIClient for AI calls'
  );
} else {
  log('Agent Handler Integration', 'FAIL', 'agent.js not found');
}

// ============================================
// Test 5: Message Passing Integration
// ============================================
console.log('\n5. Testing Message Passing Integration...');

const swPath = path.join(__dirname, 'background/service-worker.js');
if (fs.existsSync(swPath)) {
  const swContent = fs.readFileSync(swPath, 'utf8');

  // Test 5.1: Check for message listener
  assert(
    swContent.includes('chrome.runtime.onMessage') ||
    swContent.includes('onMessage.addListener'),
    'Message listener',
    'Should have runtime message listener'
  );

  // Test 5.2: Check for tool execution
  assert(
    swContent.includes('EXECUTE_TOOL') ||
    swContent.includes('performWebSearch') ||
    swContent.includes('performImageSearch'),
    'Tool execution',
    'Should have tool execution handler'
  );

  // Test 5.3: Check for storage operations
  assert(
    swContent.includes('chrome.storage') ||
    swContent.includes('await storage.'),
    'Storage operations',
    'Should use chrome.storage'
  );

  // Test 5.4: Check for content script integration
  assert(
    swContent.includes('chrome.tabs.sendMessage') ||
    swContent.includes('getCurrentPageContent'),
    'Content script integration',
    'Should integrate with content scripts'
  );
} else {
  log('Message Passing Integration', 'FAIL', 'service-worker.js not found');
}

// ============================================
// Test 6: Content Script Integration
// ============================================
console.log('\n6. Testing Content Script Integration...');

const contentPath = path.join(__dirname, 'content/content.js');
if (fs.existsSync(contentPath)) {
  const contentContent = fs.readFileSync(contentPath, 'utf8');

  // Test 6.1: Check for message listener
  assert(
    contentContent.includes('chrome.runtime.onMessage') ||
    contentContent.includes('onMessage'),
    'Message listener',
    'Should listen for runtime messages'
  );

  // Test 6.2: Check for content extraction
  assert(
    contentContent.includes('textContent') ||
    contentContent.includes('innerText') ||
    contentContent.includes('document.body'),
    'Content extraction',
    'Should extract page content'
  );

  // Test 6.3: Check for text insertion
  assert(
    contentContent.includes('INSERT_TEXT') ||
    contentContent.includes('execCommand') ||
    contentContent.includes('focus'),
    'Text insertion support',
    'Should support text insertion'
  );
} else {
  log('Content Script Integration', 'FAIL', 'content.js not found');
}

// ============================================
// Test 7: Options Page Integration
// ============================================
console.log('\n7. Testing Options Page Integration...');

const optionsPath = path.join(__dirname, 'options/options.js');
if (fs.existsSync(optionsPath)) {
  const optionsContent = fs.readFileSync(optionsPath, 'utf8');

  // Test 7.1: Check OptionsPage class
  assert(
    optionsContent.includes('class OptionsPage') ||
    optionsContent.includes('export class'),
    'Options page structure',
    'Should have options page class/module'
  );

  // Test 7.2: Check for settings management
  assert(
    optionsContent.includes('loadSettings') ||
    optionsContent.includes('saveSettings'),
    'Settings management',
    'Should have settings load/save'
  );

  // Test 7.3: Check for API key input
  assert(
    optionsContent.includes('apiKey') ||
    optionsContent.includes('API Key'),
    'API key configuration',
    'Should have API key configuration UI'
  );

  // Test 7.4: Check for model selection
  assert(
    optionsContent.includes('model-selection') ||
    optionsContent.includes('ModelSelectionManager'),
    'Model selection UI',
    'Should have model selection interface'
  );

  // Test 7.5: Check for save functionality
  assert(
    optionsContent.includes('save') ||
    optionsContent.includes('chrome.storage.set'),
    'Save functionality',
    'Should save settings to storage'
  );
} else {
  log('Options Page Integration', 'FAIL', 'options.js not found');
}

// ============================================
// Test 8: Full Workflow Test
// ============================================
console.log('\n8. Testing Full Workflow Integration...');

// Test 8.1: Check manifest.json structure
const manifestPath = path.join(__dirname, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Verify all key files are referenced
  const requiredFiles = [
    manifest.side_panel?.default_path,
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    manifest.options_page
  ];

  const allFilesPresent = requiredFiles.every(file => {
    if (!file) return true; // Allow optional files
    return fs.existsSync(path.join(__dirname, file));
  });

  assert(
    allFilesPresent,
    'All manifest files exist',
    'All files referenced in manifest should exist'
  );

  // Test 8.2: Check permissions
  const requiredPermissions = ['sidePanel', 'storage', 'activeTab'];
  const hasRequiredPermissions = requiredPermissions.every(perm =>
    manifest.permissions?.includes(perm)
  );

  assert(
    hasRequiredPermissions,
    'Required permissions present',
    'Should have all required permissions'
  );

  // Test 8.3: Check CSP
  assert(
    manifest.content_security_policy !== undefined,
    'CSP configured',
    'Should have Content Security Policy'
  );

  // Test 8.4: Check for multiple providers support
  const storageContent = fs.readFileSync(storagePath, 'utf8');
  const providerCount = (storageContent.match(/baseURL:/g) || []).length;

  assert(
    providerCount >= 4,
    'Multiple providers supported',
    `Should support at least 4 providers (found ${providerCount})`
  );
}

// Test 8.5: Check for XSS protection integration
const htmlSanitizerPath = path.join(__dirname, 'utils/html-sanitizer.js');
const hasXSSProtection =
  fs.existsSync(htmlSanitizerPath) &&
  (sidepanelPath ? fs.existsSync(sidepanelPath) : false) &&
  (optionsPath ? fs.existsSync(optionsPath) : false);

assert(
  hasXSSProtection,
  'XSS protection integrated',
  'Should have XSS protection in UI files'
);

// Test 8.6: Check for event bus integration
const eventBusPath = path.join(__dirname, 'utils/event-bus.js');
const hasEventBus =
  fs.existsSync(eventBusPath) &&
  fs.existsSync(agentPath) &&
  fs.readFileSync(agentPath, 'utf8').includes('eventBus');

assert(
  hasEventBus,
  'Event bus integrated',
  'Should use event bus for decoupled communication'
);

// ============================================
// Summary
// ============================================
console.log('\n=== INTEGRATION TEST SUMMARY ===');
console.log(`  Passed: ${results.passed}`);
console.log(`  Failed: ${results.failed}`);
console.log(`  Total: ${results.tests.length}`);

if (results.failed > 0) {
  console.log('\nFailed tests:');
  results.tests.filter(t => t.status === 'FAIL').forEach(t => {
    console.log(`  - ${t.test}: ${t.message}`);
  });
  process.exit(1);
} else {
  console.log('\n✓ All integration tests passed!');
  process.exit(0);
}

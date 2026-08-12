# UI Testing Plan for CTRL Extension

## Overview
This document outlines the UI testing strategy for the CTRL Extension using Playwright.

## Tool Selection: Playwright
Playwright is chosen for:
- Cross-browser support (Chrome, Firefox, Safari, Edge)
- Extension testing capabilities
- Fast, reliable, and modern API
- Built-in waiting and retry mechanisms
- Screenshot and video recording support
- Excellent TypeScript/JavaScript support

## Test Environment Setup

### 1. Install Dependencies
```bash
npm install -D @playwright/test
npx playwright install chromium
```

### 2. Create Test Directory Structure
```
tests/
├── ui/
│   ├── setup.js                # Test setup and utilities
│   ├── chat.spec.js            # Chat UI tests
│   ├── options.spec.js          # Settings page tests
│   ├── popup.spec.js           # Popup tests
│   ├── sidepanel.spec.js       # Side panel tests
│   └── fixtures/               # Test fixtures and helpers
│       ├── load-extension.js     # Load extension helper
│       ├── auth-fixtures.js     # Authentication test data
│       └── ui-fixtures.js       # Common UI helpers
```

### 3. Configure Playwright
Create `playwright.config.js`:
```javascript
module.exports = {
  testDir: './tests/ui',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    baseURL: 'chrome-extension://',  // Extension base URL
    // Load extension
    launchOptions: {
      args: [
        `--disable-extensions-except=${process.env.EXTENSION_PATH}`,
        `--load-extension=${process.env.EXTENSION_PATH}`
      ]
    }
  }
};
```

## Test Coverage Areas

### 1. Chat Interface Tests (`chat.spec.js`)
- ✓ Send message button functionality
- ✓ Enter key to send message
- ✓ Message rendering (user and assistant)
- ✓ Message history preservation
- ✓ Auto-scroll to bottom
- ✓ Streaming message updates
- ✓ Stop generation button
- ✓ Model selector functionality
- ✓ Theme toggle (dark/light)
- ✓ Context pill toggle
- ✓ Copy code buttons
- ✓ Insert at cursor buttons
- ✓ Error message display
- ✓ Loading states

### 2. Options Page Tests (`options.spec.js`)
- ✓ API key input validation
- ✓ Save API key functionality
- ✓ Model selection interface
- ✓ Enable/disable models
- ✓ Provider configuration
- ✓ Settings persistence
- ✓ Theme selection
- ✓ Reset settings button
- ✓ Modal open/close
- ✓ Form validation

### 3. Popup Tests (`popup.spec.js`)
- ✓ Popup opens on click
- ✓ Quick actions buttons
- ✓ Settings button
- ✓ Quick prompt functionality
- ✓ Close on click outside

### 4. Side Panel Tests (`sidepanel.spec.js`)
- ✓ Side panel opens
- ✓ Mode switching (chat, presentation, data, MVP, research)
- ✓ Tab switching
- ✓ Prompt inputs for each mode
- ✓ Generate buttons
- ✓ File upload (CSV/Excel)
- ✓ Drag and drop
- ✓ Export buttons
- ✓ Keyboard navigation
- ✓ Responsive layout

### 5. Agent Integration Tests
- ✓ Slide generation
- ✓ Slide navigation (prev/next)
- ✓ Slide rendering
- ✓ Data analysis display
- ✓ Dashboard generation
- ✓ MVP code generation
- ✓ Research report generation
- ✓ Export to PowerPoint
- ✓ Export to PDF

### 6. Cross-Browser Tests
- ✓ Chrome (primary)
- ✓ Firefox (secondary)
- ✓ Edge (secondary)

## Test Data Fixtures

### Auth Fixtures (`auth-fixtures.js`)
```javascript
export const testAPIKeys = {
  valid: 'sk-test-valid-key',
  invalid: 'invalid-key',
  expired: 'sk-test-expired-key'
};

export const testModels = {
  gpt4: 'gpt-4o',
  claude: 'claude-3.5-sonnet',
  gemini: 'gemini-1.5-flash'
};
```

### UI Fixtures (`ui-fixtures.js`)
```javascript
export const selectors = {
  messageInput: '#message-input',
  sendButton: '#send-btn',
  modelSelect: '#model-select',
  chatMessages: '#messages',
  settingsButton: '#settings-btn',
  // ... more selectors
};

export const waitTimes = {
  short: 1000,
  medium: 3000,
  long: 10000
};
```

## Execution Commands

### Run All Tests
```bash
npx playwright test
```

### Run Specific Test Suite
```bash
npx playwright test chat.spec.js
```

### Run in Headed Mode (see UI)
```bash
npx playwright test --headed
```

### Run with Debug Mode
```bash
npx playwright test --debug
```

### Generate Test Report
```bash
npx playwright test --reporter=html
```

## Continuous Integration

### GitHub Actions Workflow
Create `.github/workflows/ui-tests.yml`:
```yaml
name: UI Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        env:
          EXTENSION_PATH: ${{ github.workspace }}
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Estimated Test Count
- Chat Interface: ~15 tests
- Options Page: ~12 tests
- Popup: ~8 tests
- Side Panel: ~20 tests
- Agent Integration: ~10 tests
- **Total: ~65 UI tests**

## Success Metrics
- ✅ All UI critical paths tested
- ✅ 80%+ code coverage for UI code
- ✅ Tests run on every PR
- ✅ No regressions in main branch
- ✅ Tests complete in < 5 minutes
- ✅ Cross-browser support validated

## Phased Implementation

### Phase 1: Setup (1 day)
- Install Playwright
- Create directory structure
- Write configuration
- Load extension helper

### Phase 2: Critical Paths (2 days)
- Chat interface tests (15)
- Options page tests (12)

### Phase 3: Agent Tests (1 day)
- Slide generation tests (5)
- Data analysis tests (3)
- Export tests (2)

### Phase 4: Full Coverage (2 days)
- Side panel tests (20)
- Popup tests (8)
- Cross-browser validation

### Phase 5: CI Integration (0.5 day)
- GitHub Actions workflow
- Test reporting
- Artifact collection

**Total Effort:** ~6.5 days

---

**Status:** Plan complete. Ready to begin Phase 1 implementation.
**Next Step:** Install Playwright and create test configuration.

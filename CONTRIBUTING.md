# Contributing

Thank you for your interest in CTRL Extension! This document covers development
setup, conventions, and how to verify your changes pass CI.

## Setup

```bash
git clone <repo>
cd CTRL\ Extension
npm install
```

Node 16+ required. No build step — the extension runs directly from source.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run lint` | Static checks (no stray console.log, version sync, XSS patterns) |
| `npm test` | Run all unit tests (Node `--test`) |
| `npm run test:unit` | Same as `npm test` |
| `npm run test:legacy-unit` | Pre-existing legacy tests |
| `npm run test:ui` | Run Playwright E2E in a headed Chromium session |
| `npm run test:ui:headed` | E2E with browser visible |
| `npm run package` | Build the Chrome Web Store ZIP |
| `npm run package:all` | Build Chrome, Firefox, and Safari-source ZIPs |
| `npm run validate:distribution` | Validate all target manifests and required assets |
| `npm run verify` | Lint + unit tests in one shot |

## E2E testing note

Chrome MV3 extensions **cannot** be loaded in classic `--headless` mode (the
extension service worker never registers, so `chrome.runtime.sendMessage()` is
unreachable). On Windows you **must** run:

```bash
npm run test:ui:headed
```

CI wraps the same headed command with `xvfb-run` on Linux. Do not use classic
headless mode for extension E2E; the extension service worker may not register.

## Conventions

- **No `console.log`** in production files (`scripts/lint.js` enforces)
- **MarkDOM access**: when rendering user-controlled data into `innerHTML`,
  wrap each interpolated value in `escapeHtml(text)` (from `utils/html-sanitizer.js`)
- **Event listeners**: use `this.addTrackedListener(...)` instead of
  `.addEventListener(...)` directly — tracked listeners are cleaned up on unload
- **Tests**: every new module gets a `tests/unit/<name>.test.js` file using Node's
  built-in `node:test` and `node:assert/strict`
- **Versioning**: when bumping, update BOTH `manifest.json` and `package.json`

## File Layout

```
sidepanel/      — main side-panel UI (sidepanel.js, sidebar.js, code-pane.js, ...)
popup/          — toolbar popup mini-interface
options/        — settings page
background/     — service worker (MV3)
content/        — content script (page context)
utils/          — shared modules (storage, api-client, html-sanitizer, ...)
tests/
  unit/         — Node `--test` tests
  ui/           — Playwright E2E specs (setup.js exports test fixtures)
scripts/
  lint.js       — production-readiness checks
  package.js    — zero-dependency extension packager
.github/
  workflows/    — CI and tagged-release workflows
platform/       — browser API bridge and target manifests
safari/         — Safari conversion and validation notes
store-assets/   — store copy, permissions, disclosure, screenshot guidance
```

## Pull Request Checklist

- [ ] `npm run verify` passes locally
- [ ] New public functions/modules have unit tests
- [ ] If you changed UI: add Playwright coverage in `tests/ui/`
- [ ] Update `CHANGELOG.md` if user-visible
- [ ] Manifest and package.json versions stay in sync

## Architecture Notes

- **Streaming**: `sidepanel/streaming-message.js` wraps `formatContent()`.
  For non-streaming APIs, `transcode()` simulates incremental rendering.
- **Storage**: `utils/storage.js` is the single source of truth. Encrypted
  API keys live under `provider_credentials`.
- **Model routing**: `utils/api-client.js` auto-detects Anthropic-shaped
  providers (via `anthropicCompatible` flag) and bridges headers + tool format.
- **MCP**: external tools via `utils/mcp-client.js` (JSON-RPC over HTTP/SSE).

## Reporting Issues

Use GitHub Issues. Include:
- Browser version
- Steps to reproduce
- Console output (Errors → Help → Toggle Developer Tools, then Console tab)

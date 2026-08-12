# Changelog

All notable changes to CTRL Extension are documented here. Versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026

### Added
- **Streaming responses** with transcode fallback for non-streaming APIs
- **Prompt snippets** — type `/` to expand built-in templates
- **Example conversations** auto-seeded on first run
- **Spending dashboard** with CSV export
- **Conversation search** with date range + tag filters
- **Resizable panel** (settings page)
- **Focus trap** for sidepanel/modals (Tab cycling, Escape handling)
- **Inline error recovery** — Retry button on failed assistant messages
- **Unified toast system** with stacked notifications
- **Sidebar backdrop dimming** for clarity
- **Action button stagger animation** on hover
- **`prefers-reduced-motion`** media query support
- **Cleanup on unload** — event listeners removed on `beforeunload`/`pagehide`
- **Unit tests** for streaming-message, snippet-store, focus-trap, html-sanitizer
- **Playwright E2E specs** for snippets, sidebar, command palette, code pane, popup, accessibility
- **CI workflow** (`.github/workflows/ci.yml`) — lint + unit + E2E + build
- **Packaging script** — zero-dependency ZIP for Chrome Web Store

### Fixed
- **Version sync** between `manifest.json` and `package.json`
- **Infinite recursion** in showToast/showNotification when container missing
- **XSS in image lightbox** — dataUrl now passed via DOM API, not innerHTML
- **XSS in attachment rendering** — dataUrl, file.name escaped
- **XSS in model-select options** — m.id, m.name escaped
- **XSS in command palette** — category and icon escaped
- **Marked v15 renderer API** — `renderer.code` now extracts from token object
- **Snippets integration** — Enter/Tab select items, autocomplete hides after click
- **Null safety** in `addTrackedListener` (no more crash on missing element)
- **JSON.parse** in api-client wrapped in try/catch
- **Onboarding title escaping** in attributes
- **Type safety** in popup escapeHtml

### Changed
- **Design system unified** — removed duplicate `:root` blocks, canonicalized 230+ variable references
- **Chat experience** — autoResize flicker fixed, scrollToBottom in rAF, noAnimate for history
- **Popup redesigned** — inline result preview, follow-up input, quick actions with feedback
- **Sidepanel.js** event listeners tracked for proper cleanup

### Distribution
- Added Chrome, Firefox, and Safari-target manifests
- Added optional custom-provider host permission requests
- Added localized manifest metadata (`_locales/en`)
- Added reproducible target packaging and tagged GitHub releases with SHA-256 sums
- Added store listing copy, permission justifications, data-use disclosure, and
  1280x800 store screenshots

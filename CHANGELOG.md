# Changelog

All notable changes to CTRL Extension are documented here. Versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026

### Security
- **Provider API keys were stored in plaintext** — `setProviderCredentials()` /
  `getProviderCredentials()` in `utils/storage.js` (the path used by the
  onboarding wizard and the service worker) and a second, separate copy of
  the same logic inline in `options/options.js` (the path the Settings page
  actually calls when you click Save) both wrote `{ apiKey, baseURL }`
  straight to `chrome.storage.local` with no encryption, despite
  `setAPIKey()`/`getAPIKey()` elsewhere in the same file already doing this
  correctly with AES-256-GCM. Both paths now encrypt on write and decrypt on
  read through that same Web Crypto path. Reading back a key saved by a
  pre-fix build still works — `decrypt()` already recognized plaintext and
  returned it as-is — so no migration step is needed; it's re-encrypted the
  next time it's saved.
- **Settings page "Save provider" silently corrupted other providers'
  credentials** — found while fixing the above. The Settings page's local
  storage helper read `chrome.storage.local.get('provider_credentials')`
  and used the raw `{ provider_credentials: {...} }` result directly instead
  of unwrapping it (every other caller in the file does), then merged the
  new provider's key into that wrapper and wrote it back. Saving credentials
  for a second provider nested the first provider's entry one level deeper
  and out of reach of every read path, so it silently reverted to "Not
  configured" — and the "Saved Providers" list was unaffected only in that
  it was already permanently broken (`Object.entries()` on the wrapper never
  produced real entries, so it always rendered "No saved providers yet").

### Fixed
- **Chat input auto-resize** — the textarea never reset its height before
  measuring content, so it could grow but never shrink back down, and a few
  code paths that inserted text programmatically (quick-action prompts, the
  popup's quick-question handoff) never triggered a resize at all, leaving
  longer text visually clipped in a too-small box.
- **Missing "Set up your API key" banner** — the side panel referenced a
  `setup-banner` element that didn't exist in its HTML (only in the popup),
  so the banner — and one of the paths back to Settings — silently never
  rendered. Restored it; the header gear icon has always worked independently.
- **New-chat dropdown** — the outside-click handler checked a CSS class that
  didn't exist on the menu, which happened to work by luck of listener
  ordering rather than by being correct; fixed to check the real selector.
- **Prompt snippets returned zero results on every fresh install** — the
  snippet store's `load()` only ever merged built-ins into the list when a
  matching custom override already existed in storage, so with empty storage
  (the normal first-run case) all 8 built-in snippets silently vanished.
- **First-run example conversations were written in the wrong shape** —
  seeded as an array while every other code path treats `conversations` as
  an object keyed by name, which broke "already seeded" detection and could
  have silently dropped a real saved conversation on a later write.
- **HTML sanitizer fallback** (used outside a DOM context, e.g. tests) fell
  back to blanket-escaping instead of actually stripping dangerous tags —
  not an active vulnerability since the real DOM path always uses DOMPurify,
  but the fallback now does real tag/attribute/protocol stripping so it
  matches its documented contract and the test suite is green again
  (280/280 unit tests, was 253/280).

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

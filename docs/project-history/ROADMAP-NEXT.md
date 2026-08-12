# CTRL Extension — Roadmap: What's Still Missing
_Compiled 2026-07-27, after six rounds of fixes documented in `issues.md`. This supersedes
`ROADMAP-CERTIFIED.md` (fully executed) as the forward-looking plan._

_Updated 2026-07-28: items #4 (partial — unit coverage added, Playwright/browser/network still
open), #5, #6, #7, and #10 below are now done — see "Round 7" in `issues.md`. Left in place
below rather than deleted, with an inline note on each, so the record of what was found and
fixed isn't lost. Still open: #1, #2, #3 (all require a real browser/network, unavailable in
this sandbox), #8, #9, #11, #12, #13 (partially addressed — see note), #14 (partially
addressed — see note)._

## How this was built
Six rounds this session found and fixed ~30 real bugs — critical app-breaking crashes, dead
UI, a completely non-functional MiniMax/Anthropic provider bridge, and a model-selection
pipeline that was broken in five independent places at once. None of that work added
regression tests, none of it was verified against real provider APIs or a real browser (this
environment has neither), and several items were explicitly deferred as out of scope. This
roadmap is the honest list of what that leaves undone — not a wishlist, a punch list.

---

## P0 — Verify before shipping (nothing below matters if these are wrong)

### 1. No real-browser verification of anything fixed this session
Every fix in `issues.md` was verified by static analysis (`node --check`), unit tests, and
standalone Node scripts exercising pure logic — never by actually clicking through the
extension in Chrome, because this environment has no browser. Load it unpacked and manually
walk through: opening the side panel, adding an API key for at least one OpenAI-shaped
provider and one Anthropic-shaped provider, selecting models, sending a message, using the
browser agent on a real page, and triggering `/mvp`, `/research`, `/slides`.

### 2. No real-network verification of any provider integration
The MiniMax domain/endpoint fix (Round 4) was based on current public documentation, not a
live API call — same for the Google auth-header fix and the Anthropic tool-bridging logic.
Confirm with real API keys: MiniMax (both default OpenAI-compatible mode and the opt-in
Anthropic-compatible mode), native Anthropic tool-calling end-to-end (a multi-turn tool loop,
not just a single call), and Google Gemini's non-streaming `chat()` path specifically (the
auth-header fix in Round 4 was never exercised against the real API).

### 3. `npm run test:ui` (Playwright) has never run
Flagged as OPEN-03 since Round 1 and still true — no Chromium in this sandbox. `tests/ui/*.spec.js`
exist and should run locally before any release.

### 4. Zero regression tests for six rounds of fixes — PARTIALLY DONE (2026-07-28)
Unit coverage added for the three highest-leverage bug classes named below (50 new tests —
see Round 7 in `issues.md`). Playwright (`test:ui`), real-browser, and real-network
verification (items #1–#3 above) are still open; this only closes the "logic has no test"
gap, not the "never run against a real browser/API" gap.

Every bug fixed this session — the `storage.PROVIDERS[provider]` crash, the `.includes()` on
a boolean crash, the `ENABLED_MODELS` missing storage key, the Anthropic tool-bridging, the
model-ID validation regexes — has no accompanying unit test. Nothing stops any of them from
silently regressing. Highest-leverage next step: add `tests/unit/` coverage for
`ModelSelectionManager` ↔ `storage.getEnabledModels()` consistency, `api-client.js`'s
Anthropic-shaped request/response bridging, and `model-validator.js`'s prefix-pattern
generator, since those are exactly the classes of bug that took multiple rounds to find.

---

## P1 — Known architecture debt (not broken today, but this is how every bug this session started)

### 5. Duplicate data sources still exist — DONE (2026-07-28)
`options.js`'s local `STORAGE_KEYS`/`RECOMMENDED_MODELS` consolidated into `storage.js`
imports; the drifted, partly-nonexistent model IDs in the old local copy were corrected in
the process. See Round 7 in `issues.md`.

Round 5/6 removed `PROVIDER_BASE_URLS` and `MODEL_PROVIDER_MAP` (dead duplicates of
`utils/storage.js`'s `PROVIDERS` that had drifted stale). `options/options.js` still keeps
its own local `STORAGE_KEYS` and `RECOMMENDED_MODELS` objects instead of importing from
`storage.js` — currently consistent, but nothing enforces that, and this is the exact pattern
(a second, independently-editable copy of the same data) that caused the MiniMax domain bug,
the `MODEL_PROVIDER_MAP` staleness, and contributed to the `ENABLED_MODELS` key gap.
Consolidate to single-source imports.

### 6. `consent-manager.js`'s per-feature gating is unused — DONE (2026-07-28)
Wired real gating for the one actual sensitive action found (page content auto-sent to a
third-party API via the context pill): now requires explicit consent (banner Allow/Not now,
or manually checking the pill) before auto-enabling. Browser-agent destructive actions were
already gated per-action by the separate `action-approval.js` flow. See Round 7 in
`issues.md`.

Round 2/Round 3 wired a passive consent *banner* and a settings-page consent *list*, both
reading/writing `user_consent` directly. But `requestConsent()`/`showConsentModal()` — the
API for gating a specific action behind an explicit consent prompt at the moment it matters
(e.g. first time the browser agent takes a destructive action, first time page content is
sent to a third-party API) — is still never called anywhere. Consent is visible and
manageable now, but nothing in the app actually *requires* it before a sensitive action.

### 7. `streamChat()` doesn't support tool-calling — DONE (2026-07-28)
Rewrote `streamChat()` to mirror `chatWithTools()`'s multi-turn loop while streaming each
turn's text live, reassembling incrementally-delivered tool-call deltas for both OpenAI and
Anthropic SSE shapes. Google's streaming path still has no tool support (never had it even
non-streaming — explicit scope cut, not a regression). See Round 7 in `issues.md`.

Documented as an intentional Round 4 scope cut: tool-calling only works through the
non-streaming `chatWithTools()` path. A user with streaming enabled who triggers a
tool-requiring action gets it — but silently through the non-streaming path, not the
streaming one, meaning no incremental token display during tool use. Fine as a known
limitation; worth fixing if the browser-agent / skills tools are meant to be a headline
feature (they currently are, per `ARCHITECTURE.md`).

### 8. Live model-listing endpoints aren't guaranteed for every provider
Round 6's curated-model-list fallback means the UI no longer breaks when a provider's
`/models` endpoint returns nothing — but it also means that's silently papering over
providers that may never have had a working listing endpoint to begin with (Meta, Groq,
OpenRouter, Alibaba were never individually verified this session). Worth an explicit
per-provider check of which ones actually support live discovery vs. which should just
always use the curated list.

---

## P2 — Real feature gaps

### 9. Slide generation is minimal
`/slides` (built Round 3) generates a flat title+bullets deck via one LLM call and exports to
PPTX with no theming, images, or per-slide editing — functional, not polished. No slide
reordering, no regenerate-single-slide, no template selection.

### 10. No conversation organization beyond a flat list — DONE (2026-07-28)
Added lightweight tags + tag-filter chips (deliberately not folders/nesting — see rationale
in Round 7 of `issues.md`). Also fixed two pre-existing bugs found while wiring this up that
had left the sidebar's conversation list non-functional regardless of tags: `service-worker.js`'s
bulk-save handler was dropping non-listed fields on every save, and `GET_CONVERSATIONS`
returned an object where the UI expected an array.

Sidebar has search, pin, rename, delete, export/import — no folders, tags, or projects. For
users with dozens of saved conversations this doesn't scale.

### 11. No cost/spend visibility
Round 2 added a token-count badge (`~1.2k tokens`), but no dollar-cost estimate per message
or per session, and no per-provider spend tracking despite this being a multi-provider,
bring-your-own-key extension where cost awareness matters more than usual.

### 12. No cross-device sync
Everything lives in `chrome.storage.local` — conversations, settings, API keys (encrypted,
correctly) — none of it syncs across machines. `chrome.storage.sync` has a much smaller quota
and probably isn't right for chat history, but settings/API-key-presence (not the keys
themselves) could reasonably sync.

### 13. Accessibility audit was narrow — PARTIALLY DONE (2026-07-28)
Sidepanel, options, popup, and onboarding got a real ARIA/keyboard/focus pass in Round 7
(dialogs, live regions, focus traps, a fixed keyboard trap on the attachment-remove control, a
contrast fix on `--text-muted`). Not done: sidebar.js's new tag UI got baseline labeling but
not a dedicated audit pass, and no actual screen-reader testing has happened (no browser in
this sandbox) — the fixes are correct per WCAG criteria on paper, not confirmed by ear.

Round 2 fixed contrast on the one theme (noir) that actually failed AA, and added some
keyboard shortcuts (`/` for search, `?` for the cheat-sheet, `Ctrl/Cmd+J`). No full
keyboard-navigation pass, no ARIA-label audit, no screen-reader testing. Given the extension
now has a real design system (`styles/variables.css`, `styles/components.css`), a proper
`design:accessibility-review`-style pass would be cheap relative to what it'd catch.

### 14. Error-surface consistency — PARTIALLY DONE (2026-07-28)
Audited and fixed every found silent-failure path in sidepanel.js, options.js, popup.js, and
onboarding.js (several were genuine "button click does nothing, no console output" bugs — the
same class as Round 6's `useDefaultModels()` crash). Not audited: background/service-worker.js,
cdp-controller.js, and the skills/* execution paths — a full audit would need to cover those
too before calling this fully closed.

Across six rounds, error handling was patched file-by-file as bugs were found (toast here,
`showErrorNotification` there, console-only elsewhere, silently-swallowed exceptions in a few
cases before this session). No single audit of "does every failure path actually reach the
user," which is exactly the class of bug (`useDefaultModels()`'s uncaught exception in Round
6) that hid real problems.

---

## What's explicitly NOT on this list
Everything itemized as "Resolved" across Rounds 1–6 in `issues.md` — critical bugs, the
theme CSS duplication, the design-critique UI/UX gaps (message edit, consent UI, density
setting, shortcuts, mic state, touch targets), the MiniMax/Anthropic provider bridging, and
the five-bug model-selection pipeline — is done and verified to the extent verifiable from a
sandbox with no browser and no network egress to real provider APIs. Re-litigating those
without a new, concrete symptom report would be wasted effort; P0 above is how you'd actually
catch it if one of them regressed.

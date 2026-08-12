# CTRL Extension — Certified Remediation & UI/UX Roadmap
_Certified 2026-07-27. Supersedes plan.md / issues.md / FINAL-REPORT.md for the items below._

## Why this doc exists
plan.md, issues.md, and FINAL-REPORT.md claim 45/48 issues resolved, zero Critical/High open,
and "APPROVED" status. That claim was checked against the live codebase and does not hold.
A separate, more specific review ("Last agent summary.md") flagged 39 concrete bugs with
file/line references. Six of the highest-severity ones were independently re-verified against
the current source in this session:

| Claim | Verified? | Evidence |
|---|---|---|
| `cdp-controller.js toggle()` skips `isAttachableUrl()` check | ✅ Confirmed | `toggle()` (line 145) calls `attach()` directly with no URL guard; `autoAttach()` has the guard, `toggle()` doesn't |
| `/slides` and `/research` commands call methods that don't exist | ✅ Confirmed | `sidepanel.js` calls `agentHandler?.generateSlidesFromPrompt()` and `generateResearchFromPrompt()`; `agent.js` only defines `generateResearch()` (different name/signature) — no `generateSlidesFromPrompt` at all |
| `SAVE_CONVERSATIONS_BULK` has no handler | ✅ Confirmed | `sidebar.js` sends it; `service-worker.js` message switch has no matching `case` |
| Duplicate theme CSS across two files | ✅ Confirmed | `sidepanel.css` still has 61 `[data-theme="..."]` blocks duplicating `themes.css` |
| Timer cleanup gaps | ✅ Confirmed | 63 `setTimeout`/`setInterval` call sites, cleanup not consistently paired |

Given this, the project status is **not** "APPROVED." Treat plan.md/issues.md as stale until
Task 6 (this roadmap's final step) rewrites them.

---

## Priority 0 — App-breaking (fix first)
1. `cdp-controller.js` — `toggle()` must reject/refuse on non-attachable URLs (chrome://, about:, edge://, etc.), matching `autoAttach()`.
2. `sidepanel.js` — `/slides`, `/mvp`, `/research` command handlers call agent methods that don't exist. Either implement the missing `AgentHandler` methods or point the handlers at the real method names. Currently these fail silently (optional chaining swallows the error) and the user sees an infinite loading spinner.
3. `service-worker.js` — add a `case 'SAVE_CONVERSATIONS_BULK'` handler so sidebar pin/rename/delete actually persist.
4. `onboarding.js` — credential save does `chrome.storage.local.set({ provider_credentials: credentials })`, replacing the whole object instead of merging per-provider. Fix to merge.
5. `onboarding.js` — verify the storage key used to save matches the key `storage.getProviderCredentials()` reads.
6. `sidepanel.js` — `loadConversations()` references a `conversationsList` DOM element that was removed with the old modal; guard or delete the dead code path so it can't throw if ever invoked.
7. Theme CSS duplication (61 blocks) between `sidepanel.css` and `themes.css` — consolidate to `themes.css` only.

## Priority 1 — High, fix soon
8. `sidebar.js` still uses native `prompt()`/`confirm()` (lines ~204, ~215) instead of the built `promptDialog`/`confirmDialog` components.
9. Welcome screen not reliably re-appended after loading a conversation then starting new chat.
10. Command autocomplete hides once input exceeds 20 characters — should stay open for any `/`-prefixed input.
11. `/theme dark` sets `data-theme` but never calls `SAVE_SETTINGS` — reverts on reload.
12. Command palette's `loadModels()` is async but not awaited before `buildItems()` — models may be missing on first open.
13. Action-approval flow has no timeout cleanup if the side panel closes mid-approval — promise hangs 30s with no cancel path.
14. Drawer CSS: `transform: translateY(100%)` animation conflicts with `display: none` on the hidden class — close animation gets stuck.
15. Auto-attach fires on every side panel open regardless of the user's `autoAttachEnabled: false` setting.

## Priority 2 — Dead code cleanup
16. `agent.js` methods that reference removed DOM elements (slide workspace) — remove or reconnect.
17. `agent.css` slide-specific styles for the removed agent workspace.
18. Old `loadConversations()`/`loadConversation()` modal-flow leftovers; `conversationsModal`/`conversationsList` element cache entries (always null now).
19. Hidden-but-still-loaded `.agent-loading`, `.agent-workspace`, `.mode-toggle-container` CSS.

## Priority 3 — Theme-system correctness (all 20+ themes)
20. Duplicate `@media (prefers-color-scheme: dark)` block in both `themes.css` and `sidepanel.css`.
21. Synthwave theme: `sidepanel.css` still has low-contrast `#00ffff` text color that was already fixed in `themes.css`.
22. Terminal theme's global `* { border-radius: 0 }` in `sidepanel.css:566` should only be the scoped version now in `themes.css`.
23. Onboarding theme picker shows 8 themes with generic gradients instead of each theme's actual palette.

## Priority 4 — UI/UX enhancements (new, applies to every theme)
24. Copy button on assistant messages (currently only "Insert at Cursor").
25. Regenerate button to retry the last assistant response.
26. Inline edit for sent user messages.
27. Welcome-screen quick actions should auto-send instead of just populating the input.
28. Document keyboard shortcuts in the UI (arrow keys in autocomplete, etc.).
29. Status bar tab title truncation — raise limit past 30 chars or add a tooltip with the full title.
30. Approval queue count indicator on the approval cards themselves, not just the status bar.
31. `/` keyboard shortcut to focus sidebar search.
32. Onboarding wizard: add step dots/labels alongside the progress bar.
33. Command palette: add a "recently used" section.
34. Drawer terminal output: add syntax highlighting (the `highlight.js` lib is already bundled in `lib/`).
35. Keyboard shortcut to toggle the code pane/drawer directly (not just via command palette).
36. Move approval cards so they can't be scrolled out of view below the chat container.
37. Replace the generic "thinking" dots with a mode-aware reasoning indicator.
38. Redundant welcome-screen quick action still labeled "Write Code" — align with the `/code` command naming.

---

## Execution plan
- P0 + P1 fixes: background/, sidepanel core JS — correctness first, no visual changes.
- Theme CSS dedup (P0.7, P3): consolidate into `themes.css`, delete the 61 duplicate blocks from `sidepanel.css`.
- Dead code removal (P2): delete only after confirming nothing else references it.
- UI/UX enhancements (P4): additive, theme-agnostic (use existing CSS variables so all 20+ themes inherit automatically).
- Final step: re-verify each fix against source, then rewrite `issues.md`/`plan.md` to match reality.

# Safari Distribution

Safari is an **experimental compatibility target**, not a drop-in Chrome
build. Safari does not provide Chrome's `sidePanel` or `debugger` APIs, so the
Safari manifest uses the popup/full-page fallback and disables browser-agent
automation. The chat, provider configuration, storage, snippets, and popup
surfaces are the intended first validation scope.

## Requirements

- macOS
- Xcode and the Safari Web Extension converter
- Apple Developer account for signed distribution/App Store submission

## Build

From the extension root:

```bash
npm run package:safari
npm run safari:convert
```

`npm run safari:convert` creates an Xcode project under `safari/CTRL Extension`
by default. Open the generated project in Xcode, select the containing app,
configure signing/team settings, and validate the extension in Safari before
submitting to App Store Connect.

The converter must be run on macOS. The Windows/Linux ZIP is a reproducible
source artifact, not an installable signed Safari application.

## Validation checklist

- [ ] Popup opens the full-page chat fallback
- [ ] Options page can save and reload provider credentials
- [ ] Chat and snippets work without `chrome.sidePanel`
- [ ] Browser Agent is clearly disabled with an actionable message
- [ ] Host permissions and privacy disclosure match App Store metadata
- [ ] App Sandbox, signing, notarization, and App Store review pass

# Distribution Guide

## Browser support

| Surface | Package | Status | Notes |
|---|---|---|---|
| Chrome | `ctrl-extension-chrome-v*.zip` | Primary | Full side panel and Browser Agent support |
| Edge, Brave, Opera, Vivaldi, Arc | Chrome package | Chromium-compatible | Publish the Chrome Web Store package or submit the same ZIP to each store |
| Firefox | `ctrl-extension-firefox-v*.zip` | Experimental | Uses Firefox sidebar + MV2 bootstrap; debugger behavior requires AMO validation |
| Safari | `ctrl-extension-safari-v*.zip` + Xcode project | Experimental | Requires macOS/Xcode; no side panel/debugger; native signing required |

## Build artifacts

```bash
npm run package:chrome
npm run package:firefox
npm run package:safari
npm run package:all
```

All artifacts are written to `dist/` and include only runtime files. Dev files,
tests, CI configuration, scripts, and local credentials are excluded.

## Chrome Web Store

1. Run `npm run verify`.
2. Run `npm run package:chrome`.
3. Review `store-assets/description.md`, `data-disclosure.md`, and
   `permissions-justification.md`.
4. Add final 1280x800 or 640x400 screenshots under `store-assets/screenshots/`.
5. Host `PRIVACY-POLICY.md` at a stable HTTPS URL.
6. Upload the Chrome ZIP in the Developer Dashboard.
7. Complete the permissions, data-use, single-purpose, and reviewer test
   instructions in the listing.

For Firefox AMO, replace the placeholder Gecko ID in
`platform/manifests/manifest.firefox.json` with the ID assigned to the AMO
listing before publishing. The generated Firefox ZIP is an experimental build
until the sidebar, background bootstrap, and debugger paths have passed AMO
review and real-browser testing.

### Stable extension ID

The Chrome Web Store owns the production signing identity. For self-hosted or
enterprise distribution, generate a key once and store the private key outside
the repository:

```bash
npm run generate:key
```

Only add the printed public key to `manifest.json` after the distribution
identity has been chosen. Never commit the private PEM file.

## GitHub releases

Push a version tag such as `v1.1.0` after updating both `package.json` and
`manifest.json`. The release workflow creates Chrome, Firefox, and Safari source
ZIPs plus SHA-256 checksums.

## Store assets

`store-assets/` contains listing copy and reviewer documentation. Screenshots
must be captured from a real headed browser session; generated placeholders are
intentionally not shipped as store evidence.

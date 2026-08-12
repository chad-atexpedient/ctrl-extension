/*
 * Cross-browser WebExtension API bridge.
 *
 * Chrome exposes the API as `chrome`; Firefox and Safari commonly expose it as
 * `browser`. The application uses the Chrome spelling, so this tiny classic
 * script normalizes the namespace before any module code executes.
 */
(function () {
  'use strict'

  if (!globalThis.chrome && globalThis.browser) {
    globalThis.chrome = globalThis.browser
  }

  // Firefox calls the action API browserAction. Keep the rest of the app's
  // badge code working without requiring a second implementation.
  if (globalThis.chrome && !globalThis.chrome.action && globalThis.chrome.browserAction) {
    globalThis.chrome.action = globalThis.chrome.browserAction
  }
})()

/*
 * Firefox MV2 background entry point.
 *
 * Firefox's persistent/background-script model is not identical to Chrome's
 * service worker model. Dynamic import lets the existing module graph load
 * without duplicating the service-worker implementation. This target remains
 * experimental until AMO validation covers debugger and sidebar behavior.
 */
(function () {
  'use strict'

  if (!globalThis.chrome && globalThis.browser) globalThis.chrome = globalThis.browser
  if (globalThis.chrome && !globalThis.chrome.action && globalThis.chrome.browserAction) {
    globalThis.chrome.action = globalThis.chrome.browserAction
  }

  const url = globalThis.chrome?.runtime?.getURL?.('background/service-worker.js')
  if (!url) {
    console.error('[CTRL] Firefox bootstrap could not resolve service worker URL')
    return
  }

  import(url).catch((error) => {
    console.error('[CTRL] Firefox background bootstrap failed:', error)
  })
})()

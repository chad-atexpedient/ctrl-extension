/**
 * Unit tests for background/service-worker.js — the message-routing hub.
 *
 * The module has heavy startup side effects (migrations, side panel setup,
 * listener registration), so these tests extend the chrome mock with the
 * APIs the service worker touches, import the module once, and drive the
 * message router through the onMessage listener it registered at import.
 *
 * Focus: settings round-trip via SAVE_SETTINGS/GET_SETTINGS (merge-on-write)
 * and chat history storage — the storage-backed message types that don't
 * require mocking the network.
 */

import { describe, test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { installChromeMock, uninstallChromeMock } from './helpers/chrome-mock.js'

// The service worker references `self` (worker global) and `window`
// (config-validator feature checks) at import time.
globalThis.self = globalThis
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis
}
if (typeof globalThis.addEventListener !== 'function') {
  globalThis.addEventListener = () => {}
}

// The service worker needs more chrome surface than the base mock provides.
function installServiceWorkerChromeMock() {
  const listeners = []
  const { chromeStub, store } = installChromeMock({
    storage: {
      local: {
        get: (keys, cb) => {
          let out
          if (keys == null) out = { ...store }
          else if (typeof keys === 'string') out = { [keys]: store[keys] }
          else if (Array.isArray(keys)) out = Object.fromEntries(keys.map(k => [k, store[k]]))
          else out = { ...store, ...keys }
          if (cb) {
            queueMicrotask(() => cb(out))
            return
          }
          return Promise.resolve(out)
        },
        set: (items, cb) => {
          Object.assign(store, items)
          if (cb) queueMicrotask(() => cb())
          return Promise.resolve()
        },
        remove: (keys, cb) => {
          const list = Array.isArray(keys) ? keys : [keys]
          for (const k of list) delete store[k]
          if (cb) queueMicrotask(() => cb())
          return Promise.resolve()
        },
        getBytesInUse: (keys, cb) => {
          if (typeof keys === 'function') {
            cb = keys
            keys = null
          }
          const bytes = Buffer.byteLength(JSON.stringify(store), 'utf8')
          if (cb) queueMicrotask(() => cb(bytes))
          return Promise.resolve(bytes)
        }
      },
      onChanged: { addListener: () => {} }
    },
    sidePanel: {
      setOptions: async () => {},
      onOpened: { addListener: () => {} },
      setPanelBehavior: async () => {}
    },
    commands: {
      onCommand: { addListener: () => {} }
    },
    windows: {
      getLastFocused: async () => ({ id: 1 })
    }
  })
  // tabs.onActivated used by auto-attach logic
  chromeStub.tabs.onActivated = { addListener: () => {} }
  chromeStub.tabs.get = async (id) => ({ id, url: 'https://example.com', active: true })
  chromeStub.tabs.query = async () => [{ id: 1, url: 'https://example.com', active: true }]
  chromeStub.runtime.onInstalled = { addListener: () => {} }
  chromeStub.runtime.onStartup = { addListener: () => {} }
  chromeStub.runtime.id = 'test-extension'
  chromeStub.runtime.getManifest = () => ({ version: '1.1.0', name: 'CTRL' })
  // Capture the onMessage listener the service worker registers so tests
  // can drive the router directly.
  chromeStub.runtime.onMessage = {
    addListener: (fn) => { listeners.push(fn) }
  }
  return { chromeStub, store, listeners }
}

const { store, listeners } = installServiceWorkerChromeMock()

// Import the module AFTER installing the mock so its top-level listener
// registration is captured into `listeners`.
const MOD = await import('../../background/service-worker.js')

// Drive a message through the service worker's router the way
// chrome.runtime.sendMessage would. The router registers with the async
// channel pattern: handleMessage(...).then(sendResponse); return true — so
// capture the sendResponse callback and await the actual response.
async function sendMessage(msg) {
  for (const fn of listeners) {
    let resolveResponse
    const responsePromise = new Promise(resolve => { resolveResponse = resolve })
    const ret = fn(msg, { tab: undefined }, resolveResponse)
    if (ret === true) {
      // Async channel: response arrives via sendResponse callback
      const resp = await Promise.race([
        responsePromise,
        new Promise(resolve => setTimeout(() => resolve(undefined), 100))
      ])
      if (resp !== undefined) return resp
    } else if (ret !== undefined) {
      return ret
    }
  }
  return undefined
}

function resetStore() {
  for (const k of Object.keys(store)) delete store[k]
}

describe('service-worker: settings routing', () => {
  beforeEach(() => { resetStore() })
  afterEach(() => { resetStore() })

  test('GET_SETTINGS returns merged defaults when nothing stored', async () => {
    const resp = await sendMessage({ type: 'GET_SETTINGS' })
    assert.ok(resp && typeof resp === 'object')
    assert.ok('temperature' in resp)
  })

  test('SAVE_SETTINGS then GET_SETTINGS round-trips the stored values', async () => {
    await sendMessage({ type: 'SAVE_SETTINGS', settings: { temperature: 0.2, theme: 'nebula' } })
    const resp = await sendMessage({ type: 'GET_SETTINGS' })
    assert.equal(resp.temperature, 0.2)
    assert.equal(resp.theme, 'nebula')
  })

  test('SAVE_SETTINGS merges instead of clobbering unowned keys', async () => {
    await sendMessage({ type: 'SAVE_SETTINGS', settings: { webSearchEnabled: false, autoAttachEnabled: true } })
    // A partial save (e.g. options form) that doesn't know those keys
    await sendMessage({ type: 'SAVE_SETTINGS', settings: { temperature: 0.5 } })
    const resp = await sendMessage({ type: 'GET_SETTINGS' })
    assert.equal(resp.webSearchEnabled, false, 'webSearchEnabled survives partial save')
    assert.equal(resp.autoAttachEnabled, true, 'autoAttachEnabled survives partial save')
  })
})

describe('service-worker: chat history routing', () => {
  beforeEach(() => { resetStore() })
  afterEach(() => { resetStore() })

  test('GET_CHAT_HISTORY returns [] when empty', async () => {
    const resp = await sendMessage({ type: 'GET_CHAT_HISTORY' })
    assert.deepEqual(resp, [])
  })

  test('IMPORT_CHAT_HISTORY then GET_CHAT_HISTORY round-trips', async () => {
    const history = [
      { role: 'user', content: 'hi', timestamp: 1 },
      { role: 'assistant', content: 'hello', timestamp: 2 }
    ]
    const resp = await sendMessage({ type: 'IMPORT_CHAT_HISTORY', history })
    assert.equal(resp.success, true)
    const loaded = await sendMessage({ type: 'GET_CHAT_HISTORY' })
    assert.deepEqual(loaded, history)
  })

  test('CLEAR_HISTORY empties stored history', async () => {
    await sendMessage({ type: 'IMPORT_CHAT_HISTORY', history: [{ role: 'user', content: 'x', timestamp: 1 }] })
    await sendMessage({ type: 'CLEAR_HISTORY' })
    const loaded = await sendMessage({ type: 'GET_CHAT_HISTORY' })
    assert.deepEqual(loaded, [])
  })

  test('NEW_CHAT resets history', async () => {
    await sendMessage({ type: 'IMPORT_CHAT_HISTORY', history: [{ role: 'user', content: 'x', timestamp: 1 }] })
    await sendMessage({ type: 'NEW_CHAT', saveCurrent: false })
    const loaded = await sendMessage({ type: 'GET_CHAT_HISTORY' })
    assert.deepEqual(loaded, [])
  })
})

describe('service-worker: conversations routing', () => {
  beforeEach(() => { resetStore() })
  afterEach(() => { resetStore() })

  test('GET_CONVERSATIONS returns [] when empty', async () => {
    const resp = await sendMessage({ type: 'GET_CONVERSATIONS' })
    assert.deepEqual(resp, [])
  })

  test('SAVE_CONVERSATION then GET_CONVERSATIONS round-trips', async () => {
    await sendMessage({ type: 'SAVE_CONVERSATION', name: 'My Chat', history: [{ role: 'user', content: 'a', timestamp: 1 }] })
    const resp = await sendMessage({ type: 'GET_CONVERSATIONS' })
    assert.equal(resp.length, 1)
    assert.equal(resp[0].name, 'My Chat')
  })

  test('SAVE_CONVERSATIONS_BULK replaces the whole map', async () => {
    await sendMessage({ type: 'SAVE_CONVERSATION', name: 'Old', history: [] })
    const bulk = [
      { name: 'One', history: [{ role: 'user', content: '1', timestamp: 1 }] },
      { name: 'Two', history: [{ role: 'user', content: '2', timestamp: 2 }] }
    ]
    const resp = await sendMessage({ type: 'SAVE_CONVERSATIONS_BULK', conversations: bulk })
    assert.equal(resp.count, 2)
    const loaded = await sendMessage({ type: 'GET_CONVERSATIONS' })
    assert.equal(loaded.length, 2)
    assert.ok(!loaded.some(c => c.name === 'Old'))
  })

  test('unknown message type returns an error', async () => {
    const resp = await sendMessage({ type: 'TOTALLY_UNKNOWN_TYPE' })
    assert.ok(resp.error)
  })
})

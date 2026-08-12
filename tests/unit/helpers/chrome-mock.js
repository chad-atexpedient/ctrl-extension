/**
 * Test helper: install an in-memory implementation of the Chrome extension
 * APIs that conversation-memory.js, mcp-client.js, and storage.js touch.
 * Call this in beforeEach of any test that needs to exercise modules that
 * import chrome.* APIs at module load time.
 */
export function installChromeMock (overrides = {}) {
  const store = {}
  const alarms = []
  const listeners = []
  const messageListeners = []
  const tabs = []

  const chromeStub = {
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
          const selected = keys == null
            ? store
            : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, store[key]]))
          const bytes = Buffer.byteLength(JSON.stringify(selected), 'utf8')
          if (cb) queueMicrotask(() => cb(bytes))
          return Promise.resolve(bytes)
        }
      }
    },
    runtime: {
      lastError: null,
      sendMessage: (msg, cb) => {
        if (cb) queueMicrotask(() => cb({ ok: true }))
        return Promise.resolve({ ok: true })
      },
      onMessage: { addListener: (fn) => messageListeners.push(fn) }
    },
    alarms: {
      create: (name, opts) => alarms.push({ name, opts }),
      onAlarm: { addListener: (fn) => listeners.push(fn) },
      getAll: async () => alarms,
      clear: async () => {}
    },
    tabs: {
      query: async (q) => tabs,
      sendMessage: async (id, msg) => ({ ok: true })
    },
    ...overrides
  }
  globalThis.chrome = chromeStub
  return { store, alarms, listeners, messageListeners, tabs, chromeStub }
}

/** Restore the global to undefined so subsequent tests get a clean slate. */
export function uninstallChromeMock () {
  delete globalThis.chrome
}

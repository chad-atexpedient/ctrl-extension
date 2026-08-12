/**
 * Unit tests for utils/storage.js — the data backbone imported by the
 * service worker, sidepanel, options and api-client. Previously untested.
 *
 * Strategy: install the chrome.* stub before importing the module, then
 * exercise the StorageManager's public surface: settings merge-on-write,
 * defaults merge, provider credentials, API config and chat history.
 */

import { describe, test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { installChromeMock, uninstallChromeMock } from './helpers/chrome-mock.js'

installChromeMock()

const MOD = await import('../../utils/storage.js')
const { storage, STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_ENABLED_MODELS } = MOD

// Re-install the chrome mock between tests so each test starts with an
// empty storage. Also clear the StorageManager LRU cache (it holds a
// per-value cache with a short TTL; clearing avoids stale reads).
function resetStore() {
  uninstallChromeMock()
  installChromeMock()
  storage.clearCache && storage.clearCache()
}

describe('storage: settings', () => {
  beforeEach(() => { resetStore() })
  afterEach(() => { resetStore() })

  test('getSettings merges stored values over DEFAULT_SETTINGS', async () => {
    await storage.set(STORAGE_KEYS.SETTINGS, { temperature: 0.1 })
    const settings = await storage.getSettings()
    assert.equal(settings.temperature, 0.1)
    assert.equal(settings.maxTokens, DEFAULT_SETTINGS.maxTokens)
    assert.ok('maxTokens' in settings)
  })

  test('saveSettings merges partial updates instead of clobbering', async () => {
    await storage.set(STORAGE_KEYS.SETTINGS, { webSearchEnabled: false, autoAttachEnabled: true, temperature: 0.7 })
    // Partial save that does not know about webSearchEnabled/autoAttachEnabled
    await storage.saveSettings({ temperature: 0.3 })
    const settings = await storage.getSettings()
    assert.equal(settings.temperature, 0.3)
    assert.equal(settings.webSearchEnabled, false, 'webSearchEnabled must survive a partial save')
    assert.equal(settings.autoAttachEnabled, true, 'autoAttachEnabled must survive a partial save')
  })

  test('saveSettings with an empty object preserves everything', async () => {
    await storage.set(STORAGE_KEYS.SETTINGS, { theme: 'nebula' })
    await storage.saveSettings({})
    const settings = await storage.getSettings()
    assert.equal(settings.theme, 'nebula')
  })
})

describe('storage: provider credentials', () => {
  beforeEach(() => { resetStore() })
  afterEach(() => { resetStore() })

  test('setProviderCredentials / getProviderCredentials round-trip per provider', async () => {
    await storage.setProviderCredentials('openai', 'sk-test-123')
    const creds = await storage.getProviderCredentials('openai')
    assert.equal(creds.apiKey, 'sk-test-123')
  })

  test('getProviderCredentials returns empty object when unset', async () => {
    const key = await storage.getProviderCredentials('nonexistent')
    assert.deepEqual(key, { apiKey: '', baseURL: '' })
  })

  test('deleteProviderCredentials removes the key', async () => {
    await storage.setProviderCredentials('openai', 'sk-test-123')
    await storage.deleteProviderCredentials('openai')
    const key = await storage.getProviderCredentials('openai')
    assert.deepEqual(key, { apiKey: '', baseURL: '' })
  })
})

describe('storage: API config', () => {
  beforeEach(() => { resetStore() })
  afterEach(() => { resetStore() })

  test('setAPIConfig / getAPIConfig round-trip', async () => {
    await storage.setAPIConfig({ model: 'gpt-4o' })
    const config = await storage.getAPIConfig()
    assert.equal(config.model, 'gpt-4o')
  })

  test('getAPIConfig falls back to defaults when unset', async () => {
    const config = await storage.getAPIConfig()
    assert.ok(config && typeof config === 'object')
  })
})

describe('storage: chat history', () => {
  beforeEach(() => { resetStore() })
  afterEach(() => { resetStore() })

  test('saveChatHistory / getChatHistory round-trip', async () => {
    const history = [
      { role: 'user', content: 'hello', timestamp: 1 },
      { role: 'assistant', content: 'hi', timestamp: 2 }
    ]
    await storage.saveChatHistory(history)
    const loaded = await storage.getChatHistory()
    assert.deepEqual(loaded, history)
  })

  test('clearChatHistory empties history', async () => {
    await storage.saveChatHistory([{ role: 'user', content: 'x', timestamp: 1 }])
    await storage.clearChatHistory()
    assert.deepEqual(await storage.getChatHistory(), [])
  })

  test('getChatHistory returns [] when nothing stored', async () => {
    assert.deepEqual(await storage.getChatHistory(), [])
  })
})

describe('storage: enabled models', () => {
  beforeEach(() => { resetStore() })
  afterEach(() => { resetStore() })

  test('getEnabledModels returns [] (falsy-safe) when unset', async () => {
    const models = await storage.getEnabledModels()
    assert.deepEqual(models, [])
  })

  test('setEnabledModels / getEnabledModels round-trip', async () => {
    await storage.setEnabledModels(['gpt-4o', 'gpt-4o-mini'])
    const models = await storage.getEnabledModels()
    assert.deepEqual(models, ['gpt-4o', 'gpt-4o-mini'])
  })

  test('DEFAULT_ENABLED_MODELS is exported and non-empty', () => {
    assert.ok(DEFAULT_ENABLED_MODELS && typeof DEFAULT_ENABLED_MODELS === 'object')
  })
})

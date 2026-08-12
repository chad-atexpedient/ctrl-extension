/**
 * Regression tests for ModelSelectionManager <-> storage.getEnabledModels()/
 * setEnabledModels() consistency.
 *
 * Bug history: STORAGE_KEYS in storage.js was missing an ENABLED_MODELS entry
 * entirely, so storage.getEnabledModels()/setEnabledModels() read/wrote
 * STORAGE_KEYS.ENABLED_MODELS === undefined. chrome.storage.local silently
 * no-ops on an undefined key, so getEnabledModels() always returned [] no
 * matter what ModelSelectionManager had actually written to
 * chrome.storage.local under the literal key 'enabled_models'. That broke
 * GET_STATE's enabledModels field, which command-palette.js's in-chat model
 * list depends on directly — "select models" silently did nothing.
 *
 * These tests prove both code paths read/write the exact same storage key
 * and stay in sync with each other, so this class of bug can't silently
 * regress again.
 */

import { describe, test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installChromeMock } from './helpers/chrome-mock.js'

const { store } = installChromeMock()

const { ModelSelectionManager } = await import('../../utils/model-selection-manager.js')
const { storage, STORAGE_KEYS } = await import('../../utils/storage.js')

describe('ModelSelectionManager <-> storage.js: storage key consistency', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
    if (storage?.cache?.clear) storage.cache.clear()
  })

  test('STORAGE_KEYS.ENABLED_MODELS is defined and matches ModelSelectionManager.STORAGE_KEY', () => {
    assert.equal(typeof STORAGE_KEYS.ENABLED_MODELS, 'string')
    assert.equal(STORAGE_KEYS.ENABLED_MODELS, 'enabled_models')
    assert.equal(STORAGE_KEYS.ENABLED_MODELS, ModelSelectionManager.STORAGE_KEY)
  })

  test('ModelSelectionManager.setModels() is readable via storage.getEnabledModels()', async () => {
    await ModelSelectionManager.setModels('openai', ['gpt-4o', 'gpt-4o-mini'])

    // Bypass the StorageManager's 5s TTL cache to prove the actual stored value.
    const viaStorage = await storage.getEnabledModels()
    assert.deepEqual(viaStorage, { openai: ['gpt-4o', 'gpt-4o-mini'] })

    // And confirm it landed at the literal key both sides agree on.
    assert.deepEqual(store['enabled_models'], { openai: ['gpt-4o', 'gpt-4o-mini'] })
  })

  test('storage.setEnabledModels() is readable via ModelSelectionManager.getModels()/getAllModels()', async () => {
    await storage.setEnabledModels({ anthropic: ['claude-4.5-sonnet'] })

    const models = await ModelSelectionManager.getModels('anthropic')
    assert.deepEqual(models, ['claude-4.5-sonnet'])

    const all = await ModelSelectionManager.getAllModels()
    assert.deepEqual(all, { anthropic: ['claude-4.5-sonnet'] })
  })

  test('round trip across both APIs for multiple providers', async () => {
    await ModelSelectionManager.setModels('openai', ['gpt-4o'])
    await storage.setEnabledModels({
      ...(await storage.getEnabledModels()),
      google: ['gemini-2.5-pro']
    })
    await ModelSelectionManager.setModels('anthropic', ['claude-4.5-sonnet'])

    const finalState = await storage.getEnabledModels()
    assert.deepEqual(finalState, {
      openai: ['gpt-4o'],
      google: ['gemini-2.5-pro'],
      anthropic: ['claude-4.5-sonnet']
    })

    assert.deepEqual(await ModelSelectionManager.getAllModels(), finalState)
  })

  test('storage.getEnabledModels() defaults to [] (falsy-safe), not undefined, when nothing stored', async () => {
    const models = await storage.getEnabledModels()
    assert.deepEqual(models, [])
  })

  test('ModelSelectionManager.clearProvider() is reflected in storage.getEnabledModels()', async () => {
    await ModelSelectionManager.setModels('openai', ['gpt-4o'])
    await ModelSelectionManager.clearProvider('openai')

    const viaStorage = await storage.getEnabledModels()
    assert.deepEqual(viaStorage.openai, [])
  })
})

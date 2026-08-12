import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { installChromeMock, uninstallChromeMock } from './helpers/chrome-mock.js'

// Install chrome mock before importing the module
const { store } = installChromeMock()

const { SpendTracker } = await import('../../utils/spend-tracker.js')

describe('SpendTracker', () => {
  let tracker

  beforeEach(() => {
    tracker = new SpendTracker()
    tracker._loaded = true
    tracker.entries = []
  })

  describe('record()', () => {
    it('should record a spend entry with correct cost', () => {
      const entry = tracker.record({
        provider: 'openai',
        model: 'gpt-4o',
        promptTokens: 1000,
        completionTokens: 500,
      })

      assert.ok(entry)
      assert.equal(entry.provider, 'openai')
      assert.equal(entry.model, 'gpt-4o')
      assert.equal(entry.promptTokens, 1000)
      assert.equal(entry.completionTokens, 500)
      assert.ok(entry.costUsd > 0)
      assert.ok(entry.timestamp)
    })

    it('should handle unknown model gracefully', () => {
      const entry = tracker.record({
        provider: 'openai',
        model: 'unknown-model-xyz',
        promptTokens: 100,
        completionTokens: 50,
      })

      assert.ok(entry)
      assert.ok(entry.costUsd >= 0) // May be 0 if model not in pricing table
    })

    it('should accumulate entries', () => {
      tracker.record({ provider: 'openai', model: 'gpt-4o', promptTokens: 100, completionTokens: 50 })
      tracker.record({ provider: 'anthropic', model: 'claude-4.5-sonnet', promptTokens: 200, completionTokens: 100 })

      assert.equal(tracker.entries.length, 2)
    })
  })

  describe('getTotalCost()', () => {
    it('should sum all entries', () => {
      tracker.entries = [
        { costUsd: 0.005 },
        { costUsd: 0.010 },
        { costUsd: 0.003 },
      ]
      assert.ok(Math.abs(tracker.getTotalCost() - 0.018) < 0.0001)
    })

    it('should return 0 for empty history', () => {
      assert.equal(tracker.getTotalCost(), 0)
    })
  })

  describe('getProviderCost()', () => {
    it('should filter by provider', () => {
      tracker.entries = [
        { provider: 'openai', costUsd: 0.01 },
        { provider: 'anthropic', costUsd: 0.02 },
        { provider: 'openai', costUsd: 0.005 },
      ]
      assert.ok(Math.abs(tracker.getProviderCost('openai') - 0.015) < 0.0001)
      assert.ok(Math.abs(tracker.getProviderCost('anthropic') - 0.02) < 0.0001)
    })
  })

  describe('getSessionCost()', () => {
    it('should only include entries from last 4 hours', () => {
      const now = Date.now()
      tracker.entries = [
        { timestamp: now - 1000, costUsd: 0.01 }, // 1s ago
        { timestamp: now - 5 * 3600000, costUsd: 0.05 }, // 5h ago
      ]
      assert.ok(Math.abs(tracker.getSessionCost() - 0.01) < 0.0001)
    })
  })

  describe('getCostByProvider()', () => {
    it('should group costs by provider', () => {
      const now = Date.now()
      tracker.entries = [
        { provider: 'openai', model: 'gpt-4o', promptTokens: 100, completionTokens: 50, costUsd: 0.01, timestamp: now },
        { provider: 'anthropic', model: 'claude-4.5-sonnet', promptTokens: 200, completionTokens: 100, costUsd: 0.02, timestamp: now },
        { provider: 'openai', model: 'gpt-4o', promptTokens: 50, completionTokens: 25, costUsd: 0.005, timestamp: now },
      ]
      const result = tracker.getCostByProvider()
      assert.ok(result.openai)
      assert.ok(result.anthropic)
      assert.ok(Math.abs(result.openai.cost - 0.015) < 0.0001)
      assert.ok(Math.abs(result.anthropic.cost - 0.02) < 0.0001)
    })
  })

  describe('getDailyCosts()', () => {
    it('should return array with one entry per day', () => {
      const now = Date.now()
      const dayMs = 86400000
      tracker.entries = [
        { timestamp: now, costUsd: 0.01 },
        { timestamp: now - dayMs, costUsd: 0.02 },
        { timestamp: now - dayMs, costUsd: 0.005 },
      ]
      const result = tracker.getDailyCosts(3)
      assert.ok(Array.isArray(result))
      assert.ok(result.length >= 2)
    })

    it('should aggregate entries by day', () => {
      const now = Date.now()
      const dayMs = 86400000
      tracker.entries = [
        { timestamp: now, costUsd: 0.01 },
        { timestamp: now - 1000, costUsd: 0.02 },
      ]
      const result = tracker.getDailyCosts(1)
      assert.equal(result.length, 1)
      assert.ok(Math.abs(result[0].cost - 0.03) < 0.0001)
    })
  })

  describe('getTokenBreakdown()', () => {
    it('should group tokens by provider', () => {
      const now = Date.now()
      tracker.entries = [
        { provider: 'openai', promptTokens: 100, completionTokens: 50, timestamp: now },
        { provider: 'anthropic', promptTokens: 200, completionTokens: 100, timestamp: now },
        { provider: 'openai', promptTokens: 50, completionTokens: 25, timestamp: now },
      ]
      const result = tracker.getTokenBreakdown()
      assert.equal(result.openai.prompt, 150)
      assert.equal(result.openai.completion, 75)
      assert.equal(result.anthropic.prompt, 200)
      assert.equal(result.anthropic.completion, 100)
    })
  })

  describe('exportCSV()', () => {
    it('should produce valid CSV with header', () => {
      tracker.entries = [
        { timestamp: Date.now(), provider: 'openai', model: 'gpt-4o', promptTokens: 100, completionTokens: 50, costUsd: 0.01 },
      ]
      const csv = tracker.exportCSV()
      const lines = csv.split('\n')
      assert.ok(lines[0].includes('timestamp'))
      assert.ok(lines[0].includes('provider'))
      assert.ok(lines[0].includes('model'))
      assert.ok(lines.length >= 2)
    })
  })

  describe('clear()', () => {
    it('should empty entries', async () => {
      tracker.entries = [{ costUsd: 0.01 }]
      await tracker.clear()
      assert.equal(tracker.entries.length, 0)
    })
  })
})

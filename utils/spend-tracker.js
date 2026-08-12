/**
 * Spend Tracker — Per-provider cost tracking for CTRL Extension
 *
 * Records token usage per API call, aggregates by provider and session,
 * and persists rolling totals in chrome.storage.local so they survive
 * browser restarts. Provides data for the options-page spending dashboard
 * and the sidepanel header cost badge.
 */

import { PROVIDERS } from './storage.js'

const STORAGE_KEY = 'spend_history'
const MAX_HISTORY_DAYS = 90

/**
 * @typedef {Object} SpendEntry
 * @property {string} provider - Provider ID (e.g. 'openai', 'anthropic')
 * @property {string} model - Model ID (e.g. 'gpt-4o', 'claude-4.5-sonnet')
 * @property {number} promptTokens
 * @property {number} completionTokens
 * @property {number} costUsd - Computed cost in USD
 * @property {number} timestamp - Date.now()
 * @property {string} [sessionId] - Optional session grouping
 */

class SpendTracker {
  constructor() {
    /** @type {SpendEntry[]} */
    this.entries = []
    this._loaded = false
    this._pendingFlush = null
    this._initPromise = null
  }

  /** Hydrate from storage. Call once on service-worker startup. */
  async initialize() {
    if (this._initPromise) return this._initPromise
    this._initPromise = this._doInitialize()
    return this._initPromise
  }

  async _doInitialize() {
    try {
      const raw = await chrome.storage.local.get(STORAGE_KEY)
      this.entries = raw[STORAGE_KEY] || []
      this._loaded = true
      this._pruneOld()
    } catch (e) {
      console.error('[SpendTracker] Failed to load history:', e)
      this.entries = []
      this._loaded = true
    }
  }

  /** @private */

  /**
   * Record a completed API call's token usage.
   * @param {Object} params
   * @param {string} params.provider - Provider ID
   * @param {string} params.model - Model ID
   * @param {number} params.promptTokens
   * @param {number} params.completionTokens
   * @param {string} [params.sessionId]
   */
  record({ provider, model, promptTokens, completionTokens, sessionId }) {
    if (!this._loaded) {
      console.warn('[SpendTracker] record() called before initialize(), waiting...')
      this.initialize().catch(() => {})
    }
    const pricing = this._getModelPricing(provider, model)
    const costUsd = pricing
      ? (promptTokens / 1e6) * pricing.input + (completionTokens / 1e6) * pricing.output
      : 0

    const entry = {
      provider: provider || 'unknown',
      model: model || 'unknown',
      promptTokens: promptTokens || 0,
      completionTokens: completionTokens || 0,
      costUsd,
      timestamp: Date.now(),
      sessionId: sessionId || null,
    }

    this.entries.push(entry)

    // Debounce persistence — batch writes within 2s
    if (!this._pendingFlush) {
      this._pendingFlush = setTimeout(() => this._flush(), 2000)
    }

    return entry
  }

  /** Get the pricing {input, output} for a model from PROVIDERS. */
  _getModelPricing(providerId, modelId) {
    const provider = PROVIDERS[providerId]
    if (!provider) return null
    const model = provider.models.find(m => m.id === modelId)
    return model?.pricing || null
  }

  /** Remove entries older than MAX_HISTORY_DAYS. */
  _pruneOld() {
    const cutoff = Date.now() - MAX_HISTORY_DAYS * 86400000
    const before = this.entries.length
    this.entries = this.entries.filter(e => e.timestamp >= cutoff)
    if (this.entries.length !== before) {
      this._flush()
    }
  }

  /** Persist current entries to storage. */
  async _flush() {
    this._pendingFlush = null
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: this.entries })
    } catch (e) {
      console.error('[SpendTracker] Failed to save:', e)
    }
  }

  // ─── Query Methods ─────────────────────────────────────────

  /** Total cost across all entries. */
  getTotalCost() {
    return this.entries.reduce((sum, e) => sum + e.costUsd, 0)
  }

  /** Total cost for a specific provider. */
  getProviderCost(providerId) {
    return this.entries
      .filter(e => e.provider === providerId)
      .reduce((sum, e) => sum + e.costUsd, 0)
  }

  /** Total cost for the current session (last 4 hours). */
  getSessionCost() {
    const cutoff = Date.now() - 4 * 3600000
    return this.entries
      .filter(e => e.timestamp >= cutoff)
      .reduce((sum, e) => sum + e.costUsd, 0)
  }

  /** Cost breakdown by provider for the last N days. */
  getCostByProvider(days = 30) {
    const cutoff = Date.now() - days * 86400000
    const recent = this.entries.filter(e => e.timestamp >= cutoff)
    const byProvider = {}
    for (const e of recent) {
      if (!byProvider[e.provider]) {
        byProvider[e.provider] = { cost: 0, tokens: 0, calls: 0 }
      }
      byProvider[e.provider].cost += e.costUsd
      byProvider[e.provider].tokens += e.promptTokens + e.completionTokens
      byProvider[e.provider].calls++
    }
    return byProvider
  }

  /** Daily cost totals for the last N days (for charting). */
  getDailyCosts(days = 30) {
    const cutoff = Date.now() - days * 86400000
    const recent = this.entries.filter(e => e.timestamp >= cutoff)
    const daily = {}
    for (const e of recent) {
      const dateKey = new Date(e.timestamp).toISOString().slice(0, 10)
      if (!daily[dateKey]) daily[dateKey] = 0
      daily[dateKey] += e.costUsd
    }
    // Fill in missing days with 0
    const result = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      result.push({ date: key, cost: daily[key] || 0 })
    }
    return result
  }

  /** Token breakdown by provider for the last N days. */
  getTokenBreakdown(days = 30) {
    const cutoff = Date.now() - days * 86400000
    const recent = this.entries.filter(e => e.timestamp >= cutoff)
    const byProvider = {}
    for (const e of recent) {
      if (!byProvider[e.provider]) {
        byProvider[e.provider] = { prompt: 0, completion: 0, total: 0 }
      }
      byProvider[e.provider].prompt += e.promptTokens
      byProvider[e.provider].completion += e.completionTokens
      byProvider[e.provider].total += e.promptTokens + e.completionTokens
    }
    return byProvider
  }

  /** Export all entries as CSV string. */
  exportCSV() {
    const header = 'timestamp,date,provider,model,prompt_tokens,completion_tokens,cost_usd'
    const rows = this.entries.map(e => {
      const date = new Date(e.timestamp).toISOString()
      return `${e.timestamp},${date},${e.provider},${e.model},${e.promptTokens},${e.completionTokens},${e.costUsd.toFixed(6)}`
    })
    return [header, ...rows].join('\n')
  }

  /** Clear all history. */
  async clear() {
    this.entries = []
    await chrome.storage.local.set({ [STORAGE_KEY]: [] })
  }
}

export const spendTracker = new SpendTracker()
export { SpendTracker }

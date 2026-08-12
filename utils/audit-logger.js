/**
 * Audit Logging System for CTRL Extension
 *
 * Features:
 * - Log security-relevant actions
 * - Tamper-evident audit trail
 * - Structured event types and categories
 * - Search and filtering capabilities
 * - Export for investigations
 * - Persistent storage
 */

export class AuditLogger {
  constructor(options = {}) {
    this.maxLogs = options.maxLogs || 1000
    this.sessionId = this._generateSessionId()
    this.startTime = Date.now()
    this.enabled = options.enabled !== false

    this.logs = []
    this.eventTypes = {
      // Security events
      AUTH_LOGIN: 'AUTH_LOGIN',
      AUTH_LOGOUT: 'AUTH_LOGOUT',
      AUTH_FAILED: 'AUTH_FAILED',
      API_KEY_SET: 'API_KEY_SET',
      API_KEY_UPDATED: 'API_KEY_UPDATED',
      API_KEY_DELETED: 'API_KEY_DELETED',
      API_KEY_VIEWED: 'API_KEY_VIEWED',

      // Configuration events
      SETTINGS_CHANGED: 'SETTINGS_CHANGED',
      MODEL_SELECTION_CHANGED: 'MODEL_SELECTION_CHANGED',
      PROVIDER_ENABLED: 'PROVIDER_ENABLED',
      PROVIDER_DISABLED: 'PROVIDER_DISABLED',

      // Data events
      DATA_EXPORTED: 'DATA_EXPORTED',
      DATA_IMPORTED: 'DATA_IMPORTED',
      DATA_DELETED: 'DATA_DELETED',
      CACHE_CLEARED: 'CACHE_CLEARED',
      MEMORY_INDEX_REBUILT: 'MEMORY_INDEX_REBUILT',

      // Permission events
      PERMISSION_GRANTED: 'PERMISSION_GRANTED',
      PERMISSION_DENIED: 'PERMISSION_DENIED',
      PERMISSION_REVOKED: 'PERMISSION_REVOKED',

      // System events
      EXTENSION_INSTALLED: 'EXTENSION_INSTALLED',
      EXTENSION_UPDATED: 'EXTENSION_UPDATED',
      ERROR_LOGGED: 'ERROR_LOGGED',
      SECURITY_ALERT: 'SECURITY_ALERT'
    }

    this.categories = {
      SECURITY: 'security',
      CONFIGURATION: 'configuration',
      DATA: 'data',
      PERMISSION: 'permission',
      SYSTEM: 'system',
      ERROR: 'error'
    }

    // Load existing logs from storage
    this._loadFromStorage()
  }

  /**
   * Log an audit event
   * @param {string} eventType - Event type from eventTypes
   * @param {Object} details - Event details
   * @returns {string} Log entry ID
   */
  log(eventType, details = {}) {
    if (!this.enabled) return null

    const entry = this._createLogEntry(eventType, details)

    this.logs.push(entry)

    // Maintain max size
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Persist to storage
    this._saveToStorage()

    console.debug('[AuditLogger]', entry)

    return entry.id
  }

  /**
   * Log API key action
   * @param {string} action - set, updated, deleted, viewed
   * @param {string} provider - Provider ID
   * @param {Object} details - Additional details
   */
  logApiKeyAction(action, provider, details = {}) {
    const eventType = {
      'set': this.eventTypes.API_KEY_SET,
      'updated': this.eventTypes.API_KEY_UPDATED,
      'deleted': this.eventTypes.API_KEY_DELETED,
      'viewed': this.eventTypes.API_KEY_VIEWED
    }[action]

    return this.log(eventType, {
      category: this.categories.SECURITY,
      provider,
      action,
      ...details
    })
  }

  /**
   * Log settings change
   * @param {string} settingKey - Changed setting
   * @param {*} oldValue - Previous value
   * @param {*} newValue - New value
   * @param {Object} details - Additional details
   */
  logSettingsChange(settingKey, oldValue, newValue, details = {}) {
    return this.log(this.eventTypes.SETTINGS_CHANGED, {
      category: this.categories.CONFIGURATION,
      settingKey,
      oldValue: this._sanitizeValue(oldValue),
      newValue: this._sanitizeValue(newValue),
      ...details
    })
  }

  /**
   * Log model selection change
   * @param {string} provider - Provider ID
   * @param {Array} addedModels - Models that were added
   * @param {Array} removedModels - Models that were removed
   * @param {Object} details - Additional details
   */
  logModelSelectionChange(provider, addedModels = [], removedModels = [], details = {}) {
    return this.log(this.eventTypes.MODEL_SELECTION_CHANGED, {
      category: this.categories.CONFIGURATION,
      provider,
      addedModels,
      removedModels,
      totalSelected: details.totalSelected || 0,
      ...details
    })
  }

  /**
   * Log authentication event
   * @param {string} action - login, logout, failed
   * @param {Object} details - Additional details
   */
  logAuthAction(action, details = {}) {
    const eventType = {
      'login': this.eventTypes.AUTH_LOGIN,
      'logout': this.eventTypes.AUTH_LOGOUT,
      'failed': this.eventTypes.AUTH_FAILED
    }[action]

    return this.log(eventType, {
      category: this.categories.SECURITY,
      action,
      ...details
    })
  }

  /**
   * Log data action
   * @param {string} action - exported, imported, deleted
   * @param {string} dataType - Type of data (chat-history, settings, etc.)
   * @param {Object} details - Additional details
   */
  logDataAction(action, dataType, details = {}) {
    const eventType = {
      'exported': this.eventTypes.DATA_EXPORTED,
      'imported': this.eventTypes.DATA_IMPORTED,
      'deleted': this.eventTypes.DATA_DELETED
    }[action]

    return this.log(eventType, {
      category: this.categories.DATA,
      action,
      dataType,
      ...details
    })
  }

  /**
   * Log permission action
   * @param {string} action - granted, denied, revoked
   * @param {string} permission - Permission type
   * @param {Object} details - Additional details
   */
  logPermissionAction(action, permission, details = {}) {
    const eventType = {
      'granted': this.eventTypes.PERMISSION_GRANTED,
      'denied': this.eventTypes.PERMISSION_DENIED,
      'revoked': this.eventTypes.PERMISSION_REVOKED
    }[action]

    return this.log(eventType, {
      category: this.categories.PERMISSION,
      action,
      permission,
      ...details
    })
  }

  /**
   * Log security alert
   * @param {string} alertType - Type of security alert
   * @param {Object} details - Alert details
   */
  logSecurityAlert(alertType, details = {}) {
    return this.log(this.eventTypes.SECURITY_ALERT, {
      category: this.categories.SECURITY,
      alertType,
      severity: details.severity || 'high',
      ...details
    })
  }

  /**
   * Search audit logs
   * @param {Object} filters - Search filters
   * @returns {Array} Filtered log entries
   */
  search(filters = {}) {
    let results = [...this.logs]

    // Filter by event type
    if (filters.eventType) {
      results = results.filter(log => log.eventType === filters.eventType)
    }

    // Filter by category
    if (filters.category) {
      results = results.filter(log => log.category === filters.category)
    }

    // Filter by provider
    if (filters.provider) {
      results = results.filter(log => log.details.provider === filters.provider)
    }

    // Filter by user ID
    if (filters.userId) {
      results = results.filter(log => log.userId === filters.userId)
    }

    // Filter by session ID
    if (filters.sessionId) {
      results = results.filter(log => log.sessionId === filters.sessionId)
    }

    // Filter by time range
    if (filters.since) {
      results = results.filter(log => log.timestamp >= filters.since)
    }

    if (filters.until) {
      results = results.filter(log => log.timestamp <= filters.until)
    }

    // Limit results
    if (filters.limit) {
      results = results.slice(0, filters.limit)
    }

    return results
  }

  /**
   * Get audit statistics
   * @param {Object} filters - Optional filters
   * @returns {Object} Statistics
   */
  getStats(filters = {}) {
    const logs = this.search(filters)

    const stats = {
      total: logs.length,
      byEventType: {},
      byCategory: {},
      byProvider: {},
      timeRange: {
        first: logs.length > 0 ? logs[0].timestamp : null,
        last: logs.length > 0 ? logs[logs.length - 1].timestamp : null
      }
    }

    logs.forEach(log => {
      // Count by event type
      stats.byEventType[log.eventType] = (stats.byEventType[log.eventType] || 0) + 1

      // Count by category
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1

      // Count by provider
      if (log.details.provider) {
        const provider = log.details.provider
        stats.byProvider[provider] = (stats.byProvider[provider] || 0) + 1
      }
    })

    return stats
  }

  /**
   * Clear all audit logs
   * @param {string} reason - Reason for clearing
   */
  clear(reason = 'Manual clear') {
    const entry = {
      id: this._generateLogId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      eventType: 'LOGS_CLEARED',
      category: this.categories.SYSTEM,
      userId: this._getUserId(),
      userAgent: this._getUserAgent(),
      details: {
        reason,
        logsCleared: this.logs.length
      },
      hash: null
    }

    this.logs = [entry] // Keep the clear event itself
    this._saveToStorage()

    console.warn('[AuditLogger] All logs cleared:', reason)
  }

  /**
   * Export audit logs as JSON
   * @param {Object} options - Export options
   * @returns {string} JSON string
   */
  exportToJson(options = {}) {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      sessionId: this.sessionId,
      sessionDuration: Date.now() - this.startTime,
      stats: this.getStats(),
      logs: options.includeAll ? this.logs : this.search(options.filters)
    }

    return JSON.stringify(data, null, 2)
  }

  /**
   * Generate audit report
   * @returns {string} Human-readable report
   */
  generateReport() {
    const stats = this.getStats()

    let report = `=== Audit Log Report ===\n`
    report += `Session ID: ${this.sessionId}\n`
    report += `Session Duration: ${Math.round((Date.now() - this.startTime) / 1000)}s\n`
    report += `Total Events: ${stats.total}\n\n`

    report += `--- Events by Category ---\n`
    Object.entries(stats.byCategory).forEach(([category, count]) => {
      report += `  ${category}: ${count}\n`
    })

    report += `\n--- Events by Type (Top 10) ---\n`
    const topEvents = Object.entries(stats.byEventType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    topEvents.forEach(([type, count]) => {
      report += `  ${type}: ${count}\n`
    })

    if (Object.keys(stats.byProvider).length > 0) {
      report += `\n--- Events by Provider ---\n`
      Object.entries(stats.byProvider).forEach(([provider, count]) => {
        report += `  ${provider}: ${count}\n`
      })
    }

    return report
  }

  // Private methods

  /**
   * Create log entry with hash for tamper evidence
   * @private
   */
  _createLogEntry(eventType, details) {
    const entry = {
      id: this._generateLogId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      eventType,
      category: details.category || this._getCategoryForEvent(eventType),
      userId: this._getUserId(),
      userAgent: this._getUserAgent(),
      details: this._sanitizeDetails(details),
      hash: null
    }

    // Calculate hash for tamper evidence
    entry.hash = this._calculateHash(entry)

    return entry
  }

  /**
   * Get category for event type
   * @private
   */
  _getCategoryForEvent(eventType) {
    const categoryMap = {
      [this.eventTypes.AUTH_LOGIN]: this.categories.SECURITY,
      [this.eventTypes.AUTH_LOGOUT]: this.categories.SECURITY,
      [this.eventTypes.AUTH_FAILED]: this.categories.SECURITY,
      [this.eventTypes.API_KEY_SET]: this.categories.SECURITY,
      [this.eventTypes.API_KEY_UPDATED]: this.categories.SECURITY,
      [this.eventTypes.API_KEY_DELETED]: this.categories.SECURITY,
      [this.eventTypes.API_KEY_VIEWED]: this.categories.SECURITY,
      [this.eventTypes.SETTINGS_CHANGED]: this.categories.CONFIGURATION,
      [this.eventTypes.MODEL_SELECTION_CHANGED]: this.categories.CONFIGURATION,
      [this.eventTypes.PROVIDER_ENABLED]: this.categories.CONFIGURATION,
      [this.eventTypes.PROVIDER_DISABLED]: this.categories.CONFIGURATION,
      [this.eventTypes.DATA_EXPORTED]: this.categories.DATA,
      [this.eventTypes.DATA_IMPORTED]: this.categories.DATA,
      [this.eventTypes.DATA_DELETED]: this.categories.DATA,
      [this.eventTypes.CACHE_CLEARED]: this.categories.DATA,
      [this.eventTypes.MEMORY_INDEX_REBUILT]: this.categories.DATA,
      [this.eventTypes.PERMISSION_GRANTED]: this.categories.PERMISSION,
      [this.eventTypes.PERMISSION_DENIED]: this.categories.PERMISSION,
      [this.eventTypes.PERMISSION_REVOKED]: this.categories.PERMISSION,
      [this.eventTypes.EXTENSION_INSTALLED]: this.categories.SYSTEM,
      [this.eventTypes.EXTENSION_UPDATED]: this.categories.SYSTEM,
      [this.eventTypes.ERROR_LOGGED]: this.categories.ERROR,
      [this.eventTypes.SECURITY_ALERT]: this.categories.SECURITY
    }

    return categoryMap[eventType] || this.categories.SYSTEM
  }

  /**
   * Sanitize value for logging (hide sensitive data)
   * @private
   */
  _sanitizeValue(value) {
    if (typeof value !== 'string') return value

    if (value.startsWith('sk-') || value.startsWith('sk-ant-') || value.length > 20) {
      return `${value.substring(0, 8)}...${value.substring(value.length - 4)}`
    }

    if (value.length > 8 && /[A-Za-z]/.test(value) && /[0-9]/.test(value)) {
      return '***'
    }

    return value
  }

  /**
   * Recursively sanitize an object for safe logging
   * @private
   */
  _sanitizeDetails(details = {}) {
    if (details === null || details === undefined) return {}
    if (typeof details !== 'object') return this._sanitizeValue(String(details))

    const sanitized = {}
    for (const [key, value] of Object.entries(details)) {
      if (key === 'password' || key === 'token' || key === 'secret' || key === 'apiKey' || key === 'api_key') {
        sanitized[key] = '***'
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(v => this._sanitizeDetails(v))
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this._sanitizeDetails(value)
      } else {
        sanitized[key] = this._sanitizeValue(String(value))
      }
    }
    return sanitized
  }

  /**
   * Calculate hash for tamper evidence using FNV-1a
   * @private
   */
  _fnv1a32(data) {
    let hash = 2166136261
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i)
      hash = (hash * 16777619) & 0xFFFFFFFF
    }
    return (hash >>> 0).toString(16).padStart(8, '0')
  }

  _calculateHash(entry) {
    const prevEntry = this.logs[this.logs.length - 1]
    const prevHash = prevEntry ? prevEntry.hash : '0'

    const data = JSON.stringify({
      prevHash,
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      userId: entry.userId,
      details: entry.details
    })

    return this._fnv1a32(data)
  }

  /**
   * Get user ID
   * @private
   */
  _getUserId() {
    // In production, this would come from user auth
    return 'anonymous'
  }

  /**
   * Get user agent
   * @private
   */
  _getUserAgent() {
    return typeof navigator !== 'undefined' ? navigator.userAgent : null
  }

  /**
   * Generate unique log ID
   * @private
   */
  _generateLogId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate unique session ID
   * @private
   */
  _generateSessionId() {
    return `audit_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Save logs to storage
   * @private
   */
  async _saveToStorage() {
    if (typeof chrome === 'undefined' || !chrome.storage) return

    try {
      await chrome.storage.local.set({
        'audit_logs': this.logs
      })
    } catch (error) {
      console.error('[AuditLogger] Failed to save logs:', error)
    }
  }

  /**
   * Load logs from storage
   * @private
   */
  async _loadFromStorage() {
    if (typeof chrome === 'undefined' || !chrome.storage) return

    try {
      const result = await chrome.storage.local.get(['audit_logs'])
      this.logs = result.audit_logs || []
      console.debug('[AuditLogger] Loaded', this.logs.length, 'logs from storage')
    } catch (error) {
      console.error('[AuditLogger] Failed to load logs:', error)
    }
  }
}

// Singleton instance
let globalLogger = null

/**
 * Get or create global audit logger
 * @param {Object} options - Logger options
 * @returns {AuditLogger} Global logger instance
 */
export function getAuditLogger(options = {}) {
  if (!globalLogger) {
    globalLogger = new AuditLogger(options)
  }
  return globalLogger
}

/**
 * Log audit event using global logger
 * @param {string} eventType - Event type
 * @param {Object} details - Event details
 * @returns {string} Log entry ID
 */
export function logAuditEvent(eventType, details) {
  const logger = getAuditLogger()
  return logger.log(eventType, details)
}

/**
 * Get audit statistics
 * @param {Object} filters - Filters
 * @returns {Object} Statistics
 */
export function getAuditStats(filters) {
  const logger = getAuditLogger()
  return logger.getStats(filters)
}

/**
 * Export audit report
 * @param {Object} options - Export options
 * @returns {string} JSON export
 */
export function exportAuditReport(options) {
  const logger = getAuditLogger()
  return logger.exportToJson(options)
}

/**
 * Generate audit summary
 * @returns {string} Human-readable summary
 */
export function generateAuditSummary() {
  const logger = getAuditLogger()
  return logger.generateReport()
}

/**
 * Clear audit logs
 * @param {string} reason - Reason for clearing
 */
export function clearAuditLogs(reason) {
  const logger = getAuditLogger()
  logger.clear(reason)
}

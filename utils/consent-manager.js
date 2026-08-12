import { getLogger } from './logger.js'
import { storage, STORAGE_KEYS } from './storage.js'

const logger = getLogger('ConsentManager')

// Consent types
export const ConsentTypes = {
  PRIVACY_POLICY: 'privacy_policy',
  TERMS_OF_SERVICE: 'terms_of_service',
  DATA_COLLECTION: 'data_collection',
  ANALYTICS: 'analytics',
  CRASH_REPORTING: 'crash_reporting',
  FEATURE_USAGE: 'feature_usage',
  CONTEXT_AWARENESS: 'context_awareness',
  MODEL_SELECTION: 'model_selection',
  PROVIDER_CONFIG: 'provider_config'
}

// Consent status
export const ConsentStatus = {
  NOT_REQUIRED: 'not_required',
  NOT_ASKED: 'not_asked',
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  REVOKED: 'revoked'
}

// Default consent state
export const DEFAULT_CONSENT_STATE = {
  [ConsentTypes.PRIVACY_POLICY]: {
    status: ConsentStatus.NOT_REQUIRED,
    version: '1.0.0',
    timestamp: null
  },
  [ConsentTypes.DATA_COLLECTION]: {
    status: ConsentStatus.ACCEPTED,
    version: '1.0.0',
    timestamp: Date.now()
  },
  [ConsentTypes.CONTEXT_AWARENESS]: {
    status: ConsentStatus.NOT_ASKED,
    version: '1.0.0',
    timestamp: null
  },
  [ConsentTypes.MODEL_SELECTION]: {
    status: ConsentStatus.NOT_ASKED,
    version: '1.0.0',
    timestamp: null
  },
  [ConsentTypes.PROVIDER_CONFIG]: {
    status: ConsentStatus.NOT_ASKED,
    version: '1.0.0',
    timestamp: null
  }
}

export class ConsentManager {
  constructor() {
    this.consentState = null
    this.listeners = new Map()
    this.consentModal = null
  }

  /**
   * Initialize consent manager.
   *
   * Loads/hydrates consent state from storage (the same 'user_consent' key
   * used by acceptConsent/revokeConsent) and reports which consent types
   * still need the user's input. This does NOT show a modal or wait on the
   * 'show-consent-modal' DOM event — nothing in the codebase dispatches or
   * listens for that event, so awaiting it previously hung forever. Callers
   * that want a modal/banner should inspect `pendingConsents` and decide
   * their own UI (see requestConsent() for an explicit, opt-in modal flow).
   *
   * @returns {Promise<{consentState: Object, pendingConsents: string[]}>}
   */
  async initialize() {
    try {
      logger.info('Initializing consent manager...')

      // Load consent state from storage, filling in defaults for any
      // consent type that isn't present yet.
      const storedConsent = await storage.get('user_consent')
      this.consentState = { ...DEFAULT_CONSENT_STATE, ...(storedConsent || {}) }

      // Make sure every known consent type has an entry, even ones without
      // an explicit default (analytics, crash_reporting, feature_usage,
      // terms_of_service, etc.)
      for (const type of Object.values(ConsentTypes)) {
        if (!this.consentState[type]) {
          this.consentState[type] = {
            status: ConsentStatus.NOT_ASKED,
            version: '1.0.0',
            timestamp: null
          }
        }
      }

      const pendingConsents = this.getPendingConsents()

      logger.info('Consent manager initialized:', this.consentState)
      return { consentState: this.consentState, pendingConsents }
    } catch (error) {
      logger.error('Failed to initialize consent manager:', error)
      this.consentState = { ...DEFAULT_CONSENT_STATE }
      return { consentState: this.consentState, pendingConsents: this.getPendingConsents() }
    }
  }

  /**
   * Get the list of consent types that still need a user decision
   * (status is NOT_ASKED or PENDING).
   * @returns {string[]} Pending consent types
   */
  getPendingConsents() {
    const pending = []
    for (const type of Object.values(ConsentTypes)) {
      const consent = this.getConsent(type)
      if (consent.status === ConsentStatus.NOT_ASKED || consent.status === ConsentStatus.PENDING) {
        pending.push(type)
      }
    }
    return pending
  }

  /**
   * Get consent for a specific type
   * @param {string} type - Consent type
   * @returns {Object} Consent info
   */
  getConsent(type) {
    // Defensive: callers (hasConsented, getPendingConsents) may run before initialize() has
    // hydrated consentState from storage, e.g. if a caller checks consent status ahead of the
    // await. Treat an uninitialized state as "not yet asked" rather than throwing.
    if (!this.consentState) {
      return { status: ConsentStatus.NOT_ASKED, version: '1.0.0', timestamp: null }
    }
    return this.consentState[type] || {
      status: ConsentStatus.NOT_REQUIRED,
      version: '1.0.0',
      timestamp: null
    }
  }

  /**
   * Check if consent is given
   * @param {string} type - Consent type
   * @returns {boolean} True if consented
   */
  hasConsented(type) {
    const consent = this.getConsent(type)
    return consent.status === ConsentStatus.ACCEPTED
  }

  /**
   * Request consent from user
   * @param {string} type - Consent type
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} True if consented
   */
  async requestConsent(type, options = {}) {
    const {
      showUI = true,
      title = null,
      message = null,
      required = false
    } = options

    logger.info(`Requesting consent for: ${type}`)

    // If showUI is false, return false
    if (!showUI) {
      return false
    }

    // Create consent request
    const request = {
      type,
      title: title || this.getConsentTitle(type),
      message: message || this.getConsentMessage(type),
      required,
      timestamp: Date.now()
    }

    // Dispatch consent request event
    this.dispatchConsentEvent('consent-requested', request)

    // Show consent modal (if UI available)
    const result = await this.showConsentModal(request)

    // Update consent state
    await this.updateConsent(type, result.status, request.version || '1.0.0')

    // Dispatch consent result event
    this.dispatchConsentEvent('consent-responded', {
      type,
      status: result.status,
      timestamp: Date.now()
    })

    return result.status === ConsentStatus.ACCEPTED
  }

  /**
   * Accept consent
   * @param {string} type - Consent type
   * @returns {Promise<boolean>} True if successful
   */
  async acceptConsent(type) {
    logger.info(`User accepted consent for: ${type}`)
    
    await this.updateConsent(type, ConsentStatus.ACCEPTED)
    
    this.dispatchConsentEvent('consent-accepted', {
      type,
      timestamp: Date.now()
    })

    return true
  }

  /**
   * Decline consent
   * @param {string} type - Consent type
   * @returns {Promise<boolean>} True if successful
   */
  async declineConsent(type) {
    logger.info(`User declined consent for: ${type}`)
    
    await this.updateConsent(type, ConsentStatus.DECLINED)
    
    this.dispatchConsentEvent('consent-declined', {
      type,
      timestamp: Date.now()
    })

    return true
  }

  /**
   * Revoke consent
   * @param {string} type - Consent type
   * @returns {Promise<boolean>} True if successful
   */
  async revokeConsent(type) {
    logger.info(`User revoked consent for: ${type}`)
    
    await this.updateConsent(type, ConsentStatus.REVOKED)
    
    this.dispatchConsentEvent('consent-revoked', {
      type,
      timestamp: Date.now()
    })

    return true
  }

  /**
   * Update consent state
   * @param {string} type - Consent type
   * @param {string} status - Consent status
   * @param {string} version - Consent version
   */
  async updateConsent(type, status, version = '1.0.0') {
    if (!this.consentState) {
      await this.initialize()
    }
    if (!this.consentState[type]) {
      this.consentState[type] = {
        status: ConsentStatus.NOT_REQUIRED,
        version: '1.0.0',
        timestamp: null
      }
    }

    this.consentState[type] = {
      ...this.consentState[type],
      status,
      version,
      timestamp: Date.now()
    }

    // Save to storage
    await storage.set('user_consent', this.consentState)
  }

  /**
   * Get consent title
   * @param {string} type - Consent type
   * @returns {string} Title
   */
  getConsentTitle(type) {
    const titles = {
      [ConsentTypes.PRIVACY_POLICY]: 'Privacy Policy',
      [ConsentTypes.DATA_COLLECTION]: 'Data Collection',
      [ConsentTypes.CONTEXT_AWARENESS]: 'Page Context',
      [ConsentTypes.MODEL_SELECTION]: 'Model Selection',
      [ConsentTypes.PROVIDER_CONFIG]: 'Provider Configuration'
    }
    return titles[type] || 'Consent Required'
  }

  /**
   * Get consent message
   * @param {string} type - Consent type
   * @returns {string} Message
   */
  getConsentMessage(type) {
    const messages = {
      [ConsentTypes.PRIVACY_POLICY]: 'Please review our Privacy Policy to continue using CTRL Extension.',
      [ConsentTypes.DATA_COLLECTION]: 'CTRL Extension stores your API keys locally and encrypted. Your data never leaves your browser.',
      [ConsentTypes.CONTEXT_AWARENESS]: 'Allow CTRL Extension to include page content in your conversations for better context?',
      [ConsentTypes.MODEL_SELECTION]: 'Select the AI models you want to use.',
      [ConsentTypes.PROVIDER_CONFIG]: 'Configure API keys for your preferred AI providers.'
    }
    return messages[type] || 'Please provide your consent.'
  }

  /**
   * Show consent modal
   * @param {Object} request - Consent request
   * @returns {Promise<Object>} User response
   */
  async showConsentModal(request) {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        resolve({ status: ConsentStatus.DECLINED })
        return
      }
      const event = new CustomEvent('show-consent-modal', {
        detail: request,
        callback: resolve
      })
      document.dispatchEvent(event)
      setTimeout(() => resolve({ status: ConsentStatus.DECLINED }), 30000)
    })
  }

  /**
   * Close consent modal
   */
  closeConsentModal() {
    const event = new CustomEvent('close-consent-modal')
    document.dispatchEvent(event)
  }

  /**
   * Dispatch consent event
   * @param {string} eventType - Event type
   * @param {Object} detail - Event detail
   */
  dispatchConsentEvent(eventType, detail) {
    const event = new CustomEvent(eventType, { detail })
    document.dispatchEvent(event)
  }

  /**
   * Add consent listener
   * @param {string} eventType - Event type
   * @param {Function} callback - Callback function
   */
  addListener(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType).add(callback)

    document.addEventListener(eventType, callback)
  }

  /**
   * Remove consent listener
   * @param {string} eventType - Event type
   * @param {Function} callback - Callback function
   */
  removeListener(eventType, callback) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(callback)
    }

    document.removeEventListener(eventType, callback)
  }

  /**
   * Get all consent state
   * @returns {Object} All consents
   */
  getAllConsents() {
    return { ...this.consentState }
  }

  /**
   * Export consent state
   * @returns {string} JSON string
   */
  exportConsents() {
    return JSON.stringify(this.consentState, null, 2)
  }

  /**
   * Import consent state
   * @param {string} json - JSON string
   * @returns {boolean} True if successful
   */
  importConsents(json) {
    try {
      const imported = JSON.parse(json)
      this.consentState = imported
      storage.set('user_consent', this.consentState)
      logger.info('Consent state imported successfully')
      return true
    } catch (error) {
      logger.error('Failed to import consent state:', error)
      return false
    }
  }

  /**
   * Reset all consents
   */
  async resetConsents() {
    this.consentState = { ...DEFAULT_CONSENT_STATE }
    await storage.set('user_consent', this.consentState)
    logger.info('All consents reset to default state')
  }

  /**
   * Get consent summary
   * @returns {Object} Consent summary
   */
  getConsentSummary() {
    const summary = {
      total: Object.keys(this.consentState).length,
      accepted: 0,
      declined: 0,
      pending: 0,
      notAsked: 0,
      notRequired: 0,
      byType: {}
    }

    for (const [type, consent] of Object.entries(this.consentState)) {
      summary.byType[type] = consent.status
      
      switch (consent.status) {
        case ConsentStatus.ACCEPTED:
          summary.accepted++
          break
        case ConsentStatus.DECLINED:
        case ConsentStatus.REVOKED:
          summary.declined++
          break
        case ConsentStatus.PENDING:
          summary.pending++
          break
        case ConsentStatus.NOT_ASKED:
          summary.notAsked++
          break
        case ConsentStatus.NOT_REQUIRED:
          summary.notRequired++
          break
      }
    }

    return summary
  }
}

// Singleton instance
export const consentManager = new ConsentManager()

/**
 * Initialize consent manager
 * @returns {Promise<Object>} Consent state
 */
export async function initializeConsent() {
  return consentManager.initialize()
}

/**
 * Check if user has consented
 * @param {string} type - Consent type
 * @returns {boolean} True if consented
 */
export function hasConsented(type) {
  return consentManager.hasConsented(type)
}

/**
 * Request user consent
 * @param {string} type - Consent type
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} True if consented
 */
export async function requestConsent(type, options = {}) {
  return consentManager.requestConsent(type, options)
}

/**
 * Accept consent
 * @param {string} type - Consent type
 * @returns {Promise<boolean>} True if successful
 */
export async function acceptConsent(type) {
  return consentManager.acceptConsent(type)
}

/**
 * Decline consent
 * @param {string} type - Consent type
 * @returns {Promise<boolean>} True if successful
 */
export async function declineConsent(type) {
  return consentManager.declineConsent(type)
}

/**
 * Revoke consent
 * @param {string} type - Consent type
 * @returns {Promise<boolean>} True if successful
 */
export async function revokeConsent(type) {
  return consentManager.revokeConsent(type)
}

/**
 * Get all consents
 * @returns {Object} All consents
 */
export function getAllConsents() {
  return consentManager.getAllConsents()
}

/**
 * Get consent summary
 * @returns {Object} Consent summary
 */
export function getConsentSummary() {
  return consentManager.getConsentSummary()
}

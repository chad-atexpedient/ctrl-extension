import { getLogger } from './logger.js'

const logger = getLogger('ConfigValidator')

export const FeatureFlags = {
  SIDE_PANEL: 'sidePanel',
  STORAGE: 'storage',
  ACTIVE_TAB: 'activeTab',
  SCRIPTING: 'scripting',
  TABS: 'tabs',
  COMMANDS: 'commands',
  CONTENT_SCRIPTS: 'contentScripts',
  CSP: 'contentSecurityPolicy',
  SANDBOX: 'sandbox',
  OFFSCREEN: 'offscreen',
  WEB_CRYPTO: 'webCrypto',
  FETCH: 'fetch',
  CHROME_RUNTIME: 'chromeRuntime',
  EXTENSION_STORAGE: 'extensionStorage'
}

export class ConfigValidator {
  constructor() {
    this.validatedFeatures = new Map()
    this.validationResults = null
  }

  /**
   * Validate all required features at runtime
   * @returns {Object} Validation results
   */
  validateAll() {
    const results = {
      valid: true,
      features: {},
      permissions: {},
      apis: {},
      missingFeatures: [],
      missingPermissions: [],
      missingApis: [],
      degradations: []
    }

    // Validate each feature
    for (const [flagName, flagKey] of Object.entries(FeatureFlags)) {
      const featureResult = this.validateFeature(flagKey)
      results.features[flagKey] = featureResult

      if (!featureResult.available) {
        results.valid = false
        results.missingFeatures.push(flagKey)
        if (featureResult.degradation) {
          results.degradations.push(featureResult.degradation)
        }
      }
    }

    // Validate permissions
    const permissionsResult = this.validatePermissions()
    results.permissions = permissionsResult
    if (!permissionsResult.valid) {
      results.valid = false
      results.missingPermissions.push(...permissionsResult.missing)
    }

    // Validate APIs
    const apisResult = this.validateApis()
    results.apis = apisResult
    if (!apisResult.valid) {
      results.valid = false
      results.missingApis.push(...apisResult.missing)
    }

    this.validationResults = results
    this.logValidationResults(results)

    return results
  }

  /**
   * Validate a single feature
   * @param {string} feature - Feature flag
   * @returns {Object} Feature validation result
   */
  validateFeature(feature) {
    const result = {
      available: true,
      supported: true,
      required: true,
      degradation: null
    }

    switch (feature) {
      case FeatureFlags.SIDE_PANEL:
        result.available = !!chrome?.sidePanel
        result.supported = result.available
        result.required = true
        result.degradation = !result.available ? {
          type: 'feature_unavailable',
          feature: 'Side Panel',
          fallback: 'Use popup interface instead',
          message: 'Side panel API not available. Falling back to popup interface.'
        } : null
        break

      case FeatureFlags.STORAGE:
        result.available = !!chrome?.storage
        result.supported = result.available
        result.required = true
        result.degradation = !result.available ? {
          type: 'feature_unavailable',
          feature: 'Storage',
          fallback: 'Use localStorage (settings will not sync)',
          message: 'Chrome storage API not available. Using localStorage fallback.'
        } : null
        break

      case FeatureFlags.ACTIVE_TAB:
        result.available = !!chrome?.tabs?.get
        result.supported = result.available
        result.required = true
        result.degradation = !result.available ? {
          type: 'feature_unavailable',
          feature: 'Active Tab',
          fallback: 'Context awareness limited',
          message: 'Active tab API not available. Page context may be limited.'
        } : null
        break

      case FeatureFlags.SCRIPTING:
        result.available = !!chrome?.scripting
        result.supported = result.available
        result.required = false // Not critical
        result.degradation = !result.available ? {
          type: 'feature_unavailable',
          feature: 'Scripting API',
          fallback: 'Cannot inject scripts programmatically',
          message: 'Scripting API not available. Script injection features disabled.'
        } : null
        break

      case FeatureFlags.TABS:
        result.available = !!chrome?.tabs
        result.supported = result.available
        result.required = true
        result.degradation = !result.available ? {
          type: 'feature_unavailable',
          feature: 'Tabs API',
          fallback: 'Limited tab management',
          message: 'Tabs API not available. Tab features limited.'
        } : null
        break

      case FeatureFlags.COMMANDS:
        result.available = !!chrome?.commands
        result.supported = result.available
        result.required = false // Not critical
        result.degradation = !result.available ? {
          type: 'feature_unavailable',
          feature: 'Keyboard Shortcuts',
          fallback: 'Use mouse interactions',
          message: 'Commands API not available. Keyboard shortcuts disabled.'
        } : null
        break

      case FeatureFlags.CONTENT_SCRIPTS:
        result.available = true // Always available if manifest is valid
        result.supported = true
        result.required = true
        result.degradation = null
        break

      case FeatureFlags.CSP:
        result.available = !!chrome?.runtime?.getManifest?.()?.content_security_policy
        result.supported = result.available
        result.required = false // Not critical
        result.degradation = !result.available ? {
          type: 'feature_unavailable',
          feature: 'Content Security Policy',
          fallback: 'Less secure (but functional)',
          message: 'CSP not configured. Extension will be less secure.'
        } : null
        break

      case FeatureFlags.SANDBOX:
        result.available = !!chrome?.runtime?.getManifest?.()?.sandbox
        result.supported = result.available
        result.required = true // Required for agent workspace
        result.degradation = !result.available ? {
          type: 'feature_unavailable',
          feature: 'Agent Sandbox',
          fallback: 'Agent features disabled',
          message: 'Sandbox not available. Agent workspace disabled.'
        } : null
        break

      case FeatureFlags.OFFSCREEN:
        result.available = !!chrome?.offscreen
        result.supported = result.available
        result.required = false // Not critical
        result.degradation = !result.available ? {
          type: 'feature_unavailable',
          feature: 'Offscreen API',
          fallback: 'Background processing only',
          message: 'Offscreen API not available. Some features may be slower.'
        } : null
        break

      case FeatureFlags.WEB_CRYPTO:
        result.available = !!(typeof self !== 'undefined' ? self?.crypto?.subtle : window?.crypto?.subtle)
        result.supported = result.available
        result.required = true // Required for encryption
        result.degradation = !result.available ? {
          type: 'feature_unavailable',
          feature: 'Web Crypto API',
          fallback: 'API keys stored in plain text',
          message: 'Web Crypto API not available. API keys will NOT be encrypted!'
        } : null
        break

      case FeatureFlags.FETCH:
        result.available = typeof fetch !== 'undefined'
        result.supported = result.available
        result.required = true // Required for API calls
        result.degradation = !result.available ? {
          type: 'feature_unavailable',
          feature: 'Fetch API',
          fallback: 'Use XMLHttpRequest',
          message: 'Fetch API not available. Using XMLHttpRequest fallback.'
        } : null
        break

      case FeatureFlags.CHROME_RUNTIME:
        result.available = !!chrome?.runtime
        result.supported = result.available
        result.required = true // Required for extension
        result.degradation = !result.available ? {
          type: 'feature_unavailable',
          feature: 'Chrome Runtime',
          fallback: 'Extension features disabled',
          message: 'Chrome runtime not available. Extension features disabled.'
        } : null
        break

      case FeatureFlags.EXTENSION_STORAGE:
        result.available = !!chrome?.storage?.local
        result.supported = result.available
        result.required = true // Required for settings
        result.degradation = !result.available ? {
          type: 'feature_unavailable',
          feature: 'Extension Storage',
          fallback: 'Use localStorage',
          message: 'Extension storage not available. Using localStorage fallback.'
        } : null
        break

      default:
        result.available = false
        result.supported = false
        result.required = false
        result.degradation = {
          type: 'unknown_feature',
          feature: feature,
          fallback: 'Unknown feature',
          message: `Unknown feature: ${feature}`
        }
    }

    this.validatedFeatures.set(feature, result)
    return result
  }

  /**
   * Validate permissions
   * @returns {Object} Permissions validation result
   */
  validatePermissions() {
    let manifest
    try {
      manifest = chrome.runtime?.getManifest?.()
    } catch (e) {
      return { valid: false, granted: [], missing: [], error: e.message }
    }
    const requiredPermissions = manifest?.permissions || []
    const hostPermissions = manifest?.host_permissions || []

    const result = {
      valid: true,
      granted: requiredPermissions,
      missing: []
    }

    // Check if permissions are granted
    // Only check permissions that have corresponding chrome.* API namespaces.
    // Permissions like 'activeTab', 'unlimitedStorage', 'contextMenus', and host
    // permissions are declarative/manifest-only and don't have chrome.* properties.
    const chromeNamespaces = new Set([
      'storage', 'runtime', 'tabs', 'scripting', 'debugger', 'notifications',
      'alarms', 'sidePanel', 'identity', 'geolocation', 'clipboard',
      'favicon', 'history', 'topSites', 'bookmarks', 'webNavigation',
      'webRequest', 'webRequestBlocking', 'declarativeContent', 'declarativeNetRequest',
      'declarativeNetRequestWithHostAccess', 'power', 'system', 'documentScan',
      'displaySource', 'hid', 'usb', 'serial', 'bluetooth', 'bluetoothDevices',
      'platformKeys', 'enterprise', 'fileSystemProvider', 'fs', 'vpnProvider',
      'wallpaper', 'printing', 'printingMetrics', 'sessions', 'documentIcon',
      'downloads', 'downloads.open', 'downloads.shelf', 'enterprise', 'fileBrowserHandler',
      'input', 'lockScreen', 'mediaGalleries', 'musicManager', 'networking',
      'networking.config', 'notifications', 'pageCapture', 'permissions', 'pushMessaging',
      'sessionStorage', 'signedInDevices', 'socket', 'syncFileSystem', 'system.cpu',
      'system.display', 'system.memory', 'system.storage', 'tts', 'ttsEngine',
      'vpn', 'webRequest', 'webNavigation'
    ])
    for (const perm of requiredPermissions) {
      if (!chromeNamespaces.has(perm) || !chrome?.[perm]) {
        result.valid = false
        result.missing.push(perm)
      }
    }

    return result
  }

  /**
   * Validate APIs
   * @returns {Object} API validation result
   */
  validateApis() {
    const result = {
      valid: true,
      available: [],
      missing: []
    }

    // Check for critical APIs
    const criticalApis = [
      { name: 'storage', available: !!chrome?.storage },
      { name: 'runtime', available: !!chrome?.runtime },
      { name: 'tabs', available: !!chrome?.tabs },
      { name: 'scripting', available: !!chrome?.scripting }
    ]

    for (const api of criticalApis) {
      if (api.available) {
        result.available.push(api.name)
      } else {
        result.valid = false
        result.missing.push(api.name)
      }
    }

    return result
  }

  /**
   * Check if a feature is available
   * @param {string} feature - Feature flag
   * @returns {boolean} True if feature is available
   */
  isFeatureAvailable(feature) {
    const cached = this.validatedFeatures.get(feature)
    if (cached) {
      return cached.available
    }

    const result = this.validateFeature(feature)
    return result.available
  }

  /**
   * Get feature validation result
   * @param {string} feature - Feature flag
   * @returns {Object|null} Feature validation result
   */
  getFeatureValidation(feature) {
    return this.validatedFeatures.get(feature) || null
  }

  /**
   * Get all validation results
   * @returns {Object|null} All validation results
   */
  getValidationResults() {
    return this.validationResults
  }

  /**
   * Apply graceful degradation based on validation results
   */
  applyGracefulDegradation() {
    if (!this.validationResults || !this.validationResults.degradations) {
      return
    }

    const degradations = this.validationResults.degradations

    for (const degradation of degradations) {
      this.applyDegradation(degradation)
    }
  }

  /**
   * Apply a single degradation
   * @param {Object} degradation - Degradation info
   */
  applyDegradation(degradation) {
    logger.warn(`Applying degradation: ${degradation.message}`)

    switch (degradation.type) {
      case 'feature_unavailable':
        this.handleFeatureUnavailable(degradation)
        break

      case 'permission_missing':
        this.handlePermissionMissing(degradation)
        break

      case 'api_missing':
        this.handleApiMissing(degradation)
        break

      default:
        logger.warn(`Unknown degradation type: ${degradation.type}`)
    }
  }

  /**
   * Handle unavailable feature
   * @param {Object} degradation - Degradation info
   */
  handleFeatureUnavailable(degradation) {
    // Log feature degradation (can't dispatch events in service worker)
    logger.warn(`Feature degraded: ${degradation.feature}`, degradation)

    // Store degradation state for reference — merge with existing degradations
    if (chrome?.storage?.local) {
      chrome.storage.local.get('featureDegradations', (stored) => {
        const existing = stored?.featureDegradations || {}
        existing[degradation.feature] = degradation
        chrome.storage.local.set({ featureDegradations: existing })
      })
    }
  }

  /**
   * Handle missing permission
   * @param {Object} degradation - Degradation info
   */
  handlePermissionMissing(degradation) {
    logger.error(`Missing permission: ${degradation.feature}`)
    
    // Log permission requirement (can't dispatch events in service worker)
    logger.warn(`Permission required: ${degradation.feature}`, degradation)
  }

  /**
   * Handle missing API
   * @param {Object} degradation - Degradation info
   */
  handleApiMissing(degradation) {
    logger.error(`Missing API: ${degradation.feature}`)
    logger.warn(`API unavailable: ${degradation.feature}`, degradation)
  }

  /**
   * Log validation results
   * @param {Object} results - Validation results
   */
  logValidationResults(results) {
    logger.info('=== Configuration Validation Results ===')
    logger.info(`Overall Valid: ${results.valid}`)
    logger.info(`Missing Features: ${results.missingFeatures.join(', ') || 'None'}`)
    logger.info(`Missing Permissions: ${results.missingPermissions.join(', ') || 'None'}`)
    logger.info(`Missing APIs: ${results.missingApis.join(', ') || 'None'}`)

    if (results.degradations.length > 0) {
      logger.warn(`Applied ${results.degradations.length} degradations:`)
      for (const deg of results.degradations) {
        logger.warn(`  - ${deg.message}`)
      }
    }

    logger.info('========================================')
  }

  /**
   * Get user-friendly validation summary
   * @returns {string} Human-readable summary
   */
  getValidationSummary() {
    if (!this.validationResults) {
      return 'Validation not performed yet. Call validateAll() first.'
    }

    const { valid, missingFeatures, missingPermissions, missingApis, degradations } = this.validationResults

    if (valid) {
      return 'All required features are available and configured correctly.'
    }

    let summary = 'Some issues were detected:\n\n'

    if (missingFeatures.length > 0) {
      summary += `Missing Features (${missingFeatures.length}):\n`
      for (const feature of missingFeatures) {
        const result = this.validatedFeatures.get(feature)
        if (result?.degradation) {
          summary += `  - ${result.degradation.feature}: ${result.degradation.message}\n`
        }
      }
      summary += '\n'
    }

    if (missingPermissions.length > 0) {
      summary += `Missing Permissions (${missingPermissions.length}):\n`
      for (const perm of missingPermissions) {
        summary += `  - ${perm}\n`
      }
      summary += '\n'
    }

    if (missingApis.length > 0) {
      summary += `Missing APIs (${missingApis.length}):\n`
      for (const api of missingApis) {
        summary += `  - ${api}\n`
      }
      summary += '\n'
    }

    if (degradations.length > 0) {
      summary += `Applied ${degradations.length} fallbacks for missing features.\n`
    }

    return summary
  }
}

// Singleton instance
export const configValidator = new ConfigValidator()

/**
 * Initialize configuration validation
 * Called on extension startup
 */
export async function initializeConfigValidation() {
  logger.info('Initializing configuration validation...')

  const results = configValidator.validateAll()

  if (!results.valid) {
    logger.warn('Configuration validation failed. Applying graceful degradation...')
    configValidator.applyGracefulDegradation()
  }

  return results
}

/**
 * Check if extension is running in supported environment
 * @returns {boolean} True if environment is supported
 */
export function isEnvironmentSupported() {
  const results = configValidator.validateAll()
  return results.valid
}

/**
 * Get list of available features
 * @returns {Array<string>} Available feature names
 */
export function getAvailableFeatures() {
  const results = configValidator.validateAll()
  return Object.entries(results.features)
    .filter(([_, result]) => result.available)
    .map(([name, _]) => name)
}

/**
 * Get list of unavailable features
 * @returns {Array<Object>} Unavailable features with degradation info
 */
export function getUnavailableFeatures() {
  const results = configValidator.validateAll()
  return Object.entries(results.features)
    .filter(([_, result]) => !result.available)
    .map(([name, result]) => ({
      feature: name,
      degradation: result.degradation
    }))
}

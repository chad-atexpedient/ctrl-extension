/**
 * Model Validation for CTRL Extension
 *
 * Features:
 * - Model ID format validation
 * - Model existence validation
 * - Provider-specific validation rules
 * - Model sanitization
 * - Comprehensive error messages
 */

import { PROVIDERS } from './storage.js';
import { getLogger } from './logger.js';

const logger = getLogger('ModelValidator');

/**
 * Provider-specific model validation rules.
 *
 * Historically this used a hand-enumerated regex per vendor (e.g. minimax required
 * `/^minimax-[0-9]+$/`, which rejects every real MiniMax model ID like `minimax-m2.5` or
 * `minimax-m2-highspeed` since they contain letters/dots the pattern didn't allow — same
 * problem hit openai (`gpt-4o` didn't match `gpt-[34][-.][0-9]+`) and anthropic (`claude-4.5-sonnet`
 * didn't match `claude-[23]...`). Vendor model-naming schemes change too often for a strict
 * enumerated regex to keep up, and a stale pattern silently blocks valid, real models — the
 * opposite of what a validator should do.
 *
 * `pattern` is now a loose per-provider prefix + safe-character check; `modelExists()` below
 * (which checks the live PROVIDERS catalog) remains the authoritative existence check. This
 * still rejects garbage/malicious input via the character/length checks, but won't reject a
 * real model just because its name doesn't match last year's naming convention.
 */
function buildPrefixPattern(prefixes) {
  const escaped = prefixes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const alt = escaped.join('|')
  // literal prefix, then any run of alphanumerics, then zero or more (dot-or-hyphen + alphanumerics) segments
  return new RegExp(`^(?:${alt})[a-z0-9]*(?:[.-][a-z0-9]+)*$`, 'i')
}

const MODEL_VALIDATION_RULES = {
  openai: {
    pattern: buildPrefixPattern(['gpt-', 'o1', 'o3', 'chatgpt-']),
    maxLength: 50,
    minLength: 2,
    allowedPrefixes: ['gpt', 'o'],
    examples: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o3-mini']
  },
  anthropic: {
    pattern: buildPrefixPattern(['claude-']),
    maxLength: 60,
    minLength: 5,
    allowedPrefixes: ['claude'],
    examples: ['claude-3-opus', 'claude-3.5-sonnet', 'claude-4.5-sonnet', 'claude-instant-1.2']
  },
  google: {
    pattern: buildPrefixPattern(['gemini-']),
    maxLength: 50,
    minLength: 5,
    allowedPrefixes: ['gemini'],
    examples: ['gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-pro', 'gemini-1.5-pro']
  },
  zai: {
    pattern: buildPrefixPattern(['glm-']),
    maxLength: 30,
    minLength: 3,
    allowedPrefixes: ['glm'],
    examples: ['glm-4', 'glm-4.9-turbo', 'glm-3-turbo']
  },
  meta: {
    pattern: buildPrefixPattern(['llama-']),
    maxLength: 30,
    minLength: 3,
    allowedPrefixes: ['llama'],
    examples: ['llama-2-7b', 'llama-3-70b', 'llama-2-13b']
  },
  mistral: {
    pattern: buildPrefixPattern(['mistral-', 'codestral', 'mixtral-']),
    maxLength: 40,
    minLength: 5,
    allowedPrefixes: ['mistral', 'codestral', 'mixtral'],
    examples: ['mistral-large', 'mistral-medium', 'codestral']
  },
  deepseek: {
    pattern: buildPrefixPattern(['deepseek-']),
    maxLength: 30,
    minLength: 5,
    allowedPrefixes: ['deepseek'],
    examples: ['deepseek-chat', 'deepseek-coder', 'deepseek-v3']
  },
  minimax: {
    // Real IDs: minimax-m2, minimax-m2.5, minimax-m2.5-highspeed, minimax-m3, minimax-text-01
    pattern: buildPrefixPattern(['minimax-']),
    maxLength: 40,
    minLength: 5,
    allowedPrefixes: ['minimax'],
    examples: ['minimax-m2', 'minimax-m2.5', 'minimax-m2.5-highspeed', 'minimax-m3']
  },
  alibaba: {
    pattern: buildPrefixPattern(['qwen-']),
    maxLength: 30,
    minLength: 5,
    allowedPrefixes: ['qwen'],
    examples: ['qwen-2.5-plus', 'qwen-turbo', 'qwen-max', 'qwen-72b']
  },
  openrouter: {
    // OpenRouter model IDs are namespaced, e.g. "anthropic-claude-3.5-sonnet", "deepseek-v3"
    pattern: /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i,
    maxLength: 80,
    minLength: 2,
    allowedPrefixes: [],
    examples: ['deepseek-v3', 'anthropic-claude-3.5-sonnet']
  },
  groq: {
    pattern: /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i,
    maxLength: 50,
    minLength: 2,
    allowedPrefixes: [],
    examples: ['mixtral-8x7b', 'llama-3.1-70b']
  },
  custom: {
    // Custom providers can have various formats
    pattern: /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i,
    maxLength: 100,
    minLength: 1,
    allowedPrefixes: [],
    examples: []
  }
};

/**
 * Model validator class
 */
export class ModelValidator {
  constructor() {
    this.validationCache = new Map()
  }

  /**
   * Validate a model ID
   * @param {string} modelId - Model ID to validate
   * @param {string} providerId - Provider ID
   * @returns {Object} Validation result
   */
  validateModel(modelId, providerId) {
    // Check cache
    const cacheKey = `${providerId}:${modelId}`
    if (this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey)
    }

    const result = {
      isValid: false,
      modelId: modelId,
      providerId,
      errors: []
    }

    // Basic sanitization
    const sanitization = this.sanitizeModelId(modelId)
    if (!sanitization.isValid) {
      result.isValid = false
      result.errors.push({
        type: 'sanitization',
        message: sanitization.error
      })
      this.validationCache.set(cacheKey, result)
      return result
    }

    result.modelId = sanitization.modelId

    // Get provider validation rules
    const rules = MODEL_VALIDATION_RULES[providerId] || MODEL_VALIDATION_RULES.custom

    // Check pattern
    if (rules.pattern) {
      const patternTest = rules.pattern.test(result.modelId)
      if (!patternTest) {
        result.isValid = false
        result.errors.push({
          type: 'format',
          message: `Invalid model format for ${providerId}. Expected format: ${rules.examples.slice(0, 2).join(', ')}...`
        })
      }
    }

    // Check length
    if (rules.minLength && result.modelId.length < rules.minLength) {
      result.isValid = false
      result.errors.push({
        type: 'length',
        message: `Model ID too short. Minimum ${rules.minLength} characters.`
      })
    }

    if (rules.maxLength && result.modelId.length > rules.maxLength) {
      result.isValid = false
      result.errors.push({
        type: 'length',
        message: `Model ID too long. Maximum ${rules.maxLength} characters.`
      })
    }

    // Check for invalid characters
    const invalidChars = this.checkInvalidCharacters(result.modelId)
    if (invalidChars.length > 0) {
      result.isValid = false
      result.errors.push({
        type: 'characters',
        message: `Invalid characters: ${invalidChars.join(', ')}`
      })
    }

    // If no errors, model is valid
    if (result.errors.length === 0) {
      result.isValid = true
    }

    this.validationCache.set(cacheKey, result)
    logger.debug('Model validation result', {
      modelId,
      providerId,
      result
    })

    return result
  }

  /**
   * Check if model exists in provider's model list
   * @param {string} modelId - Model ID to check
   * @param {string} providerId - Provider ID
   * @returns {boolean} True if model exists
   */
  modelExists(modelId, providerId) {
    const provider = PROVIDERS[providerId]

    if (!provider) {
      logger.warn(`Provider not found: ${providerId}`)
      return false
    }

    // Check if model ID is in provider's model list
    const exists = provider.models && provider.models.some(
      model => model.id.toLowerCase() === modelId.toLowerCase()
    )

    logger.debug('Model existence check', {
      modelId,
      providerId,
      exists
    })

    return exists
  }

  /**
   * Validate multiple models
   * @param {Array} modelIds - Array of model IDs
   * @param {string} providerId - Provider ID
   * @returns {Object} Validation result
   */
  validateModels(modelIds, providerId) {
    const results = []
    const errors = []
    let isValid = true

    for (let i = 0; i < modelIds.length; i++) {
      const modelId = modelIds[i]
      const result = this.validateModel(modelId, providerId)

      results.push(result)

      if (!result.isValid) {
        isValid = false
        errors.push(...result.errors)
      }
    }

    const overallResult = {
      isValid,
      modelId: null,
      providerId,
      modelIds: modelIds,
      results,
      errors: errors.length > 0 ? errors : undefined,
      validCount: modelIds.length - errors.length,
      invalidCount: errors.length
    }

    logger.debug('Multiple models validation', overallResult)

    return overallResult
  }

  /**
   * Sanitize model ID
   * @param {string} modelId - Model ID to sanitize
   * @returns {Object} Sanitization result
   */
  sanitizeModelId(modelId) {
    if (!modelId || typeof modelId !== 'string') {
      return {
        isValid: false,
        modelId: null,
        error: 'Model ID is required and must be a string'
      }
    }

    // Trim whitespace
    let sanitized = modelId.trim()

    // Remove or replace special characters
    // Allow alphanumeric, hyphens, periods, and underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '')

    // Convert to lowercase for comparison (case-insensitive model IDs)
    const lowercase = sanitized.toLowerCase()

    if (sanitized === '') {
      return {
        isValid: false,
        modelId: null,
        error: 'Model ID cannot be empty or only special characters'
      }
    }

    return {
      isValid: true,
      modelId: sanitized,
      error: null
    }
  }

  /**
   * Check for invalid characters in model ID
   * @param {string} modelId - Model ID to check
   * @returns {Array} Array of invalid characters
   */
  checkInvalidCharacters(modelId) {
    const invalidChars = []
    const validChars = /[a-zA-Z0-9._-]/

    for (const char of modelId) {
      if (!validChars.test(char)) {
        if (!invalidChars.includes(char)) {
          invalidChars.push(char)
        }
      }
    }

    return invalidChars
  }

  /**
   * Get validation rules for a provider
   * @param {string} providerId - Provider ID
   * @returns {Object} Validation rules
   */
  getValidationRules(providerId) {
    return MODEL_VALIDATION_RULES[providerId] || MODEL_VALIDATION_RULES.custom
  }

  /**
   * Validate model selection count
   * @param {Array} modelIds - Array of selected model IDs
   * @param {number} maxAllowed - Maximum number of models allowed
   * @returns {Object} Validation result
   */
  validateSelectionCount(modelIds, maxAllowed = 2) {
    const count = modelIds.length

    if (count === 0) {
      return {
        isValid: false,
        error: 'At least one model must be selected'
      }
    }

    if (count > maxAllowed) {
      return {
        isValid: false,
        error: `Maximum ${maxAllowed} models allowed. You have selected ${count} models.`
      }
    }

    return {
      isValid: true,
      error: null
    }
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear()
    logger.debug('Validation cache cleared')
  }
}

// Singleton instance
let globalValidator = null

/**
 * Get or create global model validator
 * @param {Object} options - Validator options
 * @returns {ModelValidator} Global validator instance
 */
export function getModelValidator(options = {}) {
  if (!globalValidator) {
    globalValidator = new ModelValidator(options)
  }
  return globalValidator
}

/**
 * Validate a model using global validator
 * @param {string} modelId - Model ID to validate
 * @param {string} providerId - Provider ID
 * @returns {Object} Validation result
 */
export function validateModel(modelId, providerId) {
  const validator = getModelValidator()
  return validator.validateModel(modelId, providerId)
}

/**
 * Check if model exists using global validator
 * @param {string} modelId - Model ID to check
 * @param {string} providerId - Provider ID
 * @returns {boolean} True if model exists
 */
export function modelExists(modelId, providerId) {
  const validator = getModelValidator()
  return validator.modelExists(modelId, providerId)
}

/**
 * Validate multiple models using global validator
 * @param {Array} modelIds - Array of model IDs
 * @param {string} providerId - Provider ID
 * @returns {Object} Validation result
 */
export function validateModels(modelIds, providerId) {
  const validator = getModelValidator()
  return validator.validateModels(modelIds, providerId)
}

/**
 * Validate model selection count using global validator
 * @param {Array} modelIds - Array of selected model IDs
 * @param {number} maxAllowed - Maximum number of models allowed
 * @returns {Object} Validation result
 */
export function validateSelectionCount(modelIds, maxAllowed) {
  const validator = getModelValidator()
  return validator.validateSelectionCount(modelIds, maxAllowed)
}

/**
 * Sanitize a model ID using global validator
 * @param {string} modelId - Model ID to sanitize
 * @returns {Object} Sanitization result
 */
export function sanitizeModelId(modelId) {
  const validator = getModelValidator()
  return validator.sanitizeModelId(modelId)
}

/**
 * Get validation rules for a provider using global validator
 * @param {string} providerId - Provider ID
 * @returns {Object} Validation rules
 */
export function getModelValidationRules(providerId) {
  const validator = getModelValidator()
  return validator.getValidationRules(providerId)
}

/**
 * Clear validation cache using global validator
 */
export function clearModelValidationCache() {
  const validator = getModelValidator()
  validator.clearCache()
}

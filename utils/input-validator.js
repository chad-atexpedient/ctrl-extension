import { ValidationError } from './errors.js'

export class InputValidator {
  constructor() {
    this.validationRules = {
      message: {
        minContentLength: 0,
        maxContentLength: 100000,
        allowedRoles: ['user', 'assistant', 'system'],
        maxMessages: 100
      },
      config: {
        minTemperature: 0,
        maxTemperature: 2,
        defaultTemperature: 0.7,
        minMaxTokens: 1,
        maxMaxTokens: 100000,
        defaultMaxTokens: 2000
      },
      apiKey: {
        minLength: 1,
        maxLength: 500,
        pattern: /^[a-zA-Z0-9\-_\.]+$/
      }
    }
  }

  /**
   * Validate chat request
   * @param {Array} messages - Array of message objects
   * @param {Object} options - Configuration options
   * @returns {Object} Validation result { valid, errors, warnings }
   */
  validateChatRequest(messages, options = {}) {
    const errors = []
    const warnings = []

    if (!messages) {
      errors.push('Messages array is required')
      return { valid: false, errors, warnings }
    }

    if (!Array.isArray(messages)) {
      errors.push('Messages must be an array')
      return { valid: false, errors, warnings }
    }

    if (messages.length === 0) {
      errors.push('Messages array cannot be empty')
      return { valid: false, errors, warnings }
    }

    if (messages.length > this.validationRules.message.maxMessages) {
      warnings.push(`Large number of messages (${messages.length}). Consider truncating older messages.`)
    }

    const validationResults = messages.map((msg, index) => this.validateMessage(msg, index))
    
    for (const result of validationResults) {
      if (!result.valid) {
        errors.push(...result.errors.map(err => `Message ${result.index}: ${err}`))
      }
      if (result.warnings && result.warnings.length > 0) {
        warnings.push(...result.warnings.map(warn => `Message ${result.index}: ${warn}`))
      }
    }

    if (options.model) {
      const modelValidation = this.validateModel(options.model)
      if (!modelValidation.valid) {
        errors.push(...modelValidation.errors)
      }
    }

    if (options.temperature !== undefined) {
      const tempValidation = this.validateTemperature(options.temperature)
      if (!tempValidation.valid) {
        errors.push(...tempValidation.errors)
      }
    }

    if (options.maxTokens !== undefined) {
      const tokensValidation = this.validateMaxTokens(options.maxTokens)
      if (!tokensValidation.valid) {
        errors.push(...tokensValidation.errors)
      } else if (tokensValidation.warnings && tokensValidation.warnings.length > 0) {
        warnings.push(...tokensValidation.warnings)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate a single message
   * @param {Object} message - Message object
   * @param {number} index - Message index
   * @returns {Object} Validation result
   */
  validateMessage(message, index = 0) {
    const errors = []
    const warnings = []

    if (!message || typeof message !== 'object') {
      errors.push('Message must be an object')
      return { valid: false, errors, warnings, index }
    }

    if (!message.role) {
      errors.push('Message role is required')
    } else if (!this.validationRules.message.allowedRoles.includes(message.role)) {
      errors.push(`Invalid role: ${message.role}. Allowed roles: ${this.validationRules.message.allowedRoles.join(', ')}`)
    }

    if (!message.content) {
      errors.push('Message content is required')
    } else {
      const contentValidation = this.validateContent(message.content)
      if (!contentValidation.valid) {
        errors.push(...contentValidation.errors)
      }
      if (contentValidation.warnings && contentValidation.warnings.length > 0) {
        warnings.push(...contentValidation.warnings)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      index
    }
  }

  /**
   * Validate message content
   * @param {*} content - Message content
   * @returns {Object} Validation result
   */
  validateContent(content) {
    const errors = []
    const warnings = []

    if (typeof content === 'string') {
      const length = content.length
      if (length < this.validationRules.message.minContentLength) {
        errors.push(`Content too short: ${length} characters (minimum: ${this.validationRules.message.minContentLength})`)
      }
      if (length > this.validationRules.message.maxContentLength) {
        errors.push(`Content too long: ${length} characters (maximum: ${this.validationRules.message.maxContentLength})`)
      }
      if (length > 10000) {
        warnings.push(`Large content length: ${length} characters. API may have limits.`)
      }
    } else if (Array.isArray(content)) {
      for (let i = 0; i < content.length; i++) {
        if (typeof content[i] !== 'string') {
          errors.push(`Content array element ${i} must be a string`)
        }
      }
    } else {
      errors.push('Content must be a string or array of strings')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate model ID
   * @param {string} model - Model ID
   * @returns {Object} Validation result
   */
  validateModel(model) {
    const errors = []

    if (!model || typeof model !== 'string') {
      errors.push('Model must be a non-empty string')
      return { valid: false, errors }
    }

    if (model.trim().length === 0) {
      errors.push('Model cannot be empty or whitespace')
    }

    if (model.length > 200) {
      errors.push('Model name too long (maximum 200 characters)')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate temperature parameter
   * @param {number} temperature - Temperature value
   * @returns {Object} Validation result
   */
  validateTemperature(temperature) {
    const errors = []

    if (typeof temperature !== 'number') {
      errors.push('Temperature must be a number')
      return { valid: false, errors }
    }

    if (isNaN(temperature)) {
      errors.push('Temperature must be a valid number')
    }

    if (temperature < this.validationRules.config.minTemperature) {
      errors.push(`Temperature too low: ${temperature} (minimum: ${this.validationRules.config.minTemperature})`)
    }

    if (temperature > this.validationRules.config.maxTemperature) {
      errors.push(`Temperature too high: ${temperature} (maximum: ${this.validationRules.config.maxTemperature})`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate maxTokens parameter
   * @param {number} maxTokens - Max tokens value
   * @returns {Object} Validation result
   */
  validateMaxTokens(maxTokens) {
    const errors = []
    const warnings = []

    if (typeof maxTokens !== 'number') {
      errors.push('maxTokens must be a number')
      return { valid: false, errors }
    }

    if (!Number.isInteger(maxTokens)) {
      errors.push('maxTokens must be an integer')
    }

    if (maxTokens < this.validationRules.config.minMaxTokens) {
      errors.push(`maxTokens too low: ${maxTokens} (minimum: ${this.validationRules.config.minMaxTokens})`)
    }

    if (maxTokens > this.validationRules.config.maxMaxTokens) {
      warnings.push(`maxTokens very high: ${maxTokens}. API may reject or be slow.`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate API key format
   * @param {string} apiKey - API key
   * @returns {Object} Validation result
   */
  validateAPIKey(apiKey) {
    const errors = []

    if (!apiKey || typeof apiKey !== 'string') {
      errors.push('API key must be a non-empty string')
      return { valid: false, errors }
    }

    if (apiKey.trim().length === 0) {
      errors.push('API key cannot be empty or whitespace')
    }

    if (apiKey.length < this.validationRules.apiKey.minLength) {
      errors.push(`API key too short (minimum ${this.validationRules.apiKey.minLength} characters)`)
    }

    if (apiKey.length > this.validationRules.apiKey.maxLength) {
      errors.push(`API key too long (maximum ${this.validationRules.apiKey.maxLength} characters)`)
    }

    if (!this.validationRules.apiKey.pattern.test(apiKey)) {
      errors.push('API key contains invalid characters')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate base URL
   * @param {string} baseURL - Base URL
   * @returns {Object} Validation result
   */
  validateBaseURL(baseURL) {
    const errors = []

    if (!baseURL || typeof baseURL !== 'string') {
      errors.push('Base URL must be a non-empty string')
      return { valid: false, errors }
    }

    try {
      const url = new URL(baseURL)
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('Base URL must use HTTP or HTTPS protocol')
      }
    } catch (e) {
      errors.push('Invalid base URL format')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Sanitize message content
   * @param {*} content - Content to sanitize
   * @returns {string} Sanitized content
   */
  sanitizeContent(content) {
    if (typeof content !== 'string') {
      return ''
    }

    return content
      .trim()
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/[\r\n]+/g, '\n') // Normalize line endings
  }

  /**
   * Sanitize API key
   * @param {string} apiKey - API key to sanitize
   * @returns {string} Sanitized API key
   */
  sanitizeAPIKey(apiKey) {
    if (typeof apiKey !== 'string') {
      return ''
    }

    return apiKey.trim()
  }

  /**
   * Sanitize model ID
   * @param {string} model - Model ID to sanitize
   * @returns {string} Sanitized model ID
   */
  sanitizeModel(model) {
    if (typeof model !== 'string') {
      return ''
    }

    return model.trim()
  }

  /**
   * Sanitize base URL
   * @param {string} baseURL - Base URL to sanitize
   * @returns {string} Sanitized base URL
   */
  sanitizeBaseURL(baseURL) {
    if (typeof baseURL !== 'string') {
      return ''
    }

    const sanitized = baseURL.trim()
    
    try {
      const url = new URL(sanitized)
      url.hash = ''
      return url.toString()
    } catch (e) {
      return sanitized
    }
  }

  /**
   * Get validation rules for a category
   * @param {string} category - Category (message, config, apiKey)
   * @returns {Object} Validation rules
   */
  getRules(category) {
    return this.validationRules[category] || {}
  }

  /**
   * Update validation rules
   * @param {string} category - Category to update
   * @param {Object} rules - New rules
   */
  updateRules(category, rules) {
    if (this.validationRules[category]) {
      this.validationRules[category] = {
        ...this.validationRules[category],
        ...rules
      }
    }
  }

  /**
   * Throw error if validation fails
   * @param {Object} validationResult - Result from validateChatRequest
   * @throws {ValidationError} If validation fails
   */
  throwOnError(validationResult) {
    if (!validationResult.valid) {
      throw new ValidationError(
        'Input validation failed',
        validationResult.errors,
        validationResult.warnings
      )
    }
  }
}

export const inputValidator = new InputValidator()

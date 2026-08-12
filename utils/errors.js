export class APIError extends Error {
  constructor(message, code, status, recoverable = true) {
    super(message)
    this.name = 'APIError'
    this.code = code
    this.status = status
    this.recoverable = recoverable
    this.timestamp = new Date().toISOString()
  }
}

export class NetworkError extends Error {
  constructor(message, originalError) {
    super(message)
    this.name = 'NetworkError'
    this.originalError = originalError
    this.timestamp = new Date().toISOString()
    this.recoverable = true
  }
}

export class AuthError extends APIError {
  constructor(message) {
    super(message, 'AUTH_ERROR', 401, true)
    this.name = 'AuthError'
  }
}

export class RateLimitError extends APIError {
  constructor(message, retryAfter = 60) {
    super(message, 'RATE_LIMIT', 429, true)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

export class ValidationError extends Error {
  constructor(message, field, warnings = []) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
    this.warnings = warnings
    this.recoverable = true
  }
}

export const ErrorCodes = {
  NETWORK_FAILURE: 'NETWORK_FAILURE',
  TIMEOUT: 'TIMEOUT',
  INVALID_API_KEY: 'INVALID_API_KEY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  INVALID_REQUEST: 'INVALID_REQUEST',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
}

export const ErrorMessages = {
  [ErrorCodes.NETWORK_FAILURE]: 'Network connection failed. Please check your internet connection.',
  [ErrorCodes.TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorCodes.INVALID_API_KEY]: 'Invalid API key. Please check your settings.',
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded. Please wait a moment before trying again.',
  [ErrorCodes.QUOTA_EXCEEDED]: 'API quota exceeded. Please check your account.',
  [ErrorCodes.MODEL_NOT_FOUND]: 'Model not found. Please select a valid model.',
  [ErrorCodes.INVALID_REQUEST]: 'Invalid request. Please check your input.',
  [ErrorCodes.SERVER_ERROR]: 'Server error. Please try again later.',
  [ErrorCodes.UNKNOWN_ERROR]: 'An unexpected error occurred.'
}

export function classifyError(error) {
  if (error instanceof APIError) return error
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return new NetworkError('Network request failed', error)
  }
  if (error.message?.includes('401') || error.message?.includes('403')) {
    return new AuthError(ErrorMessages[ErrorCodes.INVALID_API_KEY])
  }
  if (error.message?.includes('429')) {
    return new RateLimitError(ErrorMessages[ErrorCodes.RATE_LIMIT_EXCEEDED])
  }
  return new APIError(
    error.message || ErrorMessages[ErrorCodes.UNKNOWN_ERROR],
    ErrorCodes.UNKNOWN_ERROR,
    500
  )
}

export function getUserFriendlyMessage(error) {
  if (error instanceof APIError) {
    return ErrorMessages[error.code] || error.message
  }
  if (error instanceof NetworkError) {
    return ErrorMessages[ErrorCodes.NETWORK_FAILURE]
  }
  return ErrorMessages[ErrorCodes.UNKNOWN_ERROR]
}

export class UserAbortError extends Error {
  constructor(message = 'Generation stopped by user') {
    super(message)
    this.name = 'UserAbortError'
  }
}

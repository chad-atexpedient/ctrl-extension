/**
 * Minimal logger module.
 *
 * The original full-featured logger (levels, filtering, persistence) was
 * dead code behind the never-imported utils/index.js barrel. A few live
 * modules (config-validator, consent-manager, model-validator) only need a
 * tagged console logger with info/warn/error/debug — this keeps that API
 * surface without resurrecting the dead machinery.
 */

export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
}

/**
 * Create a tagged console logger.
 * @param {string} tag - Logger tag prefix
 * @returns {{ debug: Function, info: Function, warn: Function, error: Function }}
 */
export function getLogger(tag = '') {
  const prefix = tag ? `[${tag}]` : ''
  const make = (level) => (message, ...args) => {
    console[level](prefix ? `${prefix} ${message}` : message, ...args)
  }
  return {
    debug: make('debug'),
    info: make('info'),
    warn: make('warn'),
    error: make('error')
  }
}

export function setGlobalLogLevel() {}
export function setGlobalLoggingEnabled() {}
export function getRegisteredLoggers() {
  return []
}

export const log = getLogger('CTRL')

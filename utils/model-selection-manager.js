/**
 * Centralized model selection management with single source of truth (Chrome storage)
 * All model selection operations go through this class to ensure consistency
 *
 * Features:
 * - Operation queue to prevent race conditions
 * - Validation for model limits
 * - Atomic storage operations
 */
export class ModelSelectionManager {
  static STORAGE_KEY = 'enabled_models'

  // Operation queue to serialize write operations and prevent race conditions
  static _operationQueue = Promise.resolve()

  /**
   * Queue an operation to be executed sequentially
   * @param {Function} operation - Async function to execute
   * @returns {Promise<*>} Result of the operation
   * @private
   */
  static async _queueOperation(operation) {
    // Chain the new operation onto the existing queue
    this._operationQueue = this._operationQueue.then(operation, operation)
    return this._operationQueue
  }

  /**
   * Set models for a provider (with validation)
   * @param {string} providerId - Provider identifier
   * @param {string[]} modelIds - Array of model IDs
   * @returns {Promise<void>}
   */
  static async setModels(providerId, modelIds) {
    // Use queue to prevent race conditions
    return this._queueOperation(async () => {
      if (modelIds.length > 2) {
        throw new Error(`Maximum 2 models allowed per provider. Selected: ${modelIds.length}`)
      }

      const currentState = await this._readStorage()

      const updatedState = {
        ...currentState,
        [providerId]: modelIds
      }

      await this._writeStorage(updatedState)

      console.debug(`[ModelSelectionManager] Set ${providerId} models:`, modelIds)
    })
  }

  /**
   * Get models for a provider
   * @param {string} providerId - Provider identifier
   * @returns {Promise<string[]>} Array of model IDs
   */
  static async getModels(providerId) {
    const state = await this._readStorage()
    return state[providerId] || []
  }

  /**
   * Get all enabled models
   * @returns {Promise<Object>} All enabled models by provider
   */
  static async getAllModels() {
    return await this._readStorage()
  }

  /**
   * Clear all models for a provider
   * @param {string} providerId - Provider identifier
   * @returns {Promise<void>}
   */
  static async clearProvider(providerId) {
    // Use queue to prevent race conditions
    return this._queueOperation(async () => {
      const currentState = await this._readStorage()
      const updatedState = {
        ...currentState,
        [providerId]: []
      }
      await this._writeStorage(updatedState)
      console.debug(`[ModelSelectionManager] Cleared ${providerId} models`)
    })
  }

  /**
   * Read from storage
   * @returns {Promise<Object>}
   * @private
   */
  static async _readStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get([ModelSelectionManager.STORAGE_KEY], (result) => {
        resolve(result[ModelSelectionManager.STORAGE_KEY] || {})
      })
    })
  }

  /**
   * Write to storage
   * @param {Object} data - Data to write
   * @returns {Promise<void>}
   * @private
   */
  static async _writeStorage(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [ModelSelectionManager.STORAGE_KEY]: data }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else {
          resolve()
        }
      })
    })
  }
}

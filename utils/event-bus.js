/**
 * Simple Event Bus for decoupled communication
 * Allows components to communicate without direct dependencies
 */

export class EventBus {
  constructor() {
    this.listeners = new Map()
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event)
      if (eventListeners) {
        eventListeners.delete(callback)
        if (eventListeners.size === 0) {
          this.listeners.delete(event)
        }
      }
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`[EventBus] Error in event handler for "${event}":`, error)
        }
      })
    }
  }

  /**
   * Remove all listeners for an event
   * @param {string} event - Event name
   */
  off(event) {
    this.listeners.delete(event)
  }

  /**
   * Remove all listeners
   */
  clear() {
    this.listeners.clear()
  }

  /**
   * Get listener count for an event (for debugging)
   * @param {string} event - Event name
   * @returns {number}
   */
  listenerCount(event) {
    return this.listeners.get(event)?.size || 0
  }
}

// Global event bus instance
export const eventBus = new EventBus()

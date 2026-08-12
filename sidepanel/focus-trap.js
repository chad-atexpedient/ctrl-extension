/**
 * Focus Trap utility
 *
 * Creates a Tab/Shift+Tab cycle that keeps focus inside a given container
 * while it's visible. Also stores the previously-focused element so focus
 * can be restored when the trap is released.
 *
 * Usage:
 *   const trap = new FocusTrap(element)
 *   trap.activate()   // when sidebar/modal opens
 *   trap.deactivate() // when it closes
 */
export class FocusTrap {
  constructor(container) {
    this.container = container
    this.previouslyFocused = null
    this._keyHandler = null
  }

  /**
   * Moves focus into the container and starts intercepting Tab.
   */
  activate() {
    this.previouslyFocused = document.activeElement

    // Focus the container itself (or first focusable child)
    const focusables = this._getFocusables()
    if (focusables.length > 0) {
      focusables[0].focus()
    } else {
      this.container.setAttribute('tabindex', '-1')
      this.container.focus()
    }

    this._keyHandler = (e) => this._onKeydown(e)
    document.addEventListener('keydown', this._keyHandler, true)
  }

  /**
   * Removes the Tab interceptor and restores focus to the trigger element.
   */
  deactivate() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler, true)
      this._keyHandler = null
    }
    if (this.previouslyFocused && typeof this.previouslyFocused.focus === 'function') {
      this.previouslyFocused.focus()
    }
    this.previouslyFocused = null
  }

  /**
   * Returns all focusable elements inside the container.
   * @returns {HTMLElement[]}
   */
  _getFocusables() {
    const selector =
      'a[href], button:not([disabled]), textarea:not([disabled]), ' +
      'input:not([disabled]), select:not([disabled]), ' +
      '[tabindex]:not([tabindex="-1"])'
    return Array.from(this.container.querySelectorAll(selector))
      .filter((el) => el.offsetParent !== null || el.getClientRects().length > 0)
  }

  _onKeydown(e) {
    if (e.key !== 'Tab') return

    // Ignore if the container is no longer in the DOM or is hidden
    if (!this.container.offsetParent && !this.container.getClientRects().length) {
      this.deactivate()
      return
    }

    const focusables = this._getFocusables()
    if (focusables.length === 0) {
      e.preventDefault()
      this.container.focus()
      return
    }

    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first || !this.container.contains(document.activeElement)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last || !this.container.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      }
    }
  }
}

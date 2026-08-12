/**
 * CDP Controller for CTRL Extension
 *
 * Provides browser automation via Chrome DevTools Protocol (CDP).
 * Uses chrome.debugger API to attach to tabs and execute actions.
 *
 * Modes:
 * 1. Direct mode: Extension controls the active tab directly via chrome.debugger
 * 2. Relay mode: Connects to external relay server (desktop companion) for multi-tab control
 *
 * Inspired by OpenClaw Browser Relay architecture.
 */

const CDP_VERSION = '1.3'

const RELAY_ALLOWED_METHODS = [
  'Page.captureScreenshot',
  'Page.navigate',
  'Page.getNavigationHistory',
  'Page.getFrameTree',
  'Runtime.getProperties',
  'DOM.getDocument',
  'DOM.getOuterHTML',
  'DOM.querySelector',
  'DOM.querySelectorAll',
  'DOM.getElementById'
]

const BADGE = {
  on: { text: 'ON', color: '#10b981' },
  off: { text: '', color: '#000000' },
  connecting: { text: '...', color: '#f59e0b' },
  error: { text: '!', color: '#ef4444' },
}

class CDPController {
  constructor() {
    this.attachedTabId = null
    this.isAttached = false
    this.relayWs = null
    this.relayEnabled = false
    this.relayPort = 18792
    this.relayToken = ''
    this.autoAttachEnabled = true
    this.approvalMode = 'session' // 'session' | 'per-action' | 'none'
    this.sessionApproved = false
    this.pendingActions = new Map()
  }

  /**
   * Check if a URL is eligible for CDP attachment
   */
  isAttachableUrl(url) {
    if (!url) return false
    const restricted = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'brave://', 'opera://', 'vivaldi://']
    return !restricted.some(prefix => url.startsWith(prefix))
  }

  /**
   * Auto-attach to the active tab if eligible
   */
  async autoAttach() {
    if (!this.autoAttachEnabled) return null

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!activeTab?.id || !this.isAttachableUrl(activeTab.url)) return null

      if (this.isAttached && this.attachedTabId === activeTab.id) {
        return { success: true, tabId: activeTab.id, alreadyAttached: true }
      }

      return await this.attach(activeTab.id, true)
    } catch (e) {
      return null
    }
  }

  /**
   * Attach debugger to a tab
   * @param {number} tabId - Tab ID to attach to
   * @param {boolean} silent - Suppress notifications
   */
  async attach(tabId, silent = false) {
    if (!chrome.debugger?.attach) {
      return {
        success: false,
        error: 'Browser automation is unavailable in this browser build. Use Chrome or a Chromium-based browser for the Browser Agent.',
      }
    }
    if (this.isAttached && this.attachedTabId === tabId) {
      return { success: true, message: 'Already attached to this tab' }
    }

    if (this.isAttached) {
      await this.detach(this.attachedTabId, true)
    }

    const debuggee = { tabId }

    try {
      await chrome.debugger.attach(debuggee, CDP_VERSION)
      this.attachedTabId = tabId
      this.isAttached = true

      await chrome.debugger.sendCommand(debuggee, 'Page.enable').catch(() => {})
      await chrome.debugger.sendCommand(debuggee, 'Runtime.enable').catch(() => {})
      await chrome.debugger.sendCommand(debuggee, 'DOM.enable').catch(() => {})

      this._setBadge(tabId, 'on')

      if (!silent) {
        this._notify('Browser Agent Active', 'CTRL is now controlling this tab. Click the icon or press Alt+Shift+B to detach.')
      }

      console.debug('[CDP] Attached to tab', tabId)
      return { success: true, tabId }
    } catch (error) {
      this._setBadge(tabId, 'error')
      console.error('[CDP] Attach failed:', error.message)

      if (error.message?.includes('Another debugger is already attached')) {
        return { success: false, error: 'Another debugger (DevTools or extension) is already attached to this tab. Close it first.' }
      }

      return { success: false, error: error.message }
    }
  }

  /**
   * Detach debugger from a tab
   * @param {number} tabId - Tab ID to detach from
   * @param {boolean} silent - Suppress notifications
   */
  async detach(tabId, silent = false) {
    const targetTabId = tabId || this.attachedTabId
    if (!targetTabId) {
      return { success: true, message: 'Not attached to any tab' }
    }

    const debuggee = { tabId: targetTabId }

    try {
      await chrome.debugger.detach(debuggee)
    } catch (e) {
      // Already detached
    }

    this.isAttached = false
    this.attachedTabId = null
    this._setBadge(targetTabId, 'off')

    if (!silent) {
      this._notify('Browser Agent Detached', 'CTRL is no longer controlling this tab.')
    }

    console.debug('[CDP] Detached from tab', targetTabId)
    return { success: true }
  }

  /**
   * Toggle attach/detach for the active tab
   */
  async toggle() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!activeTab?.id) {
      return { success: false, error: 'No active tab found' }
    }

    if (this.isAttached && this.attachedTabId === activeTab.id) {
      return await this.detach(activeTab.id)
    }

    if (!this.isAttachableUrl(activeTab.url)) {
      return { success: false, error: 'Cannot attach to this page (e.g. chrome:// or about: URLs)' }
    }

    return await this.attach(activeTab.id)
  }

  /**
   * Check if a browser action requires user approval
   */
  isDestructiveAction(toolName) {
    const destructive = ['browser_click', 'browser_type', 'browser_navigate', 'browser_evaluate', 'browser_press_key']
    return destructive.includes(toolName)
  }

  /**
   * Check if an action is approved for this session
   */
  isActionApproved(toolName) {
    if (this.approvalMode === 'none') return true
    if (this.approvalMode === 'session' && this.sessionApproved) return true
    return false
  }

  /**
   * Approve all actions for this session
   */
  approveSession() {
    this.sessionApproved = true
    this.pendingActions.clear()
  }

  /**
   * Reset session approval (called on new session or detach)
   */
  resetApproval() {
    this.sessionApproved = false
    this.pendingActions.clear()
  }

  /**
   * Get current attachment status
   */
  getStatus() {
    return {
      attached: this.isAttached,
      tabId: this.attachedTabId,
      relayEnabled: this.relayEnabled,
      relayConnected: !!this.relayWs && this.relayWs.readyState === WebSocket.OPEN,
    }
  }

  /**
   * Navigate the attached tab to a URL
   * @param {string} url - URL to navigate to
   */
  async navigate(url) {
    const debuggee = this._getDebuggee()
    if (!debuggee) return { error: 'Not attached to any tab' }

    let parsedUrl
    try {
      parsedUrl = new URL(url)
    } catch {
      return { error: 'Invalid URL' }
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { error: 'URL must use http or https protocol' }
    }

    try {
      await chrome.debugger.sendCommand(debuggee, 'Page.navigate', { url })
      await this._waitForLoad(debuggee, 15000)
      return { success: true, url }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Take a screenshot of the attached tab
   * @param {Object} options - Screenshot options
   * @returns {Object} { success, dataUrl } - Base64 PNG data URL
   */
  async screenshot(options = {}) {
    const debuggee = this._getDebuggee()
    if (!debuggee) return { error: 'Not attached to any tab' }

    try {
      const params = {
        format: options.format || 'png',
        quality: options.quality || 80,
      }

      if (options.fullPage) {
        params.captureBeyondViewport = true
        const metrics = await chrome.debugger.sendCommand(debuggee, 'Page.getLayoutMetrics')
        if (metrics?.cssContentSize) {
          params.clip = {
            x: 0,
            y: 0,
            width: metrics.cssContentSize.width,
            height: metrics.cssContentSize.height,
            scale: 1,
          }
        }
      }

      const result = await chrome.debugger.sendCommand(debuggee, 'Page.captureScreenshot', params)
      if (result?.data) {
        const mimeType = params.format === 'jpeg' ? 'image/jpeg' : 'image/png'
        return { success: true, dataUrl: `data:${mimeType};base64,${result.data}` }
      }
      return { error: 'Screenshot returned no data' }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Click an element by selector
   * @param {string} selector - CSS selector for the element to click
   */
  async click(selector) {
    const debuggee = this._getDebuggee()
    if (!debuggee) return { error: 'Not attached to any tab' }

    try {
      const expression = `(function() {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { found: false };
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        el.click();
        return { found: true, tagName: el.tagName, text: (el.textContent || '').substring(0, 100) };
      })()`

      const result = await chrome.debugger.sendCommand(debuggee, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
      })

      const value = result?.result?.value
      if (!value?.found) {
        return { error: `Element not found: ${selector}` }
      }

      return { success: true, clicked: value.tagName, text: value.text }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Type text into an input element
   * @param {string} selector - CSS selector for the input
   * @param {string} text - Text to type
   * @param {boolean} submit - Whether to submit the form after typing
   */
  async type(selector, text, submit = false) {
    const debuggee = this._getDebuggee()
    if (!debuggee) return { error: 'Not attached to any tab' }

    try {
      const expression = `(function() {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { found: false };
        el.focus();
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        const tagName = el.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea') {
          el.value = ${JSON.stringify(text)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          el.textContent = ${JSON.stringify(text)};
        }
        return { found: true, tagName: el.tagName };
      })()`

      const result = await chrome.debugger.sendCommand(debuggee, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
      })

      const value = result?.result?.value
      if (!value?.found) {
        return { error: `Element not found: ${selector}` }
      }

      if (submit) {
        const submitExpr = `(function() {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return;
          const form = el.closest('form');
          if (form) form.submit();
          else { const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }); el.dispatchEvent(event); }
        })()`
        await chrome.debugger.sendCommand(debuggee, 'Runtime.evaluate', { expression: submitExpr })
      }

      return { success: true, typed: text.length, submitted: submit }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Press a keyboard key
   * @param {string} key - Key to press (e.g. 'Enter', 'Tab', 'Escape')
   */
  async pressKey(key) {
    const debuggee = this._getDebuggee()
    if (!debuggee) return { error: 'Not attached to any tab' }

    try {
      await chrome.debugger.sendCommand(debuggee, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        key,
      })
      await chrome.debugger.sendCommand(debuggee, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        key,
      })
      return { success: true, key }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Scroll the page
   * @param {number} x - Horizontal scroll amount
   * @param {number} y - Vertical scroll amount
   * @param {boolean} smooth - Use smooth scrolling
   */
  async scroll(x = 0, y = 300, smooth = false) {
    const debuggee = this._getDebuggee()
    if (!debuggee) return { error: 'Not attached to any tab' }

    try {
      const behavior = smooth ? 'smooth' : 'instant'
      const expression = `window.scrollBy({ left: ${parseInt(x)}, top: ${parseInt(y)}, behavior: '${behavior}' })`
      await chrome.debugger.sendCommand(debuggee, 'Runtime.evaluate', { expression })

      const posExpr = 'JSON.stringify({ x: window.scrollX, y: window.scrollY })'
      const result = await chrome.debugger.sendCommand(debuggee, 'Runtime.evaluate', {
        expression: posExpr,
        returnByValue: true,
      })

      const scrollPos = JSON.parse(result?.result?.value || '{}')
      return { success: true, ...scrollPos }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Extract text content from the page
   * @param {string} selector - Optional CSS selector to extract from (defaults to body)
   * @param {number} maxLength - Maximum characters to extract
   */
  async extractText(selector = 'body', maxLength = 5000) {
    const debuggee = this._getDebuggee()
    if (!debuggee) return { error: 'Not attached to any tab' }

    const safeMax = Math.max(0, Math.min(Number(maxLength) || 5000, 50000))
    try {
      const expression = `(function() {
        const el = document.querySelector(${JSON.stringify(selector)}) || document.body;
        if (!el) return '';
        const clone = el.cloneNode(true);
        clone.querySelectorAll('script, style, noscript, svg').forEach(e => e.remove());
        return clone.innerText.replace(/\\n{3,}/g, '\\n\\n').substring(0, ${safeMax});
      })()`

      const result = await chrome.debugger.sendCommand(debuggee, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
        timeout: 15000,
      })

      const text = result?.result?.value || ''
      return { success: true, text, length: text.length }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Get all interactive elements on the page (useful for AI to understand what's clickable)
   * @param {number} limit - Maximum number of elements to return
   */
  async getInteractiveElements(limit = 50) {
    const debuggee = this._getDebuggee()
    if (!debuggee) return { error: 'Not attached to any tab' }

    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200))
    try {
      const expression = `(function() {
        const elements = [];
        const interactiveSelectors = 'a, button, input, textarea, select, [role="button"], [role="link"], [role="tab"], [onclick]';
        const els = document.querySelectorAll(${JSON.stringify(interactiveSelectors)});
        for (const el of els) {
          if (elements.length >= ${safeLimit}) break;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const tag = el.tagName.toLowerCase();
          const type = el.getAttribute('type') || '';
          const role = el.getAttribute('role') || '';
          const href = el.getAttribute('href') || '';
          const id = el.id ? '#' + el.id : '';
          const className = el.className && typeof el.className === 'string' ?
            '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
          const text = (el.textContent || el.value || '').trim().substring(0, 80);
          const ariaLabel = el.getAttribute('aria-label') || '';
          const placeholder = el.getAttribute('placeholder') || '';
          let selector = id || className || tag;
          if (tag === 'input' && type) selector = 'input[type="' + type + '"]' + (id || '');
          elements.push({
            tag, type, role, text, href,
            selector,
            ariaLabel, placeholder,
            visible: rect.top < window.innerHeight && rect.left < window.innerWidth,
            position: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
          });
        }
        return JSON.stringify(elements);
      })()`

      const result = await chrome.debugger.sendCommand(debuggee, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
      })

      const elements = JSON.parse(result?.result?.value || '[]')
      return { success: true, elements, count: elements.length }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Get the current page URL and title
   */
  async getPageInfo() {
    const debuggee = this._getDebuggee()
    if (!debuggee) return { error: 'Not attached to any tab' }

    try {
      const expression = 'JSON.stringify({ url: location.href, title: document.title, readyState: document.readyState })'
      const result = await chrome.debugger.sendCommand(debuggee, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
      })

      return { success: true, ...JSON.parse(result?.result?.value || '{}') }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Execute arbitrary JavaScript on the page
   * @param {string} code - JavaScript code to execute
   */
  async evaluate(code) {
    const debuggee = this._getDebuggee()
    if (!debuggee) return { error: 'Not attached to any tab' }

    try {
      const result = await chrome.debugger.sendCommand(debuggee, 'Runtime.evaluate', {
        expression: code,
        returnByValue: true,
        awaitPromise: true,
        timeout: 15000,
      })

      if (result?.exceptionDetails) {
        return { error: result.exceptionDetails.text || 'Evaluation error' }
      }

      return { success: true, value: result?.result?.value }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * Execute a CDP method directly (advanced)
   * @param {string} method - CDP method name
   * @param {Object} params - Method parameters
   */
  async sendCDPCommand(method, params = {}) {
    const debuggee = this._getDebuggee()
    if (!debuggee) return { error: 'Not attached to any tab' }

    try {
      const result = await chrome.debugger.sendCommand(debuggee, method, params)
      return { success: true, result }
    } catch (error) {
      return { error: error.message }
    }
  }

  // === Relay Mode (for desktop companion / external Playwright) ===

  /**
   * Connect to a relay server (desktop companion)
   * @param {number} port - Relay server port
   * @param {string} token - Auth token
   */
  async connectRelay(port, token) {
    const safePort = Math.max(1, Math.min(Number(port) || 18792, 65535))
    this.relayPort = safePort
    this.relayToken = token || ''
    this.relayEnabled = true

    if (!this.relayToken || this.relayToken.length < 8) {
      this.relayEnabled = false
      return { success: false, error: 'A relay token of at least 8 characters is required. Generate one in the desktop companion.' }
    }

    const wsUrl = `ws://127.0.0.1:${this.relayPort}/extension?token=${encodeURIComponent(this.relayToken)}`

    try {
      const response = await fetch(`http://127.0.0.1:${this.relayPort}/`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(2000),
      })

      if (!response.ok) {
        throw new Error(`Relay server responded with ${response.status}`)
      }
    } catch (err) {
      this.relayEnabled = false
      return { success: false, error: `Relay server not reachable at port ${this.relayPort}` }
    }

    if (this.relayWs) {
      try { this.relayWs.close() } catch {}
      this.relayWs = null
    }

    let settled = false
    return new Promise((resolve) => {
      const ws = new WebSocket(wsUrl)
      this.relayWs = ws

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true
          ws.close()
          resolve({ success: false, error: 'WebSocket connect timeout' })
        }
      }, 5000)

      ws.onopen = () => {
        if (settled) { ws.close(); return }
        settled = true
        clearTimeout(timeout)
        console.debug('[CDP] Relay connected')
        this._notify('Relay Connected', 'Desktop companion relay is active.')
        resolve({ success: true })
      }

      ws.onerror = () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        this.relayEnabled = false
        resolve({ success: false, error: 'WebSocket connection failed' })
      }

      ws.onclose = () => {
        if (!settled) {
          settled = true
          this.relayEnabled = false
        }
        this.relayWs = null
        console.debug('[CDP] Relay disconnected')
      }

      ws.onmessage = (event) => this._onRelayMessage(event.data)
    })
  }

  /**
   * Disconnect from relay server
   */
  disconnectRelay() {
    if (this.relayWs) {
      this.relayWs.close()
      this.relayWs = null
    }
    this.relayEnabled = false
    return { success: true }
  }

  async _onRelayMessage(text) {
    let msg
    try {
      msg = JSON.parse(text)
    } catch {
      return
    }

    if (msg.method === 'ping') {
      try {
        this.relayWs?.send(JSON.stringify({ method: 'pong' }))
      } catch {}
      return
    }

    if (msg.method === 'forwardCDPCommand' && typeof msg.id === 'number') {
      const relayMethod = msg.params?.method
      if (!RELAY_ALLOWED_METHODS.includes(relayMethod)) {
        try {
          this.relayWs?.send(JSON.stringify({ id: msg.id, error: `Relay method not allowed: ${relayMethod}` }))
        } catch {}
        return
      }
      const argCount = relayMethod ? { Page: 0, Runtime: 0, DOM: 0 }[relayMethod.split('.')[0]] : 0
      if (argCount === 0 || !Array.isArray(msg.params.params) || msg.params.params.length <= argCount) {
        try {
          const result = await this.sendCDPCommand(relayMethod, msg.params.params || {})
          this.relayWs?.send(JSON.stringify({ id: msg.id, result: result.result || result }))
        } catch (err) {
          this.relayWs?.send(JSON.stringify({ id: msg.id, error: err.message }))
        }
      } else {
        try {
          this.relayWs?.send(JSON.stringify({ id: msg.id, error: 'Too many arguments for relay method' }))
        } catch {}
      }
    }
  }

  // === Internal helpers ===

  _getDebuggee() {
    if (!this.isAttached || !this.attachedTabId) return null
    return { tabId: this.attachedTabId }
  }

  _setBadge(tabId, kind) {
    const cfg = BADGE[kind] || BADGE.off
    const action = chrome.action || chrome.browserAction
    if (!action) return
    void action.setBadgeText?.({ tabId, text: cfg.text })
    void action.setBadgeBackgroundColor?.({ tabId, color: cfg.color })
  }

  _notify(title, message) {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title,
        message,
        priority: 1,
      })
    } catch {}
  }

  _waitForLoad(debuggee, timeout = 10000) {
    return new Promise((resolve) => {
      let done = false
      const cleanup = () => {
        if (!done) {
          done = true
          chrome.debugger.onEvent.removeListener(listener)
          clearTimeout(timer)
        }
      }
      const timer = setTimeout(() => { cleanup(); resolve() }, timeout)
      const listener = (source, method) => {
        if (!done && source.tabId === debuggee.tabId && method === 'Page.loadEventFired') {
          cleanup()
          setTimeout(resolve, 500)
        }
      }
      chrome.debugger.onEvent.addListener(listener)
    })
  }
}

export const cdpController = new CDPController()

// Handle forced detachment (e.g. DevTools opened on same tab)
if (chrome.debugger?.onDetach) {
  chrome.debugger.onDetach.addListener((source, reason) => {
    if (source.tabId === cdpController.attachedTabId) {
      cdpController.isAttached = false
      cdpController.attachedTabId = null
      cdpController._setBadge(source.tabId, 'off')
      console.debug('[CDP] Forcefully detached:', reason)
    }
  })
}

/**
 * Action Approval Module
 * 
 * Handles approval flow for destructive browser agent actions.
 * When AI wants to click, type, navigate, or execute code on a page,
 * this module shows an approval card in the sidepanel.
 */

const ACTION_LABELS = {
  browser_click: { icon: '👆', label: 'Click', description: 'Click an element on the page' },
  browser_type: { icon: '⌨️', label: 'Type', description: 'Type text into a field' },
  browser_navigate: { icon: '🌐', label: 'Navigate', description: 'Go to a URL' },
  browser_evaluate: { icon: '⚡', label: 'Execute', description: 'Run JavaScript code' },
  browser_press_key: { icon: '⌨️', label: 'Key Press', description: 'Press a keyboard key' }
}

export class ActionApprovalManager {
  constructor() {
    this.pendingApprovals = new Map()
    this.container = null
    this.onApprovalChange = null
  }

  init() {
    this.container = document.getElementById('approval-container')
    if (!this.container) {
      this.container = document.createElement('div')
      this.container.id = 'approval-container'
      this.container.className = 'approval-container'
      
      const inputWrapper = document.querySelector('.input-wrapper')
      if (inputWrapper) {
        inputWrapper.parentNode.insertBefore(this.container, inputWrapper)
      }
    }

    // Listen for approval requests from service worker
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'BROWSER_ACTION_APPROVAL_REQUIRED') {
        this.showApprovalCard(message)
      }
    })

    // If the side panel is closed/reloaded while approvals are pending, the
    // background's awaited promise for each request would otherwise hang
    // (previously up to ~30s or forever, with no cancel path). Deny
    // everything still outstanding so the background settles immediately.
    window.addEventListener('beforeunload', () => this.cancelAllPending())
    window.addEventListener('pagehide', () => this.cancelAllPending())
  }

  /**
   * Denies every pending approval without animating the UI (the panel is
   * going away anyway) so background-side promises don't hang.
   */
  cancelAllPending() {
    for (const requestId of this.pendingApprovals.keys()) {
      try {
        chrome.runtime.sendMessage({
          type: 'BROWSER_ACTION_DENIED',
          requestId,
          approveAll: false
        })
      } catch (e) {
        // Best-effort — the extension context may already be torn down.
      }
    }
    this.pendingApprovals.clear()
  }

  showApprovalCard({ requestId, toolName, toolArgs, tabId }) {
    const action = ACTION_LABELS[toolName] || { icon: '❓', label: toolName, description: 'Perform an action' }
    
    let detailHtml = ''
    if (toolName === 'browser_click' && toolArgs.selector) {
      detailHtml = `<div class="approval-detail"><span class="approval-label">Element:</span> <code>${this.escapeHtml(toolArgs.selector)}</code></div>`
    } else if (toolName === 'browser_type') {
      detailHtml = `<div class="approval-detail"><span class="approval-label">Field:</span> <code>${this.escapeHtml(toolArgs.selector || '')}</code></div>`
      if (toolArgs.text) {
        const preview = toolArgs.text.length > 60 ? toolArgs.text.substring(0, 60) + '...' : toolArgs.text
        detailHtml += `<div class="approval-detail"><span class="approval-label">Text:</span> "${this.escapeHtml(preview)}"</div>`
      }
      if (toolArgs.submit) {
        detailHtml += `<div class="approval-detail approval-warning">⚠️ Will submit form after typing</div>`
      }
    } else if (toolName === 'browser_navigate' && toolArgs.url) {
      detailHtml = `<div class="approval-detail"><span class="approval-label">URL:</span> <code>${this.escapeHtml(toolArgs.url)}</code></div>`
    } else if (toolName === 'browser_evaluate' && toolArgs.code) {
      const preview = toolArgs.code.length > 100 ? toolArgs.code.substring(0, 100) + '...' : toolArgs.code
      detailHtml = `<div class="approval-detail"><span class="approval-label">Code:</span><pre class="approval-code">${this.escapeHtml(preview)}</pre></div>`
    }

    const card = document.createElement('div')
    card.className = 'approval-card'
    card.dataset.requestId = requestId
    const safeIcon = this.escapeHtml(action.icon)
    const safeLabel = this.escapeHtml((action.label || '').toLowerCase())
    const safeRequestId = this.escapeHtml(requestId)
    card.innerHTML = `
      <div class="approval-header">
        <span class="approval-icon">${safeIcon}</span>
        <span class="approval-title">AI wants to ${safeLabel}</span>
        <span class="approval-queue-badge hidden"></span>
        <span class="approval-badge">Approval Required</span>
      </div>
      <div class="approval-body">
        ${detailHtml}
      </div>
      <div class="approval-actions">
        <button class="btn btn-ghost approval-deny" data-request-id="${safeRequestId}">Deny</button>
        <button class="btn btn-ghost approval-approve-all" data-request-id="${safeRequestId}">Allow All for Session</button>
        <button class="btn btn-primary approval-approve" data-request-id="${safeRequestId}">Allow Once</button>
      </div>
    `

    this.container.appendChild(card)
    this.container.classList.add('has-approvals')

    // Scroll into view
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    // Bind button events
    card.querySelector('.approval-approve').addEventListener('click', () => {
      this.respond(requestId, true, false)
    })

    card.querySelector('.approval-approve-all').addEventListener('click', () => {
      this.respond(requestId, true, true)
    })

    card.querySelector('.approval-deny').addEventListener('click', () => {
      this.respond(requestId, false, false)
    })

    this.pendingApprovals.set(requestId, card)
    this.updateQueueBadges()

    if (this.onApprovalChange) {
      this.onApprovalChange(this.pendingApprovals.size)
    }
  }

  /**
   * Shows a "+N more pending" badge directly on each approval card when
   * more than one action is queued, not just on the status-bar count.
   */
  updateQueueBadges() {
    const total = this.pendingApprovals.size
    let i = 0
    for (const card of this.pendingApprovals.values()) {
      i++
      const badge = card.querySelector('.approval-queue-badge')
      if (!badge) continue
      if (total > 1) {
        badge.textContent = `${i} of ${total} pending`
        badge.classList.remove('hidden')
      } else {
        badge.classList.add('hidden')
      }
    }
  }

  respond(requestId, approved, approveAll) {
    const card = this.pendingApprovals.get(requestId)
    if (!card) return

    // Animate out
    card.classList.add(approved ? 'approval-approved' : 'approval-denied')

    setTimeout(() => {
      card.remove()
      this.pendingApprovals.delete(requestId)

      if (this.pendingApprovals.size === 0) {
        this.container.classList.remove('has-approvals')
      }
      this.updateQueueBadges()

      if (this.onApprovalChange) {
        this.onApprovalChange(this.pendingApprovals.size)
      }
    }, 300)

    // Send response to service worker
    chrome.runtime.sendMessage({
      type: approved ? 'BROWSER_ACTION_APPROVED' : 'BROWSER_ACTION_DENIED',
      requestId,
      approveAll
    }).catch(() => {})
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  getPendingCount() {
    return this.pendingApprovals.size
  }
}

/**
 * Conversation Sidebar
 *
 * Collapsible left sidebar for managing saved conversations.
 * Features: search, pin, rename, delete, export.
 */

import { FocusTrap } from './focus-trap.js'

export class ConversationSidebar {
  constructor(options = {}) {
    this.sidebar = null
    this.isOpen = false
    this.conversations = []
    this.filteredConversations = []
    // Free-text search query, kept alongside the active tag filter so the two
    // can be combined (see applyFilters()).
    this.searchQuery = ''
    // Currently active tag filter, or null when no tag filter is applied.
    // Clicking an active tag chip again clears this.
    this.activeTagFilter = null
    // Date range filter: 'all' | 'today' | 'week' | 'month'
    this.dateFilter = 'all'
    this.onLoad = options.onLoad || (() => {})
    this.onNewChat = options.onNewChat || (() => {})
    this.onDelete = options.onDelete || (() => {})
    this.onRename = options.onRename || (() => {})
    // Styled dialog helpers (Promise-based), injected by the host (sidepanel.js).
    // Fall back to native window.prompt/confirm if not provided.
    this.promptDialog = options.promptDialog || ((message, title, defaultValue = '') => Promise.resolve(window.prompt(message, defaultValue)))
    this.confirmDialog = options.confirmDialog || ((message, title) => Promise.resolve(window.confirm(message)))
    this.focusTrap = null
  }

  init() {
    this.sidebar = document.getElementById('conv-sidebar')
    if (!this.sidebar) return

    // Toggle button in header
    const toggleBtn = document.getElementById('toggle-sidebar-btn')
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle())
    }

    // Close button
    const closeBtn = document.getElementById('close-sidebar')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close())
    }

    // Backdrop click closes sidebar
    const backdrop = document.getElementById('sidebar-backdrop')
    if (backdrop) {
      backdrop.addEventListener('click', () => this.close())
    }

    // Search (debounced 200ms to avoid lag on fast typing)
    const searchInput = document.getElementById('conv-search')
    if (searchInput) {
      let debounceTimer = null
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => this.filter(searchInput.value), 200)
      })
    }

    // New chat button
    const newChatBtn = document.getElementById('new-chat-sidebar')
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => {
        this.onNewChat()
        this.close()
      })
    }

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        this.toggle()
      }
      if (e.key === 'Escape' && this.isOpen) {
        this.close()
      }
      // "/" focuses the sidebar search, but only when no input/textarea is
      // currently focused (so normal typing elsewhere isn't hijacked).
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const activeTag = document.activeElement?.tagName
        const isEditable = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.isContentEditable
        if (!isEditable) {
          e.preventDefault()
          if (!this.isOpen) this.open()
          const searchInput = document.getElementById('conv-search')
          searchInput?.focus()
        }
      }
    })
  }

  toggle() {
    this.isOpen ? this.close() : this.open()
  }

  open() {
    if (!this.sidebar) return
    this.isOpen = true
    this.sidebar.classList.remove('collapsed')
    this.sidebar.classList.add('expanded')
    const backdrop = document.getElementById('sidebar-backdrop')
    if (backdrop) backdrop.classList.add('visible')
    this.focusTrap = new FocusTrap(this.sidebar)
    this.focusTrap.activate()
    this.loadConversations()
  }

  close() {
    if (!this.sidebar) return
    this.isOpen = false
    this.sidebar.classList.remove('expanded')
    this.sidebar.classList.add('collapsed')
    const backdrop = document.getElementById('sidebar-backdrop')
    if (backdrop) backdrop.classList.remove('visible')
    if (this.focusTrap) {
      this.focusTrap.deactivate()
      this.focusTrap = null
    }
  }

  async loadConversations() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CONVERSATIONS' })
      this.conversations = Array.isArray(response) ? response : []
      // Additive schema: older saved conversations have no `tags` field at
      // all. Default it to an empty array so every conversation object has a
      // consistent, iterable `tags` array regardless of when it was saved.
      this.conversations.forEach(conv => {
        if (!Array.isArray(conv.tags)) conv.tags = []
      })
      this.conversations.sort((a, b) => {
        // Pinned first, then by date
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
      })
      this.activeTagFilter = null
      this.searchQuery = ''
      this.filteredConversations = [...this.conversations]
      this.render()
    } catch (e) {
      console.error('Failed to load conversations:', e)
    }
  }

  filter(query) {
    this.searchQuery = query || ''
    this.applyFilters()
  }

  // Combines the free-text search query with the active tag filter and date range.
  // All filters are applied together: a tag chip narrows the list, the date filter
  // narrows by time, and the search box does tokenized full-text matching.
  applyFilters() {
    let result = this.conversations

    // Tag filter
    if (this.activeTagFilter) {
      result = result.filter(conv => (conv.tags || []).includes(this.activeTagFilter))
    }

    // Date range filter
    if (this.dateFilter !== 'all') {
      const now = Date.now()
      const cutoffs = {
        today: now - 86400000,
        week: now - 7 * 86400000,
        month: now - 30 * 86400000,
      }
      const cutoff = cutoffs[this.dateFilter]
      if (cutoff) {
        result = result.filter(conv => {
          const ts = conv.timestamp || 0
          return ts >= cutoff
        })
      }
    }

    // Tokenized search: split on whitespace, require ALL tokens to match
    // (AND semantics). Each token must appear somewhere in the conversation's
    // name, tags, or message content.
    const query = this.searchQuery.trim()
    if (query) {
      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
      result = result.filter(conv => {
        const name = (conv.name || '').toLowerCase()
        const tags = (conv.tags || []).map(t => t.toLowerCase())
        // Pre-build a lowercase content blob for faster matching
        const contentBlob = conv._searchBlob || this._buildSearchBlob(conv)
        return tokens.every(token =>
          name.includes(token) ||
          tags.some(t => t.includes(token)) ||
          contentBlob.includes(token)
        )
      })
    }

    this.filteredConversations = result
    this.render()
  }

  /** Build and cache a lowercase string of all message content for fast search. */
  _buildSearchBlob(conv) {
    if (!conv.history || conv.history.length === 0) return ''
    const blob = conv.history
      .map(msg => msg.content || '')
      .join(' ')
      .toLowerCase()
    conv._searchBlob = blob
    return blob
  }

  // All unique tags across every saved conversation, used to populate the
  // tag-filter chip row. Sorted alphabetically for a stable, predictable order.
  getAllTags() {
    const tagSet = new Set()
    this.conversations.forEach(conv => {
      (conv.tags || []).forEach(tag => tagSet.add(tag))
    })
    return [...tagSet].sort((a, b) => a.localeCompare(b))
  }

  // Toggles a tag filter chip: clicking the active chip again clears the filter.
  toggleTagFilter(tag) {
    this.activeTagFilter = this.activeTagFilter === tag ? null : tag
    this.applyFilters()
  }

  render() {
    const list = document.getElementById('conv-list')
    if (!list) return

    this.renderTagFilters()
    this.renderDateFilters()
    this.renderResultCount()

    if (this.filteredConversations.length === 0) {
      const emptyMessage = this.searchQuery
        ? `No results for "${this.escapeHtml(this.searchQuery)}"`
        : this.activeTagFilter
          ? `No conversations tagged "${this.escapeHtml(this.activeTagFilter)}"`
          : 'No saved conversations'
      list.innerHTML = `
        <div class="sidebar-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>${emptyMessage}</p>
        </div>
      `
      return
    }

    list.innerHTML = this.filteredConversations.map(conv => {
      const date = conv.timestamp
      const dateStr = date ? this.formatDate(new Date(date)) : ''
      const preview = this.getPreview(conv)
      const pinnedClass = conv.pinned ? 'pinned' : ''
      const tags = conv.tags || []
      const tagsHtml = tags.length
        ? `<div class="sidebar-item-tags">${tags.map(tag => `
              <span class="item-tag">
                <span class="item-tag-label">${this.escapeHtml(tag)}</span>
                <button type="button" class="item-tag-remove" data-action="remove-tag" data-name="${this.escapeHtml(conv.name)}" data-tag="${this.escapeHtml(tag)}" title="Remove tag ${this.escapeHtml(tag)}" aria-label="Remove tag ${this.escapeHtml(tag)} from ${this.escapeHtml(conv.name)}">&times;</button>
              </span>
            `).join('')}</div>`
        : ''

      return `
        <div class="sidebar-item ${pinnedClass}" data-name="${this.escapeHtml(conv.name)}">
          <div class="sidebar-item-content">
            <div class="sidebar-item-header">
              <span class="sidebar-item-name">${this.escapeHtml(conv.name)}</span>
              <span class="sidebar-item-date">${dateStr}</span>
            </div>
            <div class="sidebar-item-preview">${this.escapeHtml(preview)}</div>
            ${tagsHtml}
          </div>
          <div class="sidebar-item-actions">
            <button class="sidebar-action-btn" data-action="pin" data-name="${this.escapeHtml(conv.name)}" title="${conv.pinned ? 'Unpin' : 'Pin'}" aria-label="${conv.pinned ? 'Unpin' : 'Pin'} conversation ${this.escapeHtml(conv.name)}">
              ${conv.pinned ? '📌' : '📍'}
            </button>
            <button class="sidebar-action-btn" data-action="add-tag" data-name="${this.escapeHtml(conv.name)}" title="Add tag" aria-label="Add tag to conversation ${this.escapeHtml(conv.name)}">🏷️</button>
            <button class="sidebar-action-btn" data-action="rename" data-name="${this.escapeHtml(conv.name)}" title="Rename" aria-label="Rename conversation ${this.escapeHtml(conv.name)}">✏️</button>
            <button class="sidebar-action-btn" data-action="delete" data-name="${this.escapeHtml(conv.name)}" title="Delete" aria-label="Delete conversation ${this.escapeHtml(conv.name)}">🗑️</button>
          </div>
        </div>
      `
    }).join('')

    // Bind events
    list.querySelectorAll('.sidebar-item-content').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.closest('.sidebar-item').dataset.name
        this.loadConversation(name)
      })
    })

    list.querySelectorAll('.sidebar-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const action = btn.dataset.action
        const name = btn.dataset.name
        this.handleAction(action, name)
      })
    })

    list.querySelectorAll('.item-tag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const name = btn.dataset.name
        const tag = btn.dataset.tag
        this.removeTag(name, tag)
      })
    })
  }

  // Renders the tag-filter chip row above the conversation list. Hidden
  // entirely when no conversation has any tags yet, matching the existing
  // sidebar convention of only surfacing UI once it's relevant.
  renderTagFilters() {
    const container = document.getElementById('conv-tag-filters')
    if (!container) return

    const tags = this.getAllTags()
    if (tags.length === 0) {
      container.hidden = true
      container.innerHTML = ''
      return
    }

    container.hidden = false
    container.innerHTML = tags.map(tag => {
      const active = this.activeTagFilter === tag
      return `
        <button type="button" class="tag-chip ${active ? 'active' : ''}" data-tag="${this.escapeHtml(tag)}" aria-pressed="${active}" aria-label="Filter by tag ${this.escapeHtml(tag)}" title="Filter by tag ${this.escapeHtml(tag)}">
          ${this.escapeHtml(tag)}
        </button>
      `
    }).join('')

    container.querySelectorAll('.tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.toggleTagFilter(chip.dataset.tag)
      })
    })
  }

  // Renders date-range filter chips above the conversation list.
  renderDateFilters() {
    const container = document.getElementById('conv-date-filters')
    if (!container) return

    const ranges = [
      { key: 'all', label: 'All' },
      { key: 'today', label: 'Today' },
      { key: 'week', label: 'This Week' },
      { key: 'month', label: 'This Month' },
    ]

    container.innerHTML = ranges.map(r => {
      const active = this.dateFilter === r.key
      return `<button type="button" class="date-chip ${active ? 'active' : ''}" data-range="${r.key}" aria-pressed="${active}">${r.label}</button>`
    }).join('')

    container.querySelectorAll('.date-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.dateFilter = chip.dataset.range
        this.applyFilters()
      })
    })
  }

  // Shows "X of Y conversations" when any filter is active.
  renderResultCount() {
    const el = document.getElementById('conv-result-count')
    if (!el) return

    const hasFilters = this.searchQuery || this.activeTagFilter || this.dateFilter !== 'all'
    if (hasFilters) {
      el.textContent = `${this.filteredConversations.length} of ${this.conversations.length} conversations`
      el.hidden = false
    } else {
      el.hidden = true
    }
  }

  loadConversation(name) {
    const conv = this.conversations.find(c => c.name === name)
    if (conv) {
      this.onLoad(conv)
      this.close()
    }
  }

  async handleAction(action, name) {
    switch (action) {
      case 'pin':
        await this.togglePin(name)
        break
      case 'rename':
        await this.renameConversation(name)
        break
      case 'delete':
        await this.deleteConversation(name)
        break
      case 'add-tag':
        await this.addTag(name)
        break
    }
  }

  async togglePin(name) {
    const conv = this.conversations.find(c => c.name === name)
    if (!conv) return
    conv.pinned = !conv.pinned
    // Save back (we need to save all conversations)
    await this.saveConversations()
    this.render()
  }

  async renameConversation(name) {
    const newName = await this.promptDialog('Rename conversation:', 'Rename Conversation', name)
    if (!newName || newName === name) return

    if (this.conversations.some(c => c.name === newName)) return

    const conv = this.conversations.find(c => c.name === name)
    if (!conv) return
    conv.name = newName
    conv.timestamp = Date.now()
    await this.saveConversations()
    this.render()
  }

  async addTag(name) {
    const conv = this.conversations.find(c => c.name === name)
    if (!conv) return
    if (!Array.isArray(conv.tags)) conv.tags = []

    const raw = await this.promptDialog('Add tag (short label, e.g. "work" or "research"):', 'Add Tag', '')
    if (!raw) return

    const tag = raw.trim().slice(0, 30)
    if (!tag) return

    // Case-insensitive de-dupe so "Work" and "work" don't both end up as
    // separate tags on the same conversation.
    const exists = conv.tags.some(t => t.toLowerCase() === tag.toLowerCase())
    if (exists) return

    conv.tags.push(tag)
    await this.saveConversations()
    this.render()
  }

  async removeTag(name, tag) {
    const conv = this.conversations.find(c => c.name === name)
    if (!conv || !Array.isArray(conv.tags)) return
    conv.tags = conv.tags.filter(t => t !== tag)
    // If the tag being removed was the active filter and no conversation
    // carries it anymore, clear the filter so the list doesn't render empty
    // with a stale/invisible active chip.
    if (this.activeTagFilter === tag && !this.conversations.some(c => (c.tags || []).includes(tag))) {
      this.activeTagFilter = null
    }
    await this.saveConversations()
    this.applyFilters()
  }

  async deleteConversation(name) {
    const ok = await this.confirmDialog(`Delete "${name}"?`, 'Delete Conversation')
    if (!ok) return

    this.conversations = this.conversations.filter(c => c.name !== name)
    await this.saveConversations()
    this.onDelete(name)
    this.render()
  }

  async saveConversations() {
    // Save the full conversation list back
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_CONVERSATIONS_BULK',
        conversations: this.conversations
      })
    } catch (e) {
      console.error('Failed to save conversations:', e)
    }
  }

  getPreview(conv) {
    if (!conv.history || conv.history.length === 0) return 'Empty conversation'
    const lastMsg = conv.history[conv.history.length - 1]
    const content = lastMsg?.content || ''
    return content.length > 60 ? content.substring(0, 60) + '...' : content
  }

  formatDate(date) {
    const now = new Date()
    const diff = now - date
    const days = Math.floor(diff / 86400000)
    
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text || ''
    return div.innerHTML
  }
}

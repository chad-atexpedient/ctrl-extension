/**
 * Command Palette
 *
 * VS Code-style command palette triggered by Ctrl+K / Cmd+K.
 * Provides fuzzy search across commands, settings, conversations, and models.
 */

import { FocusTrap } from './focus-trap.js'

export class CommandPalette {
  constructor(options = {}) {
    this.overlay = null
    this.input = null
    this.resultsContainer = null
    this.isOpen = false
    this.selectedIndex = 0
    this.filteredItems = []
    this.allItems = []
    this.focusTrap = null

    this.onExecute = options.onExecute || (() => {})
    this.commandRegistry = options.commandRegistry
    this.conversations = []
  }

  async init() {
    this.overlay = document.getElementById('command-palette')
    if (!this.overlay) {
      this.overlay = document.createElement('div')
      this.overlay.id = 'command-palette'
      this.overlay.className = 'command-palette hidden'
      document.body.appendChild(this.overlay)
    }

    // Global keyboard shortcut
    if (!this._shortcutRegistered) {
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault()
          this.toggle()
        }
      })
      this._shortcutRegistered = true
    }

    // Awaited so models are guaranteed to be in `allItems` before init()
    // resolves — otherwise a palette opened immediately after startup could
    // render before the async model list arrived.
    await this.buildItems()
  }

  async buildItems() {
    this.allItems = []

    // Commands from registry
    if (this.commandRegistry) {
      for (const cmd of this.commandRegistry.getAll()) {
        this.allItems.push({
          id: `cmd-${cmd.name}`,
          icon: cmd.icon,
          title: `/${cmd.name}`,
          description: cmd.description,
          category: cmd.category,
          type: 'command',
          action: () => this.onExecute(cmd, '')
        })
      }
    }

    // Quick actions
    this.allItems.push(
      {
        id: 'action-new-chat',
        icon: '💬',
        title: 'New Chat',
        description: 'Start a fresh conversation',
        category: 'Actions',
        type: 'action',
        action: () => this.onExecute({ handler: 'newChat' }, '')
      },
      {
        id: 'action-export',
        icon: '📤',
        title: 'Export Chat',
        description: 'Export current conversation as JSON',
        category: 'Actions',
        type: 'action',
        action: () => this.onExecute({ handler: 'exportChat' }, '')
      },
      {
        id: 'action-toggle-agent',
        icon: '🖥️',
        title: 'Toggle Browser Agent',
        description: 'Connect/disconnect browser automation',
        category: 'Actions',
        type: 'action',
        action: () => this.onExecute({ handler: 'toggleAgent' }, '')
      },
      {
        id: 'action-open-settings',
        icon: '⚙️',
        title: 'Open Settings',
        description: 'Open extension settings page',
        category: 'Actions',
        type: 'action',
        action: () => chrome.runtime.openOptionsPage()
      },
      {
        id: 'action-toggle-sidebar',
        icon: '📋',
        title: 'Toggle Sidebar',
        description: 'Show/hide conversation sidebar',
        category: 'Actions',
        type: 'action',
        action: () => this.onExecute({ handler: 'toggleSidebar' }, '')
      },
      {
        id: 'action-toggle-drawer',
        icon: '💻',
        title: 'Toggle Code Pane',
        description: 'Show/hide the code output drawer',
        category: 'Actions',
        type: 'action',
        action: () => this.onExecute({ handler: 'toggleDrawer' }, '')
      }
    )

    // Models (populated dynamically; awaited so callers of buildItems()/init()
    // can rely on allItems being complete once the returned promise resolves)
    await this.loadModels()
  }

  async loadModels() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' })
      const models = response?.enabledModels || {}
      const allModels = Object.values(models).flat()
      
      for (const modelId of allModels) {
        this.allItems.push({
          id: `model-${modelId}`,
          icon: '🤖',
          title: `Switch to ${modelId}`,
          description: 'Change the active AI model',
          category: 'Models',
          type: 'model',
          action: () => this.onExecute({ handler: 'switchModel' }, modelId)
        })
      }
    } catch (e) {
      // Models will be empty
    }
  }

  toggle() {
    this.isOpen ? this.close() : this.open()
  }

  open() {
    this.isOpen = true
    this.selectedIndex = 0
    this.overlay.classList.remove('hidden')
    this.render()

    const content = this.overlay.querySelector('.palette-content')
    if (content) {
      this.focusTrap = new FocusTrap(content)
      this.focusTrap.activate()
    }
  }

  close() {
    this.isOpen = false
    this.overlay.classList.add('hidden')
    this.overlay.innerHTML = ''
    if (this.focusTrap) {
      this.focusTrap.deactivate()
      this.focusTrap = null
    }
  }

  render() {
    this.overlay.innerHTML = `
      <div class="palette-backdrop"></div>
      <div class="palette-content">
        <div class="palette-input-wrapper">
          <svg class="palette-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="palette-input" placeholder="Type a command or search..." autocomplete="off" spellcheck="false">
          <kbd class="palette-kbd">Esc</kbd>
        </div>
        <div class="palette-results" id="palette-results"></div>
      </div>
    `

    // Bind events
    const backdrop = this.overlay.querySelector('.palette-backdrop')
    const input = this.overlay.querySelector('#palette-input')

    backdrop.addEventListener('click', () => this.close())
    
    input.addEventListener('input', () => this.search(input.value))
    input.addEventListener('keydown', (e) => this.handleKeydown(e))

    // Initial results
    this.search('')
  }

  search(query) {
    if (!query.trim()) {
      this.filteredItems = [...this.allItems]
    } else {
      const lower = query.toLowerCase()
      this.filteredItems = this.allItems.filter(item =>
        item.title.toLowerCase().includes(lower) ||
        item.description.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower)
      ).sort((a, b) => {
        // Prioritize title matches
        const aTitle = a.title.toLowerCase().startsWith(lower) ? 0 : 1
        const bTitle = b.title.toLowerCase().startsWith(lower) ? 0 : 1
        return aTitle - bTitle
      })
    }

    this.selectedIndex = 0
    this.renderResults()
  }

  renderResults() {
    const container = this.overlay.querySelector('#palette-results')
    if (!container) return

    if (this.filteredItems.length === 0) {
      container.innerHTML = '<div class="palette-empty">No results found</div>'
      return
    }

    // Group by category
    const grouped = {}
    for (const item of this.filteredItems) {
      if (!grouped[item.category]) grouped[item.category] = []
      grouped[item.category].push(item)
    }

    let html = ''
    let globalIndex = 0
    for (const [category, items] of Object.entries(grouped)) {
      html += `<div class="palette-category">${this.escapeHtml(category)}</div>`
      for (const item of items) {
        const selectedClass = globalIndex === this.selectedIndex ? 'selected' : ''
        html += `
          <div class="palette-item ${selectedClass}" data-index="${globalIndex}">
            <span class="palette-item-icon">${this.escapeHtml(item.icon)}</span>
            <div class="palette-item-content">
              <span class="palette-item-title">${this.escapeHtml(item.title)}</span>
              <span class="palette-item-desc">${this.escapeHtml(item.description)}</span>
            </div>
          </div>
        `
        globalIndex++
      }
    }

    container.innerHTML = html

    // Bind click events
    container.querySelectorAll('.palette-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index)
        this.executeItem(index)
      })
    })

    // Scroll selected into view
    const selected = container.querySelector('.palette-item.selected')
    if (selected) selected.scrollIntoView({ block: 'nearest' })
  }

  handleKeydown(e) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        this.close()
        break
      case 'ArrowUp':
        e.preventDefault()
        this.selectedIndex = Math.max(0, this.selectedIndex - 1)
        this.renderResults()
        break
      case 'ArrowDown':
        e.preventDefault()
        this.selectedIndex = Math.min(this.filteredItems.length - 1, this.selectedIndex + 1)
        this.renderResults()
        break
      case 'Enter':
        e.preventDefault()
        this.executeItem(this.selectedIndex)
        break
    }
  }

  executeItem(index) {
    const item = this.filteredItems[index]
    if (item?.action) {
      this.close()
      item.action()
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text || ''
    return div.innerHTML
  }
}

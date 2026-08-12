/**
 * Slash Command System for CTRL Extension
 * 
 * Provides command palette-style slash commands in the chat input.
 * Commands are typed with "/" prefix and show an autocomplete dropdown.
 */

export class CommandRegistry {
  constructor() {
    this.commands = new Map()
    this.registerDefaults()
  }

  register(name, config) {
    this.commands.set(name, {
      name,
      description: config.description || '',
      icon: config.icon || '',
      usage: config.usage || `/${name}`,
      category: config.category || 'General',
      handler: config.handler,
      ...config
    })
  }

  registerDefaults() {
    this.register('clear', {
      description: 'Start a new chat',
      icon: '🗑️',
      category: 'Chat',
      handler: 'newChat'
    })

    this.register('export', {
      description: 'Export current chat as JSON',
      icon: '📤',
      category: 'Chat',
      handler: 'exportChat'
    })

    this.register('import', {
      description: 'Import a chat from JSON file',
      icon: '📥',
      category: 'Chat',
      handler: 'importChat'
    })

    this.register('model', {
      description: 'Switch AI model',
      icon: '🤖',
      usage: '/model [model-name]',
      category: 'Settings',
      handler: 'switchModel'
    })

    this.register('slides', {
      description: 'Generate a presentation',
      icon: '📊',
      usage: '/slides [topic]',
      category: 'Agent',
      handler: 'generateSlides',
      opensDrawer: true
    })

    this.register('data', {
      description: 'Analyze data from CSV/Excel',
      icon: '📈',
      usage: '/data [question]',
      category: 'Agent',
      handler: 'analyzeData',
      opensDrawer: true
    })

    this.register('mvp', {
      description: 'Build a website/MVP',
      icon: '🚀',
      usage: '/mvp [description]',
      category: 'Agent',
      handler: 'generateMvp',
      opensDrawer: true
    })

    this.register('research', {
      description: 'Research a topic with web search',
      icon: '📚',
      usage: '/research [topic]',
      category: 'Agent',
      handler: 'generateResearch',
      opensDrawer: true
    })

    this.register('code', {
      description: 'Generate and run code',
      icon: '💻',
      usage: '/code [description]',
      category: 'Agent',
      handler: 'generateCode',
      opensDrawer: true
    })

    this.register('search', {
      description: 'Search the web',
      icon: '🔍',
      usage: '/search [query]',
      category: 'Agent',
      handler: 'webSearch'
    })

    this.register('agent', {
      description: 'Toggle browser agent on/off',
      icon: '🖥️',
      usage: '/agent [on|off]',
      category: 'Browser',
      handler: 'toggleAgent'
    })

    this.register('preset', {
      description: 'Use a saved agent preset for the next message',
      icon: '🤖',
      usage: '/preset [name]',
      category: 'Agent',
      handler: 'preset'
    })

    this.register('tour', {
      description: 'Show the onboarding tour',
      icon: '🎯',
      category: 'Help',
      handler: 'showTour'
    })

    this.register('help', {
      description: 'List all available commands',
      icon: '❓',
      category: 'Help',
      handler: 'showHelp'
    })

    this.register('theme', {
      description: 'Change the theme',
      icon: '🎨',
      usage: '/theme [name]',
      category: 'Settings',
      handler: 'changeTheme'
    })

    this.register('temp', {
      description: 'Set temperature (0-2)',
      icon: '🌡️',
      usage: '/temp [0-2]',
      category: 'Settings',
      handler: 'setTemperature'
    })
  }

  get(name) {
    return this.commands.get(name)
  }

  getAll() {
    return Array.from(this.commands.values())
  }

  search(query) {
    if (!query) return this.getAll()
    const lower = query.toLowerCase()
    return this.getAll().filter(cmd =>
      cmd.name.includes(lower) ||
      cmd.description.toLowerCase().includes(lower) ||
      cmd.category.toLowerCase().includes(lower)
    )
  }

  /**
   * Parse a message to check if it's a command
   * Returns { isCommand, command, args } or null
   */
  parse(input) {
    const trimmed = input.trim()
    if (!trimmed.startsWith('/')) return null

    const spaceIndex = trimmed.indexOf(' ')
    const commandPart = spaceIndex > 0 ? trimmed.substring(1, spaceIndex) : trimmed.substring(1)
    const args = spaceIndex > 0 ? trimmed.substring(spaceIndex + 1).trim() : ''

    const command = this.commands.get(commandPart)
    if (!command) return null

    return { isCommand: true, command, args }
  }
}

/**
 * Command Autocomplete UI
 * Shows a dropdown of matching commands when user types "/"
 * Supports additional suggestion sources (e.g. snippets)
 */
export class CommandAutocomplete {
  constructor(registry, onSelect) {
    this.registry = registry
    this.onSelect = onSelect
    this.container = null
    this.selectedIndex = 0
    this.filteredCommands = []
    this.isVisible = false
    this.extraSources = []
  }

  /** Register an additional suggestion source (e.g. snippets). */
  addSource(getSuggestions) {
    this.extraSources.push(getSuggestions)
  }

  init() {
    this.container = document.getElementById('command-autocomplete')
    if (!this.container) {
      this.container = document.createElement('div')
      this.container.id = 'command-autocomplete'
      this.container.className = 'command-autocomplete hidden'
      
      const inputContainer = document.querySelector('.input-container')
      if (inputContainer) {
        inputContainer.parentNode.insertBefore(this.container, inputContainer)
      }
    }
  }

  show(query) {
    // Get command matches
    const commandItems = this.registry.search(query).map(cmd => ({
      id: cmd.name,
      type: 'command',
      label: `/${cmd.name}`,
      description: cmd.description,
      icon: cmd.icon,
      category: cmd.category,
      usage: cmd.usage,
      data: cmd,
    }))

    // Get matches from extra sources (e.g. snippets)
    let extraItems = []
    for (const getSource of this.extraSources) {
      try {
        extraItems = extraItems.concat(getSource(query))
      } catch (e) { /* ignore source errors */ }
    }

    this.filteredCommands = [...commandItems, ...extraItems]

    if (this.filteredCommands.length === 0) {
      this.hide()
      return
    }

    this.selectedIndex = 0
    this.isVisible = true
    this.container.classList.remove('hidden')

    // Group by category
    const grouped = {}
    for (const item of this.filteredCommands) {
      const cat = item.category || 'Other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(item)
    }

    let html = ''
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c])
    const filteredIndexMap = new Map()
    for (let i = 0; i < this.filteredCommands.length; i++) {
      filteredIndexMap.set(this.filteredCommands[i].id, i)
    }

    for (const [category, items] of Object.entries(grouped)) {
      html += `<div class="autocomplete-category">${esc(category)}</div>`
      for (const item of items) {
        const flatIndex = filteredIndexMap.get(item.id) ?? -1
        html += `
          <div class="autocomplete-item" data-id="${esc(item.id)}" data-type="${esc(item.type)}" data-index="${flatIndex}">
            <span class="autocomplete-icon">${esc(item.icon)}</span>
            <div class="autocomplete-info">
              <span class="autocomplete-name">${esc(item.label)}</span>
              <span class="autocomplete-desc">${esc(item.description)}</span>
            </div>
            ${item.usage ? `<span class="autocomplete-usage">${esc(item.usage)}</span>` : ''}
          </div>
        `
      }
    }

    this.container.innerHTML = html
    this.updateSelection()

    // Bind click events
    this.container.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = Number(item.dataset.index)
        const clickedItem = this.filteredCommands[idx]
        if (!clickedItem) return
        if (clickedItem.type === 'command') {
          const cmd = this.registry.get(clickedItem.id)
          if (cmd) {
            this.onSelect(cmd)
            this.hide()
          }
        } else {
          if (clickedItem?.action) {
            const expanded = clickedItem.action()
            if (expanded) {
              this.onSelect({ name: clickedItem.id, args: expanded, isSnippet: true })
              this.hide()
            }
          }
        }
      })
    })
  }

  hide() {
    this.isVisible = false
    this.container.classList.add('hidden')
    this.container.innerHTML = ''
  }

  moveUp() {
    if (!this.isVisible) return
    this.selectedIndex = Math.max(0, this.selectedIndex - 1)
    this.updateSelection()
  }

  moveDown() {
    if (!this.isVisible) return
    this.selectedIndex = Math.min(this.filteredCommands.length - 1, this.selectedIndex + 1)
    this.updateSelection()
  }

  selectCurrent() {
    if (!this.isVisible || !this.filteredCommands[this.selectedIndex]) return null
    return this.filteredCommands[this.selectedIndex]
  }

  updateSelection() {
    const items = this.container.querySelectorAll('.autocomplete-item')
    items.forEach(item => {
      const itemIndex = Number(item.dataset.index)
      item.classList.toggle('selected', itemIndex === this.selectedIndex)
    })

    const selected = items[this.selectedIndex]
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    } else {
      const selectedByIndex = this.container.querySelector(`.autocomplete-item[data-index="${this.selectedIndex}"]`)
      if (selectedByIndex) selectedByIndex.scrollIntoView({ block: 'nearest' })
    }
  }
}

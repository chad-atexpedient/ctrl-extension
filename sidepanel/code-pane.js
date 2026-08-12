/**
 * Code Pane Controller
 *
 * Manages the drawer-style code/output pane that slides up from the bottom.
 * Contains three tabs: Output, Terminal, Preview
 */

import { FocusTrap } from './focus-trap.js'

export class CodePaneController {
  constructor() {
    this.pane = null
    this.isOpen = false
    this.currentTab = 'output'
    this.currentHtml = null
    this.terminalHistory = []
    this.terminalHistoryIndex = -1
    this.focusTrap = null
  }

  init() {
    this.pane = document.getElementById('code-pane')
    this.drawerHandle = document.getElementById('drawer-handle')
    
    if (!this.pane) return

    // Tab switching
    this.pane.querySelectorAll('.code-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab))
    })

    // Close button
    const closeBtn = document.getElementById('close-code-pane')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close())
    }

    // Drawer handle drag
    if (this.drawerHandle) {
      this.drawerHandle.addEventListener('click', () => {
        this.isOpen ? this.close() : this.open()
      })
    }

    // Keyboard shortcut: Ctrl/Cmd+J toggles the code pane directly, without
    // going through the command palette. Chosen to avoid colliding with
    // existing shortcuts in this extension (Ctrl/Cmd+K = command palette,
    // Ctrl/Cmd+Shift+S = conversation sidebar, "/" = sidebar search).
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        this.isOpen ? this.close() : this.open()
      }
    })

    // Terminal input
    const terminalInput = document.getElementById('terminal-input')
    if (terminalInput) {
      terminalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.executeTerminalCommand(terminalInput.value)
          terminalInput.value = ''
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          this.navigateTerminalHistory(-1)
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          this.navigateTerminalHistory(1)
        }
      })
    }
  }

  open() {
    if (!this.pane) return
    this.isOpen = true
    this.pane.classList.remove('hidden')
    this.pane.style.willChange = 'transform'

    requestAnimationFrame(() => {
      this.pane.classList.add('drawer-open')
    })
    this.drawerHandle?.classList.add('drawer-active')

    this.focusTrap = new FocusTrap(this.pane)
    this.focusTrap.activate()
  }

  close() {
    if (!this.pane) return
    this.isOpen = false
    this.pane.classList.remove('drawer-open')
    this.drawerHandle?.classList.remove('drawer-active')

    if (this.focusTrap) {
      this.focusTrap.deactivate()
      this.focusTrap = null
    }

    const onEnd = () => {
      if (!this.isOpen) {
        this.pane.classList.add('hidden')
        this.pane.style.willChange = ''
      }
      this.pane.removeEventListener('transitionend', onEnd)
    }
    this.pane.addEventListener('transitionend', onEnd)
    // Fallback in case transitionend doesn't fire
    setTimeout(() => {
      if (!this.isOpen) {
        this.pane.classList.add('hidden')
        this.pane.style.willChange = ''
      }
    }, 350)
  }

  switchTab(tabName) {
    this.currentTab = tabName
    
    // Update tab buttons
    this.pane.querySelectorAll('.code-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName)
    })

    // Update tab content
    this.pane.querySelectorAll('.code-tab-content').forEach(content => {
      content.classList.toggle('hidden', content.id !== `tab-${tabName}`)
    })
  }

  // === Output Tab ===

  showOutput(html, title = 'Output') {
    const outputEl = document.getElementById('code-output')
    if (!outputEl) return

    this.currentHtml = html
    outputEl.innerHTML = html
    this.switchTab('output')
    
    if (!this.isOpen) this.open()
  }

  clearOutput() {
    const outputEl = document.getElementById('code-output')
    if (outputEl) outputEl.innerHTML = '<div class="output-empty">No output yet. Use agent commands like /slides, /data, /mvp to generate content.</div>'
  }

  // === Preview Tab ===

  showPreview(html) {
    const previewFrame = document.getElementById('preview-sandbox')
    if (!previewFrame) return

    this.currentHtml = html
    previewFrame.src = '../sandbox/sandbox.html'
    previewFrame.onload = () => {
      previewFrame.contentWindow.postMessage({ type: 'render', html }, '*')
    }

    this.switchTab('preview')
    if (!this.isOpen) this.open()
  }

  // === Terminal Tab ===

  appendToTerminal(text, type = 'output') {
    const terminalOutput = document.getElementById('terminal-output')
    if (!terminalOutput) return

    const line = document.createElement('div')
    line.className = `terminal-line terminal-${type}`
    
    if (type === 'command') {
      line.innerHTML = `<span class="terminal-prompt-symbol">$</span> <span class="terminal-cmd">${this.escapeHtml(text)}</span>`
    } else if (type === 'error') {
      line.innerHTML = `<span class="terminal-error">${this.escapeHtml(text)}</span>`
    } else {
      line.textContent = text
    }

    terminalOutput.appendChild(line)
    terminalOutput.scrollTop = terminalOutput.scrollHeight
  }

  clearTerminal() {
    const terminalOutput = document.getElementById('terminal-output')
    if (terminalOutput) terminalOutput.innerHTML = ''
  }

  async executeTerminalCommand(command) {
    if (!command || typeof command !== 'string') return
    const cmd = command.trim()
    if (!cmd) return

    this.terminalHistory.push(command)
    this.terminalHistoryIndex = this.terminalHistory.length
    this.appendToTerminal(command, 'command')

    // Built-in terminal commands
    const lower = cmd.toLowerCase()
    if (lower === 'clear' || lower === 'cls') {
      this.clearTerminal()
      return
    }

    if (lower === 'help') {
      this.appendToTerminal('Available commands:', 'info')
      this.appendToTerminal('  clear/cls  - Clear terminal', 'info')
      this.appendToTerminal('  help       - Show this help', 'info')
      this.appendToTerminal('  Any other input is sent to the AI code interpreter', 'info')
      return
    }

    // Send to code interpreter via service worker
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_TOOL',
        tool: 'code_interpreter',
        args: { code: command, language: 'auto' }
      })

      if (response?.error) {
        this.appendToTerminal(response.error, 'error')
      } else if (response?.content) {
        this.appendToTerminal(response.content, 'output')
      } else if (response?.result) {
        this.appendToTerminal(JSON.stringify(response.result, null, 2), 'output')
      }
    } catch (e) {
      this.appendToTerminal(`Error: ${e.message}`, 'error')
    }
  }

  navigateTerminalHistory(direction) {
    const terminalInput = document.getElementById('terminal-input')
    if (!terminalInput || this.terminalHistory.length === 0) return

    this.terminalHistoryIndex += direction
    this.terminalHistoryIndex = Math.max(0, Math.min(this.terminalHistory.length - 1, this.terminalHistoryIndex))
    terminalInput.value = this.terminalHistory[this.terminalHistoryIndex] || ''
  }

  // === Utilities ===

  getExportHtml() {
    return this.currentHtml
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

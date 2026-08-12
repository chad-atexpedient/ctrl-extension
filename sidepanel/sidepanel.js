import { AgentHandler } from './agent.js';
import { APIClient } from '../utils/api-client.js';
import { ActionApprovalManager } from './action-approval.js';
import { CommandRegistry, CommandAutocomplete } from './commands.js';
import { CodePaneController } from './code-pane.js';
import { ConversationSidebar } from './sidebar.js';
import { OnboardingWizard } from './onboarding.js';
import { CommandPalette } from './command-palette.js';
import { PromptSnippets } from './prompt-snippets.js';
import { seedExampleConversations } from '../utils/example-conversations.js';
import { StreamingMessage } from './streaming-message.js';

import { PROVIDERS } from '../utils/storage.js';
import { ModelSelectionManager } from '../utils/model-selection-manager.js';
import { consentManager, ConsentTypes } from '../utils/consent-manager.js';

class ChatUI {
  constructor() {
    this.messages = []
    this.isGenerating = false
    this.isStreaming = false
    this.pageContext = null
    this.includeContext = true
    this.currentMode = 'smart'
    this.currentStreamingMessage = null
    this.enabledModels = {}
    this.totalTokenEstimate = 0
    this.totalCostEstimate = 0

    // Event listener cleanup tracking
    this.eventListeners = []

    // Initialize API Client to be shared with AgentHandler
    this.apiClient = new APIClient();

    // Initialize Action Approval Manager
    this.actionApproval = new ActionApprovalManager();

    // Initialize Command System
    this.commandRegistry = new CommandRegistry();
    this.codePane = new CodePaneController();

    // Initialize Conversation Sidebar
    this.sidebar = new ConversationSidebar({
      onLoad: (conv) => this.loadConversation(conv.name, [conv]),
      onNewChat: () => this.newChat(true),
      onDelete: (name) => this.showToast(`Deleted "${name}"`),
      promptDialog: (msg, title, def) => this.promptDialog(msg, title, def),
      confirmDialog: (msg, title) => this.confirmDialog(msg, title)
    });

    // Initialize Onboarding Wizard
    this.onboarding = new OnboardingWizard({
      onComplete: async () => {
          this.showToast('Setup complete! You\'re ready to go.')
          if (this.onboardingWizard?.selectedTheme) {
            try {
              await chrome.runtime.sendMessage({
                type: 'SAVE_SETTINGS',
                settings: { theme: this.onboardingWizard.selectedTheme }
              })
            } catch (e) {
              console.error('[Sidepanel] Failed to save onboarding theme:', e)
            }
          }
        }
    });

    // Initialize Command Palette
    this.commandPalette = new CommandPalette({
      commandRegistry: this.commandRegistry,
      onExecute: (cmd, args) => this.executeCommand(cmd, args)
    });

    this.promptSnippets = new PromptSnippets();

    this.elements = this.cacheElements()
    this.init()

    // Initialize Agent Handler
    this.agentHandler = new AgentHandler(this.apiClient, this);
  }

  cacheElements() {
    return {
      messages: document.getElementById('messages'),
      messageInput: document.getElementById('message-input'),
      sendBtn: document.getElementById('send-btn'),
      micBtn: document.getElementById('mic-btn'),
      modelSelect: document.getElementById('model-select'),
      settingsBtn: document.getElementById('settings-btn'),
      setupBtn: document.getElementById('setup-btn'),
      setupBanner: document.getElementById('setup-banner'),
      includeContextPill: document.getElementById('include-context'),
      modeBtns: document.querySelectorAll('.mode-btn'),
      streamingIndicator: document.getElementById('streaming-indicator'),
      stopStreamBtn: document.getElementById('stop-stream-btn'),
      errorToast: document.getElementById('error-toast'),
      chatContainer: document.getElementById('chat-container'),
      welcomeScreen: document.getElementById('welcome-screen'),
      newChatBtn: document.getElementById('new-chat-btn'),
      newChatMenu: document.getElementById('new-chat-menu'),
      webAgentToggle: document.getElementById('web-agent-toggle'),
      webAgentStatus: document.getElementById('web-agent-status'),
      attachBtn: document.getElementById('attach-btn'),
      fileInput: document.getElementById('file-input'),
      imagePreviewBar: document.getElementById('image-preview-bar'),
      tokenUsage: document.getElementById('token-usage'),
      costUsage: document.getElementById('cost-usage'),
      micListeningLabel: document.getElementById('mic-listening-label'),
      consentBanner: document.getElementById('consent-banner')
    }
  }

  /**
   * Adds an event listener with tracking for cleanup
   * @param {EventTarget} element - The element to attach listener to
   * @param {string} event - The event type
   * @param {Function} handler - The event handler
   * @param {Object} options - Event listener options
   */
  addTrackedListener(element, event, handler, options = {}) {
    if (!element) {
      console.warn(`addTrackedListener: missing element for event "${event}"`)
      return
    }
    element.addEventListener(event, handler, options)
    this.eventListeners.push({ element, event, handler, options })
  }

  /**
   * Removes all tracked event listeners to prevent memory leaks
   */
  cleanup() {
    this.eventListeners.forEach(({ element, event, handler, options }) => {
      try { element.removeEventListener(event, handler, options) } catch {}
    })
    this.eventListeners = []

    // Clean up storage listeners
    if (this.storageListener) {
      try { chrome.storage.onChanged.removeListener(this.storageListener) } catch {}
      this.storageListener = null
    }
    // Clean up stream listener
    if (this.streamListener) {
      try { chrome.runtime.onMessage.removeListener(this.streamListener) } catch {}
      this.streamListener = null
    }
  }

  setupStorageListener() {
    this.storageListener = (changes, areaName) => {
      if (areaName === 'local' && changes.settings) {
        const newSettings = changes.settings.newValue
        if (newSettings && newSettings.theme) {
          this.applyThemeToElement(newSettings.theme)
        }
        if (newSettings && newSettings.density) {
          this.applyDensityToElement(newSettings.density)
        }
      }
    }
    chrome.storage.onChanged.addListener(this.storageListener)
  }

  setupStreamListener() {
    this.streamListener = (message, sender, sendResponse) => {
      if (message.type === 'STREAM_CHUNK') {
        if (this.currentStreamingMessage) {
          this.currentStreamingMessage.appendChunk(message.chunk)
          this.scrollToBottom()
        }
      } else if (message.type === 'STREAM_COMPLETE') {
        if (this.currentStreamingMessage) {
          const content = this.currentStreamingMessage.finalize(message.fullContent)
          this.currentStreamingMessage = null
          this.isStreaming = false
          this.scrollToBottom()
          this._trackMessage('assistant', content)
        }
      } else if (message.type === 'STREAM_ERROR') {
        if (this.currentStreamingMessage) {
          this.currentStreamingMessage.abort()
          this.currentStreamingMessage = null
          this.isStreaming = false
          this.showInlineError(message.error || 'Streaming failed',
            this.lastUserMessage ? () => this.sendMessage(this.lastUserMessage, this.lastUserAttachments) : null)
        }
      }
    }
    chrome.runtime.onMessage.addListener(this.streamListener)
  }

  async init() {
    try {
      // Setup storage listener first
      this.setupStorageListener()
      
      this.bindEvents()
      this.setupVoiceInput()
      this.setupMessageDelegation()
      this.actionApproval.init()
      this.codePane.init()
      this.setupStreamListener()
      // Seed example conversations on first run (before sidebar loads)
      await seedExampleConversations()
      this.sidebar.init()
      await this.onboarding.init()
      await this.commandPalette.init()
      await this.promptSnippets.init()

      // Initialize command autocomplete
      this.commandAutocomplete = new CommandAutocomplete(
        this.commandRegistry,
        (cmd) => {
          if (cmd.isSnippet) {
            // Snippet selected from autocomplete — insert expanded content
            this.elements.messageInput.value = cmd.args
            this.commandAutocomplete.hide()
            this.autoResize()
            this.elements.messageInput.focus()
          } else {
            this.executeCommand(cmd, '')
          }
        }
      )
      // Register snippet suggestions as an extra autocomplete source
      this.commandAutocomplete.addSource((query) => this.promptSnippets.getSuggestions(query))
      this.commandAutocomplete.init()

      // Update approval count badge
      this.actionApproval.onApprovalChange = (count) => {
        const badge = document.getElementById('approval-count')
        if (badge) {
          badge.textContent = count
          badge.classList.toggle('hidden', count === 0)
        }
      }

      await this.applyTheme()
      await this.applyDensity()
      await this.loadState()
      await this.loadChatHistory()
      // consentManager must be initialized (hydrated from storage) before fetchPageContext()
      // checks hasConsented() — otherwise it'd be reading a null in-memory consentState.
      await consentManager.initialize()
      await this.fetchPageContext()
      await this.checkConsentBanner()
      this.updateUI()

      // Check for quick prompt from popup
      chrome.storage.local.get(['pending_quick_prompt'], (result) => {
        if (result.pending_quick_prompt) {
          this.elements.messageInput.value = result.pending_quick_prompt
          this.autoResize()
          chrome.storage.local.remove('pending_quick_prompt')
          setTimeout(() => this.sendMessage(), 300)
        }
      })

      // Wire cleanup on window unload to prevent memory leaks in dev
      window.addEventListener('beforeunload', () => this.cleanup())
      window.addEventListener('pagehide', () => this.cleanup())
    } catch (error) {
      console.error('Initialization error:', error)
      this.showError('Failed to initialize. Please reload the extension.')
    }
  }
  
  /**
   * Ensures the welcome screen is present in #messages and visible.
   * Safe to call after `messages.innerHTML = ''`, which detaches
   * (but doesn't destroy) the cached welcomeScreen node.
   */
  showWelcomeScreen() {
    const { messages, welcomeScreen } = this.elements
    if (!messages || !welcomeScreen) return
    if (welcomeScreen.parentElement !== messages) {
      messages.appendChild(welcomeScreen)
    }
    welcomeScreen.classList.remove('hidden')
  }

  /**
   * Hides the welcome screen without removing it from the DOM.
   */
  hideWelcomeScreen() {
    this.elements.welcomeScreen?.classList.add('hidden')
  }

  applyThemeToElement(theme) {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }

  /**
   * Applies the compact/comfortable density setting to the document root
   * as `data-density`, mirroring the theme pattern above.
   */
  applyDensityToElement(density) {
    document.documentElement.dataset.density = density === 'compact' ? 'compact' : 'comfortable'
  }

  async applyDensity() {
    try {
      const state = await this.sendToBackground({ type: 'GET_SETTINGS' })
      this.applyDensityToElement(state?.density || 'comfortable')
    } catch (error) {
      console.error('Density error:', error)
      this.applyDensityToElement('comfortable')
      this.showToast('Could not load display settings; using defaults.', 'warning')
    }
  }

  /**
   * Shows a lightweight banner if a required consent (privacy policy,
   * context awareness, etc.) is still pending. Does not itself grant or
   * request consent — only options.js's consent UI records real decisions.
   * ConsentManager.initialize() now hydrates state from the 'user_consent'
   * storage key and returns pendingConsents without waiting on any modal
   * event, so it's safe to call directly here.
   */
  async checkConsentBanner() {
    try {
      const { pendingConsents } = await consentManager.initialize()
      if (pendingConsents && pendingConsents.length > 0) {
        this.showConsentBanner(pendingConsents[0])
      }
    } catch (error) {
      console.error('Consent check error:', error)
      this.showToast('Could not check consent status. Some features may be limited until you reload.', 'warning')
    }
  }

  showConsentBanner(type) {
    const banner = this.elements.consentBanner
    if (!banner) return
    const textEl = banner.querySelector('.consent-banner-text')
    const labels = {
      [ConsentTypes.PRIVACY_POLICY]: 'Please review our Privacy Policy to continue using CTRL Extension.',
      [ConsentTypes.CONTEXT_AWARENESS]: "CTRL would like to include this page's content in your conversations, which sends it to your selected AI provider. Allow this?",
      [ConsentTypes.MODEL_SELECTION]: 'Choose which AI models you want CTRL to use.',
      [ConsentTypes.PROVIDER_CONFIG]: 'Set up API keys for your preferred AI providers.'
    }
    if (textEl) {
      textEl.textContent = labels[type] || 'CTRL needs your input on a pending permission.'
    }

    // CONTEXT_AWARENESS is the one consent type tied to a concrete, gateable sensitive
    // action (page content being sent to a third-party API) rather than general settings, so
    // it gets a real Allow/Not now decision recorded via consentManager instead of routing to
    // the settings page. Everything else keeps the existing Review/Dismiss behavior.
    this._consentBannerType = type
    const isActionable = type === ConsentTypes.CONTEXT_AWARENESS
    banner.querySelector('.consent-banner-accept')?.classList.toggle('hidden', !isActionable)
    banner.querySelector('.consent-banner-decline')?.classList.toggle('hidden', !isActionable)
    banner.querySelector('.consent-banner-review')?.classList.toggle('hidden', isActionable)

    banner.classList.remove('hidden')
  }

  bindEvents() {
    // Send message
    this.addTrackedListener(this.elements.sendBtn, 'click', () => this.sendMessage())
    this.addTrackedListener(this.elements.messageInput, 'keydown', (e) => {
      // Handle autocomplete navigation
      if (this.commandAutocomplete?.isVisible) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          this.commandAutocomplete.moveUp()
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          this.commandAutocomplete.moveDown()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          this.commandAutocomplete.hide()
          return
        }
        // Enter or Tab selects the highlighted item instead of sending
        if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
          e.preventDefault()
          const selected = this.commandAutocomplete.selectCurrent()
          if (selected) {
            // Let the autocomplete's onSelect callback handle it
            if (selected.type === 'command') {
              this.commandAutocomplete.onSelect(selected.data)
            } else if (selected.action) {
              const expanded = selected.action()
              if (expanded) {
                this.commandAutocomplete.onSelect({ name: selected.id, args: expanded, isSnippet: true })
              }
            }
            this.commandAutocomplete.hide()
            this.autoResize()
          }
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })
    this.addTrackedListener(this.elements.messageInput, 'input', () => {
      this.autoResize()
      
      // Show command autocomplete for any input starting with "/" (no
      // length cutoff — commands like /theme or /research take arguments
      // that can easily exceed a short character limit).
      const value = this.elements.messageInput.value
      if (value.startsWith('/') && !value.includes('\n')) {
        const query = value.substring(1)
        this.commandAutocomplete?.show(query)
      } else {
        this.commandAutocomplete?.hide()
      }
    })

    // Model selector
    this.addTrackedListener(this.elements.modelSelect, 'change', (e) => this.changeModel(e.target.value))

    // Settings
    this.addTrackedListener(this.elements.settingsBtn, 'click', () => this.openSettings())
    if(this.elements.setupBtn) {
      this.addTrackedListener(this.elements.setupBtn, 'click', () => this.openSettings())
    }

    // Context Pill
    if(this.elements.includeContextPill) {
      this.addTrackedListener(this.elements.includeContextPill, 'change', async (e) => {
        this.includeContext = e.target.checked
        // Manually checking the box is itself an explicit consent decision — record it so
        // the banner doesn't nag again next session, and hide the banner if it's showing.
        if (e.target.checked && !consentManager.hasConsented(ConsentTypes.CONTEXT_AWARENESS)) {
          try {
            await consentManager.acceptConsent(ConsentTypes.CONTEXT_AWARENESS)
            if (this._consentBannerType === ConsentTypes.CONTEXT_AWARENESS) {
              this.elements.consentBanner?.classList.add('hidden')
            }
          } catch (error) {
            console.error('Failed to save consent:', error)
          }
        }
      })
    }

    // Action Bar Modes
    this.elements.modeBtns.forEach(btn => {
      if (btn.id === 'web-agent-toggle') return
      this.addTrackedListener(btn, 'click', (e) => {
        this.elements.modeBtns.forEach(b => {
          if (b.id !== 'web-agent-toggle') {
            b.classList.remove('active')
            b.setAttribute('aria-pressed', 'false')
          }
        })
        e.currentTarget.classList.add('active')
        e.currentTarget.setAttribute('aria-pressed', 'true')
        this.currentMode = e.currentTarget.dataset.mode
      })
    })

    // Web Agent Toggle
    if (this.elements.webAgentToggle) {
      this.addTrackedListener(this.elements.webAgentToggle, 'click', () => this.toggleWebAgent())
      this.checkWebAgentStatus()
    }

    // Streaming
    this.addTrackedListener(this.elements.stopStreamBtn, 'click', () => this.stopGeneration())

    // Quick actions - use event delegation
    const handleQuickAction = (e) => {
      const btn = e.target.closest('.quick-action')
      if (btn) {
        const prompt = btn.dataset.prompt
        this.elements.messageInput.value = prompt
        this.autoResize()
        this.elements.messageInput.focus()
      }
    }
    this.addTrackedListener(document, 'click', handleQuickAction)

    // New chat dropdown
    this.addTrackedListener(this.elements.newChatBtn, 'click', (e) => {
      e.stopPropagation()
      this.toggleDropdown(this.elements.newChatMenu)
    })

    // Dropdown items - use event delegation
    const handleDropdownItem = (e) => {
      const item = e.target.closest('.dropdown-item')
      if (item) {
        const action = item.dataset.action
        this.handleNewChatAction(action)
        this.closeDropdowns()
      }
    }
    this.addTrackedListener(document, 'click', handleDropdownItem)

    // Close dropdowns on outside click - use event delegation
    // (was checking the nonexistent class ".new-chat-menu" — the element's
    // actual class is "dropdown-menu", id "new-chat-menu". This happened to
    // still work because the delegated dropdown-item handler above is
    // registered first and runs before this one, but it meant *every* click
    // anywhere on the page — including inside the open menu — was treated as
    // "outside" and closed it, which is fragile and breaks if handler order
    // ever changes.)
    this.addTrackedListener(document, 'click', (e) => {
      if (!e.target.closest('#new-chat-menu') && !e.target.closest('#new-chat-btn')) {
        this.closeDropdowns()
      }
    })

    // Modal close - use event delegation
    const handleModalClose = (e) => {
      const btn = e.target.closest('[data-close]')
      if (btn) {
        const modalId = btn.dataset.close
        document.getElementById(modalId)?.classList.add('hidden')
      }
    }
    this.addTrackedListener(document, 'click', handleModalClose)

    // Attach button + file input
    if (this.elements.attachBtn) {
      this.addTrackedListener(this.elements.attachBtn, 'click', () => {
        this.elements.fileInput?.click()
      })
    }
    if (this.elements.fileInput) {
      this.addTrackedListener(this.elements.fileInput, 'change', (e) => {
        this.handleFiles(Array.from(e.target.files))
        e.target.value = ''
      })
    }

    // Paste images into textarea
    this.addTrackedListener(this.elements.messageInput, 'paste', (e) => {
      const items = Array.from(e.clipboardData?.items || [])
      const imageItems = items.filter(item => item.type.startsWith('image/'))
      if (imageItems.length === 0) return
      e.preventDefault()
      imageItems.forEach(item => {
        const file = item.getAsFile()
        if (file) this.addImageAttachment(file)
      })
    })

    // Consent banner actions
    if (this.elements.consentBanner) {
      const reviewBtn = this.elements.consentBanner.querySelector('.consent-banner-review')
      const dismissBtn = this.elements.consentBanner.querySelector('.consent-banner-dismiss')
      if (reviewBtn) {
        this.addTrackedListener(reviewBtn, 'click', () => {
          this.openSettings()
        })
      }
      if (dismissBtn) {
        this.addTrackedListener(dismissBtn, 'click', () => {
          // Dismiss for this session only — do not fabricate a consent decision.
          this.elements.consentBanner.classList.add('hidden')
        })
      }

      const acceptBtn = this.elements.consentBanner.querySelector('.consent-banner-accept')
      const declineBtn = this.elements.consentBanner.querySelector('.consent-banner-decline')
      if (acceptBtn) {
        this.addTrackedListener(acceptBtn, 'click', async () => {
          try {
            await consentManager.acceptConsent(ConsentTypes.CONTEXT_AWARENESS)
            // Page context may already have been fetched (fetchPageContext() gates the
            // *automatic* enable on prior consent, not the fetch itself) — turn it on now
            // that the user has explicitly allowed it, rather than requiring a page reload.
            if (this.pageContext && this.elements.includeContextPill) {
              this.elements.includeContextPill.checked = true
              this.includeContext = true
            }
            this.elements.consentBanner.classList.add('hidden')
            this.showToast('Page context enabled.', 'success')
          } catch (error) {
            console.error('Failed to save consent:', error)
            this.showToast('Could not save your choice. Please try again.', 'error')
          }
        })
      }
      if (declineBtn) {
        this.addTrackedListener(declineBtn, 'click', async () => {
          try {
            await consentManager.declineConsent(ConsentTypes.CONTEXT_AWARENESS)
            if (this.elements.includeContextPill) {
              this.elements.includeContextPill.checked = false
            }
            this.includeContext = false
            this.elements.consentBanner.classList.add('hidden')
          } catch (error) {
            console.error('Failed to save consent:', error)
            this.showToast('Could not save your choice. Please try again.', 'error')
          }
        })
      }
    }

    // "?" toggles the keyboard shortcuts cheat sheet, but only when no
    // input/textarea/contenteditable is focused (same guard as the "/"
    // sidebar-search shortcut in sidebar.js).
    this.addTrackedListener(document, 'keydown', (e) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const activeTag = document.activeElement?.tagName
        const isEditable = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.isContentEditable
        if (!isEditable) {
          e.preventDefault()
          this.toggleShortcutsModal()
        }
      }
    })

    // Escape closes the shortcuts modal and the new-chat dropdown. The
    // confirm/prompt dialogs already have their own Escape handling scoped
    // to their promise lifecycle (see confirmDialog/promptDialog below), so
    // this only needs to cover the plain-toggle UI that doesn't go through
    // that flow.
    this.addTrackedListener(document, 'keydown', (e) => {
      if (e.key !== 'Escape') return
      const shortcutsModal = document.getElementById('shortcuts-modal')
      if (shortcutsModal && !shortcutsModal.classList.contains('hidden')) {
        shortcutsModal.classList.add('hidden')
        return
      }
      if (this.elements.newChatMenu && !this.elements.newChatMenu.classList.contains('hidden')) {
        this.closeDropdowns()
        this.elements.newChatBtn?.focus()
      }
    })

    // Drag-drop into the chat container
    const chatContainer = this.elements.chatContainer || document.body
    let dragCounter = 0
    this.addTrackedListener(chatContainer, 'dragenter', (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return
      e.preventDefault()
      dragCounter++
      this.elements.imagePreviewBar?.classList.add('dragover')
    })
    this.addTrackedListener(chatContainer, 'dragleave', (e) => {
      dragCounter--
      if (dragCounter <= 0) {
        dragCounter = 0
        this.elements.imagePreviewBar?.classList.remove('dragover')
      }
    })
    this.addTrackedListener(chatContainer, 'dragover', (e) => {
      if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
    })
    this.addTrackedListener(chatContainer, 'drop', (e) => {
      if (!e.dataTransfer?.files?.length) return
      e.preventDefault()
      dragCounter = 0
      this.elements.imagePreviewBar?.classList.remove('dragover')
      this.handleFiles(Array.from(e.dataTransfer.files))
    })
  }

  /** @type {Array<{id:string,name:string,size:number,type:string,dataUrl?:string,mediaType?:string,content?:string}>} */
  attachments = []

  async handleFiles(files) {
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        this.showError(`"${file.name}" exceeds 20MB limit`)
        continue
      }
      try {
        if (file.type.startsWith('image/')) {
          await this.addImageAttachment(file)
        } else {
          await this.addFileAttachment(file)
        }
      } catch (error) {
        console.error('Failed to read file:', file.name, error)
        this.showError(`Could not read "${file.name}". The file may be corrupted or unreadable.`)
      }
    }
  }

  addImageAttachment(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        this.attachments.push({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: e.target.result,
          mediaType: file.type
        })
        this.renderAttachmentPreview()
        resolve()
      }
      reader.onerror = () => reject(reader.error || new Error('FileReader error'))
      reader.readAsDataURL(file)
    })
  }

  async addFileAttachment(file) {
    const reader = new FileReader()
    const content = await new Promise((resolve, reject) => {
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(reader.error || new Error('FileReader error'))
      reader.readAsText(file)
    })
    this.attachments.push({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type || 'text/plain',
      content: content.slice(0, 100000)
    })
    this.renderAttachmentPreview()
  }

  removeAttachment(id) {
    this.attachments = this.attachments.filter(a => a.id !== id)
    this.renderAttachmentPreview()
  }

  renderAttachmentPreview() {
    const bar = this.elements.imagePreviewBar
    if (!bar) return
    if (this.attachments.length === 0) {
      bar.classList.add('hidden')
      bar.innerHTML = ''
      return
    }
    bar.classList.remove('hidden')
    bar.innerHTML = this.attachments.map(att => {
      const isImage = !!att.dataUrl
      const thumb = isImage
        ? `<img src="${att.dataUrl}" alt="${att.name}" />`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`
      return `
        <div class="preview-chip" data-id="${att.id}">
          ${thumb}
          <div class="chip-info">
            <span class="chip-name">${att.name}</span>
            <span class="chip-size">${this.formatFileSize(att.size)}</span>
          </div>
          <button type="button" class="chip-remove" data-remove="${att.id}" aria-label="Remove ${this.escapeHtml(att.name)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>`
    }).join('')

    bar.querySelectorAll('[data-remove]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        this.removeAttachment(el.dataset.remove)
      })
    })
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  /**
   * Returns objects in API shape: { images: [...], files: [...] }
   * and resets the attachments array afterward
   */
  consumeAttachments() {
    const images = this.attachments.filter(a => a.dataUrl).map(a => ({
      dataUrl: a.dataUrl,
      mediaType: a.mediaType
    }))
    const files = this.attachments.filter(a => !a.dataUrl).map(a => ({
      name: a.name,
      content: a.content,
      mimeType: a.type
    }))
    this.attachments = []
    this.renderAttachmentPreview()
    return { images, files }
  }
  
  setupVoiceInput() {
    this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!this.SpeechRecognition) {
      if(this.elements.micBtn) {
        this.elements.micBtn.style.display = 'none';
        this.elements.micBtn.setAttribute('aria-hidden', 'true');
      }
      return;
    }
    
    // Create an invisible iframe to ask for microphone permission securely if needed
    // Chrome restricts this in side panel unless explicitly granted.
    const setupMicPermission = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        this.recognition = new this.SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.isRecording = false;

        this.recognition.onstart = () => {
          this.isRecording = true;
          this.elements.micBtn.classList.add('recording');
          this.elements.micBtn.classList.add('listening');
          this.elements.micBtn.setAttribute('aria-pressed', 'true');
          this.elements.micListeningLabel?.classList.remove('hidden');
        };
        
        this.recognition.onresult = (event) => {
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          
          if (finalTranscript) {
            const currentVal = this.elements.messageInput.value;
            this.elements.messageInput.value = currentVal ? currentVal + ' ' + finalTranscript.trim() : finalTranscript.trim();
            this.autoResize();
          }
        };
        
        this.recognition.onerror = (event) => {
          console.error('Speech recognition error', event.error);
          this.stopRecording();
          if (event.error === 'not-allowed') {
            this.showError('Microphone access denied. Please open extension options and allow microphone access.');
            chrome.runtime.openOptionsPage();
          } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
            // 'no-speech' and 'aborted' are routine (user paused or stopped
            // recording) and would be noisy to surface on every occurrence.
            // Everything else (network, audio-capture, service-not-allowed,
            // etc.) is an actual failure the user should know about.
            this.showToast(`Voice input stopped: ${event.error}`, 'warning');
          }
        };
        
        this.recognition.onend = () => {
          this.stopRecording();
        };

        return true;
      } catch (err) {
        console.error('Mic permission denied or unavailable:', err);
        return false;
      }
    };

    let hasSetup = false;

    this.addTrackedListener(this.elements.micBtn, 'click', async () => {
      if (!hasSetup) {
        // Attempt setup. Note: side panel usually can't trigger getUserMedia if not initiated by strong user gesture,
        // but let's try. If it fails or needs prompt, we redirect immediately.
        hasSetup = await setupMicPermission();
        if (!hasSetup) {
          // If sidepanel cannot get permission, redirect user to options page IMMEDIATELY
          const optionsUrl = chrome.runtime.getURL('options/options.html?prompt_mic=true');
          chrome.tabs.create({ url: optionsUrl });
          this.showError("Opening settings to grant microphone permission...");
          return;
        }
      }

      if (this.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });
  }
  
  startRecording() {
    try {
      this.recognition.start();
    } catch(e) {
      console.error('Failed to start voice recognition:', e);
    }
  }

  stopRecording() {
    this.isRecording = false;
    this.elements.micBtn.classList.remove('recording');
    this.elements.micBtn.classList.remove('listening');
    this.elements.micBtn.setAttribute('aria-pressed', 'false');
    this.elements.micListeningLabel?.classList.add('hidden');
    try {
      this.recognition.stop();
    } catch(e) {
      console.error('Failed to stop voice recognition:', e);
    }
  }

  toggleDropdown(menu) {
    const isHidden = menu.classList.contains('hidden')
    if (isHidden) {
      menu.classList.remove('hidden')
    } else {
      menu.classList.add('hidden')
    }
    // Keep the triggering button's aria-expanded in sync (currently only
    // wired up for the new-chat dropdown, its one caller).
    this.elements.newChatBtn?.setAttribute('aria-expanded', String(isHidden))
  }

  closeDropdowns() {
    this.elements.newChatMenu?.classList.add('hidden')
    this.elements.newChatBtn?.setAttribute('aria-expanded', 'false')
  }

  toggleShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal')
    modal?.classList.toggle('hidden')
  }

  async handleNewChatAction(action) {
    switch (action) {
      case 'new':
        await this.newChat(true)
        break
      case 'save':
        await this.saveCurrentChat()
        break
      case 'load':
        this.sidebar.open()
        break
      case 'clear':
        await this.clearAllHistory()
        break
      case 'export':
        await this.exportCurrentChat()
        break
      case 'import':
        await this.importChat()
        break
    }
  }

  async exportCurrentChat() {
    try {
      const history = await this.sendToBackground({ type: 'GET_CHAT_HISTORY' })
      if (!history || history.length === 0) {
        this.showToast('No messages to export', 'warning')
        return
      }
      const payload = {
        schema: 'ctrl/chat-history',
        version: 1,
        exportedAt: new Date().toISOString(),
        messages: history
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ctrl-chat-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      this.showToast('Chat exported')
    } catch (error) {
      console.error('Export error:', error)
      this.showError('Failed to export chat')
    }
  }

  async importChat() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const text = await file.text()
        const payload = JSON.parse(text)
        const messages = Array.isArray(payload) ? payload : payload.messages || payload.history || []
        if (!Array.isArray(messages) || messages.length === 0) {
          this.showToast('No valid messages found in file', 'warning')
          return
        }
        // Save and render
        const saveResp = await this.sendToBackground({
          type: 'SAVE_CONVERSATION',
          name: file.name.replace(/\.json$/i, ''),
          history: messages
        })
        await this.sendToBackground({
          type: 'NEW_CHAT',
          saveCurrent: false
        })
        // Replace current history with imported
        chrome.runtime.sendMessage({ type: 'IMPORT_CHAT_HISTORY', history: messages }, () => {
          // Refresh UI
          this.elements.messages.innerHTML = ''
          this.hideWelcomeScreen()
          messages.forEach(msg => {
            if (msg.role === 'user' || msg.role === 'assistant') {
              const attachments = (msg.images?.length || msg.files?.length)
                ? { images: msg.images, files: msg.files }
                : null
              this.addMessage(msg.content, msg.role, msg.timestamp, attachments, true)
            }
          })
          this.showToast(`Imported ${messages.length} messages`)
        })
      } catch (error) {
        console.error('Import error:', error)
        this.showError('Failed to import chat: ' + error.message)
      }
    })
    input.click()
  }

  // ── Conversation state tracking ─────────────────────────────
  // `this.messages` mirrors the conversation rendered in #messages.
  // It is the sidepanel's source of truth for context-dependent
  // features (e.g. saveAsAgent), kept in sync at every mutation point.

  _resetMessages() {
    this.messages = []
  }

  _trackMessage(role, content, attachments = null) {
    this.messages.push({
      role,
      content: typeof content === 'string' ? content : String(content ?? ''),
      timestamp: Date.now(),
      images: attachments?.images || undefined,
      files: attachments?.files || undefined
    })
    if (this.messages.length > 200) {
      this.messages.splice(0, this.messages.length - 200)
    }
  }

  _removeMessageByContent(content) {
    if (!content) return
    const idx = this.messages.findIndex(m => m.content === content)
    if (idx !== -1) this.messages.splice(idx, 1)
  }

  async newChat(saveCurrent) {
    try {
      await this.sendToBackground({ type: 'NEW_CHAT', saveCurrent })
      this.elements.messages.innerHTML = ''
      this._resetMessages()
      this.showWelcomeScreen()
      this.showToast('New chat started')
    } catch (error) {
      console.error('New chat error:', error)
      this.showError('Failed to start new chat')
    }
  }

  async saveCurrentChat() {
    const name = await this.promptDialog('Enter a name for this conversation:', 'Save Chat', `Chat ${new Date().toLocaleDateString()}`)
    if (!name) return

    try {
      const history = await this.sendToBackground({ type: 'GET_CHAT_HISTORY' })
      if (!history || history.length === 0) {
        this.showError('No messages to save')
        return
      }
      await this.sendToBackground({ type: 'SAVE_CONVERSATION', name, history })
      this.showToast('Conversation saved')
      // Refresh sidebar if open
      if (this.sidebar.isOpen) {
        this.sidebar.loadConversations()
      }
    } catch (error) {
      console.error('Save error:', error)
      this.showError('Failed to save conversation')
    }
  }

  // Note: conversation loading now goes through ConversationSidebar
  // (sidebar.js), which renders its own list (#conv-list) and calls the
  // `onLoad` callback wired up in the constructor. The old modal-based
  // loadConversations() flow (#conversations-modal / #conversations-list)
  // was removed along with those DOM elements; this method used to
  // reference them directly and would throw if invoked, but it had no
  // remaining call sites, so it's deleted rather than guarded.

  async loadConversation(name, conversations) {
    const conv = conversations.find(c => c.name === name)
    if (!conv) return

    this.elements.messages.innerHTML = ''
    this.hideWelcomeScreen()
    this._resetMessages()

    if (conv.history) {
      conv.history.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          const attachments = (msg.images?.length || msg.files?.length)
            ? { images: msg.images, files: msg.files }
            : null
          this.addMessage(msg.content, msg.role, msg.timestamp, attachments, true)
          this._trackMessage(msg.role, msg.content, attachments)
        }
      })
    }

    this.showToast('Conversation loaded')
  }

  async clearAllHistory() {
    const ok = await this.confirmDialog('Are you sure you want to clear all chat history? This cannot be undone.', 'Clear History')
    if (!ok) return

    try {
      await this.sendToBackground({ type: 'CLEAR_HISTORY' })
      this.elements.messages.innerHTML = ''
      this._resetMessages()
      this.showWelcomeScreen()
      this.showToast('All history cleared')
    } catch (error) {
      console.error('Clear history error:', error)
      this.showError('Failed to clear history')
    }
  }

  async applyTheme() {
    try {
      const state = await this.sendToBackground({ type: 'GET_SETTINGS' })
      const theme = state?.theme || 'system'
      this.applyThemeToElement(theme)
    } catch (error) {
      console.error('Theme error:', error)
      this.applyThemeToElement('system')
      this.showToast('Could not load your theme preference; using system default.', 'warning')
    }
  }

  async loadState() {
    try {
      const [enabledModels, settings, apiConfig] = await Promise.all([
        ModelSelectionManager.getAllModels(),
        this.sendToBackground({ type: 'GET_SETTINGS' }),
        this.sendToBackground({ type: 'GET_STATE' })
      ])
      
      const hasAPIKey = apiConfig?.hasAPIKey
      
      if (!hasAPIKey) {
        this.elements.setupBanner?.classList.remove('hidden')
      } else {
        this.elements.setupBanner?.classList.add('hidden')
      }

      if (apiConfig?.apiConfig?.model) {
        this.elements.modelSelect.value = apiConfig.apiConfig.model
      }

      if (settings?.customLogo) {
        const logoContainers = document.querySelectorAll('.logo, .welcome-icon');
        logoContainers.forEach(container => {
           const svg = container.querySelector('svg');
           if (svg) svg.style.display = 'none';
           
           let img = container.querySelector('img.custom-logo');
           if (!img) {
             img = document.createElement('img');
             img.className = 'custom-logo';
             img.style.maxWidth = '100%';
             img.style.maxHeight = '100%';
             img.style.objectFit = 'contain';
             
             if (container.classList.contains('logo')) {
               img.style.width = '20px';
               img.style.height = '20px';
               container.insertBefore(img, container.firstChild);
             } else {
               img.style.width = '32px';
               img.style.height = '32px';
               container.appendChild(img);
             }
           }
           img.src = settings.customLogo;
        });
      }

      // Read from ModelSelectionManager (single source of truth)
      this.enabledModels = enabledModels || {}
      console.debug('[Sidepanel] Loaded enabledModels from storage:', this.enabledModels)
      this.updateModelOptions()
      this.isGenerating = apiConfig?.isGenerating || false
    } catch (error) {
      console.error('Failed to load state:', error)
      this.showError('Failed to load your settings and model list. Try reopening the side panel.')
    }
  }

  updateModelOptions() {
     console.debug('updateModelOptions called')
     console.debug('this.enabledModels:', JSON.stringify(this.enabledModels))

     const allModels = Object.values(PROVIDERS).flatMap(provider =>
       provider.models.map(model => ({ ...model, vendor: provider.id }))
     );

     console.debug('allModels count:', allModels.length)

     if (this.enabledModels && Object.keys(this.enabledModels).length > 0) {
        const enabledIds = Object.values(this.enabledModels).flat();
        console.debug('enabledIds:', enabledIds, 'count:', enabledIds.length)
        if (enabledIds.length > 0) {
          const filtered = allModels.filter(m => enabledIds.includes(m.id));
          console.debug('Filtered models count:', filtered.length)
          if (filtered.length >= 1) {
            console.debug('Setting model options from enabled models')
            this.elements.modelSelect.innerHTML = filtered.map(m =>
              `<option value="${this.escapeHtml(m.id)}">${this.escapeHtml(m.name || m.id)}</option>`
            ).join('');
            return;
          }
        }
      }

      // Fallback to a default list if no models are enabled or configured
      console.debug('Using default model list')
      const defaultModels = allModels.filter(m => ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'gemini-1.5-flash', 'glm-4.7-flash'].includes(m.id));
      this.elements.modelSelect.innerHTML = defaultModels.map(m =>
        `<option value="${this.escapeHtml(m.id)}">${this.escapeHtml(m.name || m.id)}</option>`
      ).join('');
    }

  async loadChatHistory() {
    try {
      const history = await this.sendToBackground({ type: 'GET_CHAT_HISTORY' })
      
      if (history && history.length > 0) {
        this.hideWelcomeScreen()
        this._resetMessages()
        history.forEach(msg => {
          if (msg.role === 'user' || msg.role === 'assistant') {
            const attachments = (msg.images?.length || msg.files?.length)
              ? { images: msg.images, files: msg.files }
              : null
            this.addMessage(msg.content, msg.role, msg.timestamp, attachments, true)
            this._trackMessage(msg.role, msg.content, attachments)
          }
        })
      }
    } catch (error) {
      console.error('Failed to load history:', error)
      this.showError('Failed to load your previous chat history.')
    }
  }

  async fetchPageContext() {
    try {
      const context = await this.sendToBackground({ type: 'GET_CONTEXT' })
      if (context && context.text && context.text.length > 0) {
        this.pageContext = context
        // Auto-enabling this pill sends the page's content to whatever AI provider is
        // configured — a real third-party data-sharing action, not just a UI toggle. Only
        // auto-enable it once the user has actually consented (via the banner's Allow
        // button, or by having checked the pill themselves before). Otherwise the context
        // is fetched and ready, but stays off until the consent banner is resolved.
        if (this.elements.includeContextPill && consentManager.hasConsented(ConsentTypes.CONTEXT_AWARENESS)) {
          this.elements.includeContextPill.checked = true
          this.includeContext = true
        }
      }
    } catch (error) {
      // This fires routinely on pages where a content script can't run
      // (chrome://, the Web Store, PDFs, etc.), so it's expected background
      // noise rather than a true failure — log only, no toast, and just
      // leave page-context inclusion off.
      console.debug('Could not fetch page context:', error)
    }
  }

  updateUI() {
    const isGenerating = this.isGenerating || this.isStreaming
    this.elements.streamingIndicator?.classList.toggle('hidden', !isGenerating)
    this.elements.sendBtn.disabled = isGenerating
    this.elements.messageInput.disabled = isGenerating
  }

  async toggleWebAgent() {
    try {
      const result = await this.sendToBackground({ type: 'CDP_TOGGLE' })
      if (result?.success !== false) {
        this.updateWebAgentUI(result)
      } else {
        this.showToast(result?.error || 'Failed to toggle browser agent', 'error')
      }
    } catch (error) {
      console.error('Failed to toggle web agent:', error)
      this.showError('Failed to toggle browser agent. Please try again.')
    }
  }

  async checkWebAgentStatus() {
    try {
      const status = await this.sendToBackground({ type: 'CDP_STATUS' })
      this.updateWebAgentUI(status)
    } catch (error) {
      // Passive status poll on init — log only rather than surfacing a
      // toast for what's usually just "agent not attached yet".
      console.error('Failed to check web agent status:', error)
    }
  }

  updateWebAgentUI(status) {
    const statusBar = document.getElementById('web-agent-status')
    const tabTitle = document.getElementById('status-tab-title')
    const disconnectBtn = document.getElementById('disconnect-agent-btn')

    if (!statusBar) return

    if (status?.attached) {
      statusBar.classList.add('visible')
      this.elements.webAgentToggle?.classList.add('active')
      this.elements.webAgentToggle?.setAttribute('aria-pressed', 'true')

      // Show tab title if available
      if (tabTitle && status.tabId) {
        chrome.tabs.get(status.tabId).then(tab => {
          if (tab?.title) {
            tabTitle.textContent = tab.title.substring(0, 30)
          }
        }).catch(() => {})
      }

      // Wire disconnect button
      if (disconnectBtn && !disconnectBtn._bound) {
        disconnectBtn._bound = true
        disconnectBtn.addEventListener('click', async () => {
          try {
            await this.sendToBackground({ type: 'CDP_DETACH' })
            this.updateWebAgentUI({ attached: false })
          } catch (error) {
            console.error('Failed to disconnect web agent:', error)
            this.showError('Failed to disconnect browser agent. Please try again.')
          }
        })
      }
    } else {
      statusBar.classList.remove('visible')
      this.elements.webAgentToggle?.classList.remove('active')
      this.elements.webAgentToggle?.setAttribute('aria-pressed', 'false')
      this.elements.webAgentStatus?.classList.remove('visible')
    }
  }

  autoResize() {
    const el = this.elements.messageInput
    if (!el) return

    // Reset to 'auto' before measuring. scrollHeight can never report smaller
    // than the box's *current* rendered height, so without this reset the
    // textarea would grow with typing but never shrink back down again (e.g.
    // after sending a long message, or deleting text back to one line) — the
    // box would just stay stuck at its largest-ever size. Resetting first
    // forces the browser to recompute the natural content height every time.
    el.style.height = 'auto'

    const maxHeight = 200 // px — keep in sync with #message-input max-height in sidepanel.css
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = next + 'px'
    // Only show a scrollbar once content actually exceeds the cap, so short
    // messages never get a stray scrollbar from UA default textarea styling.
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }

  /**
   * Execute a slash command
   */
  async executeCommand(command, args) {
    switch (command.handler) {
      case 'newChat':
        await this.newChat(true)
        break

      case 'exportChat':
        await this.exportCurrentChat()
        break

      case 'importChat':
        await this.importChat()
        break

      case 'switchModel':
        if (args) {
          await this.changeModel(args)
          this.showToast(`Switched to ${args}`)
        } else {
          this.elements.modelSelect?.focus()
        }
        break

      case 'generateSlides':
        if (args) {
          this.codePane.open()
          this.codePane.switchTab('output')
          this.codePane.showOutput('<div class="output-loading">Generating slides...</div>')
          await this.agentHandler?.generateSlidesFromPrompt(args)
        }
        break

      case 'analyzeData':
        this.codePane.open()
        this.codePane.switchTab('output')
        if (args) {
          this.codePane.showOutput('<div class="output-loading">Upload a file first, then analyze.</div>')
        }
        break

      case 'generateMvp':
        if (args) {
          this.codePane.open()
          this.codePane.switchTab('preview')
          this.codePane.showOutput('<div class="output-loading">Building MVP...</div>')
          await this.agentHandler?.generateMvpFromPrompt(args)
        }
        break

      case 'generateResearch':
        if (args) {
          this.codePane.open()
          this.codePane.switchTab('output')
          this.codePane.showOutput('<div class="output-loading">Researching...</div>')
          await this.agentHandler?.generateResearchFromPrompt(args)
        }
        break

      case 'generateCode':
        if (args) {
          this.codePane.open()
          this.codePane.switchTab('terminal')
          this.codePane.appendToTerminal(`Generating code for: ${args}`, 'info')
          // Send as a normal chat message with code context
          this.elements.messageInput.value = `Write code to ${args}. Show the code and explain it.`
          this.autoResize()
          await this.sendMessage()
        }
        break

      case 'webSearch':
        if (args) {
          this.elements.messageInput.value = `Search the web for: ${args}`
          this.autoResize()
          await this.sendMessage()
        }
        break

      case 'toggleAgent':
        await this.toggleWebAgent()
        break

      case 'preset': {
        // /preset [name] — load a saved agent preset as an override system
        // prompt for the next message. "/preset" with no args lists them.
        if (!args) {
          const presets = (await chrome.storage.local.get('agent_presets')).agent_presets || []
          if (!presets.length) {
            this.showToast('No saved agents yet. Use "Save as Agent" on a response first.', 'warning')
          } else {
            this.showToast(`Saved agents: ${presets.map(p => p.name).join(', ')}`)
          }
          break
        }
        const presets = (await chrome.storage.local.get('agent_presets')).agent_presets || []
        const match = presets.find(p => p.name?.toLowerCase() === args.trim().toLowerCase())
        if (!match) {
          this.showToast(`No agent named "${args}". ${presets.length ? `Try: ${presets.map(p => p.name).join(', ')}` : 'No saved agents yet.'}`, 'warning')
          break
        }
        this.agentPresetOverride = match.systemPrompt
        this.showToast(`Agent "${match.name}" active for next message. Send a message to apply.`)
        break
      }

      case 'toggleSidebar':
        this.sidebar.toggle()
        break

      case 'toggleDrawer':
        if (this.codePane.isOpen) {
          this.codePane.close()
        } else {
          this.codePane.open()
        }
        break

      case 'showTour':
        this.onboarding.show()
        break

      case 'showHelp': {
        const commands = this.commandRegistry.getAll()
        let helpText = '**Available Commands:**\n\n'
        const categories = {}
        for (const cmd of commands) {
          if (!categories[cmd.category]) categories[cmd.category] = []
          categories[cmd.category].push(cmd)
        }
        for (const [cat, cmds] of Object.entries(categories)) {
          helpText += `**${cat}:**\n`
          for (const cmd of cmds) {
            helpText += `- \`${cmd.usage || '/' + cmd.name}\` — ${cmd.description}\n`
          }
          helpText += '\n'
        }
        this.addMessage(helpText, 'assistant', Date.now())
        break
      }

      case 'changeTheme':
        if (args) {
          this.applyThemeToElement(args)
          try {
            await this.sendToBackground({ type: 'SAVE_SETTINGS', settings: { theme: args } })
            this.showToast(`Theme changed to ${args}`)
          } catch (error) {
            console.error('Failed to save theme:', error)
            this.showError(`Theme applied, but couldn't be saved. It'll reset next time you open CTRL.`)
          }
        }
        break

      case 'setTemperature':
        if (args && !isNaN(parseFloat(args))) {
          const temp = Math.max(0, Math.min(2, parseFloat(args)))
          try {
            await this.sendToBackground({ type: 'SAVE_SETTINGS', settings: { temperature: temp } })
            this.showToast(`Temperature set to ${temp}`)
          } catch (error) {
            console.error('Failed to save temperature:', error)
            this.showError('Failed to save temperature setting.')
          }
        }
        break

      default:
        this.showToast(`Unknown command: /${command.name}`)
    }
  }

  async sendMessage() {
    let content = this.elements.messageInput.value.trim()
    const pendingAttachments = this.attachments.length > 0
    if ((!content && !pendingAttachments) || this.isGenerating) return

    // Check if it's a snippet trigger (e.g. /summarize) — expand before sending
    const snippetContent = this.promptSnippets?.expandTrigger(content)
    if (snippetContent) {
      content = snippetContent
    }

    // Check if it's a slash command
    if (content.startsWith('/')) {
      const parsed = this.commandRegistry.parse(content)
      if (parsed) {
        this.elements.messageInput.value = ''
        this.autoResize()
        this.commandAutocomplete?.hide()
        await this.executeCommand(parsed.command, parsed.args)
        return
      }
    }

    this.hideWelcomeScreen()

    const attachments = this.consumeAttachments()
    this.addMessage(content || '(see attachments)', 'user', Date.now(), attachments)
    this._trackMessage('user', content || '(see attachments)', attachments)

    // Remember the last user turn so "Regenerate" can resend it without
    // requiring the user to retype anything.
    this.lastUserMessage = content
    this.lastUserAttachments = attachments

    this.elements.messageInput.value = ''
    this.autoResize()

    this.isGenerating = true
    this.isStreaming = true
    this.updateUI()

    // Create the streaming message bubble immediately
    const streamingMsg = new StreamingMessage(this.elements.messages, {
      formatContent: (c) => this.formatContent(c),
      scrollToBottom: () => this.scrollToBottom()
    })
    streamingMsg.create()
    this.currentStreamingMessage = streamingMsg
    this.scrollToBottom()

    const requestPayload = {
      type: 'SEND_STREAMING_CHAT',
      content,
      mode: this.currentMode,
      includeContext: this.includeContext && !!this.pageContext,
      pageContent: this.pageContext?.text,
      images: attachments.images,
      files: attachments.files,
      // One-shot agent preset override from /preset [name]
      systemPromptOverride: this.agentPresetOverride || undefined,
      // Authoritative conversation view (includes this user turn). The
      // background uses it as the base history so regenerate/edit truncation
      // is reflected in storage, and dedupes this user turn itself.
      history: this.messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.images?.length ? { images: m.images } : {}),
        ...(m.files?.length ? { files: m.files } : {})
      }))
    }
    if (this.agentPresetOverride) this.agentPresetOverride = null

    try {
      // Try streaming first. The STREAM_CHUNK / STREAM_COMPLETE listeners
      // will update the streaming message in real-time.
      const response = await this.sendToBackground(requestPayload)

      if (response?.error) {
        // Streaming failed — check if we got any chunks (partial stream)
        if (streamingMsg.fullContent.length > 0) {
          // We got some content before the error, finalize what we have
          streamingMsg.finalize()
          this._trackMessage('assistant', streamingMsg.fullContent)
        } else {
          // No content at all — fall back to non-streaming with transcode
          streamingMsg.abort()
          this.currentStreamingMessage = null

          const fallbackPayload = {
            type: 'SEND_CHAT',
            content,
            mode: this.currentMode,
            includeContext: this.includeContext && !!this.pageContext,
            pageContent: this.pageContext?.text,
            images: attachments.images,
            files: attachments.files,
            // The sidepanel owns persistence for the chat view (the popup
            // mini-chat sends history but must NOT persist).
            persistHistory: true,
            history: this.messages.map(m => ({
              role: m.role,
              content: m.content,
              ...(m.images?.length ? { images: m.images } : {}),
              ...(m.files?.length ? { files: m.files } : {})
            }))
          }

          const fallbackResponse = await this.sendToBackground(fallbackPayload)

          if (fallbackResponse.error) {
            this.showInlineError(fallbackResponse.error, () => this.sendMessage(content, attachments))
          } else if (fallbackResponse.message) {
            // Use transcode mode for consistent streaming feel
            const transcodeMsg = new StreamingMessage(this.elements.messages, {
              formatContent: (c) => this.formatContent(c),
              scrollToBottom: () => this.scrollToBottom()
            })
            transcodeMsg.create()
            this.currentStreamingMessage = transcodeMsg

            await transcodeMsg.transcode(fallbackResponse.message)
            transcodeMsg.finalize(fallbackResponse.message)
            this.currentStreamingMessage = null
            this._trackMessage('assistant', fallbackResponse.message)

            this.updateTokenUsage(fallbackResponse, content, fallbackResponse.message)
          }
        }
      } else if (response?.streaming) {
        // Streaming completed successfully — the STREAM_COMPLETE listener
        // usually finalized the message already. Only handle + track here
        // when the listener did NOT fire (message arrived without events).
        if (this.currentStreamingMessage) {
          this.currentStreamingMessage.finalize(response.message)
          this.currentStreamingMessage = null
          this._trackMessage('assistant', response.message)
        }
        this.updateTokenUsage(response, content, response.message)
      } else {
        // Non-streaming response (shouldn't happen with SEND_STREAMING_CHAT,
        // but handle gracefully with transcode)
        if (this.currentStreamingMessage) {
          await this.currentStreamingMessage.transcode(response.message)
          this.currentStreamingMessage.finalize(response.message)
          this.currentStreamingMessage = null
        }
        this._trackMessage('assistant', response.message)
        this.updateTokenUsage(response, content, response.message)
      }
    } catch (error) {
      if (this.currentStreamingMessage) {
        this.currentStreamingMessage.abort()
        this.currentStreamingMessage = null
      }
      this.showInlineError(error.message || 'Failed to send message', () => this.sendMessage(content, attachments))
    } finally {
      this.isGenerating = false
      this.isStreaming = false
      this.currentStreamingMessage = null
      this.updateUI()
    }
  }

  /**
   * Re-runs the last user message and appends a fresh assistant response.
   * Triggered by the "Regenerate" button on an assistant message bubble.
   * @param {HTMLElement} [messageDiv] - The assistant bubble to replace
   */
  async regenerateResponse(messageDiv) {
    if (!this.lastUserMessage && !this.lastUserAttachments?.images?.length && !this.lastUserAttachments?.files?.length) {
      this.showToast('Nothing to regenerate yet', 'warning')
      return
    }
    if (this.isGenerating) return

    // Drop the replaced assistant message from the tracked conversation
    // so the regenerated turn doesn't appear twice in context. Use the
    // raw content from the copy button's data attribute (matches what was
    // tracked) rather than the rendered bubble text.
    const copyBtn = messageDiv?.querySelector('.copy-msg-btn')
    const oldRawContent = copyBtn?.dataset?.content
      ? decodeURIComponent(copyBtn.dataset.content)
      : messageDiv?.querySelector('.message-bubble')?.textContent?.trim()
    if (oldRawContent) this._removeMessageByContent(oldRawContent)

    messageDiv?.remove()

    this.isGenerating = true
    this.isStreaming = true
    this.updateUI()

    // Create streaming message bubble
    const streamingMsg = new StreamingMessage(this.elements.messages, {
      formatContent: (c) => this.formatContent(c),
      scrollToBottom: () => this.scrollToBottom()
    })
    streamingMsg.create()
    this.currentStreamingMessage = streamingMsg
    this.scrollToBottom()

    const requestPayload = {
      type: 'SEND_STREAMING_CHAT',
      content: this.lastUserMessage,
      mode: this.currentMode,
      includeContext: this.includeContext && !!this.pageContext,
      pageContent: this.pageContext?.text,
      images: this.lastUserAttachments?.images,
      files: this.lastUserAttachments?.files,
      // this.messages was already truncated above (old assistant removed),
      // so the background's history write will match the visible conversation.
      history: this.messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.images?.length ? { images: m.images } : {}),
        ...(m.files?.length ? { files: m.files } : {})
      }))
    }

    try {
      const response = await this.sendToBackground(requestPayload)

      if (response?.error) {
        if (streamingMsg.fullContent.length > 0) {
          streamingMsg.finalize()
        } else {
          streamingMsg.abort()
          this.currentStreamingMessage = null

          // Fallback to non-streaming
          const fallbackPayload = { ...requestPayload, type: 'SEND_CHAT' }
          const fallbackResponse = await this.sendToBackground(fallbackPayload)

          if (fallbackResponse.error) {
            this.showInlineError(fallbackResponse.error, () => this.regenerateResponse())
          } else if (fallbackResponse.message) {
            const transcodeMsg = new StreamingMessage(this.elements.messages, {
              formatContent: (c) => this.formatContent(c),
              scrollToBottom: () => this.scrollToBottom()
            })
            transcodeMsg.create()
            this.currentStreamingMessage = transcodeMsg
            await transcodeMsg.transcode(fallbackResponse.message)
            transcodeMsg.finalize(fallbackResponse.message)
            this.currentStreamingMessage = null
            this.updateTokenUsage(fallbackResponse, this.lastUserMessage, fallbackResponse.message)
          }
        }
      } else if (response?.streaming) {
        if (this.currentStreamingMessage) {
          this.currentStreamingMessage.finalize(response.message)
          this.currentStreamingMessage = null
        }
        this.updateTokenUsage(response, this.lastUserMessage, response.message)
      } else {
        if (this.currentStreamingMessage) {
          await this.currentStreamingMessage.transcode(response.message)
          this.currentStreamingMessage.finalize(response.message)
          this.currentStreamingMessage = null
        }
        this.updateTokenUsage(response, this.lastUserMessage, response.message)
      }
    } catch (error) {
      if (this.currentStreamingMessage) {
        this.currentStreamingMessage.abort()
        this.currentStreamingMessage = null
      }
      this.showInlineError(error.message || 'Failed to regenerate response', () => this.regenerateResponse())
    } finally {
      this.isGenerating = false
      this.isStreaming = false
      this.updateUI()
    }
  }

  /**
   * Replaces a user message bubble with an editable textarea.
   * @param {HTMLElement} messageDiv - The `.message.user` container
   * @param {string} originalText - The raw (unformatted) message text
   */
  startEditingMessage(messageDiv, originalText) {
    if (!messageDiv || this.isGenerating) return
    const bubble = messageDiv.querySelector('.message-bubble')
    if (!bubble) return

    // Stash the current bubble markup so Cancel can restore it exactly
    // (preserves formatting/attachments without re-rendering).
    messageDiv.dataset.originalBubbleHtml = bubble.innerHTML
    messageDiv.classList.add('editing')

    bubble.innerHTML = `
      <textarea class="message-edit-textarea">${this.escapeHtml(originalText)}</textarea>
      <div class="message-edit-actions">
        <button class="msg-edit-cancel">Cancel</button>
        <button class="msg-edit-save">Save &amp; Resend</button>
      </div>
    `

    const textarea = bubble.querySelector('.message-edit-textarea')
    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }
  }

  /**
   * Restores the original bubble content without saving changes.
   * @param {HTMLElement} messageDiv
   */
  cancelEditingMessage(messageDiv) {
    if (!messageDiv) return
    const bubble = messageDiv.querySelector('.message-bubble')
    if (bubble && messageDiv.dataset.originalBubbleHtml !== undefined) {
      bubble.innerHTML = messageDiv.dataset.originalBubbleHtml
    }
    messageDiv.classList.remove('editing')
    delete messageDiv.dataset.originalBubbleHtml
  }

  /**
   * Commits an edited user message: truncates every message that followed
   * it (the stale assistant reply and anything after), updates the bubble
   * in place, and resends by reusing the existing regenerate flow.
   * @param {HTMLElement} messageDiv
   * @param {string} newText
   */
  async saveEditedMessage(messageDiv, newText) {
    if (!messageDiv || this.isGenerating) return

    // Truncate conversation: drop every message that came after this one.
    let sibling = messageDiv.nextElementSibling
    while (sibling) {
      const next = sibling.nextElementSibling
      sibling.remove()
      sibling = next
    }

    // Truncate the tracked conversation to match the DOM truncation:
    // drop the edited user message and everything after it, then re-track
    // the edited message so context stays aligned with what was resent.
    const editCopyBtn = messageDiv.querySelector('.edit-msg-btn')
    const editedOriginal = editCopyBtn?.dataset?.content
      ? decodeURIComponent(editCopyBtn.dataset.content)
      : messageDiv.querySelector('.message-bubble')?.textContent?.trim()
    let truncIdx = -1
    if (editedOriginal) {
      truncIdx = this.messages.findIndex(m => m.content === editedOriginal)
    }
    if (truncIdx !== -1) {
      this.messages = this.messages.slice(0, truncIdx)
    }
    this._trackMessage('user', newText, { images: [], files: [] })

    const bubble = messageDiv.querySelector('.message-bubble')
    if (bubble) {
      bubble.innerHTML = this.formatContent(newText)
    }
    const editBtn = messageDiv.querySelector('.edit-msg-btn')
    if (editBtn) editBtn.dataset.content = encodeURIComponent(newText)

    messageDiv.classList.remove('editing')
    delete messageDiv.dataset.originalBubbleHtml

    // Reuse the same "resend last user message" state/flow that powers the
    // Regenerate button on assistant messages.
    this.lastUserMessage = newText
    this.lastUserAttachments = { images: [], files: [] }

    await this.regenerateResponse(null)
  }

  addMessage(content, role, timestamp = Date.now(), attachments = null, noAnimate = false) {
    const messageDiv = document.createElement('div')
    messageDiv.className = `message ${role}`
    if (noAnimate) messageDiv.classList.add('no-animate')

    const formattedContent = this.formatContent(content)

    // Render image/file attachments
    let attachmentsHtml = ''
    if (attachments?.images?.length) {
      attachmentsHtml += attachments.images.map(img => {
        if (!img?.dataUrl) return ''
        return `<img class="message-image" src="${this.escapeHtml(img.dataUrl)}" alt="attachment" data-full="${this.escapeHtml(img.dataUrl)}" />`
      }).join('')
    }
    if (attachments?.files?.length) {
      attachmentsHtml += attachments.files.map(file => {
        const name = this.escapeHtml(file?.name || 'file')
        const content = typeof file?.content === 'string' ? file.content : ''
        const size = content ? this.formatFileSize(new Blob([content]).size) : ''
        return `<div class="message-file-attachment">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
          <div>
            <div class="file-name">${name}</div>
            <div class="file-size">${size}</div>
          </div>
        </div>`
      }).join('')
    }

    // Add "Insert"/"Copy"/"Regenerate" buttons only for assistant messages
    let insertButtonHtml = '';
    if (role === 'assistant') {
      const plainContentEncoded = encodeURIComponent(content);
      insertButtonHtml = `
      <div class="msg-actions">
        <button class="copy-msg-btn" data-content="${plainContentEncoded}" aria-label="Copy message">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Copy
        </button>
        <button class="insert-btn" data-content="${plainContentEncoded}" aria-label="Insert message at cursor in page">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          Insert at Cursor
        </button>
        <button class="regenerate-btn" title="Regenerate response" aria-label="Regenerate response">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          Regenerate
        </button>
        <button class="save-agent-btn" title="Save as Agent" aria-label="Save this response as an agent preset">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
          Save as Agent
        </button>
      </div>`;
    }

    // Add "Edit" button only for user messages
    let editButtonHtml = '';
    if (role === 'user') {
      const plainContentEncoded = encodeURIComponent(content);
      editButtonHtml = `
      <div class="msg-actions">
        <button class="edit-msg-btn" data-content="${plainContentEncoded}" title="Edit message" aria-label="Edit message">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          Edit
        </button>
      </div>`;
    }

    messageDiv.innerHTML = `
      <div class="message-bubble">${attachmentsHtml}${formattedContent}</div>
      ${insertButtonHtml}${editButtonHtml}
    `

    this.elements.messages.appendChild(messageDiv)

    // Wire image lightbox
    messageDiv.querySelectorAll('.message-image').forEach(img => {
      img.addEventListener('click', () => this.openImageLightbox(img.dataset.full))
    })

    // Note: Event delegation is used in setupMessageDelegation() instead
    // so we don't add listeners to each message
  }

  openImageLightbox(dataUrl) {
    if (!dataUrl) return
    const lightbox = document.createElement('div')
    lightbox.className = 'image-lightbox'
    lightbox.setAttribute('role', 'dialog')
    lightbox.setAttribute('aria-modal', 'true')
    lightbox.setAttribute('aria-label', 'Image preview')
    lightbox.tabIndex = -1
    const img = document.createElement('img')
    img.src = String(dataUrl)
    img.alt = 'full-size attachment preview'
    lightbox.appendChild(img)
    const previouslyFocused = document.activeElement
    const close = () => {
      lightbox.remove()
      document.removeEventListener('keydown', onKey)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    lightbox.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    document.body.appendChild(lightbox)
    lightbox.focus()
  }

  /**
   * Sets up event delegation for message actions (copy, insert)
   * This should be called once during init instead of per message
   */
  setupMessageDelegation() {
    const handleCopyCode = async (e) => {
      const btn = e.target.closest('.copy-code-btn')
      if (btn) {
        const codeElement = btn.closest('.code-wrapper').querySelector('code')
        try {
          await navigator.clipboard.writeText(codeElement.textContent)
          const originalHtml = btn.innerHTML
          btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!'
          setTimeout(() => {
            btn.innerHTML = originalHtml
          }, 2000)
        } catch (error) {
          console.error('Failed to copy code:', error)
          this.showError('Failed to copy code to clipboard')
        }
      }
    }

    const handleInsertText = async (e) => {
      const btn = e.target.closest('.insert-btn')
      if (btn) {
        const textToInsert = decodeURIComponent(btn.dataset.content)

        try {
          // Attempt to find active tab and inject text
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'INSERT_TEXT', text: textToInsert }, (response) => {
               if(chrome.runtime.lastError || (response && response.error)) {
                 this.showError("Could not insert. Make sure you are focused on a text field.")
               } else {
                 this.showToast("Text inserted!")
               }
            })
          }
        } catch (e) {
           this.showError("Failed to insert text.")
        }
      }
    }

    const handleCopyMessage = async (e) => {
      const btn = e.target.closest('.copy-msg-btn')
      if (btn) {
        const textToCopy = decodeURIComponent(btn.dataset.content)
        try {
          await navigator.clipboard.writeText(textToCopy)
          const originalHtml = btn.innerHTML
          btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!'
          setTimeout(() => { btn.innerHTML = originalHtml }, 2000)
        } catch (err) {
          this.showError('Failed to copy to clipboard')
        }
      }
    }

    const handleRegenerate = (e) => {
      const btn = e.target.closest('.regenerate-btn')
      if (btn) {
        const messageDiv = btn.closest('.message')
        this.regenerateResponse(messageDiv)
      }
    }

    const handleEditMessage = (e) => {
      const btn = e.target.closest('.edit-msg-btn')
      if (btn) {
        const messageDiv = btn.closest('.message')
        const originalText = decodeURIComponent(btn.dataset.content)
        this.startEditingMessage(messageDiv, originalText)
      }
    }

    const handleEditSave = async (e) => {
      const btn = e.target.closest('.msg-edit-save')
      if (btn) {
        const messageDiv = btn.closest('.message')
        const textarea = messageDiv?.querySelector('.message-edit-textarea')
        const newText = textarea?.value.trim()
        if (!newText) {
          this.showToast('Message cannot be empty', 'warning')
          return
        }
        await this.saveEditedMessage(messageDiv, newText)
      }
    }

    const handleEditCancel = (e) => {
      const btn = e.target.closest('.msg-edit-cancel')
      if (btn) {
        const messageDiv = btn.closest('.message')
        this.cancelEditingMessage(messageDiv)
      }
    }

    const handleSaveAsAgent = (e) => {
      const btn = e.target.closest('.save-agent-btn')
      if (btn) {
        const messageDiv = btn.closest('.message')
        this.saveAsAgent(messageDiv)
      }
    }

    this.addTrackedListener(this.elements.messages, 'click', handleCopyCode)
    this.addTrackedListener(this.elements.messages, 'click', handleInsertText)
    this.addTrackedListener(this.elements.messages, 'click', handleCopyMessage)
    this.addTrackedListener(this.elements.messages, 'click', handleRegenerate)
    this.addTrackedListener(this.elements.messages, 'click', handleEditMessage)
    this.addTrackedListener(this.elements.messages, 'click', handleEditSave)
    this.addTrackedListener(this.elements.messages, 'click', handleEditCancel)
    this.addTrackedListener(this.elements.messages, 'click', handleSaveAsAgent)
  }

  formatContent(content) {
    if (content == null) content = ''
    if (typeof content !== 'string') {
      try { content = JSON.stringify(content) } catch { content = String(content) }
    }
    if (window.marked && window.DOMPurify) {
      const renderer = new window.marked.Renderer()
      
      // Custom Code Block Renderer
      // Marked v5+ passes a token object; older versions pass (code, language).
      renderer.code = function(codeArg, legacyLang) {
        const code = typeof codeArg === 'object' ? codeArg.text : codeArg
        const language = typeof codeArg === 'object' ? (codeArg.lang || legacyLang || '') : legacyLang
        const validLanguage = (window.hljs && window.hljs.getLanguage(language)) ? language : 'plaintext'
        const highlighted = window.hljs ? window.hljs.highlight(code, {language: validLanguage}).value : this.escapeHtml(code)
        
        return `
          <div class="code-wrapper">
            <div class="code-header">
              <span>${validLanguage}</span>
              <button class="copy-code-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy
              </button>
            </div>
            <pre><code class="language-${validLanguage} hljs">${highlighted}</code></pre>
          </div>
        `
      }.bind(this)

      window.marked.setOptions({ renderer, breaks: true })
      
      const rawHtml = window.marked.parse(content)
      return window.DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['svg', 'path', 'rect', 'line', 'polyline', 'circle', 'polygon'],
        ADD_ATTR: ['viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'points', 'cx', 'cy', 'r', 'class', 'aria-hidden', 'focusable']
      })
    }

    // Fallback if marked is missing
    return this.escapeHtml(content).replace(/\n/g, '<br>')
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight
    })
  }

  /**
   * Updates the running token-usage (and estimated dollar cost) after a
   * completed exchange. Prefers a real `usage` field from the API response
   * (e.g. OpenAI-style `{ prompt_tokens, completion_tokens, total_tokens }`)
   * and falls back to a rough length/4 heuristic per message when the
   * provider doesn't return usage stats — splitting the fallback between
   * prompt/completion (rather than one lump total_tokens) so the cost
   * estimate can weight input vs. output tokens by their different prices.
   * @param {Object} response - The SEND_CHAT response
   * @param {string} userContent - The user message that was sent
   * @param {string} assistantContent - The assistant reply that came back
   */
  updateTokenUsage(response, userContent, assistantContent) {
    let promptTokens = null
    let completionTokens = null
    const usage = response?.usage
    if (usage && typeof usage === 'object') {
      promptTokens = usage.prompt_tokens
      completionTokens = usage.completion_tokens
      if ((promptTokens == null || completionTokens == null) && usage.total_tokens) {
        // Provider only gave us a combined total — split it evenly rather
        // than dropping the breakdown entirely, so cost math still works.
        promptTokens = Math.round(usage.total_tokens / 2)
        completionTokens = usage.total_tokens - promptTokens
      }
    }
    if (promptTokens == null || completionTokens == null) {
      promptTokens = Math.round((userContent || '').length / 4)
      completionTokens = Math.round((assistantContent || '').length / 4)
    }

    const turnTokens = promptTokens + completionTokens
    this.totalTokenEstimate = (this.totalTokenEstimate || 0) + turnTokens
    this.renderTokenUsage(this.totalTokenEstimate)

    const pricing = this.getModelPricing(this.elements.modelSelect?.value)
    if (pricing) {
      const turnCost = (promptTokens / 1e6) * pricing.input + (completionTokens / 1e6) * pricing.output
      this.totalCostEstimate = (this.totalCostEstimate || 0) + turnCost
      this.renderCostUsage(this.totalCostEstimate)
    }
  }

  /**
   * Looks up the `{ input, output }` USD-per-1M-token pricing for a model
   * ID from the PROVIDERS catalog (utils/storage.js). Returns null if the
   * model can't be found or has no pricing data, so callers can skip
   * rendering a cost estimate rather than show a bogus number.
   * @param {string} modelId
   * @returns {{input:number, output:number}|null}
   */
  getModelPricing(modelId) {
    if (!modelId) return null
    for (const provider of Object.values(PROVIDERS)) {
      const model = provider.models?.find(m => m.id === modelId)
      if (model?.pricing) return model.pricing
    }
    return null
  }

  renderTokenUsage(total) {
    const badge = this.elements.tokenUsage
    if (!badge || !total) return
    badge.textContent = total >= 1000 ? `~${(total / 1000).toFixed(1)}k tokens` : `~${total} tokens`
    badge.title = `Estimated total tokens used this session: ${total}`
    badge.classList.remove('hidden')
  }

  /**
   * Renders the estimated-dollar-cost badge next to the token-usage badge.
   * Pricing is sourced from PROVIDERS[...].models[...].pricing (USD per 1M
   * tokens) — see the comment above that export in utils/storage.js for
   * where those figures come from and their accuracy caveats. This is a
   * rough running estimate, not a billing-accurate number.
   * @param {number} total - Cumulative estimated cost in USD for this session
   */
  renderCostUsage(total) {
    const badge = this.elements.costUsage
    if (!badge || !total) return
    const display = total < 0.01 ? '<$0.01' : `~$${total.toFixed(2)}`
    badge.textContent = display
    badge.title = `Estimated session cost: $${total.toFixed(4)} (based on published/estimated per-model pricing — not a billing-accurate figure)`
    badge.classList.remove('hidden')
  }

  async changeModel(model) {
    try {
      await this.sendToBackground({ type: 'SET_MODEL', model })
    } catch (error) {
      this.showError('Failed to change model')
    }
  }

  openSettings() {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage()
    } else {
      window.open('options/options.html')
    }
  }

  async stopGeneration() {
    try {
      const response = await this.sendToBackground({ type: 'STOP_GENERATION' })
      if (response?.stopped) {
        this.isGenerating = false
        this.isStreaming = false
        this.updateUI()
      }
    } catch (error) {
      console.error('Failed to stop:', error)
      this.showError('Failed to stop generation. It may continue in the background.')
    }
  }

  showError(message, type) {
    const displayMessage = typeof message === 'object' ? JSON.stringify(message) : message
    this.showNotification(displayMessage, 'error')
  }

  /**
   * Renders an inline error bubble in the chat area with a Retry button.
   * @param {string} errorText - The error message to display
   * @param {Function} [onRetry] - Callback when the user clicks Retry
   */
  showInlineError(errorText, onRetry) {
    const wrap = document.createElement('div')
    wrap.className = 'message assistant error-bubble'
    wrap.innerHTML =
      '<div class="message-bubble error-content">' +
      '  <span class="error-icon" aria-hidden="true">\u26A0</span>' +
      '  <span class="error-text"></span>' +
      '</div>' +
      (onRetry
        ? '<div class="msg-actions" style="opacity:1"><button class="retry-btn">Retry</button></div>'
        : '')

    wrap.querySelector('.error-text').textContent = errorText || 'Something went wrong'

    if (onRetry) {
      const btn = wrap.querySelector('.retry-btn')
      btn.addEventListener('click', () => {
        wrap.remove()
        onRetry()
      })
    }

    this.elements.messages.appendChild(wrap)
    wrap.classList.add('no-animate')
    this.scrollToBottom()
  }

  showToast(message, variant = 'success') {
    this.showNotification(message, variant)
  }

  /**
   * Displays a toast notification in the bottom-right corner.
   * @param {string} message - The message text
   * @param {'success'|'error'|'warning'|'info'} variant - Visual styling
   * @param {number} [duration=4000] - Auto-dismiss after ms (0 to keep)
   */
  showNotification(message, variant = 'info', duration = 4000) {
    const container = document.getElementById('toast-container')
    if (!container) {
      // Fallback to legacy #error-toast directly — DO NOT call showToast/showNotification
      // here or this method recurses infinitely when the container is missing.
      const legacy = this.elements?.errorToast
      const text = message == null ? '' : String(message)
      if (legacy) {
        legacy.textContent = text
        legacy.classList.remove('hidden')
        legacy.style.background = variant === 'error'
          ? 'var(--error-color, #ef4444)'
          : 'var(--success-color, #10b981)'
        setTimeout(() => legacy.classList.add('hidden'), 3000)
      } else {
        console.warn('No toast container or legacy toast available:', text)
      }
      return
    }
    const ICONS = {
      success: '<polyline points="20 6 9 17 4 12"></polyline>',
      error:   '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
      warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      info:    '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
    }
    const toast = document.createElement('div')
    toast.className = `toast-notification toast-${variant}`
    const safe = this.escapeHtml ? this.escapeHtml(String(message)) : String(message).replace(/[<>&]/g, c => `&#x${c.charCodeAt(0)};`)
    toast.innerHTML = `
      <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[variant] || ICONS.info}</svg>
      <div class="toast-body">${safe}</div>
      <button class="toast-close" aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>`
    container.appendChild(toast)

    const dismiss = () => {
      toast.classList.add('toast-fade-out')
      const onEnd = () => toast.remove()
      toast.addEventListener('animationend', onEnd, { once: true })
      setTimeout(onEnd, 300)
    }
    toast.querySelector('.toast-close').addEventListener('click', dismiss)
    if (duration > 0) setTimeout(dismiss, duration)
  }

  /**
   * Promise-based confirm dialog (replaces window.confirm)
   * @param {string} message - Confirm prompt
   * @param {string} [title='Confirm'] - Modal title
   * @returns {Promise<boolean>}
   */
  confirmDialog(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal')
      const titleEl = document.getElementById('confirm-title')
      const msgEl = document.getElementById('confirm-message')
      const okBtn = document.getElementById('confirm-ok')
      if (!modal || !okBtn) {
        // Last resort fallback
        resolve(window.confirm(message))
        return
      }
      titleEl.textContent = title
      msgEl.textContent = message
      modal.classList.remove('hidden')

      const onOk = () => { cleanup(); resolve(true) }
      const onCancel = (e) => {
        if (e && e.target && e.target.closest('[data-close="confirm-modal"]')) {
          cleanup(); resolve(false)
        }
      }
      const onBackdrop = (e) => {
        if (e.target === modal.querySelector('.modal-backdrop')) { cleanup(); resolve(false) }
      }
      const onKey = (e) => { if (e.key === 'Escape') { cleanup(); resolve(false) } }

      const cleanup = () => {
        modal.classList.add('hidden')
        okBtn.removeEventListener('click', onOk)
        modal.removeEventListener('click', onCancel)
        modal.removeEventListener('click', onBackdrop)
        document.removeEventListener('keydown', onKey)
      }
      okBtn.addEventListener('click', onOk)
      modal.addEventListener('click', onCancel)
      modal.addEventListener('click', onBackdrop)
      document.addEventListener('keydown', onKey)
    })
  }

  /**
   * Promise-based prompt dialog (replaces window.prompt)
   * @param {string} message - Prompt message
   * @param {string} [title='Input'] - Modal title
   * @param {string} [defaultValue=''] - Default input value
   * @returns {Promise<string|null>}
   */
  promptDialog(message, title = 'Input', defaultValue = '') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal')
      const titleEl = document.getElementById('confirm-title')
      const msgEl = document.getElementById('confirm-message')
      const okBtn = document.getElementById('confirm-ok')
      if (!modal || !okBtn) {
        resolve(window.prompt(message, defaultValue))
        return
      }

      titleEl.textContent = title
      // Replace message with input field (message is escaped — it may be
      // caller-supplied text, never trust it as HTML)
      msgEl.innerHTML = `
        <p style="margin-bottom: 8px;">${this.escapeHtml(message)}</p>
        <input type="text" id="prompt-input" value="${this.escapeHtml(defaultValue)}" style="
          width: 100%; padding: 8px 12px; border: 1px solid var(--border-default, #e5e7eb);
          border-radius: 6px; font-size: 14px; font-family: inherit;
          background: var(--bg-secondary, #f9fafb); color: var(--text-primary, #111827);
          outline: none;
        ">
      `
      modal.classList.remove('hidden')

      const promptInput = document.getElementById('prompt-input')
      if (promptInput) {
        setTimeout(() => {
          promptInput.focus()
          promptInput.select()
        }, 50)
        promptInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            cleanup()
            resolve(promptInput.value.trim())
          }
        })
      }

      const onOk = () => { cleanup(); resolve(promptInput?.value?.trim() || null) }
      const onCancel = (e) => {
        if (e && e.target && e.target.closest('[data-close="confirm-modal"]')) {
          cleanup(); resolve(null)
        }
      }
      const onBackdrop = (e) => {
        if (e.target === modal.querySelector('.modal-backdrop')) { cleanup(); resolve(null) }
      }
      const onKey = (e) => { if (e.key === 'Escape') { cleanup(); resolve(null) } }

      const cleanup = () => {
        modal.classList.add('hidden')
        okBtn.removeEventListener('click', onOk)
        modal.removeEventListener('click', onCancel)
        modal.removeEventListener('click', onBackdrop)
        document.removeEventListener('keydown', onKey)
      }
      okBtn.addEventListener('click', onOk)
      modal.addEventListener('click', onCancel)
      modal.addEventListener('click', onBackdrop)
      document.addEventListener('keydown', onKey)
    })
  }

  async saveAsAgent(messageDiv) {
    const bubble = messageDiv?.querySelector('.message-bubble')
    if (!bubble) {
      this.showToast('Could not find message content', 'error')
      return
    }

    const messageText = bubble.textContent.trim()
    if (!messageText) {
      this.showToast('Message is empty', 'warning')
      return
    }

    // Gather full conversation context
    const conversation = this.messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    }))

    // Open the review modal with loading state
    const modal = document.getElementById('agent-review-modal')
    const loading = document.getElementById('agent-review-loading')
    const content = document.getElementById('agent-review-content')
    if (!modal) { this.showToast('Modal not available', 'error'); return }

    loading.classList.remove('hidden')
    content.classList.add('hidden')
    document.getElementById('agent-review-suggestions')?.classList.add('hidden')
    modal.classList.remove('hidden')

    const closeModal = () => {
      modal.classList.add('hidden')
      loading.classList.add('hidden')
      content.classList.add('hidden')
    }

    // Wire close handlers
    const onCloseClick = (e) => {
      if (e.target.closest('[data-close="agent-review-modal"]') ||
          e.target.classList.contains('modal-backdrop')) {
        closeModal()
      }
    }
    const onKey = (e) => { if (e.key === 'Escape') { closeModal() } }
    modal.addEventListener('click', onCloseClick)
    document.addEventListener('keydown', onKey)

    // Build the meta-prompt for the AI to analyze and create an agent preset
    const metaPrompt = `You are an AI system prompt engineer. Your task is to analyze a chat conversation and create a reusable "agent preset" system prompt that captures the behavior, style, and methodology demonstrated in the selected response.

FIRST, review the selected response below in detail. Identify the approach, reasoning style, output format, tools/techniques used, and any artifacts (code, data, reports, etc.).

SECOND, review the full conversation context to understand the user's goals and the assistant's workflow.

THIRD, generate:
1. A concise "Agent Name" (max 40 chars) that captures the purpose.
2. A "System Prompt" that, when used as the system message, would produce similar quality responses. It should describe the agent's role, expertise, approach, and output format. Be specific and actionable.
3. If applicable, a list of "Suggested Adjustments" the user could make to improve the workflow or the prompt.

Output your response in this EXACT format (do not deviate):

---NAME---
[agent name here]
---PROMPT---
[system prompt here]
---SUGGESTIONS---
[suggestions here, or "None" if not applicable]

=== SELECTED RESPONSE TO ANALYZE ===
${messageText}

=== FULL CONVERSATION CONTEXT ===
${conversation.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n')}`

    try {
      const chatMessages = [
        { role: 'user', content: metaPrompt }
      ]

      // Route through the background so spend tracking / audit logging /
      // rate limiting apply to this call too.
      const result = await this.sendToBackground({
        type: 'RUN_CHAT',
        messages: chatMessages,
        options: { temperature: 0.3 }
      })

      if (result?.error || !result?.response?.choices?.[0]?.message?.content) {
        throw new Error(result?.error || 'No response from AI')
      }

      const raw = result.response.choices[0].message.content

      // Parse the response
      const nameMatch = raw.match(/---NAME---\s*([\s\S]*?)(?=---PROMPT---|$)/)
      const promptMatch = raw.match(/---PROMPT---\s*([\s\S]*?)(?=---SUGGESTIONS---|$)/)
      const suggestionsMatch = raw.match(/---SUGGESTIONS---\s*([\s\S]*?)$/)

      const agentName = nameMatch ? nameMatch[1].trim() : 'Custom Agent'
      const systemPrompt = promptMatch ? promptMatch[1].trim() : raw
      const suggestions = suggestionsMatch ? suggestionsMatch[1].trim() : ''

      // Fill the modal
      document.getElementById('agent-review-name').value = agentName
      document.getElementById('agent-review-prompt').value = systemPrompt

      const suggestionsDiv = document.getElementById('agent-review-suggestions')
      const suggestionsContent = document.getElementById('agent-review-suggestions-content')
      if (suggestions && suggestions !== 'None' && suggestions !== 'none') {
        suggestionsDiv.classList.remove('hidden')
        suggestionsContent.textContent = suggestions
      } else {
        suggestionsDiv.classList.add('hidden')
      }

      // Show content, hide loading
      loading.classList.add('hidden')
      content.classList.remove('hidden')

      // Handle save
      const saveBtn = document.getElementById('agent-review-save')
      const saveHandler = async () => {
        const finalName = document.getElementById('agent-review-name').value.trim() || 'Custom Agent'
        const finalPrompt = document.getElementById('agent-review-prompt').value.trim()
        if (!finalPrompt) {
          this.showToast('System prompt cannot be empty', 'warning')
          return
        }

        const presets = (await chrome.storage.local.get('agent_presets')).agent_presets || []
        presets.push({
          id: `agent_${Date.now()}`,
          name: finalName,
          systemPrompt: finalPrompt,
          createdAt: Date.now(),
          sourceMessage: messageText.slice(0, 200)
        })
        await chrome.storage.local.set({ agent_presets: presets })

        this.showToast(`Agent "${finalName}" saved!`)
        closeModal()
        saveBtn.removeEventListener('click', saveHandler)
        modal.removeEventListener('click', onCloseClick)
        document.removeEventListener('keydown', onKey)
      }

      saveBtn.addEventListener('click', saveHandler)

    } catch (error) {
      console.error('Failed to generate agent preset:', error)
      loading.classList.add('hidden')
      closeModal()
      this.showToast('Failed to generate agent preset: ' + (error.message || 'Unknown error'), 'error')
      modal.removeEventListener('click', onCloseClick)
      document.removeEventListener('keydown', onKey)
    }
  }

  sendToBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(response)
        }
      })
    })
  }

  /**
   * LLM chat routed through the background service worker (RUN_CHAT) so spend
   * tracking, audit logging and rate limiting apply to every call. Returns
   * the OpenAI-shaped response ({ choices: [...] }) like apiClient.chat did,
   * throwing on error.
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} [options] - api-client chat options
   * @returns {Promise<Object>} response with .choices
   */
  async chatViaBackground(messages, options = {}) {
    const result = await this.sendToBackground({ type: 'RUN_CHAT', messages, options })
    if (result?.error) {
      throw new Error(result.error)
    }
    return result.response
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ChatUI()
})

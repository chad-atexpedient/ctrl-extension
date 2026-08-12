import { PROVIDERS, DEFAULT_ENABLED_MODELS, STORAGE_KEYS, RECOMMENDED_MODELS } from '../utils/storage.js';
import { ModelSelectionManager } from '../utils/model-selection-manager.js';
import { escapeHtml } from '../utils/html-sanitizer.js';
import { validateModel, validateModels, getModelValidationRules, validateSelectionCount } from '../utils/model-validator.js';
import { consentManager, ConsentTypes, ConsentStatus } from '../utils/consent-manager.js';
import { SnippetStore } from '../utils/snippet-store.js';
import { requestProviderOriginPermission as requestOptionalProviderOrigin } from '../utils/host-permissions.js';

// STORAGE_KEYS and RECOMMENDED_MODELS now come from utils/storage.js — this used to keep its
// own local copies, which is exactly the pattern (a second, independently-editable copy of
// the same data) that caused the MiniMax domain bug and a set of recommended-model IDs that
// didn't actually exist in the real catalog. Single source of truth now.

class OptionsPage {
  constructor() {
    this.currentModalProviderId = null
    this.customLogoData = null
    this.snippetStore = new SnippetStore()
    this.storage = {
      get: (keys) => new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(result)
          }
        })
      }),
      set: (items) => new Promise((resolve, reject) => {
        chrome.storage.local.set(items, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      }),
      getAllProviderCredentials: async () => {
        try {
          const credentials = await this.storage.get(STORAGE_KEYS.PROVIDER_CREDENTIALS)
          return credentials || {}
        } catch (error) {
          console.error('Error getting provider credentials:', error)
          return {}
        }
      },
      setProviderCredentials: async (providerId, apiKey, baseURL) => {
        try {
          console.debug('setProviderCredentials called with:', { providerId, apiKey: apiKey ? '***' : '', baseURL })
          const credentials = await this.storage.get(STORAGE_KEYS.PROVIDER_CREDENTIALS)
          console.debug('setProviderCredentials - existing credentials:', credentials)
          const existing = credentials || {}
          existing[providerId] = { apiKey, baseURL }
          console.debug('setProviderCredentials - new credentials:', existing)
          await this.storage.set({ [STORAGE_KEYS.PROVIDER_CREDENTIALS]: existing })
          console.debug('setProviderCredentials - save complete')
        } catch (error) {
          console.error('Error saving provider credentials:', error)
          throw error
        }
      },
      deleteProviderCredentials: async (providerId) => {
        try {
          const credentials = await this.storage.get(STORAGE_KEYS.PROVIDER_CREDENTIALS)
          const existing = credentials || {}
          delete existing[providerId]
          await this.storage.set({ [STORAGE_KEYS.PROVIDER_CREDENTIALS]: existing })
        } catch (error) {
          console.error('Error deleting provider credentials:', error)
          throw error
        }
      }
    }
    this.elements = this.cacheElements()
    this.init()
  }

  cacheElements() {
    return {
      providerSelect: document.getElementById('provider-select'),
      addProviderBtn: document.getElementById('add-provider-btn'),
      providerConfigPanel: document.getElementById('provider-config-panel'),
      selectedProviderName: document.getElementById('selected-provider-name'),
      providerStatusDisplay: document.getElementById('provider-status-display'),
      providerApiKey: document.getElementById('provider-api-key'),
      toggleApiKeyVisibility: document.getElementById('toggle-api-key-visibility'),
      providerBaseUrl: document.getElementById('provider-base-url'),
      testConnectionBtn: document.getElementById('test-connection-btn'),
      saveProviderBtn: document.getElementById('save-provider-btn'),
      manageModelsBtn: document.getElementById('manage-models-btn'),
      savedProvidersSection: document.getElementById('saved-providers-section'),
      savedProvidersList: document.getElementById('saved-providers-list'),
      temperature: document.getElementById('temperature'),
      temperatureValue: document.getElementById('temperature-value'),
      maxTokens: document.getElementById('max-tokens'),
      systemPrompt: document.getElementById('system-prompt'),
      streaming: document.getElementById('streaming'),
      presetSelect: document.getElementById('preset-select'),
      presetLoad: document.getElementById('preset-load'),
      presetNameEdit: document.getElementById('preset-name-edit'),
      presetPromptEdit: document.getElementById('preset-prompt-edit'),
      presetSaveChanges: document.getElementById('preset-save-changes'),
      presetDelete: document.getElementById('preset-delete'),
      presetEmpty: document.getElementById('preset-empty'),
      includePageContent: document.getElementById('include-page-content'),
      contextLength: document.getElementById('context-length'),
      memoryEnabled: document.getElementById('memory-enabled'),
      theme: document.getElementById('theme'),
      densityCompact: document.getElementById('density-compact'),
      densityComfortable: document.getElementById('density-comfortable'),
      autoScroll: document.getElementById('auto-scroll'),
      showTimestamps: document.getElementById('show-timestamps'),
      consentSettingsList: document.getElementById('consent-settings-list'),
      reviewPrivacyPolicyBtn: document.getElementById('review-privacy-policy-btn'),
      clearHistory: document.getElementById('clear-history'),
      exportSettings: document.getElementById('export-settings'),
      importSettings: document.getElementById('import-settings'),
      importFile: document.getElementById('import-file'),
      saveSettings: document.getElementById('save-settings'),
      customLogo: document.getElementById('custom-logo'),
      logoPreviewContainer: document.getElementById('logo-preview-container'),
      logoPreview: document.getElementById('logo-preview'),
      removeLogo: document.getElementById('remove-logo'),
      micPermissionSection: document.getElementById('mic-permission-section'),
      grantMicBtn: document.getElementById('grant-mic-btn'),
      micStatus: document.getElementById('mic-status'),
      mcpType: document.getElementById('mcp-type'),
      mcpName: document.getElementById('mcp-name'),
      mcpUrl: document.getElementById('mcp-url'),
      mcpApiKey: document.getElementById('mcp-api-key'),
      mcpCommand: document.getElementById('mcp-command'),
      mcpArgs: document.getElementById('mcp-args'),
      mcpWebhookUrl: document.getElementById('mcp-webhook-url'),
      addMcpBtn: document.getElementById('add-mcp-btn'),
      testMcpBtn: document.getElementById('test-mcp-btn'),
      mcpStatus: document.getElementById('mcp-status'),
      mcpConnectionsList: document.getElementById('mcp-connections-list'),
      modelSelectorModal: document.getElementById('model-selector-modal'),
      modelSelectorList: document.getElementById('model-selector-list'),
      modelSelectionCount: document.getElementById('model-selection-count'),
      clearModelsBtn: document.getElementById('clear-models-btn'),
      pullModelsBtn: document.getElementById('pull-models-btn'),
      saveModelsBtn: document.getElementById('save-models-btn'),
      relayPort: document.getElementById('relay-port'),
      relayToken: document.getElementById('relay-token'),
      relayConnectBtn: document.getElementById('relay-connect-btn'),
      relayDisconnectBtn: document.getElementById('relay-disconnect-btn'),
      relayTestBtn: document.getElementById('relay-test-btn'),
      relayStatus: document.getElementById('relay-status'),
      panelWidth: document.getElementById('panel-width'),
      spendSession: document.getElementById('spend-session'),
      spendWeek: document.getElementById('spend-week'),
      spendMonth: document.getElementById('spend-month'),
      spendProviderList: document.getElementById('spend-provider-list'),
      spendChart: document.getElementById('spend-chart'),
      exportSpendBtn: document.getElementById('export-spend-btn'),
      clearSpendBtn: document.getElementById('clear-spend-btn')
    }
  }

  init() {
    try {
      console.debug('OptionsPage.init() - Starting initialization')
      this.setupProviderSelection()
      this.loadSavedProviders()
      this.bindEvents()
      console.debug('OptionsPage.init() - Setup completed')
      this.loadSettings().then(() => {
        console.debug('OptionsPage.init() - loadSettings completed')
      })
      this.loadConsentSettings().then(() => {
        console.debug('OptionsPage.init() - loadConsentSettings completed')
      })
      this.loadSpendDashboard().then(() => {
        console.debug('OptionsPage.init() - loadSpendDashboard completed')
      })
      this.loadSnippets().then(() => {
        console.debug('OptionsPage.init() - loadSnippets completed')
      })
      this.loadPresets().then(() => {
        console.debug('OptionsPage.init() - loadPresets completed')
      })
    } catch (error) {
      console.error('OptionsPage.init() - Error:', error)
      this.showErrorNotification('Failed to initialize settings. Please refresh the page.')
    }
  }

  setupProviderSelection() {
    if (this.elements.providerSelect) {
      this.elements.providerSelect.addEventListener('change', async (e) => {
        await this.handleProviderSelection(e.target.value)
      })
    }
    if (this.elements.addProviderBtn) {
      this.elements.addProviderBtn.addEventListener('click', () => this.showAddProviderDialog())
    }
  }

  async handleProviderSelection(providerId) {
    if (!providerId) {
      this.hideProviderConfigPanel()
      this.hideSavedProviders()
      return
    }

    const provider = PROVIDERS[providerId]
    if (!provider) return

    this.showProviderConfigPanel()
    this.prepopulateProviderFields(providerId)
    await this.updateProviderDisplay(provider)
  }

  showProviderConfigPanel() {
    if (this.elements.providerConfigPanel) {
      this.elements.providerConfigPanel.classList.remove('hidden')
    }
    if (this.elements.savedProvidersSection) {
      this.elements.savedProvidersSection.classList.add('hidden')
    }
  }

  hideProviderConfigPanel() {
    if (this.elements.providerConfigPanel) {
      this.elements.providerConfigPanel.classList.add('hidden')
    }
  }

  showSavedProviders() {
    if (this.elements.savedProvidersSection) {
      this.elements.savedProvidersSection.classList.remove('hidden')
    }
    if (this.elements.providerConfigPanel) {
      this.elements.providerConfigPanel.classList.add('hidden')
    }
  }

  hideSavedProviders() {
    if (this.elements.savedProvidersSection) {
      this.elements.savedProvidersSection.classList.add('hidden')
    }
  }

  prepopulateProviderFields(providerId) {
    const provider = PROVIDERS[providerId]
    if (!provider) return

    if (this.elements.providerBaseUrl) {
      if (provider.baseURL && provider.baseURL !== '') {
        this.elements.providerBaseUrl.value = provider.baseURL
      } else {
        this.elements.providerBaseUrl.value = ''
      }
    }

    if (this.elements.providerApiKey) {
      this.elements.providerApiKey.value = ''
      this.elements.providerApiKey.placeholder = `Enter your ${provider.name} API key...`
    }
  }

  async updateProviderDisplay(provider) {
    if (this.elements.selectedProviderName) {
      this.elements.selectedProviderName.textContent = `Configure ${provider.name}`
    }
    
    // Check if credentials exist for this provider
    const credentials = await this.getProviderCredentials(provider.id)
    const hasCredentials = credentials && credentials.apiKey && credentials.apiKey !== ''
    
    if (this.elements.providerStatusDisplay) {
      if (hasCredentials) {
        this.elements.providerStatusDisplay.textContent = '✓ Configured'
        this.elements.providerStatusDisplay.className = 'status-message success'
      } else {
        this.elements.providerStatusDisplay.textContent = 'Not configured'
        this.elements.providerStatusDisplay.className = 'status-message warning'
      }
    }
  }

  loadSavedProviders() {
    this.storage.getAllProviderCredentials().then(credentials => {
      console.debug('loadSavedProviders - Loaded credentials:', credentials)
      this.renderSavedProviders(credentials)
    })
  }

  renderSavedProviders(credentials) {
    if (!this.elements.savedProvidersList) return

    const providers = Object.entries(credentials)
      .filter(([_, config]) => config.apiKey && config.apiKey !== '')
      .map(([providerId, config]) => {
        const provider = PROVIDERS[providerId]
        if (!provider) return null
        return {
          id: providerId,
          name: provider.name,
          apiKey: config.apiKey,
          baseURL: config.baseURL || provider.baseURL
        }
      })
      .filter(Boolean)

    if (providers.length === 0) {
      this.elements.savedProvidersList.innerHTML = '<p class="no-saved-providers">No saved providers yet</p>'
      return
    }

    let html = providers.map(provider => `
      <div class="saved-provider-item" data-provider-id="${provider.id}">
        <div class="saved-provider-info">
          <h4>${escapeHtml(provider.name)}</h4>
          <p class="saved-provider-url">${OptionsPage.escapeHtml(provider.baseURL || 'Default')}</p>
        </div>
        <div class="saved-provider-actions">
          <button class="btn btn-sm btn-primary" data-action="edit" data-provider-id="${provider.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>
            Edit
          </button>
          <button class="btn btn-sm btn-outline" data-action="delete" data-provider-id="${provider.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Remove
          </button>
        </div>
      </div>
    `).join('')

    this.elements.savedProvidersList.innerHTML = html

    this.elements.savedProvidersList.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]').dataset.action
        const providerId = e.target.closest('[data-provider-id]').dataset.providerId
        
        if (action === 'edit') {
          this.editSavedProvider(providerId)
        } else if (action === 'delete') {
          this.deleteSavedProvider(providerId)
        }
      })
    })
  }

  async editSavedProvider(providerId) {
    const provider = PROVIDERS[providerId]
    if (!provider) return

    this.elements.providerSelect.value = providerId
    await this.handleProviderSelection(providerId)
  }

  async deleteSavedProvider(providerId) {
    const ok = await this.confirmDialog(`Are you sure you want to delete the ${PROVIDERS[providerId]?.name || 'provider'} configuration?`, 'Delete Provider')
    if (!ok) {
      return
    }

    this.storage.deleteProviderCredentials(providerId).then(() => {
      this.loadSavedProviders()
    })
  }

  showAddProviderDialog() {
    const opener = document.activeElement
    const modal = document.createElement('div')
    modal.className = 'add-provider-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-labelledby', 'add-provider-modal-title')
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="add-provider-modal-title">Add Custom Provider</h3>
          <button class="modal-close" data-close type="button" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="field-group">
            <label for="custom-provider-name">Provider Name:</label>
            <input type="text" id="custom-provider-name" placeholder="e.g., LocalAI, Custom API">
          </div>
          <div class="field-group">
            <label for="custom-provider-url">Base URL:</label>
            <input type="url" id="custom-provider-url" placeholder="https://api.example.com/v1">
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-close type="button">Cancel</button>
          <button class="btn btn-primary" id="save-custom-provider" type="button">Save Provider</button>
        </div>
      </div>
    </div>
    `

    document.body.appendChild(modal)
    modal.style.display = 'block'

    const closeModal = () => {
      modal.remove()
      if (opener && typeof opener.focus === 'function') {
        opener.focus()
      }
    }

    modal.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', closeModal)
    })

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeModal()
      } else if (e.key === 'Tab') {
        this.trapModalFocus(e, modal)
      }
    })

    const nameInput = document.getElementById('custom-provider-name')
    if (nameInput) nameInput.focus()

    document.getElementById('save-custom-provider').addEventListener('click', async () => {
      const name = document.getElementById('custom-provider-name').value
      const url = document.getElementById('custom-provider-url').value

      if (!name || !url) {
        this.showErrorNotification('Please enter both provider name and URL', 'warning')
        return
      }

      const customProvider = {
        id: 'custom-' + Date.now(),
        name: name,
        baseURL: url,
        models: [],
        supportsVision: false,
        supportsImageGen: false
      }

      PROVIDERS[customProvider.id] = customProvider

      try {
        this.elements.providerSelect.value = customProvider.id
        await this.handleProviderSelection(customProvider.id)
        closeModal()
      } catch (error) {
        console.error('Error adding custom provider:', error)
        this.showErrorNotification(`Error adding provider: ${error.message}`, 'error')
      }
    })
  }

  bindEvents() {
    try {
      console.debug('bindEvents - Starting to bind events')

      // Agent presets: select → edit fields; load → copy to system prompt
      if (this.elements.presetSelect) {
        this.elements.presetSelect.addEventListener('change', () => this.onPresetSelected())
      }
      if (this.elements.presetLoad) {
        this.elements.presetLoad.addEventListener('click', () => this.loadPresetAsSystemPrompt())
      }
      if (this.elements.presetSaveChanges) {
        this.elements.presetSaveChanges.addEventListener('click', () => this.savePresetChanges())
      }
      if (this.elements.presetDelete) {
        this.elements.presetDelete.addEventListener('click', () => this.deleteSelectedPreset())
      }
      
      if (this.elements.testConnectionBtn) {
        this.elements.testConnectionBtn.addEventListener('click', () => this.testProviderConnection())
      }
      if (this.elements.saveProviderBtn) {
        this.elements.saveProviderBtn.addEventListener('click', () => this.saveProviderConfiguration())
      }
      if (this.elements.manageModelsBtn) {
        this.elements.manageModelsBtn.addEventListener('click', () => this.openModelSelectorForCurrentProvider())
      }
      
      if (this.elements.toggleApiKeyVisibility) {
        this.elements.toggleApiKeyVisibility.addEventListener('click', () => this.toggleAPIKeyVisibility())
      }
      
      if (this.elements.clearHistory) {
        this.elements.clearHistory.addEventListener('click', () => this.clearHistory())
      }
      if (this.elements.exportSettings) {
        this.elements.exportSettings.addEventListener('click', () => this.exportSettings())
      }
      if (this.elements.importSettings) {
        this.elements.importSettings.addEventListener('click', () => this.elements.importFile.click())
      }
      if (this.elements.importFile) {
        this.elements.importFile.addEventListener('change', (e) => this.importSettings(e))
      }
      if (this.elements.saveSettings) {
        this.elements.saveSettings.addEventListener('click', () => this.saveSettings())
      }

      if (this.elements.saveModelsBtn) {
        this.elements.saveModelsBtn.addEventListener('click', () => this.saveSelectedModelsFromModal())
      }
      if (this.elements.clearModelsBtn) {
        this.elements.clearModelsBtn.addEventListener('click', () => this.clearModalSelections())
      }
      if (this.elements.pullModelsBtn) {
        this.elements.pullModelsBtn.addEventListener('click', () => this.pullModelsFromAPI())
      }

      if (this.elements.modelSelectorModal) {
        const modalBackdrop = this.elements.modelSelectorModal.querySelector('.modal-backdrop')
        if (modalBackdrop) {
          modalBackdrop.addEventListener('click', () => {
            this.closeModelSelectorModal()
          })
        }

        this.elements.modelSelectorModal.querySelectorAll('[data-close]').forEach(btn => {
          btn.addEventListener('click', () => {
            this.closeModelSelectorModal()
          })
        })

        // Keyboard support: Escape closes the modal, and focus is trapped within it while
        // open so keyboard/screen-reader users tabbing through checkboxes can't tab out
        // into the page behind the backdrop.
        this.elements.modelSelectorModal.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            this.closeModelSelectorModal()
            return
          }
          if (e.key === 'Tab') {
            this.trapModalFocus(e, this.elements.modelSelectorModal)
          }
        })
      }

      if (this.elements.mcpType) {
        this.elements.mcpType.addEventListener('change', () => this.updateMcpFields())
      }
      if (this.elements.addMcpBtn) {
        this.elements.addMcpBtn.addEventListener('click', () => this.addMcpConnection())
      }
      if (this.elements.testMcpBtn) {
        this.elements.testMcpBtn.addEventListener('click', () => this.testMcpConnection())
      }
      if (this.elements.mcpConnectionsList) {
        this.elements.mcpConnectionsList.addEventListener('click', (e) => {
          const btn = e.target.closest('.mcp-action-btn')
          if (!btn) return
          const action = btn.dataset.action
          const id = btn.dataset.id
          if (action === 'test') this.testMcpById(id)
          else if (action === 'delete') this.deleteMcp(id)
        })
      }

      if (this.elements.theme) {
        this.elements.theme.addEventListener('change', (e) => {
          if (e.target.value === 'system') {
            document.documentElement.removeAttribute('data-theme')
          } else {
            document.documentElement.setAttribute('data-theme', e.target.value)
          }
        })
      }

      if (this.elements.customLogo) {
        this.elements.customLogo.addEventListener('change', (e) => this.handleLogoUpload(e))
      }
      if (this.elements.removeLogo) {
        this.elements.removeLogo.addEventListener('click', () => this.removeCustomLogo())
      }

      if (this.elements.reviewPrivacyPolicyBtn) {
        this.elements.reviewPrivacyPolicyBtn.addEventListener('click', () => this.openPrivacyPolicy())
      }

      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('prompt_mic') === 'true') {
        if (this.elements.micPermissionSection) {
          this.elements.micPermissionSection.style.display = 'block'
          setTimeout(() => {
            this.elements.micPermissionSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 500)
        }
      }

      if (this.elements.grantMicBtn) {
        this.elements.grantMicBtn.addEventListener('click', async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.getTracks().forEach(track => track.stop())

            if (this.elements.micStatus) {
              this.elements.micStatus.textContent = 'Permission granted! You can now use the microphone in the sidepanel.'
              this.elements.micStatus.style.color = 'var(--success-color)'
            }
            this.elements.grantMicBtn.style.display = 'none'

            setTimeout(() => {
              if (urlParams.get('prompt_mic') === 'true') {
                window.close()
              }
            }, 3000)
          } catch (err) {
            console.error('Error requesting mic permission:', err)
            if (this.elements.micStatus) {
              this.elements.micStatus.textContent = 'Permission denied. Please click the icon in your address bar to allow microphone access, then try again.'
              this.elements.micStatus.style.color = 'var(--error-color)'
            }
          }
        })
      }

      if (this.elements.relayConnectBtn) {
        this.elements.relayConnectBtn.addEventListener('click', async () => {
          const port = parseInt(this.elements.relayPort?.value || '18792', 10)
          const token = this.elements.relayToken?.value || ''
          try {
            const result = await chrome.runtime.sendMessage({ type: 'CDP_CONNECT_RELAY', port, token })
            if (result?.success) {
              this.elements.relayStatus.textContent = 'Relay connected successfully.'
              this.elements.relayStatus.style.color = 'var(--success-color, #10b981)'
            } else {
              this.elements.relayStatus.textContent = result?.error || 'Connection failed.'
              this.elements.relayStatus.style.color = 'var(--error-color, #ef4444)'
            }
          } catch (error) {
            console.error('Relay connect - Error:', error)
            if (this.elements.relayStatus) {
              this.elements.relayStatus.textContent = `Connection failed: ${error.message}`
              this.elements.relayStatus.style.color = 'var(--error-color, #ef4444)'
            }
          }
        })
      }

      if (this.elements.relayDisconnectBtn) {
        this.elements.relayDisconnectBtn.addEventListener('click', async () => {
          try {
            await chrome.runtime.sendMessage({ type: 'CDP_DISCONNECT_RELAY' })
            this.elements.relayStatus.textContent = 'Relay disconnected.'
            this.elements.relayStatus.style.color = ''
          } catch (error) {
            console.error('Relay disconnect - Error:', error)
            if (this.elements.relayStatus) {
              this.elements.relayStatus.textContent = `Disconnect failed: ${error.message}`
              this.elements.relayStatus.style.color = 'var(--error-color, #ef4444)'
            }
          }
        })
      }

      if (this.elements.relayTestBtn) {
        this.elements.relayTestBtn.addEventListener('click', async () => {
          const port = parseInt(this.elements.relayPort?.value || '18792', 10)
          try {
            const response = await fetch(`http://127.0.0.1:${port}/`, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
            if (response.ok) {
              this.elements.relayStatus.textContent = 'Relay server is reachable.'
              this.elements.relayStatus.style.color = 'var(--success-color, #10b981)'
            } else {
              this.elements.relayStatus.textContent = `Server responded with ${response.status}.`
              this.elements.relayStatus.style.color = 'var(--error-color, #ef4444)'
            }
          } catch {
            this.elements.relayStatus.textContent = 'Relay server not reachable. Is the desktop companion running?'
            this.elements.relayStatus.style.color = 'var(--error-color, #ef4444)'
          }
        })
      }

      // Spending Dashboard
      if (this.elements.exportSpendBtn) {
        this.elements.exportSpendBtn.addEventListener('click', () => this.exportSpendData())
      }
      if (this.elements.clearSpendBtn) {
        this.elements.clearSpendBtn.addEventListener('click', async () => {
          const ok = confirm('Clear all spending history? This cannot be undone.')
          if (ok) {
            await chrome.storage.local.set({ spend_history: [] })
            this.loadSpendDashboard()
          }
        })
      }
    } catch (error) {
      console.error('bindEvents - Error:', error)
    }
  }

  async testProviderConnection() {
    const btn = this.elements.testConnectionBtn
    const originalText = btn ? btn.innerHTML : 'Test Connection'
    
    // Show loading state
    if (btn) {
      btn.disabled = true
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="animation: spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="15 60"></circle>
        </svg>
        Testing...
      `
    }
    
    const providerId = this.elements.providerSelect?.value
    if (!providerId) {
      this.showErrorNotification('Please select a provider first', 'warning')
      // Restore button
      if (btn) {
        btn.disabled = false
        btn.innerHTML = originalText
      }
      return
    }

    const apiKey = this.elements.providerApiKey?.value.trim()
    const baseURL = this.elements.providerBaseUrl?.value.trim()

    if (!apiKey) {
      this.showErrorNotification('Please enter an API key', 'warning')
      // Restore button
      if (btn) {
        btn.disabled = false
        btn.innerHTML = originalText
      }
      return
    }

    this.showErrorNotification('Testing connection...', 'info')
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_PROVIDER_CONNECTION',
        providerId,
        apiKey,
        baseURL
      })

      if (response.valid) {
        this.showErrorNotification('✓ Connection successful!', 'success')
      } else {
        // Show detailed error information
        let errorMessage = response.error || 'Connection failed'
        if (response.statusCode) {
          errorMessage = `HTTP ${response.statusCode}: ${errorMessage}`
        }
        this.showErrorNotification(`✗ ${errorMessage}`, 'error')
      }
    } catch (error) {
      this.showErrorNotification(`✗ Test failed: ${error.message}`, 'error')
    } finally {
      // Restore button
      if (btn) {
        btn.disabled = false
        btn.innerHTML = originalText
      }
    }
  }

  async saveProviderConfiguration() {
    const btn = this.elements.saveProviderBtn
    const originalText = btn ? btn.innerHTML : 'Save Configuration'
    
    // Show loading state
    if (btn) {
      btn.disabled = true
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="animation: spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="15 60"></circle>
        </svg>
        Saving...
      `
    }
    
    const providerId = this.elements.providerSelect?.value
    if (!providerId) {
      this.showErrorNotification('Please select a provider first', 'warning')
      // Restore button
      if (btn) {
        btn.disabled = false
        btn.innerHTML = originalText
      }
      return
    }

    const apiKey = this.elements.providerApiKey?.value.trim()
    const baseURL = this.elements.providerBaseUrl?.value.trim()

    if (!apiKey) {
      this.showErrorNotification('Please enter an API key', 'warning')
      // Restore button
      if (btn) {
        btn.disabled = false
        btn.innerHTML = originalText
      }
      return
    }

    try {
      const permissionGranted = await this.requestProviderOriginPermission(baseURL)
      if (!permissionGranted) {
        this.showErrorNotification('Network permission was not granted for this provider URL.', 'warning')
        return
      }
      await this.storage.setProviderCredentials(providerId, apiKey, baseURL)
      this.loadSavedProviders()
      this.showErrorNotification('✓ Configuration saved!', 'success')
      
      // Update the status display to show configured
      if (this.elements.providerStatusDisplay) {
        this.elements.providerStatusDisplay.textContent = '✓ Configured'
        this.elements.providerStatusDisplay.className = 'status-message success'
      }
      
      // Clear the API key field for security after saving
      if (this.elements.providerApiKey) {
        this.elements.providerApiKey.value = ''
      }
    } catch (error) {
      this.showErrorNotification(`✗ Save failed: ${error.message}`, 'error')
    } finally {
      // Restore button
      if (btn) {
        btn.disabled = false
        btn.innerHTML = originalText
      }
    }
  }

  /**
   * Requests access only when a user configures a non-catalog provider URL.
   * Known provider origins are already declared in manifest.json. Keeping
   * custom origins optional reduces install-time permissions and improves
   * Chrome Web Store reviewability.
   */
  async requestProviderOriginPermission(baseURL) {
    return requestOptionalProviderOrigin(baseURL)
  }

  toggleAPIKeyVisibility() {
    const input = this.elements.providerApiKey
    const button = this.elements.toggleApiKeyVisibility
    
    if (!input || !button) return
    
    if (input.type === 'password') {
      input.type = 'text'
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `
      button.setAttribute('aria-pressed', 'true')
      button.setAttribute('aria-label', 'Hide API key')
      button.title = 'Hide API key'
    } else {
      input.type = 'password'
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `
      button.setAttribute('aria-pressed', 'false')
      button.setAttribute('aria-label', 'Show API key')
      button.title = 'Show API key'
    }
  }

  openModelSelectorForCurrentProvider() {
    const providerId = this.elements.providerSelect?.value
    if (!providerId) {
      this.showErrorNotification('Please select a provider first', 'warning')
      return
    }
    this.openModelSelector(providerId)
  }

  /**
   * Close the model selector modal and return keyboard focus to whatever
   * triggered it, so keyboard/screen-reader users aren't dropped back at
   * the top of the document.
   */
  /**
   * Show the model selector modal, remembering the element that triggered it
   * (for focus restoration) and moving focus into the modal so keyboard and
   * screen-reader users land somewhere sensible instead of the dialog opening
   * silently around the still-focused trigger button.
   */
  showModelSelectorModal() {
    if (!this.elements.modelSelectorModal) return
    if (!this._modalOpenerElement) {
      this._modalOpenerElement = document.activeElement
    }
    this.elements.modelSelectorModal.classList.remove('hidden')
    const closeBtn = this.elements.modelSelectorModal.querySelector('.modal-close')
    if (closeBtn && typeof closeBtn.focus === 'function') {
      closeBtn.focus()
    }
  }

  closeModelSelectorModal() {
    if (!this.elements.modelSelectorModal) return
    this.elements.modelSelectorModal.classList.add('hidden')
    const trigger = this._modalOpenerElement
    this._modalOpenerElement = null
    if (trigger && typeof trigger.focus === 'function') {
      trigger.focus()
    }
  }

  /**
   * Basic focus trap: keeps Tab/Shift+Tab cycling within the modal's
   * focusable elements instead of escaping to the page behind it.
   */
  trapModalFocus(event, modalEl) {
    const focusable = modalEl.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  showStatus(message, type = 'info') {
    if (this.elements.providerStatusDisplay) {
      this.elements.providerStatusDisplay.textContent = message
      this.elements.providerStatusDisplay.className = `status-message ${type}`
    }
  }

  updateMcpFields() {
    const mcpType = this.elements.mcpType?.value
    if (!mcpType) return
    
    const urlGroup = document.getElementById('mcp-url-group')
    const apiKeyGroup = document.getElementById('mcp-api-key-group')
    const commandGroup = document.getElementById('mcp-command-group')
    const argsGroup = document.getElementById('mcp-args-group')
    const webhookGroup = document.getElementById('mcp-webhook-group')
    
    if (urlGroup) urlGroup.style.display = 'none'
    if (apiKeyGroup) apiKeyGroup.style.display = 'none'
    if (commandGroup) commandGroup.style.display = 'none'
    if (argsGroup) argsGroup.style.display = 'none'
    if (webhookGroup) webhookGroup.style.display = 'none'
    
    switch (mcpType) {
      case 'local-http':
        if (urlGroup) urlGroup.style.display = 'block'
        if (apiKeyGroup) apiKeyGroup.style.display = 'block'
        break
      case 'webhook':
        if (webhookGroup) webhookGroup.style.display = 'block'
        if (apiKeyGroup) apiKeyGroup.style.display = 'block'
        break
      case 'notion':
      case 'slack':
      case 'github':
      case 'jira':
      case 'google-drive':
      case 'dropbox':
        if (apiKeyGroup) apiKeyGroup.style.display = 'block'
        break
      case 'claude-mcp':
      case 'openai-gpts':
      case 'gemini-extensions':
        if (commandGroup) commandGroup.style.display = 'block'
        if (argsGroup) argsGroup.style.display = 'block'
        break
      case 'postgres':
        if (urlGroup) urlGroup.style.display = 'block'
        if (apiKeyGroup) apiKeyGroup.style.display = 'block'
        break
    }
  }

  async addMcpConnection() {
    const mcpType = this.elements.mcpType?.value
    const name = this.elements.mcpName?.value.trim()
    
    if (!mcpType || !name) {
      this.showMcpStatus('Please select an MCP type and enter a name', 'error')
      return
    }
    
    const connection = {
      id: Date.now().toString(),
      type: mcpType,
      name: name,
      config: {}
    }
    
    const url = this.elements.mcpUrl?.value?.trim()
    const apiKey = this.elements.mcpApiKey?.value?.trim()
    const command = this.elements.mcpCommand?.value?.trim()
    const args = this.elements.mcpArgs?.value?.trim()
    const webhookUrl = this.elements.mcpWebhookUrl?.value?.trim()
    
    if (url) connection.config.url = url
    if (apiKey) connection.config.apiKey = apiKey
    if (command) connection.config.command = command
    if (args) connection.config.args = args
    if (webhookUrl) connection.config.webhookUrl = webhookUrl
    
    const result = await this.storage.get('mcp_connections')
    const mcpConnections = (result?.mcp_connections || result || [])
    mcpConnections.push(connection)
    await this.storage.set({ mcp_connections: mcpConnections })
    
    this.showMcpStatus('Connection added!', 'success')
    this.renderMcpConnections()
    
    if (this.elements.mcpName) this.elements.mcpName.value = ''
    if (this.elements.mcpUrl) this.elements.mcpUrl.value = ''
    if (this.elements.mcpApiKey) this.elements.mcpApiKey.value = ''
    if (this.elements.mcpCommand) this.elements.mcpCommand.value = ''
    if (this.elements.mcpArgs) this.elements.mcpArgs.value = ''
    if (this.elements.mcpWebhookUrl) this.elements.mcpWebhookUrl.value = ''
    if (this.elements.mcpType) this.elements.mcpType.value = ''
    this.updateMcpFields()
  }

  async testMcpConnection() {
    const mcpType = this.elements.mcpType?.value
    
    if (!mcpType) {
      this.showMcpStatus('Please select an MCP type first', 'error')
      return
    }
    
    this.showMcpStatus('Testing connection...', '')
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_MCP_CONNECTION',
        mcpType: mcpType,
        config: {
          url: this.elements.mcpUrl?.value?.trim(),
          apiKey: this.elements.mcpApiKey?.value?.trim(),
          webhookUrl: this.elements.mcpWebhookUrl?.value?.trim()
        }
      })
      
      if (response && response.success) {
        this.showMcpStatus('Connection successful!', 'success')
      } else {
        this.showMcpStatus(response?.error || 'Connection failed', 'error')
      }
    } catch (error) {
      this.showMcpStatus('Error: ' + error.message, 'error')
    }
  }

  async renderMcpConnections() {
    const result = await this.storage.get('mcp_connections')
    const mcpConnections = (result?.mcp_connections || result || [])
    const list = this.elements.mcpConnectionsList
    
    if (!list) return
    
    if (mcpConnections.length === 0) {
      list.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">No MCP connections configured.</p>'
      return
    }
    
    list.innerHTML = mcpConnections.map(conn => `
      <div class="mcp-connection-card" data-id="${OptionsPage.escapeHtml(conn.id)}">
        <div class="mcp-connection-info">
          <div class="mcp-connection-icon">${this.getMcpIcon(OptionsPage.escapeHtml(conn.type))}</div>
          <div>
            <div class="mcp-connection-name">${OptionsPage.escapeHtml(conn.name)}</div>
            <div class="mcp-connection-type">${this.getMcpTypeName(OptionsPage.escapeHtml(conn.type))}</div>
          </div>
        </div>
        <div class="mcp-connection-status">
          <span class="mcp-status-dot ${conn.status || ''}"></span>
          <div class="mcp-connection-actions">
            <button class="mcp-action-btn" data-action="test" data-id="${OptionsPage.escapeHtml(conn.id)}">Test</button>
            <button class="mcp-action-btn delete" data-action="delete" data-id="${OptionsPage.escapeHtml(conn.id)}">Delete</button>
          </div>
        </div>
      </div>
    `).join('')
  }

  getMcpIcon(type) {
    const icons = {
      'notion': '📝',
      'slack': '💬',
      'github': '🐙',
      'jira': '📋',
      'google-drive': '📁',
      'dropbox': '📦',
      'postgres': '🗄️',
      'local-http': '🔌',
      'webhook': '🌐',
      'claude-mcp': '🧠',
      'openai-gpts': '🤖',
      'gemini-extensions': '✨'
    }
    return icons[type] || '🔗'
  }

  getMcpTypeName(type) {
    const names = {
      'notion': 'Notion',
      'slack': 'Slack',
      'github': 'GitHub',
      'jira': 'Jira',
      'google-drive': 'Google Drive',
      'dropbox': 'Dropbox',
      'postgres': 'PostgreSQL',
      'local-http': 'Local HTTP Server',
      'webhook': 'Custom Webhook',
      'claude-mcp': 'Claude MCP',
      'openai-gpts': 'OpenAI GPTs',
      'gemini-extensions': 'Gemini Extensions'
    }
    return names[type] || type
  }

  async deleteMcp(id) {
    const result = await this.storage.get('mcp_connections')
    const mcpConnections = (result?.mcp_connections || result || [])
    const filtered = mcpConnections.filter(c => c.id !== id)
    await this.storage.set({ mcp_connections: filtered })
    this.renderMcpConnections()
    this.showMcpStatus('Connection deleted', 'success')
  }

  async testMcpById(id) {
    const result2 = await this.storage.get('mcp_connections')
    const mcpConnections = (result2?.mcp_connections || result2 || [])
    const conn = mcpConnections.find(c => c.id === id)
    
    if (!conn) {
      this.showMcpStatus('Connection not found', 'error')
      return
    }
    
    this.showMcpStatus('Testing connection...', '')
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_MCP_CONNECTION',
        mcpType: conn.type,
        config: conn.config
      })
      
      if (response && response.success) {
        conn.status = 'connected'
        await this.storage.set({ mcp_connections: mcpConnections })
        this.renderMcpConnections()
        this.showMcpStatus('Connection successful!', 'success')
      } else {
        conn.status = 'error'
        await this.storage.set({ mcp_connections: mcpConnections })
        this.renderMcpConnections()
        this.showMcpStatus(response?.error || 'Connection failed', 'error')
      }
    } catch (error) {
      this.showMcpStatus('Error: ' + error.message, 'error')
    }
  }

  showMcpStatus(message, type) {
    if (!this.elements.mcpStatus) return
    this.elements.mcpStatus.textContent = message
    this.elements.mcpStatus.className = 'status-message ' + (type || '')
    if (type !== 'error') {
      setTimeout(() => {
        if (this.elements.mcpStatus) {
          this.elements.mcpStatus.textContent = ''
          this.elements.mcpStatus.className = 'status-message'
        }
      }, 3000)
    }
  }

  handleLogoUpload(event) {
    const file = event.target.files[0]
    if (!file) return

    if (file.size > 500 * 1024) {
      this.showErrorNotification('Image size must be less than 500KB', 'warning')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      if (this.elements.logoPreview) {
        this.elements.logoPreview.src = dataUrl
      }
      if (this.elements.logoPreviewContainer) {
        this.elements.logoPreviewContainer.classList.remove('hidden')
      }
      this.customLogoData = dataUrl
    }
    reader.readAsDataURL(file)
  }

  removeCustomLogo() {
    if (this.elements.customLogo) this.elements.customLogo.value = ''
    if (this.elements.logoPreview) this.elements.logoPreview.src = ''
    if (this.elements.logoPreviewContainer) this.elements.logoPreviewContainer.classList.add('hidden')
    this.customLogoData = null
  }

  async getProviderCredentials(providerId) {
    try {
      console.debug('getProviderCredentials called with:', providerId)
      const result = await this.storage.get(STORAGE_KEYS.PROVIDER_CREDENTIALS)
      console.debug('getProviderCredentials - full result:', result)
      const credentials = result[STORAGE_KEYS.PROVIDER_CREDENTIALS] || {}
      console.debug('getProviderCredentials - credentials for all providers:', credentials)
      console.debug('getProviderCredentials - credentials for', providerId, ':', credentials[providerId])
      return credentials[providerId] || { apiKey: '', baseURL: '' }
    } catch (error) {
      // A storage read failure here used to fall back to an empty-credentials object with
      // only a console.error — every caller then displayed "No API key configured", which is
      // indistinguishable from the user simply never having set one up. Surface the real
      // cause so a genuine storage problem isn't mistaken for "I forgot to add my key".
      console.error('Error getting provider credentials:', error)
      this.showErrorNotification(`Could not read saved provider credentials: ${error.message}`, 'error')
      return { apiKey: '', baseURL: '' }
    }
  }

  createModelCheckbox(model, currentSelections, providerId, capabilities) {
    const isChecked = currentSelections.includes(model.id) ? 'checked' : ''
    const isDisabled = currentSelections.length >= 2 && !isChecked
    const disabled = isDisabled ? 'disabled' : ''
    // Screen readers announce disabled state on their own, but without an explanation the
    // user has no way to know *why* a checkbox stopped responding — surface the reason via
    // title (visible on hover/focus tooltip in most browsers) and aria-describedby.
    const disabledHint = isDisabled
      ? ` title="Maximum of 2 models selected — uncheck one to select this model" aria-describedby="model-selection-count"`
      : ''

    const capabilitiesIcons = []
    if (capabilities.supportsVision) capabilitiesIcons.push('<span title="Vision" class="capability-icon">📷</span>')
    if (capabilities.supportsImageGen) capabilitiesIcons.push('<span title="Image Generation" class="capability-icon">🎨</span>')

    return `
      <label class="model-selector-item">
        <input type="checkbox" value="${escapeHtml(model.id)}" ${isChecked} ${disabled} data-provider="${escapeHtml(providerId)}"${disabledHint}>
        <span class="model-name">${escapeHtml(model.name)}</span>
        ${capabilitiesIcons.length > 0 ? `<span class="model-capabilities">${capabilitiesIcons.join('')}</span>` : ''}
      </label>
    `
  }

  bindModalCheckboxes(providerId, currentSelections) {
    if (!this.elements.modelSelectorList) return
    
    const checkboxes = this.elements.modelSelectorList.querySelectorAll('input[type="checkbox"]')

    const updateState = async () => {
      this.updateModalSelectionCount()
    }

    checkboxes.forEach(cb => {
      cb.addEventListener('change', async () => {
        const checked = this.elements.modelSelectorList.querySelectorAll('input[type="checkbox"]:checked')
        const selectedModels = Array.from(checked).map(c => c.value)

        const validation = validateModels(selectedModels, providerId)

        if (!validation.isValid) {
          const errorDetails = validation.errors.map(err => err.message).join(', ')
          this.showErrorNotification(`Invalid models: ${errorDetails}`)
          cb.checked = false
          updateState()
          return
        }

        try {
          await ModelSelectionManager.setModels(providerId, selectedModels)
          console.debug('[bindModalCheckboxes] Saved:', providerId, selectedModels)

          if (validation.validCount < selectedModels.length) {
            console.warn('[bindModalCheckboxes] Some models have validation warnings:', validation.errors.length)
          }
        } catch (error) {
          console.error('[bindModalCheckboxes] Error:', error)
          this.showErrorNotification(`Error saving models: ${error.message}`)
        }

        updateState()
      })
    })

    updateState()
  }

  async loadSettings() {
    try {
      const [apiConfig, settings, apiKey, providerCredentials] = await Promise.all([
        this.storage.get([STORAGE_KEYS.API_BASE_URL, STORAGE_KEYS.MODEL]),
        this.storage.get(STORAGE_KEYS.SETTINGS),
        this.storage.get(STORAGE_KEYS.API_KEY),
        this.storage.get(STORAGE_KEYS.PROVIDER_CREDENTIALS)
      ])

      const enabledModels = await ModelSelectionManager.getAllModels()
      console.debug('loadSettings - enabledModels from storage:', enabledModels)

      if (apiConfig[STORAGE_KEYS.API_BASE_URL] && this.elements.providerBaseUrl) {
        this.elements.providerBaseUrl.value = apiConfig[STORAGE_KEYS.API_BASE_URL]
      }

      if (settings) {
        if (this.elements.temperature) this.elements.temperature.value = settings.temperature ?? 0.7
        if (this.elements.temperatureValue) this.elements.temperatureValue.textContent = settings.temperature ?? 0.7
        if (this.elements.maxTokens) this.elements.maxTokens.value = settings.maxTokens ?? 2000
        if (this.elements.systemPrompt) this.elements.systemPrompt.value = settings.systemPrompt || ''
        if (this.elements.streaming) this.elements.streaming.checked = settings.streaming ?? true
        if (this.elements.includePageContent) this.elements.includePageContent.checked = settings.includePageContent ?? false
        if (this.elements.contextLength) this.elements.contextLength.value = settings.contextLength ?? 4000
        if (this.elements.memoryEnabled) this.elements.memoryEnabled.checked = settings.memoryEnabled ?? true
        if (this.elements.theme) this.elements.theme.value = settings.theme ?? 'system'
        const density = settings.density === 'compact' ? 'compact' : 'comfortable'
        if (this.elements.densityCompact) this.elements.densityCompact.checked = density === 'compact'
        if (this.elements.densityComfortable) this.elements.densityComfortable.checked = density === 'comfortable'
        if (this.elements.autoScroll) this.elements.autoScroll.checked = settings.autoScroll ?? true
        if (this.elements.showTimestamps) this.elements.showTimestamps.checked = settings.showTimestamps ?? true
        if (this.elements.panelWidth) this.elements.panelWidth.value = String(settings.panelWidth ?? 400)

        if (settings.customLogo) {
          this.customLogoData = settings.customLogo
          if (this.elements.logoPreview) this.elements.logoPreview.src = this.customLogoData
          if (this.elements.logoPreviewContainer) this.elements.logoPreviewContainer.classList.remove('hidden')
        }
      }

      const theme = settings?.theme || 'system'
      if (theme === 'system') {
        document.documentElement.removeAttribute('data-theme')
      } else {
        document.documentElement.setAttribute('data-theme', theme)
      }

      this.checkMicPermission()
    } catch (error) {
      // Previously logged to console only — a storage read failure here left every field on
      // the page showing hardcoded defaults with no indication anything went wrong, which
      // looks identical to "you've never configured anything" from the user's perspective.
      console.error('Failed to load settings:', error)
      this.showErrorNotification(`Failed to load your saved settings: ${error.message}. Showing defaults — try refreshing the page.`, 'error')
    }
  }

  async checkMicPermission() {
    if (!this.elements.micPermissionSection) return
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' })
      if (permission.state === 'granted') {
        if (this.elements.micStatus) {
          this.elements.micStatus.textContent = 'Microphone permission granted'
          this.elements.micStatus.style.color = 'var(--success-color)'
        }
        if (this.elements.grantMicBtn) {
          this.elements.grantMicBtn.style.display = 'none'
        }
      } else if (permission.state === 'denied') {
        if (this.elements.micStatus) {
          this.elements.micStatus.textContent = 'Microphone permission denied. Enable it in your browser settings.'
          this.elements.micStatus.style.color = 'var(--error-color)'
        }
      }
    } catch (e) {
      // permissions API not fully supported, ignore silently
    }
  }

  // ─── Spending Dashboard ─────────────────────────────────────

  async loadSpendDashboard() {
    try {
      const raw = await this.storage.get('spend_history')
      const entries = raw?.spend_history || []
      const now = Date.now()

      // Session cost (last 4 hours)
      const sessionCutoff = now - 4 * 3600000
      const sessionCost = entries
        .filter(e => e.timestamp >= sessionCutoff)
        .reduce((s, e) => s + (e.costUsd || 0), 0)

      // Week cost
      const weekCutoff = now - 7 * 86400000
      const weekCost = entries
        .filter(e => e.timestamp >= weekCutoff)
        .reduce((s, e) => s + (e.costUsd || 0), 0)

      // Month cost
      const monthCutoff = now - 30 * 86400000
      const monthEntries = entries.filter(e => e.timestamp >= monthCutoff)
      const monthCost = monthEntries.reduce((s, e) => s + (e.costUsd || 0), 0)

      if (this.elements.spendSession) this.elements.spendSession.textContent = `$${sessionCost.toFixed(4)}`
      if (this.elements.spendWeek) this.elements.spendWeek.textContent = `$${weekCost.toFixed(4)}`
      if (this.elements.spendMonth) this.elements.spendMonth.textContent = `$${monthCost.toFixed(4)}`

      // Provider breakdown
      const byProvider = {}
      for (const e of monthEntries) {
        const p = e.provider || 'unknown'
        if (!byProvider[p]) byProvider[p] = { cost: 0, calls: 0 }
        byProvider[p].cost += e.costUsd || 0
        byProvider[p].calls++
      }

      if (this.elements.spendProviderList) {
        const providers = Object.entries(byProvider).sort((a, b) => b[1].cost - a[1].cost)
        if (providers.length === 0) {
          this.elements.spendProviderList.innerHTML = '<p class="form-help">No spending data yet. Start a conversation to begin tracking.</p>'
        } else {
          this.elements.spendProviderList.innerHTML = providers.map(([id, data]) => `
            <div class="spend-provider-row">
              <span class="spend-provider-name">${escapeHtml(id)}</span>
              <span class="spend-provider-amount">$${data.cost.toFixed(4)}</span>
              <span class="spend-provider-calls">${data.calls} calls</span>
            </div>
          `).join('')
        }
      }

      // Daily chart (last 14 days)
      this.renderSpendChart(entries, 14)
    } catch (error) {
      console.error('Failed to load spending dashboard:', error)
    }
  }

  renderSpendChart(entries, days) {
    const canvas = this.elements.spendChart
    if (!canvas || !canvas.getContext) return

    const ctx = canvas.getContext('2d')
    const now = new Date()
    const daily = {}

    for (const e of entries) {
      const d = new Date(e.timestamp)
      const key = d.toISOString().slice(0, 10)
      if (!daily[key]) daily[key] = 0
      daily[key] += e.costUsd || 0
    }

    const data = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      data.push({ date: key, cost: daily[key] || 0 })
    }

    const maxCost = Math.max(...data.map(d => d.cost), 0.001)
    const w = canvas.width
    const h = canvas.height
    const barW = Math.max(2, (w - 40) / days - 2)
    const chartH = h - 40

    ctx.clearRect(0, 0, w, h)

    // Bars
    data.forEach((d, i) => {
      const x = 20 + i * (barW + 2)
      const barH = (d.cost / maxCost) * chartH
      const y = chartH - barH + 10

      ctx.fillStyle = d.cost > 0 ? '#2563eb' : '#e5e7eb'
      ctx.fillRect(x, y, barW, barH)

      // Date label (every 3rd day)
      if (i % 3 === 0) {
        ctx.fillStyle = '#6b7280'
        ctx.font = '9px sans-serif'
        ctx.fillText(d.date.slice(5), x, h - 5)
      }
    })

    // Y-axis label
    ctx.fillStyle = '#6b7280'
    ctx.font = '10px sans-serif'
    ctx.fillText(`$${maxCost.toFixed(4)}`, 0, 20)
  }

  async exportSpendData() {
    try {
      const raw = await this.storage.get('spend_history')
      const entries = raw?.spend_history || []
      if (entries.length === 0) {
        this.showErrorNotification('No spending data to export', 'warning')
        return
      }
      const header = 'timestamp,date,provider,model,prompt_tokens,completion_tokens,cost_usd'
      const rows = entries.map(e => {
        const date = new Date(e.timestamp).toISOString()
        return `${e.timestamp},${date},${e.provider},${e.model},${e.promptTokens},${e.completionTokens},${(e.costUsd || 0).toFixed(6)}`
      })
      const csv = [header, ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ctrl-spending-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      this.showErrorNotification('Spending data exported', 'success')
    } catch (error) {
      console.error('Export spending error:', error)
      this.showErrorNotification('Failed to export spending data', 'error')
    }
  }

  // ── Snippet Management ──────────────────────────────────────────────────
  async loadSnippets() {
    try {
      await this.snippetStore.load()
      this.renderSnippetList()
      this.setupSnippetForm()
    } catch (error) {
      console.error('Failed to load snippets:', error)
    }
  }

  renderSnippetList() {
    const container = document.getElementById('snippet-list')
    if (!container) return

    const snippets = this.snippetStore.getAll()
    if (snippets.length === 0) {
      container.innerHTML = '<p class="form-help">No snippets configured.</p>'
      return
    }

    container.innerHTML = snippets.map(s => `
      <div class="snippet-item" data-id="${escapeHtml(s.id)}">
        <div class="snippet-item-info">
          <span class="snippet-item-trigger">${escapeHtml(s.trigger)}</span>
          <span class="snippet-item-name">${escapeHtml(s.name)}</span>
        </div>
        <span class="snippet-item-category">${escapeHtml(s.category)}</span>
        <div class="snippet-item-actions">
          ${s.builtin ? '' : `<button type="button" class="btn-icon danger" data-action="delete-snippet" data-id="${escapeHtml(s.id)}" title="Delete snippet" aria-label="Delete snippet ${escapeHtml(s.name)}">&#128465;</button>`}
        </div>
      </div>
    `).join('')

    container.querySelectorAll('[data-action="delete-snippet"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id
        if (confirm('Delete this snippet?')) {
          await this.snippetStore.remove(id)
          this.renderSnippetList()
          this.showErrorNotification('Snippet deleted', 'success')
        }
      })
    })
  }

  setupSnippetForm() {
    const addBtn = document.getElementById('add-snippet-btn')
    if (!addBtn) return

    addBtn.addEventListener('click', async () => {
      const name = document.getElementById('snippet-name')?.value?.trim()
      const trigger = document.getElementById('snippet-trigger')?.value?.trim()
      const content = document.getElementById('snippet-content')?.value?.trim()
      const category = document.getElementById('snippet-category')?.value || 'general'

      if (!name || !trigger || !content) {
        this.showErrorNotification('All fields are required', 'warning')
        return
      }
      if (!trigger.startsWith('/')) {
        this.showErrorNotification('Trigger must start with /', 'warning')
        return
      }

      // Check for duplicate trigger
      const existing = this.snippetStore.findByTrigger(trigger)
      if (existing.length > 0) {
        this.showErrorNotification(`Trigger "${trigger}" already exists`, 'warning')
        return
      }

      await this.snippetStore.add({ name, trigger, content, category })
      this.renderSnippetList()

      // Clear form
      document.getElementById('snippet-name').value = ''
      document.getElementById('snippet-trigger').value = ''
      document.getElementById('snippet-content').value = ''
      this.showErrorNotification('Snippet added', 'success')
    })
  }

  /**
   * Load consent state from storage and render the consent settings list.
   * ConsentManager.initialize() now just hydrates state from the
   * 'user_consent' storage key and reports pending consent types — it no
   * longer waits on the unheard 'show-consent-modal' event, so it's safe
   * to call directly here.
   */
  async loadConsentSettings() {
    try {
      await consentManager.initialize()
      this.renderConsentSettings()
    } catch (error) {
      // Previously console-only: the consent list section would just render empty/stale
      // with no indication that anything failed, on a page whose whole purpose for this
      // section is telling the user what CTRL Extension is and isn't allowed to do.
      console.error('Failed to load consent settings:', error)
      this.showErrorNotification(`Failed to load privacy consent settings: ${error.message}`, 'error')
    }
  }

  getConsentDisplayTitle(type) {
    const titles = {
      [ConsentTypes.PRIVACY_POLICY]: 'Privacy Policy',
      [ConsentTypes.TERMS_OF_SERVICE]: 'Terms of Service',
      [ConsentTypes.DATA_COLLECTION]: 'Local Data Collection',
      [ConsentTypes.ANALYTICS]: 'Analytics',
      [ConsentTypes.CRASH_REPORTING]: 'Crash Reporting',
      [ConsentTypes.FEATURE_USAGE]: 'Feature Usage Tracking',
      [ConsentTypes.CONTEXT_AWARENESS]: 'Page Context',
      [ConsentTypes.MODEL_SELECTION]: 'Model Selection',
      [ConsentTypes.PROVIDER_CONFIG]: 'Provider Configuration'
    }
    return titles[type] || consentManager.getConsentTitle(type)
  }

  getConsentDescription(type) {
    const descriptions = {
      [ConsentTypes.PRIVACY_POLICY]: 'Acknowledgement that you have read and accepted the CTRL Extension Privacy Policy.',
      [ConsentTypes.TERMS_OF_SERVICE]: 'Agreement to the Terms of Service governing use of CTRL Extension.',
      [ConsentTypes.DATA_COLLECTION]: 'Local, encrypted storage of your API keys, preferences, and (optionally) chat history on your device. Nothing is sent to our servers.',
      [ConsentTypes.ANALYTICS]: 'Anonymous usage analytics to help improve the extension. CTRL Extension does not currently collect analytics.',
      [ConsentTypes.CRASH_REPORTING]: 'Automatic crash and error reporting to help diagnose issues.',
      [ConsentTypes.FEATURE_USAGE]: 'Tracking which features you use to help prioritize improvements.',
      [ConsentTypes.CONTEXT_AWARENESS]: 'Allow CTRL Extension to include page content in your conversations for better context.',
      [ConsentTypes.MODEL_SELECTION]: 'Allow CTRL Extension to remember and use your selected AI models.',
      [ConsentTypes.PROVIDER_CONFIG]: 'Allow CTRL Extension to store API keys and base URLs for your configured AI providers, encrypted locally.'
    }
    return descriptions[type] || 'Please review this permission.'
  }

  renderConsentSettings() {
    const container = this.elements.consentSettingsList
    if (!container) return

    const consents = consentManager.getAllConsents()
    const types = Object.values(ConsentTypes)

    if (types.length === 0) {
      container.innerHTML = '<p class="no-saved-providers">No consent types are defined.</p>'
      return
    }

    container.innerHTML = types.map((type) => {
      const consent = consents[type] || { status: ConsentStatus.NOT_ASKED }
      const isAccepted = consent.status === ConsentStatus.ACCEPTED
      const title = this.getConsentDisplayTitle(type)
      const description = this.getConsentDescription(type)

      return `
        <div class="consent-type-row" data-consent-type="${escapeHtml(type)}">
          <div class="consent-type-info">
            <h3 class="consent-type-title">${escapeHtml(title)}</h3>
            <p class="consent-type-description">${escapeHtml(description)}</p>
            <p class="consent-type-status">Status: <span class="consent-status-value">${escapeHtml(consent.status)}</span></p>
          </div>
          <label class="consent-type-toggle-wrapper">
            <input type="checkbox" class="consent-toggle" data-consent-type="${escapeHtml(type)}" aria-label="Allow ${escapeHtml(title)}" ${isAccepted ? 'checked' : ''}>
            <span aria-hidden="true">Allow</span>
          </label>
        </div>
      `
    }).join('')

    container.querySelectorAll('.consent-toggle').forEach((toggle) => {
      toggle.addEventListener('change', (e) => this.handleConsentToggle(e.target))
    })
  }

  async handleConsentToggle(toggleEl) {
    const type = toggleEl.dataset.consentType
    if (!type) return

    try {
      if (toggleEl.checked) {
        await consentManager.acceptConsent(type)
      } else {
        await consentManager.revokeConsent(type)
      }
      this.renderConsentSettings()
    } catch (error) {
      console.error('Failed to update consent:', error)
      this.showErrorNotification(`Error updating consent: ${error.message}`)
      toggleEl.checked = !toggleEl.checked
    }
  }

  openPrivacyPolicy() {
    try {
      const url = chrome.runtime.getURL('PRIVACY-POLICY.md')
      chrome.tabs.create({ url })
    } catch (error) {
      console.error('Failed to open privacy policy:', error)
      this.showErrorNotification('Could not open Privacy Policy', 'error')
    }
  }

  async openModelSelector(providerId) {
    console.debug('openModelSelector called with providerId:', providerId)
    console.debug('Available providers:', Object.keys(PROVIDERS))
    
    const provider = PROVIDERS[providerId]
    if (!provider) {
      console.error('Provider not found:', providerId)
      this.showErrorNotification(`Provider ${providerId} not found. Please check the provider configuration.`)
      return
    }

    console.debug('Opening model selector for:', providerId)

    try {
      const currentSelections = await ModelSelectionManager.getModels(providerId)
      console.debug('Selections for this provider from storage:', currentSelections)

      this.currentModalProviderId = providerId
      const container = this.elements.modelSelectorList
      const modal = this.elements.modelSelectorModal

      if (!container) {
        console.error('Model selector container not found')
        this.showErrorNotification('Error: Model selector container not found', 'error')
        return
      }

      if (!modal) {
        console.error('Model selector modal not found')
        this.showErrorNotification('Error: Model selector modal not found', 'error')
        return
      }

      const credentials = await this.getProviderCredentials(providerId)
      console.debug('Credentials for provider:', { providerId, hasApiKey: !!credentials.apiKey })
    if (!credentials.apiKey) {
      const hasDefaultModels = DEFAULT_ENABLED_MODELS[providerId] && DEFAULT_ENABLED_MODELS[providerId].length > 0
      const hasStoredSelections = currentSelections && currentSelections.length > 0

      let actionsHtml = ''
      if (hasDefaultModels) {
        actionsHtml = '<button id="use-default-models" class="primary-btn">Use Default Models</button>'
      }
      if (hasStoredSelections) {
        actionsHtml += '<p class="info-text">Your current selections are still available below.</p>'
      }

      container.innerHTML = `
        <div class="error-message">
          <p>No API key configured for ${escapeHtml(provider.name)}.</p>
          <p>You can add an API key in settings or use default models below.</p>
          ${actionsHtml ? `<div class="error-actions">${actionsHtml}</div>` : ''}
        </div>
      `
      
      const headerTitle = this.elements.modelSelectorModal?.querySelector('.modal-header h3')
      if (headerTitle) headerTitle.textContent = `Select Models for ${provider.name}`
      
      if (hasDefaultModels) {
        setTimeout(() => {
          const useDefaultBtn = document.getElementById('use-default-models')
          if (useDefaultBtn) {
            useDefaultBtn.addEventListener('click', () => {
              this.useDefaultModels(providerId, provider, currentSelections)
            })
          }
        }, 100)
      }

      this.showModelSelectorModal()

      if (hasStoredSelections) {
        this.renderStoredModels(currentSelections, providerId, provider)
      }

      return
    }

    container.innerHTML = '<p class="loading-state">Fetching available models...</p>'

    const response = await chrome.runtime.sendMessage({
      type: 'GET_MODELS',
      providerId,
      apiKey: credentials.apiKey,
      baseURL: credentials.baseURL,
      forceRefresh: false
    })

    if (response.error) {
      const hasStoredSelections = currentSelections && currentSelections.length > 0

      container.innerHTML = `
        <div class="error-message">
          <p>Failed to fetch models: ${escapeHtml(response.error)}</p>
          <div class="error-actions">
            <button id="retry-models-fetch" class="primary-btn">Retry Fetch</button>
            <button id="use-default-models" class="secondary-btn">Use Default Models</button>
            ${hasStoredSelections ? '<p class="info-text">Your current selections are still available below.</p>' : ''}
          </div>
        </div>
      `

      const headerTitle = this.elements.modelSelectorModal?.querySelector('.modal-header h3')
      if (headerTitle) headerTitle.textContent = `Select Models for ${provider.name}`

      const retryBtn = document.getElementById('retry-models-fetch')
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.openModelSelector(providerId)
        })
      }

      const useDefaultBtn = document.getElementById('use-default-models')
      if (useDefaultBtn) {
        useDefaultBtn.addEventListener('click', () => {
          this.useDefaultModels(providerId, provider, currentSelections)
        })
      }

      this.showModelSelectorModal()

      if (hasStoredSelections) {
        this.renderStoredModels(currentSelections, providerId, provider)
      }

      return
    }

    // The live /models call can succeed (200 OK) but return zero usable models — not every
    // OpenAI-compatible provider implements a matching listing endpoint. Previously that meant
    // the modal opened with a header and literally no checkboxes to select. Fall back to this
    // app's own curated model list (utils/storage.js PROVIDERS[id].models) so there's always
    // something selectable regardless of whether live discovery worked.
    let apiModels = response.models || []
    let usingCuratedFallback = false
    if (apiModels.length === 0) {
      apiModels = provider.models || []
      usingCuratedFallback = true
    }
    const recommended = RECOMMENDED_MODELS[providerId] || []
    const providerCapabilities = {
      supportsVision: provider.supportsVision,
      supportsImageGen: provider.supportsImageGen
    }

    let html = usingCuratedFallback && apiModels.length > 0
      ? '<p class="info-text">Couldn\'t list live models from the provider — showing the built-in model list instead.</p>'
      : ''

    const recommendedModels = apiModels.filter(m => recommended.includes(m.id))
    if (recommendedModels.length > 0) {
      html += `
        <div class="model-section">
          <h4 class="model-section-title">⭐ Recommended</h4>
          <div class="model-grid">
            ${recommendedModels.map(model => this.createModelCheckbox(model, currentSelections, providerId, providerCapabilities)).join('')}
          </div>
        </div>
      `
    }

    const otherModels = apiModels.filter(m => !recommended.includes(m.id))
    if (otherModels.length > 0) {
      html += `
        <div class="model-section">
          <h4 class="model-section-title">📋 All Models (${otherModels.length})</h4>
          <div class="model-grid all-models-grid">
            ${otherModels.map(model => this.createModelCheckbox(model, currentSelections, providerId, providerCapabilities)).join('')}
          </div>
        </div>
      `
    }

    html = `
      <div class="model-selector-content">
        ${html}
      </div>
    `

    container.innerHTML = html

    const headerTitle = this.elements.modelSelectorModal?.querySelector('.modal-header h3')
    if (headerTitle) headerTitle.textContent = `Select Models for ${provider.name}`

    this.showModelSelectorModal()
    this.bindModalCheckboxes(providerId, currentSelections)
    this.updateModalSelectionCount()
    } catch (error) {
      console.error('Error opening model selector:', error)
      this.showErrorNotification(`Error opening model selector: ${error.message}`, 'error')
    }
  }

  async clearModalSelections() {
    const providerId = this.currentModalProviderId

    if (this.elements.modelSelectorList) {
      const checkboxes = this.elements.modelSelectorList.querySelectorAll('input[type="checkbox"]')
      checkboxes.forEach(cb => {
        cb.checked = false
      })
    }
    this.updateModalSelectionCount()

    if (providerId) {
      try {
        await ModelSelectionManager.clearProvider(providerId)
        console.debug('[clearModalSelections] Cleared provider:', providerId)
        this.showErrorNotification('Model selections cleared!')
      } catch (error) {
        console.error('[clearModalSelections] Error:', error)
        this.showErrorNotification(`Error clearing models: ${error.message}`)
      }
    }
  }

  async useDefaultModels(providerId, provider, currentSelections = []) {
    // This whole body used to run with no try/catch. A previous round found that a boolean
    // .includes() call here threw synchronously and killed the flow with zero visible
    // feedback — the button click just did nothing from the user's perspective. That specific
    // bug is fixed (see comment below), but the button-click handler that invokes this method
    // is still a place where *any* future unhandled exception (missing DOM elements, a bad
    // provider object, etc.) would silently do nothing again. Wrapping the whole thing ensures
    // the user always gets a visible error instead of a dead button.
    try {
      const defaultModels = DEFAULT_ENABLED_MODELS[providerId] || []
      if (defaultModels.length === 0) {
        this.showErrorNotification(`No default models available for ${provider.name}`)
        return
      }

      console.debug('[useDefaultModels] Loading default models for:', providerId, defaultModels)

      // supportsVision/supportsImageGen on a PROVIDERS entry are plain booleans (a provider-level
      // capability flag), not per-model arrays — there's no per-model granularity in this data.
      // Calling .includes() on a boolean throws immediately, which silently killed this whole flow.
      const modelObjects = defaultModels.map(modelId => ({
        id: modelId,
        name: modelId,
        supportsVision: !!provider.supportsVision,
        supportsImageGen: !!provider.supportsImageGen
      }))

      const container = this.elements.modelSelectorList
      if (!container) {
        this.showErrorNotification('Error: Model selector container not found', 'error')
        return
      }
      const providerCapabilities = {
        supportsVision: provider.supportsVision,
        supportsImageGen: provider.supportsImageGen
      }

      let html = `
        <div class="model-section">
          <h4 class="model-section-title">⭐ Default Models (${defaultModels.length})</h4>
          <div class="model-grid">
            ${modelObjects.map(model => this.createModelCheckbox(model, currentSelections, providerId, providerCapabilities)).join('')}
          </div>
        </div>
      `

      html = `
        <div class="model-selector-content">
          ${html}
        </div>
      `

      container.innerHTML = html

      const headerTitle = this.elements.modelSelectorModal?.querySelector('.modal-header h3')
      if (headerTitle) headerTitle.textContent = `Select Models for ${provider.name}`

      this.showModelSelectorModal()
      this.bindModalCheckboxes(providerId, currentSelections)
      this.updateModalSelectionCount()

      this.showErrorNotification(`Loaded ${defaultModels.length} default models for ${provider.name}`)
    } catch (error) {
      console.error('[useDefaultModels] Error:', error)
      this.showErrorNotification(`Error loading default models: ${error.message}`, 'error')
    }
  }

  renderStoredModels(selections, providerId, provider) {
    if (!selections || selections.length === 0) return

    console.debug('[renderStoredModels] Rendering stored selections:', selections)

    const modelObjects = selections.map(modelId => ({
      id: modelId,
      name: modelId,
      supportsVision: !!provider.supportsVision,
      supportsImageGen: !!provider.supportsImageGen
    }))

    const container = this.elements.modelSelectorList
    const storedSection = document.createElement('div')
    storedSection.className = 'model-section stored-models-section'
    storedSection.innerHTML = `
      <h4 class="model-section-title">📦 Your Current Selections</h4>
      <div class="model-grid">
        ${modelObjects.map(model => this.createModelCheckbox(model, selections, providerId, {
          supportsVision: provider.supportsVision,
          supportsImageGen: provider.supportsImageGen
        })).join('')}
      </div>
      <p class="info-text">These models were previously selected and are still available.</p>
    `

    container.appendChild(storedSection)
    this.bindModalCheckboxes(providerId, selections)
    this.updateModalSelectionCount()
  }

  updateModalSelectionCount() {
    if (!this.elements.modelSelectorList || !this.elements.modelSelectionCount) return
    
    const checked = this.elements.modelSelectorList.querySelectorAll('input[type="checkbox"]:checked')
    this.elements.modelSelectionCount.textContent = `${checked.length} models selected`
  }

  async saveSelectedModelsFromModal() {
    const providerId = this.currentModalProviderId
    if (!providerId) return

    if (this.elements.modelSelectorList) {
      const checked = this.elements.modelSelectorList.querySelectorAll('input[type="checkbox"]:checked')
      const selectedModels = Array.from(checked).map(c => c.value)

      try {
        await ModelSelectionManager.setModels(providerId, selectedModels)
        console.debug('[saveSelectedModelsFromModal] Saved:', providerId, selectedModels)
        this.showErrorNotification('Model selections saved!')
        this.elements.modelSelectorModal?.classList.add('hidden')
      } catch (error) {
        console.error('[saveSelectedModelsFromModal] Error:', error)
        this.showErrorNotification(`Error saving models: ${error.message}`)
      }
    }
  }

  async pullModelsFromAPI() {
    const providerId = this.currentModalProviderId
    if (!providerId) {
      console.error('pullModelsFromAPI - No provider ID set')
      return
    }

    const provider = PROVIDERS[providerId]
    if (!provider) return

    console.debug('pullModelsFromAPI - Refreshing models for:', providerId)

    const container = this.elements.modelSelectorList
    const pullBtn = this.elements.pullModelsBtn

    if (pullBtn) {
      pullBtn.disabled = true
      const btnText = pullBtn.querySelector('.btn-text')
      const refreshIcon = pullBtn.querySelector('.refresh-icon')
      if (btnText) btnText.textContent = 'Refreshing...'
      if (refreshIcon) refreshIcon.classList.add('spinning')
    }

    if (container) {
      container.innerHTML = '<p class="loading-state">Refreshing models from API...</p>'
    }

    // Everything below used to start its try/catch *after* these two storage reads, so a
    // rejected getModels() (e.g. a chrome.storage error) was an unhandled promise rejection:
    // the button stayed stuck on "Refreshing..." forever and the modal stayed stuck on
    // "Refreshing models from API..." with no way for the user to tell what happened. Moving
    // the try up here — and using finally for the button reset — closes that gap.
    try {
      const currentSelections = await ModelSelectionManager.getModels(providerId)
      console.debug('pullModelsFromAPI - Current selections from storage:', currentSelections)

      const credentials = await this.getProviderCredentials(providerId)

      if (!credentials.apiKey) {
        if (container) {
          container.innerHTML = `
            <div class="error-message">
              <p>No API key configured for ${provider.name}.</p>
              <p>Please add an API key and try again.</p>
            </div>
          `
        }
        return
      }

      await chrome.runtime.sendMessage({
        type: 'CLEAR_MODEL_CACHE',
        providerId,
        baseURL: credentials.baseURL
      })

      const response = await chrome.runtime.sendMessage({
        type: 'GET_MODELS',
        providerId,
        apiKey: credentials.apiKey,
        baseURL: credentials.baseURL,
        forceRefresh: true
      })

      if (response.error) {
        if (container) {
          container.innerHTML = `
            <div class="error-message">
              <p>Failed to fetch models: ${response.error}</p>
              <p>Click "Refresh" to try again.</p>
            </div>
          `
        }
        this.showErrorNotification(`Failed to fetch models: ${response.error}`, 'error')
        return
      }

      // Same curated-list fallback as openModelSelector() — a successful-but-empty response
      // shouldn't leave the user with zero selectable models.
      let apiModels = response.models || []
      if (apiModels.length === 0) {
        apiModels = provider.models || []
      }
      const recommended = RECOMMENDED_MODELS[providerId] || []
      const providerCapabilities = {
        supportsVision: provider.supportsVision,
        supportsImageGen: provider.supportsImageGen
      }

      // validateModels expects an array of model ID strings, not the {id, name} objects
      // GET_MODELS returns — passing objects made every model fail sanitizeModelId's
      // typeof-string check, so this always reported "Model Validation Failed" regardless
      // of whether the fetched models were actually valid.
      const validation = validateModels(apiModels.map(m => m.id), providerId)

      if (!validation.isValid) {
        if (container) {
          container.innerHTML = `
            <div class="error-message">
              <p><strong>Model Validation Failed</strong></p>
              <p>${escapeHtml(validation.error)}</p>
              ${validation.errors.map(err => `<p class="error-detail">• ${escapeHtml(err.message)}</p>`).join('')}
              <div class="error-actions">
                <button id="use-default-models" class="primary-btn">Use Default Models</button>
                <button id="retry-fetch" class="secondary-btn">Retry Fetch</button>
              </div>
            </div>
          `
        }

        setTimeout(() => {
          const useDefaultBtn = document.getElementById('use-default-models')
          const retryBtn = document.getElementById('retry-fetch')
          if (useDefaultBtn) {
            useDefaultBtn.addEventListener('click', () => {
              this.useDefaultModels(providerId, provider)
            })
          }
          if (retryBtn) {
            retryBtn.addEventListener('click', () => {
              this.pullModelsFromAPI()
            })
          }
        }, 100)

        return
      }

      const validModels = validation.results
        .filter(result => result.isValid)
        .map(result => result.modelId)

      console.debug('pullModelsFromAPI - API returned', apiModels.length, 'models, validation passed:', validModels.length)

      const preservedSelections = currentSelections

      console.debug('pullModelsFromAPI - Current selections to show:', preservedSelections)

      let html = ''

      const recommendedModels = apiModels.filter(m => recommended.includes(m.id))
      if (recommendedModels.length > 0) {
        html += `
          <div class="model-section">
            <h4 class="model-section-title">⭐ Recommended</h4>
            <div class="model-grid">
              ${recommendedModels.map(model => this.createModelCheckbox(model, preservedSelections, providerId, providerCapabilities)).join('')}
            </div>
          </div>
        `
      }

      const otherModels = apiModels.filter(m => !recommended.includes(m.id))
      if (otherModels.length > 0) {
        html += `
          <div class="model-section">
            <h4 class="model-section-title">📋 All Models (${otherModels.length})</h4>
            <div class="model-grid all-models-grid">
              ${otherModels.map(model => this.createModelCheckbox(model, preservedSelections, providerId, providerCapabilities)).join('')}
            </div>
          </div>
        `
      }

      if (apiModels.length === 0) {
        html = `
          <div class="error-message">
            <p>No models returned from API.</p>
            <p>Click "Refresh" to try again.</p>
          </div>
        `
      } else {
        html = `
          <div class="model-selector-content">
            ${html}
          </div>
        `
      }

      if (container) {
        container.innerHTML = html
      }

      const headerTitle = this.elements.modelSelectorModal?.querySelector('.modal-header h3')
      if (headerTitle) headerTitle.textContent = `Select Models for ${provider.name}`

      this.bindModalCheckboxes(providerId, preservedSelections)
      this.updateModalSelectionCount()

      console.debug('pullModelsFromAPI - Refreshed, found', apiModels.length, 'models, preserved selections:', preservedSelections)

    } catch (error) {
      console.error('pullModelsFromAPI - Error:', error)
      if (container) {
        container.innerHTML = `
          <div class="error-message">
            <p>Error refreshing models: ${error.message}</p>
            <p>Click "Refresh" to try again.</p>
          </div>
        `
      }
      this.showErrorNotification(`Error refreshing models: ${error.message}`, 'error')
    } finally {
      // finally (not code after the try/catch) so the button is re-enabled on every exit
      // path — including the early `return`s inside the try block above. Previously those
      // returns each needed their own duplicated reset, and it was easy (and, in the
      // no-credentials branch, already the case after an earlier pass) to add a new early
      // return without remembering to reset the button, leaving it stuck on "Refreshing...".
      if (pullBtn) {
        pullBtn.disabled = false
        const btnText = pullBtn.querySelector('.btn-text')
        const refreshIcon = pullBtn.querySelector('.refresh-icon')
        if (btnText) btnText.textContent = 'Refresh'
        if (refreshIcon) refreshIcon.classList.remove('spinning')
      }
    }
  }

  async clearHistory() {
    const ok = await this.confirmDialog('Are you sure you want to clear all chat history?', 'Clear History')
    if (!ok) return
    
    try {
      await this.storage.set({ [STORAGE_KEYS.CHAT_HISTORY]: [] })
      this.showErrorNotification('Chat history cleared!')
    } catch (error) {
      this.showErrorNotification(`Error clearing history: ${error.message}`)
    }
  }

  async exportSettings() {
    try {
      const keys = [
        STORAGE_KEYS.API_KEY, STORAGE_KEYS.API_BASE_URL, STORAGE_KEYS.MODEL,
        STORAGE_KEYS.SETTINGS, STORAGE_KEYS.CHAT_HISTORY, STORAGE_KEYS.USER_PREFERENCES,
        STORAGE_KEYS.PROVIDER_CONFIG, STORAGE_KEYS.PROVIDER_CREDENTIALS,
        STORAGE_KEYS.ENABLED_MODELS, STORAGE_KEYS.AGENT_PRESETS,
        'mcp_connections', 'conversations'
      ]
      const promises = keys.map(k => this.storage.get(k))
      const values = await Promise.all(promises)
      const data = {}
      keys.forEach((k, i) => { data[k] = values[i] })
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ai-chat-settings-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      this.showErrorNotification(`Error exporting settings: ${error.message}`)
    }
  }

  async loadPresets() {
    try {
      const presets = await this.storage.get(STORAGE_KEYS.AGENT_PRESETS) || []
      this.presets = presets

      const select = this.elements.presetSelect
      const empty = this.elements.presetEmpty
      if (!select) return

      // Rebuild options
      select.innerHTML = '<option value="">— Select a saved agent —</option>'
      for (const preset of presets) {
        const opt = document.createElement('option')
        opt.value = preset.id
        opt.textContent = preset.name || 'Unnamed Agent'
        select.appendChild(opt)
      }

      if (empty) empty.style.display = presets.length ? 'none' : ''
      this.setPresetEditorState(false)
      this.elements.presetLoad.disabled = presets.length === 0
    } catch (error) {
      console.error('Failed to load presets:', error)
    }
  }

  setPresetEditorState(enabled) {
    const { presetNameEdit, presetPromptEdit, presetSaveChanges, presetDelete } = this.elements
    if (presetNameEdit) presetNameEdit.disabled = !enabled
    if (presetPromptEdit) presetPromptEdit.disabled = !enabled
    if (presetSaveChanges) presetSaveChanges.disabled = !enabled
    if (presetDelete) presetDelete.disabled = !enabled
  }

  onPresetSelected() {
    const id = this.elements.presetSelect?.value
    const preset = (this.presets || []).find(p => p.id === id)
    if (!preset) {
      this.setPresetEditorState(false)
      return
    }
    this.elements.presetNameEdit.value = preset.name || ''
    this.elements.presetPromptEdit.value = preset.systemPrompt || ''
    this.setPresetEditorState(true)
  }

  async loadPresetAsSystemPrompt() {
    const id = this.elements.presetSelect?.value
    const preset = (this.presets || []).find(p => p.id === id)
    if (!preset) {
      this.showErrorNotification('Select a saved agent first.')
      return
    }
    if (this.elements.systemPrompt) {
      this.elements.systemPrompt.value = preset.systemPrompt || ''
    }
    this.showErrorNotification(`Agent "${preset.name}" loaded as system prompt. Click Save Settings to apply.`, 'success')
  }

  async savePresetChanges() {
    const id = this.elements.presetSelect?.value
    const name = this.elements.presetNameEdit?.value.trim()
    const prompt = this.elements.presetPromptEdit?.value.trim()
    if (!prompt) {
      this.showErrorNotification('System prompt cannot be empty.')
      return
    }
    const presets = [...(this.presets || [])]
    const idx = presets.findIndex(p => p.id === id)
    if (idx === -1) return
    presets[idx] = { ...presets[idx], name: name || 'Unnamed Agent', systemPrompt: prompt, updatedAt: Date.now() }
    await this.storage.set({ agent_presets: presets })
    this.presets = presets
    this.showErrorNotification('Agent preset updated.')
    this.loadPresets()
  }

  async deleteSelectedPreset() {
    const id = this.elements.presetSelect?.value
    const preset = (this.presets || []).find(p => p.id === id)
    if (!preset) return
    if (!window.confirm(`Delete agent "${preset.name}"?`)) return
    const presets = (this.presets || []).filter(p => p.id !== id)
    await this.storage.set({ agent_presets: presets })
    this.presets = presets
    this.showErrorNotification('Agent preset deleted.')
    this.loadPresets()
  }

  async importSettings(event) {
    const file = event.target.files[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await this.storage.set(data)
      this.showErrorNotification('Settings imported successfully!')
      this.loadSettings()
    } catch (error) {
      this.showErrorNotification(`Error importing settings: ${error.message}`)
    }
    
    event.target.value = ''
  }

  async saveSettings() {
    try {
      const settings = {
        temperature: parseFloat(this.elements.temperature?.value) || 0.7,
        maxTokens: parseInt(this.elements.maxTokens?.value) || 2000,
        systemPrompt: this.elements.systemPrompt?.value || '',
        streaming: this.elements.streaming?.checked ?? true,
        includePageContent: this.elements.includePageContent?.checked ?? false,
        contextLength: parseInt(this.elements.contextLength?.value) || 4000,
        memoryEnabled: this.elements.memoryEnabled?.checked ?? true,
        theme: this.elements.theme?.value || 'system',
        density: this.elements.densityCompact?.checked ? 'compact' : 'comfortable',
        autoScroll: this.elements.autoScroll?.checked ?? true,
        showTimestamps: this.elements.showTimestamps?.checked ?? true,
        panelWidth: parseInt(this.elements.panelWidth?.value) || 400,
        customLogo: this.customLogoData
      }

      // Merge with existing settings so keys the options form doesn't own
      // (webSearchEnabled, autoAttachEnabled, etc.) are preserved instead of
      // being silently wiped by a raw replace.
      const existingResult = await this.storage.get(STORAGE_KEYS.SETTINGS)
      const merged = { ...(existingResult[STORAGE_KEYS.SETTINGS] || {}), ...settings }

      await this.storage.set({ [STORAGE_KEYS.SETTINGS]: merged })
      this.showErrorNotification('Settings saved!')
    } catch (error) {
      this.showErrorNotification(`Error saving settings: ${error.message}`)
    }
  }

  static escapeHtml(text) {
    const safe = text == null ? '' : String(text)
    const div = document.createElement('div')
    div.textContent = safe
    return div.innerHTML
  }

  showErrorNotification(message, type = 'error') {
    console.debug('[Notification]', type, message)
    
    // Remove existing notification
    const existing = document.getElementById('error-notification')
    if (existing) {
      existing.remove()
    }

    // Create notification element
    const notification = document.createElement('div')
    notification.id = 'error-notification'
    // Screen-reader announcement: errors/warnings are assertive (interrupt immediately),
    // success/info are polite (announced without interrupting current speech).
    notification.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status')
    notification.setAttribute('aria-live', type === 'error' || type === 'warning' ? 'assertive' : 'polite')
    notification.setAttribute('aria-atomic', 'true')

    // Determine color based on type
    let bgColor, textColor, icon
    switch (type) {
      case 'success':
        bgColor = '#10b981'
        textColor = 'white'
        icon = '✓'
        break
      case 'warning':
        bgColor = '#f59e0b'
        textColor = 'white'
        icon = '⚠'
        break
      case 'info':
        bgColor = '#3b82f6'
        textColor = 'white'
        icon = 'ℹ'
        break
      default: // error
        bgColor = '#ef4444'
        textColor = 'white'
        icon = '✗'
    }

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: ${textColor};
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      max-width: 400px;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 12px;
      animation: slideIn 0.3s ease-out;
    `

    notification.innerHTML = `
      <span style="font-size: 18px;">${icon}</span>
      <span>${OptionsPage.escapeHtml(message)}</span>
    `

    // Add animation keyframes if not exists
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style')
      style.id = 'notification-styles'
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `
      document.head.appendChild(style)
    }

    document.body.appendChild(notification)

    // Auto-hide after 4 seconds
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.style.animation = 'slideOut 0.3s ease-in'
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove()
          }
        }, 300)
      }
    }, 4000)
  }

  /**
   * Promise-based confirm dialog (replaces window.confirm in options page)
   * @param {string} message - Confirm prompt text
   * @param {string} [title='Confirm'] - Modal title
   * @returns {Promise<boolean>}
   */
  confirmDialog(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const existing = document.getElementById('confirm-modal')
      if (existing) existing.remove()

      const modal = document.createElement('div')
      modal.id = 'confirm-modal'
      modal.className = 'modal'
      modal.innerHTML = `
        <div class="modal-backdrop" data-close="confirm-modal"></div>
        <div class="modal-content" style="max-width:360px;width:90%;text-align:center;padding:24px;">
          <h3 style="margin:0 0 8px;font-size:16px;">${OptionsPage.escapeHtml(title)}</h3>
          <p style="color:var(--text-secondary);margin:0 0 20px;font-size:14px;">${OptionsPage.escapeHtml(message)}</p>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button class="btn btn-secondary" data-close="confirm-modal">Cancel</button>
            <button class="btn btn-primary" id="confirm-ok">Confirm</button>
          </div>
        </div>`
      document.body.appendChild(modal)
      modal.style.display = 'flex'

      const okBtn = modal.querySelector('#confirm-ok')
      const cleanup = (result) => {
        modal.remove()
        resolve(result)
      }
      okBtn.addEventListener('click', () => cleanup(true))
      modal.addEventListener('click', (e) => {
        if (e.target.closest('[data-close="confirm-modal"]') ||
            e.target === modal.querySelector('.modal-backdrop')) {
          cleanup(false)
        }
      })
      document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', onKey)
          cleanup(false)
        }
      })
    })
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    console.debug('DOMContentLoaded - Creating OptionsPage')
    const optionsPage = new OptionsPage()
    window.optionsPage = optionsPage
    console.debug('DOMContentLoaded - OptionsPage created successfully', optionsPage)

    // Sidebar active-section tracking
    setupSidebarScrollSpy()
  } catch (error) {
    console.error('DOMContentLoaded - Error creating OptionsPage:', error)
  }
})

function setupSidebarScrollSpy() {
  const sidebarLinks = document.querySelectorAll('.sidebar-nav-link')
  const sections = []
  for (const link of sidebarLinks) {
    const id = link.getAttribute('href')
    if (!id || !id.startsWith('#')) continue
    const el = document.querySelector(id)
    if (el) sections.push({ link, el })
  }
  if (sections.length === 0) return

  const content = document.querySelector('.settings-content')
  if (!content) return

  const updateActive = () => {
    const scrollTop = content.scrollTop + 80
    let active = sections[0]
    for (const s of sections) {
      if (s.el.offsetTop <= scrollTop) active = s
    }
    for (const s of sections) {
      s.link.classList.toggle('active', s === active)
    }
  }

  content.addEventListener('scroll', updateActive, { passive: true })
  updateActive()

  // Smooth-scroll sidebar links inside the content area
  for (const s of sections) {
    s.link.addEventListener('click', (e) => {
      e.preventDefault()
      content.scrollTo({ top: s.el.offsetTop - 24, behavior: 'smooth' })
    })
  }
}

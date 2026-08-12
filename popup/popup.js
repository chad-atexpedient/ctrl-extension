(function () {
  'use strict'

  document.addEventListener('DOMContentLoaded', init)

  let toastTimer = null
  let conversationHistory = []
  let isProcessing = false

  function showToast(message, variant = 'error', duration = 4000) {
    const toast = document.getElementById('popup-toast')
    if (!toast) return
    clearTimeout(toastTimer)
    toast.textContent = message
    toast.className = `toast toast-${variant}`
    toast.classList.remove('hidden')
    if (duration > 0) {
      toastTimer = setTimeout(() => toast.classList.add('hidden'), duration)
    }
  }

  async function init() {
    const elements = cacheElements()
    await loadTheme()
    await loadCustomLogo()
    await checkAPIKey(elements)
    bindEvents(elements)
  }

  async function loadTheme() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' })
      const theme = response?.settings?.theme || 'system'
      if (theme === 'system') {
        document.documentElement.removeAttribute('data-theme')
      } else {
        document.documentElement.setAttribute('data-theme', theme)
      }
    } catch (e) {
      console.error('Failed to load theme:', e)
    }
  }

  async function loadCustomLogo() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' })
      if (response?.settings?.customLogo) {
        const img = document.getElementById('popup-logo')
        if (img) {
          img.src = response.settings.customLogo
          img.style.display = ''
        }
      }
    } catch (e) {
      console.error('Failed to load custom logo:', e)
    }
  }

  function cacheElements() {
    return {
      statusBadge: document.getElementById('status-badge'),
      noAPIKey: document.getElementById('no-api-key'),
      mainContent: document.getElementById('main-content'),
      setupBtn: document.getElementById('setup-btn'),
      openPanel: document.getElementById('open-panel'),
      quickPrompt: document.getElementById('quick-prompt'),
      sendQuick: document.getElementById('send-quick'),
      resultArea: document.getElementById('result-area'),
      resultContent: document.getElementById('result-content'),
      resultLabel: document.getElementById('result-label'),
      resultCopy: document.getElementById('result-copy'),
      resultExpand: document.getElementById('result-expand'),
      loadingArea: document.getElementById('loading-area'),
      loadingText: document.getElementById('loading-text'),
      followupInput: document.getElementById('followup-input'),
      followupSend: document.getElementById('followup-send'),
      quickActions: document.getElementById('quick-actions'),
      quickInputArea: document.getElementById('quick-input-area'),
    }
  }

  async function checkAPIKey(elements) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' })
      if (!response || !response.hasAPIKey) {
        elements.statusBadge.textContent = 'Setup Required'
        elements.statusBadge.classList.add('warning')
        elements.noAPIKey.classList.remove('hidden')
        elements.mainContent.classList.add('hidden')
      } else {
        elements.statusBadge.textContent = 'Ready'
        elements.statusBadge.classList.remove('warning')
        elements.noAPIKey.classList.add('hidden')
        elements.mainContent.classList.remove('hidden')
      }
    } catch (error) {
      console.error('Failed to check API key:', error)
      elements.statusBadge.textContent = 'Error'
      elements.statusBadge.classList.add('warning')
    }
  }

  function bindEvents(elements) {
    elements.setupBtn.addEventListener('click', openSettings)
    elements.openPanel.addEventListener('click', openSidePanel)

    elements.sendQuick.addEventListener('click', () => {
      const prompt = elements.quickPrompt.value.trim()
      if (prompt) processQuery(elements, prompt)
    })

    elements.quickPrompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const prompt = elements.quickPrompt.value.trim()
        if (prompt) processQuery(elements, prompt)
      }
    })

    elements.followupSend.addEventListener('click', () => {
      const prompt = elements.followupInput.value.trim()
      if (prompt) processQuery(elements, prompt, true)
    })

    elements.followupInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const prompt = elements.followupInput.value.trim()
        if (prompt) processQuery(elements, prompt, true)
      }
    })

    elements.resultCopy.addEventListener('click', () => {
      const text = elements.resultContent.textContent
      navigator.clipboard.writeText(text).then(() => {
        showToast('Copied!', 'success', 2000)
      })
    })

    elements.resultExpand.addEventListener('click', async () => {
      const lastResponse = elements.resultContent.textContent
      await chrome.storage.local.set({
        pending_quick_prompt: elements.followupInput.value.trim() || null,
        pending_conversation: conversationHistory
      })
      openSidePanel()
    })

    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        handleQuickAction(elements, btn.dataset.action, btn)
      })
    })
  }

  async function getPageContext() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tab = tabs[0]
      if (!tab) return ''
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CONTEXT' })
      return response?.text || ''
    } catch {
      return ''
    }
  }

  async function handleQuickAction(elements, action, btn) {
    if (isProcessing) return

    const prompts = {
      summarize: 'Summarize the following content concisely:',
      explain: 'Explain this code or text in simple terms:',
      context: 'What is this page about? Give me a quick overview.',
      translate: 'Translate the following text to English:',
    }

    // Visual feedback — flash the button
    if (btn) {
      btn.classList.add('active')
      setTimeout(() => btn.classList.remove('active'), 300)
    }

    elements.loadingText.textContent = action === 'summarize' ? 'Summarizing...' :
      action === 'explain' ? 'Explaining...' :
      action === 'translate' ? 'Translating...' : 'Analyzing...'

    const context = await getPageContext()
    const prompt = prompts[action] + (context ? '\n\n' + context.substring(0, 3000) : '')

    elements.resultLabel.textContent = action.charAt(0).toUpperCase() + action.slice(1)
    conversationHistory = []
    processQuery(elements, prompt, false, true)
  }

  async function processQuery(elements, prompt, isFollowup = false, isAction = false) {
    if (isProcessing) return
    isProcessing = true

    // Hide quick actions/input, show loading
    elements.quickActions.classList.add('hidden')
    elements.quickInputArea.classList.add('hidden')
    elements.resultArea.classList.add('hidden')
    elements.loadingArea.classList.remove('hidden')

    // Build conversation context
    const messages = [...conversationHistory]
    messages.push({ role: 'user', content: prompt })

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEND_CHAT',
        content: prompt,
        mode: 'smart',
        history: conversationHistory.length > 0 ? conversationHistory : undefined,
      })

      elements.loadingArea.classList.add('hidden')

      if (response?.error) {
        // Show error inline
        const errText = typeof response.error === 'string' ? response.error : String(response.error || 'Unknown error')
        elements.resultContent.innerHTML = `<div class="result-error">${escapeHtml(errText)}</div>`
        elements.resultLabel.textContent = 'Error'
        elements.resultArea.classList.remove('hidden')
        showToast(errText, 'error', 5000)
      } else if (response?.message) {
        // Update conversation history
        conversationHistory.push({ role: 'user', content: prompt })
        conversationHistory.push({ role: 'assistant', content: response.message })

        // Render markdown
        const msg = typeof response.message === 'string' ? response.message : String(response.message || '')
        let html
        if (window.marked && window.DOMPurify) {
          html = DOMPurify.sanitize(window.marked.parse(msg))
        } else if (window.marked) {
          html = window.marked.parse(msg)
        } else {
          html = escapeHtml(msg)
        }
        elements.resultContent.innerHTML = html
        if (!isAction) elements.resultLabel.textContent = 'Response'
        elements.resultArea.classList.remove('hidden')

        // Show follow-up input
        elements.followupInput.value = ''
        elements.followupInput.focus()
      }
    } catch (error) {
      elements.loadingArea.classList.add('hidden')
      elements.resultContent.innerHTML = `<div class="result-error">Failed to get response. Opening panel...</div>`
      elements.resultArea.classList.remove('hidden')

      // Fallback: open side panel with the prompt
      await chrome.storage.local.set({ pending_quick_prompt: prompt })
      setTimeout(() => openSidePanel(), 1000)
    } finally {
      isProcessing = false
    }
  }

  function escapeHtml(text) {
    const safe = text == null ? '' : String(text)
    const div = document.createElement('div')
    div.textContent = safe
    return div.innerHTML
  }

  async function openSidePanel() {
    try {
      if (chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
      } else if (chrome.sidebarAction?.open) {
        // Firefox sidebar target.
        await chrome.sidebarAction.open()
      } else {
        // Safari and other WebExtension hosts without a sidebar get a usable
        // full-page fallback instead of a dead popup button.
        await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel/sidepanel.html') })
      }
      window.close()
    } catch (error) {
      console.error('Failed to open side panel:', error)
      showToast('Could not open the chat panel.', 'error')
    }
  }

  function openSettings() {
    try {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage()
      } else {
        window.open('options/options.html')
      }
      window.close()
    } catch (error) {
      showToast('Could not open settings.', 'error')
    }
  }
})()

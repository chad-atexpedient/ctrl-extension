import { requestProviderOriginPermission } from '../utils/host-permissions.js'

/**
 * Onboarding Wizard
 * 
 * Multi-step setup wizard for first-time users.
 * Steps: Welcome → Choose Provider → Enter API Key → Pick Theme → Quick Tour
 * Not forced — accessible anytime via /tour command or settings.
 */

const WIZARD_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to CTRL',
    icon: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="4" y="8" width="40" height="28" rx="3" ry="3" fill="currentColor" opacity="0.15"/>
      <rect x="4" y="8" width="40" height="28" rx="3" ry="3"/>
      <rect x="7" y="11" width="34" height="16" fill="currentColor" opacity="0.25"/>
      <circle cx="24" cy="34" r="2" fill="currentColor"/>
    </svg>`,
    content: `
      <h2>Welcome to CTRL Extension</h2>
      <p>Your AI-powered browser assistant with code execution, presentations, data analysis, and browser automation.</p>
      <div class="wizard-features">
        <div class="wizard-feature">
          <span class="wizard-feature-icon">💬</span>
          <span>Chat with AI on any page</span>
        </div>
        <div class="wizard-feature">
          <span class="wizard-feature-icon">💻</span>
          <span>Generate and run code</span>
        </div>
        <div class="wizard-feature">
          <span class="wizard-feature-icon">🖥️</span>
          <span>Browser automation agent</span>
        </div>
        <div class="wizard-feature">
          <span class="wizard-feature-icon">📊</span>
          <span>Slides, data, and research</span>
        </div>
      </div>
    `
  },
  {
    id: 'provider',
    title: 'Choose Provider',
    icon: '🤖',
    content: `
      <h2>Choose Your AI Provider</h2>
      <p>Select the provider you have an API key for. You can add more later.</p>
      <div class="wizard-provider-grid" id="wizard-provider-grid" role="group" aria-label="AI provider">
        <button class="wizard-provider-card" data-provider="openai" aria-pressed="false">
          <span class="wizard-provider-name">OpenAI</span>
          <span class="wizard-provider-models">GPT-5o, GPT-4o, o1</span>
        </button>
        <button class="wizard-provider-card" data-provider="anthropic" aria-pressed="false">
          <span class="wizard-provider-name">Anthropic</span>
          <span class="wizard-provider-models">Claude 4.5, Claude 4</span>
        </button>
        <button class="wizard-provider-card" data-provider="google" aria-pressed="false">
          <span class="wizard-provider-name">Google Gemini</span>
          <span class="wizard-provider-models">Gemini 2.5, 2.0, 1.5</span>
        </button>
        <button class="wizard-provider-card" data-provider="deepseek" aria-pressed="false">
          <span class="wizard-provider-name">DeepSeek</span>
          <span class="wizard-provider-models">DeepSeek V3, R1</span>
        </button>
        <button class="wizard-provider-card" data-provider="groq" aria-pressed="false">
          <span class="wizard-provider-name">Groq</span>
          <span class="wizard-provider-models">Mixtral, Llama</span>
        </button>
        <button class="wizard-provider-card" data-provider="openrouter" aria-pressed="false">
          <span class="wizard-provider-name">OpenRouter</span>
          <span class="wizard-provider-models">Multi-provider</span>
        </button>
      </div>
    `
  },
  {
    id: 'apikey',
    title: 'Enter API Key',
    icon: '🔑',
    content: `
      <h2>Enter Your API Key</h2>
      <p>Your key is stored locally and never sent anywhere except the provider's API.</p>
      <div class="wizard-apikey-form">
        <div class="wizard-field">
          <label for="wizard-api-key">API Key</label>
          <div class="wizard-input-wrapper">
            <input type="password" id="wizard-api-key" placeholder="sk-..." autocomplete="off" aria-describedby="wizard-key-help">
            <button class="wizard-toggle-vis" id="wizard-toggle-vis" type="button" aria-label="Show API key" aria-pressed="false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
          </div>
          <p class="wizard-help" id="wizard-key-help">Enter your API key from the provider's dashboard</p>
        </div>
        <div class="wizard-field" id="wizard-baseurl-field" style="display:none">
          <label for="wizard-base-url">Base URL (optional)</label>
          <input type="url" id="wizard-base-url" placeholder="https://api.example.com/v1">
        </div>
        <div class="wizard-test-result" id="wizard-test-result" role="status" aria-live="polite"></div>
        <button class="btn btn-secondary" id="wizard-test-btn">Test Connection</button>
      </div>
    `
  },
  {
    id: 'theme',
    title: 'Pick a Theme',
    icon: '🎨',
    content: `
      <h2>Choose Your Theme</h2>
      <p>Pick a theme that suits your style. You can change this anytime in settings.</p>
      <div class="wizard-theme-grid" id="wizard-theme-grid" role="group" aria-label="Theme"></div>
    `
  },
  {
    id: 'complete',
    title: 'All Set!',
    icon: '🎉',
    content: `
      <h2>You're All Set!</h2>
      <p>CTRL is ready to use. Here are some things you can try:</p>
      <div class="wizard-tips">
        <div class="wizard-tip">
          <code>/slides</code> — Generate a presentation
        </div>
        <div class="wizard-tip">
          <code>/data</code> — Analyze CSV/Excel data
        </div>
        <div class="wizard-tip">
          <code>/mvp</code> — Build a website
        </div>
        <div class="wizard-tip">
          <code>/code</code> — Generate and run code
        </div>
        <div class="wizard-tip">
          <code>Ctrl+K</code> — Open command palette
        </div>
        <div class="wizard-tip">
          <code>Ctrl+Shift+S</code> — Toggle conversation sidebar
        </div>
      </div>
      <p class="wizard-note">Type <code>/help</code> anytime to see all commands.</p>
    `
  }
]

// Real per-theme palette swatches, sourced from styles/themes.css and
// styles/variables.css (bg-primary/bg-secondary/accent-primary/accent-secondary)
// so the picker shows each theme's actual colors instead of a generic gradient.
const THEME_PALETTES = {
  system: { bg: '#ffffff', bg2: '#f9fafb', accent: '#0f172a', accent2: '#334155', label: 'System' },
  dark: { bg: '#0f111a', bg2: '#161822', accent: '#e2e8f0', accent2: '#cbd5e1', label: 'Dark' },
  blue: { bg: '#f8fafc', bg2: '#eff6ff', accent: '#2563eb', accent2: '#3b82f6', label: 'Tech Blue' },
  purple: { bg: '#faf5ff', bg2: '#f3e8ff', accent: '#7c3aed', accent2: '#8b5cf6', label: 'Creative Purple' },
  nebula: { bg: '#020617', bg2: '#0f172a', accent: '#22d3ee', accent2: '#67e8f9', label: 'Midnight Nebula' },
  cyberpunk: { bg: '#09090b', bg2: '#18181b', accent: '#f0abfc', accent2: '#d8b4fe', label: 'Cyberpunk' },
  blossom: { bg: '#fff1f2', bg2: '#fce7f3', accent: '#db2777', accent2: '#f43f5e', label: 'Cherry Blossom' },
  terminal: { bg: '#000000', bg2: '#050505', accent: '#4ade80', accent2: '#86efac', label: 'Terminal' }
}

export class OnboardingWizard {
  constructor(options = {}) {
    this.overlay = null
    this.currentStep = 0
    this.selectedProvider = null
    this.selectedTheme = null
    this.onComplete = options.onComplete || (() => {})
    // Optional host-provided error surface (e.g. ChatUI#showNotification).
    // Falls back to a minimal self-contained toast so onboarding.js stays
    // functional even when used standalone.
    this.onError = typeof options.onError === 'function' ? options.onError : null
    this.isFirstRun = false
    this._elementBeforeOpen = null
    this._trapKeydownHandler = null
  }

  async init() {
    // Check if first run
    try {
      const result = await chrome.storage.local.get(['user_preferences'])
      const prefs = result.user_preferences || {}
      this.isFirstRun = prefs.firstRun === true || prefs.onboardingComplete !== true
    } catch (e) {
      console.error('[Onboarding] Failed to read first-run state:', e)
      this.isFirstRun = false
    }

    this.overlay = document.getElementById('onboarding-overlay')
    if (!this.overlay) {
      this.overlay = document.createElement('div')
      this.overlay.id = 'onboarding-overlay'
      this.overlay.className = 'onboarding-overlay hidden'
      document.body.appendChild(this.overlay)
    }

    // Focus-trap + Escape-to-close, bound once — overlay persists across
    // renderStep() calls, only its innerHTML is replaced.
    this._trapKeydownHandler = (e) => this._handleOverlayKeydown(e)
    this.overlay.addEventListener('keydown', this._trapKeydownHandler)

    // Show automatically on first run
    if (this.isFirstRun) {
      setTimeout(() => this.show(), 500)
    }
  }

  show(startStep = 0) {
    this.currentStep = startStep
    // Remember what had focus so we can restore it when the wizard closes.
    this._elementBeforeOpen = document.activeElement
    this.overlay.classList.remove('hidden')
    this.renderStep()
  }

  /** Escapes text for safe insertion into HTML element bodies. */
  escapeText(text) {
    const safe = text == null ? '' : String(text)
    const div = document.createElement('div')
    div.textContent = safe
    return div.innerHTML
  }

  /** Escapes a string for safe use inside an HTML attribute (double-quoted). */
  escapeAttr(text) {
    return this.escapeText(text).replace(/"/g, '&quot;')
  }

  hide() {
    this.overlay.classList.add('hidden')
    if (this._elementBeforeOpen && typeof this._elementBeforeOpen.focus === 'function') {
      this._elementBeforeOpen.focus()
    }
    this._elementBeforeOpen = null
    this.markComplete()
  }

  async markComplete() {
    try {
      const result = await chrome.storage.local.get(['user_preferences'])
      const prefs = result.user_preferences || {}
      prefs.firstRun = false
      prefs.onboardingComplete = true
      await chrome.storage.local.set({ user_preferences: prefs })
    } catch (e) {
      console.error('[Onboarding] Failed to save onboarding-complete state:', e)
      this._showError('Could not save your setup progress. The welcome tour may reappear next time.')
    }
  }

  /**
   * Surface an error to the user. Prefers the host app's own notification
   * system (passed in as options.onError) and falls back to a minimal
   * self-contained toast styled to match the extension's error color tokens.
   */
  _showError(message) {
    console.error('[Onboarding]', message)
    if (this.onError) {
      try {
        this.onError(message)
        return
      } catch (e) {
        console.error('[Onboarding] onError callback threw:', e)
      }
    }
    this._fallbackToast(message)
  }

  _fallbackToast(message) {
    let toast = document.getElementById('onboarding-fallback-toast')
    if (!toast) {
      toast = document.createElement('div')
      toast.id = 'onboarding-fallback-toast'
      toast.setAttribute('role', 'alert')
      toast.setAttribute('aria-live', 'assertive')
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        max-width: 320px;
        padding: 10px 16px;
        border-radius: var(--radius-md, 8px);
        background: var(--color-error, #ef4444);
        color: var(--text-inverted, #ffffff);
        font-size: 13px;
        font-weight: 500;
        box-shadow: var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.25));
        z-index: 10000;
        text-align: center;
      `
      document.body.appendChild(toast)
    }
    toast.textContent = message
    toast.style.display = 'block'
    clearTimeout(this._fallbackToastTimer)
    this._fallbackToastTimer = setTimeout(() => {
      toast.style.display = 'none'
    }, 5000)
  }

  /** Focus trap (Tab/Shift+Tab) + Escape-to-close for the modal wizard. */
  _handleOverlayKeydown(e) {
    if (this.overlay.classList.contains('hidden')) return

    if (e.key === 'Escape') {
      e.preventDefault()
      this.hide()
      return
    }

    if (e.key !== 'Tab') return

    const focusable = this.overlay.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  /** Move focus to the first interactive element of the current step (or its heading if none). */
  _focusStepStart() {
    const content = this.overlay.querySelector('.onboarding-content')
    if (!content) return
    let target = content.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    )
    if (!target) {
      target = content.querySelector('h2')
      if (target) target.setAttribute('tabindex', '-1')
    }
    if (target) target.focus({ preventScroll: true })
  }

  renderStep() {
    const step = WIZARD_STEPS[this.currentStep]
    if (!step) return

    const isFirst = this.currentStep === 0
    const isLast = this.currentStep === WIZARD_STEPS.length - 1
    const progress = ((this.currentStep + 1) / WIZARD_STEPS.length) * 100

    this.overlay.innerHTML = `
      <div class="onboarding-backdrop"></div>
      <div class="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-step-heading">
        <div class="onboarding-progress" role="progressbar" aria-valuenow="${this.currentStep + 1}" aria-valuemin="1" aria-valuemax="${WIZARD_STEPS.length}" aria-label="Setup progress: step ${this.currentStep + 1} of ${WIZARD_STEPS.length}, ${this.escapeAttr(step.title)}">
          <div class="onboarding-progress-bar" style="width: ${progress}%"></div>
        </div>
        <div class="onboarding-progress-dots" aria-hidden="true" style="display:flex; justify-content:space-between; gap:4px; margin-top:8px;">
          ${WIZARD_STEPS.map((s, i) => {
            const isActive = i === this.currentStep
            const isComplete = i < this.currentStep
            const dotColor = isActive || isComplete ? 'var(--accent-primary, #2563eb)' : 'var(--border-primary, #cbd5e1)'
            return `
              <div class="onboarding-progress-dot ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}" title="${this.escapeAttr(s.title)}" style="display:flex; flex-direction:column; align-items:center; flex:1; min-width:0;">
                <span class="onboarding-progress-dot-marker" style="width:${isActive ? 10 : 7}px; height:${isActive ? 10 : 7}px; border-radius:50%; background:${dotColor}; transition:all .15s ease;"></span>
                <span class="onboarding-progress-dot-label" style="font-size:10px; margin-top:4px; color:${isActive ? 'var(--text-primary, #111827)' : 'var(--text-muted, #94a3b8)'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; font-weight:${isActive ? '600' : '400'};">${this.escapeText(s.title)}</span>
              </div>
            `
          }).join('')}
        </div>
        <div aria-live="polite" style="position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;">Step ${this.currentStep + 1} of ${WIZARD_STEPS.length}: ${this.escapeText(step.title)}</div>
        <div class="onboarding-content">
          ${step.content}
        </div>
        <div class="onboarding-actions">
          ${isFirst ? '<button class="btn btn-ghost" id="onboarding-skip">Skip Setup</button>' : '<span></span>'}
          <div class="onboarding-nav">
            ${!isFirst ? '<button class="btn btn-secondary" id="onboarding-back">Back</button>' : ''}
            <button class="btn btn-primary" id="onboarding-next">${isLast ? 'Get Started' : 'Next'}</button>
          </div>
        </div>
      </div>
    `

    // Wire the heading up for aria-labelledby (content is raw HTML per step).
    const heading = this.overlay.querySelector('.onboarding-content h2')
    if (heading) heading.id = 'onboarding-step-heading'

    // Bind events
    const skipBtn = document.getElementById('onboarding-skip')
    const backBtn = document.getElementById('onboarding-back')
    const nextBtn = document.getElementById('onboarding-next')

    if (skipBtn) {
      skipBtn.addEventListener('click', () => this.hide())
    }

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.currentStep--
        this.renderStep()
      })
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (isLast) {
          this.hide()
          this.onComplete()
        } else {
          this.currentStep++
          this.renderStep()
        }
      })
    }

    // Step-specific bindings
    if (step.id === 'provider') this.bindProviderStep()
    if (step.id === 'apikey') this.bindApiKeyStep()
    if (step.id === 'theme') this.bindThemeStep()

    // Move focus into the new step so keyboard/SR users land somewhere sensible.
    this._focusStepStart()
  }

  bindProviderStep() {
    document.querySelectorAll('.wizard-provider-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.wizard-provider-card').forEach(c => {
          c.classList.remove('selected')
          c.setAttribute('aria-pressed', 'false')
        })
        card.classList.add('selected')
        card.setAttribute('aria-pressed', 'true')
        this.selectedProvider = card.dataset.provider
      })
    })
  }

  bindApiKeyStep() {
    const toggleBtn = document.getElementById('wizard-toggle-vis')
    const keyInput = document.getElementById('wizard-api-key')
    const testBtn = document.getElementById('wizard-test-btn')
    const testResult = document.getElementById('wizard-test-result')

    if (toggleBtn && keyInput) {
      toggleBtn.addEventListener('click', () => {
        const showing = keyInput.type === 'password'
        keyInput.type = showing ? 'text' : 'password'
        toggleBtn.setAttribute('aria-pressed', String(showing))
        toggleBtn.setAttribute('aria-label', showing ? 'Hide API key' : 'Show API key')
      })
    }

    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        const apiKey = keyInput?.value?.trim()
        const baseURL = document.getElementById('wizard-base-url')?.value?.trim() || ''
        if (!apiKey) {
          testResult.innerHTML = '<span class="wizard-error">Please enter an API key</span>'
          keyInput?.focus()
          return
        }

        testBtn.disabled = true
        testBtn.textContent = 'Testing...'
        testResult.innerHTML = '<span class="wizard-testing">Testing connection...</span>'

        try {
          if (!await requestProviderOriginPermission(baseURL)) {
            throw new Error('Network permission was not granted for this provider URL.')
          }
          const response = await chrome.runtime.sendMessage({
            type: 'TEST_PROVIDER_CONNECTION',
            providerId: this.selectedProvider || 'openai',
            apiKey,
            baseURL
          })

          if (response?.valid) {
            testResult.innerHTML = '<span class="wizard-success">✓ Connection successful!</span>'
            try {
              await chrome.runtime.sendMessage({
                type: 'SET_PROVIDER_CONFIG',
                provider: this.selectedProvider || 'openai',
                apiKey,
                baseURL
              })
            } catch (saveError) {
              console.error('[Onboarding] Failed to save API key after successful test:', saveError)
              testResult.innerHTML = `<span class="wizard-error">✗ Connection worked, but saving the key failed: ${this.escapeText(saveError.message)}. Please try again.</span>`
              this._showError('Your API key connected, but could not be saved. Please try again.')
            }
          } else {
            const errMsg = typeof response?.error === 'string' ? response.error : 'Connection failed'
            testResult.innerHTML = `<span class="wizard-error">✗ ${this.escapeText(errMsg)}</span>`
          }
        } catch (e) {
          console.error('[Onboarding] API key test failed:', e)
          const failMsg = e?.message ? String(e.message) : 'Connection test failed'
          testResult.innerHTML = `<span class="wizard-error">✗ ${this.escapeText(failMsg)}</span>`
        }

        testBtn.disabled = false
        testBtn.textContent = 'Test Connection'
      })
    }
  }

  bindThemeStep() {
    const grid = document.getElementById('wizard-theme-grid')
    if (grid) {
      grid.innerHTML = Object.keys(THEME_PALETTES).map(themeId => {
        const p = THEME_PALETTES[themeId]
        return `
          <button class="wizard-theme-card" data-theme="${themeId}" aria-pressed="false" aria-label="${p.label} theme">
            <div class="wizard-theme-preview" aria-hidden="true" style="
              background: linear-gradient(135deg, ${p.bg} 0%, ${p.bg2} 100%);
              border: 1px solid ${p.accent2};
            ">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.accent};"></span>
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.accent2};"></span>
            </div>
            <span>${p.label}</span>
          </button>
        `
      }).join('')
    }

    document.querySelectorAll('.wizard-theme-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.wizard-theme-card').forEach(c => {
          c.classList.remove('selected')
          c.setAttribute('aria-pressed', 'false')
        })
        card.classList.add('selected')
        card.setAttribute('aria-pressed', 'true')
        this.selectedTheme = card.dataset.theme

        // Apply theme preview immediately
        if (this.selectedTheme === 'system') {
          document.documentElement.removeAttribute('data-theme')
        } else {
          document.documentElement.setAttribute('data-theme', this.selectedTheme)
        }
      })
    })
  }
}

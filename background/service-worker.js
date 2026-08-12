import { initializeConfigValidation } from '../utils/config-validator.js';
import { storage, STORAGE_KEYS, DEFAULT_ENABLED_MODELS, DEFAULT_SETTINGS, PROVIDERS } from '../utils/storage.js';
import { apiClient } from '../utils/api-client.js';
import { executeTool, BROWSER_TOOLS_DEFINITION } from './service-worker-tools.js';
import { cdpController } from './cdp-controller.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { AuditLogger } from '../utils/audit-logger.js';
import { mcpClient } from '../utils/mcp-client.js';
import { conversationMemory } from '../utils/conversation-memory.js';
import { loadAllSkills, getAllSkillTools, getLoadedSkills, executeSkillTool } from '../utils/skills-registry.js';
import { spendTracker } from '../utils/spend-tracker.js';
import { MESSAGE_TYPES } from '../utils/messages.js';

const rateLimiter = new RateLimiter({ maxRequests: 20, windowMs: 60000 });
const auditLogger = new AuditLogger({ maxLogs: 500 });

// Initialize spend tracker
spendTracker.initialize().catch(e => console.error('[SpendTracker] Init failed:', e));

// Initialize configuration validation on service worker startup
initializeConfigValidation().catch(error => {
  console.error('Failed to initialize configuration validation:', error);
});

// Add global error handlers for better debugging
self.addEventListener('error', (event) => {
  console.error('Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// MESSAGE_TYPES is imported from ../utils/messages.js

// DEFAULT_SETTINGS is now imported from utils/storage.js
 
 const MODEL_CAPABILITIES = {
    // OpenAI 2026 Models
    'gpt-5o': { tools: true, vision: true, reasoning: true, name: 'GPT-5o' },
    'gpt-5o-mini': { tools: true, vision: true, reasoning: false, name: 'GPT-5o Mini' },
    'gpt-5o-pro': { tools: true, vision: true, reasoning: true, name: 'GPT-5o Pro' },
    'gpt-5o-playground': { tools: true, vision: true, reasoning: true, name: 'GPT-5o Playground' },
    'gpt-5.1': { tools: true, vision: true, reasoning: true, name: 'GPT-5.1' },
    'gpt-5.1-mini': { tools: true, vision: true, reasoning: true, name: 'GPT-5.1 Mini' },
    'gpt-5.1-pro': { tools: true, vision: true, reasoning: true, name: 'GPT-5.1 Pro' },
    'gpt-5.2': { tools: true, vision: true, reasoning: true, name: 'GPT-5.2' },
    'gpt-5.2-mini': { tools: true, vision: true, reasoning: true, name: 'GPT-5.2 Mini' },
    'gpt-5.2-pro': { tools: true, vision: true, reasoning: true, name: 'GPT-5.2 Pro' },
    'gpt-4.1': { tools: true, vision: true, reasoning: true, name: 'GPT-4.1' },
    'gpt-4.1-mini': { tools: true, vision: true, reasoning: true, name: 'GPT-4.1 Mini' },
    'gpt-4.1-turbo': { tools: true, vision: true, reasoning: true, name: 'GPT-4.1 Turbo' },
    'gpt-4o': { tools: true, vision: true, reasoning: false, name: 'GPT-4o' },
    'gpt-4o-mini': { tools: true, vision: true, reasoning: false, name: 'GPT-4o Mini' },
    'gpt-4-turbo': { tools: true, vision: true, reasoning: false, name: 'GPT-4 Turbo' },
    'gpt-4': { tools: true, vision: false, reasoning: false, name: 'GPT-4' },
    'o1-preview': { tools: false, vision: false, reasoning: true, name: 'o1 Preview' },
    'o1-mini': { tools: false, vision: false, reasoning: true, name: 'o1 Mini' },
    'o3-preview': { tools: false, vision: false, reasoning: true, name: 'o3 Preview' },
    'o3-mini': { tools: false, vision: false, reasoning: true, name: 'o3 Mini' },
    'o1': { tools: false, vision: false, reasoning: true, name: 'o1' },
    'gpt-3.5-turbo': { tools: true, vision: false, reasoning: false, name: 'GPT-3.5 Turbo' },

   // Anthropic 2026 Models
   'claude-4-opus': { tools: true, vision: true, reasoning: true, name: 'Claude 4 Opus' },
   'claude-4-sonnet': { tools: true, vision: true, reasoning: true, name: 'Claude 4 Sonnet' },
   'claude-4-haiku': { tools: true, vision: true, reasoning: false, name: 'Claude 4 Haiku' },
   'claude-4.5-opus': { tools: true, vision: true, reasoning: true, name: 'Claude 4.5 Opus' },
   'claude-4.5-sonnet': { tools: true, vision: true, reasoning: true, name: 'Claude 4.5 Sonnet' },
   'claude-4.5-haiku': { tools: true, vision: true, reasoning: false, name: 'Claude 4.5 Haiku' },
   'claude-3.7-sonnet': { tools: true, vision: true, reasoning: true, name: 'Claude 3.7 Sonnet' },
   'claude-3.7-opus': { tools: true, vision: true, reasoning: true, name: 'Claude 3.7 Opus' },
   'claude-3.5-sonnet': { tools: true, vision: true, reasoning: false, name: 'Claude 3.5 Sonnet' },
   'claude-3.5-haiku': { tools: true, vision: true, reasoning: false, name: 'Claude 3.5 Haiku' },
   'claude-3-opus': { tools: true, vision: true, reasoning: false, name: 'Claude 3 Opus' },
   'claude-3-sonnet': { tools: true, vision: true, reasoning: false, name: 'Claude 3 Sonnet' },
   'claude-3-haiku': { tools: true, vision: true, reasoning: false, name: 'Claude 3 Haiku' },

   // Google Gemini 2026 Models
   'gemini-2.0-flash-thinking': { tools: true, vision: true, reasoning: true, name: 'Gemini 2.0 Flash Thinking' },
   'gemini-2.0-flash-8b': { tools: true, vision: true, reasoning: false, name: 'Gemini 2.0 Flash 8B' },
   'gemini-2.0-flash': { tools: true, vision: true, reasoning: false, name: 'Gemini 2.0 Flash' },
   'gemini-2.0-pro-thinking-exp': { tools: true, vision: true, reasoning: true, name: 'Gemini 2.0 Pro Thinking (Exp)' },
   'gemini-2.0-pro-exp': { tools: true, vision: true, reasoning: true, name: 'Gemini 2.0 Pro (Exp)' },
   'gemini-2.0-pro': { tools: true, vision: true, reasoning: true, name: 'Gemini 2.0 Pro' },
   'gemini-1.5-pro': { tools: true, vision: true, reasoning: true, name: 'Gemini 1.5 Pro' },
   'gemini-1.5-flash': { tools: true, vision: true, reasoning: false, name: 'Gemini 1.5 Flash' },
   'gemini-1.5-flash-8b': { tools: true, vision: true, reasoning: false, name: 'Gemini 1.5 Flash 8B' },
   'gemini-1.0-pro': { tools: true, vision: true, reasoning: false, name: 'Gemini 1.0 Pro' },

   // Z.ai (GLM) 2026 Models
   'glm-4.9-turbo': { tools: true, vision: true, reasoning: true, name: 'GLM-4.9 Turbo' },
   'glm-4.9-flash': { tools: true, vision: true, reasoning: true, name: 'GLM-4.9 Flash' },
   'glm-4.9-pro': { tools: true, vision: true, reasoning: true, name: 'GLM-4.9 Pro' },
   'glm-5': { tools: true, vision: true, reasoning: true, name: 'GLM-5' },
   'glm-5-turbo': { tools: true, vision: true, reasoning: true, name: 'GLM-5 Turbo' },
   'glm-5-flash': { tools: true, vision: true, reasoning: false, name: 'GLM-5 Flash' },
   'glm-4.7': { tools: true, vision: true, reasoning: true, name: 'GLM-4.7' },
   'glm-4.7-flash': { tools: true, vision: true, reasoning: true, name: 'GLM-4.7 Flash' },
   'glm-4.5': { tools: true, vision: true, reasoning: true, name: 'GLM-4.5' },
   'glm-4.5-flash': { tools: true, vision: true, reasoning: true, name: 'GLM-4.5 Flash' },
   'glm-4.5-flash-plus': { tools: true, vision: true, reasoning: true, name: 'GLM-4.5 Flash Plus' },
   'glm-4-flashx': { tools: true, vision: true, reasoning: true, name: 'GLM-4 FlashX' },
   'glm-4-flash-8b': { tools: true, vision: true, reasoning: false, name: 'GLM-4 Flash-8B' },
   'glm-4v-plus': { tools: true, vision: true, reasoning: true, name: 'GLM-4V Plus' },
   'glm-4': { tools: true, vision: true, reasoning: true, name: 'GLM-4' },
   'glm-4-flash': { tools: true, vision: true, reasoning: true, name: 'GLM-4 Flash' },
   'glm-4-plus': { tools: true, vision: true, reasoning: true, name: 'GLM-4 Plus' },
   'glm-4v': { tools: true, vision: true, reasoning: true, name: 'GLM-4V (Vision)' },

   // Meta Llama 2026 Models
   'llama-3.3-70b': { tools: true, vision: true, reasoning: true, name: 'Llama 3.3 70B' },
   'llama-3.3-8b': { tools: true, vision: false, reasoning: false, name: 'Llama 3.3 8B' },
   'llama-3.2-90b': { tools: true, vision: false, reasoning: false, name: 'Llama 3.2 90B' },
   'llama-3.2-70b': { tools: true, vision: false, reasoning: false, name: 'Llama 3.2 70B' },
   'llama-3.2-8b': { tools: true, vision: false, reasoning: false, name: 'Llama 3.2 8B' },
   'llama-4-405b': { tools: true, vision: false, reasoning: true, name: 'Llama 4 405B' },
   'llama-4-70b': { tools: true, vision: false, reasoning: true, name: 'Llama 4 70B' },
   'llama-4-8b': { tools: true, vision: false, reasoning: true, name: 'Llama 4 8B' },
   'llama-3.1-405b': { tools: true, vision: false, reasoning: false, name: 'Llama 3.1 405B' },
   'llama-3.1-70b': { tools: true, vision: false, reasoning: false, name: 'Llama 3.1 70B' },
   'llama-3.1-8b': { tools: true, vision: false, reasoning: false, name: 'Llama 3.1 8B' },
   'llama-3-70b': { tools: true, vision: false, reasoning: false, name: 'Llama 3 70B' },
   'llama-3-8b': { tools: true, vision: false, reasoning: false, name: 'Llama 3 8B' },

   // Mistral 2026 Models
   'mistral-large-3': { tools: true, vision: false, reasoning: true, name: 'Mistral Large 3' },
   'mistral-medium-3': { tools: true, vision: false, reasoning: true, name: 'Mistral Medium 3' },
   'mistral-small-3': { tools: true, vision: false, reasoning: false, name: 'Mistral Small 3' },
   'mistral-large': { tools: true, vision: false, reasoning: false, name: 'Mistral Large' },
   'mistral-medium': { tools: true, vision: false, reasoning: false, name: 'Mistral Medium' },
   'mistral-small': { tools: true, vision: false, reasoning: false, name: 'Mistral Small' },
   'mistral-codestral-latest': { tools: true, vision: false, reasoning: false, name: 'Mistral Codestral Latest' },
    'mixtral-8x22b': { tools: true, vision: false, reasoning: true, name: 'Mixtral 8x22B' },
    'mixtral-8x7b': { tools: true, vision: false, reasoning: false, name: 'Mixtral 8x7B' },
    'mistral-nemo': { tools: true, vision: false, reasoning: false, name: 'Mistral NeMo' },

    // DeepSeek 2026 Models
    'deepseek-chat': { tools: true, vision: true, reasoning: true, name: 'DeepSeek Chat' },
    'deepseek-reasoner': { tools: true, vision: true, reasoning: true, name: 'DeepSeek Reasoner' },
    'deepseek-coder': { tools: true, vision: true, reasoning: true, name: 'DeepSeek Coder' },
    'deepseek-v3': { tools: true, vision: true, reasoning: true, name: 'DeepSeek V3' },
    'deepseek-r1': { tools: true, vision: true, reasoning: true, name: 'DeepSeek R1' },

    // MiniMax 2026 Models
    'minimax-abab6': { tools: true, vision: true, reasoning: true, name: 'MiniMax ABAB6' },
    'minimax-abab5': { tools: true, vision: true, reasoning: true, name: 'MiniMax ABAB5' },
    'minimax-abab4': { tools: true, vision: true, reasoning: false, name: 'MiniMax ABAB4' },
    'minimax-kom': { tools: true, vision: true, reasoning: false, name: 'MiniMax KOM' },
    'minimax-groupnote': { tools: true, vision: false, reasoning: false, name: 'MiniMax GroupNote' }
  }


const TOOLS_DEFINITION = [
  {
    type: 'function',
    function: {
      name: 'read_page',
      description: 'Read the content of the current web page. Use this when the user asks about the current page or wants to summarize it.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browse_url',
      description: 'Browse a URL and extract its content. Use this when the user wants to visit a specific URL or get information from a link.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to visit' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information. Use this when you need current information or don\'t know the answer.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' }
        },
        required: ['query']
      }
    }
  }
]

const TOOLS_DEFINITIONS = TOOLS_DEFINITION

// STORAGE_KEYS is already imported from utils/storage.js
// Provider base URLs and model→provider lookups live in a single place now:
// utils/storage.js's PROVIDERS (baseURL, anthropicCompatible, models) and
// storage.getProviderForModel() — this file used to keep its own duplicate,
// independently-stale copies of both (PROVIDER_BASE_URLS, MODEL_PROVIDER_MAP),
// which is how the MiniMax domain/model-ID bugs went unnoticed for so long.
// DEFAULT_ENABLED_MODELS is now imported from utils/storage.js

// StorageManager and APIClient are now imported from utils/
// Tool functions are in service-worker-tools.js

class ChatState {
  constructor() {
    this.isGenerating = false
    this.abortController = null
    this.currentStream = null
    this.userStopped = false
  }

  reset() {
    this.isGenerating = false
    this.abortController = null
    this.currentStream = null
    this.userStopped = false
  }
}

const chatState = new ChatState()

chrome.runtime.onInstalled.addListener(async (details) => {
  console.debug('Extension installed:', details.reason)

  if (details.reason === 'install') {
    await storage.setUserPreferences({ firstRun: true, installTime: Date.now() })
    await storage.setEnabledModels(DEFAULT_ENABLED_MODELS)
    auditLogger.log(auditLogger.eventTypes.EXTENSION_INSTALLED, auditLogger.categories.SYSTEM, { reason: details.reason })
  } else if (details.reason === 'update') {
    auditLogger.log(auditLogger.eventTypes.EXTENSION_UPDATED, auditLogger.categories.SYSTEM, { reason: details.reason })
    // Migration: backfill conversation-memory index for users upgrading from <1.1
    await runMigrations(details.previousVersion)
  }

  await setupSidePanel()
})

chrome.runtime.onStartup.addListener(async () => {
  console.debug('Extension starting up')
  // Idempotent migration on every cold start — runs only if not already done
  await runMigrations()
  await setupSidePanel()
  // Load all enabled skills
  await loadAllSkills()
  console.debug('[skills] Loaded:', getLoadedSkills())
})

/**
 * One-time + idempotent migration runner. Each migration is keyed by name
 * in chrome.storage.local so it only runs once across browser restarts
 * and reinstalls.
 */
async function runMigrations(previousVersion) {
  try {
    const MIGRATION_FLAGS = conversationMemory.MIGRATION_FLAGS
    const flags = (await chrome.storage.local.get(MIGRATION_FLAGS))[MIGRATION_FLAGS] || {}

    // Migration 1: backfill memory index for existing conversations
    if (!flags.memory_index_v1) {
      try {
        const conversations = await storage.getConversations()
        const count = Object.keys(conversations).length
        if (count > 0) {
          await conversationMemory.rebuildIndex()
          console.debug(`[migration] Indexed ${count} existing conversations`)
          auditLogger.log(auditLogger.eventTypes.MEMORY_INDEX_REBUILT, { count })
        }
        flags.memory_index_v1 = Date.now()
        await chrome.storage.local.set({ [MIGRATION_FLAGS]: flags })
      } catch (err) {
        console.error('[migration] memory_index_v1 failed:', err)
      }
    }

    // Migration 2: ensure new default settings exist for existing users
    if (!flags.default_settings_v1) {
      try {
        const current = await storage.getSettings()
        const merged = { ...DEFAULT_SETTINGS, ...current }
        await storage.saveSettings(merged)
        flags.default_settings_v1 = Date.now()
        await chrome.storage.local.set({ [MIGRATION_FLAGS]: flags })
      } catch (err) {
        console.error('[migration] default_settings_v1 failed:', err)
      }
    }
  } catch (err) {
    console.error('[migration] runner error:', err)
  }
}

async function setupSidePanel() {
  try {
    // Firefox and Safari use a sidebar/full-page fallback instead of Chrome's
    // sidePanel API. Keep the rest of the service worker alive on those builds.
    if (!chrome.sidePanel) {
      console.debug('[CTRL] sidePanel API unavailable; using browser fallback')
      return
    }
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

    // Apply saved panel width
    try {
      const settings = await storage.getSettings()
      const width = settings.panelWidth || 400
      if (width !== 400) {
        await chrome.sidePanel.setOptions({ width })
      }
    } catch (e) {
      // setOptions may not be available in all Chrome versions
    }

    // Auto-attach CDP when sidepanel opens (respects user's autoAttachEnabled setting; default true if unset)
    chrome.sidePanel.onOpened.addListener(async () => {
      try {
        const settings = await storage.getSettings()
        if (settings.autoAttachEnabled === false) return
        await cdpController.autoAttach()
      } catch (e) {
        console.debug('[CDP] Auto-attach skipped:', e.message)
      }
    })

    // Auto-switch attachment when user switches tabs
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      if (cdpController.isAttached && cdpController.autoAttachEnabled) {
        try {
          const tab = await chrome.tabs.get(activeInfo.tabId)
          if (cdpController.isAttachableUrl(tab.url) && cdpController.attachedTabId !== activeInfo.tabId) {
            await cdpController.detach(cdpController.attachedTabId, true)
            await cdpController.attach(activeInfo.tabId, true)
          }
        } catch (e) {
          // Tab may not exist anymore
        }
      }
    })
  } catch (error) {
    console.error('Failed to set side panel behavior:', error)
  }
}

// Listen for settings changes (e.g. panel width) and apply them
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    const newSettings = changes.settings.newValue
    if (newSettings?.panelWidth) {
      try {
        chrome.sidePanel.setOptions({ width: newSettings.panelWidth })
      } catch (e) {
        // setOptions may not be available
      }
    }
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse)
  return true
})

async function handleMessage(message, sender) {
  try {
    switch (message.type) {
      case MESSAGE_TYPES.SEND_CHAT:
        return await handleChatMessage(message, sender)
      
      case MESSAGE_TYPES.SEND_STREAMING_CHAT:
        return await handleStreamingChatMessage(message, sender)
      
      case MESSAGE_TYPES.RUN_CHAT:
        return await handleRunChat(message)
      
      case MESSAGE_TYPES.GET_CONTEXT:
        return await getPageContext(sender.tab?.id)
      
      case MESSAGE_TYPES.GET_CHAT_HISTORY:
        return await storage.getChatHistory()
      
      case MESSAGE_TYPES.CLEAR_HISTORY:
        await storage.clearChatHistory()
        return { success: true }
      
      case MESSAGE_TYPES.IMPORT_CHAT_HISTORY:
        await storage.saveChatHistory(message.history || [])
        return { success: true, count: (message.history || []).length }
      
      case MESSAGE_TYPES.SAVE_SETTINGS:
        return await storage.saveSettings(message.settings)
      
      case MESSAGE_TYPES.GET_SETTINGS:
        return await storage.getSettings()
      
      case MESSAGE_TYPES.TEST_PROVIDER_CONNECTION:
        auditLogger.log(auditLogger.eventTypes.AUTH_LOGIN, auditLogger.categories.SECURITY, { provider: message.providerId })
        return await apiClient.validateAPIKey(message.apiKey, message.providerId, message.baseURL)
      
      case MESSAGE_TYPES.SET_MODEL:
        await storage.setAPIConfig({ model: message.model })
        auditLogger.log(auditLogger.eventTypes.MODEL_SELECTION_CHANGED, auditLogger.categories.CONFIGURATION, { model: message.model })
        return { success: true }

      case MESSAGE_TYPES.SET_PROVIDER_CONFIG: {
        const { provider, apiKey, baseURL } = message
        await storage.setProviderCredentials(provider, apiKey, baseURL || '')
        await storage.setProviderConfig({ provider, customBaseURL: baseURL || '' })
        return { success: true }
      }
      
      case MESSAGE_TYPES.STOP_GENERATION:
        return stopGeneration()
      
      case MESSAGE_TYPES.GET_STATE:
        const config = await storage.getAPIConfig()
        return {
          isGenerating: chatState.isGenerating,
          hasAPIKey: !!(await storage.getAPIKey()),
          settings: await storage.getSettings(),
          apiConfig: config,
          enabledModels: await storage.getEnabledModels(),
          modelCapabilities: MODEL_CAPABILITIES[config.model] || { tools: false, vision: false, reasoning: false }
        }
      
      case MESSAGE_TYPES.NEW_CHAT:
        return await newChat(message.saveCurrent)
      
      case MESSAGE_TYPES.SAVE_CONVERSATION:
        return await storage.saveConversation(message.name, message.history)
      
      case MESSAGE_TYPES.SAVE_CONVERSATIONS_BULK: {
        const list = Array.isArray(message.conversations) ? message.conversations : []
        const conversations = {}
        for (const conv of list) {
          if (!conv?.name) continue
          conversations[conv.name] = {
            history: conv.history || [],
            timestamp: conv.timestamp || conv.updatedAt || conv.createdAt || Date.now(),
            pinned: !!conv.pinned,
            tags: Array.isArray(conv.tags) ? conv.tags : []
          }
        }
        await storage.set('conversations', conversations)
        return { success: true, count: Object.keys(conversations).length }
      }

      case MESSAGE_TYPES.GET_CONVERSATIONS: {
        // storage.getConversations() returns an object keyed by conversation
        // name (its internal shape, also relied on by conversation-memory.js
        // and saveConversation/deleteConversation). The sidebar UI works with
        // an array of {name, ...} objects, so shape it here at the message
        // boundary rather than changing the internal storage representation.
        const convMap = await storage.getConversations()
        return Object.entries(convMap).map(([name, data]) => ({ name, ...data }))
      }
      
      case MESSAGE_TYPES.GET_MODELS:
        return await apiClient.getModelsForProvider(message.providerId, message.apiKey, message.baseURL, message.forceRefresh)
      
      case MESSAGE_TYPES.CLEAR_MODEL_CACHE:
        return apiClient.clearModelCache(message.providerId, message.baseURL || '')
      
      case MESSAGE_TYPES.EXECUTE_TOOL:
        const rateCheck = rateLimiter.check(message.tool || 'default')
        if (!rateCheck.allowed) {
          return { error: `Rate limit exceeded for tool '${message.tool}'. Retry after ${Math.ceil(rateCheck.retryAfter / 1000)}s.`, retryAfter: rateCheck.retryAfter }
        }
        return await executeTool(message.tool, message.args || {})
      
      case MESSAGE_TYPES.TEST_MCP_CONNECTION:
        return await testMcpConnection(message.mcpType, message.config)

      case MESSAGE_TYPES.CDP_DETACH:
        return await cdpController.detach()

      case MESSAGE_TYPES.CDP_TOGGLE:
        return await cdpController.toggle()

      case MESSAGE_TYPES.CDP_STATUS:
        return cdpController.getStatus()

      case MESSAGE_TYPES.CDP_CONNECT_RELAY:
        return await cdpController.connectRelay(message.port, message.token)

      case MESSAGE_TYPES.CDP_DISCONNECT_RELAY:
        return cdpController.disconnectRelay()

      case MESSAGE_TYPES.BROWSER_ACTION_APPROVED: {
        const resolve = cdpController.pendingActions.get(message.requestId)
        if (resolve) {
          cdpController.pendingActions.delete(message.requestId)
          // If "approve all for session" was checked
          if (message.approveAll) {
            cdpController.approveSession()
          }
          resolve(true)
        }
        return { success: true }
      }

      case MESSAGE_TYPES.BROWSER_ACTION_DENIED: {
        const resolve = cdpController.pendingActions.get(message.requestId)
        if (resolve) {
          cdpController.pendingActions.delete(message.requestId)
          resolve(false)
        }
        return { success: true }
      }

      default:
        console.warn('Unknown message type:', message.type)
        return { error: 'Unknown message type' }
    }
  } catch (error) {
    console.error('Error handling message:', error)
    return { error: error.message, type: error.name }
  }
}

async function handleChatMessage(message, sender) {
  if (chatState.isGenerating) {
    return { error: 'Already generating a response. Please wait.' }
  }

  chatState.isGenerating = true
  chatState.userStopped = false
  const myController = new AbortController()
  chatState.abortController = myController
  
  try {
    // Use history from the message if provided (sidepanel sends its
    // authoritative conversation view; popup sends its own mini-chat
    // history), otherwise load from storage.
    const history = Array.isArray(message.history)
      ? message.history.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      : await storage.getChatHistory()
    const settings = await storage.getSettings()
    const apiConfig = await storage.getAPIConfig()
    const modelCaps = MODEL_CAPABILITIES[apiConfig.model] || {}

    const messages = await buildMessages(message, history, settings)

    let response
    
    if (modelCaps.tools) {
      let tools = [...TOOLS_DEFINITIONS]
      if (!settings.webSearchEnabled) {
        tools = tools.filter(t => t.function.name !== 'web_search')
      }

      if (cdpController.isAttached) {
        tools = [...tools, ...BROWSER_TOOLS_DEFINITION]
      }

      // Skill tools — loaded from skills registry (code interpreter, file tools, CLI bridge, etc.)
      try {
        const skillTools = await getAllSkillTools()
        if (skillTools.length > 0) {
          tools = [...tools, ...skillTools]
        }
      } catch (e) {
        console.warn('Skill tools load failed:', e.message)
      }

      // MCP tools — lowest priority, added last
      try {
        await mcpClient.refresh()
        if (mcpClient.hasTools()) {
          tools = [...tools, ...mcpClient.getTools()]
        }
      } catch (e) {
        console.warn('MCP refresh failed:', e.message)
      }
      
      console.debug('Chat with tools:', {
        model: apiConfig.model,
        hasTools: tools.length > 0,
        tools: tools.map(t => t.function.name),
        temperature: settings.temperature,
        maxTokens: settings.maxTokens
      })
      
      response = await apiClient.chatWithTools(messages, tools, {
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        signal: myController.signal,
        approvalCallback: async (toolName, toolArgs) => {
          // Only require approval for destructive browser actions in per-session mode
          if (!cdpController.isAttached || !cdpController.isDestructiveAction(toolName)) {
            return true
          }

          // If session already approved, allow
          if (cdpController.isActionApproved(toolName)) {
            return true
          }

          // Request approval from sidepanel
          return new Promise((resolve) => {
            const requestId = `approval_${Date.now()}_${Math.random().toString(36).slice(2)}`
            
            // Store resolve callback
            cdpController.pendingActions.set(requestId, resolve)

            // Send approval request to sidepanel
            chrome.runtime.sendMessage({
              type: 'BROWSER_ACTION_APPROVAL_REQUIRED',
              requestId,
              toolName,
              toolArgs,
              tabId: cdpController.attachedTabId
            }).catch(() => {
              // Sidepanel not open — fail closed. Never auto-approve
              // destructive actions without a visible user consent UI.
              cdpController.pendingActions.delete(requestId)
              resolve(false)
            })

            // Timeout after 60 seconds — fail closed (deny) rather than
            // auto-approve a destructive action nobody saw.
            setTimeout(() => {
              if (cdpController.pendingActions.has(requestId)) {
                cdpController.pendingActions.delete(requestId)
                resolve(false)
              }
            }, 60000)
          })
        }
      })
    } else {
      response = await apiClient.chat(messages, {
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        signal: myController.signal
      })
    }

    const aiMessage = response.choices[0]?.message?.content || ''
    
    const timestamp = Date.now();
    const userEntry = { role: 'user', content: message.content, timestamp }
    if (message.images?.length) userEntry.images = message.images
    if (message.files?.length) userEntry.files = message.files
    // Dedupe the user turn when it is already the last history entry
    // (regenerate/edit flows resend the same content).
    const lastEntry = history[history.length - 1]
    const baseHistory = (lastEntry?.role === 'user' && lastEntry.content === message.content)
      ? [...history.slice(0, -1), userEntry]
      : [...history, userEntry]
    const newHistory = [
      ...baseHistory,
      { role: 'assistant', content: aiMessage, timestamp }
    ]
    
    // Persist to storage unless this is a popup mini-chat (popup sends its
    // own history and must not clobber the sidepanel's chat view). The
    // sidepanel's fallback path sets persistHistory explicitly.
    if (!message.history || message.persistHistory) {
      await storage.saveChatHistory(newHistory)
    }

    // Record spend
    if (response.usage) {
      const provider = storage.getProviderForModel(apiConfig.model)
      spendTracker.record({
        provider: provider?.id || 'unknown',
        model: apiConfig.model,
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0
      })
    }

    return {
      success: true,
      message: aiMessage,
      usage: response.usage,
      history: newHistory
    }

  } catch (error) {
    if (error.name === 'UserAbortError' || chatState.userStopped) {
      return { stopped: true }
    }
    console.error('Chat error:', {
      error: error.message,
      type: error.name,
      stack: error.stack,
      recoverable: true
    })
    return {
      error: error.message,
      recoverable: true
    }
  } finally {
    if (chatState.abortController === myController) {
      chatState.reset()
    }
  }
}

/**
 * Generic LLM chat request from the sidepanel (agent builders, save-as-agent,
 * etc.). Routing these through the background gives every call the same spend
 * tracking, audit logging and rate limiting as the main chat path — the
 * sidepanel's own APIClient instance historically bypassed all of that.
 */
async function handleRunChat(message) {
  const rateCheck = rateLimiter.check('chat')
  if (!rateCheck.allowed) {
    return { error: `Rate limit exceeded. Retry after ${Math.ceil(rateCheck.retryAfter / 1000)}s.`, retryAfter: rateCheck.retryAfter }
  }

  try {
    const response = await apiClient.chat(message.messages || [], message.options || {})

    // Record spend for the model actually used
    if (response?.usage) {
      const modelId = message.options?.model || (await storage.getAPIConfig()).model
      const provider = storage.getProviderForModel(modelId)
      spendTracker.record({
        provider: provider?.id || 'unknown',
        model: modelId,
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0
      })
    }

    return { success: true, response }
  } catch (error) {
    console.error('RUN_CHAT error:', error)
    return { error: error.message, type: error.name }
  }
}

async function handleStreamingChatMessage(message, sender) {
  if (chatState.isGenerating) {
    return { error: 'Already generating a response. Please wait.' }
  }

  chatState.isGenerating = true
  chatState.userStopped = false
  const myController = new AbortController()
  chatState.abortController = myController
  let fullContent = ''
  
  try {
    // The sidepanel sends its authoritative conversation view (this.messages),
    // which already reflects DOM truncation on regenerate/edit. When provided,
    // use it as the base history instead of storage; otherwise fall back to
    // the stored history (e.g. popup mini-chat).
    const baseHistory = Array.isArray(message.history)
      ? message.history.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      : await storage.getChatHistory()
    const settings = await storage.getSettings()

    const messages = await buildMessages(message, baseHistory, settings)

    // User turn — dedupe when it is already the last history entry (the
    // regenerate/edit flows resend the same user content, so appending again
    // would duplicate the turn both in the model context and in storage).
    const userEntry = {
      role: 'user',
      content: message.content,
      timestamp: Date.now()
    }
    if (message.images?.length) userEntry.images = message.images
    if (message.files?.length) userEntry.files = message.files
    const lastEntry = baseHistory[baseHistory.length - 1]
    const historyWithUser = (lastEntry?.role === 'user' && lastEntry.content === message.content)
      ? [...baseHistory.slice(0, -1), userEntry]
      : [...baseHistory, userEntry]

    const response = await apiClient.streamChat(
      messages,
      (chunk, full) => {
        fullContent = full
        // Send chunk to sidepanel for live rendering
        chrome.runtime.sendMessage({
          type: 'STREAM_CHUNK',
          chunk,
          fullContent: full
        }).catch(() => { /* sidepanel may not be open */ })
      },
      {
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        signal: myController.signal
      }
    )

    // Send stream complete signal
    chrome.runtime.sendMessage({
      type: 'STREAM_COMPLETE',
      fullContent: fullContent || response.text || ''
    }).catch(() => {})

    const newHistory = [
      ...historyWithUser,
      { role: 'assistant', content: fullContent || response.text || '', timestamp: Date.now() }
    ]
    
    // Single write after success: a failed/aborted stream leaves no dangling
    // unanswered user turn in storage.
    await storage.saveChatHistory(newHistory)

    // Record spend (estimate tokens from content length for streaming)
    const apiConfig2 = await storage.getAPIConfig()
    const provider2 = storage.getProviderForModel(apiConfig2.model)
    const estimatedPromptTokens = Math.ceil((message.content || '').length / 4)
    const estimatedCompletionTokens = Math.ceil(fullContent.length / 4)
    spendTracker.record({
      provider: provider2?.id || 'unknown',
      model: apiConfig2.model,
      promptTokens: estimatedPromptTokens,
      completionTokens: estimatedCompletionTokens
    })

    return {
      success: true,
      message: fullContent || response.text || '',
      history: newHistory,
      streaming: true
    }

  } catch (error) {
    if (error.name === 'UserAbortError' || chatState.userStopped) {
      chrome.runtime.sendMessage({
        type: 'STREAM_CHUNK',
        chunk: '',
        fullContent: fullContent
      }).catch(() => {})
      return { stopped: true, message: fullContent }
    }
    console.error('Streaming chat error:', error)
    chrome.runtime.sendMessage({
      type: 'STREAM_ERROR',
      error: error.message
    }).catch(() => {})
    return {
      error: error.message,
      recoverable: true
    }
  } finally {
    if (chatState.abortController === myController) {
      chatState.reset()
    }
  }
}

async function newChat(saveCurrent) {
  if (chatState.isGenerating) {
    return { error: 'A generation is in progress. Please stop it first.' }
  }
  if (saveCurrent) {
    const history = await storage.getChatHistory()
    if (history.length > 0) {
      const timestamp = new Date().toISOString().slice(0, 10)
      await storage.saveConversation(`Chat ${timestamp}`, history)
    }
  }
  
  await storage.saveChatHistory([])
  return { success: true, history: [] }
}

async function buildMessages(message, history, settings) {
  const messages = []

  let systemContent = settings.systemPrompt || 'You are a helpful AI assistant. Provide clear, concise, and accurate responses. You have access to tools to read the current page, browse URLs, and search the web when needed.'

  // One-shot agent preset override from the sidepanel's /preset [name]
  // command (saved via "Save as Agent" on a chat response).
  if (message.systemPromptOverride) {
    systemContent = message.systemPromptOverride
  } else if (message.mode === 'reasoning') {
    systemContent = "You are an expert problem solver and senior software engineer. Think step-by-step. Analyze edge cases, explore alternative solutions, and write highly robust, optimized code. Explain your logic deeply before providing the final answer."
  } else if (message.mode === 'study') {
    systemContent = "You are a world-class Socratic tutor. DO NOT just give the direct answer. Instead, explain underlying concepts, break down jargon, and help the user arrive at the answer themselves. Structure your responses clearly, often using markdown formatting and analogies."
  } else if (message.mode === 'search') {
    systemContent = "You are an expert research assistant. ALWAYS search the web to answer the user's question, no matter how simple it seems. Your goal is to provide the most up-to-date, factually accurate information based on real-time web results. Cite your sources using inline brackets."
  }

  if (cdpController.isAttached) {
    systemContent += '\n\nYou are in Web Agent mode with direct browser control. You can navigate pages, click elements, type text, take screenshots, scroll, and extract content. Use browser_get_elements to discover clickable elements before clicking. Use browser_screenshot to see the page visually. Always confirm destructive actions (form submissions, purchases) with the user before proceeding.'
  }

  // Conversation memory (RAG) — fetch relevant snippets from past chats
  if (message.content && settings.memoryEnabled !== false) {
    try {
      const memResults = await conversationMemory.search(message.content, { k: 3 })
      if (memResults?.length) {
        const mem = conversationMemory.formatForPrompt(memResults)
        if (mem) systemContent += `\n\n${mem}`
      }
    } catch (err) {
      console.warn('Memory search failed:', err.message)
    }
  }

  messages.push({
    role: 'system',
    content: systemContent
  })

  const recentHistory = history.slice(-20)
  for (const msg of recentHistory) {
    // Skip any undefined or null messages
    if (!msg) continue;
    
    const messageObj = {
      role: msg.role,
      content: msg.content
    }
    
    // Safely add timestamp if it exists
    if (msg.timestamp !== undefined) {
      messageObj.timestamp = msg.timestamp
    }
    
    messages.push(messageObj)
  }

  if (message.includeContext && message.pageContent) {
    const truncated = truncateText(message.pageContent, settings.contextLength)
    messages.push({
      role: 'user',
      content: `[Context from current page]:\n${truncated}`
    })
  }

  let finalContent = message.content;
  if (message.mode === 'search') {
    finalContent = message.content + "\n\n(Please use the web_search tool to find the most accurate and recent information regarding this.)";
  }

  // The sidepanel's history view already includes the current user turn
  // (tracked before the request is sent). Avoid appending it a second time.
  const lastEntry = history[history.length - 1]
  const userAlreadyInHistory = lastEntry?.role === 'user' && lastEntry.content === message.content
  if (!userAlreadyInHistory) {
    const userMessage = { role: 'user', content: finalContent }
    if (message.images?.length) userMessage.images = message.images
    if (message.files?.length) userMessage.files = message.files
    messages.push(userMessage)
  }

  return messages
}

function truncateText(text, maxLength) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

function stopGeneration() {
  chatState.userStopped = true
  if (chatState.abortController) {
    chatState.abortController.abort()
  }
  return { success: true, message: 'Generation stopped' }
}

async function getPageContext(tabId) {
  if (!tabId) {
    return { error: 'No active tab' }
  }

  try {
    const results = await chrome.tabs.sendMessage(tabId, { type: 'GET_CONTEXT' })
    return results || { error: 'Could not extract context' }
  } catch (error) {
    console.error('Context extraction error:', error)
    return { error: 'Could not extract page context' }
  }
}

async function testMcpConnection(mcpType, config) {
  try {
    switch (mcpType) {
      case 'local-http':
        if (!config.url) {
          return { success: false, error: 'URL is required' }
        }
        const response = await fetch(config.url, {
          method: 'GET',
          headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}
        })
        if (response.ok) {
          return { success: true }
        } else {
          return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
        }
      
      case 'webhook':
        if (!config.webhookUrl) {
          return { success: false, error: 'Webhook URL is required' }
        }
        return { success: true, message: 'Webhook configured (test not available)' }
      
      case 'notion':
        if (!config.apiKey) {
          return { success: false, error: 'API key required' }
        }
        const notionRes = await fetch('https://api.notion.com/v1/users/me', {
          headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Notion-Version': '2022-06-28' }
        })
        if (notionRes.ok) {
          return { success: true }
        } else {
          return { success: false, error: 'Invalid Notion API key' }
        }
      
      case 'slack':
        if (!config.apiKey) {
          return { success: false, error: 'API key required' }
        }
        return { success: true, message: 'Slack configured (OAuth required for full test)' }
      
      case 'github':
        if (!config.apiKey) {
          return { success: false, error: 'API key required' }
        }
        const githubRes = await fetch('https://api.github.com/user', {
          headers: { 'Authorization': `Bearer ${config.apiKey}` }
        })
        if (githubRes.ok) {
          return { success: true }
        } else {
          return { success: false, error: 'Invalid GitHub API key' }
        }
      
      case 'jira':
        if (!config.apiKey) {
          return { success: false, error: 'API key required' }
        }
        return { success: true, message: 'Jira configured' }
      
      case 'google-drive':
        if (!config.apiKey) {
          return { success: false, error: 'API key required' }
        }
        return { success: true, message: 'Google Drive configured (OAuth required)' }
      
      case 'dropbox':
        if (!config.apiKey) {
          return { success: false, error: 'Access token required' }
        }
        return { success: true, message: 'Dropbox configured' }
      
      case 'postgres':
        return { success: true, message: 'PostgreSQL configured (connection test requires running server)' }
      
      case 'claude-mcp':
      case 'openai-gpts':
      case 'gemini-extensions':
        return { success: true, message: 'AI Provider MCP configured' }
      
      default:
        return { success: false, error: 'Unknown MCP type' }
    }
  } catch (error) {
    console.error('MCP test error:', error)
    return { success: false, error: error.message }
  }
}

if (chrome.commands?.onCommand) chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-sidepanel') {
    try {
      if (chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
      } else if (chrome.sidebarAction?.open) {
        await chrome.sidebarAction.open()
      } else {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        await chrome.tabs.create({
          url: chrome.runtime.getURL('sidepanel/sidepanel.html'),
          windowId: tab?.windowId,
        })
      }
    } catch (error) {
      console.error('Failed to open side panel:', error)
    }
  } else if (command === 'toggle-browser-agent') {
    try {
      const result = await cdpController.toggle()
      console.debug('[CDP] Toggle result:', result)
    } catch (error) {
      console.error('[CDP] Toggle failed:', error)
    }
  }
})

console.debug('Background service worker initialized')

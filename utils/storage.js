export const STORAGE_KEYS = {
  API_KEY: 'api_key',
  API_BASE_URL: 'api_base_url',
  MODEL: 'model',
  SETTINGS: 'settings',
  CHAT_HISTORY: 'chat_history',
  USER_PREFERENCES: 'user_preferences',
  PROVIDER_CONFIG: 'provider_config',
  PROVIDER_CREDENTIALS: 'provider_credentials',
  // Same literal key ModelSelectionManager (utils/model-selection-manager.js) writes to
  // directly via chrome.storage.local — this entry was missing entirely, so
  // getEnabledModels()/setEnabledModels() below read/wrote STORAGE_KEYS.ENABLED_MODELS,
  // which evaluated to `undefined`, silently returning [] no matter what was actually
  // stored. That broke GET_STATE's `enabledModels` field, which command-palette.js's
  // in-chat model list depends on directly.
  ENABLED_MODELS: 'enabled_models',
  AGENT_PRESETS: 'agent_presets'
}

export const DEFAULT_SETTINGS = {
  temperature: 0.7,
  maxTokens: 2000,
  includePageContent: false,
  contextLength: 4000,
  theme: 'system',
  fontSize: 'medium',
  streaming: true,
  autoScroll: true,
  soundNotifications: false,
  showTimestamps: true,
  memoryEnabled: true,
  confirmActions: true,
  density: 'comfortable',
  panelWidth: 400
}

 /**
  * Each model entry carries a `pricing: { input, output }` field — USD per 1M tokens,
  * used by the sidepanel cost-estimate badge (sidepanel.js `estimateCost()`). Values are
  * sourced from each provider's published per-token pricing where the model exists today
  * (e.g. GPT-4o, GPT-4o Mini, Claude 3.5 Sonnet/Haiku, Gemini 1.5 Pro/Flash, DeepSeek V3/R1,
  * Mixtral 8x7B, Llama 3.1 family) and extrapolated proportionally by tier (flagship /
  * standard / mini-flash / small-open-weight) for forward-looking model names in this catalog
  * that don't have published pricing yet (GPT-5.x, Claude 4.x, GLM-5, Gemini 3.x, MiniMax M3,
  * etc). Treat these as reasonable estimates, not billing-accurate figures — always confirm
  * against the provider's live pricing page before using this for real spend decisions.
  */
 export const PROVIDERS = {
   openai: {
     id: 'openai',
     name: 'OpenAI',
     baseURL: 'https://api.openai.com/v1',
      models: [
        { id: 'gpt-5o', name: 'GPT-5o', pricing: { input: 3.5, output: 14.0 } },
        { id: 'gpt-5o-mini', name: 'GPT-5o Mini', pricing: { input: 0.35, output: 1.4 } },
        { id: 'gpt-5o-pro', name: 'GPT-5o Pro', pricing: { input: 15.0, output: 60.0 } },
        { id: 'gpt-5o-playground', name: 'GPT-5o Playground', pricing: { input: 3.5, output: 14.0 } },
        { id: 'gpt-5.1', name: 'GPT-5.1', pricing: { input: 3.5, output: 14.0 } },
        { id: 'gpt-5.1-mini', name: 'GPT-5.1 Mini', pricing: { input: 0.35, output: 1.4 } },
        { id: 'gpt-5.1-pro', name: 'GPT-5.1 Pro', pricing: { input: 15.0, output: 60.0 } },
        { id: 'gpt-5.2', name: 'GPT-5.2', pricing: { input: 3.5, output: 14.0 } },
        { id: 'gpt-5.2-mini', name: 'GPT-5.2 Mini', pricing: { input: 0.35, output: 1.4 } },
        { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', pricing: { input: 15.0, output: 60.0 } },
        { id: 'gpt-4.1', name: 'GPT-4.1', pricing: { input: 2.0, output: 8.0 } },
        { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', pricing: { input: 0.4, output: 1.6 } },
        { id: 'gpt-4.1-turbo', name: 'GPT-4.1 Turbo', pricing: { input: 5.0, output: 15.0 } },
        { id: 'gpt-4o', name: 'GPT-4o', pricing: { input: 2.5, output: 10.0 } },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', pricing: { input: 0.15, output: 0.6 } },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', pricing: { input: 10.0, output: 30.0 } },
        { id: 'gpt-4', name: 'GPT-4', pricing: { input: 30.0, output: 60.0 } },
        { id: 'o1-preview', name: 'o1 Preview', pricing: { input: 15.0, output: 60.0 } },
        { id: 'o1-mini', name: 'o1 Mini', pricing: { input: 1.1, output: 4.4 } },
        { id: 'o3-preview', name: 'o3 Preview', pricing: { input: 10.0, output: 40.0 } },
        { id: 'o3-mini', name: 'o3 Mini', pricing: { input: 1.1, output: 4.4 } },
        { id: 'o1', name: 'o1', pricing: { input: 15.0, output: 60.0 } },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', pricing: { input: 0.5, output: 1.5 } }
      ],
     supportsVision: true,
     supportsImageGen: true
   },
   anthropic: {
     id: 'anthropic',
     name: 'Anthropic',
     baseURL: 'https://api.anthropic.com/v1',
     models: [
       { id: 'claude-4-opus', name: 'Claude 4 Opus', pricing: { input: 15.0, output: 75.0 } },
       { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', pricing: { input: 3.0, output: 15.0 } },
       { id: 'claude-4-haiku', name: 'Claude 4 Haiku', pricing: { input: 0.8, output: 4.0 } },
       { id: 'claude-4.5-opus', name: 'Claude 4.5 Opus', pricing: { input: 15.0, output: 75.0 } },
       { id: 'claude-4.5-sonnet', name: 'Claude 4.5 Sonnet', pricing: { input: 3.0, output: 15.0 } },
       { id: 'claude-4.5-haiku', name: 'Claude 4.5 Haiku', pricing: { input: 0.8, output: 4.0 } },
       { id: 'claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', pricing: { input: 3.0, output: 15.0 } },
       { id: 'claude-3.7-opus', name: 'Claude 3.7 Opus', pricing: { input: 15.0, output: 75.0 } },
       { id: 'claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', pricing: { input: 3.0, output: 15.0 } },
       { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', pricing: { input: 3.0, output: 15.0 } },
       { id: 'claude-3.5-haiku', name: 'Claude 3.5 Haiku', pricing: { input: 0.8, output: 4.0 } },
       { id: 'claude-3-opus', name: 'Claude 3 Opus', pricing: { input: 15.0, output: 75.0 } },
       { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', pricing: { input: 3.0, output: 15.0 } },
       { id: 'claude-3-haiku', name: 'Claude 3 Haiku', pricing: { input: 0.8, output: 4.0 } }
     ],
      supportsVision: true,
      supportsImageGen: false,
      requiresVersionHeader: true
    },
    zai: {
     id: 'zai',
     name: 'Z.ai (GLM)',
     baseURL: 'https://api.z.ai/v1',
     models: [
       { id: 'glm-4.9-turbo', name: 'GLM-4.9 Turbo', pricing: { input: 0.6, output: 2.2 } },
       { id: 'glm-4.9-flash', name: 'GLM-4.9 Flash', pricing: { input: 0.1, output: 0.2 } },
       { id: 'glm-4.9-pro', name: 'GLM-4.9 Pro', pricing: { input: 2.0, output: 6.0 } },
       { id: 'glm-5', name: 'GLM-5', pricing: { input: 2.0, output: 6.0 } },
       { id: 'glm-5-turbo', name: 'GLM-5 Turbo', pricing: { input: 2.0, output: 6.0 } },
       { id: 'glm-5-flash', name: 'GLM-5 Flash', pricing: { input: 0.1, output: 0.2 } },
       { id: 'glm-4.7', name: 'GLM-4.7', pricing: { input: 0.6, output: 2.2 } },
       { id: 'glm-4.7-flash', name: 'GLM-4.7 Flash', pricing: { input: 0.1, output: 0.2 } },
       { id: 'glm-4.5', name: 'GLM-4.5', pricing: { input: 0.6, output: 2.2 } },
       { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash', pricing: { input: 0.1, output: 0.2 } },
       { id: 'glm-4.5-flash-plus', name: 'GLM-4.5 Flash Plus', pricing: { input: 0.15, output: 0.3 } },
       { id: 'glm-4-flashx', name: 'GLM-4 FlashX', pricing: { input: 0.05, output: 0.1 } },
       { id: 'glm-4-flash-8b', name: 'GLM-4 Flash-8B', pricing: { input: 0.05, output: 0.1 } },
       { id: 'glm-4v-plus', name: 'GLM-4V Plus', pricing: { input: 0.6, output: 2.2 } },
       { id: 'glm-4', name: 'GLM-4', pricing: { input: 0.5, output: 1.5 } },
       { id: 'glm-4-flash', name: 'GLM-4 Flash', pricing: { input: 0.1, output: 0.2 } },
       { id: 'glm-4-plus', name: 'GLM-4 Plus', pricing: { input: 0.5, output: 1.5 } },
       { id: 'glm-4v', name: 'GLM-4V (Vision)', pricing: { input: 0.6, output: 2.2 } }
     ],
     supportsVision: true,
     supportsImageGen: false
   },
   meta: {
     id: 'meta',
     name: 'Meta Llama',
     baseURL: 'https://api.meta.ai/v1',
     models: [
       { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', pricing: { input: 0.59, output: 0.79 } },
       { id: 'llama-3.3-8b', name: 'Llama 3.3 8B', pricing: { input: 0.05, output: 0.08 } },
       { id: 'llama-3.2-90b', name: 'Llama 3.2 90B', pricing: { input: 0.59, output: 0.79 } },
       { id: 'llama-3.2-70b', name: 'Llama 3.2 70B', pricing: { input: 0.59, output: 0.79 } },
       { id: 'llama-3.2-8b', name: 'Llama 3.2 8B', pricing: { input: 0.05, output: 0.08 } },
       { id: 'llama-4-405b', name: 'Llama 4 405B', pricing: { input: 3.5, output: 3.5 } },
       { id: 'llama-4-70b', name: 'Llama 4 70B', pricing: { input: 0.59, output: 0.79 } },
       { id: 'llama-4-8b', name: 'Llama 4 8B', pricing: { input: 0.05, output: 0.08 } },
       { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', pricing: { input: 3.5, output: 3.5 } },
       { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', pricing: { input: 0.59, output: 0.79 } },
       { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', pricing: { input: 0.05, output: 0.08 } },
       { id: 'llama-3-70b', name: 'Llama 3 70B', pricing: { input: 0.59, output: 0.79 } },
       { id: 'llama-3-8b', name: 'Llama 3 8B', pricing: { input: 0.05, output: 0.08 } }
     ],
     supportsVision: false,
     supportsImageGen: false
   },
   mistral: {
     id: 'mistral',
     name: 'Mistral',
     baseURL: 'https://api.mistral.ai/v1',
     models: [
       { id: 'mistral-large-3', name: 'Mistral Large 3', pricing: { input: 2.0, output: 6.0 } },
       { id: 'mistral-medium-3', name: 'Mistral Medium 3', pricing: { input: 1.0, output: 3.0 } },
       { id: 'mistral-small-3', name: 'Mistral Small 3', pricing: { input: 0.2, output: 0.6 } },
       { id: 'mistral-large', name: 'Mistral Large', pricing: { input: 2.0, output: 6.0 } },
       { id: 'mistral-medium', name: 'Mistral Medium', pricing: { input: 1.0, output: 3.0 } },
       { id: 'mistral-small', name: 'Mistral Small', pricing: { input: 0.2, output: 0.6 } },
       { id: 'mistral-codestral-latest', name: 'Mistral Codestral Latest', pricing: { input: 0.3, output: 0.9 } },
       { id: 'mixtral-8x22b', name: 'Mixtral 8x22B', pricing: { input: 2.0, output: 6.0 } },
       { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', pricing: { input: 0.24, output: 0.24 } },
       { id: 'mistral-nemo', name: 'Mistral NeMo', pricing: { input: 0.15, output: 0.15 } }
     ],
      supportsVision: false,
      supportsImageGen: false
    },
    deepseek: {
      id: 'deepseek',
      name: 'DeepSeek',
      baseURL: 'https://api.deepseek.com',
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek Chat', pricing: { input: 0.27, output: 1.1 } },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', pricing: { input: 0.55, output: 2.19 } },
        { id: 'deepseek-coder', name: 'DeepSeek Coder', pricing: { input: 0.27, output: 1.1 } },
        { id: 'deepseek-v3', name: 'DeepSeek V3', pricing: { input: 0.27, output: 1.1 } },
        { id: 'deepseek-r1', name: 'DeepSeek R1', pricing: { input: 0.55, output: 2.19 } }
      ],
      supportsVision: true,
      supportsImageGen: false
    },
    minimax: {
      id: 'minimax',
      name: 'MiniMax',
      // MiniMax's OpenAI-compatible endpoint (api.minimax.io/v1/chat/completions) is the
      // default: it's fully featured (tools, vision, streaming) and needs no request/response
      // translation since this app's internal format is already OpenAI-shaped.
      baseURL: 'https://api.minimax.io/v1',
      // MiniMax also exposes a separate Anthropic-compatible endpoint at
      // api.minimax.io/anthropic/v1/messages (only on M2+ models, and it doesn't support
      // every tool type). Off by default; a user can opt in via provider credentials by
      // setting a custom base URL to `anthropicBaseURL` and flipping anthropicCompatible.
      anthropicBaseURL: 'https://api.minimax.io/anthropic/v1',
      anthropicCompatible: false,
      models: [
        { id: 'minimax-m3', name: 'MiniMax M3', pricing: { input: 0.3, output: 1.2 } },
        { id: 'minimax-m2.5-highspeed', name: 'MiniMax M2.5 HighSpeed', pricing: { input: 0.3, output: 1.2 } },
        { id: 'minimax-m2.5', name: 'MiniMax M2.5', pricing: { input: 0.3, output: 1.2 } },
        { id: 'minimax-m2.1-highspeed', name: 'MiniMax M2.1 HighSpeed', pricing: { input: 0.3, output: 1.2 } },
        { id: 'minimax-m2.1', name: 'MiniMax M2.1', pricing: { input: 0.25, output: 1.0 } },
        { id: 'minimax-m2-highspeed', name: 'MiniMax M2 HighSpeed', pricing: { input: 0.3, output: 1.2 } },
        { id: 'minimax-m2', name: 'MiniMax M2', pricing: { input: 0.25, output: 1.0 } },
        { id: 'minimax-text-01', name: 'MiniMax Text-01', pricing: { input: 0.2, output: 1.1 } }
      ],
      supportsVision: true,
      supportsImageGen: true
    },
    google: {
      id: 'google',
      name: 'Google Gemini',
      baseURL: 'https://generativelanguage.googleapis.com/v1',
      models: [
        { id: 'gemini-3-pro', name: 'Gemini 3 Pro', pricing: { input: 2.5, output: 10.0 } },
        { id: 'gemini-3-flash', name: 'Gemini 3 Flash', pricing: { input: 0.1, output: 0.2 } },
        { id: 'gemini-3.1-preview', name: 'Gemini 3.1 Preview', pricing: { input: 2.5, output: 10.0 } },
        { id: 'gemini-2.0-flash-thinking', name: 'Gemini 2.0 Flash Thinking', pricing: { input: 0.1, output: 0.2 } },
        { id: 'gemini-2.0-flash-8b', name: 'Gemini 2.0 Flash 8B', pricing: { input: 0.05, output: 0.1 } },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', pricing: { input: 0.1, output: 0.2 } },
        { id: 'gemini-2.0-pro-thinking-exp', name: 'Gemini 2.0 Pro Thinking (Exp)', pricing: { input: 2.0, output: 8.0 } },
        { id: 'gemini-2.0-pro-exp', name: 'Gemini 2.0 Pro (Exp)', pricing: { input: 1.75, output: 7.0 } },
        { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', pricing: { input: 1.75, output: 7.0 } },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', pricing: { input: 1.25, output: 5.0 } },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', pricing: { input: 0.1, output: 0.2 } },
        { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', pricing: { input: 0.05, output: 0.1 } },
        { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', pricing: { input: 0.5, output: 1.5 } }
      ],
      supportsVision: true,
      supportsImageGen: true
    },
    alibaba: {
      id: 'alibaba',
      name: 'Alibaba Cloud (Qwen)',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      models: [
        { id: 'qwen-turbo', name: 'Qwen Turbo', pricing: { input: 0.05, output: 0.2 } },
        { id: 'qwen-plus', name: 'Qwen Plus', pricing: { input: 0.4, output: 1.2 } },
        { id: 'qwen-max', name: 'Qwen Max', pricing: { input: 1.6, output: 6.4 } },
        { id: 'qwen-vl-max', name: 'Qwen VL Max', pricing: { input: 1.6, output: 6.4 } },
        { id: 'qwen-vl-plus', name: 'Qwen VL Plus', pricing: { input: 0.4, output: 1.2 } },
        { id: 'qwen-vl-turbo', name: 'Qwen VL Turbo', pricing: { input: 0.05, output: 0.2 } },
        { id: 'qwen-72b-chat', name: 'Qwen 72B Chat', pricing: { input: 0.6, output: 0.6 } },
        { id: 'qwen-14b-chat', name: 'Qwen 14B Chat', pricing: { input: 0.2, output: 0.2 } },
        { id: 'qwen-7b-chat', name: 'Qwen 7B Chat', pricing: { input: 0.1, output: 0.1 } },
        { id: 'qwen-2.5-turbo', name: 'Qwen 2.5 Turbo', pricing: { input: 0.05, output: 0.2 } },
        { id: 'qwen-2.5-plus', name: 'Qwen 2.5 Plus', pricing: { input: 0.4, output: 1.2 } },
        { id: 'qwen-2.5-max', name: 'Qwen 2.5 Max', pricing: { input: 1.6, output: 6.4 } },
        { id: 'qwen-2.5-vl', name: 'Qwen 2.5 VL', pricing: { input: 0.4, output: 1.2 } },
        { id: 'qwen-max-longcontext', name: 'Qwen Max LongContext', pricing: { input: 1.6, output: 6.4 } }
      ],
      supportsVision: true,
      supportsImageGen: false
    },
openrouter: {
      id: 'openrouter',
      name: 'OpenRouter',
      baseURL: 'https://openrouter.ai/api/v1',
      models: [
        { id: 'deepseek-v3', name: 'DeepSeek V3', pricing: { input: 0.27, output: 1.1 } },
        { id: 'anthropic-claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', pricing: { input: 3.0, output: 15.0 } },
        { id: 'google-gemini-2.0-flash', name: 'Gemini 2.0 Flash', pricing: { input: 0.1, output: 0.2 } }
      ],
      supportsVision: false,
      supportsImageGen: false
    },
    groq: {
      id: 'groq',
      name: 'Groq',
      baseURL: 'https://api.groq.com/openai/v1',
      models: [
        { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', pricing: { input: 0.24, output: 0.24 } },
        { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', pricing: { input: 0.59, output: 0.79 } },
        { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', pricing: { input: 3.5, output: 3.5 } }
      ],
      supportsVision: false,
      supportsImageGen: false
    },
    custom: {
      id: 'custom',
      name: 'Custom URL',
      baseURL: '',
      models: [],
      supportsVision: false,
      supportsImageGen: false
    }
  }

export const DEFAULT_PROVIDER_CONFIG = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  customBaseURL: ''
}

export const PROVIDER_CREDENTIALS = {
  openai: { apiKey: '', baseURL: '' },
  anthropic: { apiKey: '', baseURL: '' },
  google: { apiKey: '', baseURL: '' },
  zai: { apiKey: '', baseURL: '' },
  meta: { apiKey: '', baseURL: '' },
  mistral: { apiKey: '', baseURL: '' },
  deepseek: { apiKey: '', baseURL: '' },
  minimax: { apiKey: '', baseURL: '' },
  alibaba: { apiKey: '', baseURL: '' },
  openrouter: { apiKey: '', baseURL: '' },
  groq: { apiKey: '', baseURL: '' },
  custom: { apiKey: '', baseURL: '' }
}

/**
 * Default enabled models per provider
 * Used when initializing new provider configurations
 */
export const DEFAULT_ENABLED_MODELS = {
  openai: ['gpt-5o', 'gpt-5o-mini'],
  anthropic: ['claude-4-sonnet', 'claude-4-haiku'],
  google: ['gemini-2.0-flash', 'gemini-1.5-flash'],
  meta: ['llama-3.3-70b', 'llama-3.1-8b'],
  mistral: ['mistral-large-3', 'mistral-small-3'],
  zai: ['glm-4.9-turbo', 'glm-4.9-flash'],
  deepseek: ['deepseek-v3', 'deepseek-chat'],
  minimax: ['minimax-m2.5', 'minimax-m2'],
  alibaba: ['qwen-turbo', 'qwen-plus'],
  openrouter: ['deepseek-v3', 'anthropic-claude-3.5-sonnet'],
  groq: ['mixtral-8x7b', 'llama-3.1-70b']
}

/**
 * Curated "recommended" subset shown at the top of each provider's model picker.
 * Every ID here MUST exist in that provider's PROVIDERS[id].models list above — this list
 * previously lived duplicated in options.js and had drifted to include IDs that don't exist
 * in the real catalog (gemini-2.5-pro, mistral-large-4, mistral-next-large, deepseek-r1-lite,
 * qwen-3.2, qwen-2.5-vl-plus, glm-4.5-pro), the same class of bug that broke MiniMax. Verify
 * against PROVIDERS[id].models whenever this changes.
 */
export const RECOMMENDED_MODELS = {
  openai: ['gpt-5o', 'gpt-5o-pro', 'gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-4.5-sonnet', 'claude-4.5-haiku', 'claude-4-opus', 'claude-4-sonnet'],
  google: ['gemini-3-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  zai: ['glm-5', 'glm-4.5-flash', 'glm-4.9-pro'],
  meta: ['llama-3.3-70b', 'llama-3.1-405b', 'llama-3.1-8b'],
  mistral: ['mistral-large-3', 'mistral-large', 'mixtral-8x7b'],
  deepseek: ['deepseek-v3', 'deepseek-chat', 'deepseek-r1'],
  minimax: ['minimax-m3', 'minimax-m2.5', 'minimax-m2'],
  alibaba: ['qwen-2.5-plus', 'qwen-max', 'qwen-2.5-vl'],
  openrouter: ['deepseek-v3', 'anthropic-claude-3.5-sonnet', 'google-gemini-2.0-flash'],
  groq: ['mixtral-8x7b', 'llama-3.1-70b', 'llama-3.1-405b']
}

export const DEFAULT_MODELS = [
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'llama-3-70b', name: 'Llama 3 70B', provider: 'Meta' },
  { id: 'mistral-large', name: 'Mistral Large', provider: 'Mistral' }
]

/**
 * LRU Cache implementation with size limits
 * Prevents unbounded memory growth
 */
class LRUCache {
  constructor(maxSize = 100, ttl = 5000) {
    this.maxSize = maxSize
    this.ttl = ttl
    this.cache = new Map()
    this.accessOrder = new Map() // Track access order
  }

  has(key) {
    if (!this.cache.has(key)) {
      return false
    }
    const item = this.cache.get(key)
    if (Date.now() - item.timestamp > this.ttl) {
      this.delete(key)
      return false
    }
    return true
  }

  get(key) {
    if (!this.cache.has(key)) {
      return undefined
    }

    const item = this.cache.get(key)

    // Check if expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.delete(key)
      return undefined
    }

    // Update access order (move to end)
    this.accessOrder.delete(key)
    this.accessOrder.set(key, Date.now())

    return item.value
  }

  set(key, value) {
    // Delete existing key to update access order
    if (this.cache.has(key)) {
      this.cache.delete(key)
      this.accessOrder.delete(key)
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.accessOrder.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
        this.accessOrder.delete(oldestKey)
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() })
    this.accessOrder.set(key, Date.now())
  }

  delete(key) {
    this.cache.delete(key)
    this.accessOrder.delete(key)
  }

  clear() {
    this.cache.clear()
    this.accessOrder.clear()
  }

  get size() {
    return this.cache.size
  }
}

class StorageManager {
  constructor() {
    // LRU cache with max 100 entries and 5 second TTL
    this.cache = new LRUCache(100, 5000)
  }

  async get(key, useCache = true) {
    if (useCache && this.cache.has(key)) {
      const cached = this.cache.get(key)
      if (cached && Date.now() - cached.timestamp < this.cache.ttl) {
        return cached.value
      }
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          console.error('Storage get error:', chrome.runtime.lastError)
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          const value = result[key]
          this.cache.set(key, { value, timestamp: Date.now() })
          resolve(value)
        }
      })
    })
  }

  estimateSize(value) {
    if (value === null || value === undefined) {
      return 0
    }

    if (typeof value === 'string') {
      return value.length * 2 // UTF-16
    }

    if (typeof value === 'number') {
      return 8
    }

    if (typeof value === 'boolean') {
      return 1
    }

    if (typeof value === 'object' || Array.isArray(value)) {
      try {
        const json = JSON.stringify(value)
        return json.length * 2
      } catch (error) {
        return 0
      }
    }

    return 0
  }

  async getCurrentUsage() {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse((bytesInUse) => {
        resolve(bytesInUse || 0)
      })
    })
  }

  _notifyQuotaWarning(key, currentUsage, totalSize) {
    const msg = {
      type: 'STORAGE_QUOTA_WARNING',
      key,
      currentUsage,
      requiredSize: totalSize,
      message: 'Storage quota nearly full. Consider clearing old data.'
    }
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(msg).catch(() => {})
    }
  }

  _notifyQuotaExceeded(key, errorMsg) {
    const msg = {
      type: 'STORAGE_QUOTA_EXCEEDED',
      key,
      message: 'Storage quota exceeded. Please clear old data.',
      error: errorMsg
    }
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(msg).catch(() => {})
    }
  }

  async set(key, value) {
    this.cache.delete(key)
    
    try {
      const valueSize = this.estimateSize(value)
      const keySize = key.length * 2
      const totalSize = valueSize + keySize
      const maxStorageSize = 10 * 1024 * 1024
      
      const currentUsage = await this.getCurrentUsage()
      
      if (currentUsage + totalSize > maxStorageSize) {
        console.warn(`Storage quota warning: Would exceed limit by ${(currentUsage + totalSize - maxStorageSize) / 1024}KB`)
        this._notifyQuotaWarning(key, currentUsage, totalSize)
      }
    } catch (error) {
      console.error('Failed to check storage quota:', error)
    }
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage set error:', chrome.runtime.lastError)
          
          if (chrome.runtime.lastError.message && 
              chrome.runtime.lastError.message.includes('QUOTA')) {
            this._notifyQuotaExceeded(key, chrome.runtime.lastError.message)
          }
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })
  }

  async remove(key) {
    this.cache.delete(key)
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(key, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage remove error:', chrome.runtime.lastError)
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })
  }

  async getSettings() {
    const settings = await this.get(STORAGE_KEYS.SETTINGS)
    return { ...DEFAULT_SETTINGS, ...settings }
  }

  async saveSettings(settings) {
    // Merge-on-write: preserve any keys not present in the incoming partial
    // object. Historically this was a raw replace, which silently wiped
    // settings the caller didn't load first (e.g. webSearchEnabled or
    // autoAttachEnabled when the options form saved) — masking the loss via
    // getSettings()'s DEFAULT_SETTINGS merge and silently disabling features.
    const existing = await this.get(STORAGE_KEYS.SETTINGS)
    await this.set(STORAGE_KEYS.SETTINGS, { ...existing, ...settings })
  }

  async getAPIKey() {
    const config = await this.getProviderConfig()
    if (config && config.apiKey) {
      try {
        return await this.decrypt(config.apiKey)
      } catch (error) {
        console.error('Failed to decrypt API key:', error)
        return null
      }
    }
    const encrypted = await this.get(STORAGE_KEYS.API_KEY)
    if (!encrypted) return null
    
    try {
      return await this.decrypt(encrypted)
    } catch (error) {
      console.error('Failed to decrypt API key:', error)
      return null
    }
  }

  async setAPIKey(apiKey, provider = 'openai') {
    const encrypted = await this.encrypt(apiKey)
    const config = await this.getProviderConfig()
    config.provider = provider
    config.apiKey = encrypted
    await this.setProviderConfig(config)
    await this.set(STORAGE_KEYS.API_KEY, encrypted)
  }

  async getProviderCredentials(providerId) {
    const allCredentials = await this.get(STORAGE_KEYS.PROVIDER_CREDENTIALS) || { ...PROVIDER_CREDENTIALS }
    return allCredentials[providerId] || { apiKey: '', baseURL: '' }
  }

  async setProviderCredentials(providerId, apiKey, baseURL = '') {
    const allCredentials = await this.get(STORAGE_KEYS.PROVIDER_CREDENTIALS) || { ...PROVIDER_CREDENTIALS }
    allCredentials[providerId] = {
      apiKey: apiKey || '',
      baseURL: baseURL || ''
    }
    await this.set(STORAGE_KEYS.PROVIDER_CREDENTIALS, allCredentials)
  }

  async getAllProviderCredentials() {
    const allCredentials = await this.get(STORAGE_KEYS.PROVIDER_CREDENTIALS) || { ...PROVIDER_CREDENTIALS }
    return allCredentials
  }

  async getAPIKeyForModel(modelId) {
    const provider = this.getProviderForModel(modelId)
    const creds = await this.getProviderCredentials(provider.id)
    if (creds.apiKey) return creds.apiKey
    
    const config = await this.getProviderConfig()
    if (config && config.apiKey) {
      try {
        return await this.decrypt(config.apiKey)
      } catch (e) {
        return null
      }
    }
    const encrypted = await this.get(STORAGE_KEYS.API_KEY)
    if (!encrypted) return null
    try {
      return await this.decrypt(encrypted)
    } catch (error) {
      return null
    }
  }

  async getBaseURLForModel(modelId) {
    const provider = this.getProviderForModel(modelId)
    const creds = await this.getProviderCredentials(provider.id)
    if (creds.baseURL) return creds.baseURL
    
    return provider.baseURL
  }

  async getProviderConfig() {
    const config = await this.get(STORAGE_KEYS.PROVIDER_CONFIG)
    return { ...DEFAULT_PROVIDER_CONFIG, ...config }
  }

  async setProviderConfig(config) {
    await this.set(STORAGE_KEYS.PROVIDER_CONFIG, config)
  }

  getProviderForModel(modelId) {
    for (const [key, provider] of Object.entries(PROVIDERS)) {
      if (key === 'custom') continue
      const model = provider.models.find(m => m.id === modelId)
      if (model) return provider
    }
    return PROVIDERS.openai
  }

  getProviderBaseURL(providerId, customURL = '') {
    if (providerId === 'custom' && customURL) {
      return customURL.endsWith('/') ? customURL.slice(0, -1) : customURL
    }
    return PROVIDERS[providerId]?.baseURL || PROVIDERS.openai.baseURL
  }

  async getAPIConfig(modelId = null) {
    const config = await this.getProviderConfig()
    const provider = PROVIDERS[config.provider] || PROVIDERS.openai

    let baseURL = provider.baseURL
    let apiKey = null
    let modelProvider = provider

    if (modelId) {
      modelProvider = this.getProviderForModel(modelId)
      const creds = await this.getProviderCredentials(modelProvider.id)
      if (creds.baseURL) baseURL = creds.baseURL
      apiKey = creds.apiKey
    }

    if (!apiKey) {
      if (config && config.apiKey) {
        try {
          apiKey = await this.decrypt(config.apiKey)
        } catch (e) {
          apiKey = null
        }
      }
      if (!apiKey) {
        const encrypted = await this.get(STORAGE_KEYS.API_KEY)
        if (encrypted) {
          try {
            apiKey = await this.decrypt(encrypted)
          } catch (e) {
            apiKey = null
          }
        }
      }
    }

    return {
      baseURL: baseURL,
      model: config.model || 'gpt-4o-mini',
      provider: modelProvider.id,
      apiKey: apiKey,
      supportsVision: modelProvider.supportsVision,
      supportsImageGen: modelProvider.supportsImageGen
    }
  }

  async setAPIConfig(config) {
    const currentConfig = await this.getProviderConfig()
    if (config.provider) currentConfig.provider = config.provider
    if (config.model) currentConfig.model = config.model
    if (config.customBaseURL !== undefined) currentConfig.customBaseURL = config.customBaseURL
    await this.setProviderConfig(currentConfig)
    
    if (config.baseURL) {
      await this.set(STORAGE_KEYS.API_BASE_URL, config.baseURL)
    }
    if (config.model) {
      await this.set(STORAGE_KEYS.MODEL, config.model)
    }
  }

  async getChatHistory() {
    const history = await this.get(STORAGE_KEYS.CHAT_HISTORY)
    return history || []
  }

  async saveChatHistory(history) {
    const trimmed = history.slice(-100)
    await this.set(STORAGE_KEYS.CHAT_HISTORY, trimmed)
  }

  async clearChatHistory() {
    await this.remove(STORAGE_KEYS.CHAT_HISTORY)
  }

  async getUserPreferences() {
    const prefs = await this.get(STORAGE_KEYS.USER_PREFERENCES)
    return prefs || { firstRun: true, lastModel: null }
  }

  async setUserPreferences(prefs) {
    await this.set(STORAGE_KEYS.USER_PREFERENCES, prefs)
  }

  async getEnabledModels() {
    return (await this.get(STORAGE_KEYS.ENABLED_MODELS)) || []
  }

  async setEnabledModels(models) {
    await this.set(STORAGE_KEYS.ENABLED_MODELS, models)
  }

  async saveConversation(name, history) {
    if (typeof name !== 'string' || !name || name.length > 200) {
      throw new Error('Invalid conversation name')
    }
    if (!Array.isArray(history)) {
      throw new Error('Conversation history must be an array')
    }
    const historySize = JSON.stringify(history).length
    if (historySize > 5 * 1024 * 1024) {
      throw new Error('Conversation history too large (max 5MB)')
    }
    const conversations = await this.getConversations()
    conversations[name] = {
      history,
      timestamp: Date.now()
    }
    await this.set('conversations', conversations)
    try {
      const { conversationMemory } = await import('./conversation-memory.js')
      conversationMemory.indexConversation(name, history)
    } catch {}
  }

  async getConversations() {
    return (await this.get('conversations')) || {}
  }

  async deleteConversation(name) {
    const conversations = await this.getConversations()
    delete conversations[name]
    await this.set('conversations', conversations)
    try {
      const { conversationMemory } = await import('./conversation-memory.js')
      conversationMemory.unindexConversation(name)
    } catch {}
  }

  async encrypt(data) {
    // Handle non-string data
    if (typeof data !== 'string') {
      data = JSON.stringify(data)
    }
    
    // If data is empty, return empty string
    if (!data) {
      return ''
    }

    const key = await this.getOrGenerateEncryptionKey()
    
    // If encryption is not available, fallback to base64 encoding
    if (!key) {
      return btoa(data)
    }

    try {
      const encoder = new TextEncoder()
      const dataBuffer = encoder.encode(data)

      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBuffer
      )

      const ivArray = Array.from(iv)
      const encryptedArray = Array.from(new Uint8Array(encryptedBuffer))

      return JSON.stringify({ iv: ivArray, data: encryptedArray })
    } catch (error) {
      console.error('[Storage] Encrypt failed, falling back to base64:', error)
      return btoa(data)
    }
  }

  async decrypt(encryptedData) {
    try {
      // Handle case where data is already decrypted (plaintext)
      if (typeof encryptedData !== 'string') {
        console.debug('[Storage] Data is not encrypted, returning as-is')
        return encryptedData
      }
      
      // Try to parse as JSON first (encrypted data)
      let parsedData;
      try {
        parsedData = JSON.parse(encryptedData)
      } catch (parseError) {
        // If it's not JSON, it might be base64 encoded plaintext
        try {
          console.debug('[Storage] Trying base64 decode for plaintext')
          return atob(encryptedData)
        } catch (base64Error) {
          console.debug('[Storage] Returning data as-is')
          return encryptedData
        }
      }
      
      // If we have parsed JSON data, it should be encrypted
      const key = await this.getOrGenerateEncryptionKey()
      
      // If encryption is not available, return the data as-is
      if (!key) {
        console.debug('[Storage] No encryption key available, returning parsed data')
        return parsedData.data || parsedData
      }
      
      // Extract iv and data from parsed object
      const { iv, data } = parsedData
      
      if (!iv || !data) {
        console.warn('[Storage] Invalid encrypted data format')
        return encryptedData
      }

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        new Uint8Array(data)
      )

      const decoder = new TextDecoder()
      return decoder.decode(decryptedBuffer)
    } catch (error) {
      console.error('[Storage] Decrypt failed:', error)
      
      // Try to return the original data as a fallback
      try {
        if (typeof encryptedData === 'string') {
          return atob(encryptedData)
        }
      } catch (fallbackError) {
        console.error('[Storage] Fallback also failed:', fallbackError)
      }
      
      return encryptedData
    }
  }

  async getOrGenerateEncryptionKey() {
    try {
      if (!crypto || !crypto.subtle) {
        console.warn('[Storage] Crypto.subtle not available, using plaintext storage')
        return null
      }

      const result = await new Promise((resolve, reject) => {
        try {
          chrome.storage.local.get(['encryption_key'], (items) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'Storage access error'))
            } else {
              resolve(items)
            }
          })
        } catch (storageError) {
          reject(storageError)
        }
      })
      
      const storedKeyData = result.encryption_key

      if (storedKeyData) {
        let keyBuffer;
        if (Array.isArray(storedKeyData)) {
          keyBuffer = new Uint8Array(storedKeyData)
        } else if (storedKeyData instanceof Uint8Array) {
          keyBuffer = storedKeyData
        } else {
          keyBuffer = new Uint8Array(Object.values(storedKeyData))
        }
        
        return await crypto.subtle.importKey(
          'raw',
          keyBuffer,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        )
      }

      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      )

      const exportedKey = await crypto.subtle.exportKey('raw', key)
      await new Promise((resolve, reject) => {
        try {
          chrome.storage.local.set({
            encryption_key: Array.from(new Uint8Array(exportedKey))
          }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'Failed to save encryption key'))
            } else {
              resolve()
            }
          })
        } catch (storageError) {
          reject(storageError)
        }
      })

      return key
    } catch (error) {
      const errorMessage = error.message || error.name || String(error)
      console.warn('[Storage] Encryption key unavailable, using plaintext fallback:', errorMessage)
      return null
    }
  }

  async deleteProviderCredentials(providerId) {
    const allCredentials = await this.get(STORAGE_KEYS.PROVIDER_CREDENTIALS) || { ...PROVIDER_CREDENTIALS }
    if (allCredentials[providerId]) {
      delete allCredentials[providerId]
      await this.set(STORAGE_KEYS.PROVIDER_CREDENTIALS, allCredentials)
    }
  }

  clearCache() {
    this.cache.clear()
  }
}

export const storage = new StorageManager()

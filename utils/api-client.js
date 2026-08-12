import { APIError, NetworkError, AuthError, RateLimitError, ValidationError, classifyError, ErrorCodes, UserAbortError } from './errors.js'
import { storage, PROVIDERS } from './storage.js'
import { inputValidator } from './input-validator.js'

function usesMaxCompletionTokens(modelId) {
  const modelIdLower = modelId?.toLowerCase() || ''
  return (
    modelIdLower.startsWith('o1-') ||
    modelIdLower.startsWith('o3-') ||
    modelIdLower === 'o1' ||
    modelIdLower.startsWith('gpt-5') ||
    modelIdLower.startsWith('gpt-4.1')
  )
}

export class APIClient {
  constructor() {
    this.defaultConfig = {
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 2000
    }
    this.retryConfig = {
      maxAttempts: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    }
    this.circuitBreaker = {
      failures: 0,
      threshold: 5,
      resetTimeout: 60000,
      isOpen: false,
      lastFailure: 0
    }
    this.modelCache = {}
    this.abortController = null
  }

  async chat(messages, options = {}) {
    const modelId = options.model || this.defaultConfig.model

    const apiConfig = await storage.getAPIConfig(modelId)
    const baseURL = await storage.getBaseURLForModel(modelId)
    const apiKey = await storage.getAPIKeyForModel(modelId)
    
    if (!apiKey) {
      throw new AuthError('No API key configured. Please add your API key in settings.')
    }

    const config = {
      ...this.defaultConfig,
      ...apiConfig,
      baseURL: baseURL,
      ...options
    }

    const provider = storage.getProviderForModel(modelId)
    
    const validation = inputValidator.validateChatRequest(messages, config)
    if (!validation.valid) {
      throw new ValidationError('Input validation failed', validation.errors, validation.warnings)
    }
    
    const sanitizedMessages = messages.map(msg => ({
      ...msg,
      content: inputValidator.sanitizeContent(msg.content)
    }))
    
    const requestBody = this.buildRequestBody(config, sanitizedMessages, provider)
    const headers = this.buildHeaders(apiKey, config, provider)

    return this.executeWithRetry(
      () => this.makeRequest(config.baseURL, headers, requestBody, provider, apiKey, { signal: options.signal, timeoutMs: options.timeoutMs }),
      options.retryCount || 0
    )
  }

  /**
   * True if this provider speaks the Anthropic Messages API shape (system as a top-level
   * field, tool schemas as {name, description, input_schema}, tool_use/tool_result content
   * blocks) rather than the OpenAI Chat Completions shape. Driven by the `anthropicCompatible`
   * flag on the provider entry (utils/storage.js PROVIDERS) so any provider — native Anthropic,
   * MiniMax's optional Anthropic-compatible endpoint, or a future one — gets the same bridging
   * without provider-by-provider special casing.
   */
  isAnthropicShaped(config, provider) {
    return config?.provider === 'anthropic' || provider?.id === 'anthropic' || !!provider?.anthropicCompatible
  }

  /**
   * Convert an OpenAI-shaped tool def ({type:'function', function:{name, description, parameters}})
   * — the shape used everywhere else in this codebase (service-worker-tools.js, skills/*) — into
   * Anthropic's shape ({name, description, input_schema}). Passes through untouched if it's
   * already Anthropic-shaped.
   */
  toAnthropicTool(tool) {
    if (tool && tool.input_schema && !tool.function) return tool
    const fn = tool?.function || tool || {}
    return {
      name: fn.name,
      description: fn.description || '',
      input_schema: fn.parameters || { type: 'object', properties: {} }
    }
  }

  buildHeaders(apiKey, config, provider) {
    const headers = {
      'Content-Type': 'application/json'
    }

    if (this.isAnthropicShaped(config, provider)) {
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
    } else if (config.provider === 'google') {
      // Google's Generative Language API authenticates via a `key` query param
      // (added in makeRequest/streamChat), not a Bearer header.
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    return headers
  }

  buildRequestBody(config, messages, provider) {
    const body = {
      model: config.model,
      temperature: config.temperature ?? 0.7,
      stream: config.streaming || false
    }

    const isAnthropic = this.isAnthropicShaped(config, provider)
    const usesMaxComp = usesMaxCompletionTokens(config.model) && !isAnthropic

    if (usesMaxComp) {
      body.max_completion_tokens = config.maxTokens ?? 2000
    } else {
      body.max_tokens = config.maxTokens ?? 2000
    }

    const hasImages = messages.some(m => m.images?.length || m.files?.length)
    const formatted = hasImages
      ? this.buildMultiModalMessages(messages, provider)
      : messages

    if (isAnthropic) {
      // Anthropic's Messages API takes `system` as a top-level string, not a message with
      // role "system" inside the `messages` array — sending it inline is rejected by the API.
      const systemParts = formatted
        .filter(m => m.role === 'system')
        .map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
      if (systemParts.length) {
        body.system = systemParts.join('\n\n')
      }
      body.messages = formatted.filter(m => m.role !== 'system')
      body.max_tokens = body.max_tokens || 4096
    } else {
      switch (config.provider) {
        case 'google':
          body.contents = hasImages
            ? formatted.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: m.parts
              }))
            : this.convertToGoogleFormat(messages)
          body.generationConfig = {
            temperature: body.temperature,
            maxOutputTokens: body.max_tokens,
            topP: 0.95,
            topK: 40
          }
          delete body.temperature
          delete body.max_tokens
          break
        case 'zai':
          body.messages = formatted
          break
        default:
          body.messages = formatted
      }
    }

    return body
  }

  /**
   * Convert chat messages to provider-specific multi-modal format.
   * Supports vision input: messages with `.images` (array of {dataUrl, mediaType})
   * and `.files` (array of {name, content, mimeType}) are formatted per-provider.
   */
  buildMultiModalMessages(messages, provider) {
    return messages.map(msg => {
      if (!msg.images?.length && !msg.files?.length) {
        return msg
      }

      switch (provider.id) {
        case 'anthropic': {
          const content = []
          if (typeof msg.content === 'string' && msg.content) {
            content.push({ type: 'text', text: msg.content })
          }
          for (const img of msg.images || []) {
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: img.mediaType || 'image/png',
                data: img.dataUrl.split(',')[1] || img.dataUrl
              }
            })
          }
          for (const file of msg.files || []) {
            content.push({
              type: 'text',
              text: `[File: ${file.name}]\n${file.content}`
            })
          }
          return { role: msg.role, content }
        }
        case 'google': {
          const parts = []
          if (typeof msg.content === 'string' && msg.content) {
            parts.push({ text: msg.content })
          }
          for (const img of msg.images || []) {
            parts.push({
              inline_data: {
                mime_type: img.mediaType || 'image/png',
                data: img.dataUrl.split(',')[1] || img.dataUrl
              }
            })
          }
          for (const file of msg.files || []) {
            parts.push({ text: `[File: ${file.name}]\n${file.content}` })
          }
          return { role: msg.role === 'assistant' ? 'model' : 'user', parts }
        }
        default: {
          const content = []
          if (typeof msg.content === 'string' && msg.content) {
            content.push({ type: 'text', text: msg.content })
          }
          for (const img of msg.images || []) {
            content.push({
              type: 'image_url',
              image_url: {
                url: img.dataUrl,
                detail: img.detail || 'auto'
              }
            })
          }
          for (const file of msg.files || []) {
            content.push({
              type: 'text',
              text: `[File: ${file.name}]\n${file.content}`
            })
          }
          return { role: msg.role, content }
        }
      }
    })
  }

  convertToGoogleFormat(messages) {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))
  }

  parseResponse(responseData, config, provider) {
    if (this.isAnthropicShaped(config, provider)) {
      // Anthropic returns a `content` array of typed blocks (text and/or tool_use) instead of
      // OpenAI's single message.content string + separate tool_calls array. Normalize both into
      // the same {choices:[{message:{content, tool_calls}}]} shape so the rest of the app
      // (chatWithTools, streaming UI, token-usage badge) doesn't need to know which provider
      // answered.
      const blocks = Array.isArray(responseData?.content) ? responseData.content : []
      const textContent = blocks.filter(b => b.type === 'text').map(b => b.text).join('')
      const toolUseBlocks = blocks.filter(b => b.type === 'tool_use')

      const message = { role: 'assistant', content: textContent }
      if (toolUseBlocks.length) {
        message.tool_calls = toolUseBlocks.map(b => ({
          id: b.id,
          type: 'function',
          function: { name: b.name, arguments: JSON.stringify(b.input || {}) }
        }))
        // Preserve the raw content blocks so a multi-turn tool loop can echo them back exactly
        // as Anthropic requires (see chatWithTools) — flattening to text would lose the
        // tool_use block the API needs to match against the following tool_result.
        message._rawContent = blocks
      }

      const usage = responseData?.usage
        ? {
            ...responseData.usage,
            total_tokens: (responseData.usage.input_tokens || 0) + (responseData.usage.output_tokens || 0)
          }
        : undefined

      return {
        choices: [{ message, finish_reason: responseData?.stop_reason }],
        usage
      }
    }

    switch (provider.id) {
      case 'google':
        return {
          choices: [{
            message: {
              role: 'assistant',
              content: responseData.candidates?.[0]?.content?.parts?.[0]?.text || ''
            }
          }]
        }
      default:
        return responseData
    }
  }

  async makeRequest(baseURL, headers, body, provider, apiKey = null, { signal, timeoutMs = 60000 } = {}) {
    if (signal?.aborted) throw new UserAbortError()

    if (this.circuitBreaker.isOpen) {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailure
      if (timeSinceLastFailure < this.circuitBreaker.resetTimeout) {
        throw new NetworkError('Service temporarily unavailable due to repeated failures')
      }
      this.circuitBreaker.isOpen = false
      this.circuitBreaker.failures = 0
    }

    let url = `${baseURL}/chat/completions`
    if (provider.id === 'google') {
      url = `${baseURL}/models/${body.model}:generateContent`
      if (apiKey) url += `?key=${encodeURIComponent(apiKey)}`
      delete body.model
    } else if (this.isAnthropicShaped(null, provider)) {
      url = `${baseURL}/messages`
    } else if (provider.id === 'zai') {
      url = `${baseURL}/chat/completions`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    let externalAbortListener = null
    if (signal) {
      externalAbortListener = () => controller.abort()
      signal.addEventListener('abort', externalAbortListener, { once: true })
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw this.handleAPIError(response.status, errorData, provider)
      }

      this.circuitBreaker.failures = 0
      const responseData = await response.json()
      return this.parseResponse(responseData, {}, provider)

    } catch (error) {
      clearTimeout(timeoutId)

      if (error.name === 'AbortError') {
        if (signal?.aborted) throw new UserAbortError()
        throw new NetworkError('Request timed out')
      }

      this.circuitBreaker.failures++
      this.circuitBreaker.lastFailure = Date.now()

      if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
        this.circuitBreaker.isOpen = true
      }

      throw classifyError(error)
    } finally {
      if (externalAbortListener && signal) {
        signal.removeEventListener('abort', externalAbortListener)
      }
    }
  }

  handleAPIError(status, errorData, provider) {
    let errorMessage = errorData.error?.message || errorData.message || 'Unknown error'

    if (provider.id === 'anthropic') {
      errorMessage = errorData.error?.message || errorMessage
    }

    switch (status) {
      case 401:
        return new AuthError('Invalid API key. Please check your settings.')
      case 403:
        return new AuthError('Access forbidden. API key may not have required permissions.')
      case 404:
        return new APIError(`Model not found: ${errorMessage}`, ErrorCodes.MODEL_NOT_FOUND, 404)
      case 429:
        const retryAfter = parseInt(errorData.error?.retry_after || errorData.retry_after || '60')
        return new RateLimitError(`Rate limit exceeded. Please wait ${retryAfter} seconds.`, retryAfter)
      case 500:
      case 502:
      case 503:
        return new APIError('Server error. Please try again later.', ErrorCodes.SERVER_ERROR, status)
      default:
        return new APIError(errorMessage, ErrorCodes.UNKNOWN_ERROR, status)
    }
  }

  async executeWithRetry(fn, attempt = 0) {
    try {
      return await fn()
    } catch (error) {
      if (!error.recoverable || attempt >= this.retryConfig.maxAttempts) {
        throw error
      }

      const delay = this.calculateBackoff(attempt)
      await this.sleep(delay)

      return this.executeWithRetry(fn, attempt + 1)
    }
  }

  calculateBackoff(attempt) {
    const baseDelay = this.retryConfig.initialDelay
    const maxDelay = 30000
    const jitter = Math.random() * 1000
    const delay = Math.min(
      baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt) + jitter,
      maxDelay
    )
    return delay
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async validateAPIKey(apiKey, provider = 'openai', customBaseURL = '') {
    const baseURL = storage.getProviderBaseURL(provider, customBaseURL)
    const providerInfo = PROVIDERS[provider]

    try {
      const headers = {
        'Content-Type': 'application/json'
      }

      if (provider === 'anthropic') {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
      } else if (provider === 'google') {
        headers['Authorization'] = `Bearer ${apiKey}`
      } else if (provider === 'minimax' && providerInfo?.anthropicCompatible) {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      let url = `${baseURL}/models`

      if (provider === 'google') {
        url = `${baseURL}/models?key=${apiKey}`
        delete headers['Authorization']
        headers['Content-Type'] = 'application/json'
      } else if (provider === 'minimax' && providerInfo?.anthropicCompatible) {
        url = `${baseURL}/models`
      }

      const response = await fetch(url, {
        method: 'GET',
        headers
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (provider === 'google') {
        return {
          valid: true,
          models: data.models?.slice(0, 10).map(m => ({ id: m.name, name: m.name })) || []
        }
      }

      return {
        valid: true,
        models: data.data?.slice(0, 10).map(m => ({ id: m.id, name: m.id })) || []
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message
      }
    }
  }

  async testConnection() {
    const apiKey = await storage.getAPIKey()
    const config = await storage.getAPIConfig()

    if (!apiKey) {
      return { success: false, error: 'No API key configured' }
    }

    return this.validateAPIKey(apiKey, config.provider, config.customBaseURL)
  }

  resetCircuitBreaker() {
    this.circuitBreaker.isOpen = false
    this.circuitBreaker.failures = 0
    console.debug('Circuit breaker reset')
  }

  async chatWithTools(messages, tools, options = {}) {
    const modelId = options.model || this.defaultConfig.model
    const apiConfig = await storage.getAPIConfig(modelId)
    const baseURL = await storage.getBaseURLForModel(modelId)
    const apiKey = await storage.getAPIKeyForModel(modelId)

    if (!apiKey) {
      throw new AuthError('No API key configured. Please add your API key in settings.')
    }

    const provider = storage.getProviderForModel(modelId)
    const config = {
      ...this.defaultConfig,
      ...apiConfig,
      baseURL,
      model: modelId,
      ...options
    }

    const anthropicShaped = this.isAnthropicShaped(config, provider)
    const deniedMessage = 'Action denied by user. The user declined this browser action. Try a different approach or ask the user what they want to do.'

    let currentMessages = messages.map(msg => ({ role: msg.role, content: msg.content }))
    let maxIterations = 10
    let iterations = 0

    while (iterations < maxIterations) {
      iterations++

      if (options.signal?.aborted) throw new UserAbortError()

      const body = this.buildRequestBody(config, currentMessages, provider)
      // Anthropic's tool schema ({name, description, input_schema}) differs from the
      // OpenAI-shaped defs used everywhere else in this app — convert only when needed so
      // every tool caller (service-worker-tools.js, skills/*) can stay OpenAI-shaped.
      body.tools = anthropicShaped ? tools.map(t => this.toAnthropicTool(t)) : tools
      const headers = this.buildHeaders(apiKey, config, provider)

      const responseData = await this.makeRequest(baseURL, headers, body, provider, apiKey, { signal: options.signal, timeoutMs: options.timeoutMs })
      const parsed = this.parseResponse(responseData, config, provider)
      const assistantMessage = parsed.choices?.[0]?.message

      if (!assistantMessage?.tool_calls || assistantMessage.tool_calls.length === 0) {
        return parsed
      }

      // Echo the assistant turn back exactly as the provider expects it. Anthropic requires
      // the original tool_use content blocks (not a flattened string) so it can match the
      // tool_result that follows; OpenAI just wants the message as parsed.
      if (anthropicShaped && assistantMessage._rawContent) {
        currentMessages.push({ role: 'assistant', content: assistantMessage._rawContent })
      } else {
        currentMessages.push(assistantMessage)
      }

      if (anthropicShaped) {
        // Anthropic expects all of this turn's tool results batched into a single user
        // message of tool_result content blocks, not one message per tool call.
        const resultBlocks = []
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name
          let toolArgs = {}
          try { toolArgs = JSON.parse(toolCall.function.arguments) } catch { toolArgs = {} }

          try {
            if (options.approvalCallback) {
              const approved = await options.approvalCallback(toolName, toolArgs)
              if (!approved) {
                resultBlocks.push({
                  type: 'tool_result',
                  tool_use_id: toolCall.id,
                  content: JSON.stringify({ error: deniedMessage }),
                  is_error: true
                })
                continue
              }
            }

            const { executeTool } = await import('../background/service-worker-tools.js')
            const result = await executeTool(toolName, toolArgs)
            resultBlocks.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: JSON.stringify(result)
            })
          } catch (toolError) {
            resultBlocks.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: JSON.stringify({ error: toolError.message }),
              is_error: true
            })
          }
        }
        currentMessages.push({ role: 'user', content: resultBlocks })
      } else {
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name
          let toolArgs = {}
          try { toolArgs = JSON.parse(toolCall.function.arguments) } catch { toolArgs = {} }

          try {
            if (options.approvalCallback) {
              const approved = await options.approvalCallback(toolName, toolArgs)
              if (!approved) {
                currentMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: deniedMessage })
                })
                continue
              }
            }

            const { executeTool } = await import('../background/service-worker-tools.js')
            const result = await executeTool(toolName, toolArgs)
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            })
          } catch (toolError) {
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: toolError.message })
            })
          }
        }
      }
    }

    throw new APIError('Maximum tool usage iterations exceeded', ErrorCodes.UNKNOWN_ERROR)
  }

  async getModelsForProvider(providerId, apiKey, baseURL = '', forceRefresh = false) {
    const cacheKey = `models_${providerId}_${baseURL}`
    const cached = this.modelCache?.[cacheKey]

    if (!forceRefresh && cached && (Date.now() - cached.timestamp < 300000)) {
      return cached.data
    }

    if (forceRefresh) {
      delete this.modelCache?.[cacheKey]
    }

    if (!apiKey) {
      return { error: 'No API key provided' }
    }

    const provider = PROVIDERS[providerId]
    if (!provider) {
      return { error: `Unknown provider: ${providerId}` }
    }

    const url = (baseURL || provider.baseURL || '').replace(/\/$/, '')

    try {
      const headers = { 'Content-Type': 'application/json' }
      let endpoint = `${url}/models`

      if (providerId === 'anthropic') {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
      } else if (providerId === 'google') {
        endpoint = `${url}/models?key=${encodeURIComponent(apiKey)}`
      } else if (providerId === 'minimax' && provider.anthropicCompatible) {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      const response = await fetch(endpoint, { method: 'GET', headers })

      if (!response.ok) {
        return { error: `Failed to fetch models: HTTP ${response.status}` }
      }

      const data = await response.json()
      let models = []

      if (providerId === 'google') {
        models = (data.models || []).slice(0, 50).map(m => ({ id: m.name, name: m.name }))
      } else {
        models = (data.data || []).slice(0, 50).map(m => ({ id: m.id, name: m.id }))
      }

      if (!this.modelCache) this.modelCache = {}
      this.modelCache[cacheKey] = { timestamp: Date.now(), data: { models } }

      return { models }
    } catch (error) {
      return { error: `Failed to fetch models: ${error.message}` }
    }
  }

  clearModelCache(providerId, baseURL = '') {
    const cacheKey = `models_${providerId}_${baseURL}`
    if (this.modelCache?.[cacheKey]) {
      delete this.modelCache[cacheKey]
      return { success: true, message: 'Cache cleared' }
    }
    return { success: true, message: 'No cache to clear' }
  }

  /**
   * Execute a single streaming HTTP request and collect both the incrementally-emitted text
   * (forwarded live via onChunk, exactly as before tool support existed) and any tool-call
   * deltas, which arrive incrementally too and must be reassembled: OpenAI sends
   * `delta.tool_calls[].function.{name,arguments}` fragments keyed by array index; Anthropic
   * sends `content_block_start` (id/name, empty input) then `content_block_delta` events of
   * type `input_json_delta` whose `partial_json` fragments concatenate into the full input.
   */
  async _streamOneTurn(url, headers, body, provider, anthropicShaped, onChunk, { signal, timeoutMs = 120000 } = {}) {
    if (signal?.aborted) throw new UserAbortError()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    let externalAbortListener = null
    if (signal) {
      externalAbortListener = () => controller.abort()
      signal.addEventListener('abort', externalAbortListener, { once: true })
    }

    let text = ''
    let stopReason = null
    const toolCallsByIndex = new Map()

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw this.handleAPIError(response.status, errorData, provider)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            let chunk = ''

            if (anthropicShaped) {
              if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
                toolCallsByIndex.set(parsed.index, {
                  id: parsed.content_block.id,
                  name: parsed.content_block.name,
                  argsJson: ''
                })
              } else if (parsed.type === 'content_block_delta') {
                if (parsed.delta?.type === 'text_delta') {
                  chunk = parsed.delta.text || ''
                } else if (parsed.delta?.type === 'input_json_delta') {
                  const entry = toolCallsByIndex.get(parsed.index)
                  if (entry) entry.argsJson += parsed.delta.partial_json || ''
                }
              } else if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
                stopReason = parsed.delta.stop_reason
              }
            } else if (provider.id === 'google') {
              if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                chunk = parsed.candidates[0].content.parts[0].text
              }
            } else {
              const delta = parsed.choices?.[0]?.delta
              chunk = delta?.content || ''
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0
                  if (!toolCallsByIndex.has(idx)) {
                    toolCallsByIndex.set(idx, { id: tc.id || '', name: '', argsJson: '' })
                  }
                  const entry = toolCallsByIndex.get(idx)
                  if (tc.id) entry.id = tc.id
                  if (tc.function?.name) entry.name += tc.function.name
                  if (tc.function?.arguments) entry.argsJson += tc.function.arguments
                }
              }
              if (parsed.choices?.[0]?.finish_reason) {
                stopReason = parsed.choices[0].finish_reason
              }
            }

            if (chunk) {
              text += chunk
              onChunk(chunk, text)
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      this.circuitBreaker.failures = 0

      const toolCalls = [...toolCallsByIndex.values()].map(tc => {
        let args = {}
        try { args = tc.argsJson ? JSON.parse(tc.argsJson) : {} } catch { args = {} }
        return { id: tc.id, name: tc.name, arguments: args }
      })

      return { text, toolCalls, stopReason }

    } catch (error) {
      clearTimeout(timeoutId)

      if (error.name === 'AbortError') {
        if (signal?.aborted) throw new UserAbortError()
        throw new NetworkError('Streaming request timed out')
      }

      this.circuitBreaker.failures++
      this.circuitBreaker.lastFailure = Date.now()

      if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
        this.circuitBreaker.isOpen = true
      }

      throw classifyError(error)
    } finally {
      if (externalAbortListener && signal) {
        signal.removeEventListener('abort', externalAbortListener)
      }
    }
  }

  /**
   * Streaming counterpart to chatWithTools(). Previously streamChat() never sent `tools` at
   * all (documented gap — ROADMAP-NEXT.md #7), so any tool-requiring turn silently fell back
   * to the non-streaming path with no incremental token display. When options.tools is
   * omitted this behaves exactly as before (single request, no tool loop). When tools are
   * provided, this mirrors chatWithTools()'s multi-turn loop and provider-shape bridging, but
   * streams each turn's text live via onChunk and reports tool activity via options.onToolCall
   * (optional) so the UI can show "using tool X" during the loop instead of going silent.
   */
  async streamChat(messages, onChunk = () => {}, options = {}) {
    const modelId = options.model || this.defaultConfig.model

    const apiConfig = await storage.getAPIConfig(modelId)
    const baseURL = await storage.getBaseURLForModel(modelId)
    const apiKey = await storage.getAPIKeyForModel(modelId)

    if (!apiKey) {
      throw new AuthError('No API key configured. Please add your API key in settings.')
    }

    const provider = storage.getProviderForModel(modelId)
    const config = {
      ...this.defaultConfig,
      ...apiConfig,
      baseURL,
      ...options,
      streaming: true
    }

    // Google's streaming path uses a wholly different request/response shape (see below) and
    // was never wired for tool-calling even in the non-streaming chatWithTools(); keep that
    // scope cut explicit here rather than half-supporting it.
    const tools = provider.id !== 'google' ? options.tools : null
    const anthropicShaped = this.isAnthropicShaped(config, provider)
    const onToolCall = options.onToolCall || (() => {})
    const deniedMessage = 'Action denied by user. The user declined this browser action. Try a different approach or ask the user what they want to do.'

    let currentMessages = messages.map(msg => ({
      role: msg.role,
      content: inputValidator.sanitizeContent(msg.content)
    }))

    const maxIterations = tools?.length ? 10 : 1
    let iterations = 0

    while (iterations < maxIterations) {
      iterations++

      if (options.signal?.aborted) throw new UserAbortError()

      let body
      let url

      if (provider.id === 'google') {
        body = {
          contents: this.convertToGoogleFormat(currentMessages),
          generationConfig: {
            temperature: config.temperature ?? 0.7,
            maxOutputTokens: config.maxTokens ?? 2000,
            topP: 0.95,
            topK: 40
          }
        }
        url = `${baseURL}/models/${modelId}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
      } else {
        body = this.buildRequestBody(config, currentMessages, provider)
        body.stream = true
        if (tools?.length) {
          body.tools = anthropicShaped ? tools.map(t => this.toAnthropicTool(t)) : tools
        }
        url = `${baseURL}/chat/completions`
        if (this.isAnthropicShaped(config, provider)) {
          url = `${baseURL}/messages`
        }
      }

      const headers = this.buildHeaders(apiKey, config, provider)
      const { text, toolCalls, stopReason } = await this._streamOneTurn(url, headers, body, provider, anthropicShaped, onChunk, { signal: options.signal, timeoutMs: options.timeoutMs })

      if (!toolCalls.length) {
        return text
      }

      // Echo the assistant turn back exactly as the provider expects it, same as
      // chatWithTools(): Anthropic needs the original tool_use blocks to match the
      // tool_result that follows; OpenAI wants a message with a tool_calls array.
      if (anthropicShaped) {
        const blocks = []
        if (text) blocks.push({ type: 'text', text })
        for (const tc of toolCalls) {
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments })
        }
        currentMessages.push({ role: 'assistant', content: blocks })

        const resultBlocks = []
        for (const tc of toolCalls) {
          try {
            onToolCall(tc.name, tc.arguments)
            if (options.approvalCallback) {
              const approved = await options.approvalCallback(tc.name, tc.arguments)
              if (!approved) {
                resultBlocks.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify({ error: deniedMessage }), is_error: true })
                continue
              }
            }
            const { executeTool } = await import('../background/service-worker-tools.js')
            const result = await executeTool(tc.name, tc.arguments)
            resultBlocks.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(result) })
          } catch (toolError) {
            resultBlocks.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify({ error: toolError.message }), is_error: true })
          }
        }
        currentMessages.push({ role: 'user', content: resultBlocks })
      } else {
        currentMessages.push({
          role: 'assistant',
          content: text || null,
          tool_calls: toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } }))
        })

        for (const tc of toolCalls) {
          try {
            onToolCall(tc.name, tc.arguments)
            if (options.approvalCallback) {
              const approved = await options.approvalCallback(tc.name, tc.arguments)
              if (!approved) {
                currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: deniedMessage }) })
                continue
              }
            }
            const { executeTool } = await import('../background/service-worker-tools.js')
            const result = await executeTool(tc.name, tc.arguments)
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
          } catch (toolError) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: toolError.message }) })
          }
        }
      }

      void stopReason // available for future use (e.g. distinguishing 'length' truncation); not currently branched on
    }

    throw new APIError('Maximum tool usage iterations exceeded', ErrorCodes.UNKNOWN_ERROR)
  }
}

export const apiClient = new APIClient()

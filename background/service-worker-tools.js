import { storage } from '../utils/storage.js'
import { cdpController } from './cdp-controller.js'
import { mcpClient } from '../utils/mcp-client.js'
import { executeSkillTool, isSkillTool } from '../utils/skills-registry.js'

export async function executeTool(toolName, args) {
  console.debug('Executing tool:', toolName, args)

  try {
    switch (toolName) {
      case 'read_page':
        return await getCurrentPageContent()
      case 'browse_url':
        return await fetchUrlContent(args.url)
      case 'web_search':
        return await performWebSearch(args.query)
      case 'image_search':
        return await performImageSearch(args.query)
      case 'generate_image':
        return await generateImage(args.prompt)

      case 'browser_navigate':
        return await cdpController.navigate(args.url)
      case 'browser_screenshot':
        return await cdpController.screenshot(args)
      case 'browser_click':
        return await cdpController.click(args.selector)
      case 'browser_type':
        return await cdpController.type(args.selector, args.text, args.submit)
      case 'browser_press_key':
        return await cdpController.pressKey(args.key)
      case 'browser_scroll':
        return await cdpController.scroll(args.x, args.y, args.smooth)
      case 'browser_extract_text':
        return await cdpController.extractText(args.selector, args.maxLength)
      case 'browser_get_elements':
        return await cdpController.getInteractiveElements(args.limit)
      case 'browser_get_page_info':
        return await cdpController.getPageInfo()
      case 'browser_evaluate':
        return await cdpController.evaluate(args.code)
      case 'browser_cdp_command':
        return await cdpController.sendCDPCommand(args.method, args.params || {})

      default:
        // Skill tools first (registered in skills-registry)
        if (isSkillTool(toolName)) {
          const result = await executeSkillTool(toolName, args || {})
          return result
        }
        // Try routing to MCP servers — tools are prefixed with mcp_<server>_<tool>
        if (toolName.startsWith('mcp_')) {
          const result = await mcpClient.callByPrefixedName(toolName, args || {})
          // Normalize output: MCP tools return {content:[{type:'text', text:'...'}, ...], isError}
          if (result && typeof result === 'object' && Array.isArray(result.content)) {
            const text = result.content
              .filter(c => c.type === 'text')
              .map(c => c.text)
              .join('\n')
            return { content: text, isError: !!result.isError }
          }
          return { content: typeof result === 'string' ? result : JSON.stringify(result) }
        }
        throw new Error(`Unknown tool: ${toolName}`)
    }
  } catch (error) {
    console.error('Tool execution error:', { toolName, args, error: error.message, stack: error.stack })
    throw error
  }
}

async function getCurrentPageContent() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs[0]?.id) {
      return { error: 'No active tab found' }
    }

    try {
      const results = await chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_CONTEXT' })
      if (results && !results.error) {
        return results
      }
      return { error: results?.error || 'Could not extract page content. Try reloading the page.' }
    } catch (innerError) {
      if (innerError.message?.includes('Receiving end does not exist') ||
          innerError.message?.includes('Could not establish connection')) {
        return { error: 'Content script not loaded. Please refresh the page and try again.' }
      }
      throw innerError
    }
  } catch (error) {
    console.error('Error reading page:', error)
    return { error: error.message }
  }
}

async function fetchUrlContent(url) {
  try {
    let parsedUrl
    try {
      parsedUrl = new URL(url)
    } catch {
      return { error: 'Invalid URL' }
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { error: 'URL must use http or https protocol' }
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return { error: `Failed to fetch: ${response.status}` }
    }

    const html = await response.text()

    if (html.length > 2 * 1024 * 1024) {
      return { error: 'Response too large (max 2MB)' }
    }

    let text = extractTextFromHTML(html)

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : url

    return {
      url,
      title,
      content: text.substring(0, 8000)
    }
  } catch (error) {
    console.error('Error fetching URL:', error)
    return { error: error.message }
  }
}

function extractTextFromHTML(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function performWebSearch(query) {
  try {
    const encodedQuery = encodeURIComponent(query)
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1&limit=5`

    const response = await fetch(ddgUrl, {
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        error: `Search failed: ${response.status} - ${errorData.message || response.statusText}`,
        errorDetails: errorData
      }
    }

    const data = await response.json()

    let results = ''

    if (data.AbstractText) {
      results = data.AbstractText
    } else if (data.RelatedTopics?.length > 0) {
      results = data.RelatedTopics.slice(0, 5).map(t => t.Text || t.Name).filter(Boolean).join('\n')
    } else if (data.Answer) {
      results = data.Answer
    } else if (data.Results?.length > 0) {
      results = data.Results.slice(0, 5).map(r => r.Text).join('\n')
    } else {
      results = 'No results found'
    }

    return {
      query,
      results: results.substring(0, 2000),
      source: data.AbstractSource || 'DuckDuckGo'
    }
  } catch (error) {
    console.error('Search error:', error)
    return {
      error: error.message,
      errorType: error.name,
      stack: error.stack
    }
  }
}

async function performImageSearch(query) {
  try {
    const encodedQuery = encodeURIComponent(query)
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1&image=1&limit=10`

    const response = await fetch(ddgUrl, {
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return { error: `Image search failed: ${response.status}` }
    }

    const data = await response.json()

    const images = []

    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics) {
        if (topic.Icon && topic.Icon.URL) {
          const imgUrl = topic.Icon.URL.startsWith('http')
            ? topic.Icon.URL
            : `https://duckduckgo.com${topic.Icon.URL}`
          if (imgUrl && imgUrl.includes('.')) {
            images.push({
              url: imgUrl,
              title: topic.Text || topic.Name || query,
              source: 'DuckDuckGo'
            })
          }
        }
        if (images.length >= 8) break
      }
    }

    if (data.Image_results?.length > 0) {
      for (const img of data.Image_results.slice(0, 8)) {
        if (img.image && img.image.startsWith('http')) {
          images.push({
            url: img.image,
            title: img.title || query,
            source: img.source || 'DuckDuckGo'
          })
        }
      }
    }

    return {
      query,
      images: images.slice(0, 8),
      count: images.length
    }
  } catch (error) {
    console.error('Image search error:', error)
    return { error: error.message }
  }
}

async function generateImage(prompt) {
  try {
    const apiKey = await storage.getAPIKeyForModel('gpt-4o')
    if (!apiKey) {
      return { error: 'No API key configured. Please add your API key in options.' }
    }

    let baseURL = await storage.getBaseURLForModel('gpt-4o')
    try {
      const parsed = new URL(baseURL)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { error: 'Invalid baseURL protocol' }
      }
    } catch {
      return { error: 'Invalid baseURL' }
    }
    const model = 'dall-e-3'

    const response = await fetch(`${baseURL}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        size: '1024x1024',
        quality: 'standard',
        n: 1
      })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return { error: `Image generation failed: ${response.status} - ${err.error?.message || response.statusText}` }
    }

    const data = await response.json()
    return {
      url: data.data[0].url,
      prompt
    }
  } catch (error) {
    console.error('Image generation error:', error)
    return { error: error.message }
  }
}

export const BROWSER_TOOLS_DEFINITION = [
  {
    type: 'function',
    function: {
      name: 'browser_navigate',
      description: 'Navigate the browser to a URL. Use when the user wants to visit a website or you need to check a page.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to navigate to (include https://)' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_screenshot',
      description: 'Take a screenshot of the current page. Use to visually understand what is on screen.',
      parameters: {
        type: 'object',
        properties: {
          fullPage: { type: 'boolean', description: 'Capture full page (not just viewport)' },
          format: { type: 'string', description: 'Image format: png or jpeg' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_click',
      description: 'Click an element on the page by CSS selector. Use browser_get_elements first to find clickable elements.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for the element to click' }
        },
        required: ['selector']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_type',
      description: 'Type text into an input field or textarea on the page.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for the input element' },
          text: { type: 'string', description: 'Text to type into the field' },
          submit: { type: 'boolean', description: 'Submit the form after typing' }
        },
        required: ['selector', 'text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_press_key',
      description: 'Press a keyboard key (e.g. Enter, Tab, Escape, ArrowDown).',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Key name to press (e.g. Enter, Tab, Escape)' }
        },
        required: ['key']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_scroll',
      description: 'Scroll the page by a relative amount.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'Horizontal scroll pixels (default 0)' },
          y: { type: 'number', description: 'Vertical scroll pixels (default 300, negative for up)' },
          smooth: { type: 'boolean', description: 'Use smooth scrolling' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_extract_text',
      description: 'Extract text content from the page or a specific element. Useful for reading content that read_page cannot access.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector (default: body)' },
          maxLength: { type: 'number', description: 'Maximum characters to extract (default 5000)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_get_elements',
      description: 'Get all interactive elements (links, buttons, inputs) on the page with their selectors. Use before clicking or typing to find the right selector.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Maximum elements to return (default 50)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_get_page_info',
      description: 'Get the current page URL, title, and load state.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_evaluate',
      description: 'Execute JavaScript code on the page and return the result. Advanced tool for complex interactions.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JavaScript code to execute' }
        },
        required: ['code']
      }
    }
  }
]

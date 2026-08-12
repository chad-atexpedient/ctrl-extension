/**
 * Web Fetch Skill
 * Fetch web content with proper headers and error handling.
 * Used when native fetch is not available or for enhanced control.
 */

const ID = 'web-fetch'

export default {
  id: ID,
  name: 'Web Fetch',
  description: 'Fetch web pages and APIs with enhanced control over headers, method, and response parsing',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'web_fetch',
        description: 'Fetch a URL and return its content. Supports GET and POST methods, custom headers, and response type selection.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to fetch',
            },
            method: {
              type: 'string',
              description: 'HTTP method to use',
              default: 'GET',
              enum: ['GET', 'POST', 'HEAD', 'PUT', 'DELETE'],
            },
            headers: {
              type: 'object',
              description: 'Custom HTTP headers as key-value pairs',
            },
            body: {
              type: 'string',
              description: 'Request body for POST/PUT requests',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 15000)',
              default: 15000,
            },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'parse_html',
        description: 'Extract structured data from HTML using CSS selectors. Returns text content of matching elements.',
        parameters: {
          type: 'object',
          properties: {
            html: {
              type: 'string',
              description: 'HTML content to parse',
            },
            selector: {
              type: 'string',
              description: 'CSS selector to match elements',
            },
            attribute: {
              type: 'string',
              description: 'Optional: extract a specific attribute (e.g. "href", "src") instead of text content',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of elements to return (default: 50)',
              default: 50,
            },
          },
          required: ['html', 'selector'],
        },
      },
    },
  ],

  async init() {
    // Nothing to pre-initialize
  },

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'web_fetch': return this._fetch(args)
      case 'parse_html': return this._parseHtml(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _fetch({ url, method = 'GET', headers = {}, body, timeout = 15000 }) {
    let parsedUrl
    try {
      parsedUrl = new URL(url)
    } catch {
      return { error: 'Invalid URL', url, type: 'error' }
    }
    const scheme = parsedUrl.protocol
    if (scheme !== 'http:' && scheme !== 'https:') {
      return { error: `URL scheme '${scheme}' is not allowed (only http/https)`, url, type: 'error' }
    }

    const MAX_SIZE = 5 * 1024 * 1024
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)

      const opts = {
        method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/html, text/plain, */*',
          ...headers,
        },
        signal: controller.signal,
        redirect: 'error',
      }

      if (body && (method === 'POST' || method === 'PUT')) {
        opts.body = typeof body === 'string' ? body : JSON.stringify(body)
        if (!headers['Content-Type']) {
          opts.headers['Content-Type'] = 'application/json'
        }
      }

      const response = await fetch(url, opts)
      clearTimeout(timer)

      if (!response.ok) {
        return { error: `HTTP ${response.status} ${response.statusText}`, url, status: response.status, type: 'error' }
      }

      const text = await response.text()
      if (text.length > MAX_SIZE) {
        return { error: `Response too large (${text.length} bytes, max ${MAX_SIZE})`, url, type: 'error' }
      }
      let content

      try {
        content = JSON.parse(text)
      } catch {
        content = text
      }

      return {
        url,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        content,
        contentLength: text.length,
        type: 'success',
      }
    } catch (err) {
      return {
        error: err.message,
        url,
        type: 'error',
      }
    }
  },

  _parseHtml({ html, selector, attribute, limit = 50 }) {
    try {
      const results = []
      const selectorLower = selector.toLowerCase()

      if (selectorLower.startsWith('.')) {
        const className = selectorLower.substring(1)
        const regex = new RegExp(`<[^>]+class="[^"]*${className.replace(/[^a-z0-9]/gi, '.*')}[^"]*"[^>]*>([\\s\\S]*?)</[^>]+>`, 'gi')
        let m
        while ((m = regex.exec(html)) !== null && results.length < limit) {
          const tagContent = m[1]
          results.push(attribute ? this._extractAttribute(tagContent + m[0], attribute) : this._stripHtml(tagContent))
        }
      } else if (selectorLower.startsWith('#')) {
        const id = selectorLower.substring(1)
        const regex = new RegExp(`<[^>]+id="${id}"[^>]*>([\\s\\S]*?)</[^>]+>`, 'gi')
        const m = regex.exec(html)
        if (m) {
          results.push(attribute ? this._extractAttribute(m[0], attribute) : this._stripHtml(m[1]))
        }
      } else {
        const tagName = selectorLower.split(/\s/)[0].replace(/[.#\[][^\]]*$/, '')
        const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi')
        let m
        while ((m = regex.exec(html)) !== null && results.length < limit) {
          results.push(attribute ? this._extractAttribute(m[0], attribute) : this._stripHtml(m[1]))
        }
      }

      return {
        selector,
        attribute,
        count: results.length,
        elements: results,
        type: 'success',
      }
    } catch (err) {
      return {
        error: `HTML parse error: ${err.message}`,
        selector,
        type: 'error',
      }
    }
  },

  _stripHtml(str) {
    return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  },

  _extractAttribute(tagHtml, attr) {
    const regex = new RegExp(`${attr}="([^"]*)"`, 'i')
    const m = regex.exec(tagHtml)
    return m ? m[1] : ''
  },
}

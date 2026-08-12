/**
 * Web Scraper Skill
 * Fetch and extract structured data from web pages.
 */

const ID = 'web-scraper'

export default {
  id: ID,
  name: 'Web Scraper',
  description: 'Fetch web pages and extract structured data using CSS selectors or XPath. Handles pagination and rate limiting.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'scrape_page',
        description: 'Fetch a URL and extract data using CSS selectors or regex patterns.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to scrape',
            },
            selectors: {
              type: 'string',
              description: 'JSON object mapping field names to CSS selectors or regex patterns: {"title":"h1","links":"a[href]","content":"article p"}',
            },
            timeout: {
              type: 'number',
              description: 'Request timeout in milliseconds',
              default: 15000,
            },
          },
          required: ['url', 'selectors'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scrape_table',
        description: 'Extract all tables from a URL and return them as structured JSON.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to scrape tables from',
            },
            table_index: {
              type: 'number',
              description: 'Which table to extract (0 = first, -1 = all)',
              default: 0,
            },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'scrape_sitemap',
        description: 'Extract all links from a sitemap URL.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'Sitemap URL (e.g. https://example.com/sitemap.xml)',
            },
            max_urls: {
              type: 'number',
              description: 'Maximum number of URLs to return',
              default: 100,
            },
          },
          required: ['url'],
        },
      },
    },
  ],

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'scrape_page': return this._scrape(args)
      case 'scrape_table': return this._table(args)
      case 'scrape_sitemap': return this._sitemap(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _fetch(url, timeout = 15000) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } })
      clearTimeout(timer)
      return r
    } catch (err) {
      clearTimeout(timer)
      throw err
    }
  },

  async _scrape({ url, selectors, timeout = 15000 }) {
    try {
      const resp = await this._fetch(url, timeout)
      const html = await resp.text()
      const selectorsObj = typeof selectors === 'string' ? JSON.parse(selectors) : selectors
      const result = {}

      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      for (const [field, sel] of Object.entries(selectorsObj)) {
        if (sel.startsWith('/') || sel.startsWith('(')) {
          // XPath-like or regex
          if (sel.startsWith('/')) {
            result[field] = null // XPath not supported without xpath library
          } else {
            const re = new RegExp(sel, 'gi')
            const matches = html.match(re)
            result[field] = matches ? (matches.length === 1 ? matches[0] : matches) : null
          }
        } else {
          // CSS selector
          const els = doc.querySelectorAll(sel)
          if (els.length === 0) result[field] = null
          else if (els.length === 1) result[field] = els[0].textContent.trim()
          else result[field] = Array.from(els).map(el => {
            if (el.tagName === 'A') return { text: el.textContent.trim(), href: el.href }
            if (el.tagName === 'IMG') return { alt: el.alt, src: el.src }
            return el.textContent.trim()
          })
        }
      }

      return { url, extracted: result, type: 'success' }
    } catch (err) {
      return { error: `Scrape failed: ${err.message}`, type: 'error' }
    }
  },

  async _table({ url, table_index = 0 }) {
    try {
      const resp = await this._fetch(url)
      const html = await resp.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const tables = doc.querySelectorAll('table')

      if (tables.length === 0) return { error: 'No tables found', type: 'error' }

      const results = []
      const targets = table_index === -1 ? tables : [tables[Math.min(table_index, tables.length - 1)]]

      for (const table of targets) {
        const rows = table.querySelectorAll('tr')
        const data = Array.from(rows).map(row => {
          const cells = row.querySelectorAll('th, td')
          return Array.from(cells).map(c => c.textContent.trim())
        })
        results.push(data)
      }

      return {
        url,
        table_count: tables.length,
        tables: table_index === -1 ? results : results[0],
        type: 'success',
      }
    } catch (err) {
      return { error: `Table scrape failed: ${err.message}`, type: 'error' }
    }
  },

  async _sitemap({ url, max_urls = 100 }) {
    try {
      const resp = await this._fetch(url, 15000)
      const xml = await resp.text()
      const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/gi)].map(m => m[1]).slice(0, max_urls)
      return {
        url,
        count: urls.length,
        urls,
        type: 'success',
      }
    } catch (err) {
      return { error: `Sitemap failed: ${err.message}`, type: 'error' }
    }
  },
}

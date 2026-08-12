/**
 * MCP Client for CTRL Extension - connects to local MCP (Model Context Protocol)
 * servers via HTTP-transport JSON-RPC, discovers their exposed tools, and
 * executes them on demand from the AI function-calling loop.
 *
 * Spec reference: https://modelcontextprotocol.io/specification
 * Transport: HTTP (SSE optional). We use stdio-equivalent request/response.
 */

const MCP_TOOLS_KEY = 'mcp_tools_cache'

class MCPClient {
  constructor () {
    /** @type {Map<string, {conn: object, tools: any[], lastFetch:number}>} */
    this.servers = new Map()
    /** @type {any[]} flat tool list ready for AI function calling */
    this.mergedTools = []
    /** @type {Map<string, {serverId: string, toolName: string}>} id->where */
    this.toolIndex = new Map()
    this._refreshing = null
  }

  /**
   * Load MCP connections from chrome.storage.local and probe each one for tools.
   * Safe to call multiple times — only refetches tools every 5 minutes.
   * @returns {Promise<{tools:any[], servers: number, errors: any[]}>}
   */
  async refresh () {
    if (this._refreshing) return this._refreshing
    this._refreshing = (async () => {
      const errors = []
      try {
        const { mcp_connections = [] } = await chrome.storage.local.get('mcp_connections')
        this.servers.clear()
        this.toolIndex.clear()
        this.mergedTools = []

        for (const conn of mcp_connections) {
          try {
            if (conn.type !== 'local-http') {
              // We currently only support the HTTP transport for direct tool invocation.
              // Other MCP types (webhook, notion, slack, github) are surfaced as their
              // own service-specific tools in service-worker-tools.js.
              continue
            }
            const tools = await this._listTools(conn)
            this.servers.set(conn.id, { conn, tools, lastFetch: Date.now() })
            for (const t of tools) {
              const id = `${conn.id}:${t.name}`
              this.toolIndex.set(id, { serverId: conn.id, toolName: t.name })
              this.mergedTools.push({
                type: 'function',
                function: {
                  name: `mcp_${this._sanitizeName(conn.name)}_${this._sanitizeName(t.name)}`,
                  description: t.description || `MCP tool: ${t.name}`,
                  parameters: t.inputSchema || { type: 'object', properties: {} },
                  _mcp: { serverId: conn.id, toolName: t.name, serverName: conn.name }
                }
              })
            }
          } catch (err) {
            errors.push({ serverId: conn.id, name: conn.name, error: err.message })
          }
        }
        await chrome.storage.local.set({
          [MCP_TOOLS_KEY]: {
            tools: this.mergedTools,
            errors,
            fetchedAt: Date.now()
          }
        })
      } finally {
        this._refreshing = null
      }
      return { tools: this.mergedTools, servers: this.servers.size, errors }
    })()
    return this._refreshing
  }

  /**
   * Load merged tools from cache without re-probing.
   * @returns {Promise<any[]>}
   */
  async loadCachedTools () {
    const cached = await chrome.storage.local.get(MCP_TOOLS_KEY)
    if (cached[MCP_TOOLS_KEY]?.tools?.length) {
      this.mergedTools = cached[MCP_TOOLS_KEY].tools
      for (const t of this.mergedTools) {
        if (t.function?._mcp) {
          this.toolIndex.set(`${t.function._mcp.serverId}:${t.function._mcp.toolName}`, {
            serverId: t.function._mcp.serverId,
            toolName: t.function._mcp.toolName
          })
        }
      }
    }
    return this.mergedTools
  }

  /**
   * Probe one MCP server via JSON-RPC `tools/list` and return its tool array.
   */
  async _listTools (conn) {
    const url = (conn.config?.url || '').replace(/\/$/, '')
    if (!url) throw new Error('MCP server missing url')
    if (!this._validateUrl(url)) throw new Error('MCP server URL must use http or https')

    // Try two formats: (1) raw JSON-RPC over HTTP, (2) /mcp/tools convenience
    const rpc = await this._rpc(conn, url, 'tools/list', {}).catch(async (err1) => {
      // Convenience fallback
      try {
        const fallback = await fetch(`${url}/mcp/tools`, {
          headers: this._headers(conn),
          signal: this._abort(8000),
          redirect: 'error',
        })
        if (!fallback.ok) throw err1
        const data = await fallback.json()
        return data.tools || data || []
      } catch (err2) {
        throw new Error(`tools/list failed: ${err1.message}; fallback: ${err2.message}`)
      }
    })
    return rpc.tools || rpc || []
  }

  /**
   * Invoke a tool on a server.
   */
  async callTool (serverId, toolName, args = {}) {
    const server = this.servers.get(serverId)
    let conn = server?.conn
    if (!conn) {
      // Lazy-load connections
      const { mcp_connections = [] } = await chrome.storage.local.get('mcp_connections')
      conn = mcp_connections.find(c => c.id === serverId)
      if (!conn) throw new Error(`MCP server not found: ${serverId}`)
    }
    const url = (conn.config?.url || '').replace(/\/$/, '')
    return this._rpc(conn, url, 'tools/call', { name: toolName, arguments: args })
  }

  /**
   * Invoke by the prefixed tool name used in TOOLS_DEFINITIONS.
   */
  async callByPrefixedName (prefixedName, args = {}) {
    const tool = this.mergedTools.find(t => t.function.name === prefixedName)
    if (!tool || !tool.function._mcp) throw new Error(`Unknown MCP tool: ${prefixedName}`)
    return this.callTool(tool.function._mcp.serverId, tool.function._mcp.toolName, args)
  }

  async _rpc (conn, baseUrl, method, params) {
    if (!this._validateUrl(baseUrl)) throw new Error('MCP server URL must use http or https')
    const body = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    }
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: this._headers(conn),
      body: JSON.stringify(body),
      signal: this._abort(15000),
      redirect: 'error',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error))
    return data.result
  }

  _headers (conn) {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    if (conn.config?.apiKey) headers.Authorization = `Bearer ${conn.config.apiKey}`
    return headers
  }

  _abort (ms) {
    const c = new AbortController()
    setTimeout(() => c.abort(), ms)
    return c.signal
  }

  _validateUrl (url) {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }

  _sanitizeName (s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'tool'
  }

  /**
   * @returns {boolean} whether any MCP tools are loaded
   */
  hasTools () { return this.mergedTools.length > 0 }

  /**
   * Get all MCP tools in the OpenAI function-calling shape.
   */
  getTools () { return this.mergedTools }
}

const mcpClient = new MCPClient()
// Eagerly load cached tools so they appear in the first chat request
mcpClient.loadCachedTools().catch(() => {})
// Schedule a periodic refresh in the background (service worker keeps running while chatting)
chrome.alarms?.create('mcp-refresh', { periodInMinutes: 30 })
chrome.alarms?.onAlarm?.addListener((a) => {
  if (a.name === 'mcp-refresh') mcpClient.refresh().catch(() => {})
})

export { mcpClient, MCPClient }

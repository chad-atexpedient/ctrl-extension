/**
 * Unit tests for utils/mcp-client.js
 *
 * Strategy: install chrome mock, then stub `globalThis.fetch` per test to
 * simulate MCP server responses. Validate:
 *   - JSON-RPC envelope shape
 *   - tools/list discovery and tool registry population
 *   - tools/call dispatch with prefixed tool names
 *   - fallback to /mcp/tools convenience endpoint
 *   - cached tools load on init
 */

import { describe, test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installChromeMock } from './helpers/chrome-mock.js'

const { store } = installChromeMock()

// Capture fetch calls so we can assert JSON-RPC envelopes
const fetchCalls = []
let fetchResponder = null

globalThis.fetch = async (url, opts) => {
  fetchCalls.push({ url, opts })
  if (fetchResponder) return fetchResponder(url, opts)
  throw new Error('No fetch responder set in test')
}

const MOD = await import('../../utils/mcp-client.js')
const { mcpClient, MCPClient } = MOD

// Helper: simulate an MCP server that lists and calls tools
function mockMcpServer (tools, callResult) {
  fetchResponder = (url, opts) => {
    const body = JSON.parse(opts.body)
    if (body.method === 'tools/list') {
      return {
        ok: true,
        async json () { return { result: { tools } } }
      }
    }
    if (body.method === 'tools/call') {
      return {
        ok: true,
        async json () { return { result: callResult } }
      }
    }
    throw new Error('Unexpected RPC method: ' + body.method)
  }
}

beforeEach(() => {
  fetchCalls.length = 0
  fetchResponder = null
  for (const k of Object.keys(store)) delete store[k]
  mcpClient.servers.clear()
  mcpClient.mergedTools = []
  mcpClient.toolIndex.clear()
})

describe('MCPClient: refresh', () => {
  test('discovers tools via JSON-RPC tools/list and registers them', async () => {
    store.mcp_connections = [
      { id: 's1', name: 'MyServer', type: 'local-http', config: { url: 'http://127.0.0.1:8080' } }
    ]
    mockMcpServer([
      { name: 'search', description: 'Search the web', inputSchema: { type: 'object', properties: { q: { type: 'string' } } } },
      { name: 'fetch-url', description: 'Fetch URL', inputSchema: { type: 'object' } }
    ], { content: [{ type: 'text', text: 'called' }] })

    const r = await mcpClient.refresh()
    assert.equal(r.servers, 1)
    assert.equal(r.errors.length, 0)
    assert.equal(mcpClient.hasTools(), true)
    assert.equal(mcpClient.getTools().length, 2)

    const tools = mcpClient.getTools()
    const names = tools.map(t => t.function.name)
    assert.ok(names.includes('mcp_myserver_search'))
    assert.ok(names.includes('mcp_myserver_fetch_url'))
  })

  test('sanitizes server and tool names', async () => {
    store.mcp_connections = [
      { id: 's1', name: 'My Cool Server', type: 'local-http', config: { url: 'http://127.0.0.1:8080' } }
    ]
    mockMcpServer([
      { name: 'do-cool/stuff', description: '', inputSchema: {} }
    ], { content: [{ type: 'text', text: 'ok' }] })

    await mcpClient.refresh()
    const names = mcpClient.getTools().map(t => t.function.name)
    assert.deepEqual(names, ['mcp_my_cool_server_do_cool_stuff'])
  })

  test('falls back to /mcp/tools when JSON-RPC fails', async () => {
    store.mcp_connections = [
      { id: 's1', name: 'Fallback', type: 'local-http', config: { url: 'http://127.0.0.1:8080' } }
    ]
    fetchResponder = (url, opts) => {
      if (url === 'http://127.0.0.1:8080') {
        return { ok: false, status: 404, statusText: 'Not Found' }
      }
      if (url === 'http://127.0.0.1:8080/mcp/tools') {
        return { ok: true, async json () { return { tools: [{ name: 'legacy', description: '', inputSchema: {} }] } } }
      }
      throw new Error('Unexpected URL: ' + url)
    }

    const r = await mcpClient.refresh()
    assert.equal(r.errors.length, 0)
    assert.equal(mcpClient.getTools().length, 1)
    assert.equal(mcpClient.getTools()[0].function.name, 'mcp_fallback_legacy')
  })

  test('records per-server errors without aborting', async () => {
    store.mcp_connections = [
      { id: 'broken', name: 'Broken', type: 'local-http', config: { url: 'http://127.0.0.1:1' } },
      { id: 'good', name: 'Good', type: 'local-http', config: { url: 'http://127.0.0.1:2' } }
    ]
    fetchResponder = (url) => {
      if (url === 'http://127.0.0.1:1') {
        return { ok: false, status: 500, statusText: 'Internal' }
      }
      if (url === 'http://127.0.0.1:1/mcp/tools') {
        return { ok: false, status: 500 }
      }
      if (url === 'http://127.0.0.1:2') {
        return { ok: true, async json () { return { result: { tools: [{ name: 'ok', description: '', inputSchema: {} }] } } } }
      }
      if (url === 'http://127.0.0.1:2/mcp/tools') {
        return { ok: true, async json () { return { tools: [{ name: 'ok', description: '', inputSchema: {} }] } } }
      }
      throw new Error('Unexpected: ' + url)
    }

    const r = await mcpClient.refresh()
    assert.equal(r.errors.length, 1)
    assert.equal(r.errors[0].serverId, 'broken')
    assert.equal(mcpClient.getTools().length, 1)
  })

  test('skips non-HTTP MCP types (webhook, notion, etc.)', async () => {
    store.mcp_connections = [
      { id: 'w', name: 'Webhook', type: 'webhook', config: {} },
      { id: 'n', name: 'Notion', type: 'notion', config: {} }
    ]
    const r = await mcpClient.refresh()
    assert.equal(r.servers, 0)
    assert.equal(mcpClient.getTools().length, 0)
    // Should not even attempt to fetch for these
    assert.equal(fetchCalls.length, 0)
  })

  test('caches merged tools to chrome.storage.local', async () => {
    store.mcp_connections = [
      { id: 's1', name: 'X', type: 'local-http', config: { url: 'http://127.0.0.1:8080' } }
    ]
    mockMcpServer([{ name: 't', description: '', inputSchema: {} }], { content: [{ type: 'text', text: 'ok' }] })
    await mcpClient.refresh()
    assert.ok(store.mcp_tools_cache)
    assert.equal(store.mcp_tools_cache.tools.length, 1)
    assert.ok(store.mcp_tools_cache.fetchedAt)
    assert.equal(store.mcp_tools_cache.errors.length, 0)
  })
})

describe('MCPClient: callTool / callByPrefixedName', () => {
  beforeEach(async () => {
    store.mcp_connections = [
      { id: 's1', name: 'Test', type: 'local-http', config: { url: 'http://127.0.0.1:8080' } }
    ]
    mockMcpServer([
      { name: 'greet', description: '', inputSchema: { type: 'object' } }
    ], { content: [{ type: 'text', text: 'Hello back' }] })
    await mcpClient.refresh()
  })

  test('callByPrefixedName dispatches to right server + tool', async () => {
    fetchCalls.length = 0
    const r = await mcpClient.callByPrefixedName('mcp_test_greet', { name: 'World' })
    assert.equal(fetchCalls.length, 1)
    const body = JSON.parse(fetchCalls[0].opts.body)
    assert.equal(body.method, 'tools/call')
    assert.equal(body.params.name, 'greet')
    assert.deepEqual(body.params.arguments, { name: 'World' })
    assert.equal(r.content[0].text, 'Hello back')
  })

  test('callByPrefixedName throws for unknown tool', async () => {
    await assert.rejects(
      () => mcpClient.callByPrefixedName('mcp_nonexistent', {}),
      /Unknown MCP tool/
    )
  })

  test('callTool re-loads connection if not in cache', async () => {
    // Wipe the cache, but keep storage so it can be re-discovered
    mcpClient.servers.clear()
    fetchCalls.length = 0
    await mcpClient.callTool('s1', 'greet', {})
    assert.equal(fetchCalls.length, 1)
  })

  test('JSON-RPC error in result throws', async () => {
    fetchResponder = () => ({
      ok: true,
      async json () { return { error: { message: 'tool missing' } } }
    })
    await assert.rejects(
      () => mcpClient.callByPrefixedName('mcp_test_greet', {}),
      /tool missing/
    )
  })

  test('sends Authorization header when apiKey configured', async () => {
    store.mcp_connections[0].config.apiKey = 'secret-key'
    fetchCalls.length = 0
    mockMcpServer([{ name: 'greet', description: '', inputSchema: {} }], { content: [{ type: 'text', text: 'ok' }] })
    await mcpClient.refresh()
    fetchCalls.length = 0
    await mcpClient.callByPrefixedName('mcp_test_greet', {})
    const headers = fetchCalls[0].opts.headers
    assert.equal(headers.Authorization, 'Bearer secret-key')
    assert.equal(headers['Content-Type'], 'application/json')
  })
})

describe('MCPClient: loadCachedTools', () => {
  test('restores tools from cache without re-probing', async () => {
    const tools = [{
      type: 'function',
      function: {
        name: 'mcp_cached_tool',
        description: 'cached',
        parameters: { type: 'object' },
        _mcp: { serverId: 's1', toolName: 'tool', serverName: 'Cached' }
      }
    }]
    store.mcp_tools_cache = {
      tools, errors: [], fetchedAt: Date.now()
    }
    const fresh = new MCPClient()
    const loaded = await fresh.loadCachedTools()
    assert.equal(loaded.length, 1)
    assert.equal(loaded[0].function.name, 'mcp_cached_tool')
    // Should not have probed anything
    assert.equal(fetchCalls.length, 0)
  })

  test('returns empty array when no cache exists', async () => {
    const fresh = new MCPClient()
    const loaded = await fresh.loadCachedTools()
    assert.deepEqual(loaded, [])
  })
})
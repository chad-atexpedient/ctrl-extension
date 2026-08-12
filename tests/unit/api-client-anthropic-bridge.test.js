/**
 * Regression tests for utils/api-client.js's Anthropic-shaped request/response
 * bridging (Round 4 in issues.md: "native Anthropic tool-calling was completely
 * broken" — api-client.js always built OpenAI-shaped bodies/headers/parsing,
 * even when talking to Anthropic's real Messages API, which has a genuinely
 * different wire shape).
 *
 * Covers:
 *  (a) system-role messages get pulled into a top-level body.system and
 *      removed from body.messages for Anthropic-shaped providers
 *  (b) OpenAI-shaped tool defs get converted to Anthropic's
 *      {name, description, input_schema} shape via toAnthropicTool()
 *  (c) parseResponse() extracts both text and tool_use blocks from an
 *      Anthropic content array and builds an OpenAI-shaped message.tool_calls
 *  (d) buildHeaders() produces x-api-key/anthropic-version (not Bearer) for
 *      Anthropic-shaped providers
 *
 * No real network calls are made — these exercise the pure request/response
 * transformation methods directly with fake config/provider/response objects.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { installChromeMock } from './helpers/chrome-mock.js'

installChromeMock()

const { APIClient } = await import('../../utils/api-client.js')
const client = new APIClient()

describe('APIClient.isAnthropicShaped', () => {
  test('true for provider.id === "anthropic"', () => {
    assert.equal(client.isAnthropicShaped({}, { id: 'anthropic' }), true)
  })

  test('true for config.provider === "anthropic"', () => {
    assert.equal(client.isAnthropicShaped({ provider: 'anthropic' }, { id: 'custom' }), true)
  })

  test('true for any provider flagged anthropicCompatible (e.g. MiniMax opt-in endpoint)', () => {
    assert.equal(
      client.isAnthropicShaped({}, { id: 'minimax', anthropicCompatible: true }),
      true
    )
  })

  test('false for a plain OpenAI-shaped provider', () => {
    assert.equal(client.isAnthropicShaped({ provider: 'openai' }, { id: 'openai' }), false)
  })

  test('false for google (must not be misrouted through the Anthropic bridge)', () => {
    assert.equal(client.isAnthropicShaped({ provider: 'google' }, { id: 'google' }), false)
  })
})

describe('APIClient.buildHeaders: Anthropic-shaped providers', () => {
  test('anthropic provider gets x-api-key + anthropic-version, no Bearer', () => {
    const headers = client.buildHeaders('sk-test-key', { provider: 'anthropic' }, { id: 'anthropic' })
    assert.equal(headers['x-api-key'], 'sk-test-key')
    assert.equal(headers['anthropic-version'], '2023-06-01')
    assert.equal(headers['Authorization'], undefined)
  })

  test('minimax with anthropicCompatible:true also gets x-api-key, not Bearer', () => {
    const headers = client.buildHeaders(
      'mm-key',
      { provider: 'minimax' },
      { id: 'minimax', anthropicCompatible: true }
    )
    assert.equal(headers['x-api-key'], 'mm-key')
    assert.equal(headers['anthropic-version'], '2023-06-01')
    assert.equal(headers['Authorization'], undefined)
  })

  test('plain openai provider gets Bearer, not x-api-key', () => {
    const headers = client.buildHeaders('sk-oa', { provider: 'openai' }, { id: 'openai' })
    assert.equal(headers['Authorization'], 'Bearer sk-oa')
    assert.equal(headers['x-api-key'], undefined)
  })

  test('google gets neither Bearer nor x-api-key (uses ?key= query param instead)', () => {
    const headers = client.buildHeaders('g-key', { provider: 'google' }, { id: 'google' })
    assert.equal(headers['Authorization'], undefined)
    assert.equal(headers['x-api-key'], undefined)
  })
})

describe('APIClient.buildRequestBody: system message extraction for Anthropic', () => {
  test('system-role message is moved to top-level body.system and removed from body.messages', () => {
    const body = client.buildRequestBody(
      { provider: 'anthropic', model: 'claude-4.5-sonnet', maxTokens: 1000, temperature: 0.7 },
      [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' }
      ],
      { id: 'anthropic' }
    )
    assert.equal(body.system, 'You are a helpful assistant.')
    assert.ok(!body.messages.some(m => m.role === 'system'))
    assert.equal(body.messages.length, 1)
    assert.equal(body.messages[0].role, 'user')
  })

  test('multiple system messages are joined with double newlines', () => {
    const body = client.buildRequestBody(
      { provider: 'anthropic', model: 'claude-4.5-sonnet', maxTokens: 1000, temperature: 0.7 },
      [
        { role: 'system', content: 'Rule one.' },
        { role: 'system', content: 'Rule two.' },
        { role: 'user', content: 'Hi' }
      ],
      { id: 'anthropic' }
    )
    assert.equal(body.system, 'Rule one.\n\nRule two.')
  })

  test('no system message: body.system is left undefined', () => {
    const body = client.buildRequestBody(
      { provider: 'anthropic', model: 'claude-4.5-sonnet', maxTokens: 1000, temperature: 0.7 },
      [{ role: 'user', content: 'Hi' }],
      { id: 'anthropic' }
    )
    assert.equal(body.system, undefined)
    assert.equal(body.messages.length, 1)
  })

  test('OpenAI-shaped provider keeps system message inline in body.messages', () => {
    const body = client.buildRequestBody(
      { provider: 'openai', model: 'gpt-4o', maxTokens: 1000, temperature: 0.7 },
      [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Hi' }
      ],
      { id: 'openai' }
    )
    assert.equal(body.system, undefined)
    assert.ok(body.messages.some(m => m.role === 'system'))
    assert.equal(body.messages.length, 2)
  })
})

describe('APIClient.toAnthropicTool', () => {
  test('converts an OpenAI-shaped tool def to {name, description, input_schema}', () => {
    const openAiTool = {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather for a location',
        parameters: {
          type: 'object',
          properties: { location: { type: 'string' } },
          required: ['location']
        }
      }
    }
    const converted = client.toAnthropicTool(openAiTool)
    assert.equal(converted.name, 'get_weather')
    assert.equal(converted.description, 'Get current weather for a location')
    assert.deepEqual(converted.input_schema, openAiTool.function.parameters)
    assert.equal(converted.type, undefined)
    assert.equal(converted.function, undefined)
  })

  test('passes through a tool that is already Anthropic-shaped unchanged', () => {
    const anthropicTool = {
      name: 'search_web',
      description: 'Search the web',
      input_schema: { type: 'object', properties: { query: { type: 'string' } } }
    }
    const converted = client.toAnthropicTool(anthropicTool)
    assert.equal(converted, anthropicTool)
  })

  test('missing parameters falls back to an empty object schema', () => {
    const converted = client.toAnthropicTool({ type: 'function', function: { name: 'noop' } })
    assert.deepEqual(converted.input_schema, { type: 'object', properties: {} })
    assert.equal(converted.description, '')
  })
})

describe('APIClient.parseResponse: Anthropic content-block extraction', () => {
  test('extracts plain text from a text-only content array', () => {
    const responseData = {
      content: [{ type: 'text', text: 'Hello there!' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 }
    }
    const parsed = client.parseResponse(responseData, { provider: 'anthropic' }, { id: 'anthropic' })
    const message = parsed.choices[0].message
    assert.equal(message.content, 'Hello there!')
    assert.equal(message.tool_calls, undefined)
    assert.equal(parsed.usage.total_tokens, 15)
  })

  test('extracts tool_use blocks into an OpenAI-shaped message.tool_calls array', () => {
    const responseData = {
      content: [
        { type: 'text', text: 'Let me check that for you.' },
        {
          type: 'tool_use',
          id: 'toolu_01abc',
          name: 'get_weather',
          input: { location: 'Boston' }
        }
      ],
      stop_reason: 'tool_use'
    }
    const parsed = client.parseResponse(responseData, { provider: 'anthropic' }, { id: 'anthropic' })
    const message = parsed.choices[0].message

    assert.equal(message.content, 'Let me check that for you.')
    assert.equal(message.tool_calls.length, 1)
    assert.equal(message.tool_calls[0].id, 'toolu_01abc')
    assert.equal(message.tool_calls[0].type, 'function')
    assert.equal(message.tool_calls[0].function.name, 'get_weather')
    assert.deepEqual(JSON.parse(message.tool_calls[0].function.arguments), { location: 'Boston' })
    assert.equal(parsed.choices[0].finish_reason, 'tool_use')
  })

  test('multiple tool_use blocks all become separate tool_calls entries', () => {
    const responseData = {
      content: [
        { type: 'tool_use', id: 't1', name: 'tool_a', input: { x: 1 } },
        { type: 'tool_use', id: 't2', name: 'tool_b', input: { y: 2 } }
      ]
    }
    const parsed = client.parseResponse(responseData, { provider: 'anthropic' }, { id: 'anthropic' })
    assert.equal(parsed.choices[0].message.tool_calls.length, 2)
    assert.equal(parsed.choices[0].message.tool_calls[0].function.name, 'tool_a')
    assert.equal(parsed.choices[0].message.tool_calls[1].function.name, 'tool_b')
  })

  test('preserves raw content blocks on the message for multi-turn tool-loop echo', () => {
    const responseData = {
      content: [{ type: 'tool_use', id: 't1', name: 'tool_a', input: {} }]
    }
    const parsed = client.parseResponse(responseData, { provider: 'anthropic' }, { id: 'anthropic' })
    assert.deepEqual(parsed.choices[0].message._rawContent, responseData.content)
  })

  test('empty/missing content array does not throw and yields empty text', () => {
    const parsed = client.parseResponse({}, { provider: 'anthropic' }, { id: 'anthropic' })
    assert.equal(parsed.choices[0].message.content, '')
    assert.equal(parsed.choices[0].message.tool_calls, undefined)
  })

  test('OpenAI-shaped provider: response passes through unchanged', () => {
    const responseData = { choices: [{ message: { role: 'assistant', content: 'hi' } }] }
    const parsed = client.parseResponse(responseData, { provider: 'openai' }, { id: 'openai' })
    assert.equal(parsed, responseData)
  })
})

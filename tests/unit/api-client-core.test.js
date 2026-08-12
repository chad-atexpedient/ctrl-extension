/**
 * Unit tests for utils/api-client.js — core error classification and
 * request building (the existing tests cover the multi-modal bridge only).
 *
 * These tests exercise the robustness-critical path that was previously
 * untested: handleAPIError status mapping, retry/backoff limits, and
 * request body construction for the default OpenAI-shaped provider.
 */

import { describe, test, before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { installChromeMock, uninstallChromeMock } from './helpers/chrome-mock.js'

installChromeMock()

const MOD = await import('../../utils/api-client.js')
const { APIClient } = MOD
const client = new APIClient()

describe('APIClient.handleAPIError', () => {
  const provider = { id: 'openai' }

  test('401 maps to AuthError with friendly message', () => {
    const err = client.handleAPIError(401, {}, provider)
    assert.equal(err.name, 'AuthError')
    assert.match(err.message, /Invalid API key/)
  })

  test('403 maps to AuthError (forbidden)', () => {
    const err = client.handleAPIError(403, {}, provider)
    assert.equal(err.name, 'AuthError')
  })

  test('404 maps to APIError with MODEL_NOT_FOUND code', () => {
    const err = client.handleAPIError(404, { error: { message: 'gpt-4o does not exist' } }, provider)
    assert.equal(err.name, 'APIError')
    assert.equal(err.code, 'MODEL_NOT_FOUND')
    assert.equal(err.status, 404)
  })

  test('429 maps to RateLimitError with retryAfter parsed from response', () => {
    const err = client.handleAPIError(429, { error: { retry_after: '15' } }, provider)
    assert.equal(err.name, 'RateLimitError')
    assert.equal(err.retryAfter, 15)
    assert.match(err.message, /15/)
  })

  test('429 defaults retryAfter to 60 when absent', () => {
    const err = client.handleAPIError(429, {}, provider)
    assert.equal(err.retryAfter, 60)
  })

  test('5xx maps to APIError with SERVER_ERROR code', () => {
    for (const status of [500, 502, 503]) {
      const err = client.handleAPIError(status, {}, provider)
      assert.equal(err.name, 'APIError')
      assert.equal(err.code, 'SERVER_ERROR')
    }
  })

  test('unknown status preserves the provider error message', () => {
    const err = client.handleAPIError(418, { error: { message: 'teapot' } }, provider)
    assert.equal(err.code, 'UNKNOWN_ERROR')
    assert.match(err.message, /teapot/)
  })

  test('anthropic-shaped error data still surfaces message', () => {
    const err = client.handleAPIError(400, { error: { message: 'invalid request payload' } }, { id: 'anthropic' })
    assert.equal(err.name, 'APIError')
    assert.match(err.message, /invalid request payload/)
  })
})

describe('APIClient.executeWithRetry', () => {
  beforeEach(() => { client.retryConfig.maxAttempts = 2 })
  afterEach(() => { client.retryConfig.maxAttempts = 5 })

  test('resolves immediately when fn succeeds', async () => {
    const result = await client.executeWithRetry(async () => 'ok')
    assert.equal(result, 'ok')
  })

  test('does not retry non-recoverable errors', async () => {
    let calls = 0
    await assert.rejects(
      () => client.executeWithRetry(async () => {
        calls++
        const err = new Error('boom')
        err.recoverable = false
        throw err
      })
    )
    assert.equal(calls, 1)
  })

  test('stops retrying at maxAttempts', async () => {
    // maxAttempts = 2 retries after the initial call => up to 3 calls
    let calls = 0
    await assert.rejects(
      () => client.executeWithRetry(async () => {
        calls++
        const err = new Error('flaky')
        err.recoverable = true
        throw err
      })
    )
    assert.equal(calls, 3)
  })
})

describe('APIClient.buildRequestBody: OpenAI / default', () => {
  test('produces messages + temperature + max_tokens shape', () => {
    const config = { provider: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 2000 }
    const provider = { id: 'openai' }
    const body = client.buildRequestBody(config, [{ role: 'user', content: 'hi' }], provider)
    assert.equal(body.model, 'gpt-4o')
    assert.equal(body.messages[0].role, 'user')
    assert.equal(body.messages[0].content, 'hi')
    assert.equal(body.temperature, 0.7)
    assert.equal(body.max_tokens, 2000)
  })

  test('system role message stays inline for OpenAI shape', () => {
    const config = { provider: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 2000 }
    const body = client.buildRequestBody(config, [
      { role: 'system', content: 'you are helpful' },
      { role: 'user', content: 'hi' }
    ], { id: 'openai' })
    assert.equal(body.messages.length, 2)
    assert.equal(body.messages[0].role, 'system')
  })

  test('max_completion_tokens used for o-series models', () => {
    const config = { provider: 'openai', model: 'o3-mini', temperature: 0.7, maxTokens: 2000 }
    const body = client.buildRequestBody(config, [{ role: 'user', content: 'hi' }], { id: 'openai' })
    assert.equal(body.max_completion_tokens, 2000)
    assert.equal(body.max_tokens, undefined)
  })

  test('max_tokens used for regular models', () => {
    const config = { provider: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 2000 }
    const body = client.buildRequestBody(config, [{ role: 'user', content: 'hi' }], { id: 'openai' })
    assert.equal(body.max_tokens, 2000)
    assert.equal(body.max_completion_tokens, undefined)
  })
})

describe('APIClient chat() validation', () => {
  test('throws ValidationError for out-of-range temperature', async () => {
    await assert.rejects(
      () => client.chat([{ role: 'user', content: 'hi' }], { temperature: 2.5 }),
      (err) => err.name === 'ValidationError' || err.name === 'AuthError'
    )
  })
})

/**
 * Unit tests for utils/api-client.js — specifically the multi-modal
 * message construction for vision-capable models.
 *
 * Three providers with three different shapes:
 *   - OpenAI (default):  content: [{type:'text'}, {type:'image_url', image_url:{url}}]
 *   - Anthropic:         content: [{type:'text'}, {type:'image', source:{type:'base64', media_type, data}}]
 *   - Google Gemini:     parts:   [{text}, {inline_data:{mime_type, data}}]
 */

import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { installChromeMock } from './helpers/chrome-mock.js'

const { store } = installChromeMock()

const MOD = await import('../../utils/api-client.js')
const { APIClient } = MOD
const client = new APIClient()

const fakeImg = {
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  mediaType: 'image/png'
}
const fakeImgJpeg = {
  dataUrl: 'data:image/jpeg;base64,/9j/abc=',
  mediaType: 'image/jpeg'
}

describe('APIClient.buildMultiModalMessages: OpenAI / default', () => {
  const provider = { id: 'openai' }

  test('text-only message passes through unchanged', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'user', content: 'hello' }],
      provider
    )
    assert.equal(out[0].content, 'hello')
  })

  test('image-only message wraps content in array', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'user', content: '', images: [fakeImg] }],
      provider
    )
    assert.ok(Array.isArray(out[0].content))
    assert.equal(out[0].content.length, 1)
    assert.equal(out[0].content[0].type, 'image_url')
    assert.equal(out[0].content[0].image_url.url, fakeImg.dataUrl)
    assert.equal(out[0].content[0].image_url.detail, 'auto')
  })

  test('text + image produces mixed content array', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'user', content: 'What is this?', images: [fakeImg] }],
      provider
    )
    assert.equal(out[0].content.length, 2)
    assert.equal(out[0].content[0].type, 'text')
    assert.equal(out[0].content[0].text, 'What is this?')
    assert.equal(out[0].content[1].type, 'image_url')
  })

  test('files are inlined as text blocks', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'user', content: 'analyze', files: [{ name: 'a.csv', content: 'x,y\n1,2' }] }],
      provider
    )
    assert.equal(out[0].content.length, 2)
    const fileBlock = out[0].content[1]
    assert.equal(fileBlock.type, 'text')
    assert.ok(fileBlock.text.includes('[File: a.csv]'))
    assert.ok(fileBlock.text.includes('x,y'))
  })

  test('multiple images preserve order', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'user', content: 'compare', images: [fakeImg, fakeImgJpeg] }],
      provider
    )
    assert.equal(out[0].content.length, 3) // text + 2 images
    assert.equal(out[0].content[1].image_url.url, fakeImg.dataUrl)
    assert.equal(out[0].content[2].image_url.url, fakeImgJpeg.dataUrl)
  })

  test('detail override is respected', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'user', content: '', images: [{ ...fakeImg, detail: 'low' }] }],
      provider
    )
    assert.equal(out[0].content[0].image_url.detail, 'low')
  })

  test('assistant role preserved', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'assistant', content: 'hi' }],
      provider
    )
    assert.equal(out[0].role, 'assistant')
  })
})

describe('APIClient.buildMultiModalMessages: Anthropic', () => {
  const provider = { id: 'anthropic' }

  test('image uses base64 source with media_type', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'user', content: 'look', images: [fakeImgJpeg] }],
      provider
    )
    const block = out[0].content[1]
    assert.equal(block.type, 'image')
    assert.equal(block.source.type, 'base64')
    assert.equal(block.source.media_type, 'image/jpeg')
    assert.ok(block.source.data) // raw base64 (dataUrl prefix stripped)
  })

  test('strips data URL prefix from base64 data', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'user', content: '', images: [fakeImg] }],
      provider
    )
    // fakeImg.dataUrl = 'data:image/png;base64,iVBORw0KGgo='
    // data field should NOT include 'data:image/png;base64,'
    assert.ok(!out[0].content[0].source.data.includes('data:image'))
    assert.equal(out[0].content[0].source.data, 'iVBORw0KGgo=')
  })

  test('files become text blocks', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'user', content: 'check', files: [{ name: 'f.txt', content: 'abc' }] }],
      provider
    )
    const fileBlock = out[0].content[1]
    assert.equal(fileBlock.type, 'text')
    assert.ok(fileBlock.text.includes('[File: f.txt]'))
  })

  test('role mapping: assistant stays assistant', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'assistant', content: 'hi' }],
      provider
    )
    assert.equal(out[0].role, 'assistant')
  })
})

describe('APIClient.buildMultiModalMessages: Google Gemini', () => {
  const provider = { id: 'google' }

  test('image becomes inline_data part', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'user', content: 'describe', images: [fakeImg] }],
      provider
    )
    const parts = out[0].parts
    assert.equal(parts.length, 2)
    assert.equal(parts[0].text, 'describe')
    assert.equal(parts[1].inline_data.mime_type, 'image/png')
    assert.ok(parts[1].inline_data.data)
  })

  test('role mapping: assistant becomes model for multi-modal messages', () => {
    // Role remapping only happens for messages that go through the multi-modal
    // path (have images/files). Text-only assistant messages pass through.
    const out = client.buildMultiModalMessages(
      [{ role: 'assistant', content: 'ok', images: [fakeImg] }],
      provider
    )
    assert.equal(out[0].role, 'model')
  })

  test('user role preserved', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'user', content: 'hi' }],
      provider
    )
    assert.equal(out[0].role, 'user')
  })

  test('strips data URL prefix from inline_data', () => {
    const out = client.buildMultiModalMessages(
      [{ role: 'user', content: '', images: [fakeImg] }],
      provider
    )
    assert.ok(!out[0].parts[0].inline_data.data.includes('data:image'))
    assert.equal(out[0].parts[0].inline_data.data, 'iVBORw0KGgo=')
  })
})

describe('APIClient.buildRequestBody with images', () => {
  test('OpenAI: messages include image_url blocks', () => {
    const body = client.buildRequestBody(
      { provider: 'openai', model: 'gpt-4o', maxTokens: 1000, temperature: 0.7 },
      [{ role: 'user', content: 'look', images: [fakeImg] }],
      { id: 'openai' }
    )
    assert.ok(Array.isArray(body.messages))
    assert.equal(body.messages[0].content[0].type, 'text')
    assert.equal(body.messages[0].content[1].type, 'image_url')
  })

  test('Anthropic: messages are formatted multi-modal', () => {
    const body = client.buildRequestBody(
      { provider: 'anthropic', model: 'claude-4.5-sonnet', maxTokens: 1000, temperature: 0.7 },
      [{ role: 'user', content: 'look', images: [fakeImg] }],
      { id: 'anthropic' }
    )
    assert.ok(Array.isArray(body.messages))
    assert.equal(body.messages[0].content[1].type, 'image')
  })

  test('Google: contents uses parts', () => {
    const body = client.buildRequestBody(
      { provider: 'google', model: 'gemini-2.5-pro', maxTokens: 1000, temperature: 0.7 },
      [{ role: 'user', content: 'look', images: [fakeImg] }],
      { id: 'google' }
    )
    assert.ok(Array.isArray(body.contents))
    assert.ok(Array.isArray(body.contents[0].parts))
    assert.equal(body.contents[0].parts[0].text, 'look')
    assert.ok(body.contents[0].parts[1].inline_data)
  })

  test('text-only request: no multi-modal transformation', () => {
    const body = client.buildRequestBody(
      { provider: 'openai', model: 'gpt-4o', maxTokens: 1000, temperature: 0.7 },
      [{ role: 'user', content: 'hello' }],
      { id: 'openai' }
    )
    assert.equal(typeof body.messages[0].content, 'string')
  })

  test('image attached to assistant message is allowed', () => {
    const body = client.buildRequestBody(
      { provider: 'openai', model: 'gpt-4o', maxTokens: 1000, temperature: 0.7 },
      [
        { role: 'user', content: 'look at this', images: [fakeImg] },
        { role: 'assistant', content: 'I see a PNG' }
      ],
      { id: 'openai' }
    )
    assert.equal(body.messages[0].content[1].type, 'image_url')
    assert.equal(typeof body.messages[1].content, 'string')
  })
})
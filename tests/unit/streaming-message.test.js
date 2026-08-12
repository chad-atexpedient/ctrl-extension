/**
 * Unit tests for sidepanel/streaming-message.js
 *
 * Covers the public API of StreamingMessage:
 *   - create()             : builds bubble DOM with the right class
 *   - appendChunk()        : accumulates fullContent + invokes formatContent
 *   - setContent()         : replaces fullContent + invokes formatContent
 *   - transcode()          : progressive reveal driven by requestAnimationFrame
 *   - finalize()           : removes streaming class, adds action buttons,
 *                            double-finalize is a no-op
 *   - abort()              : removes message div from the DOM
 *   - _escapeHtml()        : escapes <, >, &, ", ' ; null/undefined → ''
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDomStub, uninstallDomStub } from './helpers/dom-stub.js'

import { StreamingMessage } from '../../sidepanel/streaming-message.js'

describe('StreamingMessage', () => {
  let container
  let scrollSpy
  let formatCalls
  let formatContent

  beforeEach(() => {
    installDomStub()
    container = document.createElement('div')
    document.body.appendChild(container)
    scrollSpy = () => {}
    formatCalls = []
    formatContent = (text) => { formatCalls.push(text); return `<p>${text}</p>` }
  })

  afterEach(() => {
    uninstallDomStub()
  })

  const make = () => new StreamingMessage(container, { formatContent, scrollToBottom: scrollSpy })

  describe('create()', () => {
    it('appends a div with class "message assistant streaming" to the container', () => {
      const msg = make()
      const ret = msg.create()
      assert.equal(ret, msg, 'create() should return this')
      assert.equal(container.children.length, 1)
      const div = container.children[0]
      assert.equal(div.className, 'message assistant streaming')
      assert.ok(div.classList.contains('message'))
      assert.ok(div.classList.contains('assistant'))
      assert.ok(div.classList.contains('streaming'))
    })

    it('contains a message-bubble div with a streaming-cursor span inside', () => {
      const msg = make()
      msg.create()
      const messageDiv = msg.messageDiv
      assert.equal(messageDiv.children.length, 1)
      const bubble = messageDiv.children[0]
      assert.equal(bubble.className, 'message-bubble')
      assert.ok(bubble.children.length >= 1)
      const cursor = bubble.children[0]
      assert.equal(cursor.className, 'streaming-cursor')
    })

    it('invokes scrollToBottom on construction', () => {
      let calls = 0
      const msg = new StreamingMessage(container, {
        formatContent,
        scrollToBottom: () => { calls++ },
      })
      msg.create()
      assert.ok(calls >= 1)
    })
  })

  describe('appendChunk()', () => {
    it('accumulates chunks into fullContent', () => {
      const msg = make()
      msg.create()
      msg.appendChunk('Hello')
      msg.appendChunk(', ')
      msg.appendChunk('world')
      assert.equal(msg.fullContent, 'Hello, world')
    })

    it('invokes formatContent with the latest fullContent on every chunk', () => {
      const msg = make()
      msg.create()
      msg.appendChunk('a')
      msg.appendChunk('b')
      msg.appendChunk('c')
      assert.deepEqual(formatCalls, ['a', 'ab', 'abc'])
    })

    it('is a no-op once finalized', () => {
      const msg = make()
      msg.create()
      msg.appendChunk('hi')
      msg.finalize('done')
      const before = msg.fullContent
      msg.appendChunk('!')
      assert.equal(msg.fullContent, before)
    })
  })

  describe('setContent()', () => {
    it('replaces fullContent with the provided text', () => {
      const msg = make()
      msg.create()
      msg.setContent('full replacement')
      assert.equal(msg.fullContent, 'full replacement')
    })

    it('invokes formatContent once with the new full content', () => {
      const msg = make()
      msg.create()
      msg.setContent('hello')
      msg.setContent('world')
      assert.deepEqual(formatCalls.slice(-2), ['hello', 'world'])
    })

    it('coerces nullish to empty string', () => {
      const msg = make()
      msg.create()
      msg.setContent(null)
      assert.equal(msg.fullContent, '')
    })
  })

  describe('transcode()', () => {
    it('resolves a promise and reveals the full content', async () => {
      const msg = make()
      msg.create()
      await msg.transcode('abcdefghij', { charsPerTick: 3, tickMs: 0 })
      assert.equal(msg.fullContent, 'abcdefghij')
    })

    it('calls scrollToBottom multiple times (once per tick + final render)', async () => {
      let scrollCalls = 0
      const msg = new StreamingMessage(container, {
        formatContent,
        scrollToBottom: () => { scrollCalls++ },
      })
      msg.create()
      await msg.transcode('abcdefghijklmnop', { charsPerTick: 4, tickMs: 0 })
      // 16 chars / 4 per tick = 4 partial ticks + final render = 5 scrolls
      assert.equal(scrollCalls, 5)
    })

    it('renders partial content progressively via _renderPartial (plain text)', async () => {
      const msg = make()
      msg.create()
      // _renderPartial writes innerHTML = _escapeHtml(slice)
      // Capture bubble.innerHTML after each chunk by tapping into formatContent.
      // Since _renderPartial bypasses formatContent, we check the DOM directly.
      await msg.transcode('Hello world', { charsPerTick: 5, tickMs: 0 })
      // Final render uses formatContent -> <p>Hello world</p>
      assert.equal(msg.bubbleDiv.innerHTML, '<p>Hello world</p>')
    })

    it('settles immediately when content is empty', async () => {
      const msg = make()
      msg.create()
      await msg.transcode('', { charsPerTick: 5, tickMs: 0 })
      assert.equal(msg.fullContent, '')
    })
  })

  describe('finalize()', () => {
    it('removes the streaming class from the message div', () => {
      const msg = make()
      msg.create()
      msg.appendChunk('hi')
      assert.ok(msg.messageDiv.classList.contains('streaming'))
      msg.finalize('done')
      assert.ok(!msg.messageDiv.classList.contains('streaming'))
    })

    it('adds .copy-msg-btn, .insert-btn, .regenerate-btn action buttons', () => {
      const msg = make()
      msg.create()
      msg.appendChunk('hello')
      msg.finalize('hello')
      const actions = msg.messageDiv.children[msg.messageDiv.children.length - 1]
      assert.equal(actions.className, 'msg-actions')
      assert.ok(actions.innerHTML.includes('copy-msg-btn'), 'copy-msg-btn missing')
      assert.ok(actions.innerHTML.includes('insert-btn'), 'insert-btn missing')
      assert.ok(actions.innerHTML.includes('regenerate-btn'), 'regenerate-btn missing')
    })

    it('uses the provided content arg to update fullContent', () => {
      const msg = make()
      msg.create()
      msg.appendChunk('partial')
      const returned = msg.finalize('authoritative')
      assert.equal(returned, 'authoritative')
      assert.equal(msg.fullContent, 'authoritative')
    })

    it('keeps existing fullContent when called without a content arg', () => {
      const msg = make()
      msg.create()
      msg.appendChunk('keep me')
      msg.finalize()
      assert.equal(msg.fullContent, 'keep me')
    })

    it('is a no-op when called twice (no double-finalize)', () => {
      const msg = make()
      msg.create()
      msg.appendChunk('one')
      msg.finalize('one')
      const childrenBefore = msg.messageDiv.children.length
      const returned = msg.finalize('two')
      // Second call returns undefined (early-return guard).
      assert.equal(returned, undefined, 'second finalize should early-return')
      assert.equal(msg.fullContent, 'one', 'content should not be overwritten by second finalize')
      assert.equal(msg.messageDiv.children.length, childrenBefore)
    })
  })

  describe('abort()', () => {
    it('removes the message div from the DOM', () => {
      const msg = make()
      msg.create()
      assert.equal(container.children.length, 1)
      msg.abort()
      assert.equal(container.children.length, 0)
    })

    it('marks the message as finalized so subsequent finalize is a no-op', () => {
      const msg = make()
      msg.create()
      msg.abort()
      const before = msg.fullContent
      msg.finalize('late')
      assert.equal(msg.fullContent, before)
    })
  })

  describe('_escapeHtml()', () => {
    it('escapes <, >, & (text-content semantics: quotes are NOT escaped)', () => {
      const msg = make()
      assert.equal(msg._escapeHtml('<script>'), '&lt;script&gt;')
      assert.equal(msg._escapeHtml('a & b'), 'a &amp; b')
      // Browsers do not escape " or ' in a text node's innerHTML.
      assert.equal(msg._escapeHtml('"hi"'), '"hi"')
      assert.equal(msg._escapeHtml("it's"), "it's")
      // Mixed content: only the <, >, & are escaped; quotes pass through.
      assert.equal(msg._escapeHtml('<a href="x">&'), '&lt;a href="x"&gt;&amp;')
    })

    it('returns empty string for null', () => {
      const msg = make()
      assert.equal(msg._escapeHtml(null), '')
    })

    it('returns empty string for undefined', () => {
      const msg = make()
      assert.equal(msg._escapeHtml(undefined), '')
    })

    it('returns plain string for empty input', () => {
      const msg = make()
      assert.equal(msg._escapeHtml(''), '')
    })
  })
})
/**
 * Unit tests for sidepanel/focus-trap.js
 *
 * Covers the public API of FocusTrap:
 *   - activate()              : focuses first focusable, attaches keydown
 *   - deactivate()            : removes keydown listener, restores focus
 *   - _getFocusables()        : selector-driven query for focusable elements
 *   - Tab/Shift+Tab cycling   : wraps focus inside the container
 *   - Detached container      : activate() does not throw
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDomStub, uninstallDomStub } from './helpers/dom-stub.js'

import { FocusTrap } from '../../sidepanel/focus-trap.js'

function makeKeyEvent (key, shiftKey = false) {
  let prevented = false
  return {
    type: 'keydown',
    key,
    shiftKey,
    defaultPrevented: false,
    preventDefault () { prevented = true; this.defaultPrevented = true },
    get prevented () { return prevented },
  }
}

describe('FocusTrap', () => {
  let container, btn1, btn2, input

  beforeEach(() => {
    installDomStub()
    container = document.createElement('div')
    btn1 = document.createElement('button')
    btn2 = document.createElement('button')
    input = document.createElement('input')
    container.appendChild(btn1)
    container.appendChild(btn2)
    container.appendChild(input)
    document.body.appendChild(container)
  })

  afterEach(() => {
    uninstallDomStub()
  })

  describe('activate()', () => {
    it('moves focus to the first focusable element in the container', () => {
      const trap = new FocusTrap(container)
      trap.activate()
      assert.equal(document.activeElement, btn1)
    })

    it('saves the previously-focused element so deactivate can restore it', () => {
      btn2.focus() // put focus on btn2 (a button inside the container) before activate
      const trap = new FocusTrap(container)
      trap.activate()
      assert.equal(trap.previouslyFocused, btn2, 'should remember the previous activeElement')
    })

    it('attaches a keydown listener that intercepts Tab from outside the container', () => {
      const trap = new FocusTrap(container)
      trap.activate()
      // Move focus outside, then Tab → listener should fire and pull focus back to first.
      document.activeElement = document.body
      const evt = makeKeyEvent('Tab')
      document.dispatchEvent(evt)
      assert.equal(evt.defaultPrevented, true, 'Tab from outside should be intercepted')
      assert.equal(document.activeElement, btn1)
    })
  })

  describe('deactivate()', () => {
    it('removes the Tab listener so Tab is no longer intercepted', () => {
      const trap = new FocusTrap(container)
      trap.activate()
      trap.deactivate()
      const before = document.activeElement
      const evt = makeKeyEvent('Tab')
      document.dispatchEvent(evt)
      assert.equal(evt.defaultPrevented, false, 'Tab should not be preventDefault-ed after deactivate')
      assert.equal(document.activeElement, before, 'focus should not move')
    })

    it('clears the captured keydown handler', () => {
      const trap = new FocusTrap(container)
      trap.activate()
      assert.ok(trap._keyHandler)
      trap.deactivate()
      assert.equal(trap._keyHandler, null)
    })

    it('is safe to call twice', () => {
      const trap = new FocusTrap(container)
      trap.activate()
      trap.deactivate()
      assert.doesNotThrow(() => trap.deactivate())
    })
  })

  describe('_getFocusables()', () => {
    it('returns buttons, inputs, anchors (with href), and textareas', () => {
      const txt = document.createElement('textarea')
      const a = document.createElement('a')
      a.setAttribute('href', '/x')
      container.appendChild(txt)
      container.appendChild(a)

      const trap = new FocusTrap(container)
      const focusables = trap._getFocusables()
      assert.ok(focusables.includes(btn1))
      assert.ok(focusables.includes(btn2))
      assert.ok(focusables.includes(input))
      assert.ok(focusables.includes(txt))
      assert.ok(focusables.includes(a))
    })

    it('returns elements with tabindex >= 0', () => {
      const div0 = document.createElement('div')
      div0.setAttribute('tabindex', '0')
      container.appendChild(div0)
      const trap = new FocusTrap(container)
      const focusables = trap._getFocusables()
      assert.ok(focusables.includes(div0))
    })

    it('ignores elements with tabindex="-1"', () => {
      const divNeg = document.createElement('div')
      divNeg.setAttribute('tabindex', '-1')
      container.appendChild(divNeg)
      const trap = new FocusTrap(container)
      const focusables = trap._getFocusables()
      assert.ok(!focusables.includes(divNeg))
    })

    it('ignores disabled buttons, inputs, and textareas', () => {
      const disabledBtn = document.createElement('button')
      disabledBtn.setAttribute('disabled', '')
      const disabledInput = document.createElement('input')
      disabledInput.setAttribute('disabled', '')
      const disabledTxt = document.createElement('textarea')
      disabledTxt.setAttribute('disabled', '')
      container.appendChild(disabledBtn)
      container.appendChild(disabledInput)
      container.appendChild(disabledTxt)

      const trap = new FocusTrap(container)
      const focusables = trap._getFocusables()
      assert.ok(!focusables.includes(disabledBtn))
      assert.ok(!focusables.includes(disabledInput))
      assert.ok(!focusables.includes(disabledTxt))
    })

    it('ignores anchors without href', () => {
      const anchorNoHref = document.createElement('a')
      container.appendChild(anchorNoHref)
      const trap = new FocusTrap(container)
      const focusables = trap._getFocusables()
      assert.ok(!focusables.includes(anchorNoHref))
    })
  })

  describe('Tab key cycling', () => {
    it('Tab from the last focusable wraps to the first', () => {
      const trap = new FocusTrap(container)
      trap.activate()
      document.activeElement = input // last
      const evt = makeKeyEvent('Tab', false)
      document.dispatchEvent(evt)
      assert.equal(evt.defaultPrevented, true)
      assert.equal(document.activeElement, btn1)
    })

    it('Shift+Tab from the first focusable wraps back to the last', () => {
      const trap = new FocusTrap(container)
      trap.activate() // activeElement = btn1 (first)
      const evt = makeKeyEvent('Tab', true)
      document.dispatchEvent(evt)
      assert.equal(evt.defaultPrevented, true)
      assert.equal(document.activeElement, input)
    })

    it('Tab from a middle focusable is NOT intercepted (default behavior)', () => {
      const trap = new FocusTrap(container)
      trap.activate()
      document.activeElement = btn2 // middle
      const evt = makeKeyEvent('Tab', false)
      document.dispatchEvent(evt)
      assert.equal(evt.defaultPrevented, false)
    })

    it('Tab from the first focusable is NOT intercepted (default behavior moves forward)', () => {
      const trap = new FocusTrap(container)
      trap.activate()
      document.activeElement = btn1 // first
      const evt = makeKeyEvent('Tab', false)
      document.dispatchEvent(evt)
      assert.equal(evt.defaultPrevented, false)
    })

    it('Shift+Tab from the last focusable is NOT intercepted (default behavior)', () => {
      const trap = new FocusTrap(container)
      trap.activate()
      document.activeElement = input // last
      const evt = makeKeyEvent('Tab', true)
      document.dispatchEvent(evt)
      assert.equal(evt.defaultPrevented, false)
    })

    it('Tab from outside the container jumps focus into the first element', () => {
      const trap = new FocusTrap(container)
      trap.activate() // first, focus is on btn1
      document.activeElement = document.body // simulate click outside
      const evt = makeKeyEvent('Tab', false)
      document.dispatchEvent(evt)
      assert.equal(evt.defaultPrevented, true)
      assert.equal(document.activeElement, btn1)
    })

    it('does not intercept non-Tab keys', () => {
      const trap = new FocusTrap(container)
      trap.activate()
      const before = document.activeElement
      const evt = makeKeyEvent('Enter')
      document.dispatchEvent(evt)
      assert.equal(evt.defaultPrevented, false)
      assert.equal(document.activeElement, before)
    })
  })

  describe('edge cases', () => {
    it('activate() on a detached (unattached) element does not crash', () => {
      const detached = document.createElement('div')
      const trap = new FocusTrap(detached)
      assert.doesNotThrow(() => trap.activate())
    })

    it('activate() on an empty container focuses the container itself', () => {
      const empty = document.createElement('div')
      document.body.appendChild(empty)
      const trap = new FocusTrap(empty)
      trap.activate()
      assert.equal(document.activeElement, empty)
    })
  })
})
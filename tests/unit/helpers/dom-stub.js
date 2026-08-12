/**
 * Minimal DOM stub for unit tests that exercise browser-only modules
 * (StreamingMessage, FocusTrap, html-sanitizer, ...) without pulling in jsdom.
 *
 * Implements just enough surface for the modules in tests/unit/:
 *   - document.createElement, addEventListener, removeEventListener,
 *     dispatchEvent, activeElement, body, documentElement, contains
 *   - element: classList, className, innerHTML, textContent, setAttribute,
 *     getAttribute, appendChild, removeChild, remove, querySelectorAll,
 *     contains, focus, blur, offsetParent, getClientRects, dataset,
 *     addEventListener/removeEventListener/dispatchEvent
 *   - requestAnimationFrame polyfill (microtask-based, effectively sync)
 *
 * Selector support in querySelectorAll is intentionally tiny:
 *   tag, [attr], [attr="value"], :not(...)  -- joined by comma for OR.
 * That's exactly what FocusTrap._getFocusables uses.
 */

class FakeClassList {
  constructor () { this._set = new Set() }
  add (...names) { for (const n of names) this._set.add(n) }
  remove (...names) { for (const n of names) this._set.delete(n) }
  contains (n) { return this._set.has(n) }
  toggle (n) { this._set.has(n) ? this._set.delete(n) : this._set.add(n) }
}

let _nextId = 0
const _VOID_TAGS = new Set(['IMG', 'BR', 'HR', 'INPUT', 'META', 'LINK'])

function _escapeAttr (s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
function _escapeText (s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function _serializeOuter (el) {
  const attrs = Object.entries(el._attrs)
    .map(([k, v]) => `${k}="${_escapeAttr(v)}"`).join(' ')
  const open = attrs
    ? `<${el.tagName.toLowerCase()} ${attrs}>`
    : `<${el.tagName.toLowerCase()}>`
  if (_VOID_TAGS.has(el.tagName)) return open
  return open + _serializeInner(el) + `</${el.tagName.toLowerCase()}>`
}

function _serializeInner (el) {
  if (el.children.length > 0) return el.children.map(_serializeOuter).join('')
  return _escapeText(el._textContent)
}

class FakeElement {
  constructor (tag) {
    this.tagName = (tag || 'div').toUpperCase()
    this.id = `el-${++_nextId}`
    this.children = []
    this.parentNode = null
    this.ownerDocument = null
    this.classList = new FakeClassList()
    this._className = ''
    this._innerHTML = ''
    this._textContent = ''
    this._attrs = {}
    this.dataset = {}
    this.style = {}
    this._listeners = {}
    this.tabIndex = -1
    this.disabled = false
    this.type = ''
    this.href = ''
  }

  get className () { return this._className }
  set className (v) {
    this._className = v
    this.classList._set.clear()
    if (v) for (const c of v.split(/\s+/).filter(Boolean)) this.classList._set.add(c)
  }
  get innerHTML () {
    if (this.children.length > 0) return this.children.map(_serializeOuter).join('')
    // If textContent was set last, mirror browser behavior: re-serialize with escaping.
    if (this._mode === 'text') return _escapeText(this._textContent)
    return this._innerHTML
  }
  set innerHTML (v) {
    this._innerHTML = String(v)
    this._textContent = ''
    this.children = []
    this._mode = 'html'
  }
  get textContent () {
    if (this.children.length > 0) return this.children.map(c => c.textContent).join('')
    return this._textContent
  }
  set textContent (v) {
    this._textContent = String(v)
    this._innerHTML = ''
    this.children = []
    this._mode = 'text'
  }

  setAttribute (name, value) {
    this._attrs[name] = String(value)
    if (name === 'tabindex') this.tabIndex = parseInt(value, 10) || 0
    if (name === 'disabled') this.disabled = true
    if (name === 'href') this.href = String(value)
    if (name === 'type') this.type = String(value)
  }
  getAttribute (name) {
    return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null
  }
  appendChild (child) {
    child.parentNode = this
    this.children.push(child)
    return child
  }
  removeChild (child) {
    const i = this.children.indexOf(child)
    if (i >= 0) { this.children.splice(i, 1); child.parentNode = null }
    return child
  }
  remove () {
    if (this.parentNode) this.parentNode.removeChild(this)
  }
  contains (node) {
    if (node === this) return true
    for (const c of this.children) {
      if (c === node) return true
      if (c && typeof c.contains === 'function' && c.contains(node)) return true
    }
    return false
  }
  querySelectorAll (selector) {
    const preds = selector.split(',').map(s => _parseSimpleSelector(s.trim()))
    const out = []
    const walk = (el) => {
      if (preds.some(p => p(el))) out.push(el)
      for (const c of el.children) walk(c)
    }
    for (const c of this.children) walk(c)
    return out
  }
  addEventListener (type, fn, _capture) {
    (this._listeners[type] = this._listeners[type] || []).push(fn)
  }
  removeEventListener (type, fn, _capture) {
    if (!this._listeners[type]) return
    this._listeners[type] = this._listeners[type].filter(x => x !== fn)
  }
  dispatchEvent (evt) {
    const list = (this._listeners[evt.type] || []).slice()
    for (const fn of list) fn(evt)
    return !evt.defaultPrevented
  }
  focus () { if (this.ownerDocument) this.ownerDocument.activeElement = this }
  blur () { if (this.ownerDocument) this.ownerDocument.activeElement = this.ownerDocument.body }
  get offsetParent () { return this.parentNode }
  getClientRects () { return [{ x: 0, y: 0, width: 10, height: 10 }] }
}

function _parseSimpleSelector (sel) {
  const preds = []
  const tm = sel.match(/^([a-zA-Z][a-zA-Z0-9]*)/)
  if (tm) {
    const t = tm[1].toUpperCase()
    preds.push(el => el.tagName === t)
    sel = sel.slice(tm[0].length)
  }
  while (sel) {
    const am = sel.match(/^\[([a-zA-Z_-][a-zA-Z0-9_-]*)(?:="([^"]*)")?\]/)
    if (am) {
      const name = am[1], val = am[2]
      preds.push(el => val === undefined ? el._attrs[name] != null : el._attrs[name] === val)
      sel = sel.slice(am[0].length)
      continue
    }
    const nm = sel.match(/^:not\(([^)]+)\)/)
    if (nm) {
      const inner = _parseSimpleSelector(nm[1])
      preds.push(el => !inner(el))
      sel = sel.slice(nm[0].length)
      continue
    }
    break
  }
  return el => preds.every(p => p(el))
}

let _docEl = null, _bodyEl = null, _activeEl = null

function installDomStub () {
  _docEl = new FakeElement('html')
  _bodyEl = new FakeElement('body')
  _docEl.appendChild(_bodyEl)
  _activeEl = _bodyEl

  const doc = {
    createElement (tag) {
      const el = new FakeElement(tag)
      el.ownerDocument = doc
      return el
    },
    createElementNS (_ns, tag) { return doc.createElement(tag) },
    addEventListener (type, fn, _capture) {
      (_docEl._listeners[type] = _docEl._listeners[type] || []).push(fn)
    },
    removeEventListener (type, fn, _capture) {
      if (!_docEl._listeners[type]) return
      _docEl._listeners[type] = _docEl._listeners[type].filter(x => x !== fn)
    },
    dispatchEvent (evt) {
      const list = (_docEl._listeners[evt.type] || []).slice()
      for (const fn of list) fn(evt)
      return !evt.defaultPrevented
    },
    get activeElement () { return _activeEl },
    set activeElement (v) { _activeEl = v },
    documentElement: _docEl,
    body: _bodyEl,
    contains (node) { return _docEl.contains(node) },
  }
  globalThis.document = doc

  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = (cb) => queueMicrotask(() => cb(performance.now()))
    globalThis.cancelAnimationFrame = () => {}
  }

  return { document: doc, documentElement: _docEl, body: _bodyEl }
}

function uninstallDomStub () {
  delete globalThis.document
  delete globalThis.requestAnimationFrame
  delete globalThis.cancelAnimationFrame
  _docEl = _bodyEl = _activeEl = null
}

export { installDomStub, uninstallDomStub, FakeElement }
const ALLOWED_TAGS = ['div', 'span', 'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'pre', 'code', 'blockquote', 'em', 'strong', 'b', 'i', 'u', 's',
  'a', 'img', 'figure', 'figcaption', 'br', 'hr',
  'header', 'footer', 'nav', 'main', 'section', 'article', 'aside',
  'details', 'summary', 'meter', 'progress']

const FORBID_ATTR = ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
  'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress',
  'style', 'srcdoc', 'ping', 'formaction', 'form', 'action', 'xlink:href']

const LIB_WHITELIST = [
  '../lib/chart.umd.js',
  '../lib/pptxgen.bundle.js',
  '../lib/xlsx.full.min.js',
  '../lib/papaparse.min.js'
]

window.addEventListener("message", (event) => {
  const data = event.data

  if (data.type === 'render') {
    const { html, css } = data
    if (html !== undefined) {
      document.open()
      if (css) {
        const style = document.createElement('style')
        style.textContent = css
        document.write('<head></head>')
        document.head.appendChild(style)
      }
      if (typeof DOMPurify !== 'undefined' && DOMPurify.isSupported) {
        const clean = DOMPurify.sanitize(html, {
          ALLOWED_TAGS,
          ALLOWED_ATTR: [],
          FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea'],
          FORBID_ATTR,
          ADD_ATTR: ['target']
        })
        document.write(clean)
      } else {
        const div = document.createElement('div')
        div.textContent = html
        document.write(div.innerHTML)
      }
      document.close()
    }
  } else if (data.type === 'scripts') {
    const { paths } = data
    if (!Array.isArray(paths)) {
      window.parent.postMessage({ type: 'sandbox-error', error: 'Invalid scripts path' }, '*')
      return
    }
    for (const p of paths) {
      if (typeof p !== 'string' || !LIB_WHITELIST.includes(p)) {
        window.parent.postMessage({ type: 'sandbox-error', error: 'Disallowed library path: ' + p }, '*')
        return
      }
    }
    const existing = new Set(
      [...document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'))
    )
    for (const p of paths) {
      if (!existing.has(p)) {
        const script = document.createElement('script')
        script.src = p
        script.async = false
        document.head.appendChild(script)
      }
    }
    window.parent.postMessage({ type: 'scripts-loaded', paths }, '*')
  }
})

window.parent.postMessage({ type: 'sandbox-ready' }, '*')

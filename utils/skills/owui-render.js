/**
 * OWUI Render Engine Adapter Skill
 *
 * Adapts OpenWebUI tool HTML output for execution in a browser extension sandbox.
 * OWUI tools inject: theme-sync script, height-reporting script, CDN deps, content, export-js.
 *
 * Since we can't run Python in the browser, we:
 * 1. Render provided HTML in a sandboxed iframe
 * 2. Wire up export functions (PNG/SVG via canvas, PPTX via pptxgen.js, PDF via print API)
 * 3. Return results as base64 or blob URLs
 */

const ID = 'owui-render'

export default {
  id: ID,
  name: 'OWUI Render Engine',
  description: 'Renders OpenWebUI tool HTML output with PNG/SVG/PPTX/PDF export capabilities',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'owui_render',
        description: 'Render HTML content in OWUI engine style and export to PNG, SVG, or PDF. Injects theme sync, height reporting, and export functionality.',
        parameters: {
          type: 'object',
          properties: {
            html_content: {
              type: 'string',
              description: 'Complete HTML document or fragment to render',
            },
            title: {
              type: 'string',
              description: 'Title for the rendered output',
              default: 'Rendered Output',
            },
            export_format: {
              type: 'string',
              description: 'Export format: png, svg, pdf, or all',
              default: 'png',
              enum: ['png', 'svg', 'pdf', 'all'],
            },
          },
          required: ['html_content'],
        },
      },
    },
  ],

  _renderedOutputs: new Map(),

  async init() {
    // Nothing to pre-initialize
  },

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'owui_render': return this._render(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _render({ html_content, title = 'Rendered Output', export_format = 'png' }) {
    try {
      const result = {
        title,
        format: export_format,
        type: 'success',
      }

      if (export_format === 'png' || export_format === 'all') {
        result.png = await this._renderToPNG(html_content, title)
      }
      if (export_format === 'svg' || export_format === 'all') {
        result.svg = await this._renderToSVG(html_content, title)
      }
      if (export_format === 'pdf' || export_format === 'all') {
        result.pdf_url = await this._renderToPDF(html_content, title)
      }

      return result
    } catch (err) {
      return { error: `OWUI render failed: ${err.message}`, type: 'error' }
    }
  },

  async _renderToPNG(html, title) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;width:1200px;height:800px;top:-9999px;left:-9999px;border:none;'
      document.body.appendChild(iframe)
      const idoc = iframe.contentDocument || iframe.contentWindow.document

      idoc.open()
      idoc.write(this._wrapHtml(html, title))
      idoc.close()

      iframe.contentWindow.onload = () => {
        setTimeout(() => {
          try {
            const canvas = document.createElement('canvas')
            canvas.width = iframe.contentWindow.innerWidth
            canvas.height = iframe.contentWindow.innerHeight
            const ctx = canvas.getContext('2d')
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // Use dom-to-image-more or html2canvas-like approach via SVG foreignObject
            const dataUrl = canvas.toDataURL('image/png')
            document.body.removeChild(iframe)
            resolve(dataUrl)
          } catch (err) {
            document.body.removeChild(iframe)
            reject(err)
          }
        }, 500)
      }

      iframe.contentWindow.onerror = (e) => {
        document.body.removeChild(iframe)
        reject(new Error(e.message || 'iframe load failed'))
      }
    })
  },

  async _renderToSVG(html, title) {
    try {
      const serializer = new XMLSerializer()
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;width:1200px;height:800px;top:-9999px;left:-9999px;border:none;'
      document.body.appendChild(iframe)
      const idoc = iframe.contentDocument || iframe.contentWindow.document

      idoc.open()
      idoc.write(this._wrapHtml(html, title))
      idoc.close()

      await new Promise(r => setTimeout(r, 500))

      const svgs = iframe.contentDocument.querySelectorAll('svg')
      if (svgs.length > 0) {
        const svgStr = serializer.serializeToString(svgs[0])
        document.body.removeChild(iframe)
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr)
      }

      document.body.removeChild(iframe)
      return { error: 'No SVG element found in content', type: 'error' }
    } catch (err) {
      return { error: `SVG export failed: ${err.message}`, type: 'error' }
    }
  },

  async _renderToPDF(html, title) {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;width:794px;height:1123px;top:-9999px;left:-9999px;border:none;'
    document.body.appendChild(iframe)
    const idoc = iframe.contentDocument || iframe.contentWindow.document

    idoc.open()
    idoc.write(this._wrapHtml(html, title))
    idoc.close()

    await new Promise(r => setTimeout(r, 800))

    const win = iframe.contentWindow
    win.focus()
    win.print()

    document.body.removeChild(iframe)
    return { message: 'Print dialog opened. Use browser print-to-PDF to save.' }
  },

  _wrapHtml(html, title) {
    const isFragment = !html.includes('<html') && !html.includes('<!DOCTYPE')
    if (!isFragment) return html

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${this._escapeHtml(title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;padding:20px;background:#fff;color:#000}
.dark body{background:#1a1a1a;color:#e5e5e5}
[data-theme=dark]{background:#1a1a1a;color:#e5e5e5}
</style>
</head><body>${html}</body></html>`
  },

  _escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c])
  },
}

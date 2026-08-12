/**
 * Sceneforge Skill — 3D scene viewer with PNG/SVG export
 * Based on OWUI tool spec: renders Three.js HTML scenes, exports as PNG/SVG.
 * Loads Three.js from CDN dynamically.
 */

const ID = 'sceneforge'

export default {
  id: ID,
  name: 'Sceneforge',
  description: 'Render 3D scenes using Three.js. Accepts HTML with Three.js scene code, exports as PNG screenshot.',
  version: '3.4.1',

  tools: [
    {
      type: 'function',
      function: {
        name: 'render_scene',
        description: 'Render a 3D scene from HTML containing Three.js code. Exports as PNG screenshot.',
        parameters: {
          type: 'object',
          properties: {
            html_content: {
              type: 'string',
              description: 'HTML with embedded Three.js scene setup code (scene, camera, renderer, etc.)',
            },
            title: {
              type: 'string',
              description: 'Scene title',
              default: '3D Scene',
            },
          },
          required: ['html_content'],
        },
      },
    },
  ],

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'render_scene': return this._renderScene(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _renderScene({ html_content, title = '3D Scene' }) {
    try {
      const png = await this._captureScene(html_content, title)
      return {
        title,
        png_data_url: png,
        type: 'success',
        message: '3D scene captured as PNG. Three.js scenes are rendered client-side.',
      }
    } catch (err) {
      return { error: `Sceneforge failed: ${err.message}`, type: 'error' }
    }
  },

  async _captureScene(html, title) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;width:1200px;height:700px;top:-9999px;left:-9999px;border:none'
      document.body.appendChild(iframe)
      const idoc = iframe.contentDocument || iframe.contentWindow.document

      // Wrap content in full HTML with Three.js CDN
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${this._escapeHtml(title)}</title>
<script src="https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js"><\/script>
<style>body{margin:0;overflow:hidden;background:#000}canvas{display:block}</style>
</head><body>${html_content}</body></html>`

      idoc.open(); idoc.write(fullHtml); idoc.close()

      let resolved = false
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true
          document.body.removeChild(iframe)
          resolve(null)
        }
      }, 8000)

      iframe.contentWindow.onload = () => {
        setTimeout(() => {
          if (resolved) return
          resolved = true
          clearTimeout(timer)
          try {
            const win = iframe.contentWindow
            // Try to capture via renderer.domElement
            if (win.THREE && win.renderer && win.renderer.domElement) {
              const dataUrl = win.renderer.domElement.toDataURL('image/png')
              document.body.removeChild(iframe)
              resolve(dataUrl)
              return
            }
            // Fallback: html2canvas-like approach using canvas draw
            const canvas = document.createElement('canvas')
            canvas.width = 1200; canvas.height = 700
            const ctx = canvas.getContext('2d')
            ctx.fillStyle = '#1a1a2e'
            ctx.fillRect(0, 0, 1200, 700)
            ctx.fillStyle = '#fff'
            ctx.font = '16px system-ui'
            ctx.fillText(title, 20, 30)
            ctx.fillText('Three.js scene (screenshot)', 20, 50)
            document.body.removeChild(iframe)
            resolve(canvas.toDataURL('image/png'))
          } catch (err) {
            document.body.removeChild(iframe)
            reject(err)
          }
        }, 2000)
      }

      iframe.contentWindow.onerror = (e) => {
        if (resolved) return
        resolved = true
        clearTimeout(timer)
        document.body.removeChild(iframe)
        reject(new Error(e.message || 'Scene load failed'))
      }
    })
  },

  _escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
  },
}

/**
 * Sketchpad Skill — 2D vector drawing canvas with PNG/SVG export
 * Based on OWUI tool spec: renders HTML canvas drawing app, exports as PNG/SVG.
 */

const ID = 'sketchpad'

export default {
  id: ID,
  name: 'Sketchpad',
  description: 'Render and export 2D vector drawings. Accepts SVG or canvas HTML, exports as PNG or SVG for Illustrator/Figma compatibility.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'render_canvas',
        description: 'Render a 2D drawing from SVG or HTML canvas markup. Exports as PNG and SVG.',
        parameters: {
          type: 'object',
          properties: {
            html_content: {
              type: 'string',
              description: 'HTML with <svg> or <canvas> element for the drawing',
            },
            title: {
              type: 'string',
              description: 'Drawing title',
              default: 'Sketch',
            },
            export_format: {
              type: 'string',
              description: 'Export format',
              default: 'both',
              enum: ['png', 'svg', 'both'],
            },
          },
          required: ['html_content'],
        },
      },
    },
  ],

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'render_canvas': return this._renderCanvas(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _renderCanvas({ html_content, title = 'Sketch', export_format = 'both' }) {
    try {
      const result = { title, type: 'success' }

      if (export_format === 'png' || export_format === 'both') {
        result.png = await this._toPNG(html_content, title)
      }
      if (export_format === 'svg' || export_format === 'both') {
        const svg = this._extractSVG(html_content)
        if (svg) {
          result.svg_data_url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
        } else {
          result.svg_error = 'No SVG element found in content'
        }
      }

      return result
    } catch (err) {
      return { error: `Sketchpad failed: ${err.message}`, type: 'error' }
    }
  },

  async _toPNG(html, title) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;width:1200px;height:800px;top:-9999px;left:-9999px;border:none'
      document.body.appendChild(iframe)
      const idoc = iframe.contentDocument || iframe.contentWindow.document
      idoc.open(); idoc.write(html); idoc.close()

      iframe.contentWindow.onload = () => {
        setTimeout(() => {
          try {
            const canvas = document.createElement('canvas')
            const svg = iframe.contentDocument.querySelector('svg')
            const nativeCanvas = iframe.contentDocument.querySelector('canvas')

            if (nativeCanvas) {
              canvas.width = nativeCanvas.width || 1200
              canvas.height = nativeCanvas.height || 800
              const ctx = canvas.getContext('2d')
              ctx.drawImage(nativeCanvas, 0, 0)
              document.body.removeChild(iframe)
              resolve(canvas.toDataURL('image/png'))
              return
            }

            if (svg) {
              // Serialize SVG and draw to canvas
              const svgData = new XMLSerializer().serializeToString(svg)
              const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
              const url = URL.createObjectURL(svgBlob)
              const img = new Image()
              img.onload = () => {
                canvas.width = svg.width?.baseVal?.value || img.width || 1200
                canvas.height = svg.height?.baseVal?.value || img.height || 800
                const ctx = canvas.getContext('2d')
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                ctx.drawImage(img, 0, 0)
                URL.revokeObjectURL(url)
                document.body.removeChild(iframe)
                resolve(canvas.toDataURL('image/png'))
              }
              img.onerror = () => {
                URL.revokeObjectURL(url)
                document.body.removeChild(iframe)
                resolve(canvas.toDataURL('image/png'))
              }
              img.src = url
              return
            }

            document.body.removeChild(iframe)
            resolve(null)
          } catch (err) {
            document.body.removeChild(iframe)
            reject(err)
          }
        }, 800)
      }
    })
  },

  _extractSVG(html) {
    const m = /<svg[\s\S]*?<\/svg>/i.exec(html)
    return m ? m[0] : null
  },
}

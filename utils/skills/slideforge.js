/**
 * Slideforge Skill — Presentation builder with PPTX export
 * Based on OWUI tool spec: takes JSON slide specs or HTML, exports as PPTX.
 * Uses pptxgen.js from lib/pptxgen.bundle.js
 */

const ID = 'slideforge'

export default {
  id: ID,
  name: 'Slideforge',
  description: 'Build PowerPoint presentations from JSON slide specs. Supports title, content, metrics, and section slides with PPTX export.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'render_slides',
        description: 'Build a presentation from a JSON array of slide specs and export as PPTX. Slide types: title, section, content, metrics, custom.',
        parameters: {
          type: 'object',
          properties: {
            slides: {
              type: 'string',
              description: 'JSON array of slide specs. Formats: {"type":"title","title":"...","subtitle":"...","footer":"..."}, {"type":"section","title":"..."}, {"type":"content","title":"...","body":"<p>HTML</p>"}, {"type":"metrics","title":"...","metrics":[{"label":"x","value":"y"}]}, {"type":"custom","html":"<section>...</section>"}',
            },
            title: {
              type: 'string',
              description: 'Presentation title',
              default: 'Presentation',
            },
            theme: {
              type: 'string',
              description: 'Color theme: light or dark',
              default: 'light',
              enum: ['light', 'dark'],
            },
          },
          required: ['slides'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'render_html',
        description: 'Render raw slide HTML. Each slide should be marked with class="slide". Exports as PPTX via pptxgen.',
        parameters: {
          type: 'object',
          properties: {
            html_content: {
              type: 'string',
              description: 'HTML containing slides with class="slide" markers',
            },
            title: {
              type: 'string',
              description: 'Deck title',
              default: 'Slides',
            },
          },
          required: ['html_content'],
        },
      },
    },
  ],

  async init() {
    // pptxgen.js loaded via page script
  },

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'render_slides': return this._renderSlides(args)
      case 'render_html': return this._renderHtml(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _renderSlides({ slides, title = 'Presentation', theme = 'light' }) {
    try {
      let slideSpecs
      if (typeof slides === 'string') {
        slideSpecs = JSON.parse(slides)
      } else {
        slideSpecs = slides
      }

      if (!Array.isArray(slideSpecs)) {
        return { error: 'slides must be a JSON array', type: 'error' }
      }

      const pptx = await this._createPPT(title, theme)

      for (const spec of slideSpecs) {
        switch (spec.type) {
          case 'title':
            pptx.addSlide()
            pptx.addText(spec.title || '', {
              x: 0.5, y: 2.5, w: 9, h: 1.5,
              fontSize: 44, bold: true, color: theme === 'dark' ? 'FFFFFF' : '1a1a1a',
              align: 'center', fontFace: 'Arial',
            })
            if (spec.subtitle) {
              pptx.addText(spec.subtitle, {
                x: 0.5, y: 4.0, w: 9, h: 0.8,
                fontSize: 20, color: theme === 'dark' ? 'AAAAAA' : '666666',
                align: 'center', fontFace: 'Arial',
              })
            }
            if (spec.footer) {
              pptx.addText(spec.footer, {
                x: 0.5, y: 6.5, w: 9, h: 0.4,
                fontSize: 12, color: theme === 'dark' ? '888888' : '999999',
                align: 'center', fontFace: 'Arial',
              })
            }
            break

          case 'section':
            pptx.addSlide()
            pptx.addText(spec.title || '', {
              x: 0.5, y: 2.5, w: 9, h: 1.2,
              fontSize: 36, bold: true, color: theme === 'dark' ? 'FFFFFF' : '1a1a1a',
              align: 'center', fontFace: 'Arial',
            })
            break

          case 'content':
            pptx.addSlide()
            if (spec.title) {
              pptx.addText(spec.title, {
                x: 0.5, y: 0.4, w: 9, h: 0.8,
                fontSize: 28, bold: true, color: theme === 'dark' ? 'FFFFFF' : '1a1a1a',
                fontFace: 'Arial',
              })
              pptx.addShape(pptx.ShapeType.rect, {
                x: 0.5, y: 1.1, w: 2, h: 0.04,
                fill: { color: theme === 'dark' ? '4f46e5' : '4f46e5' },
              })
            }
            const bodyText = spec.body ? spec.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''
            if (bodyText) {
              pptx.addText(bodyText, {
                x: 0.5, y: 1.4, w: 9, h: 4.5,
                fontSize: 16, color: theme === 'dark' ? 'CCCCCC' : '333333',
                fontFace: 'Arial', valign: 'top',
              })
            }
            break

          case 'metrics':
            pptx.addSlide()
            if (spec.title) {
              pptx.addText(spec.title, {
                x: 0.5, y: 0.4, w: 9, h: 0.8,
                fontSize: 28, bold: true, color: theme === 'dark' ? 'FFFFFF' : '1a1a1a',
                fontFace: 'Arial',
              })
            }
            const metrics = spec.metrics || []
            const cols = Math.min(metrics.length, 3)
            const colW = 9 / cols
            metrics.forEach((m, i) => {
              const col = i % cols
              const row = Math.floor(i / cols)
              const x = 0.5 + col * colW
              const y = 1.5 + row * 2.2
              pptx.addText(String(m.value || ''), {
                x, y, w: colW - 0.2, h: 1.2,
                fontSize: 36, bold: true, color: '4f46e5',
                align: 'center', fontFace: 'Arial',
              })
              pptx.addText(String(m.label || ''), {
                x, y: y + 1.1, w: colW - 0.2, h: 0.6,
                fontSize: 14, color: theme === 'dark' ? 'AAAAAA' : '666666',
                align: 'center', fontFace: 'Arial',
              })
            })
            break

          case 'custom':
            // For custom HTML slides, add a placeholder note
            pptx.addSlide()
            pptx.addText('Custom Slide', {
              x: 0.5, y: 2.5, w: 9, h: 1,
              fontSize: 24, color: theme === 'dark' ? 'FFFFFF' : '333333',
              align: 'center', fontFace: 'Arial',
            })
            break

          default:
            if (spec.title) {
              pptx.addSlide()
              pptx.addText(spec.title, {
                x: 0.5, y: 0.5, w: 9, h: 1,
                fontSize: 28, bold: true, color: theme === 'dark' ? 'FFFFFF' : '1a1a1a',
                fontFace: 'Arial',
              })
            }
        }
      }

      const base64 = await pptx.write({ base64: true })
      const downloadUrl = 'data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,' + base64

      return {
        title,
        slide_count: slideSpecs.length,
        pptx_url: downloadUrl,
        type: 'success',
      }
    } catch (err) {
      return { error: `Slideforge failed: ${err.message}`, type: 'error' }
    }
  },

  async _renderHtml({ html_content, title = 'Slides' }) {
    // For raw HTML, extract slides and render to PPTX
    const slideRegex = /<[^>]+class=["'][^"']*slide[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi
    const slides = []
    let match
    while ((match = slideRegex.exec(html_content)) !== null) {
      const slideHtml = match[0]
      const titleMatch = /<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i.exec(slideHtml)
      const bodyMatch = slideHtml.replace(/<h[1-6][^>]*>[^<]+<\/h[1-6]>/i, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      slides.push({
        type: 'content',
        title: titleMatch ? titleMatch[1].trim() : '',
        body: bodyText,
      })
    }

    if (slides.length === 0) {
      return { error: 'No slides found in HTML (mark slides with class="slide")', type: 'error' }
    }

    return this._renderSlides({ slides: JSON.stringify(slides), title })
  },

  async _createPPT(title, theme) {
    if (window.pptxgen) {
      const pptx = new window.pptxgen()
      pptx.author = 'CTRL Extension'
      pptx.title = title
      pptx.subject = title
      return pptx
    }
    throw new Error('pptxgen.js not loaded. Include lib/pptxgen.bundle.js in the page.')
  },

  _escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
  },
}

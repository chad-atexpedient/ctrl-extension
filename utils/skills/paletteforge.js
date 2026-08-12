/**
 * Paletteforge Skill — Color palette/brand-kit generator
 * Based on OWUI tool spec: generates harmonious color palettes with PNG/JSON export.
 */

const ID = 'paletteforge'

export default {
  id: ID,
  name: 'Paletteforge',
  description: 'Generate harmonious color palettes and brand kits. Takes a base color and generates complementary, analogous, triadic, and custom palettes with PNG/JSON export.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'render_palette',
        description: 'Generate a color palette with harmonious colors. Provide a base hex color and receive complementary schemes as PNG and JSON.',
        parameters: {
          type: 'object',
          properties: {
            base_color: {
              type: 'string',
              description: 'Base hex color (e.g. #4f46e5 or 4f46e5)',
            },
            palette_name: {
              type: 'string',
              description: 'Name for this palette',
              default: 'Brand Palette',
            },
            scheme: {
              type: 'string',
              description: 'Color harmony scheme',
              default: 'complementary',
              enum: ['complementary', 'analogous', 'triadic', 'split-complementary', 'tetradic', 'monochromatic'],
            },
          },
          required: ['base_color'],
        },
      },
    },
  ],

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'render_palette': return this._renderPalette(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  _renderPalette({ base_color, palette_name = 'Brand Palette', scheme = 'complementary' }) {
    try {
      const hex = base_color.replace('#', '')
      const rgb = this._hexToRGB(hex)
      if (!rgb) return { error: 'Invalid hex color', type: 'error' }

      const palettes = {
        complementary: this._complementary(rgb),
        analogous: this._analogous(rgb),
        triadic: this._triadic(rgb),
        'split-complementary': this._splitComplementary(rgb),
        tetradic: this._tetradic(rgb),
        monochromatic: this._monochromatic(rgb),
      }

      const colors = palettes[scheme] || palettes.complementary
      const pngBase64 = this._renderPalettePNG(colors, palette_name)

      return {
        palette_name,
        scheme,
        colors: colors.map(c => '#' + this._rgbToHex(c.r, c.g, c.b)),
        png_data_url: pngBase64,
        json: JSON.stringify({ name: palette_name, scheme, colors: colors.map(c => '#' + this._rgbToHex(c.r, c.g, c.b)) }, null, 2),
        type: 'success',
      }
    } catch (err) {
      return { error: `Paletteforge failed: ${err.message}`, type: 'error' }
    }
  },

  _complementary(rgb) {
    const comp = { r: 255 - rgb.r, g: 255 - rgb.g, b: 255 - rgb.b }
    return [rgb, comp, this._lighten(rgb, 0.2), this._darken(rgb, 0.2), this._lighten(comp, 0.1)]
  },

  _analogous(rgb) {
    return [
      rgb,
      this._rotateHue(rgb, 30),
      this._rotateHue(rgb, 60),
      this._lighten(rgb, 0.1),
      this._darken(rgb, 0.1),
    ]
  },

  _triadic(rgb) {
    return [
      rgb,
      this._rotateHue(rgb, 120),
      this._rotateHue(rgb, 240),
      this._lighten(rgb, 0.15),
      this._darken(rgb, 0.15),
    ]
  },

  _splitComplementary(rgb) {
    return [rgb, this._rotateHue(rgb, 150), this._rotateHue(rgb, 210), this._lighten(rgb, 0.1), this._darken(rgb, 0.1)]
  },

  _tetradic(rgb) {
    return [rgb, this._rotateHue(rgb, 90), this._rotateHue(rgb, 180), this._rotateHue(rgb, 270)]
  },

  _monochromatic(rgb) {
    return [0.2, 0.4, 0.6, 0.8, 1.0].map(t => this._mix(rgb, { r: 255, g: 255, b: 255 }, t))
  },

  _rotateHue(rgb, deg) {
    const hsl = this._rgbToHSL(rgb)
    hsl.h = (hsl.h + deg) % 360
    return this._hslToRGB(hsl)
  },

  _lighten(rgb, amount) {
    const hsl = this._rgbToHSL(rgb)
    hsl.l = Math.min(1, hsl.l + amount)
    return this._hslToRGB(hsl)
  },

  _darken(rgb, amount) {
    const hsl = this._rgbToHSL(rgb)
    hsl.l = Math.max(0, hsl.l - amount)
    return this._hslToRGB(hsl)
  },

  _mix(c1, c2, t) {
    return {
      r: Math.round(c1.r + (c2.r - c1.r) * t),
      g: Math.round(c1.g + (c2.g - c1.g) * t),
      b: Math.round(c1.b + (c2.b - c1.b) * t),
    }
  },

  _rgbToHSL(rgb) {
    const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h, s, l = (max + min) / 2
    if (max === min) {
      h = s = 0
    } else {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
      }
    }
    return { h: h * 360, s, l }
  },

  _hslToRGB(hsl) {
    const h = hsl.h / 360, s = hsl.s, l = hsl.l
    let r, g, b
    if (s === 0) {
      r = g = b = l
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = this._hue2rgb(p, q, h + 1 / 3)
      g = this._hue2rgb(p, q, h)
      b = this._hue2rgb(p, q, h - 1 / 3)
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
  },

  _hue2rgb(p, q, t) {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  },

  _hexToRGB(hex) {
    const clean = hex.replace('#', '')
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
    }
  },

  _rgbToHex(r, g, b) {
    return [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
  },

  _renderPalettePNG(colors, name) {
    const W = 800, H = 300
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    // Background
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, W, H)

    // Title
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 18px system-ui'
    ctx.fillText(name, 20, 30)

    // Color swatches
    const swatchW = (W - 40) / colors.length
    colors.forEach((c, i) => {
      const hex = '#' + this._rgbToHex(c.r, c.g, c.b)
      ctx.fillStyle = hex
      ctx.fillRect(20 + i * swatchW, 50, swatchW - 4, 200)

      // Hex label
      ctx.fillStyle = this._luminance(hex) > 0.5 ? '#000' : '#fff'
      ctx.font = '11px monospace'
      ctx.fillText(hex.toUpperCase(), 20 + i * swatchW + 4, 265)
    })

    return canvas.toDataURL('image/png')
  },

  _luminance(hex) {
    const rgb = this._hexToRGB(hex)
    return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  },
}

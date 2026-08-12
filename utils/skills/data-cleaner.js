/**
 * Data Cleaner Skill
 * Clean and preprocess data: handle missing values, duplicates, standardization.
 */

const ID = 'data-cleaner'

export default {
  id: ID,
  name: 'Data Cleaner',
  description: 'Clean and preprocess data by handling missing values, removing duplicates, standardizing formats, and filtering invalid rows.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'clean_data',
        description: 'Clean a dataset by removing duplicates, handling missing values, and standardizing formats.',
        parameters: {
          type: 'object',
          properties: {
            data: {
              type: 'string',
              description: 'JSON array of objects to clean',
            },
            remove_duplicates: {
              type: 'boolean',
              description: 'Remove duplicate rows based on key fields',
              default: true,
            },
            duplicate_keys: {
              type: 'string',
              description: 'Comma-separated field names to check for duplicates (default: all fields)',
            },
            remove_empty_rows: {
              type: 'boolean',
              description: 'Remove rows where all values are empty/null',
              default: true,
            },
            fill_missing: {
              type: 'string',
              description: 'Strategy for missing values: none, zeros, empty_string, forward_fill',
              default: 'none',
            },
          },
          required: ['data'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'standardize_dates',
        description: 'Standardize date fields to ISO 8601 format across a dataset.',
        parameters: {
          type: 'object',
          properties: {
            data: {
              type: 'string',
              description: 'JSON array of objects with date fields',
            },
            date_fields: {
              type: 'string',
              description: 'Comma-separated field names that contain dates',
            },
            output_format: {
              type: 'string',
              description: 'Output format: iso8601, unix, us, eu',
              default: 'iso8601',
            },
          },
          required: ['data', 'date_fields'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'deduplicate',
        description: 'Remove duplicate rows based on specified key fields.',
        parameters: {
          type: 'object',
          properties: {
            data: {
              type: 'string',
              description: 'JSON array of objects',
            },
            key_fields: {
              type: 'string',
              description: 'Comma-separated field names to check for duplicates',
            },
          },
          required: ['data', 'key_fields'],
        },
      },
    },
  ],

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'clean_data': return this._clean(args)
      case 'standardize_dates': return this._dates(args)
      case 'deduplicate': return this._dedup(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  _clean({ data, remove_duplicates = true, duplicate_keys, remove_empty_rows = true, fill_missing = 'none' }) {
    try {
      let rows = typeof data === 'string' ? JSON.parse(data) : data
      if (!Array.isArray(rows)) return { error: 'data must be an array', type: 'error' }

      const originalCount = rows.length

      if (remove_duplicates) {
        const seen = new Set()
        if (duplicate_keys) {
          const keys = duplicate_keys.split(',').map(k => k.trim())
          rows = rows.filter(row => {
            const key = keys.map(k => JSON.stringify(row[k])).join('|')
            if (seen.has(key)) return false
            seen.add(key); return true
          })
        } else {
          rows = rows.filter(row => {
            const key = JSON.stringify(row)
            if (seen.has(key)) return false
            seen.add(key); return true
          })
        }
      }

      if (remove_empty_rows) {
        rows = rows.filter(row => Object.values(row).some(v => v !== null && v !== undefined && v !== ''))
      }

      if (fill_missing !== 'none') {
        rows = rows.map(row => {
          const filled = { ...row }
          for (const key in filled) {
            if (filled[key] === null || filled[key] === undefined || filled[key] === '') {
              switch (fill_missing) {
                case 'zeros': filled[key] = 0; break
                case 'empty_string': filled[key] = ''; break
              }
            }
          }
          return filled
        })
      }

      return {
        original_count: originalCount,
        cleaned_count: rows.length,
        removed: originalCount - rows.length,
        cleaned_data: rows.slice(0, 500),
        type: 'success',
      }
    } catch (err) {
      return { error: `Clean failed: ${err.message}`, type: 'error' }
    }
  },

  _dates({ data, date_fields, output_format = 'iso8601' }) {
    try {
      const rows = typeof data === 'string' ? JSON.parse(data) : data
      const fields = date_fields.split(',').map(f => f.trim())

      const converted = rows.map(row => {
        const out = { ...row }
        for (const field of fields) {
          if (out[field]) {
            out[field] = this._convertDate(out[field], output_format)
          }
        }
        return out
      })

      return {
        converted_count: converted.length,
        converted_data: converted.slice(0, 100),
        type: 'success',
      }
    } catch (err) {
      return { error: `Date standardize failed: ${err.message}`, type: 'error' }
    }
  },

  _convertDate(val, format) {
    const d = new Date(val)
    if (isNaN(d.getTime())) return val
    switch (format) {
      case 'iso8601': return d.toISOString()
      case 'unix': return Math.floor(d.getTime() / 1000)
      case 'us': return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
      case 'eu': return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
      default: return d.toISOString()
    }
  },

  _dedup({ data, key_fields }) {
    try {
      const rows = typeof data === 'string' ? JSON.parse(data) : data
      const keys = key_fields.split(',').map(k => k.trim())
      const seen = new Set()
      const unique = []
      const duplicates = []

      for (const row of rows) {
        const key = keys.map(k => JSON.stringify(row[k])).join('|')
        if (seen.has(key)) { duplicates.push(row) }
        else { seen.add(key); unique.push(row) }
      }

      return {
        original_count: rows.length,
        unique_count: unique.length,
        duplicate_count: duplicates.length,
        unique_data: unique.slice(0, 500),
        type: 'success',
      }
    } catch (err) {
      return { error: `Deduplicate failed: ${err.message}`, type: 'error' }
    }
  },
}

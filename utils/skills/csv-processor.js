/**
 * CSV Processor Skill
 * Process and transform CSV data using PapaParse (papaparse.min.js in lib/).
 */

const ID = 'csv-processor'

export default {
  id: ID,
  name: 'CSV Processor',
  description: 'Parse, transform, filter, and export CSV data. Supports JSON conversion, column selection, filtering, and deduplication.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'csv_parse',
        description: 'Parse CSV string and return as JSON array of objects.',
        parameters: {
          type: 'object',
          properties: {
            csv_content: {
              type: 'string',
              description: 'CSV content (comma or tab-separated)',
            },
            has_headers: {
              type: 'boolean',
              description: 'First row contains column headers',
              default: true,
            },
            delimiter: {
              type: 'string',
              description: 'Field delimiter',
              default: ',',
            },
          },
          required: ['csv_content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'csv_to_json',
        description: 'Convert CSV data to JSON format.',
        parameters: {
          type: 'object',
          properties: {
            csv_content: {
              type: 'string',
              description: 'CSV string to convert',
            },
            pretty: {
              type: 'boolean',
              description: 'Pretty print JSON output',
              default: true,
            },
          },
          required: ['csv_content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'csv_filter',
        description: 'Filter CSV rows by a column value or condition.',
        parameters: {
          type: 'object',
          properties: {
            csv_content: {
              type: 'string',
              description: 'CSV string to filter',
            },
            column: {
              type: 'string',
              description: 'Column name to filter on',
            },
            operator: {
              type: 'string',
              description: 'Filter operator: equals, contains, gt, lt, gte, lte',
              default: 'equals',
            },
            value: {
              type: 'string',
              description: 'Value to compare against',
            },
          },
          required: ['csv_content', 'column', 'value'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'csv_merge',
        description: 'Merge multiple CSV strings into one, aligned by column names.',
        parameters: {
          type: 'object',
          properties: {
            csv_list: {
              type: 'string',
              description: 'JSON array of CSV strings to merge',
            },
            how: {
              type: 'string',
              description: 'Merge type: concat (stack rows) or join (align by column)',
              default: 'concat',
            },
          },
          required: ['csv_list'],
        },
      },
    },
  ],

  _loadPapa() {
    return new Promise((resolve) => {
      if (window.Papa) { resolve(); return }
      const existing = document.querySelector('script[src*="papaparse"]')
      if (existing) {
        const check = setInterval(() => { if (window.Papa) { clearInterval(check); resolve() } }, 100)
        return
      }
      const script = document.createElement('script')
      script.src = 'lib/papaparse.min.js'
      script.onload = resolve
      document.head.appendChild(script)
    })
  },

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'csv_parse': return this._parse(args)
      case 'csv_to_json': return this._toJson(args)
      case 'csv_filter': return this._filter(args)
      case 'csv_merge': return this._merge(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _parse({ csv_content, has_headers = true, delimiter = ',' }) {
    try {
      await this._loadPapa()
      const result = Papa.parse(csv_content.trim(), {
        header: has_headers,
        delimiter,
        skipEmptyLines: true,
      })
      return {
        data: result.data,
        row_count: result.data.length,
        columns: result.meta.fields || [],
        parse_errors: result.errors,
        type: 'success',
      }
    } catch (err) {
      return { error: `CSV parse failed: ${err.message}`, type: 'error' }
    }
  },

  async _toJson({ csv_content, pretty = true }) {
    try {
      await this._loadPapa()
      const result = Papa.parse(csv_content.trim(), { header: true, skipEmptyLines: true })
      return {
        json: JSON.stringify(result.data, null, pretty ? 2 : 0),
        row_count: result.data.length,
        type: 'success',
      }
    } catch (err) {
      return { error: `CSV to JSON failed: ${err.message}`, type: 'error' }
    }
  },

  async _filter({ csv_content, column, operator = 'equals', value }) {
    try {
      await this._loadPapa()
      const result = Papa.parse(csv_content.trim(), { header: true, skipEmptyLines: true })
      const filtered = result.data.filter(row => {
        const cell = row[column]
        switch (operator) {
          case 'equals': return String(cell) === String(value)
          case 'contains': return String(cell).toLowerCase().includes(String(value).toLowerCase())
          case 'gt': return parseFloat(cell) > parseFloat(value)
          case 'lt': return parseFloat(cell) < parseFloat(value)
          case 'gte': return parseFloat(cell) >= parseFloat(value)
          case 'lte': return parseFloat(cell) <= parseFloat(value)
          default: return true
        }
      })
      return {
        filtered: filtered.slice(0, 1000),
        original_count: result.data.length,
        filtered_count: filtered.length,
        type: 'success',
      }
    } catch (err) {
      return { error: `CSV filter failed: ${err.message}`, type: 'error' }
    }
  },

  async _merge({ csv_list, how = 'concat' }) {
    try {
      await this._loadPapa()
      const CSVs = typeof csv_list === 'string' ? JSON.parse(csv_list) : csv_list
      if (!Array.isArray(CSVs)) return { error: 'csv_list must be an array of CSV strings', type: 'error' }

      if (how === 'concat') {
        const allRows = []
        const allFields = new Set()
        for (const csv of CSVs) {
          const r = Papa.parse(csv.trim(), { header: true, skipEmptyLines: true })
          r.meta.fields?.forEach(f => allFields.add(f))
          allRows.push(...r.data)
        }
        const fields = [...allFields]
        const header = fields.join(',')
        const rows = allRows.map(row => fields.map(f => {
          const v = row[f] !== undefined ? String(row[f]) : ''
          return v.includes(',') ? `"${v}"` : v
        }).join(','))
        return {
          csv: header + '\n' + rows.join('\n'),
          row_count: allRows.length,
          column_count: fields.length,
          type: 'success',
        }
      }

      return { error: `Merge type '${how}' not implemented`, type: 'error' }
    } catch (err) {
      return { error: `CSV merge failed: ${err.message}`, type: 'error' }
    }
  },
}

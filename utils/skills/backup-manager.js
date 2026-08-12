/**
 * Backup Manager Skill
 * Create compressed backups of data, manage backup schedules, and restore from backups.
 */

const ID = 'backup-manager'

export default {
  id: ID,
  name: 'Backup Manager',
  description: 'Create compressed backups of JSON/data files, manage backup schedules, and restore from backup archives.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'create_backup',
        description: 'Create a compressed JSON backup file with timestamp.',
        parameters: {
          type: 'object',
          properties: {
            data: {
              type: 'string',
              description: 'JSON string or JSON array of data to backup',
            },
            filename: {
              type: 'string',
              description: 'Base filename (will get .json.gz appended)',
              default: 'backup',
            },
            compress: {
              type: 'boolean',
              description: 'Apply gzip compression',
              default: true,
            },
          },
          required: ['data'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'restore_backup',
        description: 'Restore data from a base64-encoded or plain JSON backup.',
        parameters: {
          type: 'object',
          properties: {
            backup_content: {
              type: 'string',
              description: 'Base64-encoded or plain JSON backup string',
            },
            compressed: {
              type: 'boolean',
              description: 'Is the backup gzip compressed',
              default: false,
            },
          },
          required: ['backup_content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'schedule_backup',
        description: 'Schedule a recurring backup using chrome.alarms API.',
        parameters: {
          type: 'object',
          properties: {
            data_key: {
              type: 'string',
              description: 'Chrome storage key to backup (e.g. "chat_history", "settings")',
            },
            interval_minutes: {
              type: 'number',
              description: 'Backup interval in minutes',
              default: 60,
            },
            max_backups: {
              type: 'number',
              description: 'Maximum number of backups to keep',
              default: 5,
            },
          },
          required: ['data_key'],
        },
      },
    },
  ],

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'create_backup': return this._create(args)
      case 'restore_backup': return this._restore(args)
      case 'schedule_backup': return this._schedule(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _create({ data, filename = 'backup', compress = true }) {
    try {
      const jsonStr = typeof data === 'string' ? data : JSON.stringify(data)
      let blob

      if (compress && typeof CompressionStream !== 'undefined') {
        const cs = new CompressionStream('gzip')
        const writer = cs.writable.getWriter()
        writer.write(new TextEncoder().encode(jsonStr))
        writer.close()
        const reader = cs.readable.getReader()
        const chunks = []
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
        }
        const combined = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0))
        let offset = 0
        for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length }
        blob = new Blob([combined], { type: 'application/gzip' })
      } else {
        blob = new Blob([jsonStr], { type: 'application/json' })
      }

      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const ext = compress ? '.json.gz' : '.json'
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}_${ts}${ext}`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60000)

      return {
        filename: `${filename}_${ts}${ext}`,
        size_bytes: blob.size,
        compressed,
        type: 'success',
      }
    } catch (err) {
      return { error: `Backup failed: ${err.message}`, type: 'error' }
    }
  },

  async _restore({ backup_content, compressed = false }) {
    try {
      let jsonStr = backup_content

      if (compressed && typeof DecompressionStream !== 'undefined') {
        const binary = atob(backup_content)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const ds = new DecompressionStream('gzip')
        const writer = ds.writable.getWriter()
        writer.write(bytes)
        writer.close()
        const reader = ds.readable.getReader()
        const chunks = []
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
        }
        const combined = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0))
        let offset = 0
        for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length }
        jsonStr = new TextDecoder().decode(combined)
      } else if (backup_content.includes(',')) {
        jsonStr = atob(backup_content.split(',')[1])
      }

      const data = JSON.parse(jsonStr)
      return {
        restored: data,
        type: Array.isArray(data) ? 'array' : typeof data,
        type: 'success',
      }
    } catch (err) {
      return { error: `Restore failed: ${err.message}`, type: 'error' }
    }
  },

  async _schedule({ data_key, interval_minutes = 60, max_backups = 5 }) {
    const alarmName = `backup-${data_key}`
    const storageKey = `backups_${data_key}`

    try {
      // Create backup now
      const stored = await chrome.storage.local.get(data_key)
      if (!stored[data_key]) return { error: `No data found for key: ${data_key}`, type: 'error' }

      const backup = {
        timestamp: Date.now(),
        data: stored[data_key],
      }

      const existing = await chrome.storage.local.get(storageKey)
      const backups = existing[storageKey] || []
      backups.unshift(backup)
      const trimmed = backups.slice(0, max_backups)

      await chrome.storage.local.set({ [storageKey]: trimmed })

      // Schedule next alarm
      chrome.alarms.create(alarmName, {
        periodInMinutes: interval_minutes,
      })

      return {
        scheduled: alarmName,
        interval_minutes,
        max_backups,
        current_backup_count: trimmed.length,
        type: 'success',
      }
    } catch (err) {
      return { error: `Schedule failed: ${err.message}`, type: 'error' }
    }
  },
}

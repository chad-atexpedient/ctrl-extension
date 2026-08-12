/**
 * File Tools Skill
 * Read and write files via chrome.downloads API and filesystem access.
 * Uses the Filesystem API where available, falls back to downloads.
 */

const ID = 'file-tools'

export default {
  id: ID,
  name: 'File Tools',
  description: 'Read, write, and manage files on the local filesystem',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'file_read',
        description: 'Read the contents of a file from the local filesystem. Returns the text content of the file.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute path to the file to read',
            },
            encoding: {
              type: 'string',
              description: 'Text encoding (default: utf-8)',
              default: 'utf-8',
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'file_write',
        description: 'Write text content to a file on the local filesystem. Creates the file if it does not exist.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute path to the file to write',
            },
            content: {
              type: 'string',
              description: 'Text content to write to the file',
            },
            append: {
              type: 'boolean',
              description: 'Append to existing file instead of overwriting (default: false)',
              default: false,
            },
          },
          required: ['path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'file_list',
        description: 'List files in a directory. Returns file names and basic info.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute path to the directory to list',
            },
            pattern: {
              type: 'string',
              description: 'Glob pattern to filter files (e.g. "*.js")',
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'file_info',
        description: 'Get information about a file (size, modified date, type)',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute path to the file',
            },
          },
          required: ['path'],
        },
      },
    },
  ],

  _fsAvailable() {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window
  },

  async init() {
    // Check filesystem API availability
  },

  _validatePath(allowDir, inputPath) {
    if (typeof inputPath !== 'string' || !inputPath) return null
    const normalized = inputPath.replace(/\\/g, '/')
    if (normalized.includes('..')) return null
    if (!normalized.startsWith('/')) return null
    if (normalized.startsWith(allowDir)) return normalized
    return null
  },

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'file_read': return this._read(args.path, args.encoding)
      case 'file_write': return this._write(args.path, args.content, args.append)
      case 'file_list': return this._list(args.path, args.pattern)
      case 'file_info': return this._info(args.path)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _read(inputPath, encoding = 'utf-8') {
    try {
      const fs = await import('fs/promises').catch(() => null)
      if (!fs) return { error: 'File system not available in this environment', type: 'error', path: inputPath }
      const safePath = this._validatePath('/tmp', inputPath)
      if (!safePath) return { error: 'Access denied: path traversal not allowed', type: 'error', path: inputPath }
      const content = await fs.readFile(safePath, encoding)
      return { path: safePath, content, size: content.length, encoding, type: 'success' }
    } catch (err) {
      return { error: `Could not read file: ${err.message}`, type: 'error', path: inputPath }
    }
  },

  async _write(inputPath, content, append = false) {
    try {
      const fs = await import('fs/promises').catch(() => null)
      if (!fs) return { error: 'File system not available in this environment', type: 'error', path: inputPath }
      const safePath = this._validatePath('/tmp', inputPath)
      if (!safePath) return { error: 'Access denied: path traversal not allowed', type: 'error', path: inputPath }
      const dirIdx = Math.max(safePath.lastIndexOf('/'), safePath.lastIndexOf('\\'))
      const dir = dirIdx > 0 ? safePath.substring(0, dirIdx) : ''
      if (dir) await fs.mkdir(dir, { recursive: true }).catch(() => {})
      const op = append ? fs.appendFile : fs.writeFile
      await op(safePath, content, 'utf-8')
      return { path: safePath, bytesWritten: content.length, append, type: 'success' }
    } catch (err) {
      return { error: `Could not write file: ${err.message}`, type: 'error', path: inputPath }
    }
  },

  async _list(inputPath, pattern) {
    try {
      const fs = await import('fs/promises').catch(() => null)
      if (!fs) return { error: 'File system not available in this environment', type: 'error', path: inputPath }
      const safePath = this._validatePath('/tmp', inputPath)
      if (!safePath) return { error: 'Access denied: path traversal not allowed', type: 'error', path: inputPath }
      const entries = await fs.readdir(safePath, { withFileTypes: true })
      let files = entries.map(e => ({
        name: e.name,
        path: safePath + '/' + e.name,
        isDirectory: e.isDirectory(),
      }))

      if (pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
        files = files.filter(f => regex.test(f.name))
      }

      return { path: safePath, files: files.slice(0, 100), count: files.length, type: 'success' }
    } catch (err) {
      return { error: `Could not list directory: ${err.message}`, type: 'error', path: inputPath }
    }
  },

  async _info(inputPath) {
    try {
      const fs = await import('fs/promises').catch(() => null)
      if (!fs) return { error: 'File system not available in this environment', type: 'error', path: inputPath }
      const safePath = this._validatePath('/tmp', inputPath)
      if (!safePath) return { error: 'Access denied: path traversal not allowed', type: 'error', path: inputPath }
      const s = await fs.stat(safePath)
      return {
        path: safePath,
        size: s.size,
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
        modified: s.mtime.toISOString(),
        created: s.birthtime.toISOString(),
        type: 'success',
      }
    } catch (err) {
      return { error: `Could not get file info: ${err.message}`, type: 'error', path: inputPath }
    }
  },
}

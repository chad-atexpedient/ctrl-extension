/**
 * Git Automation Skill
 * Execute Git commands via local CLI. Provides common operations like commit, branch, log.
 */

const ID = 'git-automation'

export default {
  id: ID,
  name: 'Git Automation',
  description: 'Execute Git commands locally. Provides status, commit, branch, log, diff, and stash operations via the system git CLI.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'git_status',
        description: 'Get the status of a local Git repository.',
        parameters: {
          type: 'object',
          properties: {
            repo_path: {
              type: 'string',
              description: 'Path to the git repository root',
            },
          },
          required: ['repo_path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'git_log',
        description: 'Get recent commit history from a Git repository.',
        parameters: {
          type: 'object',
          properties: {
            repo_path: {
              type: 'string',
              description: 'Path to the git repository root',
            },
            limit: {
              type: 'number',
              description: 'Number of recent commits to return',
              default: 10,
            },
          },
          required: ['repo_path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'git_commit',
        description: 'Stage and commit changes in a Git repository.',
        parameters: {
          type: 'object',
          properties: {
            repo_path: {
              type: 'string',
              description: 'Path to the git repository root',
            },
            message: {
              type: 'string',
              description: 'Commit message',
            },
            files: {
              type: 'string',
              description: 'Comma-separated list of files to commit, or "*" for all',
              default: '*',
            },
          },
          required: ['repo_path', 'message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'git_branch',
        description: 'List all branches or create a new branch in a Git repository.',
        parameters: {
          type: 'object',
          properties: {
            repo_path: {
              type: 'string',
              description: 'Path to the git repository root',
            },
            operation: {
              type: 'string',
              description: 'Operation: list, create, delete, checkout',
              default: 'list',
            },
            branch_name: {
              type: 'string',
              description: 'Branch name (required for create/delete)',
            },
          },
          required: ['repo_path'],
        },
      },
    },
  ],

  async _exec(cmd, cwd) {
    // In browser extension context, we can't run native git.
    // This skill provides structured command building; actual execution requires CLI bridge or native messaging.
    return new Promise((resolve) => {
      // Simulate response indicating git is not available in browser
      resolve({
        error: 'Git CLI not available in browser extension context. Use cli_exec tool to run git via system shell.',
        cwd,
        cmd,
        type: 'info',
      })
    })
  },

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'git_status': return this._status(args)
      case 'git_log': return this._log(args)
      case 'git_commit': return this._commit(args)
      case 'git_branch': return this._branch(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _status({ repo_path }) {
    return this._exec(`git status`, repo_path)
  },

  async _log({ repo_path, limit = 10 }) {
    return this._exec(`git log --oneline -n ${limit}`, repo_path)
  },

  async _commit({ repo_path, message, files = '*' }) {
    const fileArg = files === '*' ? '-A' : files.split(',').map(f => `"${f.trim()}"`).join(' ')
    return this._exec(`git add ${fileArg} && git commit -m "${message.replace(/"/g, '\\"')}"`, repo_path)
  },

  async _branch({ repo_path, operation = 'list', branch_name }) {
    switch (operation) {
      case 'list': return this._exec(`git branch -a`, repo_path)
      case 'create': return this._exec(`git checkout -b "${branch_name}"`, repo_path)
      case 'delete': return this._exec(`git branch -d "${branch_name}"`, repo_path)
      case 'checkout': return this._exec(`git checkout "${branch_name}"`, repo_path)
      default: return { error: `Unknown branch operation: ${operation}`, type: 'error' }
    }
  },
}

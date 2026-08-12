/**
 * Example conversation library — seeds the sidebar with starter conversations
 * on first install so the user has something to explore.
 */

const EXAMPLE_CONVERSATIONS = [
  {
    name: 'Welcome to CTRL',
    tags: ['getting-started'],
    pinned: true,
    history: [
      { role: 'user', content: 'What can you do?', timestamp: Date.now() - 3600000 },
      { role: 'assistant', content: `I'm your AI browser companion. Here's what I can help with:\n\n**Chat & Code**\n- Answer questions and explain concepts\n- Write, review, and debug code\n- Run code and show output in the code pane\n\n**Browser Automation**\n- Navigate, click, and type on web pages\n- Take screenshots and extract content\n- Fill forms and automate workflows\n\n**Slash Commands**\nType \`/\` to see all available commands, including:\n- \`/code\` — Open the code execution pane\n- \`/search\` — Search the web\n- \`/screenshot\` — Capture the current page\n- \`/slides\` — Generate a presentation\n\n**Prompt Snippets**\nType a trigger like \`/summarize\` or \`/explain\` to expand reusable prompts.\n\nTry asking me something!`, timestamp: Date.now() - 3599000 },
    ],
  },
  {
    name: 'Code Review Example',
    tags: ['code', 'examples'],
    history: [
      { role: 'user', content: 'Review this function:\n\n```javascript\nfunction fetchData(url) {\n  const xhr = new XMLHttpRequest();\n  xhr.open("GET", url, false);\n  xhr.send();\n  return JSON.parse(xhr.responseText);\n}\n```', timestamp: Date.now() - 7200000 },
      { role: 'assistant', content: `Here's my review:\n\n**Issues Found:**\n\n1. **Synchronous XHR** — \`xhr.open("GET", url, false)\` blocks the main thread. This freezes the UI during network requests.\n\n2. **No error handling** — If the request fails or returns invalid JSON, the function throws an unhandled exception.\n\n3. **Deprecated API** — \`XMLHttpRequest\` is legacy. Modern code should use \`fetch()\`.\n\n**Suggested Fix:**\n\n\`\`\`javascript\nasync function fetchData(url) {\n  try {\n    const response = await fetch(url);\n    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);\n    return await response.json();\n  } catch (error) {\n    console.error('Fetch failed:', error);\n    throw error;\n  }\n}\n\`\`\`\n\n**Improvements:**\n- Non-blocking async/await\n- Proper error handling with status check\n- Uses modern Fetch API`, timestamp: Date.now() - 7199000 },
    ],
  },
  {
    name: 'Research Assistant',
    tags: ['research', 'examples'],
    history: [
      { role: 'user', content: 'Explain the difference between REST and GraphQL', timestamp: Date.now() - 86400000 },
      { role: 'assistant', content: `**REST vs GraphQL — Key Differences**\n\n| Aspect | REST | GraphQL |\n|--------|------|---------|\n| Endpoints | Multiple URLs | Single endpoint |\n| Data fetching | Fixed structure | Client specifies fields |\n| Over-fetching | Common | Eliminated |\n| Under-fetching | Common (needs multiple calls) | Eliminated |\n| Caching | HTTP caching built-in | Requires custom caching |\n| Learning curve | Lower | Higher |\n| Tooling | Mature | Growing |\n\n**When to use REST:**\n- Simple CRUD APIs\n- Public APIs with stable contracts\n- When HTTP caching is important\n\n**When to use GraphQL:**\n- Complex data relationships\n- Mobile apps (bandwidth sensitive)\n- When frontend needs flexible queries\n\nWant me to dive deeper into either approach?`, timestamp: Date.now() - 86399000 },
    ],
  },
  {
    name: 'Debugging Help',
    tags: ['code', 'debug'],
    history: [
      { role: 'user', content: "I'm getting 'Cannot read property of undefined' error", timestamp: Date.now() - 172800000 },
      { role: 'assistant', content: `This error means you're trying to access a property on something that's \`undefined\`. Common causes:\n\n1. **Accessing nested properties** without null checks\n2. **Async data** not loaded yet\n3. **Typos** in property names\n\n**Quick Fix — Optional Chaining:**\n\`\`\`javascript\n// Instead of this (crashes if user is undefined):\nconst name = user.address.city\n\n// Use optional chaining:\nconst name = user?.address?.city\n\`\`\`\n\n**Debug Steps:**\n1. Add \`console.log()\` before the failing line\n2. Check which variable is \`undefined\`\n3. Add null checks or optional chaining\n\nCan you share the code that's throwing the error?`, timestamp: Date.now() - 172799000 },
    ],
  },
  {
    name: 'Web Automation Demo',
    tags: ['automation', 'examples'],
    history: [
      { role: 'user', content: 'Help me fill out a form on this page', timestamp: Date.now() - 259200000 },
      { role: 'assistant', content: `I can help with that! Here's what I can do:\n\n1. **Take a screenshot** to see the form\n2. **Identify form fields** automatically\n3. **Fill in values** you provide\n4. **Submit** when you're ready\n\nTo get started, try these commands:\n- \`/screenshot\` — Capture the current page\n- Tell me what values to fill in\n\nI'll ask for your approval before any destructive actions (like submitting forms or navigating away).\n\nWhat form are you trying to fill out?`, timestamp: Date.now() - 259199000 },
    ],
  },
]

/**
 * Seeds example conversations into storage on first install.
 * Only writes if no conversations exist yet.
 *
 * IMPORTANT: `conversations` in chrome.storage.local is an object keyed by
 * conversation name — {[name]: {history, timestamp, pinned, tags}} — per
 * utils/storage.js (saveConversation/getConversations/deleteConversation)
 * and the SAVE_CONVERSATIONS_BULK handler in background/service-worker.js.
 * The sidebar UI only ever sees the *array* shape produced by the
 * GET_CONVERSATIONS message handler, which derives it from this object at
 * the message boundary — it is not the storage format. An earlier version
 * of this function wrote an array directly, which both broke "already
 * seeded" detection (arrays don't have meaningful truthy .length checks
 * against this object-shaped default) and risked silently dropping any
 * conversation a user saved afterward, since assigning conversations[name]
 * = data onto an array sets a non-index property that JSON.stringify drops
 * on the next chrome.storage.local.set.
 */
async function seedExampleConversations() {
  try {
    const data = await chrome.storage.local.get('conversations')
    const existing = data.conversations || {}

    if (Object.keys(existing).length > 0) return false // Already has conversations

    const now = Date.now()
    const seeded = {}
    EXAMPLE_CONVERSATIONS.forEach((conv, i) => {
      seeded[conv.name] = {
        history: conv.history,
        timestamp: conv.history[conv.history.length - 1]?.timestamp || now,
        pinned: !!conv.pinned,
        tags: Array.isArray(conv.tags) ? conv.tags : [],
        createdAt: now - (EXAMPLE_CONVERSATIONS.length - i) * 3600000,
      }
    })

    await chrome.storage.local.set({ conversations: seeded })
    return true
  } catch (e) {
    console.warn('Failed to seed example conversations:', e)
    return false
  }
}

export { EXAMPLE_CONVERSATIONS, seedExampleConversations }

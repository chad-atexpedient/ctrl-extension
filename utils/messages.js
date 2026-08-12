/**
 * Shared message-type constants for the extension's runtime protocol.
 *
 * Every chrome.runtime.sendMessage() sender and every case in the
 * background's handleMessage() switch should reference these constants so
 * typos are caught at import time instead of silently producing
 * "Unknown message type" errors. Historically these literals were scattered
 * across senders while only the background kept a private copy — keep them
 * in sync from this single module.
 */
export const MESSAGE_TYPES = {
  // Chat
  SEND_CHAT: 'SEND_CHAT',
  SEND_STREAMING_CHAT: 'SEND_STREAMING_CHAT',
  GET_CONTEXT: 'GET_CONTEXT',
  GET_CHAT_HISTORY: 'GET_CHAT_HISTORY',
  CLEAR_HISTORY: 'CLEAR_HISTORY',
  IMPORT_CHAT_HISTORY: 'IMPORT_CHAT_HISTORY',
  NEW_CHAT: 'NEW_CHAT',

  // Generic LLM request routed through the background (agents, save-as-agent,
  // etc.) so every call gets spend tracking, audit logging and rate limiting.
  RUN_CHAT: 'RUN_CHAT',

  // Settings / state
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  GET_SETTINGS: 'GET_SETTINGS',
  GET_STATE: 'GET_STATE',
  SET_MODEL: 'SET_MODEL',
  SET_PROVIDER_CONFIG: 'SET_PROVIDER_CONFIG',
  STOP_GENERATION: 'STOP_GENERATION',

  // Conversations
  SAVE_CONVERSATION: 'SAVE_CONVERSATION',
  SAVE_CONVERSATIONS_BULK: 'SAVE_CONVERSATIONS_BULK',
  GET_CONVERSATIONS: 'GET_CONVERSATIONS',

  // Models
  GET_MODELS: 'GET_MODELS',
  CLEAR_MODEL_CACHE: 'CLEAR_MODEL_CACHE',

  // Tools / MCP
  EXECUTE_TOOL: 'EXECUTE_TOOL',
  TEST_MCP_CONNECTION: 'TEST_MCP_CONNECTION',
  TEST_PROVIDER_CONNECTION: 'TEST_PROVIDER_CONNECTION',

  // Browser agent (CDP)
  CDP_DETACH: 'CDP_DETACH',
  CDP_TOGGLE: 'CDP_TOGGLE',
  CDP_STATUS: 'CDP_STATUS',
  CDP_CONNECT_RELAY: 'CDP_CONNECT_RELAY',
  CDP_DISCONNECT_RELAY: 'CDP_DISCONNECT_RELAY',

  // Approval flow (background -> sidepanel push + response)
  BROWSER_ACTION_APPROVAL_REQUIRED: 'BROWSER_ACTION_APPROVAL_REQUIRED',
  BROWSER_ACTION_APPROVED: 'BROWSER_ACTION_APPROVED',
  BROWSER_ACTION_DENIED: 'BROWSER_ACTION_DENIED',

  // Streaming (background -> sidepanel push)
  STREAM_CHUNK: 'STREAM_CHUNK',
  STREAM_COMPLETE: 'STREAM_COMPLETE',
  STREAM_ERROR: 'STREAM_ERROR'
}

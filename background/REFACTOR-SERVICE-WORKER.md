# background/service-worker.js Refactoring Plan

## Current State
- **File:** `background/service-worker.js`
- **Lines:** 1657
- **Status:** Exceeds recommended limit of 500 lines by 1157 lines

## Problems Identified

1. **Mixed Concerns:** Single file handles:
   - Message routing
   - Tool execution (web search, image search)
   - Chat history management
   - Storage operations
   - API client integration
   - Content script communication
   - Notification handling
   - API key management

2. **Complex Event Handling:** Message routing logic is intertwined with business logic

3. **Hard to Test:** Service worker context makes testing difficult
4. **Hard to Navigate:** 1657 lines makes finding specific code challenging

## Target Architecture

```
background/
├── service-worker.js           # Main service worker (~300 lines)
├── handlers/
│   ├── message-handler.js     # Message routing (~200 lines)
│   ├── tool-handler.js       # Tool execution (~250 lines)
│   └── content-handler.js    # Content script comm (~100 lines)
├── services/
│   ├── chat-service.js       # Chat history mgmt (~150 lines)
│   ├── storage-service.js    # Storage operations (~150 lines)
│   ├── notification-service.js # Notifications (~100 lines)
│   └── api-service.js       # API integration (~100 lines)
└── tools/
    ├── web-search-tool.js   # Web search (~150 lines)
    ├── image-search-tool.js # Image search (~150 lines)
    └── tool-registry.js     # Tool management (~100 lines)
```

## Module Responsibilities

### message-handler.js (~200 lines)
- Route incoming messages
- Dispatch to appropriate handlers
- Validate message types
- Handle message errors
- Send responses

### tool-handler.js (~250 lines)
- Execute tool calls
- Web search
- Image search
- Handle tool results
- Format tool responses
- Tool error handling

### content-handler.js (~100 lines)
- Handle content script messages
- Page content extraction
- Text insertion
- Tab management

### chat-service.js (~150 lines)
- Save chat messages
- Load chat history
- Clear chat history
- Manage conversation state

### storage-service.js (~150 lines)
- Storage operations wrapper
- Encryption/decryption
- Cache management
- Error handling

### notification-service.js (~100 lines)
- Show notifications
- Manage notification queue
- Handle notification clicks
- Clear notifications

### api-service.js (~100 lines)
- API client initialization
- Request management
- Response handling
- Error handling

### web-search-tool.js (~150 lines)
- Perform web search
- Parse search results
- Format results
- Handle search errors

### image-search-tool.js (~150 lines)
- Perform image search
- Filter results
- Format images
- Handle search errors

### tool-registry.js (~100 lines)
- Register tools
- List available tools
- Validate tool requests
- Tool metadata management

## Refactoring Steps

### Phase 1: Extract Tools (4 hours)
1. Create `background/tools/` directory
2. Extract `web-search-tool.js`:
   - Move web search logic
   - Move search result parsing
   - Create tool interface
3. Extract `image-search-tool.js`:
   - Move image search logic
   - Move image filtering
   - Create tool interface
4. Extract `tool-registry.js`:
   - Move tool registration
   - Move tool listing
   - Move tool validation

### Phase 2: Extract Handlers (4 hours)
1. Create `background/handlers/` directory
2. Extract `message-handler.js`:
   - Move message routing
   - Move message validation
   - Keep only basic routing in main file
3. Extract `tool-handler.js`:
   - Move tool execution logic
   - Move tool result formatting
   - Integrate tools
4. Extract `content-handler.js`:
   - Move content script comm
   - Move page extraction
   - Move text insertion

### Phase 3: Extract Services (4 hours)
1. Create `background/services/` directory
2. Extract `chat-service.js`:
   - Move chat history ops
   - Move conversation mgmt
   - Move history clearing
3. Extract `storage-service.js`:
   - Move storage wrappers
   - Move encryption calls
   - Move cache operations
4. Extract `notification-service.js`:
   - Move notification logic
   - Move queue management
5. Extract `api-service.js`:
   - Move API client init
   - Move request mgmt
   - Move error handling

### Phase 4: Simplify Main File (2 hours)
1. Keep only service worker setup in `service-worker.js`:
   - Event listener setup
   - Module initialization
   - Event routing
   - Lifecycle management
2. Import and use modules
3. Remove moved code
4. Test all features still work

### Phase 5: Testing & Verification (2 hours)
1. Run integration tests
2. Test message routing
3. Test tool execution
4. Test chat history
5. Test content script comm
6. Verify no functionality lost

## Estimated Effort
- Phase 1: 4 hours
- Phase 2: 4 hours
- Phase 3: 4 hours
- Phase 4: 2 hours
- Phase 5: 2 hours
- **Total: 16 hours**

## Success Criteria
- ✅ Main service-worker.js ≤ 350 lines
- ✅ Each handler ≤ 300 lines
- ✅ Each service ≤ 200 lines
- ✅ Each tool ≤ 200 lines
- ✅ All modules have clear, single responsibility
- ✅ All features still functional
- ✅ Tests pass for all modules
- ✅ Documentation updated

## Risk Mitigation
- Keep old code commented out during migration
- Test each module independently
- Maintain feature parity throughout refactor
- Create comprehensive tests for new modules
- Rollback plan: Keep git checkpoints at each phase

---

**Status:** Plan complete. Ready to begin Phase 1.
**Next Step:** Create tools directory and extract web-search-tool.js

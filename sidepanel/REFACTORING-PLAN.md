# AgentHandler Refactoring Plan

## Current State
- **File:** `sidepanel/agent.js`
- **Size:** 1396 lines
- **Responsibilities:** Mixed concerns including:
  - Chat handling
  - Slide presentation generation
  - CSV data processing
  - Excel data processing
  - MVP code generation
  - Dashboard creation
  - Research report generation
  - PDF export
  - UI event binding
  - Model configuration

## Target Architecture

### 1. Module Breakdown

```
agent/
├── index.js                 # Main AgentHandler (orchestrator)
├── modules/
│   ├── chat-handler.js       # Chat mode logic
│   ├── slide-handler.js      # Slide presentation logic
│   ├── data-handler.js       # CSV/Excel data processing
│   ├── mvp-handler.js       # MVP code generation
│   ├── dashboard-handler.js  # Dashboard creation
│   └── research-handler.js   # Research report generation
├── services/
│   ├── data-parser.js        # CSV/Excel parsing utilities
│   ├── template-engine.js    # Code template generation
│   └── export-service.js     # PDF/PowerPoint export
└── utils/
    ├── validator.js          # Data validation
    └── formatter.js          # Output formatting
```

### 2. Module Responsibilities

#### chat-handler.js (~150 lines)
- Handle chat mode interactions
- Process chat messages
- Format chat responses
- No UI code

#### slide-handler.js (~200 lines)
- Parse JSON into slide objects
- Validate slide structure
- Render slides (pure functions, no DOM)
- Generate slide HTML

#### data-handler.js (~250 lines)
- Load CSV files
- Parse Excel files
- Validate data schema
- Clean and normalize data
- Extract insights

#### mvp-handler.js (~200 lines)
- Generate MVP code templates
- Handle file exports
- Validate generated code
- Format output

#### dashboard-handler.js (~150 lines)
- Generate dashboard JSON
- Create chart configurations
- Validate dashboard structure
- Export dashboard

#### research-handler.js (~150 lines)
- Generate research reports
- Format report structure
- Export to PDF
- Validate report content

### 3. Refactoring Strategy

#### Phase 1: Create Module Interface
```javascript
// Base handler class
class AgentModule {
  constructor(apiClient, eventBus) {
    this.apiClient = apiClient
    this.eventBus = eventBus
  }

  // To be implemented by subclasses
  async handle(input) {
    throw new Error('handle() must be implemented')
  }
}
```

#### Phase 2: Extract Slide Logic
- Move slide parsing to `slide-handler.js`
- Move slide rendering to `slide-handler.js`
- Move slide validation to `utils/validator.js`

#### Phase 3: Extract Data Processing
- Create `data-parser.js` service
- Extract CSV loading logic
- Extract Excel loading logic
- Move data validation

#### Phase 4: Extract Specialized Agents
- Create `mvp-handler.js`
- Create `dashboard-handler.js`
- Create `research-handler.js`

#### Phase 5: Simplify Main AgentHandler
- Keep only orchestration logic
- Delegate to specialized modules
- Handle UI event binding
- Route to correct handler based on mode

### 4. Event Flow

```
User Input → AgentHandler
               ↓
         [Route based on mode]
               ↓
    ┌──────────┼──────────┐
    ↓          ↓          ↓
ChatHandler  SlideHandler  DataHandler
    ↓          ↓          ↓
  Result    Result      Result
    └──────────┼──────────┘
               ↓
         Event Bus
               ↓
           ChatUI
```

### 5. Benefits

1. **Testability:** Each module can be tested independently
2. **Maintainability:** Easier to find and fix bugs
3. **Reusability:** Modules can be reused in other contexts
4. **Scalability:** New agents can be added without modifying core logic
5. **Collaboration:** Multiple developers can work on different modules

### 6. Migration Steps

**Step 1:** Create directory structure
**Step 2:** Extract `slide-handler.js` (highest complexity, good test case)
**Step 3:** Extract `data-parser.js` (pure functions, easy to test)
**Step 4:** Extract `mvp-handler.js`
**Step 5:** Extract remaining modules
**Step 6:** Update imports in main `agent.js`
**Step 7:** Test and verify all functionality
**Step 8:** Remove old code from main file

### 7. Estimated Effort

- **Phase 1:** 2 hours
- **Phase 2:** 4 hours (slide extraction)
- **Phase 3:** 3 hours (data parser)
- **Phase 4:** 6 hours (remaining modules)
- **Phase 5:** 4 hours (simplify main file)
- **Phase 6:** 3 hours (testing)
- **Total:** ~22 hours

### 8. Risk Mitigation

- Keep old code commented out during migration
- Test each module independently before integration
- Maintain feature parity throughout refactor
- Create comprehensive tests for new modules
- Rollback plan: Keep git checkpoints at each phase

---

**Status:** Planning complete. Ready to begin Phase 1.
**Next Step:** Extract `slide-handler.js` module

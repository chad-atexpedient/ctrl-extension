# sidepanel/agent.js Refactoring Plan

## Current State
- **File:** `sidepanel/agent.js`
- **Lines:** 1424
- **Status:** Exceeds recommended limit of 500 lines by 924 lines

## Problems Identified

1. **Mixed Concerns:** Single file handles:
   - Chat interactions
   - Slide generation and rendering
   - CSV/Excel data processing
   - MVP code generation
   - Dashboard creation
   - Research report generation
   - PDF exports
   - Image search
   - Web search
   - Tool execution

2. **Hard to Test:** Monolithic structure makes unit testing difficult

3. **Hard to Navigate:** 1424 lines makes finding specific code challenging

4. **High Cognitive Load:** Developers must understand entire file to modify one feature

## Target Architecture

```
sidepanel/
├── agent.js                    # Main orchestrator (~200 lines)
├── modules/
│   ├── chat-module.js         # Chat logic (~150 lines)
│   ├── slide-module.js        # Slide generation (~200 lines)
│   ├── data-module.js         # Data analysis (~200 lines)
│   ├── mvp-module.js          # MVP generation (~150 lines)
│   ├── dashboard-module.js     # Dashboard creation (~150 lines)
│   └── research-module.js     # Research reports (~150 lines)
├── services/
│   ├── slide-service.js       # Slide utilities (~100 lines)
│   ├── export-service.js      # Export functionality (~100 lines)
│   └── search-service.js     # Search capabilities (~100 lines)
└── utils/
    └── parser-utils.js        # JSON/data parsing (~100 lines)
```

## Module Responsibilities

### chat-module.js (~150 lines)
- Handle chat mode interactions
- Process chat messages
- Format chat responses
- Manage chat history state

### slide-module.js (~200 lines)
- Parse JSON into slide objects
- Validate slide structure
- Generate slide HTML
- Render slides
- Handle slide navigation

### data-module.js (~200 lines)
- Load CSV files
- Parse Excel files
- Analyze data
- Extract insights
- Generate data visualizations

### mvp-module.js (~150 lines)
- Generate MVP code templates
- Handle file exports
- Validate generated code
- Format output

### dashboard-module.js (~150 lines)
- Generate dashboard JSON
- Create chart configurations
- Validate dashboard structure
- Render dashboard UI

### research-module.js (~150 lines)
- Generate research reports
- Format report structure
- Export to PDF
- Validate report content

### slide-service.js (~100 lines)
- Slide template generation
- Slide validation helpers
- Slide formatting utilities

### export-service.js (~100 lines)
- PDF export
- PowerPoint export
- Markdown export
- Download handling

### search-service.js (~100 lines)
- Web search integration
- Image search integration
- Search result formatting

### parser-utils.js (~100 lines)
- JSON parsing with safety
- CSV parsing
- Data validation
- Schema inference

## Refactoring Steps

### Phase 1: Extract Services (4 hours)
1. Create `sidepanel/services/` directory
2. Extract `slide-service.js`:
   - Move slide rendering logic
   - Move slide validation
   - Create reusable slide templates
3. Extract `export-service.js`:
   - Move PDF export code
   - Move PowerPoint export code
   - Unify export logic
4. Extract `search-service.js`:
   - Move web search code
   - Move image search code
   - Create search result handler

### Phase 2: Extract Utils (2 hours)
1. Create `sidepanel/utils/` directory
2. Extract `parser-utils.js`:
   - Move parseJSONSafely
   - Move CSV parsing
   - Move data validation
   - Create unit tests for parsers

### Phase 3: Extract Modules (8 hours)
1. Create `sidepanel/modules/` directory
2. Extract `chat-module.js`:
   - Move chat-related methods
   - Keep only orchestration in main file
3. Extract `slide-module.js`:
   - Move slide generation logic
   - Move slide rendering
   - Integrate slide-service
4. Extract `data-module.js`:
   - Move CSV/Excel loading
   - Move data analysis
   - Integrate parser-utils
5. Extract `mvp-module.js`:
   - Move MVP generation
   - Move code templates
6. Extract `dashboard-module.js`:
   - Move dashboard creation
   - Move chart generation
7. Extract `research-module.js`:
   - Move report generation
   - Move PDF export
   - Integrate export-service

### Phase 4: Simplify Main File (2 hours)
1. Keep only orchestration logic in `agent.js`:
   - Module initialization
   - Mode switching
   - Event routing
   - Error handling
2. Import and use modules
3. Remove moved code
4. Test all features still work

### Phase 5: Testing & Verification (2 hours)
1. Run unit tests
2. Run integration tests
3. Test all agent modes
4. Verify no functionality lost
5. Update documentation

## Estimated Effort
- Phase 1: 4 hours
- Phase 2: 2 hours
- Phase 3: 8 hours
- Phase 4: 2 hours
- Phase 5: 2 hours
- **Total: 18 hours**

## Success Criteria
- ✅ Main agent.js ≤ 300 lines
- ✅ Each module ≤ 250 lines
- ✅ Each service ≤ 150 lines
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
**Next Step:** Create services directory and extract slide-service.js

# CTRL Extension - Architecture & Development Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Key Components](#key-components)
5. [Data Flow](#data-flow)
6. [Configuration](#configuration)
7. [Theming System](#theming-system)
8. [Development Setup](#development-setup)
9. [Testing](#testing)
10. [Deployment](#deployment)
11. [Contributing](#contributing)

---

## Overview

CTRL Extension is a browser extension that provides an in-window AI chat interface with support for 9 major AI providers, 24+ themes, comprehensive agent workspace, and enterprise-grade security features.

### Core Features

- **Multi-Provider Support**: OpenAI, Anthropic, Google, Z.ai, Meta, Mistral, DeepSeek, MiniMax, Alibaba
- **30+ AI Models**: Access to latest models from all providers
- **24+ Themes**: Light, dark, cinematic, feminine, minimalist, and special themes
- **Agent Workspace**: Multi-tab agent system (Slide Creator, Data Analyst, MVP Builder)
- **Context Awareness**: Include page content and selected text in conversations
- **Enterprise Security**: AES-GCM encryption, per-installation keys, audit logging
- **Performance Monitoring**: API call tracking, error tracking, performance metrics
- **Input Validation**: Comprehensive validation for all API inputs
- **UI Standardization**: Consistent component library across all interfaces

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                    │
├─────────────────────────────────────────────────────────────┤
│  Popup    │  Sidepanel  │  Options   │  Content Script  │
└─────┬──────┴─────┬───────┴─────┬───────┴─────┬───────┘
      │            │               │               │
      └────────────┼───────────────┴───────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   Service Worker     │
        │  (Background)       │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   Utilities Layer    │
        │  - API Client      │
        │  - Storage        │
        │  - Validation     │
        │  - Logging        │
        │  - Error Tracking  │
        │  - Performance    │
        │  - Audit Log      │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  AI Provider APIs   │
        └──────────────────────┘
```

### Component Responsibilities

**User Interface Layer:**
- **Popup**: Quick access interface with one-click actions
- **Sidepanel**: Main chat interface with mode toggle (Chat/Agent)
- **Options**: Settings management (API keys, models, themes, preferences)
- **Content Script**: Page context extraction, text selection

**Service Worker (Background):**
- API request routing and response handling
- Model fetching and caching
- Credential validation
- Message routing between components
- Storage operations

**Utilities Layer:**
- **API Client**: Standardized API communication
- **Storage**: Secure encrypted storage (AES-GCM)
- **Validation**: Input validation, model validation
- **Logging**: Unified logging system
- **Error Tracking**: Error classification and reporting
- **Performance Tracking**: API call metrics
- **Audit Logging**: Security event logging

---

## Project Structure

```
ai-chat-extension/
├── manifest.json              # Extension manifest (v3)
├── README.md                 # Basic user guide
├── ARCHITECTURE.md          # This file
├── plan.md                   # Remediation plan
├── issues.md                 # Issue tracking
│
├── background/               # Service worker
│   └── service-worker.js     # Background processing, API routing
│
├── sidepanel/               # Main chat interface
│   ├── sidepanel.html       # Chat UI
│   ├── sidepanel.css       # Chat styles
│   └── sidepanel.js        # Chat logic, agent workspace
│
├── popup/                  # Quick access popup
│   ├── popup.html          # Popup UI
│   ├── popup.css           # Popup styles
│   └── popup.js            # Popup logic
│
├── options/                # Settings page
│   ├── options.html        # Settings UI
│   ├── options.css         # Settings styles
│   └── options.js          # Settings logic
│
├── content/                # Content script
│   ├── content.js          # Page context extraction
│   └── content.css         # Content script styles
│
├── sandbox/                # Agent sandbox iframe
│   ├── sandbox.html       # Agent execution environment
│   └── sandbox.js        # Agent logic
│
├── utils/                  # Shared utilities
│   ├── index.js           # Central exports
│   ├── api-client.js      # API communication
│   ├── storage.js         # Secure storage, providers config
│   ├── errors.js          # Error definitions
│   ├── agent.js           # Agent system
│   ├── model-selection-manager.js  # Model selection logic
│   ├── input-validator.js  # Input validation
│   ├── model-validator.js  # Model validation
│   ├── logger.js          # Unified logging
│   ├── error-tracker.js   # Error tracking
│   ├── performance-tracker.js  # Performance monitoring
│   ├── audit-logger.js    # Audit logging
│   ├── error-message-manager.js  # Context-aware error messages
│   ├── loading-states.js   # Loading UI components
│   ├── rate-limiter.js    # Rate limiting
│   ├── html-sanitizer.js  # HTML sanitization
│   ├── api-key-validator.js  # API key validation
│   ├── chat-storage-manager.js  # Chat storage
│   ├── event-bus.js       # Event system
│   ├── data-parser.js      # Data parsing utilities
│   └── common-utils.js    # Common utilities
│
├── lib/                    # External libraries
│   └── highlight.js       # Code highlighting
│
├── styles/                 # Standardized styles
│   ├── variables.css      # CSS variables (24+ themes)
│   ├── components.css     # UI component library
│   └── README.md         # Styles documentation
│
└── docs/                   # Documentation
    ├── HIGH-015-resolution.md
    └── MEDIUM-004-resolution.md
```

---

## Key Components

### 1. Service Worker (background/service-worker.js)

The service worker acts as the central coordinator for all extension operations.

**Responsibilities:**
- Handle API requests to AI providers
- Manage model fetching and caching
- Validate credentials
- Route messages between components
- Execute tool calls (MCP, browsing, etc.)
- Manage state and storage operations

**Key Features:**
- Message routing based on type
- Model caching with LRU eviction
- Credential validation before API calls
- Tool execution sandboxing
- Rate limiting per provider

### 2. API Client (utils/api-client.js)

Standardized API client for all AI providers.

**Features:**
- Provider-specific request formatting
- Response parsing
- Error classification (APIError, NetworkError, AuthError, RateLimitError)
- Retry logic with exponential backoff
- Circuit breaker pattern for failed requests
- Input validation
- Request/response logging

**Supported Providers:**
- OpenAI (GPT models)
- Anthropic (Claude models)
- Google (Gemini models)
- Z.ai (GLM models)
- Meta (Llama models)
- Mistral
- DeepSeek
- MiniMax
- Alibaba (Qwen models)

### 3. Storage System (utils/storage.js)

Secure encrypted storage with provider configuration.

**Features:**
- AES-GCM encryption for API keys
- Per-installation key generation
- 30+ predefined models across 9 providers
- Default enabled models per provider
- LRU cache for performance

**Data Stored:**
- API keys (encrypted)
- Provider configurations
- Model selections (max 2 per provider)
- User preferences (theme, font size, etc.)
- Chat history
- Credentials

### 4. Input Validation (utils/input-validator.js)

Comprehensive validation for all API inputs.

**Validations:**
- Message content (length, format)
- Message roles (user, assistant, system)
- Configuration parameters (temperature, maxTokens)
- Model IDs
- API keys (format, length)
- Base URLs

**Sanitization:**
- Message content
- API keys
- Model IDs
- Base URLs

### 5. Model Validation (utils/model-validator.js)

Provider-specific model validation.

**Features:**
- Provider identification
- Model existence validation
- Selection count enforcement (max 2 models)
- Model ID sanitization
- Validation result caching

**Provider-Specific Rules:**
- Regex patterns per provider
- Model name formats
- Capability flags (vision, image gen)

### 6. Logging System (utils/logger.js)

Unified logging with proper log levels.

**Log Levels:**
- DEBUG: Detailed diagnostic information
- INFO: General informational messages
- WARN: Warning messages
- ERROR: Error messages

**Features:**
- Per-component loggers
- Global log level control
- Enable/disable logging
- Log export
- Performance tracking

### 7. Error Tracking (utils/error-tracker.js)

Error classification and reporting.

**Features:**
- Error deduplication
- Error classification by type
- Error statistics
- Error reporting
- Error export

**Error Types:**
- API errors
- Network errors
- Authentication errors
- Validation errors
- Configuration errors

### 8. Performance Tracking (utils/performance-tracker.js)

API call and performance metrics.

**Metrics Tracked:**
- API call duration
- Request/response sizes
- Error rates
- Provider performance
- Tool execution times
- Memory usage

### 9. Audit Logging (utils/audit-logger.js)

Security event logging for compliance.

**Events Logged:**
- Credential access/changes
- API key additions/removals
- Model configuration changes
- Security-sensitive operations
- Failed authentication attempts

**Features:**
- Tamper-evident logging
- Audit trail export
- Event filtering
- Compliance reporting

### 10. UI Standardization (styles/)

Comprehensive design system for consistent UI.

**Components:**
- Buttons (primary, secondary, ghost, outline, text, icon)
- Form inputs (text, select, textarea, checkbox, radio)
- Cards
- Modals (sm, md, lg, xl)
- Dropdowns
- Badges (primary, success, warning, error, secondary)
- Alerts and toasts
- Accordions

**Themes:**
- 24+ themes including light/dark variants
- CSS variable system
- Easy theme customization

---

## Data Flow

### Chat Request Flow

```
1. User sends message (sidepanel)
   ↓
2. Message validated (input-validator)
   ↓
3. Message sent to service worker
   ↓
4. Service worker fetches model and credentials (storage)
   ↓
5. Service worker formats request (api-client)
   ↓
6. Service worker sends to AI provider
   ↓
7. Provider returns response
   ↓
8. Response parsed and logged (api-client)
   ↓
9. Response sent to sidepanel
   ↓
10. Message rendered and displayed
```

### Model Selection Flow

```
1. User opens settings (options)
   ↓
2. User selects provider
   ↓
3. Options page requests models from service worker
   ↓
4. Service worker fetches from API (api-client)
   ↓
5. Models validated (model-validator)
   ↓
6. Models cached (lru-cache)
   ↓
7. Models returned to options page
   ↓
8. Options page renders model list
   ↓
9. User selects models (max 2)
   ↓
10. Selection saved to storage (model-selection-manager)
```

---

## Configuration

### Provider Configuration

Each provider is configured in `utils/storage.js`:

```javascript
{
  id: 'provider-id',
  name: 'Provider Name',
  baseURL: 'https://api.provider.com/v1',
  models: [
    { id: 'model-id', name: 'Model Name' }
  ],
  supportsVision: true,
  supportsImageGen: false,
  anthropicCompatible: false  // For special handling
}
```

### Storage Keys

```javascript
STORAGE_KEYS = {
  API_KEY: 'api_key',
  API_BASE_URL: 'api_base_url',
  MODEL: 'model',
  SETTINGS: 'settings',
  CHAT_HISTORY: 'chat_history',
  USER_PREFERENCES: 'user_preferences',
  PROVIDER_CONFIG: 'provider_config',
  PROVIDER_CREDENTIALS: 'provider_credentials'
}
```

### Settings

```javascript
DEFAULT_SETTINGS = {
  temperature: 0.7,
  maxTokens: 2000,
  includePageContent: false,
  contextLength: 4000,
  theme: 'system',
  fontSize: 'medium',
  streaming: true,
  autoScroll: true,
  soundNotifications: false,
  showTimestamps: true
}
```

---

## Theming System

### Theme Architecture

Themes use CSS variables defined in `styles/variables.css`:

```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --text-primary: #111827;
  --accent-primary: #0f172a;
  --border-color: #e5e7eb;
}
```

### Available Themes

**Standard Themes:**
- light (default), dark
- blue, purple, green, red-black

**Cinematic Themes:**
- nebula, cyberpunk, synthwave, noir, dune

**Feminine & Minimalist:**
- blossom, matcha, lavender, oat

**Cool & Dynamic:**
- rainforest, ocean, sunset, glacial, magma, tokyo

**Special Themes:**
- parchment, terminal

### Applying Themes

Themes are applied via `data-theme` attribute on `<html>`:

```javascript
document.documentElement.setAttribute('data-theme', 'nebula')
```

---

## Development Setup

### Prerequisites

- Node.js 18+ (for development tools)
- Chrome/Edge/Firefox (for testing)
- Git (for version control)

### Setup Steps

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd ai-chat-extension
   ```

2. **Install Dependencies** (if any)
   ```bash
   npm install
   ```

3. **Load Extension**
   - Open Chrome/Edge
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select extension directory

4. **Configure API Keys**
   - Click extension icon
   - Open settings
   - Add API keys for desired providers

### Development Workflow

1. **Make Changes**
   - Edit source files
   - Reload extension in browser

2. **Test Changes**
   - Open sidepanel/popup
   - Test functionality
   - Check console for errors

3. **Lint and Format**
   ```bash
   npm run lint
   npm run format
   ```

4. **Build for Production**
   ```bash
   npm run build
   ```

---

## Testing

### Test Categories

1. **Unit Tests**
   - Input validation
   - Model validation
   - Storage operations
   - Utility functions

2. **Integration Tests**
   - API client with providers
   - Service worker routing
   - Component communication

3. **E2E Tests**
   - Complete user flows
   - Multi-provider scenarios
   - Error handling

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "API Client"
```

---

## Deployment

### Building for Distribution

```bash
npm run build
```

This creates a production build in `dist/` directory.

### Packaging

1. Zip the `dist/` directory
2. Upload to Chrome Web Store / Firefox Add-ons

### Manifest Version

The extension uses Manifest V3, which is required by Chrome Web Store.

---

## Contributing

### Code Style

- Use semantic HTML
- Follow CSS variable naming convention
- Use standardized UI components
- Document public functions with JSDoc
- Validate all inputs

### Commit Messages

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- style: Code style changes (formatting, etc.)
- refactor: Code refactoring
- test: Test changes
- chore: Maintenance tasks

### Pull Request Process

1. Fork repository
2. Create feature branch
3. Make changes
4. Run tests
5. Submit PR with description

---

## Security Considerations

### API Key Storage

- API keys are encrypted using AES-GCM
- Keys are generated per-installation
- Keys never leave browser
- No external storage for credentials

### CSP Headers

Content Security Policy restricts:
- Script sources
- Style sources
- Connect destinations
- Image sources

### Input Sanitization

- All user inputs are validated
- HTML is sanitized before rendering
- API inputs are sanitized before sending

---

## Performance Optimizations

### Caching

- LRU cache for API responses
- Model list caching
- Validation result caching

### Lazy Loading

- Components loaded on demand
- Large files split into chunks

### Code Splitting

- Service worker and UI separated
- Utilities lazy-loaded where possible

---

## Troubleshooting

### Common Issues

1. **Extension not loading**
   - Check manifest.json syntax
   - Verify Developer mode is enabled
   - Check console for errors

2. **API calls failing**
   - Verify API key is correct
   - Check network connectivity
   - Verify base URL is correct

3. **Models not loading**
   - Check provider credentials
   - Verify provider supports models
   - Check cache settings

---

## Resources

### Documentation

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

### Provider APIs

- [OpenAI API](https://platform.openai.com/docs/)
- [Anthropic API](https://docs.anthropic.com/)
- [Google AI](https://ai.google.dev/docs)
- [Z.ai API](https://api.z.ai/docs)

---

## License

MIT License - See LICENSE file for details

---

## Support

For issues, questions, or contributions:
- GitHub Issues: [repository-url]/issues
- Documentation: See ARCHITECTURE.md and docs/ directory

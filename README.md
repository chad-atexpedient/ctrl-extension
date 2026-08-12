# AI Chat Extension

A browser extension that provides an in-window AI chat interface using OpenAI-compatible APIs.

## Features

- **Side Panel Chat**: Chat with AI directly from your browser's side panel
- **Context Awareness**: Include current page content or selected text in your conversations
- **OpenAI Compatible**: Works with OpenAI API, Azure OpenAI, and other compatible providers
- **Secure Storage**: API keys are encrypted and stored locally in your browser
- **Quick Actions**: Summarize pages, explain code, or get context with one click
- **Keyboard Shortcuts**: Use `Alt+Shift+A` to open the chat
- **Settings Management**: Export and import your settings

## Installation

### From Source (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the extension directory

## Configuration

1. Click the extension icon or press `Alt+Shift+A`
2. Click the settings icon (⚙️) or "Set Up API Key" banner
3. Enter your API details:
   - **API Base URL**: For OpenAI use `https://api.openai.com/v1`
   - **API Key**: Your OpenAI API key
   - **Model**: Select your preferred model
4. Click "Test Connection" to verify
5. Click "Save Settings"

## Usage

### Opening the Chat

- Click the extension icon in the toolbar
- Use keyboard shortcut: `Alt+Shift+A`
- Right-click any page → "Open AI Chat"

### Including Page Context

1. Select text on the page to include it as context
2. Toggle "Include page content" checkbox to include full page content
3. Send your message - the AI will have context about the current page

### Quick Actions

From the popup:
- **Summarize**: Summarizes the current page content
- **Explain**: Explains selected text or code
- **Get Context**: Opens chat with context about the current page

## Supported Models

The extension works with any OpenAI-compatible API including:
- OpenAI GPT models (GPT-3.5, GPT-4, o1)
- Anthropic Claude models (via compatible endpoints)
- Azure OpenAI
- Self-hosted models (Ollama, LM Studio, etc.)

## Security

- API keys are encrypted using AES-GCM before storage
- Keys never leave your browser
- No data is sent to external servers except the AI API
- All API calls are made from the extension's background service worker

## Files Structure

```
ai-chat-extension/
├── manifest.json           # Extension manifest
├── background/
│   └── service-worker.js  # Background service worker
├── sidepanel/
│   ├── sidepanel.html    # Main chat interface
│   ├── sidepanel.css     # Chat styles
│   └── sidepanel.js      # Chat logic
├── content/
│   ├── content.js        # Page context extraction
│   └── content.css       # Content script styles
├── popup/
│   ├── popup.html        # Quick access popup
│   ├── popup.css         # Popup styles
│   └── popup.js          # Popup logic
├── options/
│   ├── options.html      # Settings page
│   ├── options.css       # Settings styles
│   └── options.js        # Settings logic
└── utils/
    ├── api-client.js     # API communication
    ├── storage.js        # Secure storage
    └── errors.js         # Error handling
```

## Development

```bash
npm install         # install Playwright dev deps
npm run lint        # static checks (version sync, console.log audit, XSS patterns)
npm test            # 222 unit tests
npm run test:ui     # Playwright E2E (requires `npx playwright install chromium`)
npm run package     # → dist/ctrl-extension-v{ver}.zip for Chrome Web Store
npm run verify      # lint + unit tests in one shot
```

CI runs all of the above on push/PR via `.github/workflows/ci.yml`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture notes and PR checklist.
See [CHANGELOG.md](CHANGELOG.md) for release history.
See [DISTRIBUTION.md](DISTRIBUTION.md) for Chrome, Edge, Firefox, Safari, and
GitHub release packaging details.

## License

MIT License

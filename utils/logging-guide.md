# Unified Logging Guide

This guide explains how to use the unified logging system in CTRL Extension.

## Overview

The unified logging system provides:
- **Proper log levels** - debug, info, warn, error
- **Consistent formatting** - Standardized timestamps and tags
- **Tag/category support** - Organize logs by component
- **Configurable levels** - Control verbosity globally or per-logger
- **Performance measurement** - Time function execution easily
- **Error tracking integration** - Automatic error tracking when enabled
- **Performance-friendly** - Disable in production if needed

## Quick Start

### Using Default Loggers

```javascript
import { log } from '../utils/index.js';

// Use pre-configured loggers
log.app.info('Application started');
log.api.debug('Making request to', { url: '/chat/completions' });
log.storage.warn('Storage quota approaching limit', { used: '80%' });
log.agent.error('Failed to process message', error, { messageId: '123' });
```

### Creating Custom Loggers

```javascript
import { getLogger, LogLevel } from '../utils/index.js';

// Create a logger for your component
const logger = getLogger('MyComponent');

// Log at different levels
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error(error, 'Error occurred');
logger.success('Operation completed');
```

### Creating Child Loggers

```javascript
import { getLogger } from '../utils/index.js';

// Create parent logger
const parentLogger = getLogger('Component');

// Create child logger for sub-component
const childLogger = parentLogger.child('SubComponent');

// Child logs will show as: [Component:SubComponent]
childLogger.info('Child component action');
```

## Log Levels

| Level | Value | Description | Use When |
|--------|--------|-------------|-----------|
| DEBUG | 0 | Detailed diagnostic information | Developing, troubleshooting |
| INFO | 1 | General informational messages | Normal operation |
| WARN | 2 | Warning messages for potential issues | Unexpected but recoverable situations |
| ERROR | 3 | Error messages | Failures and exceptions |
| SILENT | 4 | Disable all logging | Production, performance-critical paths |

### Setting Log Levels

```javascript
import { getLogger, LogLevel } from '../utils/index.js';

// Set level when creating logger
const logger = getLogger('Component', {
  minLevel: LogLevel.DEBUG  // Show all logs
});

// Or change level later
logger.setLevel(LogLevel.WARN);  // Only warn and error
logger.setLevel(LogLevel.SILENT);  // Disable logging
```

### Global Level Control

```javascript
import { setGlobalLogLevel, LogLevel } from '../utils/index.js';

// Set level for all loggers at once
setGlobalLogLevel(LogLevel.WARN);  // Only show warn and error globally
```

### Enable/Disable Logging

```javascript
import { getLogger, setGlobalLoggingEnabled } from '../utils/index.js';

// Disable specific logger
const logger = getLogger('Component');
logger.setEnabled(false);

// Disable all logging
setGlobalLoggingEnabled(false);
```

## API Reference

### Logger Methods

#### debug(message, data)

Log debug-level message.

```javascript
logger.debug('Debug message', { data: 'value' });
// Output: 2025-03-02 19:00:00 [Component] [DEBUG] Debug message {"data":"value"}
```

#### info(message, data)

Log info-level message.

```javascript
logger.info('User action completed', { action: 'click' });
// Output: 2025-03-02 19:00:00 [Component] [INFO] User action completed {"action":"click"}
```

#### warn(message, data)

Log warning-level message.

```javascript
logger.warn('High memory usage', { usage: '90%' });
// Output: 2025-03-02 19:00:00 [Component] [WARN] High memory usage {"usage":"90%"}
```

#### error(error, message, data)

Log error-level message (automatically tracked by error tracking system).

```javascript
try {
  // some code
} catch (error) {
  logger.error(error, 'Operation failed', { context: 'additional-data' });
}
// Output: 2025-03-02 19:00:00 [Component] [ERROR] Operation failed {"error":"...","stack":"...","context":"additional-data"}
// Also tracks error in error tracker
```

#### success(message, data)

Log success message (alias for info).

```javascript
logger.success('Model saved successfully', { modelId: 'gpt-4' });
// Output: 2025-03-02 19:00:00 [Component] [INFO] Model saved successfully {"modelId":"gpt-4"}
```

### Performance Measurement

#### time(label, fn)

Measure synchronous function execution time.

```javascript
const logger = getLogger('API');

const result = logger.time('fetch-models', () => {
  return fetch('/api/models').then(r => r.json());
});
// Output:
// 2025-03-02 19:00:00 [API] [DEBUG] fetch-models - START
// 2025-03-02 19:00:01 [API] [DEBUG] fetch-models - END (234.56ms) {"duration":234.56}
```

#### timeAsync(label, fn)

Measure async function execution time.

```javascript
const logger = getLogger('API');

const result = await logger.timeAsync('fetch-models', async () => {
  return await fetch('/api/models').then(r => r.json());
});
// Output:
// 2025-03-02 19:00:00 [API] [DEBUG] fetch-models - START
// 2025-03-02 19:00:01 [API] [DEBUG] fetch-models - END (234.56ms) {"duration":234.56}
```

### Configuration Methods

#### child(childTag)

Create a child logger with additional tag.

```javascript
const parent = getLogger('Component');
const child = parent.child('SubComponent');

child.info('Child action');
// Output: ... [Component:SubComponent] [INFO] Child action
```

#### setLevel(level)

Set minimum log level for this logger.

```javascript
import { LogLevel } from '../utils/index.js';

logger.setLevel(LogLevel.DEBUG);  // Show all
logger.setLevel(LogLevel.ERROR);  // Only errors
```

#### setEnabled(enabled)

Enable or disable this logger.

```javascript
logger.setEnabled(false);  // Disable
logger.setEnabled(true);   // Enable
```

## Migration Guide

### Old Pattern 1: console.log()

**Before:**
```javascript
console.log('handleModelSelection - checkbox changed:', checkbox.value, 'vendor:', vendor);
```

**After:**
```javascript
import { getLogger } from '../utils/index.js';

const logger = getLogger('ModelSelector');
logger.debug('checkbox changed', { value: checkbox.value, vendor });
// Output: [ModelSelector] [DEBUG] checkbox changed {"value":"...","vendor":"..."}
```

### Old Pattern 2: console.error()

**Before:**
```javascript
console.error('handleModelSelection - Error:', error);
```

**After:**
```javascript
import { getLogger } from '../utils/index.js';

const logger = getLogger('ModelSelector');
logger.error(error, 'Failed to handle model selection');
// Output: [ModelSelector] [ERROR] Failed to handle model selection {"error":"...","stack":"..."}
```

### Old Pattern 3: Mixed console calls

**Before:**
```javascript
console.log('[PerformanceTracker] API call:', metric);
console.debug('[AuditLogger]', entry);
console.warn('Approaching size limit, pruning more aggressively');
```

**After:**
```javascript
import { log } from '../utils/index.js';

log.performance.debug('API call', metric);
log.audit.debug(entry);
log.storage.warn('Approaching size limit, pruning more aggressively');
```

### Old Pattern 4: Try-catch with console.error

**Before:**
```javascript
try {
  await operation();
} catch (error) {
  console.error('Operation failed:', error);
}
```

**After:**
```javascript
import { getLogger } from '../utils/index.js';

const logger = getLogger('Operations');

try {
  await operation();
} catch (error) {
  logger.error(error, 'Operation failed');
}
```

## Best Practices

### 1. Use Appropriate Log Levels

Choose the right level for each log:
```javascript
// DEBUG: Detailed diagnostic info
logger.debug('Processing message', { messageId, contentLength });

// INFO: Normal operation
logger.info('Message sent successfully', { messageId, recipient });

// WARN: Unexpected but recoverable
logger.warn('API rate limit approaching', { requestsRemaining: 10 });

// ERROR: Failures and exceptions
logger.error(error, 'Failed to send message', { messageId });
```

### 2. Use Structured Data

Always pass data as an object for better filtering:
```javascript
// Good
logger.info('User logged in', {
  userId: '123',
  provider: 'openai',
  loginMethod: 'api-key'
});

// Less useful
logger.info(`User logged in: userId=123, provider=openai, method=api-key`);
```

### 3. Create Per-Component Loggers

Create a logger for each major component:
```javascript
import { getLogger } from '../utils/index.js';

// Create once at top of file
const logger = getLogger('OptionsPage');

// Use throughout file
logger.info('Initializing options page');
logger.debug('Loading settings from storage', { keys: ['theme', 'model'] });
```

### 4. Use Time Measurement

Track performance of operations:
```javascript
const logger = getLogger('API');

// For sync operations
const result = logger.time('fetch-models', () => {
  return fetchModels();
});

// For async operations
const result = await logger.timeAsync('save-chat-history', async () => {
  return await saveToStorage(chatHistory);
});
```

### 5. Production Configuration

Configure logging for production:
```javascript
import { getLogger, LogLevel } from '../utils/index.js';

const logger = getLogger('Production', {
  minLevel: LogLevel.WARN,  // Only warnings and errors
  useErrorTracking: true  // Track errors
});
```

### 6. Development Configuration

Configure logging for development:
```javascript
import { getLogger, LogLevel } from '../utils/index.js';

const logger = getLogger('Development', {
  minLevel: LogLevel.DEBUG,  // Show all logs
  useErrorTracking: true
});
```

## Default Loggers

Pre-configured loggers for common components:

```javascript
import { log } from '../utils/index.js';

// Application-wide logs
log.app.info('App initialized');

// API-related logs
log.api.debug('Making request', { url, method });

// Storage logs
log.storage.info('Saving to storage', { key, value });

// UI logs
log.ui.warn('Element not found', { selector });

// Agent logs
log.agent.debug('Processing message', { messageId });

// Service worker logs
log.serviceWorker.info('Message received', { type });

// Options page logs
log.options.info('Settings changed', { key, value });

// Background script logs
log.background.info('Extension installed');

// Content script logs
log.content.info('Content script loaded');

// Test logs
log.test.info('Test started', { testName });

// Model management logs
log.model.info('Model selected', { modelId });

// Provider logs
log.provider.debug('Provider initialized', { providerId });
```

## Filtering and Debugging

### Filter by Component

```javascript
import { getRegisteredLoggers } from '../utils/index.js';

// Get all registered loggers
const loggers = getRegisteredLoggers();
console.log('Active loggers:', loggers);

// Set specific component to DEBUG
getLogger('API').setLevel(LogLevel.DEBUG);

// Set all others to WARN
setGlobalLogLevel(LogLevel.WARN);
```

### Disable Specific Loggers

```javascript
import { getLogger } from '../utils/index.js';

// Disable verbose logger
getLogger('API').setEnabled(false);

// Keep other loggers enabled
```

### Enable/Disable in Production

```javascript
// In production code
if (process.env.NODE_ENV === 'production') {
  setGlobalLogLevel(LogLevel.WARN);
}

// In development code
if (process.env.NODE_ENV === 'development') {
  setGlobalLogLevel(LogLevel.DEBUG);
}
```

## Performance Considerations

### Production Performance

In production, minimize logging overhead:

1. **Set appropriate log level**
   ```javascript
   setGlobalLogLevel(LogLevel.WARN);  // Only warnings and errors
   ```

2. **Disable verbose loggers**
   ```javascript
   getLogger('API').setEnabled(false);  // Disable for performance-critical paths
   ```

3. **Use SILENT when needed**
   ```javascript
   logger.setLevel(LogLevel.SILENT);  // Completely disable
   ```

### Memory Usage

- Logger instances are cached (singletons per tag)
- Minimal memory overhead per logger
- Data objects are stringified on output
- Old logs are not stored (only output to console)

### Best Practices for Performance

- Don't log large objects in hot paths
- Use DEBUG level sparingly in production
- Keep log messages concise
- Use structured data instead of string concatenation
- Don't log in performance-critical loops

## Troubleshooting

### Logs Not Appearing

If logs aren't showing:

1. **Check logger is enabled:**
   ```javascript
   const logger = getLogger('MyComponent');
   console.log('Logger enabled:', logger.enabled);
   ```

2. **Check log level:**
   ```javascript
   console.log('Logger min level:', logger.minLevel);
   // Try: logger.setLevel(LogLevel.DEBUG);
   ```

3. **Check global settings:**
   ```javascript
   console.log('Global enabled:', getRegisteredLoggers());
   ```

### Too Many Logs

Reduce logging verbosity:

```javascript
// Set higher minimum level
setGlobalLogLevel(LogLevel.WARN);

// Or disable specific loggers
getLogger('VerboseComponent').setEnabled(false);
```

### Missing Logs After Refactor

Ensure you're importing the logger:

```javascript
import { getLogger } from '../utils/index.js';

const logger = getLogger('MyComponent');  // Create logger

logger.info('Component action');  // Use it
```

## Integration with Other Systems

### Error Tracking Integration

When logging errors, they're automatically tracked by the error tracking system:

```javascript
const logger = getLogger('MyComponent', {
  useErrorTracking: true  // Default is true
});

logger.error(error, 'Something failed');
// Automatically logged in error tracker
```

### Audit Logging

For security-relevant logs, use the audit logger instead:

```javascript
import { logAuditEvent } from '../utils/index.js';

// Security events use audit logging
logAuditEvent('API_KEY_SET', { provider: 'openai' });

// Regular logs use unified logging
log.api.info('API key saved');
```

## Log Format

### Default Format

```
[timestamp] [tag] [level] message {data}
```

### Example Outputs

```
2025-03-02 19:00:00.000 [ModelSelector] [DEBUG] checkbox changed {"value":"gpt-4","vendor":"openai"}
2025-03-02 19:00:00.001 [ModelSelector] [INFO] Selection saved {"vendor":"openai","models":["gpt-4"]}
2025-03-02 19:00:00.002 [API] [ERROR] Request failed {"error":"Network Error","code":0}
2025-03-02 19:00:00.003 [App] [WARN] Storage quota at 85%
```

## Migration Checklist

To migrate existing code to unified logging:

- [ ] Replace `console.log()` with appropriate logger call
- [ ] Replace `console.error()` with `logger.error()`
- [ ] Replace `console.warn()` with `logger.warn()`
- [ ] Replace `console.debug()` with `logger.debug()`
- [ ] Add logger creation at top of each file
- [ ] Use appropriate log levels (DEBUG, INFO, WARN, ERROR)
- [ ] Pass structured data instead of concatenated strings
- [ ] Remove manual timestamp formatting (handled by logger)
- [ ] Add timing for critical operations
- [ ] Test logs appear correctly
- [ ] Verify error tracking integration

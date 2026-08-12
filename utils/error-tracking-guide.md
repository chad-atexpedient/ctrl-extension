# Error Tracking Guide

This guide explains how to use the error tracking system in CTRL Extension.

## Overview

The error tracking system provides:
- **Structured error capture** with rich context
- **Error deduplication** to identify recurring issues
- **Pattern detection** for repeated errors
- **Error history** with session tracking
- **Export capabilities** for bug reports
- **Extensible design** for future external service integration (Sentry, LogRocket, etc.)

## Quick Start

### Automatic Error Tracking

The error tracker automatically starts tracking when imported. It captures:
- Uncaught errors (`window.onerror`)
- Unhandled promise rejections (`window.onunhandledrejection`)
- Errors tracked through `handleError()` utility

### Manual Error Tracking

```javascript
import { trackError } from '../utils/index.js';

// Track an error with context
trackError(new Error('Something went wrong'), {
  source: 'component-name',
  action: 'user-action',
  details: { userId: '123', itemId: '456' }
});
```

### Using the Global Tracker

```javascript
import { getErrorTracker } from '../utils/index.js';

const tracker = getErrorTracker();

// Track an error
tracker.track(error, context);

// Get all errors
const errors = tracker.getErrors();

// Get error statistics
const stats = tracker.getStats();

// Get error patterns (repeated errors)
const patterns = tracker.getPatterns();

// Clear all errors
tracker.clear();
```

## API Reference

### trackError(error, context)

Track an error with additional context.

**Parameters:**
- `error` (Error|Object): The error to track
- `context` (Object): Additional context about the error
  - `source` (string): Where the error occurred (e.g., 'api-client', 'storage')
  - `action` (string): What action was being performed
  - `level` (string): Error level: 'error', 'warning', 'info' (default: 'error')
  - `details` (Object): Any additional details

**Returns:** string - Error ID

**Example:**
```javascript
trackError(error, {
  source: 'api-client',
  action: 'fetch-models',
  level: 'error',
  details: { providerId: 'openai', apiKey: 'sk-***' }
});
```

### ErrorTracker Instance Methods

#### track(error, context)

Track an error with full context.

#### trackError(level, error, context)

Track an error with specific level.

#### trackWarning(error, context)

Track a warning-level error.

#### trackInfo(error, context)

Track an info-level error.

#### getErrors(filters)

Get all errors with optional filters.

**Filters:**
- `level` (string): Filter by error level
- `since` (number): Filter errors since timestamp
- `limit` (number): Limit number of results

**Example:**
```javascript
// Get all errors
const allErrors = tracker.getErrors();

// Get only errors from last hour
const recentErrors = tracker.getErrors({
  since: Date.now() - 3600000
});

// Get last 10 errors
const last10 = tracker.getErrors({ limit: 10 });
```

#### getStats()

Get error statistics.

**Returns:** Object with:
- `total` (number): Total errors
- `byLevel` (Object): Count by error level
- `byType` (Object): Count by error type
- `bySource` (Object): Count by error source
- `uniqueErrors` (number): Number of unique errors
- `sessionDuration` (number): Session duration in ms
- `sessionId` (string): Current session ID

#### getPatterns()

Get error patterns (repeated errors).

**Returns:** Array of error patterns sorted by frequency.

**Pattern Object:**
```javascript
{
  signature: 'Error:source:message',
  type: 'TypeError',
  count: 15,
  firstSeen: 1234567890,
  lastSeen: 1234567899,
  lastError: { /* full error record */ }
}
```

#### clear()

Clear all errors and reset tracking.

#### exportToJson(options)

Export errors as JSON.

**Options:**
- `includeAll` (boolean): Include all errors, not just 'error' level (default: false)

**Returns:** JSON string with:
- Version info
- Export timestamp
- Session info
- Statistics
- Patterns
- Errors array

#### generateSummary()

Generate a human-readable summary report.

**Returns:** String with summary of:
- Session info
- Total and unique error counts
- Errors by severity
- Top error patterns

## Integration with Existing Code

### Updating handleError()

The `handleError()` function in `common-utils.js` already integrates with the error tracker:

```javascript
import { handleError } from '../utils/common-utils.js';

// Error is automatically tracked
try {
  // some code
} catch (error) {
  handleError(error, 'my-component');
}
```

### Updating safeExecute()

The `safeExecute()` function also uses `handleError()`, so it automatically tracks errors:

```javascript
import { safeExecute } from '../utils/common-utils.js';

const result = await safeExecute(async () => {
  // some code
}, 'my-operation');
// Any error is automatically tracked
```

## Best Practices

### 1. Always Provide Context

Always include context when tracking errors:

```javascript
// Good
trackError(error, {
  source: 'api-client',
  action: 'fetch-models',
  details: { providerId, apiKeyLength }
});

// Less useful
trackError(error);
```

### 2. Use Appropriate Error Levels

Choose the right level for each error:

```javascript
// Error: Something failed, functionality broken
trackError(error, { source: 'api', level: 'error' });

// Warning: Something unusual but functionality continues
trackError(error, { source: 'api', level: 'warning' });

// Info: Normal operation that might be useful to track
trackError(error, { source: 'api', level: 'info' });
```

### 3. Include Relevant Details

Add details that help with debugging:

```javascript
trackError(error, {
  source: 'storage',
  action: 'save-chat-history',
  details: {
    messageCount,
    totalSize,
    quotaRemaining,
    userId
  }
});
```

### 4. Review Error Patterns Regularly

Check error patterns to identify recurring issues:

```javascript
import { getErrorTracker } from '../utils/index.js';

const tracker = getErrorTracker();
const patterns = tracker.getPatterns();

// Find most frequent errors
patterns.slice(0, 5).forEach(pattern => {
  console.log(`Error "${pattern.signature}" occurred ${pattern.count} times`);
});
```

### 5. Export Error Reports for Bug Reports

When users report issues, export error reports:

```javascript
import { exportErrorReport, generateErrorSummary } from '../utils/index.js';

// Get detailed JSON
const jsonReport = exportErrorReport({ includeAll: true });

// Get human-readable summary
const summary = generateErrorSummary();

// You can send these to your backend or display to users
console.log(summary);
```

## Future Extensions

### Integration with External Services

The error tracker is designed to be extensible. To add external service integration:

1. **Sentry Integration:**
```javascript
import * as Sentry from '@sentry/browser';

Sentry.init({
  dsn: 'your-dsn'
});

// Update ErrorTracker to send to Sentry
class ErrorTracker {
  track(error, context) {
    // ... existing code ...

    // Send to Sentry
    Sentry.captureException(error, {
      tags: context,
      extra: { ...context }
    });
  }
}
```

2. **LogRocket Integration:**
```javascript
import LogRocket from 'logrocket';

LogRocket.init('your-app-id');

// Update ErrorTracker
class ErrorTracker {
  track(error, context) {
    // ... existing code ...

    // Send to LogRocket
    LogRocket.captureException(error, {
      tags: context
    });
  }
}
```

### Custom Error Handlers

You can extend ErrorTracker for custom error handling:

```javascript
class CustomErrorTracker extends ErrorTracker {
  track(error, context) {
    // Add custom logic
    if (error.code === 'AUTH_ERROR') {
      this._handleAuthError(error);
    }

    // Call parent
    super.track(error, context);
  }

  _handleAuthError(error) {
    // Custom handling for auth errors
    console.warn('Auth error detected, redirecting to login...');
  }
}
```

## Configuration

### Environment-Specific Settings

```javascript
import { getErrorTracker } from '../utils/index.js';

const tracker = getErrorTracker({
  enabled: process.env.NODE_ENV === 'production',
  maxErrors: 500,
  environment: process.env.NODE_ENV,
  userId: getUserIdentifier()
});
```

### Error Tracking Toggle

You can disable error tracking if needed:

```javascript
const tracker = getErrorTracker({ enabled: false });
```

## Monitoring and Debugging

### Check Error Stats in Console

```javascript
import { getErrorTracker } from '../utils/index.js';

const stats = getErrorTracker().getStats();
console.table(stats.byLevel);
console.table(stats.byType);
console.table(stats.bySource);
```

### Generate Periodic Reports

```javascript
// Generate hourly report
setInterval(() => {
  const summary = generateErrorSummary();
  console.log('Hourly Error Summary:', summary);
}, 3600000);
```

## Performance Considerations

- Error tracker maintains up to 100 errors by default (configurable)
- Deduplication reduces memory usage for repeated errors
- Pattern detection is O(n) on tracking, O(1) for retrieval
- No performance impact on normal operation

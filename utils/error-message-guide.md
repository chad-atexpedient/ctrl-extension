# Error Message Management Guide

This guide explains how to use the error message system in CTRL Extension.

## Overview

The error message system provides:
- **Context-aware error messages** - Appropriate messages for each error type
- **Error classification** - Network, auth, validation, API, storage, etc.
- **Actionable suggestions** - What users can do to fix the error
- **Recovery workflows** - Retry, wait, go to settings, etc.
- **User-friendly templates** - Clear, helpful messages
- **Message caching** - Efficient message generation

## Quick Start

### Basic Error Handling

```javascript
import { getErrorMessage } from '../utils/index.js';

try {
  await someOperation();
} catch (error) {
  const errorInfo = getErrorMessage(error, {
    operation: 'save-models',
    provider: 'openai'
  });

  // Display error
  showError(errorInfo.title);
  showMessage(errorInfo.message);

  // Show suggestions
  if (errorInfo.suggestions && errorInfo.suggestions.length > 0) {
    showSuggestions(errorInfo.suggestions);
  }

  // Provide recovery action
  if (errorInfo.recovery) {
    showRecoveryButton(errorInfo.recovery);
  }
}
```

### API Error Handling

```javascript
import { getAPIErrorMessage } from '../utils/index.js';

const response = await apiRequest();

if (!response.ok) {
  const errorInfo = getAPIErrorMessage(
    response.status,
    response.statusText,
    { operation: 'fetch-models' }
  );

  showError(errorInfo.title);
  showMessage(errorInfo.message);
  showSuggestions(errorInfo.suggestions);
}
```

## Error Types

### Network Errors

| Code | Title | Message | Severity |
|------|-------|---------|----------|
| `connectionFailed` | Connection Failed | Could not connect to the server. | ERROR |
| `timeout` | Request Timeout | The request took too long to complete. | WARNING |
| `cors` | Access Blocked | Browser security settings are blocking the request. | ERROR |

**Example:**
```javascript
const errorInfo = getErrorMessage(new Error('Connection failed'), {
  operation: 'fetch-models'
});
// errorInfo.title = "Connection Failed"
// errorInfo.message = "Could not connect to the server."
// errorInfo.recovery = "retry"
```

### Authentication Errors

| Code | Title | Message | Severity |
|------|-------|---------|----------|
| `invalidCredentials` | Invalid API Key | The API key you provided is invalid or has expired. | ERROR |
| `missingCredentials` | API Key Required | Please add your API key to continue. | ERROR |

**Example:**
```javascript
const errorInfo = getErrorMessage(new Error('Invalid API key'));
// errorInfo.title = "Invalid API Key"
// errorInfo.message = "The API key you provided is invalid or has expired."
// errorInfo.recovery = "settings"
// errorInfo.suggestions = [
//   "Verify your API key is correct",
//   "Check if your API key has expired",
//   "Generate a new API key from your provider dashboard",
//   "Contact support if you need help"
// ]
```

### Validation Errors

| Code | Title | Message | Severity |
|------|-------|---------|----------|
| `invalidInput` | Invalid Input | Please check your input and try again. | WARNING |
| `inputTooLarge` | Input Too Large | Your input exceeds the maximum allowed size. | WARNING |
| `invalidFormat` | Invalid Format | The input format is not supported. | WARNING |

**Example:**
```javascript
const errorInfo = getErrorMessage(new Error('Input too large'));
// errorInfo.recovery = "input"
// errorInfo.suggestions = [
//   "Ensure all required fields are filled",
//   "Check for typos or invalid characters",
//   "Review the format requirements"
// ]
```

### API Errors

| Code | Title | Message | Severity |
|------|-------|---------|----------|
| `rateLimitExceeded` | Rate Limit Exceeded | You've made too many requests. | WARNING |
| `serverError` | Server Error | The server encountered an error. | ERROR |
| `serviceUnavailable` | Service Unavailable | The service is temporarily unavailable. | ERROR |
| `invalidResponse` | Invalid Response | The server returned an unexpected response. | ERROR |
| `modelNotFound` | Model Not Found | The selected model is not available. | ERROR |

**Example:**
```javascript
const errorInfo = getAPIErrorMessage(429, 'Rate limit exceeded');
// errorInfo.title = "Rate Limit Exceeded"
// errorInfo.message = "You've made too many requests. Please wait a moment before trying again."
// errorInfo.recovery = "wait"
// errorInfo.severity = "warning"
```

### Storage Errors

| Code | Title | Message | Severity |
|------|-------|---------|----------|
| `quotaExceeded` | Storage Full | Local storage is full. | ERROR |
| `storageAccessDenied` | Storage Access Denied | The extension cannot access storage. | ERROR |
| `dataCorrupted` | Data Corrupted | Some stored data appears to be corrupted. | ERROR |

**Example:**
```javascript
const errorInfo = getErrorMessage(new Error('Storage quota exceeded'));
// errorInfo.recovery = "storage"
// errorInfo.suggestions = [
//   "Clear old chat history",
//   "Remove unused models",
//   "Delete cached data"
// ]
```

## API Reference

### getErrorMessage(error, context)

Get formatted error message for any error.

**Parameters:**
- `error` (Error|string): Error object or message
- `context` (object): Additional context
  - `operation` (string): What operation was being performed
  - `provider` (string): Which provider was involved
  - Any custom context variables

**Returns:** Object with:
- `title` (string): User-friendly error title
- `message` (string): Detailed error message
- `severity` (string): Error severity level
- `suggestions` (array): Actionable suggestions
- `recovery` (string): Recovery workflow (retry, wait, settings, input, storage, permission, skip)
- `context` (object): Error context including errorType

**Example:**
```javascript
const errorInfo = getErrorMessage(new Error('Connection failed'), {
  operation: 'fetch-models',
  provider: 'openai'
});

console.log(errorInfo.title);  // "Connection Failed"
console.log(errorInfo.message);  // "Could not connect to the server."
console.log(errorInfo.suggestions);  // ["Check your internet connection", ...]
console.log(errorInfo.recovery);  // "retry"
```

### getAPIErrorMessage(statusCode, errorMessage, context)

Get formatted error message for API responses.

**Parameters:**
- `statusCode` (number): HTTP status code
- `errorMessage` (string): Error message from API
- `context` (object): Additional context

**Returns:** Object with formatted error message

**Example:**
```javascript
const errorInfo = getAPIErrorMessage(401, 'Invalid API key');

console.log(errorInfo.title);  // "Invalid API Key"
console.log(errorInfo.severity);  // "error"
console.log(errorInfo.recovery);  // "settings"
```

### clearErrorMessages()

Clear the error message cache.

**Example:**
```javascript
clearErrorMessages();
```

## Recovery Workflows

### Retry

For transient errors that may succeed on retry:
- Network errors
- Timeout errors
- Rate limit errors
- Server errors

```javascript
if (errorInfo.recovery === 'retry') {
  showRetryButton(() => {
    retryOperation();
  });
}
```

### Wait

For errors that require waiting before retry:
- Rate limit errors
- Service unavailable errors

```javascript
if (errorInfo.recovery === 'wait') {
  showWaitButton(30, () => {  // Wait 30 seconds
    retryOperation();
  });
}
```

### Settings

For errors related to configuration or credentials:
- Authentication errors
- Configuration errors

```javascript
if (errorInfo.recovery === 'settings') {
  showSettingsButton(() => {
    openSettings();
  });
}
```

### Input

For validation errors:

```javascript
if (errorInfo.recovery === 'input') {
  highlightInputFields();
  showRetryButton(() => {
    retryWithCorrectedInput();
  });
}
```

### Storage

For storage-related errors:

```javascript
if (errorInfo.recovery === 'storage') {
  showStorageActionButtons([
    { label: 'Clear Cache', action: clearCache },
    { label: 'Clear History', action: clearHistory }
  ]);
}
```

### Permission

For permission errors:

```javascript
if (errorInfo.recovery === 'permission') {
  showRequestPermissionButton(() => {
    requestPermission();
  });
}
```

### Skip

For errors that cannot be recovered:

```javascript
if (errorInfo.recovery === 'skip') {
  showContinueButton();
}
```

## Best Practices

### 1. Always Show Title and Message

Always display both the title and the detailed message:

```javascript
const errorInfo = getErrorMessage(error);

showError(errorInfo.title);  // Prominent
showMessage(errorInfo.message);  // Detailed explanation
```

### 2. Provide Actionable Suggestions

Always show suggestions when available:

```javascript
if (errorInfo.suggestions && errorInfo.suggestions.length > 0) {
  showSuggestions(errorInfo.suggestions);

  // Display as list
  errorInfo.suggestions.forEach((suggestion, index) => {
    showSuggestion(index + 1, suggestion);
  });
}
```

### 3. Offer Recovery Actions

Provide a clear recovery action:

```javascript
const recoveryActions = {
  retry: { text: 'Try Again', action: retryOperation },
  settings: { text: 'Open Settings', action: openSettings },
  wait: { text: 'Retry Later', action: dismiss },
  input: { text: 'Fix Input', action: focusInput }
};

showRecoveryAction(recoveryActions[errorInfo.recovery]);
```

### 4. Use Context for Better Messages

Provide context about what operation failed:

```javascript
// Good
const errorInfo = getErrorMessage(error, {
  operation: 'save-models',
  provider: 'openai'
});

// Less useful
const errorInfo = getErrorMessage(error);
```

### 5. Handle API Errors Specifically

Use `getAPIErrorMessage()` for API responses:

```javascript
const response = await apiCall();

if (!response.ok) {
  const errorInfo = getAPIErrorMessage(response.status, response.statusText, {
    operation: 'fetch-models'
  });

  handleError(errorInfo);
}
```

### 6. Log Error Context

Always include context when logging errors:

```javascript
const errorInfo = getErrorMessage(error, {
  operation: 'save-models',
  provider: 'openai',
  userId: getUser().id
});

logger.error(error, 'Operation failed', errorInfo.context);
```

## Integration with Other Systems

### Error Tracking

Error messages integrate with error tracking:

```javascript
import { getErrorMessage, trackError } from '../utils/index.js';

try {
  await operation();
} catch (error) {
  const errorInfo = getErrorMessage(error, {
    operation: 'save-models'
  });

  // Display user-friendly message
  showError(errorInfo.title, errorInfo.message);

  // Track the error automatically
  trackError(error, {
    operation: 'save-models',
    severity: errorInfo.severity
  });
}
```

### Unified Logging

Use logger with error messages:

```javascript
import { getErrorMessage, getLogger } from '../utils/index.js';

const logger = getLogger('MyComponent');

try {
  await operation();
} catch (error) {
  const errorInfo = getErrorMessage(error, {
    operation: 'save-models'
  });

  // Log with proper level
  if (errorInfo.severity === 'error') {
    logger.error(error, 'Operation failed', {
      errorType: errorInfo.context?.errorType
    });
  } else if (errorInfo.severity === 'warning') {
    logger.warn(error, 'Operation had issues', {
      errorType: errorInfo.context?.errorType
    });
  } else {
    logger.info('Operation completed with notes', {
      errorType: errorInfo.context?.errorType
    });
  }

  // Display to user
  showError(errorInfo.title, errorInfo.message);
}
```

## UI Components

### Error Display Component

```javascript
function showError(title, message, suggestions = [], recovery = null) {
  const container = document.createElement('div');
  container.className = 'error-display';

  container.innerHTML = `
    <div class="error-icon">⚠️</div>
    <div class="error-content">
      <h3 class="error-title">${title}</h3>
      <p class="error-message">${message}</p>
    </div>
    ${suggestions.length > 0 ? `
      <div class="error-suggestions">
        <h4>What you can do:</h4>
        <ul>
          ${suggestions.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    ${recovery ? `
      <div class="error-recovery">
        <button class="recovery-button">${getRecoveryButtonText(recovery)}</button>
      </div>
    ` : ''}
  `;

  return container;
}

function getRecoveryButtonText(recovery) {
  const buttonLabels = {
    retry: 'Try Again',
    settings: 'Open Settings',
    wait: 'Retry Later',
    input: 'Fix Input',
    storage: 'Manage Storage',
    permission: 'Request Permission',
    skip: 'Continue'
  };

  return buttonLabels[recovery] || 'Try Again';
}
```

### Toast/Notification

```javascript
function showErrorToast(title, message) {
  const errorInfo = getErrorMessage(new Error(message));

  showToast({
    title: errorInfo.title,
    message: errorInfo.message,
    duration: 5000,
    type: 'error'
  });
}
```

## Migration Guide

### Migrating Existing Error Handling

**Before:**
```javascript
try {
  await operation();
} catch (error) {
  console.error('Operation failed:', error.message);
  alert('Error: ' + error.message);
}
```

**After:**
```javascript
import { getErrorMessage } from '../utils/index.js';

try {
  await operation();
} catch (error) {
  const errorInfo = getErrorMessage(error, {
    operation: 'save-models'
  });

  logger.error(error, 'Operation failed', {
    operation: 'save-models',
    errorType: errorInfo.context?.errorType
  });

  showError(errorInfo.title, errorInfo.message, errorInfo.suggestions, errorInfo.recovery);
}
```

## Testing Error Messages

### Test Different Error Types

```javascript
// Network error
testNetworkError();

// Authentication error
testAuthError();

// Validation error
testValidationError();

// API error
testAPIError();

function testNetworkError() {
  const errorInfo = getErrorMessage(new Error('Connection failed'), {
    operation: 'fetch-models'
  });

  console.log('Network error:');
  console.log('  Title:', errorInfo.title);
  console.log('  Message:', errorInfo.message);
  console.log('  Recovery:', errorInfo.recovery);
  console.log('  Suggestions:', errorInfo.suggestions);
}

// Add more test functions...
```

## Troubleshooting

### Error Messages Not Appearing

If error messages don't show:

1. Check if `getErrorMessage()` is being called
2. Verify error context is provided
3. Check if error display component is working
4. Ensure CSS is loaded

### Wrong Error Message

If wrong error message appears:

1. Check error classification in error
2. Verify template matches error type and code
3. Clear error message cache: `clearErrorMessages()`
4. Check if custom context is interfering

### Suggestions Not Relevant

If suggestions don't match the error:

1. Verify error type classification is correct
2. Check if custom context should be provided
3. Review template for the error type/code
4. Consider adding custom error type if needed

### Recovery Actions Not Working

If recovery actions don't work:

1. Check if recovery workflow is implemented
2. Verify recovery button handlers are attached
3. Test each recovery type (retry, settings, etc.)
4. Check if context variables are needed

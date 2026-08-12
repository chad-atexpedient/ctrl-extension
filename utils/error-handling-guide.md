# Error Handling Guide for CTRL Extension

## Overview
This document provides comprehensive guidance on error handling patterns, timeout management, and user feedback strategies throughout the extension.

## Available Utilities (from utils/common-utils.js)

### Retry with Exponential Backoff
```javascript
import { retry } from '../utils/common-utils.js';

// Basic retry
await retry(
  async () => {
    return await someOperation();
  },
  {
    maxRetries: 3,
    baseDelay: 1000
  }
);

// Advanced retry with error filtering
await retry(
  async () => {
    return await apiCall();
  },
  {
    maxRetries: 5,
    baseDelay: 2000,
    shouldRetry: (error) => {
      // Only retry on network errors, not validation errors
      return error.code === 'NETWORK_ERROR';
    }
  }
);
```

### Timeout Wrapping
```javascript
import { race, delay } from '../utils/common-utils.js';

// Wrap any operation with timeout
const result = await race([
  longOperation(),
  delay(60000).then(() => { throw new Error('Timeout'); })
]);

// Or use waitForCondition
import { waitForCondition } from '../utils/common-utils.js';

const success = await waitForCondition(
  async () => {
    return await checkCondition();
  },
  {
    timeout: 30000,
    pollInterval: 1000
  }
);
```

### Safe Execution
```javascript
import { safeExecute, handleError } from '../utils/common-utils.js';

// Try-catch wrapper with automatic error logging
const result = await safeExecute(
  async () => {
    return await riskyOperation();
  },
  'Operation Name'
);
```

## Timeout Strategies

### 1. API Request Timeouts

**Chat API Requests:**
- Default timeout: 60 seconds
- Retry: 3 attempts with exponential backoff (1s, 2s, 4s)
- User feedback: Show countdown on retry attempts
- Fallback: Suggest user to try with a simpler model or check internet connection

**Tool Execution (Web Search, Image Search):**
- Default timeout: 30 seconds
- Retry: 2 attempts (1s, 3s)
- User feedback: "Searching..." → "Retry in 3s..." → "Search timed out. Please try again."
- Fallback: Show cached results if available

**Image Generation:**
- Default timeout: 120 seconds
- Retry: 1 attempt (no retry for expensive operations)
- User feedback: "Generating image... (this may take a minute)"
- Fallback: Show error with link to regenerate

### 2. Storage Operation Timeouts

**Chrome Storage Operations:**
- Default timeout: 10 seconds
- Retry: 2 attempts
- User feedback: "Saving settings..." → "Still saving..."
- Fallback: Show "Unable to save. Please try again." with manual retry button

**History Loading:**
- Default timeout: 5 seconds
- Retry: 2 attempts
- User feedback: "Loading history..."
- Fallback: Show "Unable to load chat history." with option to clear history

### 3. Content Script Communication

**Tab Messages:**
- Default timeout: 5 seconds
- Retry: 2 attempts
- User feedback: "Waiting for tab..."
- Fallback: Show "Unable to insert text. Make sure tab is active."

**Page Content Extraction:**
- Default timeout: 10 seconds
- Retry: 1 attempt
- User feedback: "Extracting page content..."
- Fallback: Continue without page content

## Error Messages

### User-Friendly Error Messages

**Network Errors:**
- "Unable to connect to the server. Please check your internet connection and try again."
- "Connection lost. Reconnecting..."
- "Server is taking longer than expected. Please wait..."

**API Errors:**
- "The API returned an error. Please try again."
- "API key appears to be invalid. Please check your settings."
- "You've reached the API rate limit. Please wait a moment before trying again."
- "This model is currently unavailable. Please try a different model."

**Validation Errors:**
- "Please enter a valid API key for [Provider Name]."
- "Please select at least one model to enable."
- "The file format is not supported. Please upload a CSV or Excel file."

**File Errors:**
- "Unable to read the file. Please try again."
- "The file is too large. Maximum size is 10MB."
- "Unable to save the file. Please check your download permissions."

**Time-out Errors:**
- "The request timed out. Please try again."
- "This operation is taking longer than expected. Please wait..."
- "Generation in progress... (this may take several minutes)"

## Error Recovery Strategies

### 1. Automatic Retry

**When to retry automatically:**
- Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
- Server errors (500, 502, 503, 504)
- Timeout errors

**When NOT to retry automatically:**
- Validation errors (400, 401, 403, 422)
- Authentication errors (401)
- Rate limit errors (429) - wait for manual retry
- Client errors (400)

### 2. User Initiated Retry

**Provide retry button when:**
- Rate limit errors with wait time
- Validation errors with guidance
- File upload failures
- Timeout errors on user-triggered actions

**Example:**
```javascript
function showError(error, retryCallback) {
  const errorMessage = formatErrorMessage(error);
  errorToast.textContent = errorMessage;

  if (retryCallback) {
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Retry';
    retryButton.onclick = retryCallback;
    errorToast.appendChild(retryButton);
  }
}
```

### 3. Graceful Degradation

**Degradation levels:**

**Level 1: Reduced functionality**
- Disable optional features (image generation, web search)
- Use cached data when available
- Show simplified UI

**Level 2: Offline mode**
- Show "Working offline" indicator
- Use local storage only
- Queue operations for when online

**Level 3: Maintenance mode**
- Show "Service unavailable" banner
- Disable all API-dependent features
- Provide read-only access to cached data

### 4. Error Logging

**Log to console with context:**
```javascript
console.error('[API Client] Request failed:', {
  error: error.message,
  url: request.url,
  method: request.method,
  timestamp: Date.now(),
  userId: userId,
  operation: operationName
});
```

**Log to storage for debugging:**
```javascript
const errorLog = await chrome.storage.local.get('error_log') || [];
errorLog.push({
  timestamp: Date.now(),
  error: error.message,
  operation: operationName
});
await chrome.storage.local.set({ error_log: errorLog.slice(-50) }); // Keep last 50 errors
```

## User Feedback Patterns

### Loading States

**Show loading indicators:**
```javascript
// Simple text
loadingSpinner.textContent = 'Processing...';

// With progress
progressBar.style.width = '50%';
progressText.textContent = '50% complete';

// With time estimate
loadingText.textContent = 'This may take 1-2 minutes...';
```

**Update loading states:**
```javascript
function updateLoadingState(currentStep, totalSteps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);
  loadingText.textContent = `Processing... ${percentage}%`;
}
```

**Hide loading states:**
```javascript
loadingSpinner.classList.add('hidden');
```

### Success Messages

**Show success feedback:**
```javascript
toast.textContent = 'Saved successfully!';
toast.className = 'toast success';
setTimeout(() => toast.classList.add('hidden'), 3000);
```

### Warning Messages

**Show warnings for non-critical issues:**
```javascript
warningBanner.textContent = '⚠️ Rate limit approaching. Slow down requests.';
warningBanner.classList.remove('hidden');
```

### Error Toasts

**Show errors with clear messaging:**
```javascript
errorToast.textContent = `Error: ${errorMessage}`;
errorToast.classList.remove('hidden');

// Auto-hide after 5 seconds
setTimeout(() => errorToast.classList.add('hidden'), 5000);
```

## Timeout Configuration

**Recommended timeouts per operation type:**

| Operation Type | Timeout | Retries | Backoff |
|--------------|----------|---------|---------|
| Chat message | 60s | 3 | 1s, 2s, 4s |
| Web search | 30s | 2 | 1s, 3s |
| Image search | 30s | 2 | 1s, 3s |
| Image generation | 120s | 1 | none |
| File upload | 30s | 2 | 2s, 4s |
| Settings save | 10s | 2 | 1s, 2s |
| History load | 5s | 2 | 500ms, 1s |
| Content extraction | 10s | 1 | none |

## Implementation Checklist

For each error handling scenario:

- [ ] Clear error message
- [ ] Appropriate timeout configured
- [ ] Retry logic implemented
- [ ] User feedback shown
- [ ] Loading state managed
- [ ] Error logged
- [ ] Recovery option provided
- [ ] Graceful degradation defined
- [ ] Edge cases handled (network offline, etc.)

---

**Status:** Complete. Ready to integrate error handling patterns throughout the codebase.

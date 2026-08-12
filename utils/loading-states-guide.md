# Loading States Guide

This guide explains how to use the loading state system in CTRL Extension.

## Overview

The loading state system provides:
- **Generic loading overlays** - Show loading on any element
- **Button loading states** - Loading spinners on buttons with disabled state
- **Page loading overlays** - Full-screen loading with backdrop
- **Progress bars** - Track operation progress with percentages
- **Skeleton placeholders** - Shimmer effect for content loading
- **Batch operation management** - Track multiple simultaneous operations
- **Global loading indicator** - App-wide loading visibility

## Quick Start

### Show Loading on Element

```javascript
import { showLoading, hideLoading } from '../utils/index.js';

// Show loading state
const loading = showLoading('#my-container', {
  spinner: true,
  text: 'Loading data...'
});

// Hide loading state
loading.hide();
```

### Button Loading States

```javascript
import { setButtonLoading, resetButton } from '../utils/index.js';

// Show button loading
const buttonLoading = setButtonLoading('#save-button', {
  text: 'Saving...'
});

// Reset button to normal
buttonLoading.reset();
```

### Page Loading

```javascript
import { showPageLoading, hidePageLoading } from '../utils/index.js';

// Show full-page loading
const pageLoading = showPageLoading({
  text: 'Please wait...',
  backdrop: true
});

// Hide full-page loading
pageLoading.hide();
```

### Progress Bar

```javascript
import { showProgress, hideProgress } from '../utils/index.js';

// Show progress bar
const progress = showProgress('#progress-container', 0, {
  text: 'Uploading files...'
});

// Update progress
progress.update(25);
progress.update(50);
progress.update(75);
progress.update(100);

// Hide progress bar
progress.hide();
```

### Skeleton Loading

```javascript
import { showSkeleton, hideSkeleton } from '../utils/index.js';

// Show skeleton placeholder
const skeleton = showSkeleton('#data-list', {
  count: 5,
  type: 'list',
  height: '60px'
});

// Hide skeleton and show real content
skeleton.hide();
```

## API Reference

### showLoading(element, options)

Show loading state on an element.

**Parameters:**
- `element` (HTMLElement|string): Element or CSS selector
- `options` (object): Loading options
  - `overlay` (boolean): Show as overlay (default: false)
  - `spinner` (boolean): Show spinner (default: true)
  - `text` (string): Loading text (default: 'Loading...')
  - `size` (string): Spinner size - 'small', 'medium', 'large' (default: 'medium')
  - `backdrop` (boolean): Add backdrop (default: false)

**Returns:** Object with `id` and `hide()` method

**Example:**
```javascript
const loading = showLoading('#model-list', {
  spinner: true,
  text: 'Loading models...'
});

// Later
loading.hide();
```

### hideLoading(element)

Hide loading state from an element.

**Parameters:**
- `element` (HTMLElement|string): Element or CSS selector

**Example:**
```javascript
hideLoading('#model-list');
```

### setButtonLoading(button, options)

Set button to loading state.

**Parameters:**
- `button` (HTMLElement|string): Button element or selector
- `options` (object): Button options
  - `text` (string): Button text (default: 'Loading...')
  - `spinner` (boolean): Show spinner (default: true)
  - `size` (string): Spinner size (default: 'small')
  - `preserveOriginalText` (boolean): Keep original text (default: true)

**Returns:** Object with `id` and `reset()` method

**Example:**
```javascript
const buttonLoading = setButtonLoading('#save-button', {
  text: 'Saving...',
  spinner: true
});

// Later
buttonLoading.reset();
```

### resetButton(button)

Reset button to normal state.

**Parameters:**
- `button` (HTMLElement|string): Button element or selector

**Example:**
```javascript
resetButton('#save-button');
```

### showPageLoading(options)

Show full-page loading overlay.

**Parameters:**
- `options` (object): Overlay options
  - `text` (string): Loading text (default: 'Loading...')
  - `spinner` (boolean): Show spinner (default: true)
  - `backdrop` (boolean): Add backdrop (default: true)

**Returns:** Object with `id` and `hide()` method

**Example:**
```javascript
const pageLoading = showPageLoading({
  text: 'Processing your request...'
});

// Later
pageLoading.hide();
```

### hidePageLoading()

Hide full-page loading overlay.

**Example:**
```javascript
hidePageLoading();
```

### showProgress(container, progress, options)

Show progress indicator.

**Parameters:**
- `container` (HTMLElement|string): Container element or selector
- `progress` (number): Progress value (0-100)
- `options` (object): Progress options
  - `text` (string): Progress text (default: 'Processing...')
  - `showPercentage` (boolean): Show percentage (default: true)
  - `size` (string): Progress bar size - 'small', 'medium', 'large' (default: 'medium')

**Returns:** Object with `id`, `update(newProgress)`, and `hide()` method

**Example:**
```javascript
const progress = showProgress('#upload-container', 0, {
  text: 'Uploading...'
});

// Update progress
progress.update(25);
progress.update(50);
progress.update(100);

// Hide progress
progress.hide();
```

### hideProgress(container)

Hide progress indicator.

**Parameters:**
- `container` (HTMLElement|string): Container element or selector

**Example:**
```javascript
hideProgress('#upload-container');
```

### showSkeleton(container, options)

Show skeleton loading placeholder.

**Parameters:**
- `container` (HTMLElement|string): Container element or selector
- `options` (object): Skeleton options
  - `count` (number): Number of skeleton items (default: 3)
  - `height` (string): Height of each item (default: '60px')
  - `width` (string): Width (default: '100%')
  - `type` (string): Skeleton type - 'list', 'card', 'text' (default: 'list')

**Returns:** Object with `id` and `hide()` method

**Example:**
```javascript
const skeleton = showSkeleton('#chat-history', {
  count: 5,
  type: 'list',
  height: '80px'
});

// Later
skeleton.hide();
```

### hideSkeleton(container)

Hide skeleton loading state.

**Parameters:**
- `container` (HTMLElement|string): Container element or selector

**Example:**
```javascript
hideSkeleton('#chat-history');
```

### LoadingStateManager Class

Batch loading state manager for multiple operations.

**Methods:**
- `setOperation(operation, isLoading)` - Set loading state for an operation
- `isLoading()` - Check if any operation is loading
- `getOperationState(operation)` - Get state for specific operation
- `clearAll()` - Clear all loading states

**Example:**
```javascript
import { getGlobalLoadingManager } from '../utils/index.js';

const manager = getGlobalLoadingManager();

// Set operation loading
manager.setOperation('fetch-models', true);

// Check if loading
if (manager.isLoading()) {
  console.log('Something is loading');
}

// Get specific operation state
const state = manager.getOperationState('fetch-models');
console.log('Fetch models loading:', state.loading);
console.log('Started at:', state.startTime);

// Clear all loading
manager.clearAll();
```

### getGlobalLoadingManager()

Get the global loading manager instance.

**Example:**
```javascript
import { getGlobalLoadingManager } from '../utils/index.js';

const manager = getGlobalLoadingManager();
```

## Integration Examples

### API Call with Loading

```javascript
import { showLoading, hideLoading } from '../utils/index.js';

async function fetchModels() {
  const loading = showLoading('#models-container', {
    text: 'Fetching available models...'
  });

  try {
    const response = await api.getModels();
    renderModels(response.data);
  } catch (error) {
    showError(error.message);
  } finally {
    loading.hide();
  }
}
```

### Form Submission

```javascript
import { setButtonLoading, resetButton } from '../utils/index.js';

async function submitForm() {
  const button = document.getElementById('submit-button');
  const loading = setButtonLoading(button, {
    text: 'Saving...'
  });

  try {
    await saveFormData();
    showSuccess('Saved successfully!');
  } catch (error) {
    showError(error.message);
  } finally {
    loading.reset();
  }
}
```

### File Upload with Progress

```javascript
import { showProgress, hideProgress } from '../utils/index.js';

async function uploadFile(file) {
  const progress = showProgress('#upload-container', 0, {
    text: 'Uploading ' + file.name + '...'
  });

  try {
    await uploadWithProgress(file, (percent) => {
      progress.update(percent);
    });
    showSuccess('File uploaded successfully!');
  } catch (error) {
    showError(error.message);
  } finally {
    progress.hide();
  }
}
```

### Data Fetching with Skeleton

```javascript
import { showSkeleton, hideSkeleton } from '../utils/index.js';

async function loadChatHistory() {
  const container = document.getElementById('chat-history');
  const skeleton = showSkeleton(container, {
    count: 10,
    type: 'list'
  });

  try {
    const history = await fetchChatHistory();
    renderChatHistory(history);
  } catch (error) {
    showError(error.message);
  } finally {
    skeleton.hide();
  }
}
```

### Batch Operations

```javascript
import { getGlobalLoadingManager } from '../utils/index.js';

const manager = getGlobalLoadingManager();

async function performBatchOperations() {
  // Set operations as loading
  manager.setOperation('fetch-models', true);
  manager.setOperation('load-settings', true);

  try {
    await Promise.all([
      fetchModels(),
      loadSettings()
    ]);
  } catch (error) {
    showError(error.message);
  } finally {
    // Clear all loading states
    manager.clearAll();
  }
}
```

## Best Practices

### 1. Always Hide Loading in Finally

Always clean up loading states in finally blocks:

```javascript
try {
  await operation();
} catch (error) {
  handleError(error);
} finally {
  loading.hide(); // Always cleanup
}
```

### 2. Provide Clear Loading Text

Use descriptive loading text:

```javascript
// Good
showLoading('#container', {
  text: 'Fetching your chat history...'
});

// Less useful
showLoading('#container', {
  text: 'Loading...'
});
```

### 3. Use Appropriate Loading Type

Choose the right loading type for each scenario:
- `showLoading()` - Generic loading for any element
- `setButtonLoading()` - Button/form submission
- `showPageLoading()` - Full-page blocking operation
- `showProgress()` - Multi-step operations with known progress
- `showSkeleton()` - Content that will be loaded asynchronously

### 4. Update Progress Regularly

For long operations, update progress frequently:

```javascript
for (let i = 0; i <= 100; i += 10) {
  progress.update(i);
  await delay(100); // Simulate work
}
```

### 5. Use Batch Management for Multiple Operations

When multiple operations run in parallel:

```javascript
manager.setOperation('op1', true);
manager.setOperation('op2', true);
manager.setOperation('op3', true);

// Show global indicator automatically
// Hide when all complete
```

### 6. Consider Mobile Performance

On mobile, use smaller spinners and simpler animations:

```javascript
setButtonLoading(button, {
  size: 'small',  // Smaller spinner on mobile
  spinner: true
});
```

## CSS Customization

### Using CSS Variables

The loading states use CSS variables that can be customized:

```css
:root {
  --primary-color: #4a90e2;
  --secondary-color: #357abd;
  --text-color: #333;
  --text-muted: #666;
  --border-color: #e0e0e0;
  --bg-color: #fff;
}

/* Dark mode */
[data-theme="dark"] {
  --primary-color: #5aa8ff;
  --text-color: #f0f0f0;
  --bg-color: #2a2a2a;
}
```

### Dark Mode Support

Loading states automatically support dark mode via:
1. System preference: `@media (prefers-color-scheme: dark)`
2. Manual theme: `[data-theme="dark"]`

Ensure your CSS variables include dark mode values.

## Troubleshooting

### Loading Not Showing

If loading state doesn't appear:

1. Check element selector is correct
2. Verify CSS is loaded
3. Check z-index of overlapping elements
4. Ensure element has dimensions

### Loading Won't Hide

If loading state persists:

1. Ensure hide() method is called
2. Check if finally block executes
3. Verify element selector is still valid
4. Check for errors in hide() execution

### Spinner Not Animating

If spinner doesn't spin:

1. Verify CSS is loaded and valid
2. Check animation syntax
3. Ensure no conflicting animations
4. Check browser compatibility

## Performance Considerations

### Minimize DOM Updates

For frequent progress updates:

```javascript
// Good - Use requestAnimationFrame
function smoothProgress(target) {
  const progress = showProgress(container, current);
  
  function animate() {
    if (current < target) {
      current += 1;
      progress.update(current);
      requestAnimationFrame(animate);
    }
  }
  
  animate();
}

// Bad - Update too frequently
for (let i = 0; i <= 100; i++) {
  progress.update(i);
  // No throttling
}
```

### Use CSS Animations Over JS

CSS animations (spin, shimmer) are more performant than JS animations.

### Lazy Load Large Loading States

For loading states that are initially hidden:

```javascript
const loadingElement = document.createElement('div');
loadingElement.style.display = 'none';
loadingElement.className = 'loading-container';

// Only show when needed
loadingElement.style.display = 'flex';
```

## Accessibility

### Loading States and ARIA

Add ARIA attributes for accessibility:

```javascript
const loading = showLoading('#container');

loadingElement.setAttribute('aria-busy', 'true');
loadingElement.setAttribute('aria-live', 'polite');

// When loading complete
loading.hide();
loadingElement.removeAttribute('aria-busy');
```

### Focus Management

Maintain focus during loading:

```javascript
const activeElement = document.activeElement;

// Show loading
const loading = showLoading('#modal-content');

// Restore focus after loading
loading.hide();
activeElement?.focus();
```

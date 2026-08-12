# Performance Tracking Guide

This guide explains how to use the performance tracking system in CTRL Extension.

## Overview

The performance tracking system provides:
- **API call monitoring** - Track response times, success rates, and patterns
- **Memory usage tracking** - Monitor memory consumption over time
- **User action tracking** - Track user interactions and patterns
- **Custom metrics** - Track any performance metric you need
- **Statistical analysis** - Min, max, avg, P95, P99 calculations
- **Low overhead** - Designed to minimize performance impact

## Quick Start

### Automatic Monitoring

The performance tracker automatically starts when imported:
- Collects memory metrics every 5 seconds (if supported)
- Observes performance entries for user actions
- Tracks all manually added metrics

### Track API Calls

```javascript
import { trackApiCall } from '../utils/index.js';

// Start tracking
const endTracking = trackApiCall({
  endpoint: '/chat/completions',
  provider: 'openai',
  method: 'POST'
});

// ... make API call ...

// End tracking with result
const response = await apiCall();
endTracking(response, null); // No error

// Or with error
try {
  const response = await apiCall();
  endTracking(response);
} catch (error) {
  endTracking(null, error);
}
```

### Track User Actions

```javascript
import { trackAction } from '../utils/index.js';

trackAction('chat-message-sent', {
  modelId: 'gpt-4',
  messageLength: 150,
  duration: 1234
});

trackAction('model-changed', {
  oldModel: 'gpt-4',
  newModel: 'gpt-4-turbo'
});
```

### Track Custom Metrics

```javascript
import { trackMetric } from '../utils/index.js';

// Track file upload time
trackMetric('file-upload-time', 2345, 'ms', {
  fileType: 'pdf',
  fileSize: 1024000
});

// Track chat message count
trackMetric('chat-messages-sent', 1, 'count', {
  model: 'gpt-4'
});

// Track cache hits
trackMetric('cache-hits', 45, 'count', {
  cacheType: 'model-cache'
});
```

### Wrap Async Functions

```javascript
import { wrapAsync } from '../utils/index.js';

const fetchModels = wrapAsync('fetch-models', async () => {
  const response = await api.getModels();
  return response.data;
}, {
  tags: { provider: 'openai' }
});

// Function is now automatically tracked
const models = await fetchModels();
```

## API Reference

### trackApiCall(options)

Track an API call and return an end function.

**Options:**
- `endpoint` (string): API endpoint (e.g., '/chat/completions')
- `provider` (string): API provider (e.g., 'openai', 'anthropic')
- `method` (string): HTTP method (default: 'GET')

**Returns:** Function that must be called with (result, error)

**Example:**
```javascript
const end = trackApiCall({
  endpoint: '/v1/chat/completions',
  provider: 'openai',
  method: 'POST'
});

const result = await fetch(url);
end(result, null);
```

### trackAction(action, details)

Track a user action.

**Parameters:**
- `action` (string): Action name (e.g., 'chat-message-sent')
- `details` (object): Additional details about the action
  - `duration` (number): Action duration in ms (optional)

**Example:**
```javascript
trackAction('modal-opened', {
  modalType: 'model-selector',
  provider: 'openai'
});

trackAction('button-clicked', {
  buttonId: 'send-message',
  page: 'sidepanel',
  duration: 150 // ms until action completed
});
```

### trackMetric(name, value, unit, tags)

Track a custom metric.

**Parameters:**
- `name` (string): Metric name
- `value` (number): Metric value
- `unit` (string): Unit (ms, bytes, count, etc.) (default: 'count')
- `tags` (object): Additional tags for filtering

**Example:**
```javascript
trackMetric('api-response-time', 234, 'ms', {
  endpoint: '/chat',
  provider: 'openai'
});

trackMetric('memory-usage', 52428800, 'bytes', {
  operation: 'chat',
  model: 'gpt-4'
});
```

### PerformanceTracker Instance Methods

#### getApiStats(filters)

Get API performance statistics.

**Filters:**
- `provider` (string): Filter by provider
- `endpoint` (string): Filter by endpoint
- `success` (boolean): Filter by success/failure
- `since` (number): Filter by timestamp

**Returns:** Object with:
- `count` (number): Total API calls
- `successCount` (number): Successful calls
- `failureCount` (number): Failed calls
- `successRate` (number): Success rate (0-1)
- `min` (number): Minimum duration (ms)
- `max` (number): Maximum duration (ms)
- `avg` (number): Average duration (ms)
- `median` (number): Median duration (ms)
- `p95` (number): 95th percentile (ms)
- `p99` (number): 99th percentile (ms)

**Example:**
```javascript
import { getPerformanceTracker } from '../utils/index.js';

const tracker = getPerformanceTracker();

// All API stats
const allStats = tracker.getApiStats();

// Stats for OpenAI only
const openaiStats = tracker.getApiStats({ provider: 'openai' });

// Stats for successful calls in last hour
const recentStats = tracker.getApiStats({
  success: true,
  since: Date.now() - 3600000
});
```

#### getMemoryStats()

Get memory usage statistics.

**Returns:** Object with:
- `count` (number): Number of samples
- `latest.usedMB` (number): Current used memory (MB)
- `latest.totalMB` (number): Total allocated memory (MB)
- `latest.percentage` (number): Usage percentage
- `minMB` (number): Minimum memory usage
- `maxMB` (number): Peak memory usage
- `avgMB` (number): Average memory usage
- `trend` (string): 'increasing', 'decreasing', or 'stable'

**Note:** Returns null if memory API is not available.

#### getActionStats(filters)

Get user action statistics.

**Filters:**
- `action` (string): Filter by action name
- `since` (number): Filter by timestamp

**Returns:** Object with:
- `count` (number): Total actions
- `byAction` (object): Count by action name
- `uniqueActions` (number): Number of unique actions

**Example:**
```javascript
const tracker = getPerformanceTracker();

// All action stats
const allActions = tracker.getActionStats();

// Stats for specific action
const chatStats = tracker.getActionStats({ action: 'chat-message-sent' });

// Actions in last hour
const recentActions = tracker.getActionStats({
  since: Date.now() - 3600000
});
```

#### getCustomMetricStats(name)

Get custom metric statistics.

**Parameters:**
- `name` (string): Optional metric name filter

**Returns:** Object with stats for each metric (or specific metric if name provided)

#### getAllMetrics()

Get all collected metrics.

**Returns:** Object with all metrics and aggregated statistics.

#### clear()

Clear all metrics and reset tracking.

#### exportToJson(options)

Export metrics as JSON.

**Options:**
- `includeRaw` (boolean): Include raw metric arrays (default: false)

**Returns:** JSON string with metrics and statistics.

#### generateSummary()

Generate a human-readable summary report.

**Returns:** String with performance summary including:
- API performance (count, success rate, response times)
- Memory usage (current, peak, average, trend)
- User activity (total actions, top actions)
- Custom metrics

## Performance Analysis

### Identify Slow API Calls

```javascript
import { getPerformanceTracker } from '../utils/index.js';

const tracker = getPerformanceTracker();

// Get slow calls (> 5 seconds)
const allCalls = tracker.apiMetrics.filter(m => m.duration > 5000);

// Group by endpoint
const byEndpoint = {}
allCalls.forEach(call => {
  if (!byEndpoint[call.endpoint]) {
    byEndpoint[call.endpoint] = []
  }
  byEndpoint[call.endpoint].push(call)
});

// Find slowest endpoints
Object.entries(byEndpoint).forEach(([endpoint, calls]) => {
  const avg = calls.reduce((sum, c) => sum + c.duration, 0) / calls.length
  console.log(`${endpoint}: ${calls.length} calls, avg ${avg.toFixed(2)}ms`)
});
```

### Monitor Memory Leaks

```javascript
import { getPerformanceTracker } from '../utils/index.js';

const tracker = getPerformanceTracker();

// Check memory trend
const memoryStats = tracker.getMemoryStats();

if (memoryStats.trend === 'increasing') {
  console.warn('Memory usage is increasing over time - possible leak')
  console.log(`Current: ${memoryStats.latest.usedMB.toFixed(2)}MB`)
  console.log(`Peak: ${memoryStats.maxMB.toFixed(2)}MB`)
}
```

### Analyze User Behavior

```javascript
const tracker = getPerformanceTracker();
const actionStats = tracker.getActionStats();

// Get most common actions
const topActions = Object.entries(actionStats.byAction)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

topActions.forEach(([action, count]) => {
  console.log(`${action}: ${count} times (${(count / actionStats.count * 100).toFixed(1)}%)`)
});
```

## Integration with Existing Code

### API Client Integration

Wrap API calls with performance tracking:

```javascript
import { trackApiCall } from '../utils/index.js';

async function fetchFromAPI(url, options) {
  const endTracking = trackApiCall({
    endpoint: url,
    provider: options.provider,
    method: options.method
  });

  try {
    const response = await fetch(url, options);
    endTracking(response, null);
    return response;
  } catch (error) {
    endTracking(null, error);
    throw error;
  }
}
```

### Button Click Tracking

```javascript
import { trackAction } from '../utils/index.js';

document.getElementById('my-button').addEventListener('click', () => {
  const startTime = performance.now();

  // Perform action
  doSomething();

  trackAction('button-clicked', {
    buttonId: 'my-button',
    duration: performance.now() - startTime
  });
});
```

## Best Practices

### 1. Track All Critical Paths

Track performance for all user-facing operations:
- API calls to external services
- User interactions (clicks, navigation)
- File operations (upload, download, processing)
- Long-running computations

### 2. Use Descriptive Names

Use clear, descriptive metric names:
```javascript
// Good
trackMetric('api-chat-response-time', duration, 'ms')
trackAction('file-upload-completed', { fileSize })

// Less useful
trackMetric('time1', duration, 'ms')
trackAction('clicked1')
```

### 3. Include Relevant Context

Add context that helps analyze performance:
```javascript
trackApiCall({
  endpoint: '/chat/completions',
  provider: 'openai',
  method: 'POST',
  model: 'gpt-4', // Additional context
  promptLength: message.length // Additional context
});
```

### 4. Monitor Memory Trends

Check memory trends regularly to catch leaks early:
```javascript
const memoryStats = getPerformanceTracker().getMemoryStats();
if (memoryStats && memoryStats.trend === 'increasing') {
  console.warn('Potential memory leak detected');
}
```

### 5. Set Appropriate Thresholds

Define performance thresholds and alert when exceeded:
```javascript
const apiStats = getApiStats();
if (apiStats.p95 > 3000) { // 3 seconds
  console.warn('P95 response time exceeded threshold');
}
```

## Performance Dashboard

### Create a Simple Dashboard

```javascript
import { getPerformanceTracker } from '../utils/index.js';

function showPerformanceDashboard() {
  const tracker = getPerformanceTracker();

  console.log(tracker.generateSummary());

  const stats = tracker.getAllMetrics();

  // API Performance
  console.log('=== API Performance ===');
  console.log('Success Rate:', `${(stats.stats.api.successRate * 100).toFixed(1)}%`);
  console.log('Avg Response:', `${stats.stats.api.avg?.toFixed(2)}ms`);
  console.log('P95 Response:', `${stats.stats.api.p95?.toFixed(2)}ms`);

  // Memory
  if (stats.stats.memory) {
    console.log('\n=== Memory ===');
    console.log('Current:', `${stats.stats.memory.latest.usedMB.toFixed(2)}MB`);
    console.log('Peak:', `${stats.stats.memory.maxMB.toFixed(2)}MB`);
    console.log('Trend:', stats.stats.memory.trend);
  }
}

// Run every minute
setInterval(showPerformanceDashboard, 60000);
```

## Export and Reporting

### Export for Analysis

```javascript
import { exportPerformanceReport } from '../utils/index.js';

// Get full export
const fullExport = exportPerformanceReport({ includeRaw: true });

// Save to file or send to backend
console.log(fullExport);

// Or get summary
const summary = getPerformanceSummary();
console.log(summary);
```

## Configuration

### Customize Tracker

```javascript
import { getPerformanceTracker } from '../utils/index.js';

const tracker = getPerformanceTracker({
  maxMetrics: 500, // Store more metrics
  enabled: true // Disable if needed
});
```

## Troubleshooting

### No Memory Metrics

Memory tracking requires Chrome's `performance.memory` API:
- Works in Chrome/Edge
- May not work in all browsers
- Check `getMemoryStats()` returns null

### Metrics Not Showing

Ensure:
1. Tracker is imported at least once
2. `enabled: true` (default)
3. Not cleared prematurely
4. Checking correct metric type (api, actions, memory, custom)

### High Overhead

If performance tracking adds overhead:
1. Reduce `maxMetrics` limit
2. Filter metrics before exporting
3. Disable tracking in production if not needed

## Performance Considerations

- Designed for low overhead (< 1% impact)
- Automatic memory collection every 5 seconds
- Metric storage limited to prevent memory growth
- Statistical calculations are O(n log n) for sorting
- No blocking operations on main thread

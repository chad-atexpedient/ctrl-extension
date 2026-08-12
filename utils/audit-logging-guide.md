# Audit Logging Guide

This guide explains how to use the audit logging system in CTRL Extension.

## Overview

The audit logging system provides:
- **Security-relevant action logging** - Track API keys, auth, permissions
- **Tamper-evident audit trail** - Hash verification for log integrity
- **Structured event types** - Categorized events for easy filtering
- **Search and filtering** - Find specific audit events
- **Export capabilities** - Generate reports for investigations
- **Persistent storage** - Logs survive across sessions

## Event Categories

- **Security** - Authentication, API keys, security alerts
- **Configuration** - Settings, model selections, provider changes
- **Data** - Exports, imports, deletions
- **Permission** - Permission grants, denials, revocations
- **System** - Extension lifecycle, system events
- **Error** - Logged errors

## Quick Start

### Basic Audit Logging

```javascript
import { logAuditEvent } from '../utils/index.js';

// Log an event
logAuditEvent('API_KEY_SET', {
  provider: 'openai',
  userId: 'user123'
});
```

### Using Specific Log Methods

```javascript
import {
  logAuditEvent,
  getAuditLogger
} from '../utils/index.js';

const logger = getAuditLogger();

// Log API key action
logger.logApiKeyAction('set', 'openai', {
  maskedKey: 'sk-***...key'
});

// Log settings change
logger.logSettingsChange('theme', 'dark', 'light', {
  page: 'options',
  source: 'user-action'
});

// Log model selection change
logger.logModelSelectionChange('openai', ['gpt-4o'], ['gpt-3.5-turbo'], {
  totalSelected: 2
});
```

## API Reference

### logApiKeyAction(action, provider, details)

Log API key security action.

**Parameters:**
- `action` (string): 'set', 'updated', 'deleted', 'viewed'
- `provider` (string): Provider ID (e.g., 'openai', 'anthropic')
- `details` (object): Additional details

**Example:**
```javascript
logger.logApiKeyAction('set', 'openai', {
  maskedKey: 'sk-***...key',
  source: 'options-page',
  isDefault: false
});
```

### logSettingsChange(settingKey, oldValue, newValue, details)

Log settings configuration change.

**Parameters:**
- `settingKey` (string): Setting that changed
- `oldValue`: Previous value (will be sanitized if sensitive)
- `newValue`: New value (will be sanitized if sensitive)
- `details` (object): Additional details

**Example:**
```javascript
logger.logSettingsChange('maxTokens', 2000, 4000, {
  source: 'options-page',
  provider: 'openai'
});

logger.logSettingsChange('apiKey', '***', 'sk-new***', {
  source: 'api-client',
  provider: 'anthropic'
});
```

### logModelSelectionChange(provider, addedModels, removedModels, details)

Log model selection changes.

**Parameters:**
- `provider` (string): Provider ID
- `addedModels` (array): Models that were added
- `removedModels` (array): Models that were removed
- `details` (object): Additional details

**Example:**
```javascript
logger.logModelSelectionChange('openai', ['gpt-4o'], ['gpt-3.5-turbo'], {
  totalSelected: 2,
  maxAllowed: 2,
  source: 'model-selector-modal'
});
```

### logAuthAction(action, details)

Log authentication event.

**Parameters:**
- `action` (string): 'login', 'logout', 'failed'
- `details` (object): Additional details

**Example:**
```javascript
logger.logAuthAction('login', {
  method: 'api-key',
  provider: 'openai',
  ipAddress: '192.168.1.1'
});

logger.logAuthAction('failed', {
  reason: 'invalid-key',
  provider: 'anthropic',
  attemptCount: 3
});
```

### logDataAction(action, dataType, details)

Log data operations.

**Parameters:**
- `action` (string): 'exported', 'imported', 'deleted'
- `dataType` (string): Type of data (e.g., 'chat-history', 'settings')
- `details` (object): Additional details

**Example:**
```javascript
logger.logDataAction('exported', 'chat-history', {
  messageCount: 150,
  size: '2.5MB',
  format: 'json'
});

logger.logDataAction('deleted', 'cache', {
  cacheType: 'model-cache',
  entryCount: 100
});
```

### logPermissionAction(action, permission, details)

Log permission changes.

**Parameters:**
- `action` (string): 'granted', 'denied', 'revoked'
- `permission` (string): Permission type
- `details` (object): Additional details

**Example:**
```javascript
logger.logPermissionAction('granted', 'host_permissions', {
  domain: 'api.openai.com',
  reason: 'api-access'
});

logger.logPermissionAction('denied', 'storage', {
  requestedAction: 'write-settings',
  reason: 'user-denied'
});
```

### logSecurityAlert(alertType, details)

Log security alerts.

**Parameters:**
- `alertType` (string): Type of security alert
- `details` (object): Alert details

**Example:**
```javascript
logger.logSecurityAlert('suspicious-activity', {
  description: 'Multiple failed auth attempts',
  attempts: 5,
  timeWindow: '5 minutes',
  severity: 'high'
});

logger.logSecurityAlert('api-key-exposed', {
  location: 'browser-console',
  severity: 'critical'
});
```

### search(filters)

Search audit logs with filters.

**Filters:**
- `eventType` (string): Filter by event type
- `category` (string): Filter by category (security, configuration, etc.)
- `provider` (string): Filter by provider
- `userId` (string): Filter by user ID
- `sessionId` (string): Filter by session ID
- `since` (number): Filter events since timestamp
- `until` (number): Filter events until timestamp
- `limit` (number): Limit number of results

**Returns:** Array of filtered log entries

**Example:**
```javascript
const logger = getAuditLogger();

// All security events in last hour
const securityEvents = logger.search({
  category: 'security',
  since: Date.now() - 3600000
});

// API key changes for OpenAI
const openaiKeyChanges = logger.search({
  eventType: 'API_KEY_UPDATED',
  provider: 'openai'
});

// Last 20 events
const recentEvents = logger.search({
  limit: 20
});
```

### getStats(filters)

Get audit statistics.

**Returns:** Object with:
- `total` (number): Total log count
- `byEventType` (object): Count by event type
- `byCategory` (object): Count by category
- `byProvider` (object): Count by provider
- `timeRange` (object): First and last timestamps

**Example:**
```javascript
const stats = logger.getStats();

console.log('Total events:', stats.total);
console.table(stats.byCategory);
console.table(stats.byEventType);
```

### exportToJson(options)

Export audit logs as JSON.

**Options:**
- `includeAll` (boolean): Include all logs (default: false)
- `filters` (object): Apply filters (default: none)

**Returns:** JSON string with logs and statistics

**Example:**
```javascript
// Export all logs
const fullExport = logger.exportToJson({ includeAll: true });

// Export only security events
const securityExport = logger.exportToJson({
  filters: { category: 'security' }
});

// Save to file
const blob = new Blob([fullExport], { type: 'application/json' });
const url = URL.createObjectURL(blob);
// ... download logic
```

### generateReport()

Generate human-readable audit report.

**Returns:** String with summary of:
- Session info
- Total events
- Events by category
- Top event types
- Events by provider

**Example:**
```javascript
const report = logger.generateReport();
console.log(report);
// Output:
// === Audit Log Report ===
// Session ID: audit_session_123...
// Session Duration: 3600s
// Total Events: 150
//
// --- Events by Category ---
//   security: 45
//   configuration: 60
//   data: 25
//   ...
```

### clear(reason)

Clear all audit logs.

**Parameters:**
- `reason` (string): Reason for clearing (required for audit trail)

**Example:**
```javascript
// Clear all logs
logger.clear('User requested cleanup');

// Clear and log the clear event itself
// This ensures the clear action is audited
```

## Integration Examples

### API Key Management

```javascript
import { getAuditLogger } from '../utils/index.js';

const logger = getAuditLogger();

async function saveApiKey(provider, apiKey) {
  // Log the action
  logger.logApiKeyAction('set', provider, {
    maskedKey: maskKey(apiKey)
  });

  // Save to storage
  await storage.setApiKey(provider, apiKey);
}

async function deleteApiKey(provider) {
  logger.logApiKeyAction('deleted', provider, {
    reason: 'user-requested'
  });

  await storage.deleteApiKey(provider);
}
```

### Model Selection

```javascript
async function updateModelSelection(provider, added, removed) {
  const logger = getAuditLogger();

  logger.logModelSelectionChange(provider, added, removed, {
    totalSelected: added.length,
    source: 'model-selector-modal'
  });

  await storage.saveModelSelection(provider, newSelection);
}
```

### Settings Changes

```javascript
async function updateSetting(key, newValue) {
  const logger = getAuditLogger();

  const oldValue = await storage.getSetting(key);

  logger.logSettingsChange(key, oldValue, newValue, {
    source: 'options-page'
  });

  await storage.setSetting(key, newValue);
}
```

## Compliance and Security

### Log Integrity

Each audit log entry includes a hash calculated from:
- Timestamp
- Event type
- User ID
- Event details

This provides tamper evidence - if log entries are modified, the hash will mismatch.

### Data Retention

- Default: Store up to 1000 log entries
- Configurable via `maxLogs` option
- Oldest entries automatically removed when limit reached
- Logs persist across browser sessions

### Sensitive Data Handling

The logger automatically sanitizes sensitive data:
- API keys are masked: `sk-***...key`
- Passwords are replaced with `***`
- Sensitive values are not logged in plain text

### Audit Trail Requirements

For compliance with security standards:
1. **All security-relevant actions are logged**
2. **Logs include who, what, when, where**
3. **Logs cannot be modified without detection (hash verification)**
4. **Logs are persistent and exportable**
5. **Clear actions are themselves logged**

## Search and Investigation

### Find Suspicious Activity

```javascript
const logger = getAuditLogger();

// Find multiple failed auth attempts
const failedLogins = logger.search({
  eventType: 'AUTH_FAILED',
  since: Date.now() - 3600000 // Last hour
});

if (failedLogins.length > 3) {
  console.warn('Suspicious: Multiple failed login attempts', failedLogins);
}

// Find API key changes
const keyChanges = logger.search({
  eventType: ['API_KEY_SET', 'API_KEY_UPDATED', 'API_KEY_DELETED']
});

keyChanges.forEach(change => {
  console.log('Key change:', change);
});
```

### Compliance Auditing

```javascript
const logger = getAuditLogger();

// Get all security events for audit period
const auditPeriodStart = Date.now() - 30 * 24 * 3600000; // 30 days
const auditEvents = logger.search({
  category: 'security',
  since: auditPeriodStart
});

// Generate report for compliance
const report = logger.generateReport();
console.log('Compliance Report:', report);

// Export for records
const export = logger.exportToJson({
  filters: { since: auditPeriodStart }
});
saveToComplianceStorage(export);
```

## Best Practices

### 1. Log All Security Actions

Always log security-relevant actions:
```javascript
// Good
logger.logApiKeyAction('set', provider, details);
logger.logAuthAction('login', details);
logger.logPermissionAction('granted', permission, details);

// Never skip logging security events
```

### 2. Include Relevant Context

Add context that helps with investigations:
```javascript
logger.logApiKeyAction('set', provider, {
  maskedKey: maskKey(apiKey),
  source: 'options-page',
  ipAddress: '192.168.1.1', // If available
  isDefault: false
});
```

### 3. Use Specific Event Types

Use the most specific event type:
```javascript
// Good
logger.logApiKeyAction('set', 'openai', details);

// Less specific
logAuditEvent('API_KEY_SET', {
  action: 'set',
  provider: 'openai',
  ...details
});
```

### 4. Regular Audit Reviews

Periodically review audit logs:
```javascript
// Weekly audit review
setInterval(() => {
  const stats = logger.getStats({
    since: Date.now() - 7 * 24 * 3600000 // Last 7 days
  });

  console.log('Weekly Audit Review:', stats);

  // Check for suspicious patterns
  if (stats.byCategory.security > 50) {
    console.warn('High security activity detected');
  }
}, 7 * 24 * 3600000);
```

### 5. Maintain Log Retention

Set appropriate retention policy:
```javascript
const logger = getAuditLogger({
  maxLogs: 1000, // Keep last 1000 events
  enabled: true
});

// Or periodically clear old logs
async function maintainLogRetention() {
  const logs = logger.search();

  if (logs.length > 1000) {
    // Keep only most recent 1000
    logger.logs = logs.slice(-1000);
    await logger._saveToStorage();
  }
}
```

## Configuration

### Customize Logger

```javascript
import { getAuditLogger } from '../utils/index.js';

const logger = getAuditLogger({
  maxLogs: 2000, // Store more logs
  enabled: true // Disable if needed
});
```

## Troubleshooting

### Logs Not Appearing

Ensure:
1. Logger is imported at least once
2. `enabled: true` (default)
3. Storage is accessible (chrome.storage.local)
4. Not calling `clear()` frequently

### Storage Quota Exceeded

If storage quota is exceeded:
1. Reduce `maxLogs` limit
2. Implement log rotation strategy
3. Export logs regularly and clear old ones

### Missing Logs After Browser Close

Logs should persist via chrome.storage.local. If not persisting:
1. Check storage permissions in manifest
2. Verify storage is not being cleared elsewhere
3. Check browser settings for data clearing

## Security Considerations

### Protect Audit Logs

- Store in secure chrome.storage.local (not localStorage)
- Use hash verification for integrity
- Require authentication to view sensitive logs
- Log all clear actions

### Prevent Log Tampering

- Each entry has a hash of its content
- Verify hashes when reading logs
- Detect and report tampering attempts

### Privacy Protection

- Sanitize sensitive data automatically
- Don't log full API keys or passwords
- Provide audit report summary without exposing full logs
- Require authentication to view detailed logs

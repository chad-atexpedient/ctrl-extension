# CTRL Extension - Privacy Policy

Last Updated: March 3, 2026

## Table of Contents

1. [Introduction](#introduction)
2. [Data We Collect](#data-we-collect)
3. [How We Use Your Data](#how-we-use-your-data)
4. [Data Storage](#data-storage)
5. [Data Sharing](#data-sharing)
6. [Data Security](#data-security)
7. [Your Choices](#your-choices)
8. [Cookies & Local Storage](#cookies--local-storage)
9. [Third-Party Services](#third-party-services)
10. [Children's Privacy](#childrens-privacy)
11. [Changes to This Policy](#changes-to-this-policy)
12. [Contact Us](#contact-us)

---

## Introduction

CTRL Extension is a browser extension that provides an in-window AI chat interface. We are committed to protecting your privacy and being transparent about how we handle your data.

**Summary:**
- **Zero Data Collection:** We do not collect any personal data
- **Local Storage Only:** All data is stored locally on your device
- **Encrypted Storage:** API keys are encrypted using AES-GCM
- **No Tracking:** We do not track your browsing activity
- **No Analytics:** We do not use analytics or tracking services

---

## Data We Collect

We collect **NO** personal data from you. The only data we handle is:

### 1. API Keys (Encrypted)
- **What:** Your API keys for AI providers (OpenAI, Anthropic, Google, etc.)
- **Why:** To make API requests on your behalf
- **Storage:** Encrypted locally on your device using AES-GCM
- **Sharing:** Never shared with our servers or third parties

### 2. User Preferences (Local)
- **What:** Your theme selection, font size, notifications settings, etc.
- **Why:** To provide a personalized experience
- **Storage:** Stored locally in browser storage
- **Sharing:** Never shared

### 3. Chat History (Local)
- **What:** Your conversations with AI (optional - can be disabled)
- **Why:** To provide conversation context and history
- **Storage:** Stored locally on your device
- **Sharing:** Never shared (you can clear at any time)

### 4. Provider Credentials (Encrypted)
- **What:** API keys and custom base URLs for AI providers
- **Why:** To authenticate with AI provider APIs
- **Storage:** Encrypted locally using AES-GCM
- **Sharing:** Never shared

### What We DO NOT Collect
- Personal information (name, email, phone, etc.)
- Browsing history or activity
- Location data
- Device information
- Usage analytics or telemetry
- Click tracking or behavior data
- Third-party cookies

---

## How We Use Your Data

### API Keys & Provider Credentials
- **Purpose:** Authenticate with AI provider APIs
- **Usage:** Send API requests to providers on your behalf
- **Storage:** Encrypted locally on your device
- **Retention:** Until you delete them
- **Access:** Only accessible from your browser profile

### Chat History
- **Purpose:** Provide conversation continuity and context
- **Usage:** Display conversation history in sidepanel
- **Storage:** Stored locally on your device
- **Retention:** Until you clear history
- **Access:** Only accessible from your browser profile
- **Control:** You can disable chat history or clear it anytime

### User Preferences
- **Purpose:** Personalize your experience
- **Usage:** Apply your settings (theme, notifications, etc.)
- **Storage:** Stored locally on your device
- **Retention:** Until you change settings
- **Access:** Only accessible from your browser profile

---

## Data Storage

All data is stored **locally** on your device in your browser's storage:

### Chrome Storage (Local)
- **Capacity:** ~5MB (encrypted data)
- **Encryption:** AES-GCM for sensitive data
- **Location:** Chrome profile directory
- **Access:** Only from your browser profile

### Storage Locations
- **Encrypted Data:** API keys, provider credentials
- **Plain Data:** Preferences, chat history (if enabled)
- **Cache:** Model lists, provider configurations

### Data Retention
- **API Keys:** Until you delete them
- **Chat History:** Until you clear it
- **Preferences:** Until you change them
- **Cache:** Automatic expiration (LRU cache)

---

## Data Sharing

We **DO NOT** share any data with anyone.

### No Data Sharing
- We do not sell your data
- We do not share data with third parties
- We do not use data for advertising
- We do not send data to our servers

### Data Sent to AI Providers
Your messages are sent directly to AI provider APIs you configure:

- **Purpose:** Get AI responses
- **Content:** Your messages and context (if enabled)
- **Recipients:** Only the AI providers you authorize
- **Transmission:** Direct from your browser to provider
- **Encryption:** HTTPS encryption for all API calls
- **Interception:** We do not intercept or log your conversations

### AI Providers We Support
- OpenAI (api.openai.com)
- Anthropic (api.anthropic.com)
- Google AI (generativelanguage.googleapis.com)
- Z.ai (api.z.ai)
- Meta (api.meta.ai)
- Mistral (api.mistral.ai)
- DeepSeek (api.deepseek.com)
- MiniMax (api.minimax.chat)
- Alibaba Cloud (dashscope.aliyuncs.com)

**Important:** Each provider has their own privacy policy. Your data is subject to their terms when using their APIs.

---

## Data Security

### Encryption
- **Algorithm:** AES-GCM (AES-256)
- **Key Management:** Per-installation unique keys
- **Key Storage:** Securely generated using Web Crypto API
- **Data at Rest:** All sensitive data encrypted

### Key Security Features
1. **Per-Installation Keys:** Each browser installation gets unique encryption key
2. **Never Uploaded:** Encryption keys never leave your device
3. **Secure Generation:** Keys generated using cryptographically secure methods
4. **No Hardcoded Keys:** No hardcoded encryption keys in code

### Browser Security
- **Manifest V3:** Uses latest Chrome extension security features
- **Content Security Policy:** Restricts script and resource loading
- **Permissions:** Minimal permissions required for functionality
- **HTTPS Only:** All API calls use HTTPS encryption

### Local Storage Security
- **Browser Profile Protection:** Data protected by browser profile security
- **No External Access:** Local storage only accessible from extension
- **Quota Management:** Storage quota checks prevent data loss

---

## Your Choices

### Opt-Out Options
You have full control over your data:

1. **Disable Chat History**
   - Go to Settings
   - Uncheck "Save Chat History"
   - All future conversations won't be saved

2. **Clear Chat History**
   - Go to Settings
   - Click "Clear History"
   - All saved conversations deleted permanently

3. **Delete API Keys**
   - Go to Settings
   - Remove API keys for any provider
   - Keys deleted permanently

4. **Clear All Data**
   - Go to chrome://extensions/
    - Click "Remove" on CTRL Extension
   - All extension data deleted

5. **Disable Context Awareness**
   - Go to Settings
   - Uncheck "Include Page Content"
   - Page content won't be included in conversations

### Data Export
- You can export your settings from the options page
- Exported file contains your preferences (no sensitive data)

### Data Deletion
- All data can be deleted at any time from Settings
- Uninstalling extension removes all data

---

## Cookies & Local Storage

### Cookies
We **DO NOT** use cookies.

### Local Storage
We use browser's local storage to store:
- Encrypted API keys
- User preferences
- Chat history (if enabled)

**Important:**
- Data never shared outside your browser
- Data encrypted before storage
- Data deleted when extension is removed

---

## Third-Party Services

### AI Providers
We integrate with third-party AI providers:
- Your data is sent directly to these providers
- Each provider has their own privacy policy
- We recommend reviewing their policies:
  - [OpenAI Privacy Policy](https://openai.com/policies/privacy-policy)
  - [Anthropic Privacy Policy](https://www.anthropic.com/privacy)
  - [Google Privacy Policy](https://policies.google.com/privacy)
  - [Z.ai Privacy Policy](https://api.z.ai/privacy)
  - [Meta Privacy Policy](https://www.meta.com/privacy/policy)
  - [Mistral Privacy Policy](https://mistral.ai/privacy)
  - [DeepSeek Privacy Policy](https://www.deepseek.com/privacy)
  - [MiniMax Privacy Policy](https://api.minimax.chat/privacy)
  - [Alibaba Privacy Policy](https://www.alibabacloud.com/privacy)

**We do not:**
- Track your usage of these services
- Log your conversations
- Share data with these providers beyond API calls

### No Other Third-Party Services
- No analytics
- No advertising
- No tracking
- No data brokers

---

## Children's Privacy

CTRL Extension is not intended for children under 13:
- No age verification required
- No personal data collected
- Parental controls recommended

---

## Changes to This Policy

We may update this privacy policy from time to time:
- Changes will be posted here with updated date
- Significant changes will be visible in the extension
- We will not retroactively change data practices without notice

---

## Contact Us

If you have questions about this privacy policy:

**Email:** [Add contact email if available]

**GitHub:** [Add repository link if available]

**Bug Reports:** Report issues via GitHub Issues

---

## Summary

**Our Commitment:**
- ✅ Zero personal data collection
- ✅ All data stored locally
- ✅ Sensitive data encrypted
- ✅ No data sharing
- ✅ No tracking or analytics
- ✅ Full user control
- ✅ Transparent practices

**Your Rights:**
- ✅ View all stored data
- ✅ Delete any data
- ✅ Opt out of features
- ✅ Clear history anytime
- ✅ Uninstall completely

---

**This privacy policy applies only to CTRL Extension browser extension.** When you use AI provider services, their respective privacy policies apply to your interactions with them.

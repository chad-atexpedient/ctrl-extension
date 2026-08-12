# Chrome Web Store Permission Justifications

## `storage`

Stores encrypted provider credentials, settings, conversation history, prompt
snippets, spending estimates, and consent state locally.

## `activeTab`

Reads the active page only after the user invokes a chat/context action so the
selected page or selection can be included in a prompt.

## `scripting`

Supports explicit page-context and insertion actions initiated by the user.

## `tabs`

Identifies the active tab for context collection and user-requested Browser
Agent actions.

## `debugger`

Powers the optional Browser Agent CDP integration. The feature requires an
explicit user toggle and displays approval prompts before mutating actions.

## `notifications`

Shows local status notifications for Browser Agent attach/detach and long-running
operations. No remote notification service is used.

## `alarms`

Schedules local MCP refresh and backup maintenance tasks requested by the user.

## Host permissions

Known provider origins are declared for API requests. Custom provider origins
are optional and requested only when the user saves a custom HTTPS/HTTP endpoint
from the options page.

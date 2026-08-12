# Store Screenshots

Chrome Web Store screenshots must be captured from a headed browser session and
must not contain API keys, private page content, local file names, or personal
data. Capture at 1280x800 or 640x400 and add 1-5 PNG files to this directory.

Recommended set:

1. Main side-panel chat with streaming response
2. Prompt snippet autocomplete and conversation sidebar
3. Code/output drawer with Terminal and Preview tabs
4. Options model selector and spending dashboard
5. Popup quick action with response preview

Use `npm run capture:store-screenshots` to regenerate the current five images
from a headed Chromium session. Review every image manually before uploading it
to a store; replace any image that contains local setup state or personal data.

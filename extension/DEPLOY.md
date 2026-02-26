# The Murderer's Lock — Browser Extension Deployment

Production-ready Chrome and Firefox extension with auto-fill and vault integration.

---

## Quick Start (Developer Mode)

### Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension` folder
5. Click the extension icon → **Settings** → set **App URL** (e.g. `http://localhost:3000` or your production URL)
6. Open the web app, unlock your vault
7. Visit any login page → click **🔐 Fill** next to the password field

### Firefox

1. Open `about:debugging`
2. Click **This Firefox** → **Load Temporary Add-on**
3. Select `extension/manifest.json`
4. Configure App URL in the popup (same as Chrome)
5. Unlock vault in app, then use Fill on login pages

---

## Production Build

### Chrome (Web Store)

1. **Package the extension**
   ```bash
   cd extension
   zip -r ../murderers-lock-chrome.zip . -x "*.DS_Store" -x "DEPLOY.md" -x "README.md"
   ```

2. **Create Chrome Web Store developer account**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - One-time $5 registration fee

3. **Upload**
   - New item → Upload zip
   - Add store listing (description, screenshots, icons)
   - Submit for review

4. **Update manifest for store**
   - Ensure `manifest.json` has correct `version`
   - Icons: 16x16, 48x48 (required); 128x128 recommended for store listing

### Firefox (Add-ons)

1. **Package**
   ```bash
   cd extension
   zip -r ../murderers-lock-firefox.zip . -x "*.DS_Store" -x "DEPLOY.md" -x "README.md"
   ```

2. **Firefox Add-ons**
   - [addons.mozilla.org/developers](https://addons.mozilla.org/developers/)
   - Submit new add-on → Upload zip
   - Firefox uses Manifest v3; our manifest is compatible
   - Add `browser_specific_settings` if needed:
   ```json
   "browser_specific_settings": {
     "gecko": {
       "id": "murderers-lock@yourdomain.com",
       "strict_min_version": "109.0"
     }
   }
   ```

---

## Manifest Differences: Chrome vs Firefox

| Feature | Chrome | Firefox |
|---------|--------|---------|
| Manifest v3 | ✅ | ✅ (109+) |
| `chrome.storage` | ✅ | ✅ (`browser.storage`) |
| `host_permissions` | ✅ | ✅ |
| Icons | 16, 48 (128 optional) | 16, 48, 128 |

For cross-browser, we use `chrome.*` APIs — Firefox supports them via the [WebExtension API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions).

---

## Configuration

### App URL

- **Local dev:** `http://localhost:3000` (or your dev server port)
- **Production:** `https://your-app.vercel.app` (or custom domain)

Set in popup → **Settings** → **App URL** → **Save**.

### Vault Sync

Vault contents sync when you:
1. Open the web app
2. Unlock your vault
3. The app dispatches `vault-unlocked` → extension stores contents in session

Session storage clears when the browser closes. Re-unlock to sync again.

---

## File Structure

```
extension/
├── manifest.json      # Extension manifest (Chrome + Firefox)
├── popup.html         # Popup UI
├── popup.js           # Popup logic (config, status)
├── content.js         # Page script (fill buttons, vault-unlocked listener)
├── icon16.png         # 16×16 icon
├── icon48.png         # 48×48 icon
├── README.md          # User install instructions
└── DEPLOY.md          # This file
```

---

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | App URL config (local), vault contents (session) |
| `activeTab` | Access current tab for fill |
| `host_permissions: <all_urls>` | Inject content script on login pages |

No sensitive data leaves the user's device. Vault contents stay in session storage.

---

## Troubleshooting

**"Unlock your vault first"**
- Open the web app, unlock vault, then try Fill again
- Ensure App URL in Settings matches where the app runs

**Fill button not appearing**
- Refresh the login page after unlocking
- Check that the extension is enabled

**Firefox: "Load Temporary Add-on"**
- Temporary add-ons are removed on browser restart
- For permanent install: sign the extension and submit to addons.mozilla.org

---

## Version History

- **1.0.0** — Initial release: auto-fill, vault sync, configurable app URL

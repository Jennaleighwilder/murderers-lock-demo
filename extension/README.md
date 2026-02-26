# The Murderer's Lock — Browser Extension

Chrome & Firefox extension for auto-filling passwords from your vault.

## Install (Developer)

1. **Chrome:** `chrome://extensions` → Developer mode → Load unpacked → select `extension` folder
2. **Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json`
3. Click extension icon → **Settings** → set **App URL** (e.g. `http://localhost:3000`)

## Usage

1. Open the Murderer's Lock app and unlock your vault
2. Extension syncs vault contents automatically
3. On any login page, a **🔐 Fill** button appears next to password fields
4. Click Fill to insert the matching password (by site) or the first entry

## Vault Format

Store entries as: `site.com | password` or `label: password`

Examples:
```
github.com | mySecretPass123
amazon.com : shoppingPwd!
```

## Deployment

See [DEPLOY.md](DEPLOY.md) for Chrome Web Store and Firefox Add-ons submission.

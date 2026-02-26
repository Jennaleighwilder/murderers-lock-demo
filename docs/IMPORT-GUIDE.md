# Import System — Integration Guide

Universal password import from 1Password, Bitwarden, LastPass, Chrome, Firefox, Safari, and generic CSV.

---

## What's Included

| File | Purpose |
|------|---------|
| `app/js/password-importer.js` | Client-side parser for all formats |
| `api/import-passwords.js` | Audit logging for import events |
| Vault page | Import UI (Choose File, Merge, Replace) |

---

## Supported Formats

| Source | Format | Auto-Detected |
|--------|--------|--------------|
| 1Password | CSV | ✅ |
| Bitwarden | JSON | ✅ |
| LastPass | CSV | ✅ |
| Chrome | CSV | ✅ |
| Firefox | CSV | ✅ |
| Safari | CSV | ✅ |
| Generic | CSV (url, username, password) | ✅ |

---

## How to Export from Competitors

### 1Password
1. Open 1Password → File → Export
2. Choose **CSV** (or 1PIF for full export)
3. Save file

### Bitwarden
1. Settings → Export Vault
2. Choose **.json (unencrypted)**
3. Enter master password

### LastPass
1. Account Options → Advanced → Export
2. Enter master password
3. CSV downloads

### Chrome
1. Settings → Passwords → ⋮ → Export passwords
2. Confirm with device password
3. CSV downloads

---

## Usage

1. Open the Murderer's Lock app and unlock your vault
2. Scroll to **Import Passwords**
3. Click **Choose File** and select your export (CSV or JSON)
4. Preview shows detected format and entry count
5. **Merge into Vault** — add new entries (duplicates skipped)
6. **Replace Vault** — overwrite all contents
7. Click **Save Changes** to encrypt and persist

---

## Output Format

Imported entries are stored as:
```
site.com | username | password
other-site.com | password
```

---

## Security

- **Parsing is client-side** — no passwords sent to the server
- **Audit logs** — import events (format, count, merge/replace) logged server-side
- **Delete exports** — CSV/JSON files are plaintext; delete after import

---

## API

### POST /api/import-passwords

Logs import for audit trail.

```json
{
  "vaultId": "v_123",
  "format": "bitwarden",
  "count": 42,
  "action": "merge"
}
```

---

## Testing

1. Create a test CSV:
   ```csv
   url,username,password
   site.com,user@example.com,pass123
   ```
2. Import → Merge
3. Verify entry appears in vault
4. Save

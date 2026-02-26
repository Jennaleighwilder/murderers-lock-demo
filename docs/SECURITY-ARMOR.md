# Security Armor — Thanos-Grade Hardening

## Badass Features (Beyond Acceptable)

| Feature | What it does |
|---------|--------------|
| **Security Badge** | A/B/C/D grade in vault header — at-a-glance health |
| **Secure Copy** | Copy password → auto-clears clipboard in 30s |
| **Keyboard shortcuts** | Ctrl+Enter unlock/save, Ctrl+L lock |
| **HSTS** | Strict-Transport-Security, 1 year, preload |
| **Breach check** | haveibeenpwned k-anonymity on every health check |

## XSS (Cross-Site Scripting) — FIXED

| Location | Fix |
|----------|-----|
| **Vault import preview** | All user-controlled data (label, username) escaped before innerHTML |
| **Audit log** | Action and name escaped before render |
| **Dashboard vault cards** | Vault name and ID escaped; href uses encodeURIComponent |
| **Settings 2FA QR** | QR data URL validated (must match `data:image/(png|jpeg|gif|webp);base64,`) |
| **Validate.escapeHtml** | Used consistently for any user/API data in DOM |

## Security Headers (vercel.json)

| Header | Value |
|--------|-------|
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| X-XSS-Protection | 1; mode=block |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), interest-cohort=() |
| Content-Security-Policy | default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://formspree.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://formspree.io |

## API Input Validation (api/input-validation.js)

| Input | Validation |
|-------|------------|
| vaultId | Alphanumeric, underscore, hyphen, dot; max 128 chars |
| password | 12–256 chars |
| name | Max 256 chars |
| salt, iv | Hex only; max 10k chars |
| contents | Max 2MB |
| base64 data | Valid base64; size limit |

Applied to: create-vault, encrypt-vault, audit-log, import-passwords.

## Rate Limiting & Timing

- **Unlock**: 10 attempts/hour per vault; constant-time 5s delay on failure
- **Murder count**: 3 failures → lockjaw
- **Audit log limit**: Max 200 events per request

## Secure Memory

- **SecureMemory.clearInput** on password fields after use
- **SecureMemory.clearOnUnload** for unlock, secrets, recovered-password
- Best-effort zeroing of TypedArrays for sensitive buffers

## Extension Security

- **chrome.storage.session** — vault contents cleared on browser close
- **Content script** — no innerHTML with user data; uses textContent/createElement
- **Permissions** — minimal: storage, activeTab, host_permissions for fill

## Architecture Note

- **Server-assisted decryption**: Password is sent to server for unlock. Not zero-knowledge. See `docs/SECURITY-COMPARISON-AND-FIX-PLAN.md` for comparison to 1Password/Bitwarden and migration path.

## Encryption (Existing)

- Argon2id key derivation
- AES-256-GCM encryption
- Nanosecond Lock (33 Gates) option
- Shamir 2-of-3 recovery

## Reporting

Report security issues to [your contact]. Do not disclose publicly before a fix is released.

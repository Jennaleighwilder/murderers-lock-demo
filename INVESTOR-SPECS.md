# The Murderer's Lock — Investor Specs & Product Readiness

**Document purpose:** Exact specifications of what was built, how it works, what is ready for immediate sale, and what must be done before production.

**Live demo:** https://murderers-lock-demo.vercel.app/

---

## 1. Executive Summary

**The Murderer's Lock** is a quantum-resistant (symmetric) security vault for high-value digital assets (crypto, IP, legal docs). Server-side encryption with Argon2id + AES-256-GCM, Shamir 2-of-3 recovery, and a unique 33-gate mechanism that triggers lockjaw (permanent lock until Shamir recovery) after failed unlock attempts. Built for cryptocurrency holders, enterprises, researchers, and legal.

**Tech stack:** Node.js, vanilla JS/HTML/CSS, Argon2, shamirs-secret-sharing, otplib (2FA), @simplewebauthn (WebAuthn), Vercel serverless

**Deployment:** Vercel (live), local `node server.js`

---

## 2. Architecture Overview

### 2.1 Documentation

| Document | Purpose |
|----------|---------|
| `docs/WHITEPAPER.md` | Architecture, crypto, threat model, attack resistance |
| `docs/CRYPTO-SPEC.md` | Argon2id + 33-gate KDF specification |
| `docs/THREAT-MODEL.md` | Assets, attackers, controls |
| `docs/DEVICE-KEY-MIGRATION.md` | Device key schema for Supabase |

### 2.2 Folder Structure

```
murderers-lock-demo/
├── app/                    # Frontend
│   ├── index.html         # Login / Vault Manager entry
│   ├── dashboard.html     # Create vault, vault list
│   ├── vault.html         # Vault contents, add/edit/delete, import, password health
│   ├── settings.html      # 2FA, WebAuthn, password change
│   ├── recovery.html      # Shamir recovery flow
│   ├── security.html      # Cryptography spec (in-app)
│   ├── dms.html           # Dead Man's Switch config
│   └── js/                # Client scripts
│       ├── password-strength-meter.js
│       ├── password-health.js
│       ├── password-importer.js
│       ├── vault-integration.js
│       ├── 33-gates-display.js
│       ├── key-profile-display.js
│       ├── webauthn-helper.js
│       └── ...
├── api/                   # Vercel serverless / local API
│   ├── create-vault.js
│   ├── unlock-vault.js
│   ├── encrypt-vault.js
│   ├── recover-vault.js
│   ├── audit-log.js
│   ├── import-passwords.js
│   ├── 2fa-setup.js, 2fa-verify.js, 2fa-status.js, 2fa-disable.js
│   ├── webauthn-register-options.js, webauthn-register-verify.js
│   ├── webauthn-auth-options.js, webauthn-auth-verify.js
│   ├── dms-config.js, dms-check-in.js
│   ├── health.js
│   └── input-validation.js
├── lib/
│   ├── 33-gates-real.js       # 33-gate protocol
│   ├── recovery-33gates.js
│   ├── nanosecond-lock-production.js
│   └── ...
├── extension/             # Chrome browser extension (auto-fill)
├── mobile/                # React Native (Expo) app
├── test/                  # Security + validation tests
├── docs/                  # Specs, audits, deployment
├── server.js              # Local dev server
└── vercel.json            # Security headers, CSP
```

### 2.3 Data Flow

```
Create Vault:
  User → dashboard.html → POST /api/create-vault (email, password, vaultName)
  → Argon2id key derivation → Shamir 2-of-3 shards → Store encrypted vault metadata
  → Redirect to vault

Unlock Vault:
  User → index.html → POST /api/unlock-vault (vaultId, password)
  → Argon2id verify → 33-gate check → AES-256-GCM decrypt
  → Return sessionToken (one-time) + vault contents
  → Wrong password: murderCount++, lockjaw at 33

Save Vault:
  User → vault.html → POST /api/encrypt-vault (sessionToken, contents)
  → Verify token → Encrypt contents → Store
```

---

## 3. Features Built — Complete Inventory

### 3.1 Landing Page (Marketing Site)

| Section | Content |
|---------|---------|
| Hero | Quantum-resistant security vault, Argon2id + AES-256-GCM, Shamir 2-of-3 |
| Stats | 256-bit AES-GCM, 33 Security Gates, 2-of-3 Shamir, $0 Breach Incidents |
| How It Works | Create vault → Rate-limited access → Recover or share |
| Why TML | Quantum-resistant, server-side encryption, active defense, Shamir, instant access, audit trail |
| Built For | Crypto holders, enterprises, researchers, legal |
| Attack Resistance | Device binding, biometric, location, panic code, graduated response, fail-safe recovery |
| Attack Matrix | Brute force, DoS, physical coercion, device theft, quantum, permanent loss |
| Roadmap | Q1–Q4 2026 (core, mobile, enterprise, post-quantum) |
| Interactive Demo | 33-gate demo, Vault Manager |
| Pricing | Personal $29/mo, Professional $99/mo, Enterprise Custom |
| FAQ | Lockjaw, recovery, panic code, zero-knowledge, quantum, DMS, etc. |
| Contact | Form (Formspree), email, phone, GitHub |

### 3.2 App Pages

| Route | Purpose |
|-------|---------|
| `/app/index.html` | Login / Vault Manager entry |
| `/app/dashboard.html` | Create vault, list vaults |
| `/app/vault.html` | Vault contents, add/edit/delete entries, import, password health |
| `/app/settings.html` | 2FA, WebAuthn, password change |
| `/app/recovery.html` | Shamir 2-of-3 recovery |
| `/app/security.html` | In-app crypto spec |
| `/app/dms.html` | Dead Man's Switch config |

### 3.3 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/create-vault` | POST | Create vault (email, password, vaultName) |
| `/api/unlock-vault` | POST | Unlock with password → sessionToken + contents |
| `/api/encrypt-vault` | POST | Save vault contents (sessionToken, contents) |
| `/api/recover-vault` | POST | Shamir 2-of-3 recovery → sessionToken |
| `/api/audit-log` | POST/GET | Log access, fetch audit trail |
| `/api/import-passwords` | POST | Import from CSV/JSON (1Password, LastPass, Chrome, Bitwarden) |
| `/api/2fa-setup` | POST | Generate TOTP secret, return QR |
| `/api/2fa-verify` | POST | Verify 6-digit code |
| `/api/2fa-status` | GET | Check if 2FA enabled |
| `/api/2fa-disable` | POST | Disable 2FA |
| `/api/webauthn-register-options` | POST | WebAuthn registration challenge |
| `/api/webauthn-register-verify` | POST | Verify and store credential |
| `/api/webauthn-auth-options` | POST | WebAuthn auth challenge |
| `/api/webauthn-auth-verify` | POST | Verify assertion, return vault |
| `/api/dms-config` | POST | Configure Dead Man's Switch |
| `/api/dms-check-in` | POST | Check-in for DMS |
| `/api/device-challenge` | POST | Issue one-time challenge for device binding (replay-proof) |
| `/api/device-register` | POST | Register device (requires deviceRegistrationToken from unlock) |
| `/api/device-verify` | POST | Verify device trusted for vault |
| `/api/health` | GET | Health check for monitoring |

### 3.4 Cryptography

| Component | Algorithm | Purpose |
|-----------|-----------|---------|
| Password hashing | Argon2id | Key derivation, memory-hard |
| Vault encryption | AES-256-GCM | Encrypt vault contents |
| Recovery shards | Shamir 2-of-3 | 2 of 3 shards recover password |
| Shard protection | PBKDF2 + AES-256-GCM | Encrypt shards with PIN |
| 33-gate protocol | Nanosecond timestamps | Rate limit, lockjaw at 33 failed attempts |

### 3.5 Security Features

| Feature | Status |
|---------|--------|
| 33 Gates | ✅ Wired |
| Shamir 2-of-3 Recovery | ✅ Wired |
| Lockjaw (33 murders) | ✅ Wired |
| Password strength meter | ✅ Done |
| Breach monitoring (haveibeenpwned) | ✅ Done |
| 2FA/TOTP | ✅ Done |
| WebAuthn (Face ID, Touch ID, YubiKey) | ✅ Done |
| Audit logs | ✅ Done |
| Dead Man's Switch | ✅ Wired |
| Input validation (vaultId, password, XSS, SQLi) | ✅ Done |
| Security headers (CSP, X-Frame-Options, etc.) | ✅ Done |
| Distributed rate limiting (per-IP, global) | ✅ Done |
| Cryptographic device binding (ECDSA P-256) | ✅ Done |

---

## 4. How It Works — Detailed Flows

### 4.1 Create Vault

1. User enters email, password (12+ chars), vault name on dashboard.
2. `POST /api/create-vault` → Argon2id derives key, creates Shamir 2-of-3 shards.
3. Shards stored encrypted (PIN-protected). Vault metadata stored.
4. User redirected to vault or recovery flow to save shards.

### 4.2 Unlock Vault

1. User enters vaultId, password on index.html.
2. `POST /api/unlock-vault` → Argon2id verify, 33-gate check.
3. Correct password: AES-256-GCM decrypt → return sessionToken + contents.
4. Wrong password: murderCount++, 401, no plaintext leak. At 33: lockjaw.

### 4.3 Shamir Recovery

1. User provides 2 of 3 shards + shard PIN.
2. `POST /api/recover-vault` → Reconstruct key from shards.
3. Returns one-time sessionToken (not password). Token used to access vault.

### 4.4 Lockjaw

- 33 failed unlock attempts → lockjaw engaged.
- Recovery via 2-of-3 Shamir only (no password).
- Rate limit: 10 attempts/hour (secondary).

---

## 5. What Is Ready for Immediate Sale

### 5.1 ✅ Ready (Live on Vercel)

| Item | Notes |
|------|-------|
| **Landing page** | Full marketing site, pricing, FAQ, contact |
| **33-gate demo** | Interactive demo (demo.html) |
| **Vault Manager** | Create, unlock, save, import, password health |
| **2FA/TOTP** | Enable in settings, required at unlock |
| **WebAuthn** | Security key / biometric at unlock |
| **Shamir recovery** | 2-of-3 recovery flow |
| **Dead Man's Switch** | Config + check-in |
| **Password strength + breach check** | Real-time, haveibeenpwned |
| **Audit logs** | Unlock, create, save events |
| **Chrome extension** | Auto-fill (extension/) |
| **Mobile app** | React Native (Expo) — CreateVault, Unlock, Vault, Dashboard, BiometricAuth |
| **Security tests** | 27 security tests, 55+ validation tests |

### 5.2 ⚠️ Requires Configuration

| Item | Notes |
|------|-------|
| **Contact form** | Uses Formspree — configure endpoint |
| **Pricing / trials** | No Stripe/payment integration yet |
| **Enterprise demo** | Contact form only |

### 5.3 ❌ Not Ready / Roadmap (per website)

| Item | Roadmap |
|------|---------|
| **Device binding** | Q2 2026 |
| **Biometric safeguard (lockjaw)** | Q2 2026 |
| **Location awareness** | Q2 2026 |
| **Panic/duress code** | Q2 2026 |
| **Graduated response** | Q2 2026 |
| **Native mobile apps** | Q2 2026 |
| **Enterprise (SSO, SAML, SOC 2)** | Q3 2026 |
| **Post-quantum migration** | Q4 2026 |

---

## 6. Data Model & Storage

- **Vaults:** In-memory / serverless store (Vercel serverless = ephemeral; production needs persistent DB).
- **Audit logs:** `api/audit-store.js` (in-memory; production needs DB).
- **2FA/WebAuthn:** `api/2fa-store.js`, `api/webauthn-store.js` (in-memory).
- **DMS:** `api/dms-store.js` (in-memory).

**Production requirement:** Supabase, PostgreSQL, or similar for persistent storage of vaults, audit logs, 2FA, WebAuthn credentials, DMS config.

---

## 7. Test Commands

```bash
npm test                 # Validation suite (62 tests)
npm run test:stress      # 10 iterations
npm run test:security    # Security tests (server must be running)
npm run test:security:full   # Start server + 27 security tests
npm run test:security:stress # 5 security runs
npm start                # Local server (port 3000)
npm run generate-test-data   # Test CSVs, JSON, vault preload
```

---

## 8. What Needs to Be Done — Prioritized

### P0 — Before First Paying Customer

1. **Persistent storage** — Replace in-memory stores with Supabase/PostgreSQL for vaults, audit, 2FA, WebAuthn, DMS.
2. **Stripe** — Integrate pricing ($29, $99, Enterprise).
3. **Contact form** — Verify Formspree or replace with CRM/webhook.

### P1 — Product Depth

1. **Device binding** — Only registered devices can attempt unlock.
2. **Panic/duress code** — Fake unlock + silent alarm.
3. **Graduated lockjaw** — 15-min slow mode → 24hr email → 7-day lockdown (not instant).
4. **Location awareness** — Unusual location = verification.

### P2 — Enterprise

1. **SSO / SAML** — Enterprise auth.
2. **Compliance** — Designed to support SOC 2, HIPAA, ISO 27001; certification in progress.
3. **On-premise deployment** — Enterprise option.

### P3 — Future

1. **Post-quantum (NIST PQC)** — Q4 2026.
2. **Time-locked vaults** — Already in `lib/time-lock.js`, integrate.

---

## 9. Summary Table

| Category | Ready | Config Needed | Not Done |
|----------|-------|---------------|----------|
| **Marketing** | Landing, pricing, FAQ, contact | Formspree | — |
| **Core vault** | Create, unlock, save, 33-gate, lockjaw | — | — |
| **Recovery** | Shamir 2-of-3 | — | — |
| **2FA / WebAuthn** | Full flow | — | — |
| **Password health** | Strength, breach check | — | — |
| **Import** | CSV, JSON (1P, LastPass, Chrome, Bitwarden) | — | — |
| **Audit** | Logs | Persistent DB | — |
| **DMS** | Config, check-in | Persistent DB | — |
| **Extension** | Chrome auto-fill | Store listing | — |
| **Mobile** | React Native app | Build & publish | — |
| **Payments** | — | Stripe | — |
| **Enterprise** | — | — | SSO, compliance, on-prem |

---

*Last updated: Feb 2026*

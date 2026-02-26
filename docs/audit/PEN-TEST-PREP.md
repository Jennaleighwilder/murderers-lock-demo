# Pen Test Engagement Prep

**Purpose:** Prepare for external penetration test engagement.

---

## 1. Scope

| Item | Value |
|------|-------|
| Target | Production URL |

### In-Scope (request these tests)

- API auth flows (password, device token, session token)
- WebAuthn registration + auth + token binding
- Challenge replay/race attempts
- Rate limit evasion / distributed attempts
- Device registration proof bypass
- CSP bypass attempts + XSS search
- Vault unlock downgrade attempts (password-only when passkeys required)
- Recovery flows (Shamir / lockjaw)

### Out-of-Scope (unless paid extra)

- Mobile reverse engineering
- Physical device compromise
- Full cloud infrastructure review (unless enterprise tier)
- Client-side malware (keyloggers, screen capture)
- DDoS / social engineering

---

## 2. Attack Surface

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| /api/unlock-vault | POST | Password + optional device/WebAuthn | Rate limited |
| /api/webauthn/register/options | POST | deviceRegistrationToken | Requires token |
| /api/webauthn/auth/options | POST | None | Vault ID |
| /api/webauthn/auth/verify | POST | Assertion | Returns webauthnSessionToken |
| /api/device-register | POST | deviceRegistrationToken | Requires token |
| /api/recover-vault | POST | Shards | Session token |
| /api/device-challenge | POST | None | Vault ID |

---

## 3. Test Accounts

- Provide staging credentials if needed
- Vault with passkeys for WebAuthn tests
- Vault without passkeys for downgrade test

---

## 4. Expected Behaviors

| Attack | Expected |
|--------|----------|
| Registration without token | 403 |
| Replay WebAuthn assertion | 400/401 |
| Counter rollback | 401 |
| Password-only when passkeys | 403 webauthnRequired |
| Rate limit bypass | 429 |
| Production + no Supabase | 429 (fail closed) |

---

## 5. Evidence to Deliver

- Red-team report (`artifacts/redteam/redteam-report.json`)
- Invariant test output
- Architecture docs
- Threat model

---

## 6. Contact

- Technical lead for scope questions
- Timeline for findings delivery
- Remediation SLA

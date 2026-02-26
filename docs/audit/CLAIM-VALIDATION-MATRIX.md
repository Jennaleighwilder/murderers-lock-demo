# Claim Validation Matrix

**Purpose:** Security claim → mechanism → test → evidence. Audit-ready.

| Claim | Mechanism | Test | Evidence |
|-------|-----------|------|----------|
| Argon2id memoryCost 65536, timeCost 3 | `lib/recovery.js` ARGON2_OPTIONS | `test/core-invariants` | Frozen params |
| AES-256-GCM only | `lib/recovery.js` createCipheriv | `test/core-invariants` | aes-256-gcm check |
| Device registration requires token | `deviceRegistrationToken` consume | `attack_device_register_without_token` | 403 |
| WebAuthn challenge single-use | `consume_webauthn_challenge` RPC | Replay test | FOR UPDATE SKIP LOCKED |
| WebAuthn counter monotonicity | `newCounter <= cred.counter` reject | `webauthn-auth.spec` counter rollback test | 401 |
| No downgrade when passkeys | `webauthnRequired` when hasCredentials | `attack_webauthn_no_downgrade` | 403 |
| Rate limit fail-closed | `IS_PRODUCTION` + !hasSupabase → deny | `test/fail-closed-invariants` | allowed: false |
| WebAuthn origin/RP ID locked in prod | `WEBAUTHN_EXPECTED_ORIGIN`, `WEBAUTHN_EXPECTED_RP_ID` | `test/webauthn-origin-invariants` | No localhost |
| Replay protection | Challenge consume before verify | `webauthn-auth.spec` replay test | 400/401 |
| CSP no inline scripts | `vercel.json` script-src 'self' | `verify:prod-security` | No unsafe-inline |

---

## Test Commands

```bash
npm test                                    # All invariants
npm run test:redteam                        # Red-team (lite/full)
npm run test:webauthn                       # WebAuthn E2E
npm run verify:prod-security                # CSP
```

---

## Evidence Paths

| Category | Path |
|----------|------|
| Crypto | `lib/recovery.js`, `docs/CRYPTOGRAPHIC-SPECIFICATION.md` |
| WebAuthn | `api/webauthn-vault.js`, `lib/webauthn-vault-store.js` |
| Rate limit | `api/rate-limit-store.js` |
| Red-team | `artifacts/redteam/` |

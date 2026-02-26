# Audit-Ready Claims Table

**Purpose:** Claim → mechanism → test → evidence. Enables fast verification by auditors and investors.

| Claim | Mechanism | Test | Evidence |
|-------|------------|------|----------|
| Vault access requires password + registered device (when enabled) | Device binding in unlock-vault; devices table; ECDSA or WebAuthn | `test:security` device flow | `api/unlock-vault.js` L204–252 |
| Device signatures verified against server-issued, single-use challenges | `/api/device-challenge`; `consume_device_challenge` RPC; hash-only storage | `test/core-invariants`; replay test | `api/device-challenge.js`, `lib/device-challenge-store.js` |
| Replay prevented by one-time challenge consumption | Atomic UPDATE with FOR UPDATE SKIP LOCKED; used=true | Concurrency test (20 reqs → 1 consumes) | `supabase/migrations/...device_challenges.sql` |
| Rate limiting: per-IP + global, atomic | `rate_limits` table; `increment_rate_limit` RPC | Rate-limit test | `api/rate-limit-store.js`, `supabase/migrations/...rate_limits.sql` |
| Rate limiting fails closed in production | `NODE_ENV=production` → deny when Supabase unavailable | `test/core-invariants` | `api/rate-limit-store.js` L127–130 |
| Registration requires proof of unlock | `deviceRegistrationToken` from unlock; 5min TTL; single-use | Registration-without-token → 403 | `api/device-register.js`, `api/device-registration-sessions.js` |
| KDF selection server-controlled (when vault in DB) | `kdf_type` column; server selects path | kdf_type mismatch → reject | `docs/ELITE-AUDIT-CHECKLIST.md` §5 |
| Zero-knowledge preserved | Server never sees plaintext or keys | Architecture review | `docs/WHITEPAPER.md`, `lib/recovery.js` |
| Argon2id memory-hard | m=65536, t=3, p=4 | `npm run measure:argon2` | `lib/recovery.js`, `docs/CRYPTO-SPEC.md` |
| Lockjaw at 33 failures | `MURDER_THRESHOLD`; Shamir recovery only | Murder count test | `api/unlock-vault.js` |
| Cryptographically registered device (software-backed) | ECDSA P-256 + IndexedDB JWK | Device auth flow | `app/js/device-keys.js` |
| Hardware-backed device auth (WebAuthn passkeys) | webauthn_credentials per vault; webauthnSessionToken | `test/webauthn-invariants` | `api/webauthn-vault.js`, `lib/webauthn-vault-store.js` |
| WebAuthn challenge single-use, atomic | consume_webauthn_challenge RPC; FOR UPDATE SKIP LOCKED | Replay test | `supabase/migrations/...webauthn_vault.sql` |
| WebAuthn counter monotonicity | Reject newCounter ≤ stored when counter > 0 | Counter rollback test | `api/webauthn-vault.js` L196–197 |
| No "hardware-backed" claim without WebAuthn | Doc review | `test/core-invariants` | `docs/WHITEPAPER.md`, `docs/ELITE-AUDIT-CHECKLIST.md` |

---

## Security Tests to Run

```bash
npm run test              # Validation + API
node test/core-invariants.test.js   # Armored core
npm run test:security     # Security suite (server required)
```

---

## Evidence File Locations

| Category | Path |
|----------|------|
| Crypto spec | `docs/CRYPTO-SPEC.md` |
| Threat model | `docs/THREAT-MODEL.md` |
| Architecture | `docs/WHITEPAPER.md` |
| Device binding | `docs/ELITE-DEVICE-BINDING.md`, `docs/ELITE-AUDIT-CHECKLIST.md` |
| Migrations | `supabase/migrations/` |

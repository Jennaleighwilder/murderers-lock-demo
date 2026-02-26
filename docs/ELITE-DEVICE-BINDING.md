# Elite Device Binding — Implementation Summary

This document summarizes the elite-grade device binding upgrades implemented per the build plan.

---

## Layer 1 — Server-Issued One-Time Challenge (Replay-Proof)

**Status:** ✅ Implemented

- **`device_challenges` table:** Stores only `challenge_hash` (SHA-256); raw challenge never persisted
- **`/api/device-challenge`:** Issues 32-byte random challenge, expires in 60 seconds
- **Unlock flow:** Client fetches challenge → signs with device key → server verifies signature, consumes challenge (marks used)
- **Replay impossible:** Each challenge single-use; expired challenges rejected

**Files:** `supabase/migrations/20260227000000_device_challenges.sql`, `api/device-challenge.js`, `lib/device-challenge-store.js`

---

## Layer 2 — IndexedDB Key Storage (No sessionStorage)

**Status:** ✅ Implemented

- **Storage:** Device keys in IndexedDB (`ml_device_keys`), JWK format
- **Private key:** Never exported as base64; stored as JWK, re-imported for signing
- **Public key:** Exported SPKI (base64) only for server registration

**Files:** `app/js/device-keys.js`

---

## Layer 3 — Lock Down Device Registration

**Status:** ✅ Implemented

- **`device_registration_tokens` table:** Proof of recent unlock; 5-minute TTL
- **Unlock returns `deviceRegistrationToken`:** Required for device-register when vault has key-based devices (or for first device)
- **device-register:** Requires `deviceRegistrationToken` for all key-based registrations
- **Flow:** Unlock → get token → register device (auto on success, or from settings)

**Files:** `api/device-registration-sessions.js`, `supabase/migrations/20260227000001_device_registration_tokens.sql`, `api/device-register.js`

---

## Layer 4 — Supabase-Backed Rate Limiting

**Status:** ✅ Implemented

- **Production:** In-memory fallback disabled; `NODE_ENV=production` without Supabase → fail closed
- **Dev override:** `ALLOW_INMEMORY_RATELIMIT=true` for local testing
- **`rate_limits` table:** `key`, `window_start`, `count`
- **Keys:** `ip:<ip>:<hour>`, `global:<hour>`
- **Atomic increment:** `increment_rate_limit` SQL function (INSERT ON CONFLICT DO UPDATE)
- **Fallback:** In-memory when Supabase not configured

**Files:** `supabase/migrations/20260227000002_rate_limits.sql`, `api/rate-limit-store.js`

---

## Layer 5 — Explicit kdf_type

**Status:** ✅ Migration added

- **Migration:** Adds `kdf_type` column to `vaults` when table exists
- **Values:** `argon2id` (default), `33gate`
- **Usage:** When vault metadata in Supabase, select KDF from stored value; ignore client-provided timestamp for path selection

**Files:** `supabase/migrations/20260227000003_vault_kdf_type.sql`

---

## Layer 6 — WebAuthn (Final Form)

**Status:** ⏳ Deferred

- WebAuthn passkeys provide hardware-backed, non-exportable keys
- Existing WebAuthn flow can be extended for device binding
- See plan for `userVerification: "required"`, credential ID storage

---

## Layer 7 — Security Hardening Checklist

**Status:** Documented

| Item | Status |
|------|--------|
| CSP locked down (no unsafe-inline) | Partial — inline scripts in HTML |
| Strict CORS | `*` for API (configure for production) |
| HSTS | ✅ In vercel.json |
| SameSite=Strict cookies | N/A (no cookies for vault) |
| HTTP-only tokens | Session tokens in memory |
| VaultId entropy check (UUIDv4 min) | Recommended |
| Audit log tamper-evidence (hash chain) | Future |

---

## Audit & Schema Reference

See **`docs/ELITE-AUDIT-CHECKLIST.md`** for:
- Schema summary (challenge_hash, token binding)
- Consume query / race-condition handling
- Pre-ship checklist
- Security claims (defensible vs not)

---

## Migrations to Run

```bash
supabase db push
```

Or run each migration in Supabase SQL editor:

1. `20260227000000_device_challenges.sql`
2. `20260227000001_device_registration_tokens.sql`
3. `20260227000002_rate_limits.sql`
4. `20260227000003_vault_kdf_type.sql` (if vaults table exists)

---

## API Changes

| Endpoint | Change |
|----------|--------|
| `POST /api/device-challenge` | **New** — Returns one-time challenge |
| `POST /api/device-register` | Requires `deviceRegistrationToken` for key-based registration |
| `POST /api/unlock-vault` | Returns `deviceRegistrationToken` on success |

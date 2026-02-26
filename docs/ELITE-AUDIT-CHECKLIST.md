# Elite Device Binding — Audit Checklist & Schema Summary

**Purpose:** Pre-ship checklist and schema reference for red-team/auditor review.

---

## 1. Schema Summary for Sanity Check

### device_challenges (replay-proof)

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| vault_id | TEXT | Binds challenge to vault |
| challenge_hash | TEXT | SHA-256(raw_challenge) — raw never stored |
| expires_at | TIMESTAMPTZ | 60s TTL |
| used | BOOLEAN | Single-use; set true on consume |
| created_at | TIMESTAMPTZ | Audit |

**Consume flow (atomic):**
```sql
-- RPC: consume_device_challenge(p_vault_id, p_challenge_hash)
-- Uses FOR UPDATE SKIP LOCKED to prevent race
WITH target AS (
  SELECT id FROM device_challenges
  WHERE vault_id = p_vault_id AND challenge_hash = p_challenge_hash
    AND used = FALSE AND expires_at > now()
  LIMIT 1
  FOR UPDATE SKIP LOCKED
),
updated AS (
  UPDATE device_challenges SET used = TRUE
  WHERE id IN (SELECT id FROM target)
  RETURNING 1
)
SELECT (SELECT count(*) FROM updated) > 0;
```

**Replay edge cases:**
- Same challenge twice: both SELECT; first UPDATE wins; second gets 0 rows → false
- Expired challenge: `expires_at > now()` filter rejects
- Wrong vault: `vault_id` filter rejects

---

### device_registration_tokens (proof of unlock)

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| token | TEXT | Unique random token |
| vault_id | TEXT | **Binds token to vault** |
| expires_at | TIMESTAMPTZ | 5min TTL |
| created_at | TIMESTAMPTZ | Audit |

**Consume flow:**
```javascript
// SELECT by token + vault_id
// DELETE on consume (single-use)
```

**Token binding:**
- Token bound to `vault_id` — consume requires matching vaultId in request
- Single-use: row deleted on consume
- TTL: 5 minutes

**Issuance condition:**
- Only issued **after** successful password validation
- Only issued **after** 2FA check (if enabled)
- Only issued **after** lockjaw/throttle checks passed
- Location: `unlock-vault.js` success path, after `auditStore.append`

---

## 2. Pre-Ship Checklist

| Item | Status |
|------|--------|
| Rate limiting: production must NOT fall back to in-memory | ✅ `NODE_ENV=production` + no `ALLOW_INMEMORY_RATELIMIT` → fail closed |
| Rate limit: atomic increment | ✅ `INSERT ON CONFLICT DO UPDATE` in `increment_rate_limit` |
| Rate limit keys | ✅ `ip:<ip>:<hour>`, `global:<hour>` |
| Challenges consumed atomically (single-use) | ✅ `consume_device_challenge` RPC with FOR UPDATE SKIP LOCKED |
| Registration tokens: bound to vault + TTL + single-use | ✅ vault_id, delete on consume, 5min |
| Registration token entropy | ✅ 32 bytes (256 bits) via `crypto.randomBytes(32)` |
| kdf_type: server-side, mismatches rejected | ⚠️ **Gap:** Client-provided `timestamp` currently selects path. Enforce when vault metadata in Supabase. |
| Marketing: "cryptographically registered device" not "hardware-backed" | ✅ Until WebAuthn |

---

## 3. Security Claims (Defensible Today)

✅ **Claim:**
- "Vault access requires password + a registered device (when enabled)."
- "Device signatures are verified against **server-issued**, **single-use** challenges."
- "Replay is prevented by one-time challenge consumption."
- "Rate limiting includes per-IP and global limits with atomic store."
- "Zero-knowledge preserved."

⚠️ **Do not claim until WebAuthn:**
- "Hardware-backed keys"
- "Non-exportable device private keys"
- "Phishing-resistant authentication"

---

## 4. Known Limitations (IndexedDB + JWK)

- **JWK storage:** Private key is still extractable (XSS = key theft)
- **Not hardware-bound:** Device key is software-only
- **Elite path:** WebAuthn passkeys for non-exportable, hardware-backed keys

---

## 5. kdf_type Gap (Current State)

**Today:** Unlock uses client-provided `timestamp` to choose path:
- `if (timestamp && salt)` → 33-gate
- else → Argon2id

**Elite target:** When vault metadata exists in Supabase:
```js
const kdfType = vault.kdf_type ?? (timestamp ? '33gate' : 'argon2id');
if (kdfType === 'argon2id') useArgon2();
else if (kdfType === '33gate') use33Gate();
else return 400;
// Reject: timestamp sent for argon2id vault, or missing for 33gate vault
```

---

## 6. Production Config

```bash
# Required for production rate limiting
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Production: must NOT use in-memory rate limit
NODE_ENV=production

# Dev override (only for local testing without Supabase)
# ALLOW_INMEMORY_RATELIMIT=true
```

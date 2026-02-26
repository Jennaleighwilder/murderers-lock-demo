# Security Comparison & Fix Plan

## Research Summary

### Industry Standards (OWASP, 1Password, Bitwarden, LastPass)

| Aspect | OWASP / Industry | 1Password | Bitwarden | Our System |
|--------|------------------|-----------|-----------|------------|
| **Lockout threshold** | 3–5 failed attempts | Not public | Not public | **3** ✓ |
| **Unlock method** | Time-based (10–15 min) OR self-service OR admin | Secret Key + password | Master password | **Shamir 2-of-3** ✓ |
| **Key derivation** | Argon2id recommended | 2SKD (Secret Key + password) | PBKDF2 SHA-256 | **Argon2id 64MB** ✓ (stronger than Bitwarden) |
| **Encryption** | AES-256-GCM | AES-256-GCM | AES-256 | **AES-256-GCM** ✓ |
| **Zero-knowledge** | Provider cannot decrypt | Yes – client decrypts | Yes – client decrypts | **NO** ❌ |
| **Password on server** | Never | Never | Never | **Yes – sent to API** ❌ |
| **Timing attack mitigation** | Constant-time on failure | Yes | Yes | **5s constant delay** ✓ |
| **Recovery** | Secure, one-time | Account recovery key | Email recovery | **Shamir shards, token not password** ✓ |

---

## Where We Are Better

1. **Lockout at 3** – Meets OWASP (3–5). Stricter than many systems.
2. **Argon2id vs PBKDF2** – Argon2id is memory-hard and stronger than Bitwarden’s PBKDF2.
3. **Shamir recovery** – No password in recovery response; one-time session token only.
4. **Constant-time delay** – 5s on wrong password reduces timing attacks.
5. **2FA** – TOTP and WebAuthn supported.
6. **Nanosecond Lock** – Unique timestamp per lock; different ciphertext each time.

---

## Critical Gap: Not Zero-Knowledge

**Problem:** The client sends the master password to `/api/unlock-vault`. The server decrypts and returns plaintext. The server sees the password and decrypted contents.

**1Password / Bitwarden:** Key derivation and decryption happen in the client. The server only stores and serves ciphertext. It never sees the password or plaintext.

**Impact:** If the server is compromised (breach, subpoena, insider), an attacker can:
- Capture passwords in transit (if TLS is broken)
- Log passwords in server memory
- Decrypt all vaults if they obtain stored data and intercept future unlocks

---

## Fix Plan: Move to Client-Side Decryption

### Option A: Full Zero-Knowledge (Preferred)

**Goal:** Server never sees password or plaintext.

1. **Client-side unlock**
   - Use `nanosecond-lock-production.js` or `recovery.js` logic in the browser.
   - Derive key from password + salt in the client.
   - Decrypt `encryptedData` with `iv` in the client.
   - Server only serves: `{ salt, encryptedData, iv, timestamp }` (no password).

2. **Server role**
   - `GET /api/vault-metadata?vaultId=X` – return encrypted blob + salt + iv (no decryption).
   - `POST /api/audit-log` – log unlock attempts by vaultId only (no password, no plaintext).
   - Lockjaw/rate limit: server tracks failed attempts by vaultId. Client sends a proof of failed decrypt (e.g. hash of attempt) or the client just stops after N failures and asks for recovery.

3. **Lockjaw with zero-knowledge**
   - Client tracks failed attempts locally (e.g. `localStorage` or similar).
   - After 3 failures, client blocks further attempts and shows “Use Shamir recovery.”
   - Server does not need to verify the password to enforce lockjaw; it only needs to know that the client has given up.

4. **Recovery flow**
   - Client sends shards to `POST /api/recover-vault`.
   - Server reconstructs password from shards, decrypts, creates one-time token, returns token (not password).
   - Client uses token to fetch contents.
   - **Caveat:** During recovery, the server briefly has the password and plaintext. This is a known trade-off for recovery; the alternative is “no recovery.”

### Option B: Hybrid (Faster to Implement)

Keep server-side decryption but reduce exposure:

1. **TLS and transport**
   - Enforce TLS 1.3.
   - Add certificate pinning for mobile apps.

2. **Server-side handling**
   - Never log passwords.
   - Clear password from memory as soon as decryption is done.
   - Use a short-lived, scoped decryption function that does not retain the password.

3. **Lockjaw**
   - Same as today: server tracks attempts and enforces lockjaw.

4. **Documentation**
   - Clearly state: “Server-assisted decryption. Not zero-knowledge. Use only with trusted deployment.”

---

## Other Gaps

### 1. In-Memory State (shared-unlock-store.js)

**Problem:** `murderCount` and `attempts` live in a `Map`. Server restart clears them. Multiple instances do not share state.

**Fix:**
- Persist to Redis or DB keyed by vaultId.
- Or accept that restarts reset lockjaw (weaker, but simpler).

### 2. SECURITY-ARMOR.md Out of Date

- Still says “33 failures → lockjaw” (should be 3).
- Does not mention zero-knowledge gap.

---

## Recommendation

**Short term (1–2 days):**
1. Update SECURITY-ARMOR.md (lockjaw = 3, document server-side decryption).
2. Add a clear “Architecture” section: server-assisted decryption, not zero-knowledge.

**Medium term (1–2 weeks):**
1. Implement Option A (client-side decryption) for the main unlock path.
2. Keep server-side decryption only for the recovery flow (with clear documentation).
3. Add Redis or similar for lockjaw state if you need persistence across restarts.

**Long term:**
1. Consider client-side recovery (e.g. combine shards in the browser, decrypt there) so the server never sees the password or plaintext, even during recovery.

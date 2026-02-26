# The Murderer's Lock — Technical Whitepaper v0.9

**Document purpose:** Technical overview of architecture, cryptography, threat model, and attack resistance for The Murderer's Lock security vault.

**Version:** 0.9 (draft)  
**Last updated:** February 2026

---

## 1. Executive Summary

The Murderer's Lock is a quantum-resistant (symmetric) security vault for high-value digital assets: cryptocurrency seeds, API keys, legal documents, and intellectual property. It combines server-side encryption (Argon2id + AES-256-GCM), Shamir 2-of-3 recovery, and a unique 33-gate mechanism that triggers lockjaw—permanent lock until Shamir recovery—after failed unlock attempts.

**Key differentiators:**
- **Lockjaw:** 33 failed attempts → vault locked; recovery via Shamir only
- **Dual KDF paths:** Argon2id (memory-hard) and 33-gate Nanosecond Lock (timestamp-bound)
- **Device binding:** Cryptographic ECDSA P-256 device keys (when Supabase configured)
- **Graduated response:** Slow mode → email recovery → full lockdown
- **Panic code:** Fake success + silent alarm under coercion

---

## 1.1 Core Guarantees (Armored Core — Must Never Regress)

These invariants are locked. CI fails if they change. See `test/core-invariants.test.js`.

| Guarantee | Mechanism | Test |
|-----------|-----------|------|
| Argon2id vault path stays memory-hard | m=65536, t=3, p=4 in lib/recovery.js | `measure:argon2` output |
| kdf_type is server-chosen | Server selects from vault metadata; reject mismatches | Enforced when vault in Supabase |
| Device challenges are server-issued, single-use, atomic | `/api/device-challenge` + `consume_device_challenge` RPC | Replay/concurrency tests |
| Registration requires proof | `deviceRegistrationToken` from unlock only | Registration-without-token denied |
| Rate limiting fails closed in production | `NODE_ENV=production` → no in-memory fallback | Fail-closed test |
| WebAuthn passkeys: hardware-backed when enabled | webauthn_credentials per vault; webauthnSessionToken for unlock | `test/webauthn-invariants` |
| Marketing: hardware-backed via WebAuthn | ECDSA = legacy software; WebAuthn = hardware-backed | Doc review |

---

## 2. Architecture Overview

### 2.1 System Components

```
┌─────────────────┐     HTTPS      ┌─────────────────┐     ┌─────────────────┐
│  Client (Web)   │ ◄────────────► │  API (Vercel)   │ ◄──►│  Supabase       │
│  - Vault UI     │                │  - unlock-vault │     │  - vaults       │
│  - device-keys  │                │  - create-vault │     │  - devices      │
│  - sessionStorage│               │  - rate-limit    │     │  - audit        │
└─────────────────┘                └─────────────────┘     └─────────────────┘
```

- **Client:** Vanilla JS, no framework. Device keys in sessionStorage (IndexedDB recommended for production).
- **API:** Node.js serverless (Vercel). Stateless; rate limit and unlock state in memory or Supabase.
- **Storage:** Supabase (PostgreSQL) for vaults, devices, audit when configured; in-memory fallback for demo.

### 2.2 Data Flow

**Create vault:** Password → Argon2id KDF → 256-bit key → AES-256-GCM encrypt → Shamir 2-of-3 shards → store encrypted blob + metadata.

**Unlock vault:** Password + (optional) device auth → KDF verify → 33-gate check → AES decrypt → return contents + one-time session token.

**Save vault:** Session token + plaintext → verify token → encrypt → store.

---

## 3. Cryptography

### 3.1 Primary Path — Argon2id + AES-256-GCM

| Parameter    | Value   | Purpose                          |
|-------------|---------|-----------------------------------|
| Algorithm   | Argon2id| Memory-hard; GPU-resistant        |
| memoryCost  | 65536   | 64 MiB total                      |
| timeCost    | 3       | Iterations                        |
| parallelism | 4       | Lanes                             |
| Salt        | 32 bytes| Unique per vault                  |
| IV          | 16 bytes| Unique per encryption             |

**Brute-force cost:** Run `npm run measure:argon2` for hardware-specific attempts/sec. At ~10 attempts/sec, 12-char alphanumeric ≈ 10^22 years.

### 3.2 33-Gate Path — Nanosecond Lock

Alternative KDF for timestamp-bound vaults:

1. **Seed:** `SHA256(password || salt || timestamp)`
2. **33 Gates:** `gate[i] = HMAC-SHA256(seed, "gate-{i}")` for i = 0..32
3. **Witch Order:** Fisher-Yates shuffle from HMAC-derived randomness
4. **Combine:** `masterKey = XOR(gate[order[0]], ..., gate[order[32]])`
5. **Encrypt:** AES-256-GCM(masterKey, plaintext)

Ciphertext is bound to the KDF used at creation; no downgrade between paths.

### 3.3 Quantum Resistance

- **Symmetric (AES-256):** Grover's algorithm halves effective key space to 128 bits; still infeasible.
- **Asymmetric (ECDSA P-256):** Not post-quantum; Shor's algorithm breaks it. Device keys are for binding, not long-term confidentiality.
- **Post-quantum migration:** NIST PQC planned Q4 2026.

---

## 4. Threat Model

### 4.1 Assets

| Asset           | Sensitivity |
|-----------------|-------------|
| Vault plaintext | Critical    |
| Master key      | Critical (never stored) |
| Shamir shards   | Critical    |
| Session tokens  | High        |
| Audit logs      | Medium      |

### 4.2 Attackers

| Attacker           | Capability                    | Mitigation                    |
|--------------------|-------------------------------|-------------------------------|
| Remote brute-force | Distributed attempts          | Rate limit, lockjaw           |
| Credential thief   | Stolen password, no device    | Device binding                |
| Device thief       | Physical access to device     | Password still required       |
| Coerced user       | Forced to unlock              | Panic code                    |
| Insider            | Server/DB access              | Zero-knowledge; server never sees plaintext |
| MITM               | Intercept traffic             | TLS only                      |

### 4.3 Controls

| Control        | Implementation                                      |
|----------------|-----------------------------------------------------|
| Argon2id KDF   | m=64 MiB, t=3, p=4                                  |
| Rate limiting  | 10/vault/hr; 50/IP/hr; 500 global/hr               |
| Lockjaw        | 33 failures → Shamir recovery only                 |
| Device binding | ECDSA P-256 key + challenge signature; fingerprint fallback |
| Panic code     | Fake success + silent alarm                         |
| Constant-time  | Sleep on failure; no early exit                     |

---

## 5. Attack Resistance

### 5.1 Brute Force

- **Online:** Per-vault, per-IP, and global rate limits. Lockjaw at 33 attempts.
- **Offline:** Argon2id memory-hard; ~10 attempts/sec for 12-char password on typical hardware.
- **Distributed:** Per-IP limits cap single-actor throughput; global cap limits total load.

### 5.2 Credential Theft

- **Device binding:** When enabled, unlock requires trusted device (fingerprint or cryptographic key).
- **Device keys:** ECDSA P-256; server-issued one-time challenges; IndexedDB (JWK). Software-backed; WebAuthn adds hardware option.

### 5.3 Coercion

- **Panic code:** Returns fake success; triggers silent alarm. Attacker sees decoy contents.

### 5.4 Insider / Server Compromise

- **Zero-knowledge:** Server stores encrypted blobs only. No plaintext, no keys.
- **Key derivation:** Client or server derives key from password; key never persisted.

### 5.5 Timing Oracles

- **Constant-time:** Sleep on failure; no early exit. Prevents timing-based password enumeration.

---

## 6. Graduated Lockjaw

| Stage        | Failures | Duration        | Behavior                    |
|--------------|----------|-----------------|-----------------------------|
| Slow mode    | 10       | 15 min          | 1 attempt per 5 min         |
| Email recovery| 20      | 24 hr           | Shamir recovery only        |
| Full lockdown| 33       | 7 days          | Shamir recovery only        |

Production threshold configurable via `MURDER_THRESHOLD` (default 3 for demo).

---

## 7. Device Binding

### 7.1 Modes

- **Legacy:** Fingerprint (hash of user-agent, screen, timezone). Spoofable.
- **Cryptographic:** ECDSA P-256 keypair; challenge-response. Preferred.

### 7.2 Flow (ECDSA — Software-Backed)

1. Client generates keypair; stores private key in IndexedDB (JWK).
2. On unlock: fetch challenge from `/api/device-challenge`; sign with private key; send `devicePublicKey`, `deviceChallenge`, `deviceSignature`.
3. Server verifies signature; consumes challenge (atomic, single-use); checks device in trusted list.
4. Registration requires `deviceRegistrationToken` from recent unlock.

### 7.3 Migration

See `docs/DEVICE-KEY-MIGRATION.md` for Supabase schema.

---

## 8. Residual Risk & Out of Scope

| Risk                    | Mitigation                          |
|-------------------------|-------------------------------------|
| Weak password           | Strength meter; Argon2id cost       |
| Device fingerprint spoof| Use cryptographic device keys       |
| Keyloggers              | User responsibility; out of scope   |

**Out of scope:** Malware on client; physical key extraction; social engineering of shard holders; post-quantum (NIST PQC not yet integrated).

---

## 9. References

- `docs/CRYPTO-SPEC.md` — Full cryptographic specification
- `docs/THREAT-MODEL.md` — Detailed threat model
- `docs/DEVICE-KEY-MIGRATION.md` — Device key schema
- `INVESTOR-SPECS.md` — Product readiness and feature inventory

---

*The Murderer's Lock — Because some secrets should never be taken.*

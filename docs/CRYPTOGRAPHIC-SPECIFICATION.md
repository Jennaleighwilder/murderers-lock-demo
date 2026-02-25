# Cryptographic Specification

**The Murderer's Lock** — Vault Manager  
**Version:** 1.0  
**Last Updated:** 2025

This document describes the cryptographic design of the vault system. It is intended for security auditors, researchers, and users who want to verify the implementation.

---

## 1. Overview

The system uses **server-side encryption** with industry-standard algorithms:

- **Password hashing:** Argon2id
- **Vault encryption:** AES-256-GCM
- **Recovery:** Shamir Secret Sharing (2-of-3 threshold)
- **Shard protection (client):** PBKDF2 + AES-256-GCM

**Important:** This is not zero-knowledge. The server performs key derivation and decryption. Passwords and plaintext are never stored; they exist only in memory during API processing.

---

## 2. Vault Creation & Encryption

### 2.1 Key Derivation (Argon2id)

| Parameter | Value |
|----------|-------|
| Algorithm | Argon2id |
| Memory cost | 65,536 KiB |
| Time cost | 3 iterations |
| Hash length | 32 bytes |
| Salt | 32 bytes, cryptographically random |

The password is hashed with Argon2id to produce a 256-bit encryption key. The salt is stored with the vault (hex-encoded).

### 2.2 Vault Encryption (AES-256-GCM)

| Parameter | Value |
|----------|-------|
| Algorithm | AES-256-GCM |
| Key size | 256 bits |
| IV/nonce | 16 bytes, random per encryption |
| Auth tag | 16 bytes (appended to ciphertext) |

Plaintext format: `JSON.stringify({ secrets: string })`  
Ciphertext: Base64-encoded (encrypted payload + auth tag)

### 2.3 Shamir Secret Sharing

| Parameter | Value |
|----------|-------|
| Secret | Vault password (UTF-8) |
| Shares | 3 |
| Threshold | 2 |

The password is split into 3 shards. Any 2 shards can reconstruct the password. Shards are hex-encoded.

---

## 3. Shard Protection (Client-Side)

Shards may be stored in `localStorage` encrypted with a user PIN.

### 3.1 PIN Key Derivation (PBKDF2)

| Parameter | Value |
|----------|-------|
| Algorithm | PBKDF2-HMAC-SHA256 |
| Iterations | 100,000 |
| Salt | 32 bytes, stored in `vault_shard_pin_config` |
| Key length | 256 bits |

### 3.2 Shard Encryption (AES-256-GCM)

| Parameter | Value |
|----------|-------|
| Algorithm | AES-256-GCM |
| IV | 12 bytes per shard |
| Format | `[{ iv, enc }, ...]` per shard |

Each shard is encrypted separately. Encrypted shards are stored in `vault_shards_{vaultId}`.

---

## 4. Rate Limiting & Timing

### 4.1 Unlock API (`/api/unlock-vault`)

| Limit | Value |
|-------|-------|
| Attempts per vault | 10 per hour |
| Murder threshold | 33 failures → lockjaw |
| Constant-time on failure | 5 seconds |
| Session token path | No rate limit (one-time use) |

### 4.2 Recovery API (`/api/recover-vault`)

| Limit | Value |
|-------|-------|
| Per IP | 10 attempts per hour |
| Per vault | 5 attempts per hour |
| Block duration | 24 hours |
| Constant-time on failure | 5 seconds |

### 4.3 Session Tokens

Recovery returns `{ sessionToken, vaultId }` only. The password and vault contents are never in the HTTP response. The client exchanges the token for contents via `/api/unlock-vault`.

---

## 5. Data Flow

### 5.1 Create Vault

1. Client sends `{ name, password }` to `/api/create-vault`
2. Server: Argon2id(password, salt) → key
3. Server: AES-256-GCM encrypt `{ secrets: "" }` → encryptedData, iv
4. Server: Shamir split(password) → 3 shards
5. Response: `{ vaultId, salt, encryptedData, iv, shards }`
6. Client stores shards (optionally PIN-encrypted)

### 5.2 Unlock Vault

1. Client sends `{ password, salt, encryptedData, iv, vaultId }` to `/api/unlock-vault`
2. Server: Argon2id(password, salt) → key
3. Server: AES-256-GCM decrypt → contents
4. Response: `{ contents }` (or session token path for recovery)

### 5.3 Recover Vault

1. Client sends `{ shards: [s1, s2], vaultId, salt, encryptedData, iv }` to `/api/recover-vault`
2. Server: Shamir combine(s1, s2) → password
3. Server: unlockVault(password, ...) → contents
4. Server: create session token, store (contents, vaultId)
5. Response: `{ sessionToken, vaultId }` (no password or contents)
6. Client: POST `{ sessionToken, vaultId }` to `/api/unlock-vault` → contents

---

## 6. Libraries

| Component | Library |
|-----------|---------|
| Argon2id | `argon2` (Node.js) |
| AES-256-GCM | Node.js `crypto` |
| Shamir | `shamirs-secret-sharing` |
| PBKDF2 (client) | Web Crypto API |
| AES-GCM (client) | Web Crypto API |

---

## 7. Security Considerations

- **Server-side encryption:** The server has access to plaintext during processing. Deploy on trusted infrastructure.
- **Session tokens:** Short-lived (5 min), one-time use. Stored server-side.
- **Memory:** Best-effort zeroing on client (JavaScript strings are immutable).
- **Constant-time:** 5-second delay on auth failure to mitigate timing attacks.

---

## 8. Audit & Verification

To verify the implementation:

1. Inspect `lib/recovery.js` for Argon2id, AES-GCM, Shamir
2. Inspect `app/js/shard-protection.js` for PBKDF2, AES-GCM
3. Inspect `api/unlock-vault.js` and `api/recover-vault.js` for rate limits and session tokens
4. Use browser DevTools Network tab: passwords and contents should never appear in responses

---

*This specification is part of The Murderer's Lock vault system. For questions, open an issue or contact the maintainers.*

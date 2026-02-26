# Cryptographic Specification — The Murderer's Lock

This document covers both the primary vault path (Argon2id) and the 33-gate Nanosecond Lock path.

---

## Primary Vault Path — Argon2id + AES-256-GCM

**Location:** `lib/recovery.js`  
**Use:** Default vault creation; memory-hard key derivation.

### Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Algorithm | Argon2id | Hybrid; resistant to side-channel and GPU |
| memoryCost | 65536 | 64 MiB total (RFC 9106: m KiB) |
| timeCost | 3 | Iterations |
| parallelism | 4 | Default; lanes share memory |
| hashLength | 32 | 256-bit key |
| Salt | 32 bytes | Unique per vault |
| IV | 16 bytes | Unique per encryption |

### Key Derivation

1. `key = Argon2id(password, salt, { m: 64MiB, t: 3, p: 4 })`
2. `ciphertext = AES-256-GCM(key, plaintext, iv)`

### Brute-Force Cost

Run `npm run measure:argon2` to get measured attempts/sec for your hardware.  
See `docs/THREAT-MODEL.md` for threat assumptions.

---

## 33-Gate KDF — Nanosecond Lock

The Nanosecond Lock uses a custom key derivation function: **33-round HMAC-SHA256 with nanosecond-timestamp permutation**.

## Overview

- **Input:** password + salt + timestamp (nanosecond-precision)
- **Output:** 256-bit master key for AES-256-GCM
- **Primitives:** SHA-256, HMAC-SHA256, XOR — all standard

## Derivation Steps

1. **Seed:** `SHA256(password || salt || timestamp)` → 32-byte seed
2. **33 Gates:** For i = 0..32: `gate[i] = HMAC-SHA256(seed, "gate-{i}")` → 33 × 32-byte outputs
3. **Witch Order:** Deterministic shuffle of [0..32] from `HMAC-SHA256(seed, "witch-shuffle-{i}")`
4. **Combine:** `masterKey = XOR(gate[order[0]], gate[order[1]], ..., gate[order[32]])`
5. **Encrypt:** AES-256-GCM(masterKey, plaintext)

## Witch Order

The shuffle is Fisher-Yates with HMAC-derived randomness. Wrong order → wrong XOR → wrong key → decryption fails. All 33 pieces in correct order are required.

## Security Properties

- **No new primitives:** HMAC-SHA256 and XOR are well-studied
- **Permutation as salt:** Witch order depends on password; different passwords → different order
- **Timestamp entropy:** Nanosecond + 4 random bytes per lock; key changes every lock
- **Auditability:** Spec is public; no security through obscurity

## Threat Model

- Resistant to brute force (rate limiting, lockjaw)
- Resistant to timing attacks (constant-time comparison, sleep)
- Not quantum-resistant (AES-256; Grover halves key space)

# Security Overview — The Murderer's Lock

**One-page audit narrative.** Read this first.

---

## What We Protect

| Asset | Sensitivity |
|-------|-------------|
| Vault plaintext (passwords, keys, seeds) | Critical |
| Master key (derived from password) | Critical |
| Shamir recovery shards | Critical |
| Session tokens | High |

---

## Trust Model

- **Client:** Assumed compromised for device theft; password entry assumed secure.
- **Server:** Performs KDF and decryption; never stores plaintext or keys.
- **Supabase:** Stores encrypted blobs, device public keys, rate limits; no key material.
- **Zero-knowledge boundary:** Server never sees plaintext; decryption happens server-side but plaintext returned only to authenticated client.

---

## Required Factors for Unlock

- **Password** (always)
- **Passkey (WebAuthn)** when vault has passkeys registered — no downgrade to password-only
- **Device binding** when vault has trusted devices — ECDSA or WebAuthn
- **2FA (TOTP)** when enabled

---

## Strongest Invariants

| Invariant | Value |
|-----------|-------|
| Argon2id | memoryCost 65536, timeCost 3 (frozen) |
| AES | 256-bit GCM only |
| Challenges | Single-use, atomic consume, hash-only storage |
| WebAuthn | userVerification required, counter monotonicity |
| Rate limit | Fail-closed in production (no in-memory fallback) |
| CSP | No inline scripts |

---

## Out of Scope

- Endpoint malware (keyloggers, screen capture)
- Physical device compromise
- Coercion beyond panic code
- Post-quantum attacks
- Social engineering of recovery shard holders
- Full cloud infrastructure review (unless enterprise tier)

---

## Evidence Location

| Item | Path |
|------|------|
| Audit pack | `docs/audit/` |
| Red-team artifacts | `artifacts/redteam/` |
| Audit bundle | `artifacts/audit/<timestamp>/` |
| Safe claims | `docs/audit/SAFE-CLAIMS.md` |
| Threat model | `docs/THREAT-MODEL.md` |
| Crypto spec | `docs/CRYPTOGRAPHIC-SPECIFICATION.md` |

---

## Reproducible Evidence

```bash
npm run audit:bundle
```

Produces timestamped artifact folder with MANIFEST, test results, and red-team report.

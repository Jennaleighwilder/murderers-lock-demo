# Threat Model — The Murderer's Lock

**Document purpose:** Define attackers, assets, controls, and residual risk for the vault system.

---

## 1. Assets

| Asset | Description | Sensitivity |
|-------|-------------|-------------|
| Vault plaintext | Passwords, API keys, legal docs, crypto seeds | Critical |
| Master key | Derived from password; never stored | Critical |
| Shamir shards | 2-of-3 recovery shares | Critical |
| Session tokens | One-time unlock tokens | High |
| Audit logs | Access events, metadata | Medium |

---

## 2. Attackers

| Attacker | Capability | Motivation |
|----------|------------|------------|
| **Remote brute-force** | Many attempts, distributed IPs | Steal vault contents |
| **Credential thief** | Stolen password, no device | Unlock vault |
| **Device thief** | Physical access to registered device | Unlock vault |
| **Coerced user** | User forced to unlock | Duress; panic code mitigates |
| **Insider** | Server/database access | Exfiltrate encrypted blobs |
| **Man-in-the-middle** | Intercept traffic | Replay, tamper |

---

## 3. Controls

| Control | Mitigates | Implementation |
|---------|-----------|----------------|
| Argon2id KDF | Brute-force (offline) | m=64 MiB, t=3, p=4 |
| Rate limiting | Brute-force (online) | 10/vault/hr; 50/IP/hr; 500 global/hr |
| Lockjaw | Brute-force (online) | 33 failures → Shamir recovery only |
| Device binding | Credential thief | Trusted device (fingerprint or cryptographic key) when enabled |
| Panic code | Coerced user | Fake success + silent alarm |
| Zero-knowledge | Insider | Server never sees plaintext or keys |
| TLS | MITM | HTTPS only |
| Constant-time | Timing oracle | Sleep on failure; no early exit |

---

## 4. Trust Boundaries

- **Client:** Assumed compromised for device theft; password entry assumed secure.
- **Server:** Trusted for rate limiting, lockjaw, device verification; does not see plaintext.
- **Supabase:** Stores encrypted blobs, device public keys, unlock state; no key material.

---

## 5. Residual Risk

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Weak password | Medium | High | Password strength meter; Argon2id cost |
| Device fingerprint spoof | Medium | Medium | Use cryptographic device keys (devicePublicKey + signature) |
| Distributed brute-force | Low | High | Per-IP + global rate limits |
| Keyloggers | Medium | High | Out of scope; user responsibility |

---

## 6. Out of Scope

- Malware on client
- Physical extraction of keys from Secure Enclave
- Social engineering of recovery shard holders
- Post-quantum attacks (no NIST PQC yet)

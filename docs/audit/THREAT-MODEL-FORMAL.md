# Threat Model — Formal Template

**Purpose:** Audit-grade threat model. Use for pen test scoping and investor due diligence.

---

## 1. Scope

| Item | Description |
|------|-------------|
| System | Vault Manager (The Murderer's Lock) |
| In scope | Unlock flow, device registration, WebAuthn, rate limiting, recovery |
| Out of scope | Client-side malware, physical key extraction, social engineering of shard holders |

---

## 2. Assets

| Asset | Sensitivity | Storage |
|-------|-------------|---------|
| Vault plaintext | Critical | Client only; never server |
| Master key | Critical | Derived per unlock; never stored |
| Shamir shards | Critical | Client localStorage; optional PIN encryption |
| Session tokens | High | Server; single-use, short TTL |
| WebAuthn credentials | High | Supabase; public key + counter only |

---

## 3. Attackers (STRIDE-style)

| Threat | Attacker | Mitigation |
|--------|----------|------------|
| Spoofing | Credential thief | Device binding, WebAuthn |
| Tampering | MITM | TLS, AEAD |
| Repudiation | User | Audit logs |
| Information disclosure | Insider | No plaintext on server |
| DoS | Brute-force | Rate limit, lockjaw |
| Elevation | N/A | No privilege model |

---

## 4. Trust Boundaries

```
[User] → [Client] → TLS → [API] → [Supabase]
         ↑                    ↑
    Assumed compromised   Trusted for storage
    for device theft      (encrypted blobs only)
```

---

## 5. Data Flow Diagram (Outline)

1. Unlock: password + optional device sig + optional WebAuthn → KDF → decrypt
2. Register device: deviceRegistrationToken (from unlock) → consume → store public key
3. WebAuthn auth: challenge → assertion → webauthnSessionToken → unlock

---

## 6. Residual Risk

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Weak password | Medium | High | Strength meter, Argon2id |
| XSS → key theft | Low | High | CSP, no inline scripts |
| Distributed brute-force | Low | High | Per-IP + global limits |
| Clone authenticator | Low | Medium | Counter rollback detection |

---

## 7. References

- `docs/THREAT-MODEL.md` — Full threat model
- `docs/CRYPTOGRAPHIC-SPECIFICATION.md` — Crypto spec
- `test/` — Invariant and red-team tests

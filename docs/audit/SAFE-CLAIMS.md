# Safe Claims — Investor & Legal Use

**Purpose:** Use only claims you can back with evidence. Avoid unsubstantiated certifications.

---

## ✅ Safe to Claim (with current evidence)

| Claim | Evidence |
|-------|----------|
| Zero-knowledge encrypted vault storage | Server never sees plaintext; decryption server-side, plaintext only to authenticated client |
| Passkey/WebAuthn device authentication supported | WebAuthn registration + auth flows; userVerification required |
| Replay-safe single-use challenges | Atomic consume, hash-only storage; invariant tests |
| Distributed rate limiting with fail-closed production behavior | `attack_prod_fail_closed_ratelimit`, `attack_rate_limit_distributed` |
| Independent audit/pentest: **scheduled** | Use until you have a formal report |

---

## ❌ Avoid Until Proven

| Claim | Why |
|-------|-----|
| SOC 2 certified | Requires formal audit and certification |
| HIPAA compliant | Requires BAA and compliance review |
| ISO 27001 certified | Requires certification body |
| Post-quantum secure | Not implemented; do not claim |

---

## Wording Guidance

- **Good:** "Zero-knowledge encrypted storage with passkey support"
- **Good:** "Replay-safe challenges; distributed rate limiting; fail-closed in production"
- **Good:** "Independent penetration test scheduled"
- **Bad:** "SOC 2 compliant" (unless certified)
- **Bad:** "Post-quantum resistant" (unless implemented)

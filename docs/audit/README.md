# Audit Prep Pack

**Purpose:** Formal security evidence package for external audit, pen test, and investor due diligence.

---

## Contents

| Document | Purpose |
|----------|---------|
| [SECURITY-WHITEPAPER-V1.md](./SECURITY-WHITEPAPER-V1.md) | Whitepaper structure |
| [THREAT-MODEL-FORMAL.md](./THREAT-MODEL-FORMAL.md) | Formal threat model template |
| [ARCHITECTURE-OUTLINE.md](./ARCHITECTURE-OUTLINE.md) | Architecture diagram outline |
| [CLAIM-VALIDATION-MATRIX.md](./CLAIM-VALIDATION-MATRIX.md) | Claim → mechanism → test |
| [EXTERNAL-AUDIT-CHECKLIST.md](./EXTERNAL-AUDIT-CHECKLIST.md) | Pre-audit checklist |
| [PEN-TEST-PREP.md](./PEN-TEST-PREP.md) | Pen test engagement prep |

---

## Quick Start

```bash
npm test              # All invariants
npm run test:redteam  # Red-team
npm run test:webauthn # WebAuthn E2E
```

---

## Related Docs

- `docs/THREAT-MODEL.md` — Full threat model
- `docs/CRYPTOGRAPHIC-SPECIFICATION.md` — Crypto spec
- `docs/AUDIT-CLAIMS-TABLE.md` — Legacy claims table

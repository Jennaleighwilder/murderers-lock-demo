# External Audit Checklist

**Purpose:** Pre-audit checklist for pen test or security review engagement.

---

## Pre-Engagement

- [ ] All invariant tests pass (`npm test`)
- [ ] Red-team suite passes (`npm run test:redteam`)
- [ ] WebAuthn E2E passes (`npm run test:webauthn`)
- [ ] CSP verified (`npm run verify:prod-security`)
- [ ] SBOM generated (`npm run sbom`)
- [ ] Threat model documented (`docs/THREAT-MODEL.md`)
- [ ] Claim matrix complete (`docs/audit/CLAIM-VALIDATION-MATRIX.md`)

---

## Scope Definition

- [ ] In scope: Unlock API, device registration, WebAuthn, rate limiting, recovery
- [ ] Out of scope: Client malware, physical extraction, social engineering
- [ ] Environment: Production URL (or staging with prod config)

---

## Evidence Package

- [ ] Architecture diagram
- [ ] Data flow diagrams
- [ ] Crypto spec
- [ ] Threat model
- [ ] Red-team artifacts (`artifacts/redteam/`)
- [ ] Test results (invariant, red-team, webauthn)

---

## Environment Variables (Production)

- [ ] `WEBAUTHN_EXPECTED_ORIGIN` set
- [ ] `WEBAUTHN_EXPECTED_RP_ID` set
- [ ] `SUPABASE_URL` configured
- [ ] `NODE_ENV=production` for deploy

---

## Known Limitations

- Server performs KDF and decryption (not zero-knowledge)
- Client assumed compromised for device theft
- No HSM; no FIPS validation
- Post-quantum not in scope

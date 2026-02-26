# Security Whitepaper v1.0 — Structure

**Status:** Draft structure for external audit  
**Last updated:** 2025

---

## 1. Executive Summary

- Product overview
- Security posture summary
- Key claims (one paragraph)
- Intended audience (custody, enterprise, pen test)

---

## 2. Architecture

- High-level diagram (client ↔ server ↔ Supabase)
- Trust boundaries
- Data flow (password → KDF → key → decrypt)
- No plaintext at rest on server

---

## 3. Cryptographic Specification

- Argon2id: memoryCost 65536, timeCost 3 (frozen)
- AES-256-GCM for vault encryption
- Shamir 2-of-3 recovery
- Reference: `docs/CRYPTOGRAPHIC-SPECIFICATION.md`

---

## 4. Authentication & Access Control

- Password + optional 2FA
- Device binding (ECDSA or WebAuthn passkeys)
- WebAuthn: userVerification required, counter monotonicity
- No downgrade when passkeys registered

---

## 5. Rate Limiting & Fail-Closed

- Per-vault, per-IP, global limits
- Production: Supabase required; no in-memory fallback
- Lockjaw at threshold

---

## 6. Threat Model Summary

- Assets, attackers, controls
- Residual risk
- Out of scope
- Reference: `docs/THREAT-MODEL.md`

---

## 7. Verification & Evidence

- Invariant tests (core, webauthn, fail-closed)
- Red-team suite
- WebAuthn E2E automation
- Claim-to-mechanism mapping: `docs/audit/CLAIM-VALIDATION-MATRIX.md`

---

## 8. Residual Risk Statement

- Formal acknowledgment of remaining risk
- Mitigations in place
- Acceptance criteria for audit

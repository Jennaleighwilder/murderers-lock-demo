# Phase 2 Advanced Features

**The Murderer's Lock** — Specification for future enhancements

---

## 1. Time-Locked Recovery

**Concept:** Recovery shards become valid only after a configurable delay (e.g., 7 days).

**Implementation approach:**
- Encrypt shards with a key derived from `timestamp + secret`
- Server stores `unlockAfter` (epoch ms) with encrypted shard metadata
- Recovery API rejects if `Date.now() < unlockAfter`
- Client: "Time-locked shard — unlocks in 6d 23h"

**Files to add:**
- `lib/time-lock.js` — encrypt/decrypt with time binding
- `api/create-vault.js` — accept `recoveryDelayDays` option
- `app/recovery.html` — show countdown for time-locked shards

---

## 2. Hardware Keys (WebAuthn / FIDO2)

**Concept:** Optional second factor: password + hardware key (YubiKey, Touch ID).

**Implementation approach:**
- WebAuthn API: `navigator.credentials.create()` for registration
- Store `credentialId` + `publicKey` with vault
- Unlock: `navigator.credentials.get()` with challenge from server
- Server verifies assertion; unlocks only if both password and assertion valid

**Files to add:**
- `app/js/webauthn-helper.js` — WebAuthn create/get wrappers
- `api/webauthn-register.js` — store credential
- `api/webauthn-verify.js` — verify assertion on unlock
- `app/vault.html` — optional "Use security key" flow

---

## 3. Quantum-Safe Hybrid

**Concept:** Add post-quantum KEM (e.g., Kyber) alongside AES-256-GCM.

**Implementation approach:**
- Hybrid: encrypt with AES key; wrap AES key with Kyber
- Store: `{ kyberCiphertext, aesEncryptedData }`
- Unlock: Kyber decrypt → AES key → decrypt data
- Backward compatible: existing vaults stay AES-only; new vaults get hybrid

**Files to add:**
- `lib/quantum-hybrid.js` — Kyber + AES hybrid
- `package.json` — add `@noble/kyber` or similar
- `api/create-vault.js` — optional `quantumSafe: true`

---

## 4. Threshold Encryption (Multi-Party)

**Concept:** Require 2 of 3 people to unlock (e.g., CEO + CFO + Legal).

**Implementation approach:**
- Split master key with Shamir; each party gets a shard
- Unlock: 2 parties submit shards; server combines
- Different from current: shards are per-person, not per-device

**Files to add:**
- `app/js/multi-party.js` — collect shards from multiple parties
- `api/combine-threshold.js` — combine shards, return session token
- `app/recovery.html` — "Multi-party recovery" tab

---

## 5. Dead Man's Switch (Enhancement)

**Concept:** If user doesn't check in for N days, release shards to designated contacts.

**Implementation approach:**
- User sets check-in interval (e.g., 7 days)
- Cron job: if no check-in, send shards to recovery contacts
- Shards encrypted for recipient's public key

**Files to add:**
- `api/dms-check-in.js` — record check-in timestamp
- `api/dms-release.js` — cron: release if overdue
- `app/dms.html` — already exists; enhance with release logic

---

## Deployment Order

1. **Time-locked recovery** — lowest complexity, high value
2. **WebAuthn** — well-supported, improves security
3. **Quantum hybrid** — future-proofing, library maturity
4. **Threshold multi-party** — complex UX
5. **DMS enhancement** — depends on contact storage

# WebAuthn Passkeys — Hardware-Backed Device Binding

**Purpose:** Vault-scoped passkeys for non-exportable, hardware-backed device identity.

---

## Endpoints

| Endpoint | Input | Output |
|----------|-------|--------|
| `POST /api/webauthn/register/options` | `{ vaultId, deviceRegistrationToken }` | Registration options |
| `POST /api/webauthn/register/verify` | `{ vaultId, credential }` | `{ success }` |
| `POST /api/webauthn/auth/options` | `{ vaultId }` | Authentication options |
| `POST /api/webauthn/auth/verify` | `{ vaultId, assertion }` | `{ success, webauthnSessionToken }` |

---

## Unlock Flow (when vault has passkeys)

1. Client calls `POST /api/unlock-vault` with password, encryptedData, iv
2. Server returns `{ webauthnRequired: true }` if vault has webauthn_credentials
3. Client calls `POST /api/webauthn/auth/options` with vaultId
4. Client performs WebAuthn auth (browser prompt)
5. Client calls `POST /api/webauthn/auth/verify` with vaultId, assertion
6. Server returns `webauthnSessionToken` (3 min TTL)
7. Client retries unlock with password + webauthnSessionToken
8. Server verifies token, decrypts, returns contents

---

## Security

- **userVerification: "required"** — biometric or PIN
- **Verify first, then consume** — prevents challenge-burning DoS (garbage assertions can't burn challenges)
- Challenge TTL 60s, single-use (atomic consume after verify)
- **Counter policy:** When stored counter > 0, enforce monotonicity (reject rollback = clone detection). Some authenticators return 0; we allow that. UV required compensates when counter is non-functional.
- Max 5 passkeys per vault
- Registration requires deviceRegistrationToken (proof of unlock)

---

## Audit Verification Checklist

| Check | Status |
|-------|--------|
| rpID correct per environment (prod domain, dev localhost) | ✅ |
| origin strictly verified | ✅ |
| allowCredentials vault-scoped | ✅ |
| userVerification required | ✅ |

## Positioning

- **WebAuthn passkeys:** Hardware-backed device authentication
- **ECDSA/JWK device keys:** Legacy software device binding (fallback)

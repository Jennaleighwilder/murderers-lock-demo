# Architecture Diagram — Outline

**Purpose:** High-level architecture for audit and pen test scoping.

---

## Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                          │
│  • Password entry (SecureMemory)                                  │
│  • Device keys (IndexedDB) or WebAuthn (platform)                │
│  • Shamir shards (localStorage)                                   │
│  • Never sends plaintext to server                                │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API (Vercel/Node)                         │
│  • /api/unlock-vault    — KDF, decrypt, rate limit, device check  │
│  • /api/webauthn/*      — Passkey register/auth                   │
│  • /api/device-register — Device binding                          │
│  • /api/recover-vault   — Shamir combine                          │
│  • No plaintext storage                                           │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                  │
│  • Encrypted vault blobs                                          │
│  • Device public keys, webauthn_credentials                       │
│  • Rate limits, challenges (hash only)                             │
│  • Audit logs                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Trust Boundaries

| Boundary | Trust level |
|----------|-------------|
| Client | Assumed compromised for device theft |
| API | Trusted for rate limit, device verify; does not see keys |
| Supabase | Trusted for storage; encrypted data only |

---

## Key Flows

1. **Unlock:** Client sends password + encrypted blob + optional device sig + optional webauthnSessionToken → API derives key → decrypts → returns plaintext to client
2. **WebAuthn:** Client gets challenge → platform signs → API verifies → issues webauthnSessionToken
3. **Recovery:** Client sends 2 shards → API combines → returns password → client unlocks

---

## Files to Reference

- `api/unlock-vault.js`
- `api/webauthn-vault.js` (via vercel rewrite)
- `lib/recovery.js`
- `lib/webauthn-vault-store.js`

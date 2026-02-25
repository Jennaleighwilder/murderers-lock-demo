# The Murderer's Lock - Investor Demo

Quantum Security Vault Protocol - Interactive investor demo.

## Deploy

```bash
vercel --prod
```

## Local

Open `index.html` in a browser or use a static server:

```bash
npx serve .
```

## Security

**Cryptographic transparency:** Our full specification is published for audit and verification.

- **Spec:** [docs/CRYPTOGRAPHIC-SPECIFICATION.md](docs/CRYPTOGRAPHIC-SPECIFICATION.md)
- **In-app:** [app/security.html](app/security.html) (Security & Cryptography page)

**Algorithms:**
- Argon2id (password hashing)
- AES-256-GCM (vault encryption)
- Shamir 2-of-3 (recovery shards)
- PBKDF2 + AES-256-GCM (shard protection, client-side)

**Security features:** Rate limiting, session tokens (password never in HTTP), PIN-encrypted shards, memory zeroing (best-effort), constant-time auth delays.

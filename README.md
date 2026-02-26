# The Murderer's Lock - Investor Demo

Quantum Security Vault Protocol - Interactive investor demo.

## Deploy

```bash
vercel --prod
```

## Local

**1. Go to the project folder:**
```bash
cd ~/Downloads/"files (93)"/murderers-lock-demo
```
(Or wherever you extracted the project.)

**2. Start the server:**
```bash
npm start
```
Or: `npx serve . -p 3000`

**3. Open in browser:**
- Landing: http://localhost:3000/
- Login / Vault Manager: http://localhost:3000/app/index.html

If port 3000 is in use, `serve` will pick another port—use the URL it prints.

## Mobile App (iOS + Android)

React Native (Expo) app with biometric auth and vault sync:

```bash
cd mobile
npm install
npm start
```

See [mobile/SETUP.md](mobile/SETUP.md) for full setup.

## Test Data Generator

Generate sample import files and vault preload for testing:

```bash
npm run generate-test-data
```

Creates `test-data/` with CSVs (1Password, LastPass, Chrome, Safari, generic), Bitwarden JSON, and vault preload (100–1000 entries). See [test-data/README.md](test-data/README.md).

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

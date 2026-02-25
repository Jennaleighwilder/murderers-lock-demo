# Master Deployment Guide

**The Murderer's Lock** — All deployment options

---

## Option 2: Production Deployment

### Files Added

| File | Purpose |
|------|---------|
| `docs/PRODUCTION-DEPLOYMENT.md` | Pre/post deploy checklist, verification |
| `api/health.js` | Health check endpoint for monitoring |
| `.env.example` | Environment variable template |
| `vercel.json` | Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy) |

### Deploy

```bash
vercel --prod
```

### Verify

```bash
curl https://your-domain.vercel.app/api/health
```

---

## Option 3: Phase 2 Advanced Features

### Files Added

| File | Purpose |
|------|---------|
| `docs/PHASE2-FEATURES.md` | Spec for time-lock, WebAuthn, quantum hybrid, threshold, DMS |
| `lib/time-lock.js` | Time-locked recovery (shards valid after N ms) |
| `app/js/webauthn-helper.js` | WebAuthn placeholder for hardware keys |

### Time-Lock Usage (Ready to Integrate)

```javascript
const { encryptWithTimeLock, decryptWithTimeLock, getRemainingMs } = require('./lib/time-lock');

// On create: lock shards for 7 days
const unlockAfter = Date.now() + 7 * 24 * 60 * 60 * 1000;
const locked = encryptWithTimeLock(shards, unlockAfter);
// Store locked.encrypted, locked.salt, locked.iv, locked.unlockAfter

// On recovery: decrypt only if time passed
const shards = decryptWithTimeLock(locked, Date.now());

// Check remaining time
const ms = getRemainingMs(locked);
```

### WebAuthn (Placeholder)

`webauthn-helper.js` provides `isAvailable()`, `createCredential()`, `getAssertion()`. Full integration requires server-side challenge/verification APIs.

---

## File Summary

```
docs/
  CRYPTOGRAPHIC-SPECIFICATION.md   # Phase 1
  PRODUCTION-DEPLOYMENT.md         # Option 2
  PHASE2-FEATURES.md               # Option 3 spec
  DEPLOYMENT-MASTER.md             # This file

api/
  health.js                        # Option 2 - monitoring

lib/
  time-lock.js                     # Option 3 - time-locked recovery

app/js/
  webauthn-helper.js               # Option 3 - hardware key placeholder

.env.example                       # Option 2
vercel.json                        # Updated with security headers
```

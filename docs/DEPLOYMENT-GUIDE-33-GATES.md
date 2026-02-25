# 33 Gates Cryptographic Implementation — Deployment Guide

**The theater IS the security.** The 33 gates are now the actual cryptography.

---

## Architecture

```
Password + Salt
      ↓
   SHA-256 → SEED
      ↓
 33 HMAC Gates (gate-i = HMAC-SHA256(seed, "gate-" + i))
      ↓
 Witch Order (deterministic shuffle from seed)
      ↓
 XOR all gates in witch order → Master Key (32 bytes)
      ↓
 AES-256-GCM encryption
```

**No bypass.** Wrong password OR wrong order = garbage key.

---

## Files

| File | Purpose |
|------|---------|
| `lib/33-gates-real.js` | Core crypto: deriveMasterKey33Gates, encrypt, decrypt |
| `lib/recovery-33gates.js` | Vault create/unlock using 33 gates (same interface as recovery.js) |
| `app/js/33-gates-display.js` | Visual + audio: real frequencies, Web Audio API tones |

---

## Deployment Options

### Option A: Replace Existing (33 Gates for All New Vaults)

1. **Update api/create-vault.js** — use recovery-33gates:

```javascript
const { createVault } = require('../lib/recovery-33gates.js');
```

2. **Update api/unlock-vault.js** — use recovery-33gates, add gate metadata on success:

```javascript
const { unlockVault } = require('../lib/recovery-33gates.js');
// In success path:
const result = await unlockVault(password, salt, encryptedData, iv, { includeGateMetadata: true });
return res.status(200).json({
  success: true,
  contents: result.contents,
  witchOrder: result.witchOrder,
  gateFrequencies: result.gateFrequencies,
  murderCount: 0,
  lockjawEngaged: false
});
```

3. **Update api/encrypt-vault.js** — use recovery-33gates for reEncryptVault.

4. **Update api/recover-vault.js** — use recovery-33gates for unlockVault (recovery still uses Shamir for password, then 33-gates for key).

5. **Update app/vault.html** — add 33-gates-display.js, show gates on unlock:

```html
<script src="js/33-gates-display.js"></script>
```

```javascript
// Before fetch: render gates container
Gates33Display.render('gates33-container');
// On success: animate from server data
if (data.witchOrder && data.gateFrequencies) {
  Gates33Display.animateUnlock({
    witchOrder: data.witchOrder,
    gateFrequencies: data.gateFrequencies
  });
}
```

### Option B: Dual Mode (Support Both Argon2 and 33 Gates)

Add `keyDerivation` field to vault. On create, use 33 gates. On unlock, check vault type and call appropriate unlock.

---

## Backward Compatibility

**Existing vaults** (Argon2) will fail with 33-gates unlock. To support both:

- Store `keyDerivation: 'argon2' | '33gates'` with vault
- Unlock: branch on keyDerivation

---

## Dependencies

No new npm packages. Uses:
- `crypto` (Node built-in)
- `shamirs-secret-sharing` (existing)

---

## Verification

1. Create vault with 33-gates API → salt, encryptedData, iv, shards
2. Unlock → contents + witchOrder + gateFrequencies
3. Client animates 33 gates with real frequencies
4. Wrong password → decrypt fails, no gate metadata returned
5. Recovery (Shamir) unchanged — 2 shards → password → 33-gates unlock

---

## Security

- Password required
- 33 gates must all align (wrong password = wrong seed = wrong gates)
- Witch order: 33! permutations (deterministic from seed)
- C-E-G chord: not in this implementation; add as optional seed component if desired
- No bypass — the frequencies ARE the cryptography

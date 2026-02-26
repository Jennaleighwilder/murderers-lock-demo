# DEPLOY-NOW — Nanosecond Lock (33 Gates)

**8 minutes. Copy-paste. No thinking required.**

---

## What You Got

| File | Purpose |
|------|---------|
| `lib/nanosecond-lock-production.js` | 33 Gates + timestamp crypto. No deps. `crypto.subtle` only. |
| `app/js/vault-integration.js` | Drop-in integration for vault unlock/create. |
| API updates | `create-vault`, `unlock-vault`, `encrypt-vault` support timestamp. |

---

## Deploy Steps

### 1. Verify files (30 sec)

```bash
ls lib/nanosecond-lock-production.js
ls app/js/vault-integration.js
```

### 2. Test the lock (1 min)

```bash
cd murderers-lock-demo
node -e "
const { lock, unlock } = require('./lib/nanosecond-lock-production.js');
(async () => {
  const locked = await lock('test', 'secret data');
  console.log('Locked:', !!locked.encryptedData, !!locked.timestamp);
  const unlocked = await unlock('test', locked.timestamp, locked.encryptedData, locked.iv, locked.salt);
  console.log('Unlocked:', unlocked.data === 'secret data' ? 'OK' : 'FAIL');
})();
"
```

Expected: `Locked: true true` and `Unlocked: OK`

### 3. Run locally (2 min)

```bash
npm install
npx vercel dev
```

- Open http://localhost:3000
- Create a vault (uses Nanosecond Lock by default)
- Unlock it

### 4. Deploy (1 min)

```bash
git add .
git commit -m "Nanosecond lock - 33 Gates + timestamp"
git push
vercel --prod
```

---

## If Something Breaks

| Problem | Fix |
|---------|-----|
| `crypto.subtle not available` | Node 18+ required. Run `node -v` |
| Create vault fails | Check API logs. Ensure `create-vault.js` has `useNanosecond` path |
| Unlock fails on new vault | Ensure vault has `timestamp` in localStorage |
| Old vaults don't unlock | Legacy vaults (no timestamp) still use Argon2id |

---

## API Usage

**Create (Nanosecond):**
```javascript
POST /api/create-vault
{ "name": "My Vault", "password": "…", "useNanosecond": true }
→ { vaultId, salt, encryptedData, iv, timestamp, shards }
```

**Unlock:**
```javascript
POST /api/unlock-vault
{ "password", "salt", "encryptedData", "iv", "timestamp", "vaultId" }
→ { contents }
```

**Save (re-encrypt):**
```javascript
POST /api/encrypt-vault
{ "password", "salt", "contents", "useNanosecond": true }
→ { encryptedData, iv, timestamp }
```

---

## Test Script (Browser Console)

```javascript
// Load lock (if not already)
const script = document.createElement('script');
script.src = '/lib/nanosecond-lock-production.js';
document.head.appendChild(script);
script.onload = async () => {
  const locked = await NanosecondLock.lock('test', 'data');
  const unlocked = await NanosecondLock.unlock('test', locked.timestamp, locked.encryptedData, locked.iv, locked.salt);
  console.log(unlocked.data); // 'data'
};
```

---

**NOW SHIP IT.**

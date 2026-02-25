# Production Deployment Guide

**The Murderer's Lock** — Vault Manager

---

## Pre-Deploy Checklist

- [ ] Phase 1 complete (rate limiting, shard protection, memory zeroing, POW, crypto spec)
- [ ] All API routes tested
- [ ] Recovery flow verified (shards 1+2, 1+3, 2+3)
- [ ] Security page accessible
- [ ] docs/CRYPTOGRAPHIC-SPECIFICATION.md served

---

## Vercel Deployment

```bash
vercel --prod
```

### Environment Variables (Optional)

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `production` (auto-set by Vercel) |

No secrets required for current implementation. Rate limits and session store are in-memory (per-instance).

---

## Post-Deploy Verification

1. **Health:** `GET /api/health` → 200
2. **Create vault:** POST to `/api/create-vault` → vaultId, shards
3. **Unlock:** POST to `/api/unlock-vault` → contents
4. **Recovery:** POST to `/api/recover-vault` → sessionToken
5. **Rate limit:** 11 wrong unlocks → 429
6. **Security page:** `/app/security.html` loads
7. **Crypto spec:** `/docs/CRYPTOGRAPHIC-SPECIFICATION.md` downloads

---

## Monitoring

- **Vercel Analytics:** Enable in project settings
- **Logs:** `vercel logs --follow`
- **Alerts:** Configure in Vercel dashboard for 5xx, high latency

---

## Rollback

```bash
vercel rollback
```

---

## Security Headers (Optional)

Add to `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

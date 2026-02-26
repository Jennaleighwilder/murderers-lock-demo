# Supply-Chain Hardening — Ship Gate Checklist

**Purpose:** Elite security product posture. CI enforces these gates.

---

## 4.0 Production Definition

| Item | Implementation |
|------|----------------|
| Single source of truth | `lib/env.js` → `IS_PROD = NODE_ENV === 'production'` |
| CI prod deployments | Fail build if `NODE_ENV` not set for production |

---

## 4.1 Dependency & Lockfile Discipline

| # | Gate | Implementation |
|---|------|----------------|
| 1 | Exactly one lockfile | `package-lock.json` only (no yarn.lock, pnpm-lock.yaml in root) |
| 2 | Pinned security-critical deps | No `^`/`~` for argon2, @simplewebauthn, @supabase, otplib |
| 3 | CI uses `npm ci` | Never `npm install` in CI |
| 4 | `npm audit` gate | `npm run audit:ci` — critical always fails; high unless allowlisted |

---

## 4.2 SBOM + Provenance

| # | Gate | Implementation |
|---|------|----------------|
| 5 | SBOM on release | `npm run sbom` → `sbom.json` (CycloneDX) |
| 6 | Build provenance | `npm run build-provenance` → `build-manifest.json` |

---

## 4.3 CI Security Gates

| # | Gate | Implementation |
|---|------|----------------|
| 7 | Static checks | `npm test` (unit + core + webauthn invariants) |
| 8 | Secret scanning | `npm run verify:secrets` — fail on credential patterns, .env in commits |
| 9 | Dependency review | PRs changing package.json require CODEOWNERS approval |

---

## 4.4 Browser Attack Surface

| # | Gate | Implementation |
|---|------|----------------|
| 10 | CSP | **script-src**: no `unsafe-inline`, no `unsafe-eval` (enforced). **style-src**: `unsafe-inline` kept for inline style attributes; migrate to classes for full lock-down. |
| 11 | Security headers | HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |

**CSP (Step 4.4b):** script-src has no `unsafe-inline` — all inline scripts moved to external JS. style-src keeps `unsafe-inline` for `style=""` attributes; to remove: move those to CSS classes.

---

## 4.5 Secrets + Config

| # | Gate | Implementation |
|---|------|----------------|
| 12 | No secrets in client | Supabase anon key only in frontend; service role server-only |
| 13 | Separate env sets | dev/staging/prod; rotation plan documented |
| 14 | Log hygiene | Never log: password, salt, encryptedData, deviceSignature, raw challenge, tokens |

---

## 4.6 Deployment

| # | Gate | Implementation |
|---|------|----------------|
| 15 | Vercel hardening | Restrict prod deploy; 2FA on org; env vars prod-scoped |
| 16 | Edge rate limit | WAF/edge rules: IP throttling, bot protection |

---

## Run Ship Gate

```bash
npm run verify:prod-security
```

Fails if any gate fails. Use in CI before deploy.

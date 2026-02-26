# Red-Team Attack Simulation Suite

Auditor-ready breach simulation tests. Run with one command; produces evidence artifacts.

## Modes

| Mode | When | Tests |
|------|------|-------|
| `lite` (default) | CI, no env vars | Deterministic only: device_register_without_token, kdf_type_mismatch (if KDF set), prod_fail_closed (if enabled) |
| `full` | Main branch, real vault | All tests; B/C skip when env missing |
| `webauthn` | WebAuthn validation | Same as full; WebAuthn tests skip when no token |

## Run

**Lite (no secrets):**
```bash
npm run test:redteam
```

**Full (real vault):**
```bash
REDTEAM_MODE=full REDTEAM_VAULT_ID=<vault> REDTEAM_PASSWORD=<password> npm run test:redteam
```

## Env vars

| Var | Required | Description |
|-----|----------|-------------|
| `REDTEAM_MODE` | No | `lite` (default), `full`, or `webauthn` |
| `REDTEAM_VAULT_ID` | full/webauthn | Test vault ID |
| `REDTEAM_PASSWORD` | full/webauthn | Password for that vault |
| `REDTEAM_REAL_VAULT` | No | `true` to run token-reuse and rate-limit tests (Category B) |
| `REDTEAM_BASE_URL` | No | API base (default: `http://localhost:3000`) |
| `REDTEAM_SUPABASE_ON` | No | `true`/`false` — skip Supabase-dependent tests when `false` |
| `REDTEAM_WEBAUTHN_TOKEN` | No | Fresh webauthnSessionToken for WebAuthn tests (Category C) |
| `REDTEAM_OTHER_VAULT_ID` | No | Different vault for wrong-vault-binding test |
| `REDTEAM_TOTP` | No | TOTP code if vault requires 2FA |
| `REDTEAM_KDF_TYPE_EXPECTED` | No | `argon2id` or `33gate` for KDF mismatch test |
| `REDTEAM_RATE_ATTEMPTS` | No | Attempts for rate-limit test (default: 60) |
| `REDTEAM_TEST_FAIL_CLOSED` | No | `true` to run fail-closed rate-limit test |

## Artifacts

- `artifacts/redteam/redteam-report.json` — machine-verifiable
- `artifacts/redteam/redteam-summary.md` — human-readable
- `artifacts/redteam/traces/*.json` — sanitized evidence (secrets redacted)

## CI

Add `REDTEAM_VAULT_ID` and `REDTEAM_PASSWORD` as GitHub secrets to enable the redteam job. Artifacts are uploaded on success and failure.

# WebAuthn E2E — Playwright + Virtual Authenticator

Browser-level automation for hardware-backed WebAuthn. Uses Chromium virtual authenticator (CDP).

## Run

```bash
# Local (server must be running: npm start)
npm run test:webauthn

# Against deployed app
WEBAUTHN_BASE_URL=https://murderers-lock-demo.vercel.app npm run test:webauthn
```

## Prerequisites

```bash
npx playwright install chromium
```

## Tests

| Test | Goal |
|------|------|
| registration completes | Virtual authenticator + Add Security Key → success |
| authentication completes | Auth options returned after registration |
| replay rejected | Same assertion used twice → second fails (400/401) |

## CI

The `webauthn-e2e` job runs after ship-gate, targets the deployed app by default.

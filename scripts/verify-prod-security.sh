#!/usr/bin/env bash
# Supply-chain ship gate. Fails if any check fails.
# Run: bash scripts/verify-prod-security.sh

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAIL=0

# 4.1.1: Exactly one lockfile
lockcount=0
[ -f package-lock.json ] && lockcount=$((lockcount+1))
[ -f yarn.lock ] && lockcount=$((lockcount+1))
[ -f pnpm-lock.yaml ] && lockcount=$((lockcount+1))
if [ "$lockcount" -gt 1 ]; then
  echo "FAIL: More than one lockfile (package-lock.json, yarn.lock, pnpm-lock.yaml)"
  FAIL=1
elif [ "$lockcount" -eq 0 ]; then
  echo "FAIL: No lockfile found"
  FAIL=1
else
  echo "OK: Single lockfile"
fi

# 4.1.3: npm ci (check package.json scripts don't use npm install in CI)
if grep -q '"install":' package.json 2>/dev/null; then
  echo "WARN: package.json has 'install' script — ensure CI uses npm ci"
fi

# 4.4: CSP — HARD FAIL if unsafe-inline in script-src (XSS vector)
if [ -f vercel.json ]; then
  if grep -qE "script-src[^;]*'unsafe-inline'" vercel.json; then
    echo "FAIL: CSP script-src must NOT contain unsafe-inline (see docs/SUPPLY-CHAIN-HARDENING.md)"
    FAIL=1
  else
    echo "OK: CSP script-src has no unsafe-inline"
  fi
  if grep -q 'unsafe-eval' vercel.json; then
    echo "FAIL: CSP must NOT contain unsafe-eval"
    FAIL=1
  fi
  if ! grep -q "object-src 'none'" vercel.json 2>/dev/null; then
    echo "FAIL: CSP must include object-src 'none'"
    FAIL=1
  fi
  if ! grep -q "frame-ancestors" vercel.json 2>/dev/null; then
    echo "FAIL: CSP must include frame-ancestors"
    FAIL=1
  fi
fi

# 4.4: Security headers present
if [ -f vercel.json ]; then
  for h in X-Content-Type-Options X-Frame-Options Strict-Transport-Security; do
    if ! grep -q "$h" vercel.json 2>/dev/null; then
      echo "FAIL: Missing header: $h"
      FAIL=1
    fi
  done
  [ $FAIL -eq 0 ] && echo "OK: Required security headers present"
fi

# 4.5.14: Log hygiene — fail on obvious leaks (variable names in log calls)
if grep -rE "console\.(log|error|warn)\([^)]*\b(password|salt|encryptedData|deviceSignature|deviceChallenge|webauthnSessionToken|deviceRegistrationToken)\b" \
  --include="*.js" api lib 2>/dev/null | grep -v node_modules | grep -v '.test.' | grep -v '\.md' | grep -v '// '; then
  echo "FAIL: Forbidden log pattern — never log password, salt, encryptedData, tokens, signatures"
  FAIL=1
else
  echo "OK: No forbidden log patterns"
fi

# 4.5.12: .env not committed
if git rev-parse --git-dir >/dev/null 2>&1; then
  if git ls-files --error-unmatch .env 2>/dev/null; then
    echo "FAIL: .env is tracked in git"
    FAIL=1
  else
    echo "OK: .env not in git"
  fi
fi

# Run tests (invariants)
echo ""
echo "Running core + webauthn invariants..."
npm test 2>/dev/null || { echo "FAIL: npm test"; FAIL=1; }

if [ $FAIL -eq 1 ]; then
  echo ""
  echo "Ship gate FAILED. Fix issues before deploy."
  exit 1
fi

echo ""
echo "Ship gate PASSED."

#!/bin/bash
# Run complete test suite: unit, integration, compliance, security, load, e2e
# Plus existing: test-suite, harm-barriers, red-team (local)
set -e
cd "$(dirname "$0")/.."
export TEST_FAST=1

TOTAL=0
FAILED=0

run() {
  echo ""
  echo "========== $1 =========="
  if node "$2" 2>&1; then
    echo "PASS"
    TOTAL=$((TOTAL + 1))
  else
    echo "FAIL"
    TOTAL=$((TOTAL + 1))
    FAILED=$((FAILED + 1))
  fi
}

run_bash() {
  echo ""
  echo "========== $1 =========="
  if bash "$2" 2>&1; then
    echo "PASS"
    TOTAL=$((TOTAL + 1))
  else
    echo "FAIL"
    TOTAL=$((TOTAL + 1))
    FAILED=$((FAILED + 1))
  fi
}

# Unit
for f in test/unit/*.test.js; do
  [ -f "$f" ] && run "Unit: $(basename $f)" "$f"
done

# Integration
for f in test/integration/*.test.js; do
  [ -f "$f" ] && run "Integration: $(basename $f)" "$f"
done

# Compliance
for f in test/compliance/*.test.js; do
  [ -f "$f" ] && run "Compliance: $(basename $f)" "$f"
done

# Security
for f in test/security/*.test.js; do
  [ -f "$f" ] && run "Security: $(basename $f)" "$f"
done

# Load
run "Load" "test/real-world/load.test.js"

# Chaos
run "Chaos" "test/real-world/chaos.test.js"

# Disaster Recovery
run "Disaster Recovery" "test/real-world/disaster-recovery.test.js"

# E2E
for f in test/e2e/*.test.js; do
  [ -f "$f" ] && run "E2E: $(basename $f)" "$f"
done

# Existing
run "Test Suite" "test/test-suite.js"
run "Harm Barriers" "test/harm-barriers-test.js"

# Red team (automated: starts server, runs 28 vectors, stops)
run_bash "Red Team" "scripts/run-red-team.sh" || true

echo ""
echo "========== TOTAL =========="
echo "Passed: $((TOTAL - FAILED))"
echo "Failed: $FAILED"
exit $([ $FAILED -eq 0 ] && echo 0 || echo 1)

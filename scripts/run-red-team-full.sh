#!/bin/bash
# Run all red team tests: local + network
# Local is authoritative. Network may have deployment-specific issues.
set -e
cd "$(dirname "$0")/.."
export TEST_FAST=1

echo ""
echo "========== RED TEAM: LOCAL =========="
PORT=${PORT:-3052} API_BASE="http://127.0.0.1:$PORT" node server.js &
SRV_PID=$!
sleep 2
API_BASE="http://127.0.0.1:$PORT" node test/red-team-test.js
LOCAL_EXIT=$?
kill $SRV_PID 2>/dev/null || true

echo ""
echo "========== RED TEAM: NETWORK (Vercel) =========="
API_BASE=https://murderers-lock-demo.vercel.app node test/red-team-test.js
NET_EXIT=$?

echo ""
echo "========== RED TEAM FULL SUMMARY =========="
echo "Local:  $([ $LOCAL_EXIT -eq 0 ] && echo 'PASS' || echo 'FAIL')"
echo "Network: $([ $NET_EXIT -eq 0 ] && echo 'PASS' || echo 'FAIL (Vercel may need serverless config)')"
exit $([ $LOCAL_EXIT -eq 0 ] && [ $NET_EXIT -eq 0 ] && echo 0 || echo 1)

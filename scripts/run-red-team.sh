#!/bin/bash
# Red team: 28 attack vectors, fully automated (starts server, runs tests, stops)
# No manual server needed.
cd "$(dirname "$0")/.."
PORT=${PORT:-3060}
export PORT
export API_BASE="http://127.0.0.1:$PORT"
export TEST_FAST=1

echo ""
echo "========== RED TEAM (28 vectors) — Automated =========="
node server.js &
SRV_PID=$!
sleep 2
node test/red-team-test.js
EXIT=$?
kill $SRV_PID 2>/dev/null || true
exit $EXIT

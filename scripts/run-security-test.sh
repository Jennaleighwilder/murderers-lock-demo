#!/bin/bash
# Run security tests with server. TEST_FAST=1: 0ms delay on wrong password.
cd "$(dirname "$0")/.."
PORT=${PORT:-3050}
export PORT
export API_BASE="http://127.0.0.1:$PORT"

TEST_FAST=1 node server.js &
SRV_PID=$!
sleep 2
TEST_FAST=1 API_BASE=$API_BASE node test/security-test.js
EXIT=$?
kill $SRV_PID 2>/dev/null || true
exit $EXIT

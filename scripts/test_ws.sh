#!/usr/bin/env bash
# Test WebSocket connection and subscription flow
#
# Requirements: websocat (cargo install websocat) or wscat (npm i -g wscat)
#
# Usage: ./scripts/test_ws.sh [host:port]

set -euo pipefail

WS_URL="${1:-ws://localhost:8080/ws}"

echo "=== FinancePulse WebSocket Test ==="
echo "Connecting to: $WS_URL"
echo ""

# Prefer websocat, fall back to wscat
if command -v websocat &>/dev/null; then
    echo "Using websocat"
    echo ""

    # Test 1: Ping/pong
    echo "--- Test 1: Ping/Pong ---"
    echo '{"type":"ping"}' | websocat -n1 "$WS_URL" 2>/dev/null
    echo ""

    # Test 2: Subscribe and listen for price updates
    echo "--- Test 2: Subscribe to BTC, ETH, AAPL ---"
    echo "Subscribing and listening for 15 seconds..."
    echo ""
    (
        echo '{"type":"subscribe","symbols":["BTC","ETH","AAPL"]}'
        sleep 15
    ) | websocat "$WS_URL" 2>/dev/null &
    WS_PID=$!

    sleep 16
    kill $WS_PID 2>/dev/null || true
    echo ""

    # Test 3: Subscribe then unsubscribe
    echo "--- Test 3: Subscribe + Unsubscribe ---"
    (
        echo '{"type":"subscribe","symbols":["SOL","BNB"]}'
        sleep 2
        echo '{"type":"unsubscribe","symbols":["SOL"]}'
        sleep 5
    ) | websocat "$WS_URL" 2>/dev/null &
    WS_PID=$!

    sleep 8
    kill $WS_PID 2>/dev/null || true
    echo ""

elif command -v wscat &>/dev/null; then
    echo "Using wscat"
    echo "Connect manually with:"
    echo "  wscat -c $WS_URL"
    echo ""
    echo "Then send these messages:"
    echo '  {"type":"ping"}'
    echo '  {"type":"subscribe","symbols":["BTC","ETH","AAPL"]}'
    echo '  {"type":"unsubscribe","symbols":["BTC"]}'
    echo ""
    echo "Starting interactive session..."
    wscat -c "$WS_URL"
else
    echo "ERROR: Neither websocat nor wscat found."
    echo ""
    echo "Install one of:"
    echo "  cargo install websocat"
    echo "  npm install -g wscat"
    exit 1
fi

echo "=== Test complete ==="

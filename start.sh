#!/usr/bin/env bash
set -euo pipefail

# The host assigns $PORT to the shop, so the agent's health server needs its own.
SHOP_PORT="${PORT:-3000}"
export AGENT_HEALTH_PORT="${AGENT_HEALTH_PORT:-8081}"

# Sharing a container makes tool calls a loopback hop instead of a network round trip.
export STORE_API_URL="http://127.0.0.1:${SHOP_PORT}"

echo "[start] shop on :${SHOP_PORT}"
PORT="$SHOP_PORT" HOSTNAME=0.0.0.0 node /app/web/server.js &
shop=$!

echo "[start] kamala, health on :${AGENT_HEALTH_PORT}"
python3 /app/agent/agent.py start &
kamala=$!

shutdown() {
  kill "$shop" "$kamala" 2>/dev/null || true
}
trap shutdown TERM INT

# Exit if either half dies so the platform restarts a clean container rather than
# leaving a half-dead service that answers HTTP but never picks up a call.
wait -n "$shop" "$kamala"
echo "[start] one process exited, stopping the container"
shutdown
exit 1

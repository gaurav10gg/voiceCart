#!/usr/bin/env bash
set -uo pipefail

# The host assigns $PORT to the shop, so the agent's health server needs its own.
SHOP_PORT="${PORT:-3000}"
export AGENT_HEALTH_PORT="${AGENT_HEALTH_PORT:-8081}"

# Sharing a container makes tool calls a loopback hop instead of a network round trip.
export STORE_API_URL="http://127.0.0.1:${SHOP_PORT}"

echo "[start] shop on :${SHOP_PORT}"
PORT="$SHOP_PORT" HOSTNAME=0.0.0.0 node /app/web/server.js &
shop=$!

# Wait for the shop to be ready before starting the agent so the first
# tool call (greeting → search) doesn't race against Node startup.
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${SHOP_PORT}/api/health" >/dev/null 2>&1; then
    echo "[start] shop ready after ${i}s"
    break
  fi
  sleep 1
done

start_agent() {
  echo "[start] agent, health on :${AGENT_HEALTH_PORT}"
  python3 /app/agent/agent.py start &
  agent=$!
}

start_agent

shutdown() {
  kill "$shop" "$agent" 2>/dev/null || true
}
trap shutdown TERM INT

# Keep the shop up if the agent crashes. Render health-checks the shop; taking
# the container down on a voice-session OOM just loops forever.
while true; do
  wait -n "$shop" "$agent"
  code=$?
  if ! kill -0 "$shop" 2>/dev/null; then
    echo "[start] shop exited ${code}, stopping the container"
    shutdown
    exit 1
  fi
  echo "[start] agent exited ${code}, restarting in 2s"
  sleep 2
  start_agent
done

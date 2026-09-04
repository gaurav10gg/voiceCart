#!/usr/bin/env bash
set -uo pipefail

# Render health-checks $PORT. Keep that socket in a tiny proxy so a busy
# Next.js / Python voice session cannot fail the probe and restart the box.
PUBLIC_PORT="${PORT:-3000}"
SHOP_PORT="${SHOP_INTERNAL_PORT:-3001}"
export SHOP_INTERNAL_PORT="$SHOP_PORT"
export AGENT_HEALTH_PORT="${AGENT_HEALTH_PORT:-8081}"
export STORE_API_URL="http://127.0.0.1:${SHOP_PORT}"

echo "[start] proxy on :${PUBLIC_PORT}"
PORT="$PUBLIC_PORT" node /app/health-proxy.js &
proxy=$!

echo "[start] shop on :${SHOP_PORT}"
PORT="$SHOP_PORT" HOSTNAME=0.0.0.0 NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=160}" \
  node /app/web/server.js &
shop=$!

for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${SHOP_PORT}/api/health" >/dev/null 2>&1; then
    echo "[start] shop ready after ${i}s"
    break
  fi
  sleep 1
done

start_agent() {
  echo "[start] agent, health on :${AGENT_HEALTH_PORT}"
  # Lower priority so the proxy/shop still get scheduled for health checks.
  nice -n 15 python3 /app/agent/agent.py start &
  agent=$!
}

start_agent

shutdown() {
  kill "$proxy" "$shop" "$agent" 2>/dev/null || true
}
trap shutdown TERM INT

while true; do
  wait -n "$proxy" "$shop" "$agent"
  code=$?
  if ! kill -0 "$proxy" 2>/dev/null; then
    echo "[start] proxy exited ${code}, stopping the container"
    shutdown
    exit 1
  fi
  if ! kill -0 "$shop" 2>/dev/null; then
    echo "[start] shop exited ${code}, restarting shop"
    PORT="$SHOP_PORT" HOSTNAME=0.0.0.0 NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=160}" \
      node /app/web/server.js &
    shop=$!
    continue
  fi
  echo "[start] agent exited ${code}, restarting in 2s"
  sleep 2
  start_agent
done

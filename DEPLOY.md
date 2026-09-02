# Deploying VoiceCart to Render (free tier, one service)

The shop and Kamala share a single container, the way they run locally. LiveKit Cloud stays
where it is — only this container needs hosting.

Render's free tier needs no payment method. Singapore is the closest free region to Sarvam's
India-hosted APIs.

## Why one service

Render's free tier has **no background workers** — free compute covers web services only. And
each workspace gets **750 free instance hours per calendar month**, so two always-on services
(~1,460 hours) would exhaust the allowance in about 15 days and suspend both.

One service running around the clock is ~730 hours. That fits, which means you can keep it
permanently awake and reviewers never hit a cold start.

Combining them has two side benefits. Kamala's tool calls become a loopback hop instead of a
network round trip, and a single ping keeps both halves alive — pinging the shop keeps the
container up, and the agent lives in that same container.

The tradeoff is that the two restart together. Fine for a demo.

## How it fits together

`start.sh` launches both processes:

- The shop binds Render's `$PORT`, which is the public HTTPS URL.
- Kamala's LiveKit health server binds `AGENT_HEALTH_PORT` (8081) so it doesn't collide.
- `STORE_API_URL` is set to `http://127.0.0.1:$PORT` automatically — don't set it yourself.

If either process dies, the script stops the other and exits non-zero, so Render restarts a
clean container. Without that, you could end up with a service that still answers HTTP while
Kamala is dead — which looks fine in a browser and fails every call.

## Setup

Push this branch to GitHub. `.gitignore` already excludes `web/.env.local` and `agent/.env`.

Generate fresh values for `AGENT_SHARED_SECRET` and `AUTH_SECRET` — both fall back to
`dev-…-change-me` defaults in code — and rotate the LiveKit and Sarvam keys rather than
reusing local ones.

In Render, **New → Blueprint** pointed at this branch picks up `render.yaml`. Or create a Web
Service by hand:

| Setting | Value |
| --- | --- |
| Type | Web Service |
| Runtime | Docker |
| Dockerfile path | `./Dockerfile` |
| Docker context | `.` (repo root) |
| Region | Singapore |
| Plan | Free |
| Health check path | `/` |

Environment variables:

| Variable | Value |
| --- | --- |
| `LIVEKIT_URL` | `wss://<project>.livekit.cloud` |
| `LIVEKIT_API_KEY` | from LiveKit |
| `LIVEKIT_API_SECRET` | from LiveKit |
| `SARVAM_API_KEY` | from Sarvam |
| `AGENT_SHARED_SECRET` | new random string |
| `AUTH_SECRET` | new random string |
| `NUM_CPUS` | `1` |

`NUM_CPUS` matters. The worker sizes its pool of idle job processes from the detected CPU
count; if it misreads the container limit it spawns several and exhausts the 512 MB instance.

### Keep it awake

Point a free uptime monitor (UptimeRobot or cron-job.org) at the service URL every 10
minutes. Free services sleep after 15 idle minutes, and a sleeping container means Kamala is
not registered with LiveKit and will miss every call — she can't wake herself, because
LiveKit dispatches over an outbound WebSocket that doesn't count as incoming traffic.

One service at ~730 hours/month stays inside the 750-hour budget. Adding a second service is
what breaks it.

## Verify

In order — each step depends on the one before:

1. Logs show `[start] shop`, `[start] kamala`, then `registered worker` with your LiveKit URL.
2. The service URL loads the catalog.
3. **Start talking** connects and Kamala greets you.
4. Complete one order: add an item, give a house number and city, say the pin digits, then
   say to place the order. That path has broken most often.

## Notes

**Restarts.** Render restarts a crashed container. The worker has died before after a LiveKit
DNS blip exhausted its 16 reconnect attempts and stayed down until restarted by hand.

**Credits.** Sarvam and LiveKit bill per use, and a tab left connected keeps the meter
running. Consider an idle disconnect if the demo will sit open.

**State.** Carts, orders, and accounts live in memory and reset on redeploy. Fine for a demo,
and the single-instance design is what the in-process SSE cart stream needs anyway.

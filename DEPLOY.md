# Deploying VoiceCart to Northflank

Two services on the free Developer Sandbox tier: the shop and Kamala. Sandbox gives 2
always-on services with no sleep, which is what this app needs — the shop holds carts in
memory and streams them over SSE, and the agent worker has to stay registered with LiveKit
to pick up a call.

LiveKit Cloud stays where it is. Only the shop and the worker get hosted.

## Before you start

Both services build from the same GitHub repo, so push it first. `.gitignore` already
excludes `web/.env.local` and `agent/.env` — confirm with `git status` before the first push.

Generate fresh values for production. `AGENT_SHARED_SECRET` and `AUTH_SECRET` both fall back
to `dev-…-change-me` defaults in code, and the LiveKit and Sarvam keys in your local `.env`
files should be rotated rather than reused.

In Northflank, link GitHub under the banner at the top of the project, or in
**Project settings → Version control**.

## Service 1 — shop

Create a **combined service** (builds from git and deploys) pointed at your repo.

| Setting | Value |
| --- | --- |
| Build type | Dockerfile |
| Dockerfile path | `/web/Dockerfile` |
| Build context | `/web` |
| Port | `3000`, HTTP, public |

Give it a public domain. Northflank issues a `*.code.run` hostname with TLS, which you need:
browsers only allow microphone access on a secure origin, so the voice dock is dead over
plain HTTP.

Environment variables:

| Key | Value |
| --- | --- |
| `LIVEKIT_URL` | `wss://<project>.livekit.cloud` |
| `LIVEKIT_API_KEY` | from LiveKit |
| `LIVEKIT_API_SECRET` | from LiveKit |
| `AGENT_SHARED_SECRET` | new random string |
| `AUTH_SECRET` | new random string |

`PORT` and `HOSTNAME` are already set in the Dockerfile, so the standalone server binds
correctly without extra config.

## Service 2 — Kamala

Another combined service from the same repo.

| Setting | Value |
| --- | --- |
| Build type | Dockerfile |
| Dockerfile path | `/agent/Dockerfile` |
| Build context | `/agent` |
| Port | none — it needs no public ingress |

The worker dials out to LiveKit over a WebSocket and never receives inbound traffic, so leave
it internal.

Environment variables:

| Key | Value |
| --- | --- |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | same three as the shop |
| `SARVAM_API_KEY` | from Sarvam |
| `AGENT_SHARED_SECRET` | must match the shop exactly |
| `STORE_API_URL` | the shop's **internal** address |

For `STORE_API_URL`, copy the internal address from the shop service's networking panel
rather than using the public `.code.run` URL. Every tool call Kamala makes — search, add to
cart, checkout — is a round trip to the shop, so keeping it on the internal network removes
that hop from her response time and keeps the shared secret off the public internet.

The value looks like `http://<shop-service>:3000`. The agent rewrites `http://localhost` to
`127.0.0.1` on startup but passes any other hostname through unchanged, so no code change is
needed.

## Verify

In order — each step depends on the one before:

1. Agent logs show `registered worker` with your LiveKit URL and a region.
2. The shop's public URL loads the catalog.
3. **Start talking** connects and Kamala greets you.
4. Complete one order end to end: add an item, give a house number and city, say the pin
   digits, then say to place the order. That last path is the one that has broken most often.

## Notes

**Region.** The free tier's nearest region is London, while Sarvam's API and your LiveKit
project are both in India. Each turn makes three Sarvam calls (STT, LLM, TTS), so expect
higher turn latency than local runs. The latency HUD will show it. Worth stating in your
writeup — it's a hosting constraint, not a design flaw.

**Restarts.** Northflank restarts a crashed container. The worker has died before after a
LiveKit DNS blip exhausted its 16 reconnect attempts and stayed down until restarted by hand;
hosting fixes that failure mode.

**Credits.** Sarvam and LiveKit both bill per use, and a browser tab left connected keeps the
meter running. Consider an idle disconnect if the demo will sit open.

**State.** Carts, orders, and accounts live in memory and reset when a service redeploys.
That is fine for a demo but means the shop must stay at one instance — with two, the agent
could write a cart on one instance while the browser streams SSE from the other.

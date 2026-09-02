# VoiceCart

A clothing shop you can talk to. Built for a grandmother who knows exactly what she wants and should not have to search a grid, pick a size from a dropdown, and click through checkout.

Kamala is a LiveKit voice agent (Sarvam STT → Sarvam 105B → Sarvam TTS) that searches the catalog, disambiguates size / colour / print, fills the bag, and places the order. The storefront updates live so a family member watching can see the work happen.

## Who this is for

Low digital literacy, mixed Hindi and English, and a real shopping list — “the white t-shirt with the sunflower”, “the cheaper nighty”, “size large, maroon”. The catalog stores the precise print (which flower, the exact quote on the shirt, where the embroidery sits) because that is how people actually describe clothes.

## What was built

- Next.js clothing store, 26 garments with size/colour variants and speakable print metadata
- Email + password accounts, plus continue-as-guest (guest bag merges on signup)
- REST tools the agent calls: search, describe, options, add, remove, cart, checkout
- `add_to_cart` returns `needs_clarification` instead of guessing size or colour
- LiveKit voice dock with captions, a full editable system prompt, voice / model / language / pace / endpointing controls
- Cart SSE so the grid and bag update while she talks
- Per-turn latency HUD (STT final, LLM TTFT, TTS TTFB, turn total)

## Local setup

You need:

1. A [LiveKit Cloud](https://cloud.livekit.io) project → `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
2. A [Sarvam](https://www.sarvam.ai) API key → `SARVAM_API_KEY`
3. Node 22 and Python 3.10

### Shop (Next.js)

```bash
cd web
cp .env.example .env.local
# fill LIVEKIT_* (the same three values as the agent)
npm install
npm run dev
```

Open http://localhost:3000

### Agent (Python)

```bash
cd agent
py -3.10 -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# fill LIVEKIT_* and SARVAM_API_KEY
python agent.py download-files
python agent.py console          # terminal voice loop, no browser
python agent.py start            # worker that joins LiveKit rooms
```

Use Python 3.10, not 3.14.

`AGENT_SHARED_SECRET` must match in `web/.env.local` and `agent/.env`.

## How a call is wired

1. The browser creates a guest or user session (`sid`).
2. `POST /api/token` creates LiveKit room `vc-<sid>` and stores the control-panel settings.
3. The agent worker joins, reads `ctx.room.name`, fetches `/api/session/<room>/config`, and starts `AgentSession` with Sarvam STT/LLM/TTS. No separate VAD — Sarvam STT drives turn-taking (`turn_detection="stt"`, `min_endpointing_delay=0.07`).
4. Tool calls hit the Next.js API with that `sid`. The page listens to `/api/cart/stream`.
5. Prompt / voice / model / pace apply live over the data channel. Endpointing delay applies on reconnect.

## Deploy later

- **Shop → Vercel.** Swap `web/lib/store.ts` for Upstash Redis (same function names). Set the env vars. In-memory Maps do not survive multiple serverless isolates.
- **Agent → Render or Railway.** Dockerfile is in `agent/`. Start command: `python agent.py start`. Point `STORE_API_URL` at the Vercel URL.

## Another week

Real payment, memory of her usual order, WhatsApp confirmation to family, and Sarvam realtime STT if we chase more latency off the turn.

## Latency

The HUD on the shop page records STT final, LLM time-to-first-token, TTS time-to-first-byte, and the sum. Quote those numbers from a live call rather than estimates — they depend on region, model, and how long she speaks.

"use client";

import type { Room } from "livekit-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRODUCTS } from "@/lib/catalog";
import { loadSettings, roomNameForSid, saveSettings } from "@/lib/settings";
import type { AgentSettings, Cart, PublicUser, TurnLatency } from "@/lib/types";
import { CartRail } from "./CartRail";
import { ControlPanel } from "./ControlPanel";
import { LatencyHUD } from "./LatencyHUD";
import { ProductGrid } from "./ProductGrid";
import { publishSettings, VoiceDock } from "./VoiceDock";

const emptyCart = (sid: string): Cart => ({ sid, items: [], total: 0, itemCount: 0 });
const SEEN_ORDER_KEY = "voicecart:seen-order";

function readSeenOrder() {
  try {
    return sessionStorage.getItem(SEEN_ORDER_KEY);
  } catch {
    return null;
  }
}

function rememberSeenOrder(id: string) {
  try {
    sessionStorage.setItem(SEEN_ORDER_KEY, id);
  } catch {
    /* private mode */
  }
}

export function StoreShell() {
  const router = useRouter();
  const seenOrder = useRef<string | null>(null);
  const [sid, setSid] = useState("");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [cart, setCart] = useState<Cart>(emptyCart(""));
  const [query, setQuery] = useState("");
  const [settings, setSettings] = useState<AgentSettings>(loadSettings);
  const [panelOpen, setPanelOpen] = useState(false);
  const [turns, setTurns] = useState<TurnLatency[]>([]);
  const [connected, setConnected] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const settingsReady = useRef(true);

  useEffect(() => {
    void (async () => {
      await fetch("/api/auth/guest", { method: "POST" });
      const me = await fetch("/api/auth/me").then((r) => r.json());
      setUser(me.user);
      setSid(me.sid);
    })();
  }, []);

  useEffect(() => {
    const already = seenOrder.current ?? readSeenOrder();
    seenOrder.current = already;
    if (!cart.lastOrderId || cart.lastOrderId === already) return;
    seenOrder.current = cart.lastOrderId;
    rememberSeenOrder(cart.lastOrderId);
    router.push(`/order/${cart.lastOrderId}`);
    void fetch("/api/cart/ack-order", { method: "POST" });
  }, [cart.lastOrderId, router]);

  useEffect(() => {
    if (!sid) return;
    const es = new EventSource(`/api/cart/stream?sid=${encodeURIComponent(sid)}`);
    es.onmessage = (ev) => {
      try {
        setCart(JSON.parse(ev.data) as Cart);
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [sid]);

  useEffect(() => {
    if (!sid || !connected) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/telemetry?sid=${encodeURIComponent(sid)}`);
      if (res.ok) {
        const data = await res.json();
        setTurns(data.turns ?? []);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [sid, connected]);

  const products = useMemo(() => {
    if (!query.trim()) return PRODUCTS;
    const q = query.toLowerCase();
    return PRODUCTS.filter((p) =>
      [p.name, p.nameHi, p.nameTa, p.brand, p.description, p.print.flower, p.print.quote, p.aliases.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  const onConnectedChange = useCallback((live: boolean, room: Room | null) => {
    setConnected(live);
    roomRef.current = room;
  }, []);

  useEffect(() => {
    if (!sid || !settingsReady.current) return;
    const timer = window.setTimeout(() => {
      void applySettings(settings);
    }, 250);
    return () => window.clearTimeout(timer);
    // Language, voice, and model must land on the worker without a second click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, settings.language, settings.speaker, settings.model, settings.pace]);

  function changeSettings(next: AgentSettings) {
    setSettings(next);
    saveSettings(next);
  }

  async function applySettings(next = settings) {
    if (!sid) return;
    saveSettings(next);
    await fetch(`/api/session/${encodeURIComponent(roomNameForSid(sid))}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sid, roomName: roomNameForSid(sid), settings: next }),
    });
    await publishSettings(roomRef.current, next);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    const guest = await fetch("/api/auth/guest", { method: "POST" }).then((r) => r.json());
    setSid(guest.sid);
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-[var(--rule)] bg-[var(--paper)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--paper)]/75">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--indigo)]">VoiceCart</p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl leading-none">The talking cloth shop</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-base">
            <button type="button" className="btn btn-ghost min-h-11 px-4" onClick={() => setPanelOpen(true)}>
              Tune agent
            </button>
            {user ? (
              <>
                <span className="text-[var(--muted)]">Hello, {user.firstName}</span>
                <button type="button" className="btn-link text-base" onClick={() => void logout()}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <a className="btn-link text-base" href="/login">
                  Log in
                </a>
                <a className="btn btn-solid btn-ink min-h-11 px-5" href="/signup">
                  Sign up
                </a>
              </>
            )}
          </nav>
        </div>
        <div className="tape px-4 py-2 text-center text-[0.95rem]">
          Say the flower, the size, then where to send it. Pay cash when it arrives.
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-2 lg:order-1">
          <label className="sr-only" htmlFor="search">
            Search clothes
          </label>
          <input
            id="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="sunflower, live laugh love, chikankari, nighty…"
            className="field !rounded-full min-h-14 w-full px-5 text-lg"
          />
          <div className="mt-6">
            <ProductGrid products={products} highlightId={cart.lastAddedProductId} />
          </div>
        </div>
        <div className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-20 lg:self-start">
          <VoiceDock
            sid={sid}
            settings={settings}
            onLatency={setTurns}
            onConnectedChange={onConnectedChange}
          />
          <CartRail cart={cart} />
          <LatencyHUD turns={turns} />
        </div>
      </main>

      <ControlPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        settings={settings}
        onChange={changeSettings}
        onApplyLive={() => void applySettings()}
        connected={connected}
      />
    </div>
  );
}

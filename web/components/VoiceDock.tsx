"use client";

import { Room, RoomEvent, Track } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentSettings, TurnLatency } from "@/lib/types";

type Caption = { who: "you" | "shop"; text: string };

export function VoiceDock({
  sid,
  settings,
  onLatency,
  onConnectedChange,
}: {
  sid: string;
  settings: AgentSettings;
  onLatency: (turns: TurnLatency[]) => void;
  onConnectedChange?: (connected: boolean, room: Room | null) => void;
}) {
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    document.querySelectorAll("[data-lk-audio]").forEach((el) => el.remove());
    await room?.disconnect();
    setStatus("idle");
    onConnectedChange?.(false, null);
  }, [onConnectedChange]);

  const connect = useCallback(async () => {
    setError("");
    setStatus("connecting");
    try {
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
        document.querySelectorAll("[data-lk-audio]").forEach((el) => el.remove());
      }
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the call");
      const room = new Room({
        adaptiveStream: false,
        dynacast: false,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      roomRef.current = room;

      room.on(RoomEvent.Disconnected, () => {
        setStatus("idle");
        onConnectedChange?.(false, null);
      });
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        const el = track.attach();
        el.autoplay = true;
        el.setAttribute("playsinline", "");
        el.setAttribute("data-lk-audio", "1");
        document.body.appendChild(el);
        void el.play().catch(() => {
          /* autoplay can expire if the agent joins a few seconds late */
        });
      });
      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        const who = participant?.isLocal ? "you" : "shop";
        for (const segment of segments) {
          const text = segment.text.trim();
          if (!text) continue;
          setCaptions((c) => {
            const last = c[c.length - 1];
            if (!segment.final) {
              if (last && last.who === who) return [...c.slice(0, -1), { who, text }];
              return [...c.slice(-8), { who, text }];
            }
            if (last && last.who === who && last.text === text) return c;
            return [...c.slice(-8), { who, text }];
          });
        }
      });
      room.on(RoomEvent.DataReceived, (payload, _p, _kind, topic) => {
        if (topic !== "latency") return;
        try {
          const parsed = JSON.parse(new TextDecoder().decode(payload)) as { turns?: TurnLatency[] };
          if (parsed.turns) onLatency(parsed.turns);
        } catch {
          /* ignore */
        }
      });

      await room.connect(data.url, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      // Keep an audio context unlocked from the click so a late agent track can play.
      const unlock = new Audio(
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA",
      );
      unlock.muted = true;
      void unlock.play().catch(() => {});
      setMuted(false);
      setStatus("live");
      onConnectedChange?.(true, room);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not start the call");
      await disconnect();
    }
  }, [sid, settings, onLatency, onConnectedChange, disconnect]);

  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }

  useEffect(() => {
    return () => {
      void roomRef.current?.disconnect();
    };
  }, []);

  return (
    <section className="rounded-2xl border border-[var(--rule)] bg-[var(--paper)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--indigo)]">Talk to the shop</p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl">The shop can hear you</h2>
        </div>
        <span
          className={`h-3 w-3 rounded-full ${status === "live" ? "bg-[var(--vat)]" : "bg-[var(--rule)]"}`}
          aria-label={status}
        />
      </div>
      <p className="mt-2 text-[var(--muted)]">
        Press the button and say what you want. She will ask about size and colour before putting it in the bag.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {status === "live" ? (
          <>
            <button
              type="button"
              onClick={toggleMute}
              className="min-h-14 min-w-36 rounded-full bg-[var(--indigo)] px-6 text-lg text-[var(--paper)]"
            >
              {muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              onClick={() => void disconnect()}
              className="min-h-14 rounded-full border border-[var(--rule)] px-6 text-lg"
            >
              End call
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void connect()}
            disabled={status === "connecting"}
            className="min-h-14 min-w-48 rounded-full bg-[var(--madder)] px-8 text-lg text-[var(--paper)]"
          >
            {status === "connecting" ? "Connecting…" : "Start talking"}
          </button>
        )}
      </div>
      {error ? <p className="mt-3 text-[var(--madder)]">{error}</p> : null}
      <div className="tape mt-5 max-h-40 overflow-auto rounded-md px-3 py-2 text-[1.05rem] leading-relaxed">
        {captions.length === 0 ? (
          <p className="text-[var(--ink)]/70">Captions will appear here so the family can follow along.</p>
        ) : (
          captions.map((c, i) => (
            <p key={`${c.who}-${i}`}>
              <span className="font-semibold">{c.who === "you" ? "You" : "Shop"}: </span>
              {c.text}
            </p>
          ))
        )}
      </div>
    </section>
  );
}

export async function publishSettings(room: Room | null, settings: AgentSettings) {
  if (!room) return;
  const payload = new TextEncoder().encode(JSON.stringify({ type: "settings_update", settings }));
  await room.localParticipant.publishData(payload, { topic: "settings_update", reliable: true });
}

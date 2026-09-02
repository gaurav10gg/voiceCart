"use client";

import type { TurnLatency } from "@/lib/types";

function median(nums: number[]) {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function LatencyHUD({ turns }: { turns: TurnLatency[] }) {
  const last = turns[turns.length - 1];
  const totals = turns.map((t) => t.turnTotalMs).filter((n): n is number => typeof n === "number");
  return (
    <section className="rounded-2xl border border-[var(--rule)] bg-[var(--paper)] p-4 text-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--indigo)]">Turn latency</p>
      {!last ? (
        <p className="mt-2 text-[var(--muted)]">Numbers appear after the first spoken turn.</p>
      ) : (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          <dt>STT final</dt>
          <dd>{last.sttFinalMs ?? "—"} ms</dd>
          <dt>LLM first token</dt>
          <dd>{last.llmTtftMs ?? "—"} ms</dd>
          <dt>TTS first audio</dt>
          <dd>{last.ttsTtfbMs ?? "—"} ms</dd>
          <dt>Turn total</dt>
          <dd>{last.turnTotalMs ?? "—"} ms</dd>
          <dt>Median turn</dt>
          <dd>{totals.length ? `${median(totals)} ms` : "—"}</dd>
        </dl>
      )}
    </section>
  );
}

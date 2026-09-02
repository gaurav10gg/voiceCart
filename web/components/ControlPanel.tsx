"use client";

import type { AgentSettings } from "@/lib/types";
import { LLM_MODELS, SPEAKERS, TTS_LANGUAGES } from "@/lib/settings";

export function ControlPanel({
  open,
  onClose,
  settings,
  onChange,
  onApplyLive,
  connected,
}: {
  open: boolean;
  onClose: () => void;
  settings: AgentSettings;
  onChange: (next: AgentSettings) => void;
  onApplyLive: () => void;
  connected: boolean;
}) {
  if (!open) return null;
  const allSpeakers = [...SPEAKERS.female, ...SPEAKERS.male];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <aside className="flex h-full w-full max-w-xl flex-col overflow-auto bg-[var(--paper)] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-3xl">Tune Kamala</h2>
          <button type="button" onClick={onClose} className="min-h-10 px-3 text-lg underline">
            Close
          </button>
        </div>
        <p className="mt-2 text-[var(--muted)]">
          Language, voice, and model save as soon as you change them. Prompt still needs the button below.
          Endpointing delay applies on the next call.
        </p>

        <label className="mt-6 block text-sm font-semibold">System prompt</label>
        <textarea
          value={settings.prompt}
          onChange={(e) => onChange({ ...settings, prompt: e.target.value })}
          className="mt-2 min-h-[280px] w-full rounded-xl border border-[var(--rule)] bg-[var(--linen)] p-3 text-base leading-relaxed"
        />

        <label className="mt-5 block text-sm font-semibold">Voice</label>
        <select
          value={settings.speaker}
          onChange={(e) => onChange({ ...settings, speaker: e.target.value })}
          className="mt-2 min-h-12 w-full rounded-xl border border-[var(--rule)] bg-[var(--linen)] px-3 text-base"
        >
          <optgroup label="Female">
            {SPEAKERS.female.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </optgroup>
          <optgroup label="Male">
            {SPEAKERS.male.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </optgroup>
        </select>
        {!allSpeakers.includes(settings.speaker as (typeof allSpeakers)[number]) ? (
          <p className="mt-1 text-sm">Custom: {settings.speaker}</p>
        ) : null}

        <label className="mt-5 block text-sm font-semibold">Model</label>
        <select
          value={settings.model}
          onChange={(e) => onChange({ ...settings, model: e.target.value })}
          className="mt-2 min-h-12 w-full rounded-xl border border-[var(--rule)] bg-[var(--linen)] px-3 text-base"
        >
          {LLM_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <label className="mt-5 block text-sm font-semibold">Spoken language</label>
        <p className="mt-1 text-sm text-[var(--muted)]">Saved immediately. Kamala will greet and reply in this language.</p>
        <select
          value={settings.language}
          onChange={(e) => onChange({ ...settings, language: e.target.value })}
          className="mt-2 min-h-12 w-full rounded-xl border border-[var(--rule)] bg-[var(--linen)] px-3 text-base"
        >
          {TTS_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label} ({l.code})
            </option>
          ))}
        </select>

        <label className="mt-5 block text-sm font-semibold">
          Speech pace {settings.pace.toFixed(2)}
        </label>
        <input
          type="range"
          min={0.6}
          max={1.4}
          step={0.05}
          value={settings.pace}
          onChange={(e) => onChange({ ...settings, pace: Number(e.target.value) })}
          className="mt-2 w-full"
        />

        <label className="mt-5 block text-sm font-semibold">
          Endpointing delay {settings.minEndpointingDelay.toFixed(2)}s
          <span className="ml-2 font-normal text-[var(--muted)]">applies on reconnect</span>
        </label>
        <input
          type="range"
          min={0.15}
          max={1.0}
          step={0.05}
          value={settings.minEndpointingDelay}
          onChange={(e) => onChange({ ...settings, minEndpointingDelay: Number(e.target.value) })}
          className="mt-2 w-full"
        />

        <button
          type="button"
          onClick={onApplyLive}
          className="mt-6 min-h-12 rounded-full bg-[var(--ink)] text-[var(--paper)]"
        >
          {connected ? "Apply to live call" : "Save for next call"}
        </button>
      </aside>
    </div>
  );
}

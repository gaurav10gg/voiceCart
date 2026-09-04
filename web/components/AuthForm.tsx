"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function guest() {
    await fetch("/api/auth/guest", { method: "POST" });
    router.push("/");
  }

  return (
    <form onSubmit={submit} className="rise card mx-auto max-w-md p-8">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        {mode === "signup" ? "Make an account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-[var(--muted)]">
        Email and a password. You can also continue as a guest — the bag still works.
      </p>
      {mode === "signup" ? (
        <label className="mt-6 block">
          <span className="text-sm font-semibold">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field mt-1 min-h-12 w-full bg-[var(--linen)] px-3 text-lg"
            autoComplete="name"
            required
          />
        </label>
      ) : null}
      <label className="mt-4 block">
        <span className="text-sm font-semibold">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field mt-1 min-h-12 w-full bg-[var(--linen)] px-3 text-lg"
          autoComplete="email"
          required
        />
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-semibold">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field mt-1 min-h-12 w-full bg-[var(--linen)] px-3 text-lg"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={6}
        />
      </label>
      {error ? <p className="mt-3 text-[var(--madder)]">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="btn btn-solid btn-indigo mt-6 min-h-12 w-full text-lg"
      >
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
      </button>
      <button type="button" onClick={() => void guest()} className="btn btn-ghost mt-3 min-h-12 w-full text-lg">
        Continue as guest
      </button>
    </form>
  );
}

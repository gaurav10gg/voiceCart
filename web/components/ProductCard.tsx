"use client";

import { useMemo, useState } from "react";
import { GarmentTile } from "./GarmentTile";
import { printSummary } from "@/lib/describe";
import { availableColors, availableSizes, findVariant } from "@/lib/catalog";
import type { Product } from "@/lib/types";

type Props = {
  product: Product;
  highlighted?: boolean;
  onAdded?: () => void;
};

export function ProductCard({ product, highlighted, onAdded }: Props) {
  const colors = availableColors(product);
  const [color, setColor] = useState(colors[0]?.color ?? "");
  const sizes = availableSizes(product, color);
  const [size, setSize] = useState(sizes[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const variant = useMemo(
    () => findVariant(product, size, color)[0],
    [product, size, color],
  );

  async function add() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, size, color, quantity: 1 }),
      });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Could not add");
      else if (data.status === "needs_clarification") setMsg(data.message);
      else {
        setMsg("In the bag");
        onAdded?.();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={`group rounded-2xl border bg-[var(--paper)] p-3 shadow-[0_1px_0_rgba(28,36,48,0.06)] transition ${
        highlighted ? "border-[var(--turmeric)] ring-2 ring-[var(--turmeric)]" : "border-[var(--rule)]"
      }`}
    >
      <div className="overflow-hidden rounded-xl bg-[var(--linen)]">
        <GarmentTile product={product} variant={variant} className="h-56 w-full" />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--indigo)]">
        {product.brand}
      </p>
      <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl leading-snug text-[var(--ink)]">
        {product.name}
      </h3>
      {product.nameHi || product.nameTa ? (
        <p className="mt-0.5 text-sm leading-snug text-[var(--muted)]">
          {[product.nameHi, product.nameTa].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <p className="mt-1 text-[0.95rem] leading-relaxed text-[var(--muted)]">{printSummary(product)}</p>
      <p className="mt-2 text-lg font-semibold">₹{variant?.price ?? product.basePrice}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c.color}
            type="button"
            aria-label={c.color}
            onClick={() => {
              setColor(c.color);
              const nextSizes = availableSizes(product, c.color);
              if (!nextSizes.includes(size)) setSize(nextSizes[0] ?? "");
            }}
            className={`h-8 w-8 rounded-full border-2 ${color === c.color ? "border-[var(--ink)]" : "border-transparent"}`}
            style={{ background: c.hex }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {sizes.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSize(s)}
            className={`min-h-10 rounded-full px-3 text-sm ${
              size === s ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-[var(--linen)] text-[var(--ink)]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        disabled={busy || !variant}
        className="mt-3 min-h-12 w-full rounded-full bg-[var(--indigo)] text-base text-[var(--paper)] disabled:opacity-50"
      >
        {busy ? "Adding…" : "Add to bag"}
      </button>
      {msg ? <p className="mt-2 text-sm text-[var(--muted)]">{msg}</p> : null}
    </article>
  );
}

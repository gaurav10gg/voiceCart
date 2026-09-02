"use client";

import { ProductCard } from "./ProductCard";
import type { Product } from "@/lib/types";

export function ProductGrid({
  products,
  highlightId,
}: {
  products: Product[];
  highlightId?: string;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} highlighted={p.id === highlightId} />
      ))}
    </div>
  );
}

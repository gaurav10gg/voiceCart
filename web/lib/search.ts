import { PRODUCTS } from "./catalog";
import { FLOWER_SYNONYMS, QUERY_SYNONYMS } from "./locale-names";
import type { Flower, Product } from "./types";
import { printSummary } from "./describe";

const STOP = new Set([
  "the",
  "a",
  "an",
  "one",
  "with",
  "on",
  "it",
  "of",
  "and",
  "for",
  "wali",
  "wala",
  "wale",
]);

function tokens(q: string) {
  const raw = q
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
  const out: string[] = [];
  for (const t of raw) {
    out.push(t);
    const extra = QUERY_SYNONYMS[t];
    if (extra) out.push(...extra);
  }
  return out;
}

function wantedFlower(toks: string[]): Flower | undefined {
  for (const t of toks) {
    const flower = FLOWER_SYNONYMS[t];
    if (flower) return flower;
  }
  return undefined;
}

function blob(p: Product) {
  return [
    p.id,
    p.name,
    p.brand,
    p.category,
    p.fabric,
    p.description,
    p.print.type,
    p.print.flower ?? "",
    p.print.quote ?? "",
    p.print.motif ?? "",
    p.print.placement,
    p.print.scale,
    p.embroidery?.style ?? "",
    p.embroidery?.where ?? "",
    p.neckline ?? "",
    p.sleeve ?? "",
    p.fit ?? "",
    p.occasion ?? "",
    p.aliases.join(" "),
    p.nameHi ?? "",
    p.nameTa ?? "",
    p.variants.map((v) => `${v.color} ${v.size}`).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

const INDEX = PRODUCTS.map((p) => ({ p, blob: blob(p) }));

export type SearchHit = {
  id: string;
  name: string;
  nameHi?: string;
  nameTa?: string;
  brand: string;
  price: number;
  category: string;
  printSummary: string;
  inStockSizes: string[];
  inStockColors: string[];
};

export function searchProducts(query: string, category?: string): SearchHit[] {
  const q = query.trim();
  const toks = tokens(q);
  let list = INDEX;
  if (category) {
    list = list.filter((x) => x.p.category === category);
  }
  if (!q) {
    return list.map(({ p }) => toHit(p));
  }

  const flower = wantedFlower(toks);
  const qLower = q.toLowerCase();

  const scored = list
    .map(({ p, blob }) => {
      let score = 0;
      const name = p.name.toLowerCase();
      if (name.includes(qLower)) score += 50;
      if (p.print.quote && qLower.includes(p.print.quote.toLowerCase())) score += 80;
      if (p.print.flower && qLower.includes(p.print.flower)) score += 60;
      if (flower) {
        if (p.print.flower === flower) score += 100;
        else if (p.print.flower) score -= 80;
      }
      for (const t of toks) {
        const aliasFlower = FLOWER_SYNONYMS[t];
        if (aliasFlower && p.print.flower !== aliasFlower) continue;
        if (blob.includes(t)) score += 8;
        if (name.includes(t)) score += 6;
        if (p.aliases.some((a) => a.toLowerCase().includes(t))) score += 10;
      }
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 5).map((x) => toHit(x.p));
}

function toHit(p: Product): SearchHit {
  const stock = p.variants.filter((v) => v.stock > 0);
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: p.basePrice,
    category: p.category,
    printSummary: printSummary(p),
    nameHi: p.nameHi,
    nameTa: p.nameTa,
    inStockSizes: [...new Set(stock.map((v) => v.size))],
    inStockColors: [...new Set(stock.map((v) => v.color))],
  };
}

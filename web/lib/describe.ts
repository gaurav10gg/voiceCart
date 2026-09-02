import type { Product } from "./types";

export function printSummary(p: Product): string {
  const pr = p.print;
  if (pr.type === "text" && pr.quote) {
    const font = pr.quoteFont === "script" ? "curly script" : pr.quoteFont === "handwritten" ? "handwritten" : "block letters";
    return `says "${pr.quote}" in ${font} on the ${humanPlacement(pr.placement)}`;
  }
  if (pr.flower) {
    return `${pr.scale} ${pr.motifColor} ${pr.flower} on the ${humanPlacement(pr.placement)}`;
  }
  if (pr.motif) {
    return `${pr.scale} ${pr.motif} on the ${humanPlacement(pr.placement)}`;
  }
  if (pr.type === "solid") return "plain, no print";
  return `${pr.type} print`;
}

function humanPlacement(p: Product["print"]["placement"]) {
  switch (p) {
    case "chest-center":
      return "chest";
    case "all-over":
      return "whole garment";
    case "pallu":
      return "pallu";
    default:
      return p.replace("-", " ");
  }
}

export function describeProduct(p: Product): string {
  const parts: string[] = [];
  parts.push(`${p.brand} ${p.name}. ${p.fabric}.`);
  if (p.nameHi) parts.push(`Hindi name: ${p.nameHi}.`);
  if (p.nameTa) parts.push(`Tamil name: ${p.nameTa}.`);
  parts.push(p.description);
  parts.push(`Print: ${printSummary(p)}.`);
  if (p.embroidery) {
    parts.push(`Embroidery: ${p.embroidery.style} on the ${p.embroidery.where}, ${p.embroidery.threadColor} thread.`);
  }
  if (p.neckline) parts.push(`Neckline: ${p.neckline}.`);
  if (p.sleeve) parts.push(`Sleeves: ${p.sleeve}.`);
  if (p.fit) parts.push(`Fit: ${p.fit}.`);
  if (p.pockets) parts.push("Has pockets.");
  if (p.care) parts.push(`Care: ${p.care}.`);
  const stock = p.variants.filter((v) => v.stock > 0);
  const sizes = [...new Set(stock.map((v) => v.size))].join(", ") || "none in stock";
  const colors = [...new Set(stock.map((v) => v.color))].join(", ") || "none in stock";
  parts.push(`In stock sizes: ${sizes}. In stock colours: ${colors}. Price from ₹${p.basePrice}.`);
  return parts.join(" ");
}

import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/search";
import { PRODUCTS } from "@/lib/catalog";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const category = url.searchParams.get("category") ?? undefined;
  if (!q && !category) {
    return NextResponse.json({
      products: PRODUCTS.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        price: p.basePrice,
        fabric: p.fabric,
        print: p.print,
        embroidery: p.embroidery,
        aliases: p.aliases,
        nameHi: p.nameHi,
        nameTa: p.nameTa,
        variants: p.variants,
      })),
    });
  }
  return NextResponse.json({ products: searchProducts(q, category) });
}

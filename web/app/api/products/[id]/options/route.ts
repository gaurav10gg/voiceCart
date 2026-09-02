import { NextResponse } from "next/server";
import { availableColors, availableSizes, getProduct, inStockVariants } from "@/lib/catalog";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const product = getProduct(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  const stock = inStockVariants(product);
  return NextResponse.json({
    productId: product.id,
    name: product.name,
    nameHi: product.nameHi,
    nameTa: product.nameTa,
    size: availableSizes(product),
    color: availableColors(product).map((c) => c.color),
    variants: stock.map((v) => ({ sku: v.sku, size: v.size, color: v.color, price: v.price, stock: v.stock })),
  });
}

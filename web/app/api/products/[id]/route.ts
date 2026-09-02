import { NextResponse } from "next/server";
import { getProduct } from "@/lib/catalog";
import { describeProduct } from "@/lib/describe";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const product = getProduct(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ product, description: describeProduct(product) });
}

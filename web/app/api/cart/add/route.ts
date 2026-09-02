import { NextResponse } from "next/server";
import { getSidFromCookies } from "@/lib/auth";
import { addToCart } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    sid?: string;
    productId?: string;
    quantity?: number;
    size?: string;
    color?: string;
  };
  const sid = body.sid || (await getSidFromCookies());
  if (!sid) return NextResponse.json({ error: "Missing session" }, { status: 400 });
  if (!body.productId) return NextResponse.json({ error: "Missing product" }, { status: 400 });
  const result = addToCart(sid, body.productId, body.quantity ?? 1, body.size, body.color);
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}

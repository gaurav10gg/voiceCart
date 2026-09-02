import { NextResponse } from "next/server";
import { getSidFromCookies } from "@/lib/auth";
import { removeFromCart } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json()) as { sid?: string; sku?: string; product_id?: string };
  const sid = body.sid || (await getSidFromCookies());
  if (!sid) return NextResponse.json({ error: "Missing session" }, { status: 400 });
  if (!body.sku) return NextResponse.json({ error: "Missing sku" }, { status: 400 });
  const result = removeFromCart(sid, body.sku);
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}

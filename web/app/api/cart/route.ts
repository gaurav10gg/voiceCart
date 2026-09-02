import { NextResponse } from "next/server";
import { getSidFromCookies } from "@/lib/auth";
import { getCart } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sid = url.searchParams.get("sid") || (await getSidFromCookies());
  if (!sid) return NextResponse.json({ error: "Missing session" }, { status: 400 });
  return NextResponse.json(getCart(sid));
}

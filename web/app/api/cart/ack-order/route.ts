import { NextResponse } from "next/server";
import { getSidFromCookies } from "@/lib/auth";
import { ackLastOrder } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sid?: string };
  const sid = body.sid || (await getSidFromCookies());
  if (!sid) return NextResponse.json({ error: "Missing session" }, { status: 400 });
  return NextResponse.json(ackLastOrder(sid));
}

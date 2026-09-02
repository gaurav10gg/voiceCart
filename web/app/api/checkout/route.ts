import { NextResponse } from "next/server";
import { spokenReadback } from "@/lib/address";
import { getSidFromCookies, getUserFromCookies } from "@/lib/auth";
import { checkout } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sid?: string };
  const sid = body.sid || (await getSidFromCookies());
  if (!sid) return NextResponse.json({ error: "Missing session" }, { status: 400 });
  const user = await getUserFromCookies();
  const result = checkout(sid, user?.name);
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  if ("status" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({
    orderId: result.id,
    items: result.items,
    total: result.total,
    address: result.address,
    payment: result.payment,
    spokenReadback: spokenReadback(result.address),
  });
}

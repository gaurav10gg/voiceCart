import { NextResponse } from "next/server";
import { clearAuthCookie, newGuestSid, setSidCookie } from "@/lib/auth";

export async function POST() {
  await clearAuthCookie();
  const sid = newGuestSid();
  await setSidCookie(sid);
  return NextResponse.json({ ok: true, sid });
}

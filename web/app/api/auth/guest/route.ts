import { NextResponse } from "next/server";
import { getSidFromCookies, getUserFromCookies, newGuestSid, setSidCookie } from "@/lib/auth";

export async function POST() {
  const user = await getUserFromCookies();
  if (user) {
    const sid = `user:${user.id}`;
    await setSidCookie(sid);
    return NextResponse.json({ sid, guest: false });
  }
  const existing = await getSidFromCookies();
  if (existing) return NextResponse.json({ sid: existing, guest: true });
  const sid = newGuestSid();
  await setSidCookie(sid);
  return NextResponse.json({ sid, guest: true });
}

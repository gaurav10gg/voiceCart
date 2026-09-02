import { NextResponse } from "next/server";
import { getSidFromCookies, getUserFromCookies, toPublic } from "@/lib/auth";

export async function GET() {
  const user = await getUserFromCookies();
  const sid = await getSidFromCookies();
  return NextResponse.json({ user: user ? toPublic(user) : null, sid });
}

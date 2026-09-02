import { NextResponse } from "next/server";
import { attachUserSession, getSidFromCookies, login, toPublic } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; password?: string };
  const result = login(body.email ?? "", body.password ?? "");
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  const guestSid = await getSidFromCookies();
  await attachUserSession(result, guestSid);
  return NextResponse.json({ user: toPublic(result) });
}

import { NextResponse } from "next/server";
import { attachUserSession, getSidFromCookies, signup, toPublic } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string; email?: string; password?: string };
  const result = signup(body.name ?? "", body.email ?? "", body.password ?? "");
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  const guestSid = await getSidFromCookies();
  await attachUserSession(result, guestSid);
  return NextResponse.json({ user: toPublic(result) });
}

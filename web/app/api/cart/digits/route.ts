import { NextResponse } from "next/server";
import { getSidFromCookies } from "@/lib/auth";
import { collectDigits } from "@/lib/store";
import type { DigitField } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    sid?: string;
    spoken?: string;
    field?: DigitField;
  };
  const sid = body.sid || (await getSidFromCookies());
  if (!sid) return NextResponse.json({ error: "Missing session" }, { status: 400 });
  if (!body.spoken?.trim()) {
    return NextResponse.json({ error: "Missing digits" }, { status: 400 });
  }
  return NextResponse.json(collectDigits(sid, body.spoken, body.field));
}

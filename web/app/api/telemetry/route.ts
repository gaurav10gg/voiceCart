import { NextResponse } from "next/server";
import { getSidFromCookies } from "@/lib/auth";
import { agentAuthorized } from "@/lib/http";
import { addTelemetry, getTelemetry } from "@/lib/store";
import type { TurnLatency } from "@/lib/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sid = url.searchParams.get("sid") || (await getSidFromCookies());
  if (!sid) return NextResponse.json({ error: "Missing session" }, { status: 400 });
  return NextResponse.json({ turns: getTelemetry(sid) });
}

export async function POST(req: Request) {
  if (!agentAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as { sid?: string; turn?: TurnLatency };
  if (!body.sid || !body.turn) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  addTelemetry(body.sid, body.turn);
  return NextResponse.json({ ok: true });
}

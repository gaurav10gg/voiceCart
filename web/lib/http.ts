import { NextResponse } from "next/server";

export function agentAuthorized(req: Request) {
  const secret = process.env.AGENT_SHARED_SECRET || "dev-agent-secret-change-me";
  const header = req.headers.get("x-agent-secret");
  return header === secret;
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function readJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}

export function sidFrom(req: Request, body?: { sid?: string }) {
  const url = new URL(req.url);
  return body?.sid || url.searchParams.get("sid") || "";
}

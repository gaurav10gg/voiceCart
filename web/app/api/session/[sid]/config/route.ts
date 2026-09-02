import { NextResponse } from "next/server";
import { defaultSettings } from "@/lib/settings";
import { getConfig, saveConfig, updateSettings } from "@/lib/store";
import type { AgentSettings } from "@/lib/types";

export async function GET(req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const { sid } = await ctx.params;
  const key = decodeURIComponent(sid);
  const cfg = getConfig(key);
  if (!cfg) {
    return NextResponse.json({
      sid: key,
      roomName: key.startsWith("vc-") ? key : undefined,
      settings: defaultSettings(),
    });
  }
  return NextResponse.json(cfg);
}

export async function PUT(req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const { sid } = await ctx.params;
  const key = decodeURIComponent(sid);
  const body = (await req.json()) as { settings?: Partial<AgentSettings>; shopperName?: string; sid?: string; roomName?: string };
  let cfg = getConfig(key);
  if (!cfg) {
    cfg = {
      sid: body.sid || key,
      roomName: body.roomName || key,
      shopperName: body.shopperName,
      settings: { ...defaultSettings(), ...body.settings },
    };
    saveConfig(cfg.roomName, cfg);
    return NextResponse.json(cfg);
  }
  if (body.shopperName) cfg.shopperName = body.shopperName;
  if (body.settings) updateSettings(key, body.settings);
  return NextResponse.json(getConfig(key));
}

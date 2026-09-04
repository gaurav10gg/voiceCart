import { NextResponse } from "next/server";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { getSidFromCookies, getUserFromCookies } from "@/lib/auth";
import { callRoomName, defaultSettings } from "@/lib/settings";
import { saveConfig } from "@/lib/store";
import type { AgentSettings } from "@/lib/types";

export async function POST(req: Request) {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "LiveKit is not configured. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to web/.env.local." },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    sid?: string;
    settings?: Partial<AgentSettings>;
  };
  const cookieSid = await getSidFromCookies();
  const sid = body.sid || cookieSid;
  if (!sid) return NextResponse.json({ error: "Missing session" }, { status: 400 });

  const user = await getUserFromCookies();
  const roomName = callRoomName(sid);
  const settings = { ...defaultSettings(), ...body.settings };
  saveConfig(roomName, {
    sid,
    roomName,
    shopperName: user?.name.split(/\s+/)[0],
    settings,
  });

  const roomService = new RoomServiceClient(url, apiKey, apiSecret);
  try {
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 60 * 5,
      departureTimeout: 20,
      metadata: JSON.stringify({ sid }),
    });
  } catch {
    try {
      await roomService.updateRoomMetadata(roomName, JSON.stringify({ sid }));
    } catch {
      /* room may already exist with metadata */
    }
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: `shopper-${sid.slice(0, 16)}-${Date.now().toString(36)}`,
    name: user?.name || "Guest",
    ttl: "1h",
  });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: true });
  const token = await at.toJwt();
  return NextResponse.json({ token, url, room: roomName, sid });
}

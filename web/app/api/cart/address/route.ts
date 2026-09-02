import { NextResponse } from "next/server";
import { spokenReadback } from "@/lib/address";
import { getSidFromCookies } from "@/lib/auth";
import { saveAddress } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    sid?: string;
    spoken?: string;
    line1?: string;
    house?: string;
    area?: string;
    city?: string;
    pincode?: string;
    phone?: string;
    landmark?: string;
  };
  const sid = body.sid || (await getSidFromCookies());
  if (!sid) return NextResponse.json({ error: "Missing session" }, { status: 400 });
  const result = saveAddress(sid, {
    spoken: body.spoken,
    line1: body.line1 || body.house,
    area: body.area,
    city: body.city,
    pincode: body.pincode,
    phone: body.phone,
    landmark: body.landmark,
  });
  if ("status" in result) {
    return NextResponse.json(result);
  }
  const next = !result.pincode ? "pincode" : "confirm";
  return NextResponse.json({
    ...result,
    ok: true,
    next,
    spokenReadback: spokenReadback(result),
    payment: "cod",
    message:
      next === "pincode"
        ? "House and city saved. Ask only for the six-digit pin, slowly."
        : "Address saved. Read it back once and ask to place the cash-on-delivery order. Do not ask for more street names.",
  });
}

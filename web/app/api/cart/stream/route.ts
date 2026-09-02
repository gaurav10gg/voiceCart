import { getSidFromCookies } from "@/lib/auth";
import { getCart, subscribeCart } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sid = url.searchParams.get("sid") || (await getSidFromCookies());
  if (!sid) return new Response("Missing session", { status: 400 });

  const encoder = new TextEncoder();
  let unsub: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* closed */
        }
      };
      send(getCart(sid));
      unsub = subscribeCart(sid, send);
      heartbeat = setInterval(() => send(getCart(sid)), 2000);
      req.signal.addEventListener("abort", () => {
        unsub?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsub?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

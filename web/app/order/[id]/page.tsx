"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatAddressLines } from "@/lib/address";
import type { Order } from "@/lib/types";

const SEEN_ORDER_KEY = "voicecart:seen-order";

async function leaveOrderSlip(id?: string) {
  if (id) {
    try {
      sessionStorage.setItem(SEEN_ORDER_KEY, id);
    } catch {
      /* private mode */
    }
  }
  await fetch("/api/cart/ack-order", { method: "POST" }).catch(() => undefined);
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void (async () => {
      const { id } = await params;
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) {
        setMissing(true);
        return;
      }
      setOrder(await res.json());
    })();
  }, [params]);

  if (missing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <p>We could not find that order.</p>
        <Link href="/" className="underline" onClick={() => void leaveOrderSlip()}>
          Back to the shop
        </Link>
      </div>
    );
  }

  if (!order) return <p className="p-8">Loading the order…</p>;

  const when = new Date(order.createdAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <button
        type="button"
        className="btn-link mb-6 text-base"
        onClick={() => {
          void leaveOrderSlip(order.id);
          router.replace("/");
        }}
      >
        ← Back to the shop
      </button>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--indigo)]">On its way</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl">
        {order.shopperName ? `Thank you, ${order.shopperName.split(" ")[0]}` : "Order placed"}
      </h1>
      <p className="mt-2 text-[var(--muted)]">
        Slip {order.id} · {when}
      </p>

      <article className="rise card relative mt-8 overflow-hidden p-6 shadow-[0_12px_40px_rgba(28,36,48,0.08)]">
        <div className="absolute inset-x-6 top-0 h-2 bg-[repeating-linear-gradient(-12deg,var(--tape)_0_12px,#f0d78a_12px_24px)]" />
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--indigo)]">Deliver to</p>
            <div className="mt-2 text-lg leading-snug">
              {formatAddressLines(order.address).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <p className="rotate-[-8deg] rounded-sm border-2 border-[var(--madder)] px-2 py-1 text-center text-[0.7rem] font-bold tracking-[0.14em] text-[var(--madder)]">
            CASH ON
            <br />
            DELIVERY
          </p>
        </div>

        <ul className="mt-8 space-y-3">
          {order.items.map((item) => (
            <li key={item.sku} className="flex justify-between gap-4 border-b border-[var(--rule)] pb-3">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-[var(--muted)]">
                  {item.color}, size {item.size} · {item.printSummary}
                </p>
              </div>
              <p>
                {item.quantity} × ₹{item.unitPrice}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-2xl font-semibold">Pay ₹{order.total} when it arrives</p>
        <p className="mt-2 text-[var(--muted)]">No card. No UPI. Give cash to the delivery person.</p>
      </article>

      <button
        type="button"
        className="btn btn-solid btn-ink mt-8 min-h-12 px-6 py-3"
        onClick={() => {
          void leaveOrderSlip(order.id);
          router.replace("/");
        }}
      >
        Keep shopping
      </button>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatAddressLines } from "@/lib/address";
import type { Cart, DeliveryAddress, DigitField } from "@/lib/types";

export function CartRail({ cart }: { cart: Cart }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [house, setHouse] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!cart.address) return;
    setHouse(cart.address.line1 || "");
    setCity(cart.address.city || "");
    setPincode(cart.address.pincode || "");
    setPhone(cart.address.phone || "");
  }, [cart.address]);

  async function remove(sku: string) {
    await fetch("/api/cart/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku }),
    });
  }

  async function saveTypedAddress() {
    const res = await fetch("/api/cart/address", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line1: house, city, pincode, phone }),
    });
    return res.json();
  }

  async function placeOrder() {
    setBusy(true);
    setError("");
    try {
      if (!cart.address?.pincode || !cart.address.line1 || !cart.address.city) {
        const saved = await saveTypedAddress();
        if (saved.status === "needs_address") {
          setError(saved.message || "Tell the shop the house, city, and pin code.");
          return;
        }
        if (saved.error) {
          setError(saved.error);
          return;
        }
      }
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (data.status === "needs_address") {
        setError(data.message || "Need a delivery address first.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Could not place the order");
        return;
      }
      try {
        sessionStorage.setItem("voicecart:seen-order", data.orderId);
      } catch {
        /* private mode */
      }
      router.push(`/order/${data.orderId}`);
    } finally {
      setBusy(false);
    }
  }

  const address = cart.address;
  const collecting = cart.digitField === "pincode" || cart.digitField === "phone";
  const addressReady = !!(address && address.line1 && address.city && address.pincode) && !collecting;

  return (
    <aside className="rounded-2xl border border-[var(--rule)] bg-[var(--paper)] p-5">
      <h2 className="font-[family-name:var(--font-display)] text-2xl">Your bag</h2>
      {cart.items.length === 0 ? (
        <p className="mt-3 text-[var(--muted)]">Empty. Talk to the shop or tap Add to bag.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {cart.items.map((item) => (
            <li key={item.sku} className="border-b border-[var(--rule)] pb-3">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold leading-snug">{item.name}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {item.color}, size {item.size} · {item.printSummary}
                  </p>
                  <p className="text-sm">
                    {item.quantity} × ₹{item.unitPrice}
                  </p>
                </div>
                <button type="button" className="text-sm underline" onClick={() => remove(item.sku)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xl font-semibold">Total ₹{cart.total}</p>

      {cart.items.length > 0 ? (
        <AddressSlip
          address={address}
          ready={addressReady}
          house={house}
          city={city}
          pincode={pincode}
          phone={phone}
          pinHeard={cart.pinBuffer || ""}
          phoneHeard={cart.phoneBuffer || ""}
          digitField={cart.digitField}
          onHouse={setHouse}
          onCity={setCity}
          onPin={setPincode}
          onPhone={setPhone}
        />
      ) : null}

      <button
        type="button"
        onClick={() => void placeOrder()}
        disabled={busy || cart.items.length === 0}
        className="mt-4 min-h-12 w-full rounded-full bg-[var(--vat)] text-[var(--paper)] disabled:opacity-40"
      >
        {busy ? "Placing…" : "Place COD order"}
      </button>
      {error ? <p className="mt-2 text-sm text-[var(--madder)]">{error}</p> : null}
    </aside>
  );
}

function AddressSlip({
  address,
  ready,
  house,
  city,
  pincode,
  phone,
  pinHeard,
  phoneHeard,
  digitField,
  onHouse,
  onCity,
  onPin,
  onPhone,
}: {
  address?: DeliveryAddress;
  ready: boolean;
  house: string;
  city: string;
  pincode: string;
  phone: string;
  pinHeard: string;
  phoneHeard: string;
  digitField?: DigitField;
  onHouse: (v: string) => void;
  onCity: (v: string) => void;
  onPin: (v: string) => void;
  onPhone: (v: string) => void;
}) {
  const pinSlots = `${(pinHeard || pincode).padEnd(6, "·")}`;
  const phoneSlots = `${(phoneHeard || phone).padEnd(10, "·")}`;
  return (
    <div className="mt-4 rounded-xl border border-dashed border-[var(--indigo)]/40 bg-[var(--linen)] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--indigo)]">Send here</p>
        <p className="rounded-sm bg-[var(--madder)] px-2 py-0.5 text-[0.7rem] font-bold tracking-wide text-[var(--paper)]">
          CASH ON DELIVERY
        </p>
      </div>
      {ready && address ? (
        <div className="mt-2 text-[1.05rem] leading-snug">
          {formatAddressLines(address).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="mt-2 text-sm text-[var(--muted)]">Pay when it arrives. No card, no UPI.</p>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-[var(--muted)]">Tell the shop the house and city. Then the pin, slowly, all six digits.</p>
          {digitField === "pincode" || pinHeard ? (
            <p className="font-mono text-lg tracking-[0.2em]">PIN {pinSlots}</p>
          ) : null}
          {digitField === "phone" || phoneHeard ? (
            <p className="font-mono text-lg tracking-[0.2em]">TEL {phoneSlots}</p>
          ) : null}
          <input
            value={house}
            onChange={(e) => onHouse(e.target.value)}
            placeholder="House and street"
            className="min-h-11 w-full rounded-lg border border-[var(--rule)] bg-[var(--paper)] px-3 text-base"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={city}
              onChange={(e) => onCity(e.target.value)}
              placeholder="City"
              className="min-h-11 w-full rounded-lg border border-[var(--rule)] bg-[var(--paper)] px-3 text-base"
            />
            <input
              value={pincode}
              onChange={(e) => onPin(e.target.value)}
              placeholder="Pin code"
              inputMode="numeric"
              className="min-h-11 w-full rounded-lg border border-[var(--rule)] bg-[var(--paper)] px-3 text-base"
            />
          </div>
          <input
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
            placeholder="Phone, if you like"
            inputMode="tel"
            className="min-h-11 w-full rounded-lg border border-[var(--rule)] bg-[var(--paper)] px-3 text-base"
          />
        </div>
      )}
    </div>
  );
}

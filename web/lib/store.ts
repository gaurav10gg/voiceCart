import { EventEmitter } from "node:events";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { availableColors, availableSizes, findVariant, getProduct, getVariant } from "./catalog";
import { printSummary } from "./describe";
import { addressReady, collectDigitBuffer, digitProgressMessage, mergeAddress, needsAddress, type AddressDraft } from "./address";
import type { AgentSettings, Cart, CartItem, DeliveryAddress, DigitField, NeedsAddress, NeedsClarification, Order, SessionConfig, TurnLatency } from "./types";

const carts = new Map<string, Cart>();
const orders = new Map<string, Order>();
const configs = new Map<string, SessionConfig>();
const telemetry = new Map<string, TurnLatency[]>();
const bus = new EventEmitter();
bus.setMaxListeners(200);

const STORE_FILE = process.env.STORE_FILE || "/app/data/store.json";

function persist() {
  try {
    mkdirSync(dirname(STORE_FILE), { recursive: true });
    writeFileSync(
      STORE_FILE,
      JSON.stringify({
        carts: Object.fromEntries(carts),
        orders: Object.fromEntries(orders),
        configs: Object.fromEntries(configs),
      }),
    );
  } catch {
    /* local next dev may not have /app/data */
  }
}

try {
  const saved = JSON.parse(readFileSync(/*turbopackIgnore: true*/ STORE_FILE, "utf8")) as {
    carts?: Record<string, Cart>;
    orders?: Record<string, Order>;
    configs?: Record<string, SessionConfig>;
  };
  for (const [key, value] of Object.entries(saved.carts || {})) carts.set(key, value);
  for (const [key, value] of Object.entries(saved.orders || {})) orders.set(key, value);
  for (const [key, value] of Object.entries(saved.configs || {})) configs.set(key, value);
} catch {
  /* first boot */
}

function emptyCart(sid: string): Cart {
  return { sid, items: [], total: 0, itemCount: 0, pinBuffer: "", phoneBuffer: "" };
}

function totals(cart: Cart) {
  cart.total = cart.items.reduce((s, i) => s + i.lineTotal, 0);
  cart.itemCount = cart.items.reduce((s, i) => s + i.quantity, 0);
}

function emit(sid: string) {
  bus.emit(`cart:${sid}`, getCart(sid));
  persist();
}

export function subscribeCart(sid: string, fn: (cart: Cart) => void) {
  const ev = `cart:${sid}`;
  bus.on(ev, fn);
  return () => bus.off(ev, fn);
}

export function getCart(sid: string): Cart {
  if (!carts.has(sid)) carts.set(sid, emptyCart(sid));
  return carts.get(sid)!;
}

export function addToCart(
  sid: string,
  productId: string,
  quantity: number,
  size?: string,
  color?: string,
): Cart | NeedsClarification | { error: string } {
  const product = getProduct(productId);
  if (!product) return { error: "I could not find that item." };
  const qty = Math.max(1, Math.min(10, Math.floor(quantity || 1)));
  const matches = findVariant(product, size, color);
  if (matches.length === 0) {
    return {
      error: `That size or colour is not in stock for ${product.name}.`,
    };
  }
  if (matches.length > 1) {
    const missing: Array<"size" | "color"> = [];
    if (!size) missing.push("size");
    if (!color) missing.push("color");
    if (missing.length === 0) {
      return { error: "I found more than one match. Please name the size and colour." };
    }
    const sizes = availableSizes(product, color);
    const colors = availableColors(product, size).map((c) => c.color);
    const message =
      missing.includes("size") && missing.includes("color")
        ? `${product.name} comes in sizes ${sizes.join(", ")} and colours ${colors.join(", ")}. Which would you like?`
        : missing.includes("size")
          ? `Which size — ${sizes.join(", ")}?`
          : `Which colour — ${colors.join(", ")}?`;
    return {
      status: "needs_clarification",
      productId: product.id,
      product: product.name,
      missing,
      options: { size: sizes, color: colors },
      message,
    };
  }
  const variant = matches[0];
  if (variant.stock < qty) {
    return { error: `Only ${variant.stock} left in ${variant.color}, size ${variant.size}.` };
  }
  const cart = getCart(sid);
  const existing = cart.items.find((i) => i.sku === variant.sku);
  if (existing) {
    existing.quantity += qty;
    existing.lineTotal = existing.quantity * existing.unitPrice;
  } else {
    const item: CartItem = {
      sku: variant.sku,
      productId: product.id,
      name: product.name,
      brand: product.brand,
      size: variant.size,
      color: variant.color,
      hex: variant.hex,
      quantity: qty,
      unitPrice: variant.price,
      lineTotal: variant.price * qty,
      printSummary: printSummary(product),
    };
    cart.items.push(item);
  }
  variant.stock -= qty;
  cart.lastAddedProductId = product.id;
  cart.lastAddedSku = variant.sku;
  totals(cart);
  emit(sid);
  return cart;
}

export function removeFromCart(sid: string, sku: string): Cart | { error: string } {
  const cart = getCart(sid);
  const idx = cart.items.findIndex((i) => i.sku === sku);
  if (idx === -1) return { error: "That item is not in the bag." };
  const [removed] = cart.items.splice(idx, 1);
  const found = getVariant(sku);
  if (found) found.variant.stock += removed.quantity;
  totals(cart);
  emit(sid);
  return cart;
}

export function saveAddress(sid: string, draft: AddressDraft): DeliveryAddress | NeedsAddress {
  const cart = getCart(sid);
  const address = mergeAddress(cart.address, draft);
  cart.address = address;
  if (address.pincode) cart.pinBuffer = address.pincode;
  if (address.phone) cart.phoneBuffer = address.phone;
  if (!address.pincode && address.line1 && address.city) cart.digitField = "pincode";
  emit(sid);
  if (!addressReady(address)) return needsAddress(address);
  return address;
}

export function collectDigits(sid: string, spoken: string, field?: DigitField) {
  const cart = getCart(sid);
  const address = cart.address ?? { line1: "", city: "", pincode: "" };
  const resolved: DigitField =
    field ||
    cart.digitField ||
    (address.pincode ? "phone" : "pincode");
  if (/(no phone|skip phone|don't have|dont have|\bnahi\b|வேண்டாம்)/i.test(spoken) && resolved === "phone") {
    cart.digitField = undefined;
    emit(sid);
    return {
      status: "collecting_digits" as const,
      field: "phone" as const,
      buffer: cart.phoneBuffer || "",
      have: (cart.phoneBuffer || "").length,
      need: 0,
      ready: true,
      hearBack: "",
      next: "confirm" as const,
      message: "Okay, no phone number.",
    };
  }
  const previous = resolved === "pincode" ? cart.pinBuffer || address.pincode || "" : cart.phoneBuffer || address.phone || "";
  const { buffer, ready } = collectDigitBuffer(resolved, spoken, previous);
  if (resolved === "pincode") {
    cart.pinBuffer = buffer;
    if (ready) {
      cart.address = { ...address, pincode: buffer };
      cart.digitField = "phone";
    } else {
      cart.digitField = "pincode";
    }
  } else {
    cart.phoneBuffer = buffer;
    if (ready) {
      cart.address = { ...address, phone: buffer };
      cart.digitField = undefined;
    } else {
      cart.digitField = "phone";
    }
  }
  emit(sid);
  return digitProgressMessage(resolved, buffer, ready);
}

export function checkout(sid: string, shopperName?: string): Order | { error: string } | NeedsAddress {
  const cart = getCart(sid);
  if (cart.items.length === 0) return { error: "The bag is empty." };
  const address = cart.address;
  if (!addressReady(address)) {
    return needsAddress(address ?? { line1: "", city: "", pincode: "" });
  }
  const order: Order = {
    id: randomBytes(5).toString("hex"),
    sid,
    items: cart.items.map((i) => ({ ...i })),
    total: cart.total,
    createdAt: Date.now(),
    shopperName,
    address,
    payment: "cod",
  };
  orders.set(order.id, order);
  const next = emptyCart(sid);
  next.lastOrderId = order.id;
  carts.set(sid, next);
  emit(sid);
  return order;
}

export function getOrder(id: string) {
  return orders.get(id);
}

export function ackLastOrder(sid: string) {
  const cart = getCart(sid);
  if (!cart.lastOrderId) return cart;
  delete cart.lastOrderId;
  emit(sid);
  return cart;
}

export function mergeCarts(fromSid: string, toSid: string) {
  const from = carts.get(fromSid);
  if (!from || from.items.length === 0) return getCart(toSid);
  const to = getCart(toSid);
  for (const item of from.items) {
    const existing = to.items.find((i) => i.sku === item.sku);
    if (existing) {
      existing.quantity += item.quantity;
      existing.lineTotal = existing.quantity * existing.unitPrice;
    } else {
      to.items.push({ ...item });
    }
  }
  if (!to.address && from.address) to.address = from.address;
  totals(to);
  carts.delete(fromSid);
  emit(toSid);
  return to;
}

export function saveConfig(roomName: string, config: SessionConfig) {
  configs.set(roomName, config);
  configs.set(config.sid, config);
  persist();
}

export function getConfig(key: string) {
  return configs.get(key);
}

export function updateSettings(key: string, settings: Partial<AgentSettings>) {
  const cfg = configs.get(key);
  if (!cfg) return null;
  cfg.settings = { ...cfg.settings, ...settings };
  configs.set(cfg.roomName, cfg);
  configs.set(cfg.sid, cfg);
  persist();
  return cfg;
}

export function addTelemetry(sid: string, turn: TurnLatency) {
  const list = telemetry.get(sid) ?? [];
  list.push(turn);
  telemetry.set(sid, list.slice(-20));
  bus.emit(`tel:${sid}`, list);
}

export function getTelemetry(sid: string) {
  return telemetry.get(sid) ?? [];
}

export function subscribeTelemetry(sid: string, fn: (turns: TurnLatency[]) => void) {
  const ev = `tel:${sid}`;
  bus.on(ev, fn);
  return () => bus.off(ev, fn);
}

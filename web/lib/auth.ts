import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { mergeCarts } from "./store";
import type { PublicUser } from "./types";

type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: number;
};

const users = new Map<string, User>();
const usersByEmail = new Map<string, User>();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const AUTH_COOKIE = "vc_session";
const SID_COOKIE = "vc_sid";

function secret() {
  return process.env.AUTH_SECRET || "dev-auth-secret-change-me";
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const a = Buffer.from(hash, "hex");
  if (a.length !== test.length) return false;
  return timingSafeEqual(a, test);
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encodeSession(uid: string) {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 1000 * 60 * 60 * 24 * 14 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { uid: string; exp: number };
    if (data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  };
}

export async function getSidFromCookies(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SID_COOKIE)?.value ?? null;
}

export async function getUserFromCookies(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const uid = decodeSession(token);
  if (!uid) return null;
  return users.get(uid) ?? null;
}

export function toPublic(user: User): PublicUser {
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  return { id: user.id, name: user.name, firstName, email: user.email };
}

export async function setSidCookie(sid: string) {
  const jar = await cookies();
  jar.set(SID_COOKIE, sid, cookieOptions());
}

export async function setAuthCookie(uid: string) {
  const jar = await cookies();
  jar.set(AUTH_COOKIE, encodeSession(uid), cookieOptions());
}

export async function clearAuthCookie() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
}

function rateLimited(email: string) {
  const now = Date.now();
  const rec = loginAttempts.get(email);
  if (!rec || rec.resetAt < now) {
    loginAttempts.set(email, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  rec.count += 1;
  return rec.count > 8;
}

export function signup(name: string, email: string, password: string): User | { error: string } {
  const e = email.trim().toLowerCase();
  if (!name.trim()) return { error: "Please tell us your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: "That email does not look right." };
  if (password.length < 6) return { error: "Please use at least 6 characters for the password." };
  if (usersByEmail.has(e)) return { error: "An account with that email already exists. Try logging in." };
  const user: User = {
    id: randomBytes(8).toString("hex"),
    name: name.trim(),
    email: e,
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
  };
  users.set(user.id, user);
  usersByEmail.set(e, user);
  return user;
}

export function login(email: string, password: string): User | { error: string } {
  const e = email.trim().toLowerCase();
  if (rateLimited(e)) return { error: "Too many tries. Please wait a few minutes." };
  const user = usersByEmail.get(e);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Email or password is not correct." };
  }
  loginAttempts.delete(e);
  return user;
}

export async function attachUserSession(user: User, guestSid: string | null) {
  const userSid = `user:${user.id}`;
  if (guestSid && guestSid !== userSid) {
    mergeCarts(guestSid, userSid);
  }
  await setAuthCookie(user.id);
  await setSidCookie(userSid);
  return userSid;
}

export function newGuestSid() {
  return `guest:${randomBytes(8).toString("hex")}`;
}

export { AUTH_COOKIE, SID_COOKIE };

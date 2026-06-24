import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { generateId } from "@doomscrollr/shared/lib/ids.ts";

// First-party anonymous session cookie used to chain logged-out funnel events
// (spec §10.2). Holds no PII; only an opaque id.
const COOKIE_NAME = "ds_aid";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // ~180 days

export function readAnonSession(c: Context): string | null {
  return getCookie(c, COOKIE_NAME) ?? null;
}

// Read the ds_aid cookie or set a fresh one. Secure is only enforced in production
// so the cookie also works over http://localhost during development.
export function ensureAnonSession(c: Context): string {
  const existing = readAnonSession(c);
  if (existing) return existing;

  const id = generateId();
  setCookie(c, COOKIE_NAME, id, {
    httpOnly: true,
    secure: Deno.env.get("APP_ENV") === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return id;
}

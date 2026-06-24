import { verifyToken } from "@clerk/backend";
import type { Context, MiddlewareHandler } from "hono";
import { conflict, forbidden, unauthorized } from "../lib/errors.ts";
import { logger } from "../lib/logger.ts";
import { hasDatabase } from "../db/client.ts";
import {
  getLocalUserByClerkId,
  getUserIdByClerkId,
  type LocalUser,
} from "../repositories/users.repository.ts";

const DEFAULT_AUTHORIZED_PARTIES = ["http://localhost:5173", "http://127.0.0.1:5173"];

// Verify a Clerk session token if one is present. Returns the Clerk user id (sub)
// or null. Never throws — callers decide whether auth is required.
export async function verifyClerkToken(c: Context): Promise<string | null> {
  const token = readBearerToken(c.req.header("authorization"));
  if (!token) return null;

  // Test-only auth seam (used by the e2e harness). A bearer of the form
  // `test:<clerkUserId>` is accepted as that user WITHOUT contacting Clerk, so
  // e2e tests can act as any seeded user deterministically and offline. This
  // branch only activates when APP_ENV is exactly "test" AND the explicit
  // E2E_AUTH flag is set, so it can never become a backdoor in development or
  // production (where APP_ENV is "development"/"production").
  const testUserId = testAuthUserId(token);
  if (testUserId) return testUserId;

  const secretKey = Deno.env.get("CLERK_SECRET_KEY");
  if (!secretKey) {
    logger.warn({ event: "clerk_secret_missing" });
    return null;
  }

  try {
    const payload = await verifyToken(token, {
      secretKey,
      authorizedParties: readAuthorizedParties(),
    });
    return payload.sub ?? null;
  } catch (error) {
    logger.warn({
      event: "clerk_token_rejected",
      message: error instanceof Error ? error.message : "Unknown Clerk token verification error.",
    });
    return null;
  }
}

// Resolve the local Doomscrollr user id for the current request, if the caller is
// authenticated and already synced. Used to push block filters into read queries
// (spec §9, §15). Anonymous or unsynced callers resolve to undefined.
export async function getOptionalViewerId(c: Context): Promise<string | undefined> {
  if (!hasDatabase()) return undefined;
  const clerkUserId = await verifyClerkToken(c);
  if (!clerkUserId) return undefined;
  return (await getUserIdByClerkId(clerkUserId)) ?? undefined;
}

// Require a valid Clerk session and attach the Clerk user id.
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const clerkUserId = await verifyClerkToken(c);
  if (!clerkUserId) {
    throw unauthorized("Invalid or expired session.");
  }

  c.set("clerkUserId", clerkUserId);
  await next();
};

// Require a fully onboarded local user for write actions. Enforces account status
// (spec §17, ROADMAP V1-034). Callers without a local handle get a 409 so the client
// can route them into the username setup flow.
export const requireUser: MiddlewareHandler = async (c, next) => {
  const clerkUserId = await verifyClerkToken(c);
  if (!clerkUserId) throw unauthorized("Invalid or expired session.");

  const user = await getLocalUserByClerkId(clerkUserId);
  if (!user) throw conflict("USERNAME_REQUIRED", "Choose a username before continuing.");
  if (user.status === "suspended" || user.status === "banned") {
    throw forbidden("Your account is not allowed to perform this action.");
  }

  c.set("clerkUserId", clerkUserId);
  c.set("user", user);
  await next();
};

// Must run after requireUser. Enforces admin role server-side (spec §14.1, V1-035).
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const user = c.get("user") as LocalUser | undefined;
  if (!user || user.role !== "admin") throw forbidden("Admin access required.");
  await next();
};

export function getAuthUser(c: Context): LocalUser {
  const user = c.get("user") as LocalUser | undefined;
  if (!user) throw unauthorized();
  return user;
}

function readBearerToken(authorization: string | undefined) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

// Resolve the impersonated Clerk user id from a `test:<clerkUserId>` bearer, but
// only under the doubly-gated test seam. Returns null in every other case, so the
// real Clerk verification path is always used outside of e2e runs.
const TEST_TOKEN_PREFIX = "test:";
function testAuthUserId(token: string): string | null {
  if (Deno.env.get("APP_ENV") !== "test") return null;
  if (Deno.env.get("E2E_AUTH") !== "1") return null;
  if (!token.startsWith(TEST_TOKEN_PREFIX)) return null;
  const clerkUserId = token.slice(TEST_TOKEN_PREFIX.length).trim();
  return clerkUserId.length > 0 ? clerkUserId : null;
}

function readAuthorizedParties() {
  const configured = Deno.env.get("CLERK_AUTHORIZED_PARTIES")
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured?.length ? configured : DEFAULT_AUTHORIZED_PARTIES;
}

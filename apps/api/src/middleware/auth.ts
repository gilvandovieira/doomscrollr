import { verifyToken } from "@clerk/backend";
import type { MiddlewareHandler } from "hono";
import { unauthorized } from "../lib/errors.ts";
import { logger } from "../lib/logger.ts";

const DEFAULT_AUTHORIZED_PARTIES = ["http://localhost:5173", "http://127.0.0.1:5173"];

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const token = readBearerToken(c.req.header("authorization"));

  if (!token) {
    throw unauthorized();
  }

  const secretKey = Deno.env.get("CLERK_SECRET_KEY");

  if (!secretKey) {
    logger.warn({ event: "clerk_secret_missing" });
    throw unauthorized("Clerk authentication is not configured on the API.");
  }

  try {
    await verifyToken(token, {
      secretKey,
      authorizedParties: readAuthorizedParties(),
    });
  } catch (error) {
    logger.warn({
      event: "clerk_token_rejected",
      message: error instanceof Error ? error.message : "Unknown Clerk token verification error.",
    });
    throw unauthorized("Invalid or expired session.");
  }

  await next();
};

function readBearerToken(authorization: string | undefined) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function readAuthorizedParties() {
  const configured = Deno.env.get("CLERK_AUTHORIZED_PARTIES")
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured?.length ? configured : DEFAULT_AUTHORIZED_PARTIES;
}

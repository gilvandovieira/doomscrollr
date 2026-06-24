import type { MiddlewareHandler } from "hono";
import { unauthorized } from "../lib/errors.ts";

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const authorization = c.req.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw unauthorized();
  }

  await next();
};

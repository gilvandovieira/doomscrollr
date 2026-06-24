import type { MiddlewareHandler } from "hono";
import { logger } from "../lib/logger.ts";

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
  const startedAt = performance.now();

  c.header("x-request-id", requestId);

  await next();

  logger.info({
    event: "request_completed",
    requestId,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status: c.res.status,
    durationMs: Math.round(performance.now() - startedAt),
  });
};

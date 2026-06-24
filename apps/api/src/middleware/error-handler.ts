import type { Context } from "hono";
import { HttpError } from "../lib/errors.ts";
import { logger } from "../lib/logger.ts";

export function errorHandler(error: Error, c: Context) {
  if (error instanceof HttpError) {
    return c.json({
      error: {
        code: error.code,
        message: error.message,
        issues: error.issues ?? [],
      },
    }, toContentfulStatus(error.status));
  }

  logger.error({
    event: "unhandled_api_error",
    message: error.message,
    stack: error.stack,
  });

  return c.json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error.",
      issues: [],
    },
  }, 500);
}

type KnownStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 501;

const PASSTHROUGH_STATUSES = new Set<number>([400, 401, 403, 404, 409, 422, 429, 501]);

function toContentfulStatus(status: number): KnownStatus {
  // Pass through known client-error statuses and 501; everything else is a 500.
  return (PASSTHROUGH_STATUSES.has(status) ? status : 500) as KnownStatus;
}

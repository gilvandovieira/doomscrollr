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

function toContentfulStatus(status: number) {
  if (status === 400 || status === 401 || status === 404 || status === 501) {
    return status;
  }

  return 500;
}

import { readServerEnv } from "@doomscrollr/config/env.ts";
import pino from "pino";

const env = readServerEnv();

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "headers.cookie",
      "*.token",
      "*.sessionId",
      "*.apiKey",
      "*.email",
    ],
    remove: true,
  },
});

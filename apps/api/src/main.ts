import { readServerEnv } from "@doomscrollr/config/env.ts";
import { app } from "./app.ts";
import { logger } from "./lib/logger.ts";

const env = readServerEnv();

logger.info({
  event: "api_starting",
  port: env.PORT,
  appEnv: env.APP_ENV,
});

Deno.serve({ port: env.PORT }, app.fetch);

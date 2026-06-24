import { readServerEnv } from "@doomscrollr/config/env.ts";
import { app } from "./app.ts";
import { closeDatabase } from "./db/client.ts";
import { logger } from "./lib/logger.ts";

const env = readServerEnv();
let shuttingDown = false;

logger.info({
  event: "api_starting",
  port: env.PORT,
  appEnv: env.APP_ENV,
});

const server = Deno.serve({ port: env.PORT }, app.fetch);

async function shutdown(signal: "SIGTERM" | "SIGINT") {
  if (shuttingDown) {
    // A second signal while a drain is already in flight: exit now instead of
    // ignoring it. Otherwise a hung drain leaves a zombie that only SIGKILL can
    // clear, and concurrent watchers/agents pile those up until the box OOMs.
    Deno.exit(130);
  }
  shuttingDown = true;

  logger.info({ event: "api_shutdown_started", signal });

  // Hard failsafe: never let a stuck server.shutdown()/closeDatabase() keep the
  // process — and its memory — alive past the drain budget.
  const forceExit = setTimeout(() => {
    logger.warn({ event: "api_shutdown_forced", signal });
    Deno.exit(1);
  }, 12_000);

  try {
    await Promise.race([
      server.shutdown(),
      new Promise((resolve) => setTimeout(resolve, 10_000)),
    ]);
  } catch (error) {
    logger.warn({
      event: "api_server_shutdown_failed",
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  try {
    await closeDatabase();
  } catch (error) {
    logger.warn({
      event: "api_database_close_failed",
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  clearTimeout(forceExit);
  logger.info({ event: "api_shutdown_complete", signal });
  Deno.exit(0);
}

Deno.addSignalListener("SIGTERM", () => void shutdown("SIGTERM"));
Deno.addSignalListener("SIGINT", () => void shutdown("SIGINT"));

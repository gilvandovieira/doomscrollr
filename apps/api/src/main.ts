import { readServerEnv } from "@doomscrollr/config/env.ts";
import { app } from "./app.ts";
import { closeDatabase } from "./db/client.ts";
import { logger } from "./lib/logger.ts";

const env = readServerEnv();

logger.info({ event: "api_starting", port: env.PORT, appEnv: env.APP_ENV });

const server = Deno.serve({ port: env.PORT }, app.fetch);

let shuttingDown = false;

async function shutdown(signal: "SIGTERM" | "SIGINT") {
  if (shuttingDown) {
    logger.warn({ event: "api_shutdown_forced", signal });
    Deno.exit(1);
  }
  shuttingDown = true;
  logger.info({ event: "api_shutdown_started", signal });

  const timeoutMs = env.APP_ENV === "development" ? 350 : 10_000;
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("shutdown timeout")), timeoutMs);
  });

  try {
    await Promise.race([
      Promise.allSettled([server.shutdown(), closeDatabase()]),
      timeout,
    ]);
    logger.info({ event: "api_shutdown_complete", signal });
    Deno.exit(signal === "SIGINT" ? 130 : 0);
  } catch (error) {
    logger.error({ event: "api_shutdown_failed", signal, error });
    Deno.exit(1);
  }
}

// Deno Deploy manages the process lifecycle and may not support OS signal listeners;
// guard so startup can never fail there. On containers/local these enable graceful drain.
try {
  Deno.addSignalListener("SIGTERM", () => { shutdown("SIGTERM"); });
  Deno.addSignalListener("SIGINT", () => { shutdown("SIGINT"); });
} catch (error) {
  logger.warn({
    event: "signal_listeners_unsupported",
    message: error instanceof Error ? error.message : "unknown",
  });
}

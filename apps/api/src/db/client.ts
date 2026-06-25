import * as schema from "@doomscrollr/database/schema.ts";
import { readServerEnv } from "@doomscrollr/config/env.ts";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const env = readServerEnv();
const databaseUrl = env.DATABASE_URL;
const queryClient = databaseUrl
  ? postgres(databaseUrl, {
    // Tuned for Neon Free + serverless (Deno Deploy): each isolate holds its own pool,
    // so keep `max` low to stay under Neon's connection limit. `prepare: false` is required
    // for Neon's pooled endpoint (PgBouncer transaction mode rejects named prepared
    // statements); it is harmless on a direct connection. Drizzle + transactions are unaffected.
    max: 5,
    idle_timeout: 20,
    prepare: false,
  })
  : null;

export const db = queryClient ? drizzle(queryClient, { schema }) : null;

export function hasDatabase() {
  return db !== null;
}

export function allowMockFallback() {
  return env.APP_ENV === "development" || env.ENABLE_MOCK_FALLBACK === "1";
}

export async function checkDatabaseReady(timeoutMs = 1500): Promise<boolean> {
  if (!queryClient) return false;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      queryClient`SELECT 1`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("database readiness timed out")), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function closeDatabase(): Promise<void> {
  if (!queryClient) return;
  await queryClient.end({ timeout: 1 });
}

import * as schema from "@doomscrollr/database/schema.ts";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = Deno.env.get("DATABASE_URL");
const queryClient = databaseUrl
  ? postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
  })
  : null;

export const db = queryClient ? drizzle(queryClient, { schema }) : null;

export function hasDatabase() {
  return db !== null;
}

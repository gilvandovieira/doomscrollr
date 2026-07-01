// Isolation (2.9): bare jsr:@hono + postgres.js ONLY (opens a pool at module scope, runs a
// query each reload). vs iso-jsr-hono.ts (which plateaus) the single added variable is postgres.js.
import { Hono } from "jsr:@hono/hono@^4.8.12";
// deno-lint-ignore no-import-prefix
import postgres from "npm:postgres@^3.4.7";
const sql = postgres(Deno.env.get("DATABASE_URL")!, { max: 1 });
const app = new Hono();
app.get("/health", (c) => c.text("ok"));
app.get("/ready", async (c) => {
  try {
    await sql`select 1`;
    return c.json({ status: "ready", checks: { database: "ok" } });
  } catch {
    return c.json({ status: "not_ready", checks: { database: "unavailable" } }, 503);
  }
});
app.get("/api/feed/recent", async (c) => {
  const rows = await sql`select 1 as x`;
  return c.json({ items: rows });
});
Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8094) }, app.fetch);

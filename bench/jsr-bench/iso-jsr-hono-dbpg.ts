// Isolation (2.9): bare jsr:@hono + jsr:@db/postgres ONLY (opens a Client at module scope, runs a
// query each reload). vs iso-jsr-hono.ts (which plateaus) the single added variable is @db/postgres.
import { Hono } from "jsr:@hono/hono@^4.8.12";
import { Client } from "jsr:@db/postgres";
const client = new Client(Deno.env.get("DATABASE_URL"));
await client.connect();
const app = new Hono();
app.get("/health", (c) => c.text("ok"));
app.get("/ready", async (c) => {
  try {
    await client.queryArray`select 1`;
    return c.json({ status: "ready", checks: { database: "ok" } });
  } catch {
    return c.json({ status: "not_ready", checks: { database: "unavailable" } }, 503);
  }
});
app.get("/api/feed/recent", async (c) => {
  const r = await client.queryObject`select 1 as x`;
  return c.json({ items: r.rows });
});
Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8094) }, app.fetch);

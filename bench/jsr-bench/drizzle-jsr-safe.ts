// Deno: KEEP Drizzle (npm, no JSR) but swap the SAFE deps to JSR — hono, zod, logging.
// Driver stays postgres.js (Drizzle's postgres-js dialect needs it). Clerk = npm floor.
// Question this answers: do the safe JSR swaps reduce --watch retention while Drizzle stays npm?
import { Hono } from "jsr:@hono/hono@^4.8.12";
import * as log from "jsr:@std/log";
import { z } from "jsr:@zod/zod";
import { drizzle } from "npm:drizzle-orm@^0.44.5/postgres-js";
import { sql } from "npm:drizzle-orm@^0.44.5";
import postgres from "npm:postgres@^3.4.7";
import { verifyToken } from "npm:@clerk/backend@^3.7.1"; // npm-only auth — the floor
void verifyToken;
void z;

const client = postgres(Deno.env.get("DATABASE_URL"));
const db = drizzle(client);

const app = new Hono();
app.get("/health", (c) => c.text("ok"));
app.get("/ready", async (c) => {
  try {
    await client`select 1`;
    return c.json({ status: "ready", checks: { database: "ok" } });
  } catch {
    return c.json({ status: "not_ready", checks: { database: "unavailable" } }, 503);
  }
});
app.get("/api/feed/recent", async (c) => {
  const rows = await db.execute(sql`
    SELECT p.public_code AS code, p.title, p.post_kind AS kind,
           p.created_at AS "createdAt", u.username AS author
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.status = 'published' AND u.status = 'active'
    ORDER BY p.created_at DESC LIMIT 20`);
  return c.json({ items: rows });
});

log.info("up drizzle-jsr-safe");
Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8094) }, app.fetch);

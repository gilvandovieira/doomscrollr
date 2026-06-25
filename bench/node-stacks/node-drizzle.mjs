// Node baseline: hono + drizzle + postgres.js + pino + zod + @clerk/backend (all npm). Same feed query.
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { z } from "zod";
import pino from "pino";
import { verifyToken } from "@clerk/backend";
void verifyToken; void z;
const log = pino();

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);
const app = new Hono();
app.get("/health", (c) => c.text("ok"));
app.get("/ready", async (c) => {
  try { await client`select 1`; return c.json({ status: "ready", checks: { database: "ok" } }); }
  catch { return c.json({ status: "not_ready" }, 503); }
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
const port = Number(process.env.PORT ?? 8094);
serve({ fetch: app.fetch, port });
log.info({ port }, "up node-drizzle");

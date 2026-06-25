// JSR stack: @hono/hono + @db/postgres (raw SQL) + @std/log + @zod/zod, with the
// irreducible npm Clerk floor (no JSR equivalent). Same real DB, same feed query.
import { Hono } from "jsr:@hono/hono@^4.8.12";
import { Client } from "jsr:@db/postgres";
import * as log from "jsr:@std/log";
import { z } from "jsr:@zod/zod";
import { verifyToken } from "npm:@clerk/backend@^3.7.1"; // npm-only auth — the floor
void verifyToken;
void z;

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
  const r = await client.queryObject`
    SELECT p.public_code AS code, p.title, p.post_kind AS kind,
           p.created_at AS "createdAt", u.username AS author
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.status = 'published' AND u.status = 'active'
    ORDER BY p.created_at DESC LIMIT 20`;
  return c.json({ items: r.rows });
});

log.info("up jsr");
Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8094) }, app.fetch);

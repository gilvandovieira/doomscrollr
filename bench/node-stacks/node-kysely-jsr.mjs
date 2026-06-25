// Node + Kysely + the "safe" JSR swaps: @hono/hono and @zod/zod come from JSR (installed via `jsr add`,
// i.e. JSR's npm-compat). Everything else identical to node-kysely.mjs. Tests whether swapping the
// JSR-available deps changes anything ON NODE (it shouldn't — Node has no Deno npm-compat loader).
import { serve } from "@hono/node-server";
import { Hono } from "@hono/hono";
import postgres from "postgres";
import { DummyDriver, Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from "kysely";
import { z } from "@zod/zod";
import pino from "pino";
import { verifyToken } from "@clerk/backend";
void verifyToken; void z;
const log = pino();

const client = postgres(process.env.DATABASE_URL);
const qb = new Kysely({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (db) => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});
const app = new Hono();
app.get("/health", (c) => c.text("ok"));
app.get("/ready", async (c) => {
  try { await client`select 1`; return c.json({ status: "ready", checks: { database: "ok" } }); }
  catch { return c.json({ status: "not_ready" }, 503); }
});
app.get("/api/feed/recent", async (c) => {
  const q = qb.selectFrom("posts").innerJoin("users", "users.id", "posts.author_id")
    .select(["posts.public_code as code", "posts.title", "posts.post_kind as kind",
      "posts.created_at as createdAt", "users.username as author"])
    .where("posts.status", "=", "published").where("users.status", "=", "active")
    .orderBy("posts.created_at", "desc").limit(20).compile();
  const rows = await client.unsafe(q.sql, [...q.parameters]);
  return c.json({ items: rows });
});
const port = Number(process.env.PORT ?? 8094);
serve({ fetch: app.fetch, port });
log.info({ port }, "up node-kysely-jsr");

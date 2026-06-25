// Deno: the full "safe JSR + Kysely" target — hono, zod, logging, and the DB driver all JSR;
// Kysely (npm, pure-ESM) as the typed query compiler replacing Drizzle; Clerk = npm floor.
// Only npm left: kysely + @clerk/backend. This is the lightest type-safe config short of raw SQL.
import { Hono } from "jsr:@hono/hono@^4.8.12";
import { Client } from "jsr:@db/postgres";
import * as log from "jsr:@std/log";
import { z } from "jsr:@zod/zod";
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "npm:kysely@^0.27";
import { verifyToken } from "npm:@clerk/backend@^3.7.1"; // npm-only auth — the floor
void verifyToken;
void z;

const client = new Client(Deno.env.get("DATABASE_URL"));
await client.connect();

const qb = new Kysely<Record<string, never>>({
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
  try {
    await client.queryArray`select 1`;
    return c.json({ status: "ready", checks: { database: "ok" } });
  } catch {
    return c.json({ status: "not_ready", checks: { database: "unavailable" } }, 503);
  }
});
app.get("/api/feed/recent", async (c) => {
  const q = (qb as Kysely<any>)
    .selectFrom("posts").innerJoin("users", "users.id", "posts.author_id")
    .select(["posts.public_code as code", "posts.title", "posts.post_kind as kind",
      "posts.created_at as createdAt", "users.username as author"])
    .where("posts.status", "=", "published").where("users.status", "=", "active")
    .orderBy("posts.created_at", "desc").limit(20).compile();
  const r = await client.queryObject({ text: q.sql, args: [...q.parameters] });
  return c.json({ items: r.rows });
});

log.info("up kysely-jsr-full");
Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8094) }, app.fetch);

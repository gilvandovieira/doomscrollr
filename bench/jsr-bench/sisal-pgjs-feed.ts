// Sisal + postgres.js stack — now using the RELEASED @sisal/pg v0.5.1 built-in driver via its
// official option connect({ url, driver: "postgres-js" }) (not the earlier injected prototype).
// Tests whether the shipped adapter matches the prototype's throughput while keeping memory sane.
// Same @clerk/backend npm floor + @hono/hono + logger.
import { Hono } from "jsr:@hono/hono@^4.8.12";
import { and, columns, defineTable, desc, eq } from "jsr:@sisal/orm@^0.5.1";
import { connect } from "jsr:@sisal/pg@^0.5.1";
import * as log from "jsr:@std/log";
import { z } from "jsr:@zod/zod";
import { verifyToken } from "npm:@clerk/backend@^3.7.1"; // npm-only auth — the floor
void verifyToken;
void z;

const posts = defineTable("posts", {
  id: columns.uuid(),
  public_code: columns.text(),
  title: columns.text(),
  post_kind: columns.text(),
  created_at: columns.timestamp({ withTimezone: true, mode: "date" }),
  status: columns.text(),
  author_id: columns.uuid(),
});
const users = defineTable("users", {
  id: columns.uuid(),
  username: columns.text(),
  status: columns.text(),
});

const db = await connect({ url: Deno.env.get("DATABASE_URL")!, driver: "postgres-js" });

const app = new Hono();
app.get("/health", (c) => c.text("ok"));
app.get("/ready", async (c) => {
  try {
    await db.execute("select 1");
    return c.json({ status: "ready", checks: { database: "ok" } });
  } catch {
    return c.json({ status: "not_ready", checks: { database: "unavailable" } }, 503);
  }
});
app.get("/api/feed/recent", async (c) => {
  const items = await db.select({
    code: posts.columns.public_code,
    title: posts.columns.title,
    kind: posts.columns.post_kind,
    createdAt: posts.columns.created_at,
    author: users.columns.username,
  }).from(posts)
    .innerJoin(users, eq(users.columns.id, posts.columns.author_id))
    .where(and(eq(posts.columns.status, "published"), eq(users.columns.status, "active")))
    .orderBy(desc(posts.columns.created_at))
    .limit(20)
    .execute();
  return c.json({ items });
});

log.info("up sisal-pgjs");
Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8094) }, app.fetch);

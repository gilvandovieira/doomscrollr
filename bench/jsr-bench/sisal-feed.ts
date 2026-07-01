// Sisal stack: @hono/hono + @sisal/orm + @sisal/pg + @std/log + @zod/zod, with the
// irreducible npm Clerk floor (no JSR equivalent). Same real DB, same feed query as
// npm-feed.ts / jsr-feed.ts — but with Sisal (the user's own JSR-native ORM) as the
// typed query layer replacing Drizzle. @sisal/pg rides jsr:@db/postgres under the hood,
// so this measures the ORM's overhead on top of the same raw driver jsr-feed.ts uses.
import { Hono } from "jsr:@hono/hono@^4.8.12";
import { and, columns, defineTable, desc, eq } from "jsr:@sisal/orm@^0.5.1";
import { connect } from "jsr:@sisal/pg@^0.5.1";
import * as log from "jsr:@std/log";
import { z } from "jsr:@zod/zod";
import { verifyToken } from "npm:@clerk/backend@^3.7.1"; // npm-only auth — the floor
void verifyToken;
void z;

// snake_case keys line up 1:1 with the DB columns (no camel→snake mapping to reason about).
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

const db = await connect({ url: Deno.env.get("DATABASE_URL")! });

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

log.info("up sisal");
Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8094) }, app.fetch);

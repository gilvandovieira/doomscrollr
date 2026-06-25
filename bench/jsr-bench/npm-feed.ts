// npm stack: hono + drizzle + postgres.js + pino + zod + clerk — real DB, real feed query.
import { Hono } from "npm:hono@^4.8.12";
import { drizzle } from "npm:drizzle-orm@^0.44.5/postgres-js";
import postgres from "npm:postgres@^3.4.7";
import { pgTable, text, timestamp, uuid } from "npm:drizzle-orm@^0.44.5/pg-core";
import { and, desc, eq } from "npm:drizzle-orm@^0.44.5";
import pino from "npm:pino@^9.7.0";
import { z } from "npm:zod@^3.25.76";
import { verifyToken } from "npm:@clerk/backend@^3.7.1";
void verifyToken;
void z;

const logger = pino({ level: "info" });
const posts = pgTable("posts", {
  id: uuid("id"),
  publicCode: text("public_code"),
  title: text("title"),
  postKind: text("post_kind"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  status: text("status"),
  authorId: uuid("author_id"),
});
const users = pgTable("users", { id: uuid("id"), username: text("username"), status: text("status") });
const sqlc = postgres(Deno.env.get("DATABASE_URL")!, { max: 5 });
const db = drizzle(sqlc);

const app = new Hono();
app.get("/health", (c) => c.text("ok"));
app.get("/ready", async (c) => {
  try {
    await sqlc`select 1`;
    return c.json({ status: "ready", checks: { database: "ok" } });
  } catch {
    return c.json({ status: "not_ready", checks: { database: "unavailable" } }, 503);
  }
});
app.get("/api/feed/recent", async (c) => {
  const items = await db.select({
    code: posts.publicCode,
    title: posts.title,
    kind: posts.postKind,
    createdAt: posts.createdAt,
    author: users.username,
  }).from(posts).innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.status, "published"), eq(users.status, "active")))
    .orderBy(desc(posts.createdAt)).limit(20);
  return c.json({ items });
});

logger.info({ event: "up", stack: "npm" });
Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8094) }, app.fetch);

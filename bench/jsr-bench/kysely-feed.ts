// Kysely stack: npm:kysely as a pure typed SQL COMPILER (DummyDriver), executed through the
// SAME jsr:@db/postgres driver as jsr-feed.ts. So the only delta vs jsr-feed is npm:kysely's
// node-compat tax — this isolates "what does adopting Kysely cost on Deno". Clerk = npm floor.
import { Hono } from "jsr:@hono/hono@^4.8.12";
import { Client } from "jsr:@db/postgres";
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "npm:kysely@^0.27";
import { verifyToken } from "npm:@clerk/backend@^3.7.1"; // npm-only auth — the floor
void verifyToken;

interface PostsTable {
  public_code: string;
  title: string | null;
  post_kind: string;
  created_at: Date;
  author_id: string;
  status: string;
}
interface UsersTable {
  id: string;
  username: string;
  status: string;
}
interface DB {
  posts: PostsTable;
  users: UsersTable;
}

const client = new Client(Deno.env.get("DATABASE_URL"));
await client.connect();

// Kysely with DummyDriver = typed query builder, no driver of its own (Deno docs pattern).
const qb = new Kysely<DB>({
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
  const compiled = qb
    .selectFrom("posts")
    .innerJoin("users", "users.id", "posts.author_id")
    .select([
      "posts.public_code as code",
      "posts.title",
      "posts.post_kind as kind",
      "posts.created_at as createdAt",
      "users.username as author",
    ])
    .where("posts.status", "=", "published")
    .where("users.status", "=", "active")
    .orderBy("posts.created_at", "desc")
    .limit(20)
    .compile();
  const r = await client.queryObject({
    text: compiled.sql,
    args: [...compiled.parameters],
  });
  return c.json({ items: r.rows });
});

Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8094) }, app.fetch);

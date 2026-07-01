// Isolation micro-bench: WHERE does Sisal's per-query time go?
// Sequential (concurrency 1) so pool contention is out — this is pure service time.
//   A. Sisal build-only (.toSql())         → query-builder cost, no DB
//   B. Sisal full .execute()               → builder + @db/postgres(extended) + decode
//   C. raw @db/postgres parameterized $1/$2 → @db/postgres EXTENDED protocol
//   D. raw @db/postgres inlined literals    → @db/postgres SIMPLE protocol (the 3.7ms path)
import { and, columns, defineTable, desc, eq } from "jsr:@sisal/orm@^0.5.0";
import { connect } from "jsr:@sisal/pg@^0.5.0";
import { Pool } from "jsr:@db/postgres";
import postgresJs from "npm:postgres@^3.4.7";

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

const url = Deno.env.get("DATABASE_URL")!;
const N = 300, WARM = 30;

function stats(ts: number[]) {
  ts.sort((a, b) => a - b);
  const p = (q: number) => ts[Math.min(ts.length - 1, Math.floor(ts.length * q))];
  return `min=${ts[0].toFixed(2)} p50=${p(0.5).toFixed(2)} p90=${p(0.9).toFixed(2)} max=${ts[ts.length - 1].toFixed(2)} ms`;
}
async function bench(label: string, fn: () => Promise<unknown> | unknown) {
  for (let i = 0; i < WARM; i++) await fn();
  const ts: number[] = [];
  for (let i = 0; i < N; i++) { const s = performance.now(); await fn(); ts.push(performance.now() - s); }
  console.log(`${label.padEnd(42)} ${stats(ts)}`);
}

const db = await connect({ url });
const sisalQ = () =>
  db.select({
    code: posts.columns.public_code,
    title: posts.columns.title,
    kind: posts.columns.post_kind,
    createdAt: posts.columns.created_at,
    author: users.columns.username,
  }).from(posts)
    .innerJoin(users, eq(users.columns.id, posts.columns.author_id))
    .where(and(eq(posts.columns.status, "published"), eq(users.columns.status, "active")))
    .orderBy(desc(posts.columns.created_at)).limit(20);

// Show the SQL Sisal actually emits (confirms parameterized $1/$2).
const rendered = sisalQ().toSql();
console.log("Sisal emits:", JSON.stringify(rendered).slice(0, 220));

const pool = new Pool(url, 1, true);
const c = await pool.connect();
const SQL_PARAM =
  `select p.public_code as code, p.title, p.post_kind as kind, p.created_at as "createdAt", u.username as author ` +
  `from posts p join users u on u.id = p.author_id where p.status = $1 and u.status = $2 ` +
  `order by p.created_at desc limit 20`;
const SQL_LIT = SQL_PARAM.replace("$1", "'published'").replace("$2", "'active'");

console.log(`\nsequential, N=${N} (warm ${WARM}), single connection:`);
await bench("A. Sisal build-only (.toSql())", () => sisalQ().toSql());
await bench("B. Sisal .execute() (parameterized)", () => sisalQ().execute());
await bench("C. raw @db/postgres parameterized", () => c.queryObject({ text: SQL_PARAM, args: ["published", "active"] }));
await bench("D. raw @db/postgres inlined literals", () => c.queryObject(SQL_LIT));

// E. postgres.js — the SAME parameterized query on a different driver (what Drizzle uses).
const sql = postgresJs(url, { max: 1 });
await bench("E. postgres.js parameterized", () => sql.unsafe(SQL_PARAM, ["published", "active"]));

await c.release();
await pool.end();
await db.close();
await sql.end({ timeout: 1 });

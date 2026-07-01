// Before/after: the SAME Sisal query + executor, two drivers.
//   default : connect({ url })                                → jsr:@db/postgres (the ~42ms path)
//   pgjs    : connect({ pool: createPostgresJsPool({ url }) }) → postgres.js (expected ~0.4ms)
// Also asserts the two return identical rows, and that an interactive transaction
// works through the postgres.js-backed pool (begin/commit on a reserved connection).
import { and, columns, defineTable, desc, eq } from "jsr:@sisal/orm@^0.5.0";
import { connect } from "jsr:@sisal/pg@^0.5.0";
import { createPostgresJsPool } from "./sisal-postgresjs-pool.ts";

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

// deno-lint-ignore no-explicit-any
const feed = (db: any) =>
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

function stats(ts: number[]) {
  ts.sort((a, b) => a - b);
  const p = (q: number) => ts[Math.min(ts.length - 1, Math.floor(ts.length * q))];
  return `min=${ts[0].toFixed(2)} p50=${p(0.5).toFixed(2)} p90=${p(0.9).toFixed(2)} max=${ts[ts.length - 1].toFixed(2)} ms`;
}
async function bench(label: string, fn: () => Promise<unknown>) {
  for (let i = 0; i < WARM; i++) await fn();
  const ts: number[] = [];
  for (let i = 0; i < N; i++) { const s = performance.now(); await fn(); ts.push(performance.now() - s); }
  console.log(`${label.padEnd(34)} ${stats(ts)}`);
}

const dbDefault = await connect({ url });
const pgjsPool = createPostgresJsPool({ url });
const dbPgjs = await connect({ pool: pgjsPool });

// --- correctness: identical rows from both drivers ---
const a = await feed(dbDefault).execute();
const b = await feed(dbPgjs).execute();
const codesA = JSON.stringify(a.map((r: { code: string }) => r.code));
const codesB = JSON.stringify(b.map((r: { code: string }) => r.code));
console.log(`rows: default=${a.length} pgjs=${b.length} | identical order+codes: ${codesA === codesB}`);
console.log(`sample pgjs row: ${JSON.stringify(b[0])}`);

// --- transaction smoke test through the postgres.js-backed pool ---
let txOk = true;
try {
  await dbPgjs.transaction(async (tx: unknown) => { await feed(tx).execute(); });
} catch (e) {
  txOk = false;
  console.log("pgjs transaction ERROR:", (e as Error).message);
}
console.log(`pgjs interactive transaction ok: ${txOk}`);

console.log(`\nsequential, N=${N} (warm ${WARM}):`);
await bench("Sisal / @db/postgres  (.execute)", () => feed(dbDefault).execute());
await bench("Sisal / postgres.js   (.execute)", () => feed(dbPgjs).execute());

await dbDefault.close();
await dbPgjs.close();
await pgjsPool.end?.(); // connect({pool}) does NOT own the pool, so close it explicitly

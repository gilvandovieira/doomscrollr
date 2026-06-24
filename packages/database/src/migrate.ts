import postgres from "postgres";

const databaseUrl = Deno.env.get("DATABASE_URL");

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const sql = postgres(databaseUrl, { max: 1 });
const migrationsDir = new URL("./migrations/", import.meta.url);

try {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const migrationFiles = [];
  for await (const entry of Deno.readDir(migrationsDir)) {
    if (entry.isFile && entry.name.endsWith(".sql")) {
      migrationFiles.push(entry.name);
    }
  }
  migrationFiles.sort();

  for (const name of migrationFiles) {
    const existing = await sql`SELECT name FROM schema_migrations WHERE name = ${name}`;
    if (existing.length > 0) {
      console.log(`Skipping ${name}`);
      continue;
    }

    const migrationSql = await Deno.readTextFile(new URL(name, migrationsDir));
    await sql.begin(async (transaction) => {
      await transaction.unsafe(migrationSql);
      await transaction`INSERT INTO schema_migrations (name) VALUES (${name})`;
    });

    console.log(`Applied ${name}`);
  }
} finally {
  await sql.end();
}

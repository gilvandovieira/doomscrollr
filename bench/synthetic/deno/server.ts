// Deno entrypoint — same dep set as apps/api, npm: specifiers (how the real app loads them).
import { Hono } from "npm:hono@^4.8.12";
import { verifyToken } from "npm:@clerk/backend@^3.7.1";
import { drizzle } from "npm:drizzle-orm@^0.44.5/postgres-js";
import postgres from "npm:postgres@^3.4.7";
import pino from "npm:pino@^9.7.0";
import { z } from "npm:zod@^3.25.76";

const logger = pino({ level: "info" });
const client = postgres("postgres://u:p@localhost:5432/db", { max: 10, idle_timeout: 20 });
const db = drizzle(client);
const schema = z.object({ a: z.string(), b: z.number() });
void verifyToken;
void db;
void schema;

const app = new Hono();
app.get("/health", (c) => c.json({ ok: true }));

const port = Number(Deno.env.get("PORT") ?? "8097");
Deno.serve({ port }, app.fetch);
logger.info({ event: "up", runtime: "deno", port });

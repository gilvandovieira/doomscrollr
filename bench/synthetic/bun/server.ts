// Bun entrypoint — same dep set as apps/api, native node_modules resolution.
import { Hono } from "hono";
import { verifyToken } from "@clerk/backend";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import pino from "pino";
import { z } from "zod";

const logger = pino({ level: "info" });
const client = postgres("postgres://u:p@localhost:5432/db", { max: 10, idle_timeout: 20 });
const db = drizzle(client);
const schema = z.object({ a: z.string(), b: z.number() });
void verifyToken;
void db;
void schema;

const app = new Hono();
app.get("/health", (c) => c.json({ ok: true }));

const port = Number(process.env.PORT ?? "8097");
Bun.serve({ port, fetch: app.fetch });
logger.info({ event: "up", runtime: "bun", port });

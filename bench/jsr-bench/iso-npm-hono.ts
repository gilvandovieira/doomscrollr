// Isolation control (2.9): bare Hono via the npm: loader, NO other deps, NO DB.
// Single variable vs iso-jsr-hono.ts = the resolver/compat path only.
import { Hono } from "npm:hono@^4.8.12";
const app = new Hono();
app.get("/health", (c) => c.text("ok"));
app.get("/ready", (c) => c.json({ status: "ready", checks: { database: "ok" } }));
app.get("/api/feed/recent", (c) => c.json({ items: [] }));
Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8094) }, app.fetch);

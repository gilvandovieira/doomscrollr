// Isolation (2.9): bare jsr:@hono + npm:@clerk/backend ONLY (no DB). vs iso-jsr-hono.ts (plateaus)
// the single added variable is the npm Clerk floor — the dep the 2.8.3 report pegged as ramping.
import { Hono } from "jsr:@hono/hono@^4.8.12";
import { verifyToken } from "npm:@clerk/backend@^3.7.1";
void verifyToken; // keep the import live (used code path pulls the node-compat graph)
const app = new Hono();
app.get("/health", (c) => c.text("ok"));
app.get("/ready", (c) => c.json({ status: "ready", checks: { database: "ok" } }));
app.get("/api/feed/recent", (c) => c.json({ items: [] }));
Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8094) }, app.fetch);

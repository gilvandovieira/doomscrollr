// Isolation (2.9): bare npm:hono + npm:@clerk/backend ONLY (no DB). Control for iso-jsr-hono-clerk.ts —
// tests whether Clerk rams regardless of loader, or only when mixed into a jsr-dominant graph
// (the all-npm Drizzle stack, which also has Clerk, plateaus).
import { Hono } from "npm:hono@^4.8.12";
import { verifyToken } from "npm:@clerk/backend@^3.7.1";
void verifyToken;
const app = new Hono();
app.get("/health", (c) => c.text("ok"));
app.get("/ready", (c) => c.json({ status: "ready", checks: { database: "ok" } }));
app.get("/api/feed/recent", (c) => c.json({ items: [] }));
Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8094) }, app.fetch);

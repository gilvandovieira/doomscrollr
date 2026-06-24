import type { Context } from "hono";
import { Hono } from "hono";
import { notFound } from "../lib/errors.ts";
import { getAuthUser, requireAdmin, requireUser } from "../middleware/auth.ts";
import { removeCommentByCode, restoreCommentByCode } from "../repositories/comments.repository.ts";
import { removePostByCode, restorePostByCode } from "../repositories/posts.repository.ts";
import { listOpenReports, setReportStatus } from "../repositories/reports.repository.ts";

export const adminRoutes = new Hono();

// All admin routes require an authenticated admin (spec §14.1, §20.4).
adminRoutes.use("*", requireUser, requireAdmin);

const DEFAULT_REASON = "Removed by moderator.";

async function readReason(c: Context): Promise<string> {
  try {
    const body = await c.req.json() as { reason?: unknown };
    return typeof body?.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim()
      : DEFAULT_REASON;
  } catch {
    return DEFAULT_REASON;
  }
}

adminRoutes.get("/reports", async (c) => c.json({ items: await listOpenReports() }));

adminRoutes.post("/posts/:postCode/remove", async (c) => {
  const admin = getAuthUser(c);
  const ok = await removePostByCode(c.req.param("postCode"), admin.id, await readReason(c));
  if (!ok) throw notFound("Post not found or already removed.");
  return c.json({ ok: true });
});

adminRoutes.post("/posts/:postCode/restore", async (c) => {
  const ok = await restorePostByCode(c.req.param("postCode"));
  if (!ok) throw notFound("Post not found or not removed.");
  return c.json({ ok: true });
});

adminRoutes.post("/comments/:commentCode/remove", async (c) => {
  const admin = getAuthUser(c);
  const ok = await removeCommentByCode(c.req.param("commentCode"), admin.id, await readReason(c));
  if (!ok) throw notFound("Comment not found or already removed.");
  return c.json({ ok: true });
});

adminRoutes.post("/comments/:commentCode/restore", async (c) => {
  const ok = await restoreCommentByCode(c.req.param("commentCode"));
  if (!ok) throw notFound("Comment not found or not removed.");
  return c.json({ ok: true });
});

adminRoutes.post("/reports/:reportId/dismiss", async (c) => {
  const ok = await setReportStatus(c.req.param("reportId"), "dismissed");
  if (!ok) throw notFound("Report not found or already resolved.");
  return c.json({ ok: true });
});

import { mockReports } from "@doomscrollr/shared/mock-data.ts";
import { Hono } from "hono";
import { hasDatabase } from "../db/client.ts";
import { notImplemented } from "../lib/errors.ts";
import { requireAuth } from "../middleware/auth.ts";
import { listOpenReports } from "../repositories/reports.repository.ts";

export const moderationRoutes = new Hono();

moderationRoutes.get("/reports", requireAuth, async (c) => {
  if (hasDatabase()) {
    return c.json({ items: await listOpenReports() });
  }

  return c.json({ items: mockReports });
});

moderationRoutes.post("/reports/:id/dismiss", requireAuth, () => {
  throw notImplemented("Report dismissal will record a moderation action.");
});

moderationRoutes.post("/reports/:id/action", requireAuth, () => {
  throw notImplemented("Report actions will hide/remove content and update report status.");
});

moderationRoutes.post("/posts/:id/hide", requireAuth, () => {
  throw notImplemented("Post hiding will update content status and ad eligibility.");
});

moderationRoutes.post("/comments/:id/remove", requireAuth, () => {
  throw notImplemented("Comment removal will update comment moderation state.");
});

moderationRoutes.post("/users/:id/restrict", requireAuth, () => {
  throw notImplemented("User restriction will update local product user status.");
});

moderationRoutes.post("/users/:id/ban", requireAuth, () => {
  throw notImplemented("User bans will update local product user status.");
});

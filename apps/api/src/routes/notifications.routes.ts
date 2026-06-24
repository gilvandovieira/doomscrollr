import { Hono } from "hono";
import { notFound } from "../lib/errors.ts";
import { getAuthUser, requireUser } from "../middleware/auth.ts";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "../repositories/notifications.repository.ts";

export const notificationsRoutes = new Hono();

notificationsRoutes.use("*", requireUser);

notificationsRoutes.get("/", async (c) => {
  const user = getAuthUser(c);
  return c.json(await listNotificationsForUser(user.id));
});

notificationsRoutes.post("/:notificationId/read", async (c) => {
  const user = getAuthUser(c);
  const ok = await markNotificationRead(c.req.param("notificationId"), user.id);
  if (!ok) throw notFound("Notification not found.");
  return c.json({ ok: true });
});

notificationsRoutes.post("/read-all", async (c) => {
  const user = getAuthUser(c);
  const count = await markAllNotificationsRead(user.id);
  return c.json({ ok: true, count });
});

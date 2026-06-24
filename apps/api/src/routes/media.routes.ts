import { Hono } from "hono";
import { notImplemented } from "../lib/errors.ts";
import { requireAuth } from "../middleware/auth.ts";

export const mediaRoutes = new Hono();

mediaRoutes.post("/uploads", requireAuth, () => {
  throw notImplemented(
    "Uploaded media requires storage, moderation, and thumbnail generation before launch.",
  );
});

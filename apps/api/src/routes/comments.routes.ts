import { CreateCommentSchema } from "@doomscrollr/shared/schemas/comment.schema.ts";
import { Hono } from "hono";
import { notImplemented } from "../lib/errors.ts";
import { parseOrThrow, readJsonBody } from "../lib/validation.ts";
import { requireAuth } from "../middleware/auth.ts";

export const commentsRoutes = new Hono();

commentsRoutes.post("/:id/replies", requireAuth, async (c) => {
  parseOrThrow(CreateCommentSchema, await readJsonBody(c));
  throw notImplemented("Comment replies will be implemented with one-level parent validation.");
});

commentsRoutes.post("/:id/vote", requireAuth, () => {
  throw notImplemented(
    "Comment voting will be implemented with database-backed uniqueness constraints.",
  );
});

commentsRoutes.delete("/:id", requireAuth, () => {
  throw notImplemented(
    "Comment deletion will be implemented with author and moderator permissions.",
  );
});

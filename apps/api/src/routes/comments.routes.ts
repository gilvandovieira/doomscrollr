import { SetReactionSchema } from "@doomscrollr/shared/schemas/reaction.schema.ts";
import { Hono } from "hono";
import { notFound } from "../lib/errors.ts";
import { enforceRateLimit, RATE_LIMITS } from "../lib/rate-limit.ts";
import { parseOrThrow, readJsonBody } from "../lib/validation.ts";
import { getAuthUser, requireUser } from "../middleware/auth.ts";
import { getPublishedCommentRefByCode } from "../repositories/comments.repository.ts";
import { recordPostEvent } from "../repositories/events.repository.ts";
import { setCommentReaction } from "../repositories/reactions.repository.ts";

export const commentsRoutes = new Hono();

// POST /api/comments/:commentCode/reactions (spec §20.3).
commentsRoutes.post("/:commentCode/reactions", requireUser, async (c) => {
  const user = getAuthUser(c);
  await enforceRateLimit(`react:${user.id}`, RATE_LIMITS.react);
  const commentCode = c.req.param("commentCode");
  const { value } = parseOrThrow(SetReactionSchema, await readJsonBody(c));

  const ref = await getPublishedCommentRefByCode(commentCode, user.id);
  if (!ref) throw notFound("Comment not found.");

  const result = await setCommentReaction(user.id, ref.id, value);
  if (value !== 0) {
    await recordPostEvent({
      postId: ref.postId,
      actorUserId: user.id,
      eventType: "reaction_created",
    });
  }
  return c.json(result);
});

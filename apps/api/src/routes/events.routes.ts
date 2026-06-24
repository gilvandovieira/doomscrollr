import { CreateEventSchema } from "@doomscrollr/shared/schemas/event.schema.ts";
import { Hono } from "hono";
import { allowMockFallback, hasDatabase } from "../db/client.ts";
import { notFound } from "../lib/errors.ts";
import { parseOrThrow, readJsonBody } from "../lib/validation.ts";
import { ensureAnonSession } from "../lib/anon-session.ts";
import { enforceRateLimit, publicRateLimitKey, RATE_LIMITS } from "../lib/rate-limit.ts";
import { getOptionalViewerId } from "../middleware/auth.ts";
import { recordPostEvent } from "../repositories/events.repository.ts";
import { getPublishedVisiblePostRefByPublicCode } from "../repositories/posts.repository.ts";

export const eventsRoutes = new Hono();

// POST /api/events — the only write endpoint that does not require auth (spec §20.2).
// The Zod schema only admits the four client-observable event types, so
// comment_created / reaction_created are rejected as a validation error.
eventsRoutes.post("/", async (c) => {
  const body = parseOrThrow(CreateEventSchema, await readJsonBody(c));

  // Set/refresh the anonymous session on this public route so funnels chain.
  const anonSessionId = ensureAnonSession(c);
  // Public endpoint is pollutable; keep it within the v1 funnel budget (spec §16).
  await enforceRateLimit(
    await publicRateLimitKey(c, "events", anonSessionId),
    RATE_LIMITS.eventsPerSession,
  );

  if (!hasDatabase() && allowMockFallback()) {
    return c.body(null, 204);
  }

  const actorUserId = await getOptionalViewerId(c);
  const post = await getPublishedVisiblePostRefByPublicCode(body.postCode, actorUserId);
  if (!post) throw notFound("Post not found.");
  await recordPostEvent({
    postId: post.id,
    actorUserId: actorUserId ?? null,
    anonSessionId,
    eventType: body.eventType,
    metadata: body.metadata ?? null,
  });

  return c.body(null, 204);
});

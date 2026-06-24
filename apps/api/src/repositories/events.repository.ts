import { postEvents } from "@doomscrollr/database/schema.ts";
import { generateId } from "@doomscrollr/shared/lib/ids.ts";
import { db } from "../db/client.ts";

// Record a funnel event. Raw client IP must never be persisted here (spec §10.2);
// callers pass only the optional actor user id, the anonymous session id, and
// coarse, non-identifying metadata.
export async function recordPostEvent(input: {
  postId: string;
  actorUserId?: string | null;
  anonSessionId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  if (!db) throw new Error("Database is not configured.");

  await db.insert(postEvents).values({
    id: generateId(),
    postId: input.postId,
    actorUserId: input.actorUserId ?? null,
    anonSessionId: input.anonSessionId ?? null,
    eventType: input.eventType,
    metadata: input.metadata ?? null,
  });
}

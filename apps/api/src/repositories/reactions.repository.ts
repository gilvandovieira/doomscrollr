import { commentReactions, comments, postReactions, posts } from "@doomscrollr/database/schema.ts";
import type { ReactionResult } from "@doomscrollr/shared/types.ts";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.ts";

function requireDb() {
  if (!db) throw new Error("Database is not configured.");
  return db;
}

type Delta = { scoreDelta: number; countDelta: number; newValue: 1 | -1 | null };

// Shared reaction transition: insert / update / delete, returning how score and
// reaction_count must change and the viewer's resulting value (spec §8.4).
function transition(existing: number | null, value: 1 | -1 | 0): Delta {
  if (value === 0) {
    if (existing === null) return { scoreDelta: 0, countDelta: 0, newValue: null };
    return { scoreDelta: -existing, countDelta: -1, newValue: null };
  }
  if (existing === null) return { scoreDelta: value, countDelta: 1, newValue: value };
  if (existing === value) return { scoreDelta: 0, countDelta: 0, newValue: value };
  return { scoreDelta: value - existing, countDelta: 0, newValue: value };
}

export async function setPostReaction(
  userId: string,
  postId: string,
  value: 1 | -1 | 0,
): Promise<ReactionResult> {
  return await requireDb().transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`post:${userId}:${postId}`}, 0))`,
    );
    const existingRows = await tx
      .select({ value: postReactions.value })
      .from(postReactions)
      .where(and(eq(postReactions.userId, userId), eq(postReactions.postId, postId)))
      .limit(1);
    const existing = existingRows[0]?.value ?? null;
    let delta = transition(existing, value);

    if (value === 0) {
      if (existing !== null) {
        await tx.delete(postReactions).where(
          and(eq(postReactions.userId, userId), eq(postReactions.postId, postId)),
        );
      }
    } else if (existing === null) {
      const inserted = await tx.insert(postReactions)
        .values({ userId, postId, value })
        .onConflictDoNothing({
          target: [postReactions.userId, postReactions.postId],
        })
        .returning({ value: postReactions.value });
      if (inserted.length === 0) {
        const currentRows = await tx
          .select({ value: postReactions.value })
          .from(postReactions)
          .where(and(eq(postReactions.userId, userId), eq(postReactions.postId, postId)))
          .limit(1);
        const current = currentRows[0]?.value ?? null;
        delta = transition(current, value);
        if (current !== null && current !== value) {
          await tx.update(postReactions).set({ value, updatedAt: new Date() }).where(
            and(eq(postReactions.userId, userId), eq(postReactions.postId, postId)),
          );
        }
      }
    } else if (existing !== value) {
      await tx.update(postReactions).set({ value, updatedAt: new Date() }).where(
        and(eq(postReactions.userId, userId), eq(postReactions.postId, postId)),
      );
    }

    if (delta.scoreDelta !== 0 || delta.countDelta !== 0) {
      await tx
        .update(posts)
        .set({
          score: sql`${posts.score} + ${delta.scoreDelta}`,
          reactionCount: sql`${posts.reactionCount} + ${delta.countDelta}`,
          updatedAt: new Date(),
        })
        .where(eq(posts.id, postId));
    }

    const updated = await tx
      .select({ score: posts.score, reactionCount: posts.reactionCount })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    return {
      value: delta.newValue,
      score: updated[0]?.score ?? 0,
      reactionCount: updated[0]?.reactionCount ?? 0,
    };
  });
}

export async function setCommentReaction(
  userId: string,
  commentId: string,
  value: 1 | -1 | 0,
): Promise<ReactionResult> {
  return await requireDb().transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`comment:${userId}:${commentId}`}, 0))`,
    );
    const existingRows = await tx
      .select({ value: commentReactions.value })
      .from(commentReactions)
      .where(and(eq(commentReactions.userId, userId), eq(commentReactions.commentId, commentId)))
      .limit(1);
    const existing = existingRows[0]?.value ?? null;
    let delta = transition(existing, value);

    if (value === 0) {
      if (existing !== null) {
        await tx.delete(commentReactions).where(
          and(eq(commentReactions.userId, userId), eq(commentReactions.commentId, commentId)),
        );
      }
    } else if (existing === null) {
      const inserted = await tx.insert(commentReactions)
        .values({ userId, commentId, value })
        .onConflictDoNothing({
          target: [commentReactions.userId, commentReactions.commentId],
        })
        .returning({ value: commentReactions.value });
      if (inserted.length === 0) {
        const currentRows = await tx
          .select({ value: commentReactions.value })
          .from(commentReactions)
          .where(
            and(eq(commentReactions.userId, userId), eq(commentReactions.commentId, commentId)),
          )
          .limit(1);
        const current = currentRows[0]?.value ?? null;
        delta = transition(current, value);
        if (current !== null && current !== value) {
          await tx.update(commentReactions).set({ value, updatedAt: new Date() }).where(
            and(eq(commentReactions.userId, userId), eq(commentReactions.commentId, commentId)),
          );
        }
      }
    } else if (existing !== value) {
      await tx.update(commentReactions).set({ value, updatedAt: new Date() }).where(
        and(eq(commentReactions.userId, userId), eq(commentReactions.commentId, commentId)),
      );
    }

    if (delta.scoreDelta !== 0 || delta.countDelta !== 0) {
      await tx
        .update(comments)
        .set({
          score: sql`${comments.score} + ${delta.scoreDelta}`,
          reactionCount: sql`${comments.reactionCount} + ${delta.countDelta}`,
          updatedAt: new Date(),
        })
        .where(eq(comments.id, commentId));
    }

    const updated = await tx
      .select({ score: comments.score, reactionCount: comments.reactionCount })
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    return {
      value: delta.newValue,
      score: updated[0]?.score ?? 0,
      reactionCount: updated[0]?.reactionCount ?? 0,
    };
  });
}

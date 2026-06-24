import { comments, posts, userBlocks, users } from "@doomscrollr/database/schema.ts";
import { alias } from "drizzle-orm/pg-core";
import { generateId, generatePublicCode } from "@doomscrollr/shared/lib/ids.ts";
import type { Comment } from "@doomscrollr/shared/types.ts";
import { and, asc, eq, type SQL, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { type CommentRow, toComment, toReply } from "./transformers.ts";

function requireDb() {
  if (!db) throw new Error("Database is not configured.");
  return db;
}

const commentAuthorColumns = {
  username: users.username,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
};

function commentAuthorNotBlocked(viewerId: string): SQL {
  return sql`NOT EXISTS (
    SELECT 1 FROM ${userBlocks} b
    WHERE b.blocker_user_id = ${viewerId} AND b.blocked_user_id = ${comments.authorId}
  )`;
}

// List published comments for a post as a one-level tree (spec §13). Replies are
// grouped under their top-level parent by public code.
export async function listCommentsForPost(postId: string, viewerId?: string): Promise<Comment[]> {
  const parent = alias(comments, "parent");
  const filters: SQL[] = [eq(comments.postId, postId), eq(comments.status, "published")];
  if (viewerId) filters.push(commentAuthorNotBlocked(viewerId));

  const rows = await requireDb()
    .select({
      id: comments.id,
      publicCode: comments.publicCode,
      parentCommentCode: parent.publicCode,
      bodyText: comments.bodyText,
      score: comments.score,
      reactionCount: comments.reactionCount,
      replyCount: comments.replyCount,
      status: comments.status,
      createdAt: comments.createdAt,
      author: {
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .leftJoin(parent, eq(comments.parentCommentId, parent.id))
    .where(and(...filters))
    .orderBy(asc(comments.createdAt), asc(comments.id));

  const typed = rows as CommentRow[];
  const repliesByParentCode = new Map<string, ReturnType<typeof toReply>[]>();
  const topLevel: CommentRow[] = [];

  for (const row of typed) {
    if (row.parentCommentCode) {
      repliesByParentCode.set(row.parentCommentCode, [
        ...(repliesByParentCode.get(row.parentCommentCode) ?? []),
        toReply(row),
      ]);
    } else {
      topLevel.push(row);
    }
  }

  return topLevel.map((row) => toComment(row, repliesByParentCode.get(row.publicCode) ?? []));
}

// Resolve a parent comment for a reply. Returns null if it doesn't exist, belongs
// to another post, or is removed. isTopLevel enforces the one-level rule (spec §13).
export async function getReplyParent(
  postId: string,
  parentCommentCode: string,
): Promise<{ id: string; isTopLevel: boolean; authorId: string } | null> {
  const rows = await requireDb()
    .select({
      id: comments.id,
      parentCommentId: comments.parentCommentId,
      postId: comments.postId,
      status: comments.status,
      authorId: comments.authorId,
    })
    .from(comments)
    .where(eq(comments.publicCode, parentCommentCode))
    .limit(1);

  const row = rows[0];
  if (!row || row.postId !== postId || row.status !== "published") return null;
  return { id: row.id, isTopLevel: row.parentCommentId === null, authorId: row.authorId };
}

export async function getCommentRefByCode(
  commentCode: string,
): Promise<{ id: string; postId: string } | null> {
  const rows = await requireDb()
    .select({ id: comments.id, postId: comments.postId, status: comments.status })
    .from(comments)
    .where(eq(comments.publicCode, commentCode))
    .limit(1);
  const row = rows[0];
  if (!row || row.status !== "published") return null;
  return { id: row.id, postId: row.postId };
}

async function generateUniqueCommentCode(): Promise<string> {
  const database = requireDb();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generatePublicCode();
    const rows = await database
      .select({ id: comments.id })
      .from(comments)
      .where(eq(comments.publicCode, code))
      .limit(1);
    if (rows.length === 0) return code;
  }
  throw new Error("Could not generate a unique comment code.");
}

export async function createComment(input: {
  postId: string;
  authorId: string;
  bodyText: string;
  parentCommentId: string | null;
}): Promise<string> {
  const database = requireDb();
  const publicCode = await generateUniqueCommentCode();
  const id = generateId();

  await database.transaction(async (tx) => {
    await tx.insert(comments).values({
      id,
      publicCode,
      postId: input.postId,
      authorId: input.authorId,
      parentCommentId: input.parentCommentId,
      bodyText: input.bodyText,
    });
    await tx
      .update(posts)
      .set({ commentCount: sql`${posts.commentCount} + 1`, updatedAt: new Date() })
      .where(eq(posts.id, input.postId));
    if (input.parentCommentId) {
      await tx
        .update(comments)
        .set({ replyCount: sql`${comments.replyCount} + 1`, updatedAt: new Date() })
        .where(eq(comments.id, input.parentCommentId));
    }
  });

  return publicCode;
}

// Admin moderation (spec §14). Returns true if a matching comment was updated.
export async function removeCommentByCode(
  publicCode: string,
  adminId: string,
  reason: string,
): Promise<boolean> {
  const rows = await requireDb()
    .update(comments)
    .set({
      status: "removed",
      removalReason: reason,
      removedByUserId: adminId,
      removedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(comments.publicCode, publicCode), eq(comments.status, "published")))
    .returning({ id: comments.id });
  return rows.length > 0;
}

export async function restoreCommentByCode(publicCode: string): Promise<boolean> {
  const rows = await requireDb()
    .update(comments)
    .set({
      status: "published",
      removalReason: null,
      removedByUserId: null,
      removedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(comments.publicCode, publicCode), eq(comments.status, "removed")))
    .returning({ id: comments.id });
  return rows.length > 0;
}

export async function getCommentByCode(publicCode: string): Promise<Comment | null> {
  const parent = alias(comments, "parent");
  const rows = await requireDb()
    .select({
      id: comments.id,
      publicCode: comments.publicCode,
      parentCommentCode: parent.publicCode,
      bodyText: comments.bodyText,
      score: comments.score,
      reactionCount: comments.reactionCount,
      replyCount: comments.replyCount,
      status: comments.status,
      createdAt: comments.createdAt,
      author: commentAuthorColumns,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .leftJoin(parent, eq(comments.parentCommentId, parent.id))
    .where(eq(comments.publicCode, publicCode))
    .limit(1);

  const row = rows[0] as CommentRow | undefined;
  return row ? toComment(row, []) : null;
}

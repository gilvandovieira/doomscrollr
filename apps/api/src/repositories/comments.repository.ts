import { comments, posts, userBlocks, users } from "@doomscrollr/database/schema.ts";
import { alias } from "drizzle-orm/pg-core";
import { generateId, generatePublicCode } from "@doomscrollr/shared/lib/ids.ts";
import { CommentCursorSchema } from "@doomscrollr/shared/schemas/comment.schema.ts";
import type { Comment, CommentListQuery } from "@doomscrollr/shared/types.ts";
import { and, asc, eq, gt, isNull, or, type SQL, sql } from "drizzle-orm";
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

function commentAuthorVisible(): SQL {
  return sql`${users.status} NOT IN ('suspended', 'banned')`;
}

function postAuthorVisible(): SQL {
  return sql`EXISTS (
    SELECT 1 FROM users post_author
    WHERE post_author.id = ${posts.authorId}
      AND post_author.status NOT IN ('suspended', 'banned')
  )`;
}

function postTargetPublishedAndVisible(viewerId?: string): SQL {
  const blockFilter = viewerId
    ? sql`AND NOT EXISTS (
      SELECT 1 FROM user_blocks b
      WHERE b.blocker_user_id = ${viewerId} AND b.blocked_user_id = target.author_id
    )`
    : sql``;

  return sql`(
    ${posts.repostOfPostId} IS NULL OR EXISTS (
      SELECT 1 FROM posts target
      WHERE target.id = ${posts.repostOfPostId}
        AND target.status = 'published'
        AND EXISTS (
          SELECT 1 FROM users target_author
          WHERE target_author.id = target.author_id
            AND target_author.status NOT IN ('suspended', 'banned')
        )
        ${blockFilter}
    )
  )`;
}

function encodeCursor(value: { createdAt: string; id: string }): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return null;
  try {
    const normalized = cursor.replace(/-/g, "+").replace(/_/g, "/");
    return CommentCursorSchema.parse(JSON.parse(atob(normalized)));
  } catch {
    return null;
  }
}

// List published comments for a post as a one-level tree (spec §13). Replies are
// grouped under their top-level parent by public code.
export async function listCommentsForPost(
  postId: string,
  query: CommentListQuery,
  viewerId?: string,
): Promise<{ items: Comment[]; nextCursor: string | null }> {
  const cursor = decodeCursor(query.cursor);
  const filters: SQL[] = [
    eq(comments.postId, postId),
    eq(comments.status, "published"),
    isNull(comments.parentCommentId),
    commentAuthorVisible(),
  ];
  if (viewerId) filters.push(commentAuthorNotBlocked(viewerId));
  if (cursor) {
    const cursorDate = new Date(cursor.createdAt);
    filters.push(
      or(
        gt(comments.createdAt, cursorDate),
        and(eq(comments.createdAt, cursorDate), gt(comments.id, cursor.id)),
      )!,
    );
  }

  const rows = await requireDb()
    .select({
      id: comments.id,
      publicCode: comments.publicCode,
      parentCommentCode: sql<null>`NULL`,
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
    .where(and(...filters))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .limit(query.limit + 1);

  const topLevel = (rows as CommentRow[]).slice(0, query.limit);
  const repliesByParentCode = await repliesForTopLevel(topLevel, query.repliesLimit, viewerId);
  const last = topLevel[topLevel.length - 1];

  return {
    items: topLevel.map((row) => toComment(row, repliesByParentCode.get(row.publicCode) ?? [])),
    nextCursor: rows.length > query.limit && last
      ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
      : null,
  };
}

async function repliesForTopLevel(
  topLevel: CommentRow[],
  limit: number,
  viewerId?: string,
): Promise<Map<string, ReturnType<typeof toReply>[]>> {
  const map = new Map<string, ReturnType<typeof toReply>[]>();
  if (topLevel.length === 0 || limit <= 0) return map;

  await Promise.all(
    topLevel.map(async (parent) => {
      const filters: SQL[] = [
        eq(comments.parentCommentId, parent.id),
        eq(comments.status, "published"),
        commentAuthorVisible(),
      ];
      if (viewerId) filters.push(commentAuthorNotBlocked(viewerId));

      const rows = await requireDb()
        .select({
          id: comments.id,
          publicCode: comments.publicCode,
          parentCommentCode: sql<string>`${parent.publicCode}`,
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
        .where(and(...filters))
        .orderBy(asc(comments.createdAt), asc(comments.id))
        .limit(limit);

      map.set(parent.publicCode, (rows as CommentRow[]).map((row) => toReply(row)));
    }),
  );

  return map;
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

export async function getPublishedCommentRefByCode(
  commentCode: string,
  viewerId?: string,
): Promise<{ id: string; postId: string } | null> {
  const filters: SQL[] = [
    eq(comments.publicCode, commentCode),
    eq(comments.status, "published"),
    eq(posts.status, "published"),
    commentAuthorVisible(),
    postAuthorVisible(),
    postTargetPublishedAndVisible(viewerId),
  ];
  if (viewerId) {
    filters.push(commentAuthorNotBlocked(viewerId));
    filters.push(sql`NOT EXISTS (
      SELECT 1 FROM user_blocks b
      WHERE b.blocker_user_id = ${viewerId} AND b.blocked_user_id = ${posts.authorId}
    )`);
  }

  const rows = await requireDb()
    .select({ id: comments.id, postId: comments.postId })
    .from(comments)
    .innerJoin(posts, eq(comments.postId, posts.id))
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(and(...filters))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCommentNotificationRefByCode(
  commentCode: string,
): Promise<{ id: string; postId: string; authorId: string; publicCode: string } | null> {
  const rows = await requireDb()
    .select({
      id: comments.id,
      postId: comments.postId,
      authorId: comments.authorId,
      publicCode: comments.publicCode,
    })
    .from(comments)
    .where(eq(comments.publicCode, commentCode))
    .limit(1);
  return rows[0] ?? null;
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

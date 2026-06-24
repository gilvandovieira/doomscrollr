import { postReactions, posts, postTags, tags, users } from "@doomscrollr/database/schema.ts";
import { generateId, generatePublicCode } from "@doomscrollr/shared/lib/ids.ts";
import { slugify } from "@doomscrollr/shared/lib/slug.ts";
import { RecentCursorSchema } from "@doomscrollr/shared/schemas/pagination.schema.ts";
import type {
  FeedPost,
  FeedResponse,
  PostDetail,
  PostKind,
  PostStatus,
} from "@doomscrollr/shared/types.ts";
import { and, desc, eq, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { type EmbeddedPost, type FeedPostRow, toEmbeddedPost, toFeedPost } from "./transformers.ts";

function requireDb() {
  if (!db) throw new Error("Database is not configured.");
  return db;
}

const authorColumns = {
  username: users.username,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
};

function basePostSelect() {
  return requireDb()
    .select({
      id: posts.id,
      publicCode: posts.publicCode,
      slug: posts.slug,
      postKind: posts.postKind,
      title: posts.title,
      bodyText: posts.bodyText,
      imageUrl: posts.imageUrl,
      youtubeUrl: posts.youtubeUrl,
      youtubeVideoId: posts.youtubeVideoId,
      youtubeIsShort: posts.youtubeIsShort,
      repostOfPostId: posts.repostOfPostId,
      status: posts.status,
      score: posts.score,
      reactionCount: posts.reactionCount,
      commentCount: posts.commentCount,
      repostCount: posts.repostCount,
      quoteCount: posts.quoteCount,
      createdAt: posts.createdAt,
      author: authorColumns,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .$dynamic();
}

// Push the block filter into SQL so the feed never runs N+1 visibility checks (spec §9, §15).
function notBlocked(viewerId: string): SQL {
  return sql`NOT EXISTS (
    SELECT 1 FROM user_blocks b
    WHERE b.blocker_user_id = ${viewerId} AND b.blocked_user_id = ${posts.authorId}
  )`;
}

function authorAccountVisible(): SQL {
  return sql`${users.status} NOT IN ('suspended', 'banned')`;
}

function targetPublishedAndVisible(viewerId?: string): SQL {
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

async function tagSlugsByPostId(postIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (postIds.length === 0) return map;

  const rows = await requireDb()
    .select({ postId: postTags.postId, slug: tags.slug })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(inArray(postTags.postId, postIds))
    .orderBy(tags.slug);

  for (const row of rows) {
    map.set(row.postId, [...(map.get(row.postId) ?? []), row.slug]);
  }
  return map;
}

function encodeCursor(value: { createdAt: string; id: string }): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return null;
  try {
    const normalized = cursor.replace(/-/g, "+").replace(/_/g, "/");
    return RecentCursorSchema.parse(JSON.parse(atob(normalized)));
  } catch {
    return null;
  }
}

async function repostTargetsById(
  rows: FeedPostRow[],
  viewerId?: string,
): Promise<Map<string, EmbeddedPost>> {
  const targetIds = [...new Set(rows.map((row) => row.repostOfPostId).filter(Boolean))] as string[];
  const map = new Map<string, EmbeddedPost>();
  if (targetIds.length === 0) return map;

  const filters: SQL[] = [inArray(posts.id, targetIds), eq(posts.status, "published")];
  if (viewerId) filters.push(notBlocked(viewerId));

  const targetRows = await basePostSelect()
    .where(and(...filters));

  for (const row of targetRows as FeedPostRow[]) {
    map.set(row.id, toEmbeddedPost(row));
  }
  return map;
}

async function buildFeedPosts(rows: FeedPostRow[], viewerId?: string): Promise<FeedPost[]> {
  const tagMap = await tagSlugsByPostId(rows.map((row) => row.id));
  const repostTargetMap = await repostTargetsById(rows, viewerId);
  return rows.map((row) =>
    toFeedPost(
      row,
      tagMap.get(row.id) ?? [],
      null,
      row.repostOfPostId ? repostTargetMap.get(row.repostOfPostId) ?? null : null,
    )
  );
}

async function buildFeedResponse(
  rows: FeedPostRow[],
  limit: number,
  viewerId?: string,
): Promise<FeedResponse> {
  const page = rows.slice(0, limit);
  const items = await buildFeedPosts(page, viewerId);
  const last = page[page.length - 1];

  return {
    items,
    nextCursor: rows.length > limit && last
      ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
      : null,
  };
}

export async function listRecentFeed(
  query: { limit: number; cursor?: string; kind?: PostKind },
  viewerId?: string,
): Promise<FeedResponse> {
  const cursor = decodeCursor(query.cursor);
  const filters: SQL[] = [
    eq(posts.status, "published"),
    authorAccountVisible(),
    targetPublishedAndVisible(viewerId),
  ];

  if (query.kind) filters.push(eq(posts.postKind, query.kind));
  if (viewerId) filters.push(notBlocked(viewerId));
  if (cursor) {
    const cursorDate = new Date(cursor.createdAt);
    filters.push(
      or(
        lt(posts.createdAt, cursorDate),
        and(eq(posts.createdAt, cursorDate), lt(posts.id, cursor.id)),
      )!,
    );
  }

  const rows = await basePostSelect()
    .where(and(...filters))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(query.limit + 1);

  return buildFeedResponse(rows as FeedPostRow[], query.limit, viewerId);
}

export async function listRecentFeedByTagId(
  tagId: string,
  query: { limit: number; cursor?: string; kind?: PostKind },
  viewerId?: string,
): Promise<FeedResponse> {
  const cursor = decodeCursor(query.cursor);
  const filters: SQL[] = [
    eq(posts.status, "published"),
    authorAccountVisible(),
    eq(postTags.tagId, tagId),
    targetPublishedAndVisible(viewerId),
  ];

  if (query.kind) filters.push(eq(posts.postKind, query.kind));
  if (viewerId) filters.push(notBlocked(viewerId));
  if (cursor) {
    const cursorDate = new Date(cursor.createdAt);
    filters.push(
      or(
        lt(posts.createdAt, cursorDate),
        and(eq(posts.createdAt, cursorDate), lt(posts.id, cursor.id)),
      )!,
    );
  }

  const rows = await basePostSelect()
    .innerJoin(postTags, eq(postTags.postId, posts.id))
    .where(and(...filters))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(query.limit + 1);

  return buildFeedResponse(rows as FeedPostRow[], query.limit, viewerId);
}

export async function getPublishedPostByPublicCode(
  publicCode: string,
  viewerId?: string,
): Promise<PostDetail | null> {
  const filters: SQL[] = [
    eq(posts.publicCode, publicCode),
    eq(posts.status, "published"),
    authorAccountVisible(),
    targetPublishedAndVisible(viewerId),
  ];
  if (viewerId) filters.push(notBlocked(viewerId));

  const rows = await basePostSelect().where(and(...filters)).limit(1);
  const row = rows[0] as FeedPostRow | undefined;
  if (!row) return null;

  return (await buildFeedPosts([row], viewerId))[0] ?? null;
}

// Used by the server-rendered post page (spec §11). Returns the post regardless of
// status so the handler can distinguish "removed" (unavailable) from "missing".
export async function getPostForPublicPageByCode(publicCode: string): Promise<FeedPost | null> {
  const rows = await basePostSelect()
    .where(
      and(eq(posts.publicCode, publicCode), authorAccountVisible(), targetPublishedAndVisible()),
    )
    .limit(1);
  const row = rows[0] as FeedPostRow | undefined;
  if (!row) return null;

  return (await buildFeedPosts([row]))[0] ?? null;
}

export async function listPostsByUsername(
  username: string,
  viewerId?: string,
): Promise<FeedResponse | null> {
  const userRows = await requireDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const user = userRows[0];
  if (!user) return null;

  const filters: SQL[] = [
    eq(posts.authorId, user.id),
    eq(posts.status, "published"),
    authorAccountVisible(),
    targetPublishedAndVisible(viewerId),
  ];
  if (viewerId) filters.push(notBlocked(viewerId));

  const rows = await basePostSelect()
    .where(and(...filters))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(30);

  return {
    items: await buildFeedPosts(rows as FeedPostRow[], viewerId),
    nextCursor: null,
  };
}

export async function getPostIdByPublicCode(publicCode: string): Promise<string | null> {
  const rows = await requireDb()
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.publicCode, publicCode))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function getPublishedVisiblePostRefByPublicCode(
  publicCode: string,
  viewerId?: string,
): Promise<{ id: string; authorId: string } | null> {
  const filters: SQL[] = [
    eq(posts.publicCode, publicCode),
    eq(posts.status, "published"),
    authorAccountVisible(),
    targetPublishedAndVisible(viewerId),
  ];
  if (viewerId) filters.push(notBlocked(viewerId));

  const rows = await requireDb()
    .select({ id: posts.id, authorId: posts.authorId })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(...filters))
    .limit(1);
  return rows[0] ?? null;
}

export async function getReshareTargetByPublicCode(
  publicCode: string,
): Promise<{ id: string; authorId: string; title: string; status: PostStatus } | null> {
  const rows = await requireDb()
    .select({
      id: posts.id,
      authorId: posts.authorId,
      title: posts.title,
      status: posts.status,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.publicCode, publicCode), authorAccountVisible()))
    .limit(1);
  return rows[0] ?? null;
}

export async function hasPublishedRepost(
  authorId: string,
  repostOfPostId: string,
): Promise<boolean> {
  const rows = await requireDb()
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(
        eq(posts.authorId, authorId),
        eq(posts.repostOfPostId, repostOfPostId),
        eq(posts.postKind, "repost"),
        eq(posts.status, "published"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function getPostModerationTargetByCode(
  publicCode: string,
): Promise<
  { id: string; authorId: string; publicCode: string; slug: string; title: string } | null
> {
  const rows = await requireDb()
    .select({
      id: posts.id,
      authorId: posts.authorId,
      publicCode: posts.publicCode,
      slug: posts.slug,
      title: posts.title,
    })
    .from(posts)
    .where(eq(posts.publicCode, publicCode))
    .limit(1);
  return rows[0] ?? null;
}

// Admin moderation (spec §14). Returns true if a matching post was updated.
export async function removePostByCode(
  publicCode: string,
  adminId: string,
  reason: string,
): Promise<boolean> {
  const rows = await requireDb()
    .update(posts)
    .set({
      status: "removed",
      removalReason: reason,
      removedByUserId: adminId,
      removedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(posts.publicCode, publicCode), eq(posts.status, "published")))
    .returning({ id: posts.id });
  return rows.length > 0;
}

export async function restorePostByCode(publicCode: string): Promise<boolean> {
  const rows = await requireDb()
    .update(posts)
    .set({
      status: "published",
      removalReason: null,
      removedByUserId: null,
      removedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(posts.publicCode, publicCode), eq(posts.status, "removed")))
    .returning({ id: posts.id });
  return rows.length > 0;
}

async function generateUniquePostCode(): Promise<string> {
  const database = requireDb();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generatePublicCode();
    const rows = await database
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.publicCode, code))
      .limit(1);
    if (rows.length === 0) return code;
  }
  throw new Error("Could not generate a unique post code.");
}

export type CreatePostFields = {
  authorId: string;
  postKind: PostKind;
  title: string;
  bodyText?: string | null;
  imageUrl?: string | null;
  youtubeUrl?: string | null;
  youtubeVideoId?: string | null;
  youtubeIsShort?: boolean;
  repostOfPostId?: string | null;
  tagIds: string[];
};

export async function createPost(
  fields: CreatePostFields,
): Promise<{ publicCode: string; slug: string }> {
  const database = requireDb();
  const publicCode = await generateUniquePostCode();
  const slug = slugify(fields.title);
  const id = generateId();

  await database.transaction(async (tx) => {
    await tx.insert(posts).values({
      id,
      publicCode,
      authorId: fields.authorId,
      postKind: fields.postKind,
      title: fields.title,
      slug,
      bodyText: fields.bodyText ?? null,
      imageUrl: fields.imageUrl ?? null,
      youtubeUrl: fields.youtubeUrl ?? null,
      youtubeVideoId: fields.youtubeVideoId ?? null,
      youtubeIsShort: fields.youtubeIsShort ?? false,
      repostOfPostId: fields.repostOfPostId ?? null,
      // The author implicitly endorses their own post (Reddit-style): it opens at
      // one point with the author's upvote, which they can later remove.
      score: 1,
      reactionCount: 1,
    });

    await tx.insert(postReactions).values({
      userId: fields.authorId,
      postId: id,
      value: 1,
    });

    if (fields.tagIds.length > 0) {
      await tx.insert(postTags).values(fields.tagIds.map((tagId) => ({ postId: id, tagId })));
      await tx
        .update(tags)
        .set({ postCount: sql`${tags.postCount} + 1`, updatedAt: new Date() })
        .where(inArray(tags.id, fields.tagIds));
    }

    const counterUpdate = fields.postKind === "repost"
      ? { repostCount: sql`${posts.repostCount} + 1` }
      : fields.postKind === "quote"
      ? { quoteCount: sql`${posts.quoteCount} + 1` }
      : null;

    if (fields.repostOfPostId && counterUpdate) {
      await tx
        .update(posts)
        .set({
          ...counterUpdate,
          updatedAt: new Date(),
        })
        .where(eq(posts.id, fields.repostOfPostId));
    }
  });

  return { publicCode, slug };
}

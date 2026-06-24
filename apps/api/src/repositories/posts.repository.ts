import { posts, postTags, tags, users } from "@doomscrollr/database/schema.ts";
import { generateId, generatePublicCode } from "@doomscrollr/shared/lib/ids.ts";
import { slugify } from "@doomscrollr/shared/lib/slug.ts";
import { RecentCursorSchema } from "@doomscrollr/shared/schemas/pagination.schema.ts";
import type { FeedPost, FeedResponse, PostDetail, PostKind } from "@doomscrollr/shared/types.ts";
import { and, desc, eq, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { type FeedPostRow, toFeedPost } from "./transformers.ts";

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
      status: posts.status,
      score: posts.score,
      reactionCount: posts.reactionCount,
      commentCount: posts.commentCount,
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

async function buildFeedResponse(rows: FeedPostRow[], limit: number): Promise<FeedResponse> {
  const page = rows.slice(0, limit);
  const tagMap = await tagSlugsByPostId(page.map((row) => row.id));
  const items = page.map((row) => toFeedPost(row, tagMap.get(row.id) ?? []));
  const last = page[page.length - 1];

  return {
    items,
    nextCursor: rows.length > limit && last
      ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
      : null,
  };
}

export async function listRecentFeed(
  query: { limit: number; cursor?: string },
  viewerId?: string,
): Promise<FeedResponse> {
  const cursor = decodeCursor(query.cursor);
  const filters: SQL[] = [eq(posts.status, "published")];

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

  return buildFeedResponse(rows as FeedPostRow[], query.limit);
}

export async function getPublishedPostByPublicCode(
  publicCode: string,
  viewerId?: string,
): Promise<PostDetail | null> {
  const filters: SQL[] = [eq(posts.publicCode, publicCode), eq(posts.status, "published")];
  if (viewerId) filters.push(notBlocked(viewerId));

  const rows = await basePostSelect().where(and(...filters)).limit(1);
  const row = rows[0] as FeedPostRow | undefined;
  if (!row) return null;

  const tagMap = await tagSlugsByPostId([row.id]);
  return toFeedPost(row, tagMap.get(row.id) ?? []);
}

// Used by the server-rendered post page (spec §11). Returns the post regardless of
// status so the handler can distinguish "removed" (unavailable) from "missing".
export async function getPostForPublicPageByCode(publicCode: string): Promise<FeedPost | null> {
  const rows = await basePostSelect().where(eq(posts.publicCode, publicCode)).limit(1);
  const row = rows[0] as FeedPostRow | undefined;
  if (!row) return null;

  const tagMap = await tagSlugsByPostId([row.id]);
  return toFeedPost(row, tagMap.get(row.id) ?? []);
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

  const filters: SQL[] = [eq(posts.authorId, user.id), eq(posts.status, "published")];
  if (viewerId) filters.push(notBlocked(viewerId));

  const rows = await basePostSelect()
    .where(and(...filters))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(30);

  const tagMap = await tagSlugsByPostId((rows as FeedPostRow[]).map((row) => row.id));
  return {
    items: (rows as FeedPostRow[]).map((row) => toFeedPost(row, tagMap.get(row.id) ?? [])),
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

// Used to resolve who owns a post (for block enforcement on comments/replies, §15).
export async function getPostOwnerById(postId: string): Promise<string | null> {
  const rows = await requireDb()
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return rows[0]?.authorId ?? null;
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

// Resolve requested tag slugs to active curated tag ids (spec §8.7). Unknown or
// disabled tags are simply absent from the result; the caller validates the count.
export async function getActiveTagsBySlugs(
  slugs: string[],
): Promise<{ id: string; slug: string }[]> {
  if (slugs.length === 0) return [];
  return await requireDb()
    .select({ id: tags.id, slug: tags.slug })
    .from(tags)
    .where(and(inArray(tags.slug, slugs), eq(tags.status, "active")));
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
    });

    if (fields.tagIds.length > 0) {
      await tx.insert(postTags).values(fields.tagIds.map((tagId) => ({ postId: id, tagId })));
      await tx
        .update(tags)
        .set({ postCount: sql`${tags.postCount} + 1`, updatedAt: new Date() })
        .where(inArray(tags.id, fields.tagIds));
    }
  });

  return { publicCode, slug };
}

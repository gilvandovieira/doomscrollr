import {
  comments,
  mediaAssets,
  posts,
  postTags,
  tags,
  users,
} from "@doomscrollr/database/schema.ts";
import type {
  Comment,
  FeedResponse,
  FeedSort,
  PostDetail,
  PostFeedQuery,
} from "@doomscrollr/shared/types.ts";
import { and, desc, eq, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { type CommentRow, toComment, toCommentReply, toFeedPost } from "./transformers.ts";

type FeedCursor = {
  sort: FeedSort;
  id: string;
  createdAt?: string;
  score?: number;
  hotScore?: number;
};

const hotScoreExpression = sql<
  number
>`log(greatest(${posts.score}, 1)) + extract(epoch from ${posts.createdAt}) / 3600 / 12`;

export async function listFeedPosts(query: PostFeedQuery): Promise<FeedResponse> {
  if (!db) {
    throw new Error("Database is not configured.");
  }

  const cursor = decodeCursor(query.cursor);
  const filters: SQL[] = [eq(posts.status, "published")];

  if (cursor?.sort === query.sort) {
    const cursorFilter = buildCursorFilter(query.sort, cursor);
    if (cursorFilter) {
      filters.push(cursorFilter);
    }
  }

  const rows = await basePostQuery()
    .where(and(...filters))
    .orderBy(...orderByForSort(query.sort))
    .limit(query.limit + 1);

  const pageRows = rows.slice(0, query.limit);
  const tagMap = await getTagsByPostIds(pageRows.map((row) => row.id));
  const items = pageRows.map((row) => toFeedPost(row, tagMap.get(row.id) ?? []));
  const last = items.at(-1);

  return {
    items,
    nextCursor: rows.length > query.limit && last
      ? encodeCursor({
        sort: query.sort,
        id: last.id,
        createdAt: last.createdAt,
        score: last.score,
        hotScore: calculateHotScore(last.score, last.createdAt),
      })
      : null,
  };
}

export async function getPostDetail(postId: string): Promise<PostDetail | null> {
  if (!db) {
    throw new Error("Database is not configured.");
  }

  const rows = await basePostQuery()
    .where(and(eq(posts.id, postId), eq(posts.status, "published")))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const tagMap = await getTagsByPostIds([row.id]);
  return {
    ...toFeedPost(row, tagMap.get(row.id) ?? []),
    body: null,
  };
}

export async function listCommentsForPost(postId: string) {
  if (!db) {
    throw new Error("Database is not configured.");
  }

  const rows = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      parentId: comments.parentId,
      body: comments.body,
      score: comments.score,
      status: comments.status,
      moderationStatus: comments.moderationStatus,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(and(eq(comments.postId, postId), eq(comments.status, "published")))
    .orderBy(comments.createdAt);

  return buildCommentTree(rows as CommentRow[]);
}

export async function listPostsByUser(username: string): Promise<FeedResponse | null> {
  if (!db) {
    throw new Error("Database is not configured.");
  }

  const userRows = await db.select({ id: users.id }).from(users).where(eq(users.username, username))
    .limit(1);
  const user = userRows[0];

  if (!user) {
    return null;
  }

  const rows = await basePostQuery()
    .where(and(eq(posts.authorId, user.id), eq(posts.status, "published")))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(30);

  const tagMap = await getTagsByPostIds(rows.map((row) => row.id));

  return {
    items: rows.map((row) => toFeedPost(row, tagMap.get(row.id) ?? [])),
    nextCursor: null,
  };
}

function basePostQuery() {
  if (!db) {
    throw new Error("Database is not configured.");
  }

  return db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      score: posts.score,
      upvoteCount: posts.upvoteCount,
      downvoteCount: posts.downvoteCount,
      commentCount: posts.commentCount,
      status: posts.status,
      monetizationStatus: posts.monetizationStatus,
      adSafetyScore: posts.adSafetyScore,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
      media: {
        id: mediaAssets.id,
        provider: mediaAssets.provider,
        mediaType: mediaAssets.mediaType,
        providerMediaId: mediaAssets.providerMediaId,
        originalUrl: mediaAssets.originalUrl,
        embedUrl: mediaAssets.embedUrl,
        thumbnailUrl: mediaAssets.thumbnailUrl,
        previewUrl: mediaAssets.previewUrl,
        width: mediaAssets.width,
        height: mediaAssets.height,
        durationSeconds: mediaAssets.durationSeconds,
        aspectRatio: mediaAssets.aspectRatio,
        attributionLabel: mediaAssets.attributionLabel,
        attributionUrl: mediaAssets.attributionUrl,
        status: mediaAssets.status,
      },
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .innerJoin(mediaAssets, eq(posts.mediaAssetId, mediaAssets.id))
    .$dynamic();
}

async function getTagsByPostIds(postIds: string[]) {
  if (!db || postIds.length === 0) {
    return new Map<string, string[]>();
  }

  const rows = await db
    .select({
      postId: postTags.postId,
      tag: tags.name,
    })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(inArray(postTags.postId, postIds))
    .orderBy(tags.name);

  const tagMap = new Map<string, string[]>();
  for (const row of rows) {
    tagMap.set(row.postId, [...(tagMap.get(row.postId) ?? []), row.tag]);
  }

  return tagMap;
}

function buildCommentTree(rows: CommentRow[]) {
  const repliesByParent = new Map<string, Comment["replies"]>();
  const topLevelRows: CommentRow[] = [];

  for (const row of rows) {
    if (row.parentId) {
      repliesByParent.set(row.parentId, [
        ...(repliesByParent.get(row.parentId) ?? []),
        toCommentReply(row),
      ]);
    } else {
      topLevelRows.push(row);
    }
  }

  return topLevelRows.map((row) => toComment(row, repliesByParent.get(row.id) ?? []));
}

function orderByForSort(sort: FeedSort) {
  if (sort === "recent") {
    return [desc(posts.createdAt), desc(posts.id)] as const;
  }

  if (sort === "top") {
    return [desc(posts.score), desc(posts.id)] as const;
  }

  return [desc(hotScoreExpression), desc(posts.id)] as const;
}

function buildCursorFilter(sort: FeedSort, cursor: FeedCursor) {
  if (sort === "recent" && cursor.createdAt) {
    const createdAt = new Date(cursor.createdAt);
    return or(
      lt(posts.createdAt, createdAt),
      and(eq(posts.createdAt, createdAt), lt(posts.id, cursor.id)),
    );
  }

  if (sort === "top" && typeof cursor.score === "number") {
    return or(
      lt(posts.score, cursor.score),
      and(eq(posts.score, cursor.score), lt(posts.id, cursor.id)),
    );
  }

  if (sort === "hot" && typeof cursor.hotScore === "number") {
    return sql`(${hotScoreExpression} < ${cursor.hotScore} OR (${hotScoreExpression} = ${cursor.hotScore} AND ${posts.id} < ${cursor.id}))`;
  }

  return null;
}

function encodeCursor(value: FeedCursor) {
  return btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeCursor(cursor: string | undefined) {
  if (!cursor) {
    return null;
  }

  try {
    const normalized = cursor.replaceAll("-", "+").replaceAll("_", "/");
    return JSON.parse(atob(normalized)) as FeedCursor;
  } catch {
    return null;
  }
}

function calculateHotScore(score: number, createdAt: string) {
  return Math.log10(Math.max(score, 1)) + Date.parse(createdAt) / 1000 / 3600 / 12;
}

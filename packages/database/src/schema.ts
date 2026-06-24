import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// v1 data model (spec §8 + §10.2). Posts store only the fields they need; there is
// no generalized media_assets lifecycle, no content rating, no ranking, no ads.

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "limited", "suspended", "banned"]);
export const postKind = pgEnum("post_kind", ["text", "external_image", "youtube"]);
export const postStatus = pgEnum("post_status", ["published", "removed"]);
export const commentStatus = pgEnum("comment_status", ["published", "removed"]);
export const reportTargetType = pgEnum("report_target_type", ["post", "comment", "user"]);
export const reportStatus = pgEnum("report_status", ["open", "dismissed", "actioned"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  username: text("username").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  role: userRole("role").notNull().default("user"),
  status: userStatus("status").notNull().default("active"),
  ...timestamps,
}, (table) => [
  uniqueIndex("users_clerk_user_id_unique").on(table.clerkUserId),
  uniqueIndex("users_username_unique").on(table.username),
  check("users_username_format", sql`${table.username} ~ '^[a-z0-9_]{3,24}$'`),
]);

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey(),
  publicCode: text("public_code").notNull(),
  authorId: uuid("author_id").notNull().references(() => users.id),
  postKind: postKind("post_kind").notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  bodyText: text("body_text"),
  imageUrl: text("image_url"),
  youtubeUrl: text("youtube_url"),
  youtubeVideoId: text("youtube_video_id"),
  youtubeIsShort: boolean("youtube_is_short").notNull().default(false),
  status: postStatus("status").notNull().default("published"),
  removalReason: text("removal_reason"),
  removedByUserId: uuid("removed_by_user_id").references(() => users.id),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  score: integer("score").notNull().default(0),
  reactionCount: integer("reaction_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  reportCount: integer("report_count").notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex("posts_public_code_unique").on(table.publicCode),
  index("posts_recent_idx").on(table.createdAt, table.id),
  index("posts_author_recent_idx").on(table.authorId, table.createdAt, table.id),
  check("posts_title_length", sql`length(trim(${table.title})) BETWEEN 3 AND 180`),
  check(
    "posts_kind_fields",
    sql`(
      ${table.postKind} = 'text'
      AND ${table.bodyText} IS NOT NULL
      AND length(trim(${table.bodyText})) > 0
      AND ${table.imageUrl} IS NULL
      AND ${table.youtubeUrl} IS NULL
      AND ${table.youtubeVideoId} IS NULL
    ) OR (
      ${table.postKind} = 'external_image'
      AND ${table.bodyText} IS NULL
      AND ${table.imageUrl} IS NOT NULL
      AND ${table.youtubeUrl} IS NULL
      AND ${table.youtubeVideoId} IS NULL
    ) OR (
      ${table.postKind} = 'youtube'
      AND ${table.bodyText} IS NULL
      AND ${table.youtubeUrl} IS NOT NULL
      AND ${table.youtubeVideoId} IS NOT NULL
      AND ${table.imageUrl} IS NULL
    )`,
  ),
]);

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey(),
  publicCode: text("public_code").notNull(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  parentCommentId: uuid("parent_comment_id").references((): AnyPgColumn => comments.id),
  bodyText: text("body_text").notNull(),
  status: commentStatus("status").notNull().default("published"),
  score: integer("score").notNull().default(0),
  reactionCount: integer("reaction_count").notNull().default(0),
  replyCount: integer("reply_count").notNull().default(0),
  removalReason: text("removal_reason"),
  removedByUserId: uuid("removed_by_user_id").references(() => users.id),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("comments_public_code_unique").on(table.publicCode),
  index("comments_post_recent_idx").on(table.postId, table.createdAt, table.id),
  index("comments_parent_idx").on(table.parentCommentId, table.createdAt, table.id),
  check("comments_body_length", sql`length(trim(${table.bodyText})) BETWEEN 1 AND 2000`),
]);

export const postReactions = pgTable("post_reactions", {
  userId: uuid("user_id").notNull().references(() => users.id),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  value: smallint("value").notNull(),
  ...timestamps,
}, (table) => [
  primaryKey({ columns: [table.userId, table.postId] }),
  check("post_reactions_value", sql`${table.value} IN (-1, 1)`),
]);

export const commentReactions = pgTable("comment_reactions", {
  userId: uuid("user_id").notNull().references(() => users.id),
  commentId: uuid("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  value: smallint("value").notNull(),
  ...timestamps,
}, (table) => [
  primaryKey({ columns: [table.userId, table.commentId] }),
  check("comment_reactions_value", sql`${table.value} IN (-1, 1)`),
]);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey(),
  reporterUserId: uuid("reporter_user_id").notNull().references(() => users.id),
  targetType: reportTargetType("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  status: reportStatus("status").notNull().default("open"),
  ...timestamps,
}, (table) => [
  index("reports_status_idx").on(table.status),
]);

export const userBlocks = pgTable("user_blocks", {
  blockerUserId: uuid("blocker_user_id").notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
  blockedUserId: uuid("blocked_user_id").notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamps.createdAt,
}, (table) => [
  primaryKey({ columns: [table.blockerUserId, table.blockedUserId] }),
  check("user_blocks_distinct", sql`${table.blockerUserId} <> ${table.blockedUserId}`),
]);

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  postCount: integer("post_count").notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex("tags_slug_unique").on(table.slug),
  check("tags_slug_format", sql`${table.slug} ~ '^[a-z0-9-]{2,32}$'`),
]);

export const postTags = pgTable("post_tags", {
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  createdAt: timestamps.createdAt,
}, (table) => [
  primaryKey({ columns: [table.postId, table.tagId] }),
]);

export const postEvents = pgTable("post_events", {
  id: uuid("id").primaryKey(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  anonSessionId: text("anon_session_id"),
  eventType: text("event_type").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamps.createdAt,
}, (table) => [
  index("post_events_post_idx").on(table.postId, table.createdAt),
  index("post_events_anon_idx").on(table.anonSessionId, table.createdAt).where(
    sql`${table.anonSessionId} IS NOT NULL`,
  ),
]);

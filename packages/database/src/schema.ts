import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "moderator", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "restricted", "banned"]);
export const mediaProvider = pgEnum("media_provider", ["upload", "youtube", "giphy", "tenor"]);
export const mediaType = pgEnum("media_type", ["image", "gif", "video", "short"]);
export const mediaStatus = pgEnum("media_status", ["ready", "pending_review", "blocked"]);
export const aspectRatio = pgEnum("aspect_ratio", ["square", "landscape", "portrait", "unknown"]);
export const contentStatus = pgEnum("content_status", [
  "published",
  "hidden",
  "removed",
  "pending_review",
]);
export const monetizationStatus = pgEnum("monetization_status", [
  "enabled",
  "disabled",
  "pending_review",
  "unsafe",
]);
export const reportStatus = pgEnum("report_status", ["open", "dismissed", "actioned"]);
export const reportTargetType = pgEnum("report_target_type", ["post", "comment", "user"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: userRole("role").notNull().default("user"),
  status: userStatus("status").notNull().default("active"),
  ...timestamps,
}, (table) => [
  uniqueIndex("users_clerk_user_id_unique").on(table.clerkUserId),
  uniqueIndex("users_username_unique").on(table.username),
]);

export const mediaAssets = pgTable("media_assets", {
  id: text("id").primaryKey(),
  provider: mediaProvider("provider").notNull(),
  mediaType: mediaType("media_type").notNull(),
  providerMediaId: text("provider_media_id"),
  originalUrl: text("original_url"),
  embedUrl: text("embed_url"),
  thumbnailUrl: text("thumbnail_url").notNull(),
  previewUrl: text("preview_url"),
  width: integer("width"),
  height: integer("height"),
  durationSeconds: integer("duration_seconds"),
  aspectRatio: aspectRatio("aspect_ratio").notNull().default("unknown"),
  attributionLabel: text("attribution_label"),
  attributionUrl: text("attribution_url"),
  metadataJson: jsonb("metadata_json"),
  status: mediaStatus("status").notNull().default("pending_review"),
  createdAt: timestamps.createdAt,
});

export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  authorId: text("author_id").notNull().references(() => users.id),
  mediaAssetId: text("media_asset_id").notNull().references(() => mediaAssets.id),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  score: integer("score").notNull().default(0),
  upvoteCount: integer("upvote_count").notNull().default(0),
  downvoteCount: integer("downvote_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  status: contentStatus("status").notNull().default("published"),
  monetizationStatus: monetizationStatus("monetization_status").notNull().default("pending_review"),
  adSafetyScore: real("ad_safety_score").notNull().default(0),
  ...timestamps,
}, (table) => [
  index("posts_created_at_idx").on(table.createdAt),
  index("posts_score_idx").on(table.score),
  index("posts_status_idx").on(table.status),
  index("posts_monetization_status_idx").on(table.monetizationStatus),
]);

export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull().references(() => posts.id),
  authorId: text("author_id").notNull().references(() => users.id),
  parentId: text("parent_id"),
  body: text("body").notNull(),
  score: integer("score").notNull().default(0),
  status: contentStatus("status").notNull().default("published"),
  moderationStatus: text("moderation_status").notNull().default("clean"),
  ...timestamps,
}, (table) => [
  index("comments_post_id_idx").on(table.postId),
  index("comments_parent_id_idx").on(table.parentId),
]);

export const postVotes = pgTable("post_votes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  postId: text("post_id").notNull().references(() => posts.id),
  value: integer("value").notNull(),
  createdAt: timestamps.createdAt,
}, (table) => [
  uniqueIndex("post_votes_user_post_unique").on(table.userId, table.postId),
]);

export const commentVotes = pgTable("comment_votes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  commentId: text("comment_id").notNull().references(() => comments.id),
  value: integer("value").notNull(),
  createdAt: timestamps.createdAt,
}, (table) => [
  uniqueIndex("comment_votes_user_comment_unique").on(table.userId, table.commentId),
]);

export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull().references(() => users.id),
  targetType: reportTargetType("target_type").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  status: reportStatus("status").notNull().default("open"),
  createdAt: timestamps.createdAt,
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by").references(() => users.id),
}, (table) => [
  index("reports_status_idx").on(table.status),
]);

export const moderationActions = pgTable("moderation_actions", {
  id: text("id").primaryKey(),
  moderatorId: text("moderator_id").notNull().references(() => users.id),
  targetType: reportTargetType("target_type").notNull(),
  targetId: text("target_id").notNull(),
  action: text("action").notNull(),
  reason: text("reason"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamps.createdAt,
});

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
}, (table) => [
  uniqueIndex("tags_name_unique").on(table.name),
]);

export const postTags = pgTable("post_tags", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull().references(() => posts.id),
  tagId: text("tag_id").notNull().references(() => tags.id),
}, (table) => [
  uniqueIndex("post_tags_post_tag_unique").on(table.postId, table.tagId),
]);

export const savedPosts = pgTable("saved_posts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  postId: text("post_id").notNull().references(() => posts.id),
  createdAt: timestamps.createdAt,
}, (table) => [
  uniqueIndex("saved_posts_user_post_unique").on(table.userId, table.postId),
]);

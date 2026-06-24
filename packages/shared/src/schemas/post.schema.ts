import { z } from "zod";
import { DEFAULT_FEED_LIMIT, MAX_FEED_LIMIT } from "../constants.ts";
import { CreatePostSourceSchema, MediaAssetSchema } from "./media.schema.ts";
import { AuthorSchema } from "./user.schema.ts";

export const FeedSortSchema = z.enum(["hot", "recent", "top"]);

export const CreatePostSchema = z.object({
  title: z.string().trim().min(3).max(160),
  source: CreatePostSourceSchema,
  tags: z.array(
    z.string().min(1).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  ).max(8).default([]),
});

export const PostFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_FEED_LIMIT).default(DEFAULT_FEED_LIMIT),
  cursor: z.string().optional(),
  sort: FeedSortSchema.default("hot"),
});

export const FeedPostSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  score: z.number().int(),
  upvoteCount: z.number().int().nonnegative(),
  downvoteCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  status: z.enum(["published", "hidden", "removed", "pending_review"]),
  monetizationStatus: z.enum(["enabled", "disabled", "pending_review", "unsafe"]),
  adSafetyScore: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  author: AuthorSchema,
  media: MediaAssetSchema,
  tags: z.array(z.string()),
});

export const FeedAdItemSchema = z.object({
  type: z.literal("ad"),
  placement: z.literal("feed_inline"),
  slot: z.string().min(1),
});

export const FeedPostItemSchema = z.object({
  type: z.literal("post"),
  post: FeedPostSchema,
});

export const FeedItemSchema = z.discriminatedUnion("type", [FeedPostItemSchema, FeedAdItemSchema]);

export const FeedResponseSchema = z.object({
  items: z.array(FeedPostSchema),
  nextCursor: z.string().nullable(),
});

export const PostDetailSchema = FeedPostSchema.extend({
  body: z.string().max(2000).nullable(),
});

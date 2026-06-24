import { z } from "zod";
import {
  DEFAULT_FEED_LIMIT,
  MAX_FEED_LIMIT,
  MAX_TAGS_PER_POST,
  POST_BODY_MAX_LENGTH,
  TAG_SLUG_REGEX,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from "../constants.ts";
import { AuthorSchema } from "./user.schema.ts";

// v2 adds reposts and quote posts while keeping media providers limited.
export const PostKindSchema = z.enum(["text", "external_image", "youtube", "repost", "quote"]);

// Posts are either published (SFW and allowed) or removed (spec §3, §8.2).
export const PostStatusSchema = z.enum(["published", "removed"]);

export const ReactionValueSchema = z.union([z.literal(1), z.literal(-1)]);

const TitleSchema = z.string().trim().min(TITLE_MIN_LENGTH).max(TITLE_MAX_LENGTH);

// Text posts may omit the title; the server fills it from the body's first
// sentence. Lenient here (no min) so an empty field is accepted — the route does
// the deriving and enforces the final 3–180 length.
const OptionalTitleSchema = z.string().trim().max(TITLE_MAX_LENGTH).optional();

const TagsSchema = z
  .array(z.string().regex(TAG_SLUG_REGEX))
  .max(MAX_TAGS_PER_POST)
  .default([]);

// Create-post payloads, discriminated by kind (spec §12).
export const CreatePostSchema = z.discriminatedUnion("postKind", [
  z
    .object({
      postKind: z.literal("text"),
      title: OptionalTitleSchema,
      bodyText: z.string().trim().min(1).max(POST_BODY_MAX_LENGTH),
      tags: TagsSchema,
    })
    .strict(),
  z
    .object({
      postKind: z.literal("external_image"),
      title: TitleSchema,
      imageUrl: z.string().url(),
      tags: TagsSchema,
    })
    .strict(),
  z
    .object({
      postKind: z.literal("youtube"),
      title: OptionalTitleSchema,
      youtubeUrl: z.string().url(),
      tags: TagsSchema,
    })
    .strict(),
]);

export const CreateQuotePostSchema = z
  .object({
    bodyText: z.string().trim().min(1).max(POST_BODY_MAX_LENGTH),
  })
  .strict();

const EmbeddedPostSchema = z
  .object({
    publicCode: z.string().min(1),
    slug: z.string().min(1),
    postKind: PostKindSchema,
    title: z.string().min(1),
    bodyText: z.string().nullable(),
    imageUrl: z.string().url().nullable(),
    youtubeUrl: z.string().url().nullable(),
    youtubeVideoId: z.string().nullable(),
    youtubeIsShort: z.boolean(),
    author: AuthorSchema,
    canonicalPath: z.string().min(1),
  })
  .strict();

// Public post shape. Internal ids never cross the boundary; posts are addressed
// by publicCode + slug (spec §6, §7).
export const FeedPostSchema = z
  .object({
    publicCode: z.string().min(1),
    slug: z.string().min(1),
    postKind: PostKindSchema,
    title: z.string().min(1),
    bodyText: z.string().nullable(),
    imageUrl: z.string().url().nullable(),
    youtubeUrl: z.string().url().nullable(),
    youtubeVideoId: z.string().nullable(),
    youtubeIsShort: z.boolean(),
    status: PostStatusSchema,
    score: z.number().int(),
    reactionCount: z.number().int().nonnegative(),
    commentCount: z.number().int().nonnegative(),
    repostCount: z.number().int().nonnegative(),
    quoteCount: z.number().int().nonnegative(),
    author: AuthorSchema,
    repostOf: EmbeddedPostSchema.nullable(),
    tags: z.array(z.string()),
    canonicalPath: z.string().min(1),
    createdAt: z.string().datetime(),
    viewerReaction: ReactionValueSchema.nullable(),
  })
  .strict();

export const PostDetailSchema = FeedPostSchema;

export const RecentFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_FEED_LIMIT).default(DEFAULT_FEED_LIMIT),
  cursor: z.string().optional(),
});

export const FeedResponseSchema = z
  .object({
    items: z.array(FeedPostSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();

export const CreatePostResponseSchema = z
  .object({
    post: PostDetailSchema,
    canonicalUrl: z.string().url(),
  })
  .strict();

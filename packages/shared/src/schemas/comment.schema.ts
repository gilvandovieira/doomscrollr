import { z } from "zod";
import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  DEFAULT_COMMENT_LIMIT,
  DEFAULT_REPLIES_PER_COMMENT,
  MAX_COMMENT_LIMIT,
  MAX_REPLIES_PER_COMMENT,
} from "../constants.ts";
import { RecentCursorSchema } from "./pagination.schema.ts";
import { ReactionValueSchema } from "./post.schema.ts";
import { AuthorSchema } from "./user.schema.ts";

export const CommentStatusSchema = z.enum(["published", "removed"]);

// v1 comments are one-level: a reply targets a top-level comment, and replies
// cannot receive replies (spec §13). Parent is addressed by its public code.
export const CreateCommentSchema = z.object({
  bodyText: z.string().trim().min(COMMENT_MIN_LENGTH).max(COMMENT_MAX_LENGTH),
  parentCommentCode: z.string().optional(),
});

export const CommentCursorSchema = RecentCursorSchema;

export const CommentListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_COMMENT_LIMIT).default(DEFAULT_COMMENT_LIMIT),
  cursor: z.string().optional(),
  repliesLimit: z.coerce.number().int().min(0).max(MAX_REPLIES_PER_COMMENT)
    .default(DEFAULT_REPLIES_PER_COMMENT),
});

const BaseCommentSchema = z.object({
  publicCode: z.string().min(1),
  author: AuthorSchema,
  parentCommentCode: z.string().nullable(),
  bodyText: z.string().min(1).max(COMMENT_MAX_LENGTH),
  score: z.number().int(),
  reactionCount: z.number().int().nonnegative(),
  replyCount: z.number().int().nonnegative(),
  status: CommentStatusSchema,
  createdAt: z.string().datetime(),
  viewerReaction: ReactionValueSchema.nullable(),
});

export const ReplyCommentSchema = BaseCommentSchema.extend({
  replies: z.tuple([]).default([]),
}).strict();

export const CommentSchema = BaseCommentSchema.extend({
  replies: z.array(ReplyCommentSchema).default([]),
}).strict();

export const CommentThreadResponseSchema = z
  .object({
    items: z.array(CommentSchema),
    nextCursor: z.string().nullable().default(null),
  })
  .strict();

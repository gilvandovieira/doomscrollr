import { z } from "zod";
import { COMMENT_MAX_LENGTH, COMMENT_MIN_LENGTH } from "../constants.ts";
import { ReactionValueSchema } from "./post.schema.ts";
import { AuthorSchema } from "./user.schema.ts";

export const CommentStatusSchema = z.enum(["published", "removed"]);

// v1 comments are one-level: a reply targets a top-level comment, and replies
// cannot receive replies (spec §13). Parent is addressed by its public code.
export const CreateCommentSchema = z.object({
  bodyText: z.string().trim().min(COMMENT_MIN_LENGTH).max(COMMENT_MAX_LENGTH),
  parentCommentCode: z.string().optional(),
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
  })
  .strict();

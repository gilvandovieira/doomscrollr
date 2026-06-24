import { z } from "zod";
import { AuthorSchema } from "./user.schema.ts";

export const CreateCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  parentId: z.string().optional(),
});

const BaseCommentSchema = z.object({
  id: z.string().min(1),
  postId: z.string().min(1),
  author: AuthorSchema,
  parentId: z.string().nullable(),
  body: z.string().min(1).max(2000),
  score: z.number().int(),
  status: z.enum(["published", "removed", "hidden"]),
  moderationStatus: z.enum(["clean", "reported", "removed"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ReplyCommentSchema = BaseCommentSchema.extend({
  replies: z.tuple([]).default([]),
});

export const CommentSchema = BaseCommentSchema.extend({
  replies: z.array(ReplyCommentSchema).default([]),
});

export const CommentThreadResponseSchema = z.object({
  items: z.array(CommentSchema),
});

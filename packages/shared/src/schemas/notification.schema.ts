import { z } from "zod";
import { AuthorSchema } from "./user.schema.ts";

export const NotificationTypeSchema = z.enum([
  "post_reply",
  "comment_reply",
  "mention",
  "moderation_outcome",
]);

export const NotificationSchema = z
  .object({
    id: z.string().min(1),
    type: NotificationTypeSchema,
    actor: AuthorSchema.nullable(),
    postCode: z.string().min(1).nullable(),
    postTitle: z.string().min(1).nullable(),
    postPath: z.string().min(1).nullable(),
    commentCode: z.string().min(1).nullable(),
    bodyPreview: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    readAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const NotificationListResponseSchema = z
  .object({
    items: z.array(NotificationSchema),
    unreadCount: z.number().int().nonnegative(),
  })
  .strict();

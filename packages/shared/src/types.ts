import type { z } from "zod";
import type {
  CommentSchema,
  CommentStatusSchema,
  CommentThreadResponseSchema,
  CreateCommentSchema,
  ReplyCommentSchema,
} from "./schemas/comment.schema.ts";
import type { ClientEventTypeSchema, CreateEventSchema } from "./schemas/event.schema.ts";
import type {
  CreatePostResponseSchema,
  CreatePostSchema,
  FeedPostSchema,
  FeedResponseSchema,
  PostDetailSchema,
  PostKindSchema,
  PostStatusSchema,
  RecentFeedQuerySchema,
} from "./schemas/post.schema.ts";
import type { ReactionResultSchema, SetReactionSchema } from "./schemas/reaction.schema.ts";
import type {
  CreateReportSchema,
  ReportSchema,
  ReportStatusSchema,
  ReportTargetTypeSchema,
} from "./schemas/report.schema.ts";
import type {
  AuthorSchema,
  SetUsernameSchema,
  UserProfileSchema,
  UserRoleSchema,
  UserStatusSchema,
} from "./schemas/user.schema.ts";

export type UserRole = z.infer<typeof UserRoleSchema>;
export type UserStatus = z.infer<typeof UserStatusSchema>;
export type Author = z.infer<typeof AuthorSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type SetUsernameInput = z.infer<typeof SetUsernameSchema>;

export type PostKind = z.infer<typeof PostKindSchema>;
export type PostStatus = z.infer<typeof PostStatusSchema>;
export type FeedPost = z.infer<typeof FeedPostSchema>;
export type PostDetail = z.infer<typeof PostDetailSchema>;
export type FeedResponse = z.infer<typeof FeedResponseSchema>;
export type RecentFeedQuery = z.infer<typeof RecentFeedQuerySchema>;
export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type CreatePostResponse = z.infer<typeof CreatePostResponseSchema>;

export type CommentStatus = z.infer<typeof CommentStatusSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type ReplyComment = z.infer<typeof ReplyCommentSchema>;
export type CommentThreadResponse = z.infer<typeof CommentThreadResponseSchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export type SetReactionInput = z.infer<typeof SetReactionSchema>;
export type ReactionResult = z.infer<typeof ReactionResultSchema>;

export type ClientEventType = z.infer<typeof ClientEventTypeSchema>;
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export type ReportTargetType = z.infer<typeof ReportTargetTypeSchema>;
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type CreateReportInput = z.infer<typeof CreateReportSchema>;

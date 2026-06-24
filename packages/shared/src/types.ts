import type { z } from "zod";
import type {
  CommentListQuerySchema,
  CommentSchema,
  CommentStatusSchema,
  CommentThreadResponseSchema,
  CreateCommentSchema,
  ReplyCommentSchema,
} from "./schemas/comment.schema.ts";
import type { ClientEventTypeSchema, CreateEventSchema } from "./schemas/event.schema.ts";
import type {
  NotificationListResponseSchema,
  NotificationSchema,
  NotificationTypeSchema,
} from "./schemas/notification.schema.ts";
import type {
  CreatePostResponseSchema,
  CreatePostSchema,
  CreateQuotePostSchema,
  FeedPostSchema,
  FeedResponseSchema,
  PostDetailSchema,
  PostKindSchema,
  PostStatusSchema,
  RecentFeedQuerySchema,
} from "./schemas/post.schema.ts";
import type { ReactionResultSchema, SetReactionSchema } from "./schemas/reaction.schema.ts";
import type {
  AdminDomainBlockListResponseSchema,
  AdminDomainBlockSchema,
  AdminReportListQuerySchema,
  BulkReportActionSchema,
  CreateDomainBlockSchema,
  CreateModerationNoteSchema,
  CreateReportSchema,
  ModerationAuditActionSchema,
  ModerationAuditEventSchema,
  ModerationAuditListResponseSchema,
  ModerationNoteSchema,
  ReportReasonSchema,
  ReportSchema,
  ReportStatusSchema,
  ReportTargetTypeSchema,
  SetUserModerationStatusSchema,
  SetUserTrustLevelSchema,
} from "./schemas/report.schema.ts";
import type {
  AdminTagListResponseSchema,
  AdminTagSchema,
  CreateAdminTagSchema,
  CreateTagAliasSchema,
  MergeTagSchema,
  TagDetailResponseSchema,
  TagListResponseSchema,
  TagSchema,
  TagSlugSchema,
  TagStatusSchema,
} from "./schemas/tag.schema.ts";
import type {
  AuthorSchema,
  SetUsernameSchema,
  UserProfileSchema,
  UserRoleSchema,
  UserStatusSchema,
  UserTrustLevelSchema,
} from "./schemas/user.schema.ts";

export type UserRole = z.infer<typeof UserRoleSchema>;
export type UserStatus = z.infer<typeof UserStatusSchema>;
export type UserTrustLevel = z.infer<typeof UserTrustLevelSchema>;
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
export type CreateQuotePostInput = z.infer<typeof CreateQuotePostSchema>;
export type CreatePostResponse = z.infer<typeof CreatePostResponseSchema>;

export type CommentStatus = z.infer<typeof CommentStatusSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type ReplyComment = z.infer<typeof ReplyCommentSchema>;
export type CommentThreadResponse = z.infer<typeof CommentThreadResponseSchema>;
export type CommentListQuery = z.infer<typeof CommentListQuerySchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export type SetReactionInput = z.infer<typeof SetReactionSchema>;
export type ReactionResult = z.infer<typeof ReactionResultSchema>;

export type ClientEventType = z.infer<typeof ClientEventTypeSchema>;
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export type NotificationType = z.infer<typeof NotificationTypeSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;

export type ReportTargetType = z.infer<typeof ReportTargetTypeSchema>;
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
export type ReportReason = z.infer<typeof ReportReasonSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type CreateReportInput = z.infer<typeof CreateReportSchema>;
export type AdminReportListQuery = z.infer<typeof AdminReportListQuerySchema>;
export type AdminDomainBlock = z.infer<typeof AdminDomainBlockSchema>;
export type AdminDomainBlockListResponse = z.infer<typeof AdminDomainBlockListResponseSchema>;
export type CreateDomainBlockInput = z.infer<typeof CreateDomainBlockSchema>;
export type CreateModerationNoteInput = z.infer<typeof CreateModerationNoteSchema>;
export type BulkReportActionInput = z.infer<typeof BulkReportActionSchema>;
export type SetUserModerationStatusInput = z.infer<typeof SetUserModerationStatusSchema>;
export type SetUserTrustLevelInput = z.infer<typeof SetUserTrustLevelSchema>;
export type ModerationNote = z.infer<typeof ModerationNoteSchema>;
export type ModerationAuditAction = z.infer<typeof ModerationAuditActionSchema>;
export type ModerationAuditEvent = z.infer<typeof ModerationAuditEventSchema>;
export type ModerationAuditListResponse = z.infer<typeof ModerationAuditListResponseSchema>;

export type TagSlug = z.infer<typeof TagSlugSchema>;
export type TagStatus = z.infer<typeof TagStatusSchema>;
export type Tag = z.infer<typeof TagSchema>;
export type TagListResponse = z.infer<typeof TagListResponseSchema>;
export type TagDetailResponse = z.infer<typeof TagDetailResponseSchema>;
export type AdminTag = z.infer<typeof AdminTagSchema>;
export type AdminTagListResponse = z.infer<typeof AdminTagListResponseSchema>;
export type CreateAdminTagInput = z.infer<typeof CreateAdminTagSchema>;
export type CreateTagAliasInput = z.infer<typeof CreateTagAliasSchema>;
export type MergeTagInput = z.infer<typeof MergeTagSchema>;

import type { z } from "zod";
import type {
  CommentSchema,
  CommentThreadResponseSchema,
  CreateCommentSchema,
} from "./schemas/comment.schema.ts";
import type {
  AspectRatioSchema,
  CreatePostSourceSchema,
  MediaAssetSchema,
  MediaProviderSchema,
  MediaTypeSchema,
} from "./schemas/media.schema.ts";
import type {
  CreatePostSchema,
  FeedItemSchema,
  FeedPostSchema,
  FeedResponseSchema,
  FeedSortSchema,
  PostDetailSchema,
  PostFeedQuerySchema,
} from "./schemas/post.schema.ts";
import type { CreateReportSchema, ReportSchema } from "./schemas/report.schema.ts";
import type { AuthorSchema, UserProfileSchema } from "./schemas/user.schema.ts";

export type MediaProvider = z.infer<typeof MediaProviderSchema>;
export type MediaType = z.infer<typeof MediaTypeSchema>;
export type AspectRatio = z.infer<typeof AspectRatioSchema>;
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type CreatePostSource = z.infer<typeof CreatePostSourceSchema>;

export type Author = z.infer<typeof AuthorSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;

export type FeedSort = z.infer<typeof FeedSortSchema>;
export type FeedPost = z.infer<typeof FeedPostSchema>;
export type PostDetail = z.infer<typeof PostDetailSchema>;
export type FeedItem = z.infer<typeof FeedItemSchema>;
export type FeedResponse = z.infer<typeof FeedResponseSchema>;
export type PostFeedQuery = z.infer<typeof PostFeedQuerySchema>;
export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export type Comment = z.infer<typeof CommentSchema>;
export type CommentThreadResponse = z.infer<typeof CommentThreadResponseSchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export type Report = z.infer<typeof ReportSchema>;
export type CreateReportInput = z.infer<typeof CreateReportSchema>;

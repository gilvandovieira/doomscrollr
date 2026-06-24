import type {
  Author,
  Comment,
  FeedPost,
  MediaAsset,
  Report,
  UserProfile,
} from "@doomscrollr/shared/types.ts";

type AuthorRow = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type MediaRow = {
  id: string;
  provider: MediaAsset["provider"];
  mediaType: MediaAsset["mediaType"];
  providerMediaId: string | null;
  originalUrl: string | null;
  embedUrl: string | null;
  thumbnailUrl: string;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  aspectRatio: MediaAsset["aspectRatio"];
  attributionLabel: string | null;
  attributionUrl: string | null;
  status: MediaAsset["status"];
};

export type FeedPostRow = {
  id: string;
  title: string;
  slug: string;
  score: number;
  upvoteCount: number;
  downvoteCount: number;
  commentCount: number;
  status: FeedPost["status"];
  monetizationStatus: FeedPost["monetizationStatus"];
  adSafetyScore: number;
  createdAt: Date;
  updatedAt: Date;
  author: AuthorRow;
  media: MediaRow;
};

export type CommentRow = {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  score: number;
  status: Comment["status"];
  moderationStatus: Comment["moderationStatus"];
  createdAt: Date;
  updatedAt: Date;
  author: AuthorRow;
};

export type UserRow = AuthorRow & {
  role: UserProfile["role"];
  status: UserProfile["status"];
  createdAt: Date;
};

export type ReportRow = {
  id: string;
  reporter: AuthorRow;
  targetType: Report["targetType"];
  targetId: string;
  reason: Report["reason"];
  details: string | null;
  status: Report["status"];
  createdAt: Date;
  reviewedAt: Date | null;
  reviewedBy: AuthorRow | null;
};

export function toAuthor(row: AuthorRow): Author {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl ?? `https://api.dicebear.com/9.x/shapes/svg?seed=${row.username}`,
  };
}

export function toMediaAsset(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    provider: row.provider,
    mediaType: row.mediaType,
    providerMediaId: row.providerMediaId,
    originalUrl: row.originalUrl,
    embedUrl: row.embedUrl,
    thumbnailUrl: row.thumbnailUrl,
    previewUrl: row.previewUrl,
    width: row.width,
    height: row.height,
    durationSeconds: row.durationSeconds,
    aspectRatio: row.aspectRatio,
    attributionLabel: row.attributionLabel,
    attributionUrl: row.attributionUrl,
    status: row.status,
  };
}

export function toFeedPost(row: FeedPostRow, tags: string[]): FeedPost {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    score: row.score,
    upvoteCount: row.upvoteCount,
    downvoteCount: row.downvoteCount,
    commentCount: row.commentCount,
    status: row.status,
    monetizationStatus: row.monetizationStatus,
    adSafetyScore: row.adSafetyScore,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    author: toAuthor(row.author),
    media: toMediaAsset(row.media),
    tags,
  };
}

export function toComment(row: CommentRow, replies: Comment["replies"] = []): Comment {
  return {
    id: row.id,
    postId: row.postId,
    author: toAuthor(row.author),
    parentId: row.parentId,
    body: row.body,
    score: row.score,
    status: row.status,
    moderationStatus: row.moderationStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    replies,
  };
}

export function toCommentReply(row: CommentRow): Comment["replies"][number] {
  return {
    id: row.id,
    postId: row.postId,
    author: toAuthor(row.author),
    parentId: row.parentId,
    body: row.body,
    score: row.score,
    status: row.status,
    moderationStatus: row.moderationStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    replies: [],
  };
}

export function toUserProfile(
  row: UserRow,
  counts: { postCount: number; commentCount: number },
): UserProfile {
  return {
    ...toAuthor(row),
    role: row.role,
    status: row.status,
    bio: "",
    postCount: counts.postCount,
    commentCount: counts.commentCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toReport(row: ReportRow): Report {
  return {
    id: row.id,
    reporter: toAuthor(row.reporter),
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy ? toAuthor(row.reviewedBy) : null,
  };
}

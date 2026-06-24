import type {
  Author,
  Comment,
  FeedPost,
  PostKind,
  PostStatus,
  ReplyComment,
  UserProfile,
  UserRole,
  UserStatus,
} from "@doomscrollr/shared/types.ts";

export type AuthorRow = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

// Internal `id` is carried only for server-side joins (tags, reactions); it is
// never written to the public shape (spec §6).
export type FeedPostRow = {
  id: string;
  publicCode: string;
  slug: string;
  postKind: PostKind;
  title: string;
  bodyText: string | null;
  imageUrl: string | null;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  youtubeIsShort: boolean;
  status: PostStatus;
  score: number;
  reactionCount: number;
  commentCount: number;
  createdAt: Date;
  author: AuthorRow;
};

export type CommentRow = {
  id: string;
  publicCode: string;
  parentCommentCode: string | null;
  bodyText: string;
  score: number;
  reactionCount: number;
  replyCount: number;
  status: Comment["status"];
  createdAt: Date;
  author: AuthorRow;
};

export type UserRow = AuthorRow & {
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
};

export function toAuthor(row: AuthorRow): Author {
  return {
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
  };
}

export function canonicalPath(publicCode: string, slug: string): string {
  return `/p/${publicCode}/${slug}`;
}

export function toFeedPost(
  row: FeedPostRow,
  tags: string[],
  viewerReaction: 1 | -1 | null = null,
): FeedPost {
  return {
    publicCode: row.publicCode,
    slug: row.slug,
    postKind: row.postKind,
    title: row.title,
    bodyText: row.bodyText,
    imageUrl: row.imageUrl,
    youtubeUrl: row.youtubeUrl,
    youtubeVideoId: row.youtubeVideoId,
    youtubeIsShort: row.youtubeIsShort,
    status: row.status,
    score: row.score,
    reactionCount: row.reactionCount,
    commentCount: row.commentCount,
    author: toAuthor(row.author),
    tags,
    canonicalPath: canonicalPath(row.publicCode, row.slug),
    createdAt: row.createdAt.toISOString(),
    viewerReaction,
  };
}

export function toReply(row: CommentRow, viewerReaction: 1 | -1 | null = null): ReplyComment {
  return {
    publicCode: row.publicCode,
    author: toAuthor(row.author),
    parentCommentCode: row.parentCommentCode,
    bodyText: row.bodyText,
    score: row.score,
    reactionCount: row.reactionCount,
    replyCount: row.replyCount,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    viewerReaction,
    replies: [],
  };
}

export function toComment(
  row: CommentRow,
  replies: ReplyComment[] = [],
  viewerReaction: 1 | -1 | null = null,
): Comment {
  return {
    ...toReply(row, viewerReaction),
    replies,
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
    postCount: counts.postCount,
    commentCount: counts.commentCount,
    createdAt: row.createdAt.toISOString(),
  };
}

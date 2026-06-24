import { RecentCursorSchema } from "./schemas/pagination.schema.ts";
import type {
  Author,
  Comment,
  FeedPost,
  FeedResponse,
  PostDetail,
  Report,
  Tag,
  UserProfile,
} from "./types.ts";

// Deterministic clock so seeded/mock timestamps are stable.
const MOCK_NOW = Date.parse("2026-06-24T12:00:00.000Z");
const MOCK_EPOCH = Date.parse("2026-01-01T12:00:00.000Z");

function hoursAgo(hours: number): string {
  return new Date(MOCK_NOW - hours * 60 * 60 * 1000).toISOString();
}

function canonicalPath(publicCode: string, slug: string): string {
  return `/p/${publicCode}/${slug}`;
}

export type MockUser = {
  username: string;
  displayName: string;
  avatarUrl: string;
  role: "user" | "admin";
  status: "active" | "limited" | "suspended" | "banned";
  createdAtHoursOffset: number; // days from MOCK_EPOCH, kept small for stable data
};

export const mockUsers: MockUser[] = [
  {
    username: "lucas",
    displayName: "Lucas",
    avatarUrl: avatar("lucas"),
    role: "admin",
    status: "active",
    createdAtHoursOffset: 0,
  },
  {
    username: "maya",
    displayName: "Maya",
    avatarUrl: avatar("maya"),
    role: "user",
    status: "active",
    createdAtHoursOffset: 1,
  },
  {
    username: "ren",
    displayName: "Ren",
    avatarUrl: avatar("ren"),
    role: "user",
    status: "active",
    createdAtHoursOffset: 2,
  },
  {
    username: "ana",
    displayName: "Ana",
    avatarUrl: avatar("ana"),
    role: "user",
    status: "active",
    createdAtHoursOffset: 3,
  },
];

function avatar(seed: string): string {
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${seed}`;
}

export type MockTag = {
  slug: string;
  displayName: string;
  description: string;
};

export const mockTags: MockTag[] = [
  { slug: "programming", displayName: "Programming", description: "Code, builds, and outages." },
  { slug: "internet", displayName: "Internet", description: "Online culture and history." },
  { slug: "memes", displayName: "Memes", description: "Reusable jokes in image form." },
  { slug: "music", displayName: "Music", description: "Songs, clips, and shorts." },
];

export const mockTagAliases: { aliasSlug: string; targetSlug: string }[] = [
  { aliasSlug: "dev", targetSlug: "programming" },
  { aliasSlug: "web", targetSlug: "internet" },
];

export type MockPost = {
  key: string;
  publicCode: string;
  slug: string;
  postKind: "text" | "external_image" | "youtube" | "repost" | "quote";
  title: string;
  bodyText: string | null;
  imageUrl: string | null;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  youtubeIsShort: boolean;
  repostOfKey: string | null;
  status: "published" | "removed";
  score: number;
  reactionCount: number;
  commentCount: number;
  repostCount: number;
  quoteCount: number;
  reportCount: number;
  authorUsername: string;
  tags: string[]; // tag slugs
  hoursAgo: number;
};

export const mockPosts: MockPost[] = [
  {
    key: "post-friday",
    publicCode: "7kF3mQx9Za",
    slug: "when-prod-breaks-on-friday",
    postKind: "text",
    title: "When prod breaks on Friday",
    bodyText:
      "Nothing focuses a team like a 4:55pm deploy. Drop your worst Friday incident story below.",
    imageUrl: null,
    youtubeUrl: null,
    youtubeVideoId: null,
    youtubeIsShort: false,
    repostOfKey: null,
    status: "published",
    score: 128,
    reactionCount: 134,
    commentCount: 2,
    repostCount: 0,
    quoteCount: 0,
    reportCount: 0,
    authorUsername: "lucas",
    tags: ["programming"],
    hoursAgo: 2,
  },
  {
    key: "post-forums",
    publicCode: "Qd8RtVn2Lp",
    slug: "why-old-forums-felt-better-than-discord",
    postKind: "text",
    title: "Why old forums felt better than Discord",
    bodyText:
      "Threads stayed readable for years. Search worked. The lore was preserved. Change my mind.",
    imageUrl: null,
    youtubeUrl: null,
    youtubeVideoId: null,
    youtubeIsShort: false,
    repostOfKey: null,
    status: "published",
    score: 92,
    reactionCount: 96,
    commentCount: 0,
    repostCount: 0,
    quoteCount: 0,
    reportCount: 0,
    authorUsername: "maya",
    tags: ["internet"],
    hoursAgo: 5,
  },
  {
    key: "post-meme",
    publicCode: "Mw4Yb6Hc3K",
    slug: "the-cache-invalidated-itself",
    postKind: "external_image",
    title: "POV: the cache invalidated itself",
    bodyText: null,
    imageUrl: "https://picsum.photos/seed/cache-meme/1200/800",
    youtubeUrl: null,
    youtubeVideoId: null,
    youtubeIsShort: false,
    repostOfKey: null,
    status: "published",
    score: 204,
    reactionCount: 211,
    commentCount: 0,
    repostCount: 0,
    quoteCount: 0,
    reportCount: 0,
    authorUsername: "ren",
    tags: ["programming", "memes"],
    hoursAgo: 8,
  },
  {
    key: "post-short",
    publicCode: "Zp9Lk2Dn5T",
    slug: "this-short-is-too-accurate",
    postKind: "youtube",
    title: "This short is too accurate",
    bodyText: null,
    imageUrl: null,
    youtubeUrl: "https://www.youtube.com/shorts/jNQXAC9IVRw",
    youtubeVideoId: "jNQXAC9IVRw",
    youtubeIsShort: true,
    repostOfKey: null,
    status: "published",
    score: 156,
    reactionCount: 160,
    commentCount: 0,
    repostCount: 0,
    quoteCount: 0,
    reportCount: 0,
    authorUsername: "ana",
    tags: ["music"],
    hoursAgo: 12,
  },
  {
    key: "post-classic",
    publicCode: "Bf2Hn7Wq4R",
    slug: "the-video-that-started-the-internet",
    postKind: "youtube",
    title: "The video that started the internet",
    bodyText: null,
    imageUrl: null,
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeVideoId: "dQw4w9WgXcQ",
    youtubeIsShort: false,
    repostOfKey: null,
    status: "published",
    score: 77,
    reactionCount: 80,
    commentCount: 0,
    repostCount: 0,
    quoteCount: 0,
    reportCount: 0,
    authorUsername: "maya",
    tags: ["internet", "music"],
    hoursAgo: 20,
  },
];

export type MockComment = {
  key: string;
  publicCode: string;
  postKey: string;
  authorUsername: string;
  parentKey: string | null;
  bodyText: string;
  score: number;
  reactionCount: number;
  replyCount: number;
  minutesAgo: number;
};

export const mockComments: MockComment[] = [
  {
    key: "comment-1",
    publicCode: "c4Kd9Lm2Pq",
    postKey: "post-friday",
    authorUsername: "maya",
    parentKey: null,
    bodyText: "The Friday timestamp is the real villain here.",
    score: 42,
    reactionCount: 45,
    replyCount: 1,
    minutesAgo: 96,
  },
  {
    key: "comment-2",
    publicCode: "c7Rn3Tb8Wx",
    postKey: "post-friday",
    authorUsername: "lucas",
    parentKey: "comment-1",
    bodyText: "The deploy button should go grey after lunch.",
    score: 18,
    reactionCount: 19,
    replyCount: 0,
    minutesAgo: 89,
  },
];

export type MockReport = {
  key: string;
  reporterUsername: string;
  targetType: "post" | "comment" | "user";
  targetCode: string;
  reason: Report["reason"];
  details: string | null;
  status: "open" | "dismissed" | "actioned";
  hoursAgo: number;
};

export const mockReports: MockReport[] = [
  {
    key: "report-1",
    reporterUsername: "ana",
    targetType: "post",
    targetCode: "Mw4Yb6Hc3K",
    reason: "misleading_title",
    details: "Title is funny but does not match the image.",
    status: "open",
    hoursAgo: 4,
  },
];

// --- Public-shape helpers (used by the web client's offline fallback) ---

function authorFor(username: string): Author {
  const user = mockUsers.find((candidate) => candidate.username === username);
  return {
    username,
    displayName: user?.displayName ?? username,
    avatarUrl: user?.avatarUrl ?? avatar(username),
  };
}

function toFeedPost(post: MockPost): FeedPost {
  const repostOf = post.repostOfKey
    ? mockPosts.find((candidate) => candidate.key === post.repostOfKey) ?? null
    : null;
  return {
    publicCode: post.publicCode,
    slug: post.slug,
    postKind: post.postKind,
    title: post.title,
    bodyText: post.bodyText,
    imageUrl: post.imageUrl,
    youtubeUrl: post.youtubeUrl,
    youtubeVideoId: post.youtubeVideoId,
    youtubeIsShort: post.youtubeIsShort,
    status: post.status,
    score: post.score,
    reactionCount: post.reactionCount,
    commentCount: post.commentCount,
    repostCount: post.repostCount,
    quoteCount: post.quoteCount,
    author: authorFor(post.authorUsername),
    repostOf: repostOf ? toEmbeddedPost(repostOf) : null,
    tags: post.tags,
    canonicalPath: canonicalPath(post.publicCode, post.slug),
    createdAt: hoursAgo(post.hoursAgo),
    viewerReaction: null,
  };
}

function toEmbeddedPost(post: MockPost): NonNullable<FeedPost["repostOf"]> {
  return {
    publicCode: post.publicCode,
    slug: post.slug,
    postKind: post.postKind,
    title: post.title,
    bodyText: post.bodyText,
    imageUrl: post.imageUrl,
    youtubeUrl: post.youtubeUrl,
    youtubeVideoId: post.youtubeVideoId,
    youtubeIsShort: post.youtubeIsShort,
    author: authorFor(post.authorUsername),
    canonicalPath: canonicalPath(post.publicCode, post.slug),
  };
}

function tagPostCount(slug: string): number {
  return mockPosts.filter((post) => post.status === "published" && post.tags.includes(slug)).length;
}

function toTag(tag: MockTag): Tag {
  return {
    slug: tag.slug,
    displayName: tag.displayName,
    description: tag.description,
    postCount: tagPostCount(tag.slug),
  };
}

function resolveMockTagSlug(slug: string): string | null {
  if (mockTags.some((tag) => tag.slug === slug)) return slug;
  return mockTagAliases.find((alias) => alias.aliasSlug === slug)?.targetSlug ?? null;
}

function publishedPostsRecent(posts: MockPost[] = mockPosts): MockPost[] {
  return [...posts]
    .filter((post) => post.status === "published")
    .sort((a, b) =>
      Date.parse(hoursAgo(a.hoursAgo)) === Date.parse(hoursAgo(b.hoursAgo))
        ? b.publicCode.localeCompare(a.publicCode)
        : Date.parse(hoursAgo(b.hoursAgo)) - Date.parse(hoursAgo(a.hoursAgo))
    );
}

function encodeCursor(value: { createdAt: string; id: string }): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return null;
  try {
    const normalized = cursor.replace(/-/g, "+").replace(/_/g, "/");
    return RecentCursorSchema.parse(JSON.parse(atob(normalized)));
  } catch {
    return null;
  }
}

function getMockFeedFromPosts(
  posts: MockPost[],
  options: { limit: number; cursor?: string },
): FeedResponse {
  const sorted = publishedPostsRecent(posts);
  const cursor = decodeCursor(options.cursor);

  const startIndex = cursor
    ? sorted.findIndex((post) => {
      const createdAt = hoursAgo(post.hoursAgo);
      return createdAt < cursor.createdAt ||
        (createdAt === cursor.createdAt && post.publicCode < cursor.id);
    })
    : 0;
  const safeStart = startIndex < 0 ? sorted.length : startIndex;
  const page = sorted.slice(safeStart, safeStart + options.limit);
  const items = page.map(toFeedPost);
  const last = page[page.length - 1];

  return {
    items,
    nextCursor: last && safeStart + page.length < sorted.length
      ? encodeCursor({ createdAt: hoursAgo(last.hoursAgo), id: last.publicCode })
      : null,
  };
}

export function getMockTags(): Tag[] {
  return mockTags.map(toTag).sort((a, b) =>
    b.postCount - a.postCount || a.displayName.localeCompare(b.displayName)
  );
}

export function getMockTagBySlug(slug: string): Tag | null {
  const canonical = resolveMockTagSlug(slug);
  const tag = canonical ? mockTags.find((candidate) => candidate.slug === canonical) : undefined;
  return tag ? toTag(tag) : null;
}

export function getMockFeed(options: { limit: number; cursor?: string }): FeedResponse {
  return getMockFeedFromPosts(mockPosts, options);
}

export function getMockFeedByTag(
  slug: string,
  options: { limit: number; cursor?: string },
): FeedResponse {
  const canonical = resolveMockTagSlug(slug);
  if (!canonical) return { items: [], nextCursor: null };
  return getMockFeedFromPosts(
    mockPosts.filter((post) => post.tags.includes(canonical)),
    options,
  );
}

export function getMockPostByCode(publicCode: string): PostDetail | null {
  const post = mockPosts.find((candidate) => candidate.publicCode === publicCode);
  return post ? toFeedPost(post) : null;
}

export function getMockCommentsForPost(publicCode: string): Comment[] {
  const post = mockPosts.find((candidate) => candidate.publicCode === publicCode);
  if (!post) return [];

  const forPost = mockComments.filter((comment) => comment.postKey === post.key);
  const topLevel = forPost.filter((comment) => comment.parentKey === null);

  return topLevel.map((comment) => ({
    publicCode: comment.publicCode,
    author: authorFor(comment.authorUsername),
    parentCommentCode: null,
    bodyText: comment.bodyText,
    score: comment.score,
    reactionCount: comment.reactionCount,
    replyCount: comment.replyCount,
    status: "published" as const,
    createdAt: new Date(MOCK_NOW - comment.minutesAgo * 60 * 1000).toISOString(),
    viewerReaction: null,
    replies: forPost
      .filter((reply) => reply.parentKey === comment.key)
      .map((reply) => ({
        publicCode: reply.publicCode,
        author: authorFor(reply.authorUsername),
        parentCommentCode: comment.publicCode,
        bodyText: reply.bodyText,
        score: reply.score,
        reactionCount: reply.reactionCount,
        replyCount: 0,
        status: "published" as const,
        createdAt: new Date(MOCK_NOW - reply.minutesAgo * 60 * 1000).toISOString(),
        viewerReaction: null,
        replies: [] as [],
      })),
  }));
}

export function getMockUserByUsername(username: string): UserProfile | null {
  const user = mockUsers.find((candidate) => candidate.username === username);
  if (!user) return null;

  return {
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    postCount: mockPosts.filter((post) => post.authorUsername === username).length,
    commentCount: mockComments.filter((comment) => comment.authorUsername === username).length,
    createdAt: new Date(MOCK_EPOCH + user.createdAtHoursOffset * 86400000).toISOString(),
  };
}

export function getMockUserPosts(username: string): FeedResponse {
  return {
    items: publishedPostsRecent()
      .filter((post) => post.authorUsername === username)
      .map(toFeedPost),
    nextCursor: null,
  };
}

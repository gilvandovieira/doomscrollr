import { FeedCursorSchema } from "./schemas/pagination.schema.ts";
import type {
  Author,
  Comment,
  FeedPost,
  FeedResponse,
  FeedSort,
  MediaAsset,
  Report,
  UserProfile,
} from "./types.ts";

const MOCK_NOW = Date.parse("2026-06-24T12:00:00.000Z");

const authors: Author[] = [
  {
    id: "user_lucas",
    username: "lucas",
    displayName: "Lucas",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=lucas",
  },
  {
    id: "user_maya",
    username: "maya",
    displayName: "Maya",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=maya",
  },
  {
    id: "user_ren",
    username: "ren",
    displayName: "Ren",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=ren",
  },
  {
    id: "user_ana",
    username: "ana",
    displayName: "Ana",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=ana",
  },
];

function youtubeMedia(
  id: string,
  mediaType: "video" | "short",
  aspectRatio: "landscape" | "portrait",
): MediaAsset {
  return {
    id: `media_youtube_${id}`,
    provider: "youtube",
    mediaType,
    providerMediaId: id,
    originalUrl: mediaType === "short"
      ? `https://www.youtube.com/shorts/${id}`
      : `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    previewUrl: null,
    width: aspectRatio === "portrait" ? 720 : 1280,
    height: aspectRatio === "portrait" ? 1280 : 720,
    durationSeconds: null,
    aspectRatio,
    attributionLabel: "YouTube",
    attributionUrl: "https://www.youtube.com",
    status: "ready",
  };
}

function giphyMedia(id: string, seed: string): MediaAsset {
  return {
    id: `media_giphy_${id}`,
    provider: "giphy",
    mediaType: "gif",
    providerMediaId: id,
    originalUrl: `https://giphy.com/gifs/${id}`,
    embedUrl: null,
    thumbnailUrl: `https://media.giphy.com/media/${id}/200_s.gif`,
    previewUrl: `https://media.giphy.com/media/${id}/giphy.gif`,
    width: 480,
    height: 360,
    durationSeconds: null,
    aspectRatio: "landscape",
    attributionLabel: `GIPHY / ${seed}`,
    attributionUrl: `https://giphy.com/gifs/${id}`,
    status: "ready",
  };
}

function uploadImage(seed: string, aspectRatio: "square" | "landscape" | "portrait"): MediaAsset {
  const dimensions = {
    square: [900, 900],
    landscape: [1280, 720],
    portrait: [720, 1120],
  }[aspectRatio];

  return {
    id: `media_upload_${seed}`,
    provider: "upload",
    mediaType: "image",
    providerMediaId: null,
    originalUrl: `https://picsum.photos/seed/${seed}/${dimensions[0]}/${dimensions[1]}`,
    embedUrl: null,
    thumbnailUrl: `https://picsum.photos/seed/${seed}/${dimensions[0]}/${dimensions[1]}`,
    previewUrl: null,
    width: dimensions[0],
    height: dimensions[1],
    durationSeconds: null,
    aspectRatio,
    attributionLabel: "Seeded upload",
    attributionUrl: null,
    status: "ready",
  };
}

function post(
  index: number,
  title: string,
  author: Author,
  media: MediaAsset,
  score: number,
  commentCount: number,
  hoursAgo: number,
  tags: string[],
): FeedPost {
  const downvoteCount = Math.max(0, Math.floor(score * 0.08));
  const upvoteCount = score + downvoteCount;
  const createdAt = new Date(MOCK_NOW - hoursAgo * 60 * 60 * 1000).toISOString();

  return {
    id: `post_${String(index).padStart(3, "0")}`,
    title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    score,
    upvoteCount,
    downvoteCount,
    commentCount,
    status: "published",
    monetizationStatus: index % 7 === 0 ? "pending_review" : "enabled",
    adSafetyScore: index % 7 === 0 ? 0.62 : 0.96,
    createdAt,
    updatedAt: createdAt,
    author,
    media,
    tags,
  };
}

export const mockPosts: FeedPost[] = [
  post(
    1,
    "When production breaks on Friday",
    authors[0],
    youtubeMedia("dQw4w9WgXcQ", "video", "landscape"),
    421,
    32,
    2,
    ["dev", "friday"],
  ),
  post(
    2,
    "The group chat after one ambiguous deploy log",
    authors[1],
    giphyMedia("l0MYt5jPR6QX5pnqM", "reactions"),
    287,
    18,
    3,
    ["chat", "deploy"],
  ),
  post(
    3,
    "Short-form chaos in exactly eleven seconds",
    authors[2],
    youtubeMedia("jNQXAC9IVRw", "short", "portrait"),
    199,
    44,
    5,
    ["shorts", "internet"],
  ),
  post(
    4,
    "This meeting could have been an error boundary",
    authors[3],
    uploadImage("meeting-error-boundary", "square"),
    356,
    21,
    7,
    ["work", "react"],
  ),
  post(
    5,
    "Trying to explain cursor pagination at dinner",
    authors[0],
    uploadImage("cursor-dinner", "landscape"),
    154,
    12,
    9,
    ["backend", "database"],
  ),
  post(
    6,
    "POV: the cache invalidated itself",
    authors[1],
    giphyMedia("xT9IgG50Fb7Mi0prBC", "cache"),
    512,
    67,
    12,
    ["cache", "frontend"],
  ),
  post(
    7,
    "Every upload flow has a secret boss fight",
    authors[2],
    uploadImage("upload-boss-fight", "portrait"),
    88,
    9,
    14,
    ["upload", "moderation"],
  ),
  post(
    8,
    "The moment the logs finally make sense",
    authors[3],
    youtubeMedia("M7lc1UVf-VE", "video", "landscape"),
    244,
    19,
    16,
    ["logs", "api"],
  ),
  post(
    9,
    "Ad-safe until the comments arrive",
    authors[0],
    uploadImage("ad-safe-comments", "square"),
    133,
    27,
    18,
    ["ads", "comments"],
  ),
  post(
    10,
    "Ship the MVP, keep the chaos contained",
    authors[1],
    giphyMedia("3o7aD2saalBwwftBIY", "mvp"),
    630,
    75,
    20,
    ["mvp", "launch"],
  ),
  post(
    11,
    "When the moderation queue opens at 9am",
    authors[2],
    uploadImage("moderation-queue", "landscape"),
    74,
    8,
    23,
    ["moderation"],
  ),
  post(
    12,
    "A tiny thumbnail doing iframe prevention work",
    authors[3],
    youtubeMedia("aqz-KE-bpKQ", "video", "landscape"),
    311,
    23,
    26,
    ["youtube", "performance"],
  ),
  post(
    13,
    "The title says meme, the database says post",
    authors[0],
    uploadImage("post-not-meme", "square"),
    202,
    15,
    30,
    ["domain", "naming"],
  ),
  post(
    14,
    "One-level replies keeping the peace",
    authors[1],
    giphyMedia("26ufdipQqU2lhNA4g", "comments"),
    145,
    34,
    34,
    ["comments"],
  ),
  post(
    15,
    "The feed after three more scrolls",
    authors[2],
    uploadImage("three-scrolls", "portrait"),
    404,
    28,
    38,
    ["feed", "scroll"],
  ),
  post(
    16,
    "Rate limits entering the chat",
    authors[3],
    uploadImage("rate-limit-chat", "landscape"),
    118,
    6,
    42,
    ["security"],
  ),
  post(
    17,
    "The hot score doing public math",
    authors[0],
    youtubeMedia("ysz5S6PUM-U", "video", "landscape"),
    266,
    17,
    48,
    ["ranking"],
  ),
  post(
    18,
    "Anonymous users reading everything first",
    authors[1],
    uploadImage("anonymous-reader", "square"),
    92,
    11,
    55,
    ["auth"],
  ),
  post(
    19,
    "A GIF picker with decision fatigue",
    authors[2],
    giphyMedia("l0HlQ7LRalQqdWfao", "giphy"),
    377,
    30,
    60,
    ["giphy", "upload"],
  ),
  post(
    20,
    "The report dialog was right there",
    authors[3],
    uploadImage("report-dialog", "portrait"),
    169,
    13,
    68,
    ["reports"],
  ),
  post(
    21,
    "The 9-post batch is a personality test",
    authors[0],
    uploadImage("nine-post-batch", "landscape"),
    251,
    20,
    72,
    ["pagination"],
  ),
  post(
    22,
    "When the API says validation error politely",
    authors[1],
    giphyMedia("5VKbvrjxpVJCM", "validation"),
    189,
    24,
    80,
    ["zod"],
  ),
  post(
    23,
    "Every profile starts as three numbers and a vibe",
    authors[2],
    uploadImage("profile-vibe", "square"),
    63,
    5,
    90,
    ["profile"],
  ),
  post(
    24,
    "Nothing good happens after the fourth nested reply",
    authors[3],
    youtubeMedia("ScMzIvxBSi4", "short", "portrait"),
    338,
    39,
    96,
    ["comments", "scope"],
  ),
];

export const mockUsers: UserProfile[] = authors.map((author, index) => ({
  ...author,
  role: index === 3 ? "moderator" : "user",
  status: "active",
  bio: [
    "Posts deploy-adjacent internet artifacts.",
    "Collects high-signal reaction material.",
    "Finds the exact frame where the joke lands.",
    "Keeps the queue moving.",
  ][index],
  postCount: mockPosts.filter((post) => post.author.id === author.id).length,
  commentCount: 18 + index * 7,
  createdAt: new Date(Date.parse("2026-01-01T12:00:00.000Z") + index * 86400000).toISOString(),
}));

export const mockComments: Comment[] = [
  {
    id: "comment_001",
    postId: "post_001",
    author: authors[1],
    parentId: null,
    body: "The Friday timestamp is the real villain here.",
    score: 42,
    status: "published",
    moderationStatus: "clean",
    createdAt: "2026-06-24T10:24:00.000Z",
    updatedAt: "2026-06-24T10:24:00.000Z",
    replies: [
      {
        id: "comment_002",
        postId: "post_001",
        author: authors[0],
        parentId: "comment_001",
        body: "The deployment button should turn grey after lunch.",
        score: 18,
        status: "published",
        moderationStatus: "clean",
        createdAt: "2026-06-24T10:31:00.000Z",
        updatedAt: "2026-06-24T10:31:00.000Z",
        replies: [],
      },
    ],
  },
  {
    id: "comment_003",
    postId: "post_001",
    author: authors[2],
    parentId: null,
    body: "I respect the thumbnail-only feed rule. My laptop fan does too.",
    score: 31,
    status: "published",
    moderationStatus: "clean",
    createdAt: "2026-06-24T10:42:00.000Z",
    updatedAt: "2026-06-24T10:42:00.000Z",
    replies: [],
  },
];

export const mockReports: Report[] = [
  {
    id: "report_001",
    reporter: authors[0],
    targetType: "post",
    targetId: "post_007",
    reason: "misleading_title",
    details: "Title is funny, but it does not match the media.",
    status: "open",
    createdAt: "2026-06-24T08:30:00.000Z",
    reviewedAt: null,
    reviewedBy: null,
  },
];

export const mockGifs = [
  giphyMedia("l0MYt5jPR6QX5pnqM", "reactions"),
  giphyMedia("xT9IgG50Fb7Mi0prBC", "cache"),
  giphyMedia("3o7aD2saalBwwftBIY", "launch"),
  giphyMedia("26ufdipQqU2lhNA4g", "comments"),
  giphyMedia("5VKbvrjxpVJCM", "validation"),
];

export function calculateHotScore(score: number, createdAt: string, now = MOCK_NOW) {
  const ageInHours = Math.max(0, (now - Date.parse(createdAt)) / 3600000);
  return Math.log10(Math.max(score, 1)) - ageInHours / 12;
}

function encodeCursor(value: unknown) {
  return btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeCursor(cursor: string | undefined) {
  if (!cursor) {
    return null;
  }

  try {
    const normalized = cursor.replaceAll("-", "+").replaceAll("_", "/");
    const parsed = JSON.parse(atob(normalized));
    return FeedCursorSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function getSortedMockPosts(sort: FeedSort) {
  const posts = [...mockPosts];

  if (sort === "recent") {
    return posts.sort((a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id)
    );
  }

  if (sort === "top") {
    return posts.sort((a, b) => b.score - a.score || b.id.localeCompare(a.id));
  }

  return posts.sort((a, b) =>
    calculateHotScore(b.score, b.createdAt) - calculateHotScore(a.score, a.createdAt) ||
    b.id.localeCompare(a.id)
  );
}

export function getMockFeed(
  options: { limit: number; cursor?: string; sort: FeedSort },
): FeedResponse {
  const cursor = decodeCursor(options.cursor);
  const offset = cursor?.sort === options.sort ? cursor.offset : 0;
  const sorted = getSortedMockPosts(options.sort);
  const items = sorted.slice(offset, offset + options.limit);
  const nextOffset = offset + items.length;
  const last = items.at(-1);

  return {
    items,
    nextCursor: last && nextOffset < sorted.length
      ? encodeCursor({
        sort: options.sort,
        offset: nextOffset,
        id: last.id,
        createdAt: last.createdAt,
        score: last.score,
        hotScore: calculateHotScore(last.score, last.createdAt),
      })
      : null,
  };
}

export function getMockPostById(id: string) {
  return mockPosts.find((post) => post.id === id) ?? null;
}

export function getMockCommentsForPost(postId: string) {
  if (postId === "post_001") {
    return mockComments;
  }

  const post = getMockPostById(postId);
  if (!post) {
    return [];
  }

  return [
    {
      ...mockComments[0],
      id: `comment_${postId}_001`,
      postId,
      body: `This is exactly why "${post.title}" needed its own thread.`,
      replies: [],
    },
    {
      ...mockComments[1],
      id: `comment_${postId}_002`,
      postId,
      parentId: null,
      body: "One-level replies are enough for this kind of chaos.",
      replies: [],
    },
  ];
}

export function getMockUserByUsername(username: string) {
  return mockUsers.find((user) => user.username === username) ?? null;
}

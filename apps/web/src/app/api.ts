import {
  getMockCommentsForPost,
  getMockFeed,
  getMockPostById,
  getMockUserByUsername,
  mockGifs,
  mockPosts,
  mockReports,
} from "@doomscrollr/shared/mock-data.ts";
import { CommentThreadResponseSchema } from "@doomscrollr/shared/schemas/comment.schema.ts";
import { MediaAssetSchema } from "@doomscrollr/shared/schemas/media.schema.ts";
import { FeedResponseSchema, PostDetailSchema } from "@doomscrollr/shared/schemas/post.schema.ts";
import { ReportSchema } from "@doomscrollr/shared/schemas/report.schema.ts";
import { UserProfileSchema } from "@doomscrollr/shared/schemas/user.schema.ts";
import type {
  CommentThreadResponse,
  FeedResponse,
  FeedSort,
  MediaAsset,
  PostDetail,
  Report,
  UserProfile,
} from "@doomscrollr/shared/types.ts";
import { z } from "zod";
import { type GetAuthToken, HAS_CLERK } from "./auth.ts";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type RequestOptions = {
  authToken?: GetAuthToken;
  fallbackOnError?: boolean;
};

async function getJson<T>(
  path: string,
  fallback: () => T | Promise<T>,
  options: RequestOptions = {},
) {
  try {
    const headers = new Headers();
    const token = await options.authToken?.();

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (options.fallbackOnError === false) {
      throw error;
    }

    return await fallback();
  }
}

export async function fetchFeedPage(options: {
  sort: FeedSort;
  cursor?: string;
  limit?: number;
}): Promise<FeedResponse> {
  const params = new URLSearchParams({
    sort: options.sort,
    limit: String(options.limit ?? 9),
  });

  if (options.cursor) {
    params.set("cursor", options.cursor);
  }

  const data = await getJson(`/api/posts?${params.toString()}`, () =>
    getMockFeed({
      sort: options.sort,
      cursor: options.cursor,
      limit: options.limit ?? 9,
    }));

  return FeedResponseSchema.parse(data);
}

export async function fetchPost(postId: string): Promise<PostDetail> {
  const data = await getJson(`/api/posts/${postId}`, () => {
    const post = getMockPostById(postId);

    if (!post) {
      throw new Error("Post not found.");
    }

    return {
      ...post,
      body:
        "Mock detail copy for the first build slice. Production posts will keep media, votes, comments, reports, and ad eligibility as separate product-owned state.",
    };
  });

  return PostDetailSchema.parse(data);
}

export async function fetchComments(postId: string): Promise<CommentThreadResponse> {
  const data = await getJson(`/api/posts/${postId}/comments`, () => ({
    items: getMockCommentsForPost(postId),
  }));

  return CommentThreadResponseSchema.parse(data);
}

export async function fetchGifs(query: string): Promise<MediaAsset[]> {
  const params = new URLSearchParams();

  if (query.trim()) {
    params.set("q", query.trim());
  }

  const data = await getJson(`/api/gifs/search?${params.toString()}`, () => ({
    items: mockGifs,
  }));

  return z.object({ items: z.array(MediaAssetSchema) }).parse(data).items;
}

export async function fetchUser(username: string): Promise<UserProfile> {
  const normalized = username.startsWith("@") ? username.slice(1) : username;
  const data = await getJson(`/api/users/${normalized}`, () => {
    const user = getMockUserByUsername(normalized);

    if (!user) {
      throw new Error("User not found.");
    }

    return user;
  });

  return UserProfileSchema.parse(data);
}

export async function fetchUserPosts(username: string): Promise<FeedResponse> {
  const normalized = username.startsWith("@") ? username.slice(1) : username;
  const data = await getJson(`/api/users/${normalized}/posts`, () => ({
    items: mockPosts.filter((post) => post.author.username === normalized),
    nextCursor: null,
  }));

  return FeedResponseSchema.parse(data);
}

export async function fetchModerationReports(authToken?: GetAuthToken): Promise<Report[]> {
  if (!HAS_CLERK) {
    return mockReports;
  }

  const data = await getJson(
    "/api/moderation/reports",
    () => ({ items: mockReports }),
    {
      authToken,
      fallbackOnError: false,
    },
  );
  return z.object({ items: z.array(ReportSchema) }).parse(data).items;
}

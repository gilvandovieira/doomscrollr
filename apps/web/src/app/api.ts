import {
  getMockCommentsForPost,
  getMockFeed,
  getMockPostByCode,
  getMockUserByUsername,
  getMockUserPosts,
} from "@doomscrollr/shared/mock-data.ts";
import { CommentThreadResponseSchema } from "@doomscrollr/shared/schemas/comment.schema.ts";
import {
  CreatePostResponseSchema,
  FeedPostSchema,
  FeedResponseSchema,
  PostDetailSchema,
} from "@doomscrollr/shared/schemas/post.schema.ts";
import { ReactionResultSchema } from "@doomscrollr/shared/schemas/reaction.schema.ts";
import { ReportSchema } from "@doomscrollr/shared/schemas/report.schema.ts";
import { UserProfileSchema } from "@doomscrollr/shared/schemas/user.schema.ts";
import type {
  Comment,
  CommentThreadResponse,
  CreatePostInput,
  CreatePostResponse,
  CreateReportInput,
  FeedResponse,
  PostDetail,
  ReactionResult,
  Report,
  UserProfile,
} from "@doomscrollr/shared/types.ts";
import { z } from "zod";
import { type GetAuthToken } from "./auth.ts";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function getJson<T>(path: string, fallback: () => T): Promise<unknown> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
    if (!response.ok) throw new Error(`Request failed with ${response.status}`);
    return await response.json();
  } catch {
    return fallback();
  }
}

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function authedFetch(
  path: string,
  options: { method?: string; body?: unknown; getToken?: GetAuthToken },
): Promise<unknown> {
  const headers = new Headers({ "content-type": "application/json" });
  const token = await options.getToken?.();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "POST",
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as {
      error?: { code?: string; message?: string };
    };
    throw new ApiError(
      response.status,
      payload.error?.code ?? "ERROR",
      payload.error?.message ?? `Request failed with ${response.status}`,
    );
  }

  return response.status === 204 ? null : await response.json();
}

export { ApiError };

// ---- Reads ----

export async function fetchRecentFeed(
  options: { cursor?: string; limit?: number } = {},
): Promise<FeedResponse> {
  const params = new URLSearchParams({ limit: String(options.limit ?? 20) });
  if (options.cursor) params.set("cursor", options.cursor);
  const data = await getJson(
    `/api/feed/recent?${params.toString()}`,
    () => getMockFeed({ limit: options.limit ?? 20, cursor: options.cursor }),
  );
  return FeedResponseSchema.parse(data);
}

export async function fetchPost(postCode: string): Promise<PostDetail> {
  const data = await getJson(`/api/posts/${postCode}`, () => {
    const post = getMockPostByCode(postCode);
    if (!post) throw new Error("Post not found.");
    return post;
  });
  return PostDetailSchema.parse(data);
}

export async function fetchComments(postCode: string): Promise<CommentThreadResponse> {
  const data = await getJson(
    `/api/posts/${postCode}/comments`,
    () => ({ items: getMockCommentsForPost(postCode) }),
  );
  return CommentThreadResponseSchema.parse(data);
}

export async function fetchUser(username: string): Promise<UserProfile> {
  const handle = username.replace(/^@/, "");
  const data = await getJson(`/api/users/${handle}`, () => {
    const user = getMockUserByUsername(handle);
    if (!user) throw new Error("User not found.");
    return user;
  });
  return UserProfileSchema.parse(data);
}

export async function fetchUserPosts(username: string): Promise<FeedResponse> {
  const handle = username.replace(/^@/, "");
  const data = await getJson(`/api/users/${handle}/posts`, () => getMockUserPosts(handle));
  return FeedResponseSchema.parse(data);
}

// ---- Funnel events (fire-and-forget) ----

export type ClientEvent =
  | "post_opened"
  | "whatsapp_share_clicked"
  | "copy_link_clicked"
  | "native_share_clicked";

export function sendEvent(eventType: ClientEvent, postCode: string): void {
  void fetch(`${API_BASE_URL}/api/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ eventType, postCode }),
    keepalive: true,
  }).catch(() => {});
}

// ---- Writes ----

export function createPost(
  input: CreatePostInput,
  getToken: GetAuthToken,
): Promise<CreatePostResponse> {
  return authedFetch("/api/posts", { body: input, getToken }).then((data) =>
    CreatePostResponseSchema.parse(data)
  );
}

export function setPostReaction(
  postCode: string,
  value: 1 | -1 | 0,
  getToken: GetAuthToken,
): Promise<ReactionResult> {
  return authedFetch(`/api/posts/${postCode}/reactions`, { body: { value }, getToken }).then(
    (data) => ReactionResultSchema.parse(data),
  );
}

export function setCommentReaction(
  commentCode: string,
  value: 1 | -1 | 0,
  getToken: GetAuthToken,
): Promise<ReactionResult> {
  return authedFetch(`/api/comments/${commentCode}/reactions`, { body: { value }, getToken }).then(
    (data) => ReactionResultSchema.parse(data),
  );
}

export function createComment(
  postCode: string,
  body: { bodyText: string; parentCommentCode?: string },
  getToken: GetAuthToken,
): Promise<Comment> {
  return authedFetch(`/api/posts/${postCode}/comments`, { body, getToken }).then((data) =>
    data as Comment
  );
}

export function createReport(input: CreateReportInput, getToken: GetAuthToken): Promise<void> {
  return authedFetch("/api/reports", { body: input, getToken }).then(() => undefined);
}

export function blockUser(username: string, getToken: GetAuthToken): Promise<void> {
  return authedFetch(`/api/users/${username.replace(/^@/, "")}/block`, { getToken }).then(() =>
    undefined
  );
}

export function unblockUser(username: string, getToken: GetAuthToken): Promise<void> {
  return authedFetch(`/api/users/${username.replace(/^@/, "")}/block`, {
    method: "DELETE",
    getToken,
  }).then(() => undefined);
}

// ---- Account ----

const AccountSchema = z.object({
  needsUsername: z.boolean(),
  user: UserProfileSchema.nullable(),
});
export type Account = z.infer<typeof AccountSchema>;

export function fetchAccount(getToken: GetAuthToken): Promise<Account> {
  return authedFetch("/api/account/me", { method: "GET", getToken }).then((data) =>
    AccountSchema.parse(data)
  );
}

export function setUsername(username: string, getToken: GetAuthToken): Promise<Account> {
  return authedFetch("/api/account/username", { body: { username }, getToken }).then((data) =>
    AccountSchema.parse(data)
  );
}

// ---- Admin ----

export function fetchAdminReports(getToken: GetAuthToken): Promise<Report[]> {
  return authedFetch("/api/admin/reports", { method: "GET", getToken }).then((data) =>
    z.object({ items: z.array(ReportSchema) }).parse(data).items
  );
}

export function adminAction(
  path: string,
  getToken: GetAuthToken,
  body?: unknown,
): Promise<void> {
  return authedFetch(`/api/admin/${path}`, { body, getToken }).then(() => undefined);
}

// Re-exported for components that render a single post preview shape.
export { FeedPostSchema };

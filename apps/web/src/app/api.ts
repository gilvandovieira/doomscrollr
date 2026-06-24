import {
  getMockCommentsForPost,
  getMockFeed,
  getMockFeedByTag,
  getMockPostByCode,
  getMockTagBySlug,
  getMockTags,
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
import { NotificationListResponseSchema } from "@doomscrollr/shared/schemas/notification.schema.ts";
import { ReactionResultSchema } from "@doomscrollr/shared/schemas/reaction.schema.ts";
import {
  AdminReportListResponseSchema,
  ModerationAuditListResponseSchema,
  ModerationNoteSchema,
} from "@doomscrollr/shared/schemas/report.schema.ts";
import {
  AdminTagListResponseSchema,
  TagDetailResponseSchema,
  TagListResponseSchema,
} from "@doomscrollr/shared/schemas/tag.schema.ts";
import { UserProfileSchema } from "@doomscrollr/shared/schemas/user.schema.ts";
import type {
  AdminReportListQuery,
  AdminTag,
  BulkReportActionInput,
  Comment,
  CommentThreadResponse,
  CreateAdminTagInput,
  CreateModerationNoteInput,
  CreatePostInput,
  CreatePostResponse,
  CreateQuotePostInput,
  CreateReportInput,
  FeedResponse,
  ModerationAuditEvent,
  ModerationNote,
  NotificationListResponse,
  PostDetail,
  ReactionResult,
  Report,
  SetUserModerationStatusInput,
  SetUserTrustLevelInput,
  Tag,
  TagDetailResponse,
  UserProfile,
} from "@doomscrollr/shared/types.ts";
import { z } from "zod";
import { type GetAuthToken } from "./auth.ts";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Public reads. Sends the auth token when one is available so the server can
// personalize the response (viewerReaction, block filtering) for a signed-in
// viewer; works unauthenticated for logged-out visitors and the mock fallback.
async function getJson<T>(
  path: string,
  fallback: () => T,
  getToken?: GetAuthToken,
): Promise<unknown> {
  try {
    const headers = new Headers();
    const token = await getToken?.();
    if (token) headers.set("authorization", `Bearer ${token}`);
    const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", headers });
    if (!response.ok) throw new Error(`Request failed with ${response.status}`);
    return await response.json();
  } catch {
    return fallback();
  }
}

// Resolve a YouTube URL to its video title (server proxies oEmbed). Returns null
// on any failure so the create form can fall back to a manually typed title.
export async function fetchYouTubeTitle(url: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/youtube/oembed?url=${encodeURIComponent(url)}`,
      { credentials: "include" },
    );
    if (!response.ok) return null;
    const data = await response.json() as { title?: unknown };
    return typeof data.title === "string" && data.title.length > 0 ? data.title : null;
  } catch {
    return null;
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
  getToken?: GetAuthToken,
): Promise<FeedResponse> {
  const params = new URLSearchParams({ limit: String(options.limit ?? 20) });
  if (options.cursor) params.set("cursor", options.cursor);
  const data = await getJson(
    `/api/feed/recent?${params.toString()}`,
    () => getMockFeed({ limit: options.limit ?? 20, cursor: options.cursor }),
    getToken,
  );
  return FeedResponseSchema.parse(data);
}

export async function fetchTags(): Promise<Tag[]> {
  const data = await getJson("/api/tags", () => ({ items: getMockTags() }));
  return TagListResponseSchema.parse(data).items;
}

export async function fetchTag(tagSlug: string): Promise<TagDetailResponse> {
  const data = await getJson(`/api/tags/${tagSlug}`, () => {
    const tag = getMockTagBySlug(tagSlug);
    if (!tag) throw new Error("Tag not found.");
    return { tag, requestedSlug: tagSlug, canonicalSlug: tag.slug };
  });
  return TagDetailResponseSchema.parse(data);
}

export async function fetchTagFeed(
  tagSlug: string,
  options: { cursor?: string; limit?: number } = {},
  getToken?: GetAuthToken,
): Promise<FeedResponse> {
  const params = new URLSearchParams({ limit: String(options.limit ?? 20) });
  if (options.cursor) params.set("cursor", options.cursor);
  const data = await getJson(
    `/api/tags/${tagSlug}/posts?${params.toString()}`,
    () => getMockFeedByTag(tagSlug, { limit: options.limit ?? 20, cursor: options.cursor }),
    getToken,
  );
  return FeedResponseSchema.parse(data);
}

export async function fetchPost(postCode: string, getToken?: GetAuthToken): Promise<PostDetail> {
  const data = await getJson(`/api/posts/${postCode}`, () => {
    const post = getMockPostByCode(postCode);
    if (!post) throw new Error("Post not found.");
    return post;
  }, getToken);
  return PostDetailSchema.parse(data);
}

export async function fetchComments(
  postCode: string,
  getToken?: GetAuthToken,
): Promise<CommentThreadResponse> {
  const data = await getJson(
    `/api/posts/${postCode}/comments`,
    () => ({ items: getMockCommentsForPost(postCode) }),
    getToken,
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

export async function fetchUserPosts(
  username: string,
  getToken?: GetAuthToken,
): Promise<FeedResponse> {
  const handle = username.replace(/^@/, "");
  const data = await getJson(
    `/api/users/${handle}/posts`,
    () => getMockUserPosts(handle),
    getToken,
  );
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

export function createRepost(
  postCode: string,
  getToken: GetAuthToken,
): Promise<CreatePostResponse> {
  return authedFetch(`/api/posts/${postCode}/reposts`, { getToken }).then((data) =>
    CreatePostResponseSchema.parse(data)
  );
}

export function createQuote(
  postCode: string,
  input: CreateQuotePostInput,
  getToken: GetAuthToken,
): Promise<CreatePostResponse> {
  return authedFetch(`/api/posts/${postCode}/quotes`, { body: input, getToken }).then((data) =>
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

// ---- Notifications ----

export function fetchNotifications(getToken: GetAuthToken): Promise<NotificationListResponse> {
  return authedFetch("/api/notifications", { method: "GET", getToken }).then((data) =>
    NotificationListResponseSchema.parse(data)
  );
}

export function markNotificationRead(
  notificationId: string,
  getToken: GetAuthToken,
): Promise<void> {
  return authedFetch(`/api/notifications/${notificationId}/read`, { getToken }).then(() =>
    undefined
  );
}

export function markAllNotificationsRead(getToken: GetAuthToken): Promise<void> {
  return authedFetch("/api/notifications/read-all", { getToken }).then(() => undefined);
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

export function fetchAdminReports(
  getToken: GetAuthToken,
  filters: Partial<AdminReportListQuery> = {},
): Promise<Report[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.targetType) params.set("targetType", filters.targetType);
  if (filters.reason) params.set("reason", filters.reason);
  const query = params.toString();
  return authedFetch(`/api/admin/reports${query ? `?${query}` : ""}`, {
    method: "GET",
    getToken,
  }).then((data) => AdminReportListResponseSchema.parse(data).items);
}

export function fetchAdminTags(getToken: GetAuthToken): Promise<AdminTag[]> {
  return authedFetch("/api/admin/tags", { method: "GET", getToken }).then((data) =>
    AdminTagListResponseSchema.parse(data).items
  );
}

export function createAdminTag(
  input: CreateAdminTagInput,
  getToken: GetAuthToken,
): Promise<void> {
  return authedFetch("/api/admin/tags", { body: input, getToken }).then(() => undefined);
}

export function adminAction(
  path: string,
  getToken: GetAuthToken,
  body?: unknown,
): Promise<void> {
  return authedFetch(`/api/admin/${path}`, { body, getToken }).then(() => undefined);
}

export function bulkReportAction(
  input: BulkReportActionInput,
  getToken: GetAuthToken,
): Promise<{ count: number }> {
  return authedFetch("/api/admin/reports/bulk", { body: input, getToken }).then((data) =>
    z.object({ ok: z.boolean(), count: z.number().int().nonnegative() }).parse(data)
  );
}

export function createModerationNote(
  input: CreateModerationNoteInput,
  getToken: GetAuthToken,
): Promise<ModerationNote> {
  return authedFetch("/api/admin/moderation/notes", { body: input, getToken }).then((data) =>
    ModerationNoteSchema.parse(data)
  );
}

export function fetchModerationAudit(getToken: GetAuthToken): Promise<ModerationAuditEvent[]> {
  return authedFetch("/api/admin/moderation/audit", { method: "GET", getToken }).then((data) =>
    ModerationAuditListResponseSchema.parse(data).items
  );
}

export function setUserModerationStatus(
  username: string,
  input: SetUserModerationStatusInput,
  getToken: GetAuthToken,
): Promise<void> {
  const handle = username.replace(/^@/, "");
  return authedFetch(`/api/admin/users/${handle}/status`, { body: input, getToken }).then(() =>
    undefined
  );
}

export function setUserTrustLevel(
  username: string,
  input: SetUserTrustLevelInput,
  getToken: GetAuthToken,
): Promise<void> {
  const handle = username.replace(/^@/, "");
  return authedFetch(`/api/admin/users/${handle}/trust-level`, { body: input, getToken }).then(() =>
    undefined
  );
}

// Re-exported for components that render a single post preview shape.
export { FeedPostSchema };

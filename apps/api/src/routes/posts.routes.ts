import { readServerEnv } from "@doomscrollr/config/env.ts";
import {
  MAX_MENTIONS_PER_COMMENT,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from "@doomscrollr/shared/constants.ts";
import { getMockCommentsForPost, getMockPostByCode } from "@doomscrollr/shared/mock-data.ts";
import {
  CommentListQuerySchema,
  CreateCommentSchema,
} from "@doomscrollr/shared/schemas/comment.schema.ts";
import {
  CreatePostSchema,
  CreateQuotePostSchema,
} from "@doomscrollr/shared/schemas/post.schema.ts";
import { SetReactionSchema } from "@doomscrollr/shared/schemas/reaction.schema.ts";
import { Hono } from "hono";
import { allowMockFallback, hasDatabase } from "../db/client.ts";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.ts";
import { buildCanonicalPostUrl } from "../lib/og.ts";
import { checkImageIsFetchable, validateExternalImageUrl } from "../lib/image-url.ts";
import { enforceRateLimit, RATE_LIMITS } from "../lib/rate-limit.ts";
import { parseOrThrow, readJsonBody } from "../lib/validation.ts";
import { getAuthUser, getOptionalViewerId, requireUser } from "../middleware/auth.ts";
import {
  extractYouTubeId,
  fetchYouTubeTitle,
  isYouTubeShort,
} from "../services/youtube.service.ts";
import { isBlocked } from "../repositories/blocks.repository.ts";
import {
  createComment,
  getCommentByCode,
  getCommentNotificationRefByCode,
  getReplyParent,
  listCommentsForPost,
} from "../repositories/comments.repository.ts";
import { recordPostEvent } from "../repositories/events.repository.ts";
import { findBlockedDomainForUrl } from "../repositories/domain-blocks.repository.ts";
import { createNotification } from "../repositories/notifications.repository.ts";
import {
  createPost,
  type CreatePostFields,
  getPublishedPostByPublicCode,
  getPublishedVisiblePostRefByPublicCode,
  getReshareTargetByPublicCode,
  hasPublishedRepost,
} from "../repositories/posts.repository.ts";
import { setPostReaction } from "../repositories/reactions.repository.ts";
import { resolveActiveTagsBySlugsOrAliases } from "../repositories/tags.repository.ts";
import { getUsersByUsernames } from "../repositories/users.repository.ts";

const env = readServerEnv();
const BASE_URL = env.PUBLIC_BASE_URL;

export const postsRoutes = new Hono();

// ---- Reads (public) ----

postsRoutes.get("/:postCode/comments", async (c) => {
  const postCode = c.req.param("postCode");
  const query = parseOrThrow(CommentListQuerySchema, c.req.query());

  if (!hasDatabase() && allowMockFallback()) {
    if (!getMockPostByCode(postCode)) throw notFound("Post not found.");
    return c.json({
      items: getMockCommentsForPost(postCode).slice(0, query.limit),
      nextCursor: null,
    });
  }

  const viewerId = await getOptionalViewerId(c);
  const post = await getPublishedVisiblePostRefByPublicCode(postCode, viewerId);
  if (!post) throw notFound("Post not found.");
  return c.json(await listCommentsForPost(post.id, query, viewerId));
});

postsRoutes.get("/:postCode", async (c) => {
  const postCode = c.req.param("postCode");

  if (!hasDatabase() && allowMockFallback()) {
    const post = getMockPostByCode(postCode);
    if (!post) throw notFound("Post not found.");
    return c.json(post);
  }

  const viewerId = await getOptionalViewerId(c);
  const post = await getPublishedPostByPublicCode(postCode, viewerId);
  if (!post) throw notFound("Post not found.");
  return c.json(post);
});

// ---- Writes (authenticated) ----

// POST /api/posts — create a text / external image / YouTube post (spec §12).
postsRoutes.post("/", requireUser, async (c) => {
  const user = getAuthUser(c);
  await enforceRateLimit(`post:${user.id}`, RATE_LIMITS.createPost);
  const data = parseOrThrow(CreatePostSchema, await readJsonBody(c));

  const fields: CreatePostFields = {
    authorId: user.id,
    postKind: data.postKind,
    title: "", // set per-kind below (text/youtube may derive it)
    tagIds: await resolveTagIds(data.tags),
  };

  if (data.postKind === "text") {
    fields.bodyText = data.bodyText;
    fields.title = resolveTextTitle(data.title, data.bodyText);
  } else if (data.postKind === "external_image") {
    const structural = validateExternalImageUrl(data.imageUrl);
    if (!structural.ok) throw badRequest("That image URL is not allowed.");
    await rejectBlockedDomain(data.imageUrl);
    await enforceRateLimit(`imgcheck:${user.id}`, RATE_LIMITS.imageCheck);
    const fetchable = await checkImageIsFetchable(data.imageUrl);
    if (!fetchable.ok) throw badRequest("That image could not be loaded as a supported image.");
    fields.imageUrl = data.imageUrl;
    fields.title = data.title;
  } else {
    const videoId = extractYouTubeId(data.youtubeUrl);
    if (!videoId) throw badRequest("That YouTube URL is not supported.");
    await rejectBlockedDomain(data.youtubeUrl);
    fields.youtubeUrl = data.youtubeUrl;
    fields.youtubeVideoId = videoId;
    fields.youtubeIsShort = isYouTubeShort(data.youtubeUrl);
    fields.title = await resolveYouTubeTitle(data.title, data.youtubeUrl);
  }

  const { publicCode } = await createPost(fields);
  const post = await getPublishedPostByPublicCode(publicCode);
  if (!post) throw notFound("Post not found after creation.");

  return c.json({ post, canonicalUrl: buildCanonicalPostUrl(BASE_URL, post) }, 201);
});

async function rejectBlockedDomain(url: string): Promise<void> {
  if (!hasDatabase()) return;
  const block = await findBlockedDomainForUrl(url);
  if (block) throw badRequest(`Links from ${block.domain} are blocked by moderation policy.`);
}

postsRoutes.post("/:postCode/reposts", requireUser, async (c) => {
  const user = getAuthUser(c);
  await enforceRateLimit(`repost:${user.id}`, RATE_LIMITS.createRepost);

  const target = await resolveReshareTarget(c.req.param("postCode"), user.id);
  if (await hasPublishedRepost(user.id, target.id)) {
    throw conflict("REPOST_EXISTS", "You already reposted this.");
  }

  const { publicCode } = await createRepostOrThrow({
    authorId: user.id,
    title: reshareTitle(target.title),
    repostOfPostId: target.id,
  });
  const post = await getPublishedPostByPublicCode(publicCode, user.id);
  if (!post) throw notFound("Post not found after creation.");

  return c.json({ post, canonicalUrl: buildCanonicalPostUrl(BASE_URL, post) }, 201);
});

postsRoutes.post("/:postCode/quotes", requireUser, async (c) => {
  const user = getAuthUser(c);
  await enforceRateLimit(`quote:${user.id}`, RATE_LIMITS.createQuote);
  const { bodyText } = parseOrThrow(CreateQuotePostSchema, await readJsonBody(c));

  const target = await resolveReshareTarget(c.req.param("postCode"), user.id);
  const { publicCode } = await createPost({
    authorId: user.id,
    postKind: "quote",
    title: reshareTitle(target.title),
    bodyText,
    repostOfPostId: target.id,
    tagIds: [],
  });
  const post = await getPublishedPostByPublicCode(publicCode, user.id);
  if (!post) throw notFound("Post not found after creation.");

  return c.json({ post, canonicalUrl: buildCanonicalPostUrl(BASE_URL, post) }, 201);
});

// POST /api/posts/:postCode/comments — flat or one-level reply (spec §13).
postsRoutes.post("/:postCode/comments", requireUser, async (c) => {
  const user = getAuthUser(c);
  await enforceRateLimit(`comment:${user.id}`, RATE_LIMITS.createComment);
  const postCode = c.req.param("postCode");
  const { bodyText, parentCommentCode } = parseOrThrow(CreateCommentSchema, await readJsonBody(c));

  const post = await getPublishedVisiblePostRefByPublicCode(postCode, user.id);
  if (!post) throw notFound("Post not found.");

  // A blocked user cannot comment on the blocker's post (spec §15).
  if (post.authorId !== user.id && await isBlocked(post.authorId, user.id)) {
    throw forbidden("You can't comment on this post.");
  }

  let parentCommentId: string | null = null;
  let parentAuthorId: string | null = null;
  if (parentCommentCode) {
    const parent = await getReplyParent(post.id, parentCommentCode);
    if (!parent) throw notFound("Parent comment not found.");
    if (!parent.isTopLevel) throw badRequest("Replies cannot be nested deeper than one level.");
    // A blocked user cannot reply to the blocker's comment (spec §15).
    if (parent.authorId !== user.id && await isBlocked(parent.authorId, user.id)) {
      throw forbidden("You can't reply to this comment.");
    }
    parentCommentId = parent.id;
    parentAuthorId = parent.authorId;
  }

  const mentionTargets = await resolveMentionTargets(user, bodyText);
  const publicCode = await createComment({
    postId: post.id,
    authorId: user.id,
    bodyText,
    parentCommentId,
  });
  await recordPostEvent({ postId: post.id, actorUserId: user.id, eventType: "comment_created" });
  const commentRef = await getCommentNotificationRefByCode(publicCode);
  if (commentRef) {
    await createCommentNotifications({
      actorUserId: user.id,
      commentId: commentRef.id,
      mentionTargetUserIds: mentionTargets.map((target) => target.id),
      parentAuthorId,
      postId: post.id,
      postOwnerId: post.authorId,
    });
  }

  return c.json(await getCommentByCode(publicCode), 201);
});

// POST /api/posts/:postCode/reactions — set/change/clear a reaction (spec §8.4).
postsRoutes.post("/:postCode/reactions", requireUser, async (c) => {
  const user = getAuthUser(c);
  await enforceRateLimit(`react:${user.id}`, RATE_LIMITS.react);
  const postCode = c.req.param("postCode");
  const { value } = parseOrThrow(SetReactionSchema, await readJsonBody(c));

  const post = await getPublishedVisiblePostRefByPublicCode(postCode, user.id);
  if (!post) throw notFound("Post not found.");

  const result = await setPostReaction(user.id, post.id, value);
  if (value !== 0) {
    await recordPostEvent({ postId: post.id, actorUserId: user.id, eventType: "reaction_created" });
  }
  return c.json(result);
});

async function resolveTagIds(slugs: string[]): Promise<string[]> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return [];

  const resolved = await resolveActiveTagsBySlugsOrAliases(unique);
  if (resolved.invalidSlugs.length > 0) {
    throw badRequest("One or more tags are not available.");
  }
  return resolved.tags.map((tag) => tag.id);
}

async function createRepostOrThrow(input: {
  authorId: string;
  title: string;
  repostOfPostId: string;
}) {
  try {
    return await createPost({
      authorId: input.authorId,
      postKind: "repost",
      title: input.title,
      repostOfPostId: input.repostOfPostId,
      tagIds: [],
    });
  } catch (error) {
    if (isPublishedRepostUniqueViolation(error)) {
      throw conflict("REPOST_EXISTS", "You already reposted this.");
    }
    throw error;
  }
}

function isPublishedRepostUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const candidate = current as {
      code?: unknown;
      constraint_name?: unknown;
      constraint?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    const message = typeof candidate.message === "string" ? candidate.message : "";
    if (
      (candidate.code === "23505" || message.includes("duplicate key")) &&
      (candidate.constraint_name === "posts_author_published_repost_unique" ||
        candidate.constraint === "posts_author_published_repost_unique" ||
        message.includes("posts_author_published_repost_unique"))
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

async function resolveReshareTarget(postCode: string, actorUserId: string) {
  const target = await getReshareTargetByPublicCode(postCode);
  if (!target || target.status !== "published") throw notFound("Post not found.");

  // Reposting or quoting your own post is just self-amplification (spec §15, anti-spam).
  if (target.authorId === actorUserId) {
    throw badRequest("You can't repost or quote your own post.");
  }

  if (await isBlocked(target.authorId, actorUserId)) {
    throw forbidden("You can't repost this post.");
  }
  if (await isBlocked(actorUserId, target.authorId)) {
    throw forbidden("Unblock this user before reposting.");
  }

  return target;
}

function reshareTitle(title: string): string {
  const value = title.replace(/^(?:(?:Repost|Quote):\s*)+/i, "").trim() || title;
  return value.length <= 180 ? value : `${value.slice(0, 177)}...`;
}

// Text posts may skip the title; derive it from the body's first sentence (spec
// §12). Returns a valid 3–180 char title, or rejects when the body is too short.
function resolveTextTitle(title: string | undefined, body: string): string {
  const provided = title?.trim() ?? "";
  if (provided.length >= TITLE_MIN_LENGTH) return provided;

  const derived = deriveTitleFromBody(body);
  if (derived.length < TITLE_MIN_LENGTH) {
    throw badRequest("Add a title — this post is too short to make one from.");
  }
  return derived;
}

function deriveTitleFromBody(body: string): string {
  const firstLine = body.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
  const sentenceEnd = firstLine.search(/[.!?…]/);
  const phrase = (sentenceEnd >= 0 ? firstLine.slice(0, sentenceEnd + 1) : firstLine).trim();
  const candidate = (phrase.length >= TITLE_MIN_LENGTH ? phrase : body.trim()).replace(/\s+/g, " ");
  return candidate.length <= TITLE_MAX_LENGTH
    ? candidate
    : `${candidate.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

// YouTube posts may skip the title too; fall back to the video's own title via
// oEmbed (the same source the client prefills from), then to a safe default so
// the post can always be created without a manual title.
async function resolveYouTubeTitle(title: string | undefined, url: string): Promise<string> {
  const provided = title?.trim() ?? "";
  if (provided.length >= TITLE_MIN_LENGTH) return provided;

  const fetched = (await fetchYouTubeTitle(url))?.trim() ?? "";
  if (fetched.length >= TITLE_MIN_LENGTH) {
    return fetched.length <= TITLE_MAX_LENGTH
      ? fetched
      : `${fetched.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
  }
  return "Shared video";
}

async function createCommentNotifications(input: {
  actorUserId: string;
  commentId: string;
  mentionTargetUserIds: string[];
  parentAuthorId: string | null;
  postId: string;
  postOwnerId: string | null;
}) {
  const notified = new Set<string>();

  async function notify(
    recipientUserId: string | null,
    type: "post_reply" | "comment_reply" | "mention",
  ) {
    if (!recipientUserId || notified.has(recipientUserId)) return;
    const ok = await createNotification({
      recipientUserId,
      actorUserId: input.actorUserId,
      type,
      postId: input.postId,
      commentId: input.commentId,
    });
    if (ok) notified.add(recipientUserId);
  }

  await notify(input.parentAuthorId, "comment_reply");
  await notify(input.postOwnerId, "post_reply");

  for (const userId of input.mentionTargetUserIds) {
    await notify(userId, "mention");
  }
}

const MENTION_PATTERN = /(^|[^a-z0-9_])@([a-z0-9_]{3,24})(?![a-z0-9_])/gi;

async function resolveMentionTargets(
  actor: { id: string; username: string },
  bodyText: string,
): Promise<Array<{ id: string; username: string }>> {
  const usernames = extractMentionUsernames(bodyText);
  if (usernames.length === 0) return [];

  if (usernames.length > MAX_MENTIONS_PER_COMMENT) {
    throw badRequest(`Comments can mention up to ${MAX_MENTIONS_PER_COMMENT} people.`);
  }

  const users = await getUsersByUsernames(usernames);
  const found = new Set(users.map((user) => user.username));
  const missing = usernames.find((username) => !found.has(username));
  if (missing) throw badRequest(`@${missing} is not a Doomscrollr user.`);

  const externalMentionCount = users.filter((user) => user.id !== actor.id).length;
  await enforceRateLimit(`mention:${actor.id}`, RATE_LIMITS.mention, externalMentionCount);
  return users;
}

function extractMentionUsernames(bodyText: string): string[] {
  const usernames = new Set<string>();
  for (const match of bodyText.matchAll(MENTION_PATTERN)) {
    const username = match[2]?.toLowerCase();
    if (username) usernames.add(username);
  }
  return [...usernames];
}

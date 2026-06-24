import { readServerEnv } from "@doomscrollr/config/env.ts";
import { getMockCommentsForPost, getMockPostByCode } from "@doomscrollr/shared/mock-data.ts";
import { CreateCommentSchema } from "@doomscrollr/shared/schemas/comment.schema.ts";
import { CreatePostSchema } from "@doomscrollr/shared/schemas/post.schema.ts";
import { SetReactionSchema } from "@doomscrollr/shared/schemas/reaction.schema.ts";
import { Hono } from "hono";
import { hasDatabase } from "../db/client.ts";
import { badRequest, forbidden, notFound } from "../lib/errors.ts";
import { buildCanonicalPostUrl } from "../lib/og.ts";
import { checkImageIsFetchable, validateExternalImageUrl } from "../lib/image-url.ts";
import { enforceRateLimit, RATE_LIMITS } from "../lib/rate-limit.ts";
import { parseOrThrow, readJsonBody } from "../lib/validation.ts";
import { getAuthUser, getOptionalViewerId, requireUser } from "../middleware/auth.ts";
import { extractYouTubeId, isYouTubeShort } from "../services/youtube.service.ts";
import { isBlocked } from "../repositories/blocks.repository.ts";
import {
  createComment,
  getCommentByCode,
  getReplyParent,
  listCommentsForPost,
} from "../repositories/comments.repository.ts";
import { recordPostEvent } from "../repositories/events.repository.ts";
import {
  createPost,
  type CreatePostFields,
  getActiveTagsBySlugs,
  getPostIdByPublicCode,
  getPostOwnerById,
  getPublishedPostByPublicCode,
} from "../repositories/posts.repository.ts";
import { setPostReaction } from "../repositories/reactions.repository.ts";

const env = readServerEnv();
const BASE_URL = env.PUBLIC_BASE_URL;

export const postsRoutes = new Hono();

// ---- Reads (public) ----

postsRoutes.get("/:postCode/comments", async (c) => {
  const postCode = c.req.param("postCode");

  if (!hasDatabase()) {
    if (!getMockPostByCode(postCode)) throw notFound("Post not found.");
    return c.json({ items: getMockCommentsForPost(postCode) });
  }

  const postId = await getPostIdByPublicCode(postCode);
  if (!postId) throw notFound("Post not found.");
  const viewerId = await getOptionalViewerId(c);
  return c.json({ items: await listCommentsForPost(postId, viewerId) });
});

postsRoutes.get("/:postCode", async (c) => {
  const postCode = c.req.param("postCode");

  if (!hasDatabase()) {
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
  enforceRateLimit(`post:${user.id}`, RATE_LIMITS.createPost);
  const data = parseOrThrow(CreatePostSchema, await readJsonBody(c));

  const fields: CreatePostFields = {
    authorId: user.id,
    postKind: data.postKind,
    title: data.title,
    tagIds: await resolveTagIds(data.tags),
  };

  if (data.postKind === "text") {
    fields.bodyText = data.bodyText;
  } else if (data.postKind === "external_image") {
    const structural = validateExternalImageUrl(data.imageUrl);
    if (!structural.ok) throw badRequest("That image URL is not allowed.");
    enforceRateLimit(`imgcheck:${user.id}`, RATE_LIMITS.imageCheck);
    const fetchable = await checkImageIsFetchable(data.imageUrl);
    if (!fetchable.ok) throw badRequest("That image could not be loaded as a supported image.");
    fields.imageUrl = data.imageUrl;
  } else {
    const videoId = extractYouTubeId(data.youtubeUrl);
    if (!videoId) throw badRequest("That YouTube URL is not supported.");
    fields.youtubeUrl = data.youtubeUrl;
    fields.youtubeVideoId = videoId;
    fields.youtubeIsShort = isYouTubeShort(data.youtubeUrl);
  }

  const { publicCode } = await createPost(fields);
  const post = await getPublishedPostByPublicCode(publicCode);
  if (!post) throw notFound("Post not found after creation.");

  return c.json({ post, canonicalUrl: buildCanonicalPostUrl(BASE_URL, post) }, 201);
});

// POST /api/posts/:postCode/comments — flat or one-level reply (spec §13).
postsRoutes.post("/:postCode/comments", requireUser, async (c) => {
  const user = getAuthUser(c);
  enforceRateLimit(`comment:${user.id}`, RATE_LIMITS.createComment);
  const postCode = c.req.param("postCode");
  const { bodyText, parentCommentCode } = parseOrThrow(CreateCommentSchema, await readJsonBody(c));

  const postId = await getPostIdByPublicCode(postCode);
  if (!postId) throw notFound("Post not found.");

  // A blocked user cannot comment on the blocker's post (spec §15).
  const postOwnerId = await getPostOwnerById(postId);
  if (postOwnerId && postOwnerId !== user.id && await isBlocked(postOwnerId, user.id)) {
    throw forbidden("You can't comment on this post.");
  }

  let parentCommentId: string | null = null;
  if (parentCommentCode) {
    const parent = await getReplyParent(postId, parentCommentCode);
    if (!parent) throw notFound("Parent comment not found.");
    if (!parent.isTopLevel) throw badRequest("Replies cannot be nested deeper than one level.");
    // A blocked user cannot reply to the blocker's comment (spec §15).
    if (parent.authorId !== user.id && await isBlocked(parent.authorId, user.id)) {
      throw forbidden("You can't reply to this comment.");
    }
    parentCommentId = parent.id;
  }

  const publicCode = await createComment({ postId, authorId: user.id, bodyText, parentCommentId });
  await recordPostEvent({ postId, actorUserId: user.id, eventType: "comment_created" });

  return c.json(await getCommentByCode(publicCode), 201);
});

// POST /api/posts/:postCode/reactions — set/change/clear a reaction (spec §8.4).
postsRoutes.post("/:postCode/reactions", requireUser, async (c) => {
  const user = getAuthUser(c);
  enforceRateLimit(`react:${user.id}`, RATE_LIMITS.react);
  const postCode = c.req.param("postCode");
  const { value } = parseOrThrow(SetReactionSchema, await readJsonBody(c));

  const postId = await getPostIdByPublicCode(postCode);
  if (!postId) throw notFound("Post not found.");

  const result = await setPostReaction(user.id, postId, value);
  if (value !== 0) {
    await recordPostEvent({ postId, actorUserId: user.id, eventType: "reaction_created" });
  }
  return c.json(result);
});

async function resolveTagIds(slugs: string[]): Promise<string[]> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return [];

  const found = await getActiveTagsBySlugs(unique);
  if (found.length !== unique.length) {
    throw badRequest("One or more tags are not available.");
  }
  return found.map((tag) => tag.id);
}

import {
  getMockCommentsForPost,
  getMockFeed,
  getMockPostById,
} from "@doomscrollr/shared/mock-data.ts";
import { CreatePostSchema, PostFeedQuerySchema } from "@doomscrollr/shared/schemas/post.schema.ts";
import { Hono } from "hono";
import { hasDatabase } from "../db/client.ts";
import { notFound, notImplemented } from "../lib/errors.ts";
import { parseOrThrow, readJsonBody } from "../lib/validation.ts";
import { requireAuth } from "../middleware/auth.ts";
import {
  getPostDetail,
  listCommentsForPost,
  listFeedPosts,
} from "../repositories/posts.repository.ts";

export const postsRoutes = new Hono();

postsRoutes.get("/", async (c) => {
  const query = parseOrThrow(PostFeedQuerySchema, c.req.query());

  if (hasDatabase()) {
    return c.json(await listFeedPosts(query));
  }

  return c.json(getMockFeed(query));
});

postsRoutes.get("/:id/comments", async (c) => {
  if (hasDatabase()) {
    const post = await getPostDetail(c.req.param("id"));

    if (!post) {
      throw notFound("Post not found.");
    }

    return c.json({ items: await listCommentsForPost(post.id) });
  }

  const post = getMockPostById(c.req.param("id"));

  if (!post) {
    throw notFound("Post not found.");
  }

  return c.json({ items: getMockCommentsForPost(post.id) });
});

postsRoutes.get("/:id", async (c) => {
  if (hasDatabase()) {
    const post = await getPostDetail(c.req.param("id"));

    if (!post) {
      throw notFound("Post not found.");
    }

    return c.json(post);
  }

  const post = getMockPostById(c.req.param("id"));

  if (!post) {
    throw notFound("Post not found.");
  }

  return c.json({
    ...post,
    body:
      "Mock detail copy for the first build slice. Production posts will keep media, votes, comments, reports, and ad eligibility as separate product-owned state.",
  });
});

postsRoutes.post("/", requireAuth, async (c) => {
  parseOrThrow(CreatePostSchema, await readJsonBody(c));
  throw notImplemented(
    "Post creation will be implemented after provider resolution and Clerk user sync.",
  );
});

postsRoutes.post("/:id/vote", requireAuth, () => {
  throw notImplemented(
    "Post voting will be implemented with database-backed uniqueness constraints.",
  );
});

postsRoutes.delete("/:id/vote", requireAuth, () => {
  throw notImplemented(
    "Vote deletion will be implemented with database-backed uniqueness constraints.",
  );
});

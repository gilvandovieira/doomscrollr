import {
  getMockCommentsForPost,
  getMockFeed,
  getMockPostById,
} from "@doomscrollr/shared/mock-data.ts";
import { CreatePostSchema, PostFeedQuerySchema } from "@doomscrollr/shared/schemas/post.schema.ts";
import { Hono } from "hono";
import { notFound, notImplemented } from "../lib/errors.ts";
import { parseOrThrow, readJsonBody } from "../lib/validation.ts";
import { requireAuth } from "../middleware/auth.ts";

export const postsRoutes = new Hono();

postsRoutes.get("/", (c) => {
  const query = parseOrThrow(PostFeedQuerySchema, c.req.query());
  return c.json(getMockFeed(query));
});

postsRoutes.get("/:id/comments", (c) => {
  const post = getMockPostById(c.req.param("id"));

  if (!post) {
    throw notFound("Post not found.");
  }

  return c.json({ items: getMockCommentsForPost(post.id) });
});

postsRoutes.get("/:id", (c) => {
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

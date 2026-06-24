import { getMockFeed } from "@doomscrollr/shared/mock-data.ts";
import { RecentFeedQuerySchema } from "@doomscrollr/shared/schemas/post.schema.ts";
import { Hono } from "hono";
import { allowMockFallback, hasDatabase } from "../db/client.ts";
import { parseOrThrow } from "../lib/validation.ts";
import { listRecentFeed } from "../repositories/posts.repository.ts";
import { getOptionalViewerId } from "../middleware/auth.ts";

export const feedRoutes = new Hono();

// GET /api/feed/recent — recent feed only, keyset pagination (spec §9, §20.2).
feedRoutes.get("/recent", async (c) => {
  const query = parseOrThrow(RecentFeedQuerySchema, c.req.query());

  if (!hasDatabase() && allowMockFallback()) {
    return c.json(getMockFeed(query));
  }

  const viewerId = await getOptionalViewerId(c);
  return c.json(await listRecentFeed(query, viewerId));
});

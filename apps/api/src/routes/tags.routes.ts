import { getMockFeedByTag, getMockTagBySlug, getMockTags } from "@doomscrollr/shared/mock-data.ts";
import { RecentFeedQuerySchema } from "@doomscrollr/shared/schemas/post.schema.ts";
import { TagSlugSchema } from "@doomscrollr/shared/schemas/tag.schema.ts";
import { Hono } from "hono";
import { hasDatabase } from "../db/client.ts";
import { notFound } from "../lib/errors.ts";
import { parseOrThrow } from "../lib/validation.ts";
import { getOptionalViewerId } from "../middleware/auth.ts";
import { listRecentFeedByTagId } from "../repositories/posts.repository.ts";
import { getActiveTagBySlugOrAlias, listActiveTags } from "../repositories/tags.repository.ts";

export const tagsRoutes = new Hono();

// GET /api/tags — curated active tags, ordered for directory/sidebar use.
tagsRoutes.get("/", async (c) => {
  if (!hasDatabase()) return c.json({ items: getMockTags() });
  return c.json({ items: await listActiveTags() });
});

// GET /api/tags/:tagSlug/posts — recent posts for a canonical tag or alias.
tagsRoutes.get("/:tagSlug/posts", async (c) => {
  const requestedSlug = parseOrThrow(TagSlugSchema, c.req.param("tagSlug"));
  const query = parseOrThrow(RecentFeedQuerySchema, c.req.query());

  if (!hasDatabase()) {
    const tag = getMockTagBySlug(requestedSlug);
    if (!tag) throw notFound("Tag not found.");
    return c.json(getMockFeedByTag(tag.slug, query));
  }

  const tag = await getActiveTagBySlugOrAlias(requestedSlug);
  if (!tag) throw notFound("Tag not found.");

  const viewerId = await getOptionalViewerId(c);
  return c.json(await listRecentFeedByTagId(tag.id, query, viewerId));
});

// GET /api/tags/:tagSlug — tag metadata, resolving aliases to their canonical tag.
tagsRoutes.get("/:tagSlug", async (c) => {
  const requestedSlug = parseOrThrow(TagSlugSchema, c.req.param("tagSlug"));

  if (!hasDatabase()) {
    const tag = getMockTagBySlug(requestedSlug);
    if (!tag) throw notFound("Tag not found.");
    return c.json({ tag, requestedSlug, canonicalSlug: tag.slug });
  }

  const tag = await getActiveTagBySlugOrAlias(requestedSlug);
  if (!tag) throw notFound("Tag not found.");

  const { id: _id, ...publicTag } = tag;
  return c.json({ tag: publicTag, requestedSlug, canonicalSlug: publicTag.slug });
});

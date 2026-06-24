import { readServerEnv } from "@doomscrollr/config/env.ts";
import { getMockPostByCode } from "@doomscrollr/shared/mock-data.ts";
import type { FeedPost } from "@doomscrollr/shared/types.ts";
import { Context, Hono } from "hono";
import { allowMockFallback, hasDatabase } from "../db/client.ts";
import { ensureAnonSession } from "../lib/anon-session.ts";
import { validateExternalImageUrl } from "../lib/image-url.ts";
import {
  buildCanonicalPostUrl,
  buildPostOpenGraph,
  renderPostShellHtml,
  renderUnavailablePostHtml,
} from "../lib/og.ts";
import { getPostForPublicPageByCode } from "../repositories/posts.repository.ts";

const env = readServerEnv();
const BASE_URL = env.PUBLIC_BASE_URL;
// Where the interactive SPA lives. In production it is the same origin; in dev it
// is the Vite server. Crawlers only need the OG metadata served here either way.
const WEB_ORIGIN = env.WEB_ORIGIN;

export const pageRoutes = new Hono();

// Server-rendered canonical post pages with Open Graph metadata in the initial HTML,
// so WhatsApp/crawler previews never depend on client-side React (spec §10.1, §11).
// These must be registered before any SPA fallback.
async function renderPostPage(c: Context) {
  const postCode = c.req.param("postCode");
  ensureAnonSession(c); // set ds_aid on the primary public route (spec §10.2)

  if (!postCode) {
    return c.html(renderUnavailablePostHtml(WEB_ORIGIN, BASE_URL), 404);
  }

  const post = hasDatabase()
    ? await getPostForPublicPageByCode(postCode)
    : allowMockFallback()
    ? getMockPostByCode(postCode)
    : null;

  const appUrl = post ? `${WEB_ORIGIN}/p/${post.publicCode}/${post.slug}` : WEB_ORIGIN;

  if (!post) {
    return c.html(renderUnavailablePostHtml(WEB_ORIGIN, BASE_URL), 404);
  }
  // Removed posts must not expose their original title/image (spec §11.4).
  if (post.status === "removed") {
    return c.html(renderUnavailablePostHtml(appUrl, BASE_URL), 200);
  }

  const canonicalUrl = buildCanonicalPostUrl(BASE_URL, post);
  const requestedSlug = c.req.param("slug");
  if (requestedSlug && requestedSlug !== post.slug) {
    return c.redirect(canonicalUrl, 308);
  }

  const ogImage = resolveExternalOgImage(post);
  const og = buildPostOpenGraph(post, canonicalUrl, ogImage);

  return c.html(renderPostShellHtml({ post, canonicalUrl, og, appUrl }));
}

// External images were validated at post creation. Do not refetch them on every
// crawler hit; a structural check here keeps legacy/bad rows from entering OG.
function resolveExternalOgImage(post: FeedPost): string | undefined {
  const imageUrl = post.postKind === "external_image" && post.imageUrl
    ? post.imageUrl
    : post.repostOf?.postKind === "external_image" && post.repostOf.imageUrl
    ? post.repostOf.imageUrl
    : null;
  if (!imageUrl) return undefined;
  const check = validateExternalImageUrl(imageUrl);
  return check.ok ? imageUrl : undefined;
}

pageRoutes.get("/:postCode/:slug", renderPostPage);
pageRoutes.get("/:postCode", renderPostPage);

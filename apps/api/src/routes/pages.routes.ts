import { readServerEnv } from "@doomscrollr/config/env.ts";
import { getMockPostByCode } from "@doomscrollr/shared/mock-data.ts";
import type { FeedPost } from "@doomscrollr/shared/types.ts";
import { Context, Hono } from "hono";
import { hasDatabase } from "../db/client.ts";
import { ensureAnonSession } from "../lib/anon-session.ts";
import { checkImageIsFetchable } from "../lib/image-url.ts";
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
const WEB_ORIGIN = Deno.env.get("WEB_ORIGIN") ??
  (env.APP_ENV === "production" ? BASE_URL : "http://localhost:5173");

export const pageRoutes = new Hono();

// Server-rendered canonical post pages with Open Graph metadata in the initial HTML,
// so WhatsApp/crawler previews never depend on client-side React (spec §10.1, §11).
// These must be registered before any SPA fallback.
async function renderPostPage(c: Context) {
  const postCode = c.req.param("postCode");
  ensureAnonSession(c); // set ds_aid on the primary public route (spec §10.2)

  if (!postCode) {
    return c.html(renderUnavailablePostHtml(WEB_ORIGIN), 404);
  }

  const post = hasDatabase()
    ? await getPostForPublicPageByCode(postCode)
    : getMockPostByCode(postCode);

  const appUrl = post ? `${WEB_ORIGIN}/p/${post.publicCode}/${post.slug}` : WEB_ORIGIN;

  if (!post) {
    return c.html(renderUnavailablePostHtml(WEB_ORIGIN), 404);
  }
  // Removed posts must not expose their original title/image (spec §11.4).
  if (post.status === "removed") {
    return c.html(renderUnavailablePostHtml(appUrl), 200);
  }

  const canonicalUrl = buildCanonicalPostUrl(BASE_URL, post);
  const ogImage = await resolveExternalOgImage(post);
  const og = buildPostOpenGraph(post, canonicalUrl, ogImage);

  return c.html(renderPostShellHtml({ post, canonicalUrl, og, appUrl }));
}

// Only trust an external image as og:image if it is publicly fetchable and an
// allowed image type; otherwise the generic preview is used (spec §11.3).
async function resolveExternalOgImage(post: FeedPost): Promise<string | undefined> {
  const imageUrl = post.postKind === "external_image" && post.imageUrl
    ? post.imageUrl
    : post.repostOf?.postKind === "external_image" && post.repostOf.imageUrl
    ? post.repostOf.imageUrl
    : null;
  if (!imageUrl) return undefined;
  const check = await checkImageIsFetchable(imageUrl);
  return check.ok ? imageUrl : undefined;
}

pageRoutes.get("/:postCode/:slug", renderPostPage);
pageRoutes.get("/:postCode", renderPostPage);

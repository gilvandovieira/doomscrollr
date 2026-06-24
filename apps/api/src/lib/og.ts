import {
  POST_SLUG_MAX_LENGTH,
  PRODUCT_CODENAME,
  PUBLIC_CODE_LENGTH,
} from "@doomscrollr/shared/constants.ts";
import type { FeedPost } from "@doomscrollr/shared/types.ts";

// Generic branded preview used for text posts, removed/unavailable posts, and as a
// fallback when an external image can't be trusted (spec §11.3, §11.4). Served
// by the API so OG pages never depend on an external placeholder host.
export const DEFAULT_OG_IMAGE_PATH = "/og-default.svg";

const GENERIC_DESCRIPTION = `Join the discussion on ${PRODUCT_CODENAME}`;

// V2-014: BELL short links stay deferred while canonical post URLs are bounded
// and shareable. This threshold is intentionally conservative; WhatsApp accepts
// much longer URLs, but short-link infrastructure needs a clearer product reason.
export const BELL_CANONICAL_URL_LENGTH_THRESHOLD = 160;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(value: string, max = 160): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function buildCanonicalPostUrl(baseUrl: string, post: FeedPost): string {
  return `${baseUrl.replace(/\/$/, "")}/p/${post.publicCode}/${post.slug}`;
}

export function maxCanonicalPostUrlLength(baseUrl: string): number {
  return baseUrl.replace(/\/$/, "").length + "/p/".length + PUBLIC_CODE_LENGTH + 1 +
    POST_SLUG_MAX_LENGTH;
}

export function canonicalUrlsNeedBell(baseUrl: string): boolean {
  return maxCanonicalPostUrlLength(baseUrl) > BELL_CANONICAL_URL_LENGTH_THRESHOLD;
}

function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function defaultOgImageUrl(baseUrl: string): string {
  return new URL(DEFAULT_OG_IMAGE_PATH, baseUrl).toString();
}

export type OpenGraph = {
  title: string;
  description: string;
  url: string;
  type: string;
  image: string;
};

// `ogImage` is resolved by the caller (it may require a network check for external
// images) and passed in. When omitted we use the generic preview.
export function buildPostOpenGraph(
  post: FeedPost,
  canonicalUrl: string,
  ogImage?: string,
): OpenGraph {
  let image = defaultOgImageUrl(canonicalUrl);
  if (post.postKind === "youtube" && post.youtubeVideoId) {
    image = youtubeThumbnail(post.youtubeVideoId);
  } else if (post.postKind === "external_image" && ogImage) {
    image = ogImage;
  } else if (post.repostOf?.postKind === "youtube" && post.repostOf.youtubeVideoId) {
    image = youtubeThumbnail(post.repostOf.youtubeVideoId);
  } else if (post.repostOf?.postKind === "external_image" && ogImage) {
    image = ogImage;
  }

  return {
    title: post.title,
    description: postDescription(post),
    url: canonicalUrl,
    type: "article",
    image,
  };
}

function postDescription(post: FeedPost): string {
  if ((post.postKind === "text" || post.postKind === "quote") && post.bodyText) {
    return truncate(post.bodyText);
  }
  if (post.postKind === "repost" && post.repostOf) {
    return truncate(`Reposted from @${post.repostOf.author.username}: ${post.repostOf.title}`);
  }
  return GENERIC_DESCRIPTION;
}

function metaTags(og: OpenGraph, canonicalUrl: string): string {
  return [
    `<meta property="og:title" content="${escapeHtml(og.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(og.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(og.url)}" />`,
    `<meta property="og:type" content="${og.type}" />`,
    `<meta property="og:image" content="${escapeHtml(og.image)}" />`,
    `<meta property="og:site_name" content="${PRODUCT_CODENAME}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="description" content="${escapeHtml(og.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
  ].join("\n    ");
}

// Server-rendered body content so the canonical URL is readable without JS.
function postPreviewHtml(post: FeedPost, appUrl: string): string {
  let media = "";
  if (post.postKind === "external_image" && post.imageUrl) {
    media = `<img src="${escapeHtml(post.imageUrl)}" alt="" loading="lazy" />`;
  } else if (post.postKind === "youtube" && post.youtubeUrl) {
    media = `<p><a href="${escapeHtml(post.youtubeUrl)}" rel="noopener">Watch on YouTube</a></p>`;
  } else if (post.postKind === "text" && post.bodyText) {
    media = `<p class="body">${escapeHtml(post.bodyText)}</p>`;
  } else if (post.postKind === "quote" || post.postKind === "repost") {
    media = [
      post.postKind === "quote" && post.bodyText
        ? `<p class="body">${escapeHtml(post.bodyText)}</p>`
        : "",
      post.repostOf
        ? embeddedPostHtml(post.repostOf)
        : `<p class="embed">Original post unavailable.</p>`,
    ].join("");
  }

  return `
      <article>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="byline">by @${escapeHtml(post.author.username)}</p>
        ${media}
        <p><a class="cta" href="${escapeHtml(appUrl)}">Open in ${PRODUCT_CODENAME}</a></p>
      </article>`;
}

function embeddedPostHtml(post: NonNullable<FeedPost["repostOf"]>): string {
  let media = "";
  if (post.postKind === "external_image" && post.imageUrl) {
    media = `<img src="${escapeHtml(post.imageUrl)}" alt="" loading="lazy" />`;
  } else if (post.postKind === "youtube" && post.youtubeUrl) {
    media = `<p><a href="${escapeHtml(post.youtubeUrl)}" rel="noopener">Watch on YouTube</a></p>`;
  } else if ((post.postKind === "text" || post.postKind === "quote") && post.bodyText) {
    media = `<p class="body">${escapeHtml(post.bodyText)}</p>`;
  }

  return `
        <section class="embed">
          <p class="byline">shared from @${escapeHtml(post.author.username)}</p>
          <h2>${escapeHtml(post.title)}</h2>
          ${media}
        </section>`;
}

const SHELL_STYLES =
  `body{margin:0;font-family:system-ui,sans-serif;background:#0b0b0b;color:#f5f5f5;line-height:1.5}` +
  `main{max-width:640px;margin:0 auto;padding:24px}` +
  `h1{font-size:1.6rem;margin:0 0 8px}` +
  `h2{font-size:1.1rem;margin:0 0 8px}` +
  `.byline{color:#9a9a9a;margin:0 0 16px}` +
  `img{max-width:100%;border-radius:8px}` +
  `.body{white-space:pre-wrap}` +
  `.embed{border:1px solid #333;border-radius:8px;margin-top:16px;padding:16px}` +
  `.cta{display:inline-block;margin-top:16px;color:#0b0b0b;background:#f5f5f5;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600}`;

export function renderPostShellHtml(options: {
  post: FeedPost;
  canonicalUrl: string;
  og: OpenGraph;
  appUrl: string;
}): string {
  const { post, canonicalUrl, og, appUrl } = options;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(post.title)} · ${PRODUCT_CODENAME}</title>
    ${metaTags(og, canonicalUrl)}
    <style>${SHELL_STYLES}</style>
  </head>
  <body>
    <main id="root">${postPreviewHtml(post, appUrl)}</main>
  </body>
</html>`;
}

export function renderUnavailablePostHtml(appUrl: string, imageBaseUrl = appUrl): string {
  const og: OpenGraph = {
    title: `${PRODUCT_CODENAME}`,
    description: "This post is unavailable.",
    url: appUrl,
    type: "website",
    image: defaultOgImageUrl(imageBaseUrl),
  };
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Post unavailable · ${PRODUCT_CODENAME}</title>
    ${metaTags(og, appUrl)}
    <style>${SHELL_STYLES}</style>
  </head>
  <body>
    <main id="root">
      <article>
        <h1>This post is unavailable.</h1>
        <p class="byline">It may have been removed or never existed.</p>
        <p><a class="cta" href="${escapeHtml(appUrl)}">Go to ${PRODUCT_CODENAME}</a></p>
      </article>
    </main>
  </body>
</html>`;
}

export function renderDefaultOgImageSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${PRODUCT_CODENAME}">
  <rect width="1200" height="630" fill="#0b0b0b"/>
  <rect x="56" y="56" width="1088" height="518" rx="28" fill="#f5f5f5"/>
  <rect x="96" y="96" width="1008" height="438" rx="18" fill="#161616"/>
  <text x="116" y="302" fill="#f5f5f5" font-family="Inter, system-ui, sans-serif" font-size="96" font-weight="900">${PRODUCT_CODENAME}</text>
  <text x="122" y="378" fill="#f5f5f5" font-family="Inter, system-ui, sans-serif" font-size="34" font-weight="700">Share the post. Keep the context.</text>
</svg>`;
}

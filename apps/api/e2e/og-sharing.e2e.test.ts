// The spec's hard requirement (§10–11): canonical post pages must serve complete
// Open Graph metadata AND readable content in the initial HTML, so a WhatsApp/crawler
// preview never depends on client-side React. We assert with plain fetch — by
// definition no JavaScript runs — which is exactly what a crawler sees.

import type { PostDetail } from "@doomscrollr/shared/types.ts";
import { api, assert, assertIncludes, assertStatus, e2eTest, POSTS } from "./harness.ts";

type CreatePostResponse = { post: PostDetail; canonicalUrl: string };

function assertHtml(contentType: string | null): void {
  assert(
    contentType?.includes("text/html") ?? false,
    `canonical post page should be served as text/html, got ${contentType}`,
  );
}

e2eTest("text post page serves OG metadata and readable content without JS", async () => {
  // Crawler-style request: no JS engine, a messenger user agent.
  const res = await api(`/p/${POSTS.fridayText.code}/${POSTS.fridayText.slug}`, {
    headers: { "user-agent": "WhatsApp/2.23" },
  });
  assertStatus(res, 200);
  assertHtml(res.headers.get("content-type"));

  const html = res.text;
  // Open Graph + Twitter card present in the initial markup.
  assertIncludes(
    html,
    '<meta property="og:title" content="When prod breaks on Friday"',
    "og:title",
  );
  assertIncludes(html, '<meta property="og:type" content="article"', "og:type");
  assertIncludes(html, '<meta property="og:site_name" content="Doomscrollr"', "og:site_name");
  assertIncludes(html, '<meta name="twitter:card" content="summary_large_image"', "twitter card");
  assertIncludes(
    html,
    `og:url" content="http://localhost:8000/p/${POSTS.fridayText.code}/`,
    "og:url",
  );
  assertIncludes(
    html,
    `<link rel="canonical" href="http://localhost:8000/p/${POSTS.fridayText.code}/`,
    "canonical",
  );
  // Human-readable body in the server HTML, not just meta tags.
  assertIncludes(html, "When prod breaks on Friday", "rendered title");
  assertIncludes(html, "by @lucas", "rendered byline");

  // Sets the first-party anonymous funnel cookie on the primary public route (§10.2).
  const setCookie = res.headers.get("set-cookie") ?? "";
  assertIncludes(setCookie, "ds_aid=", "anon session cookie");
});

e2eTest("canonical page works without the slug segment", async () => {
  const res = await api(`/p/${POSTS.fridayText.code}`);
  assertStatus(res, 200);
  assertHtml(res.headers.get("content-type"));
  assertIncludes(res.text, '<meta property="og:title"', "og:title present without slug");
});

e2eTest("youtube post uses the video thumbnail as og:image", async () => {
  const res = await api(`/p/${POSTS.shortYoutube.code}/${POSTS.shortYoutube.slug}`);
  assertStatus(res, 200);
  assertIncludes(
    res.text,
    '<meta property="og:image" content="https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg"',
    "youtube og:image",
  );
});

e2eTest("quote post page renders quote body and embedded target without JS", async () => {
  const clerkId = "clerk_e2e_ogquoter";
  const quoteBody = "Quote pages should preview my note before the shared source.";

  const claimed = await api("/api/account/username", {
    asUser: clerkId,
    body: { username: "ogquoter" },
  });
  assertStatus(claimed, 201);

  const quote = await api<CreatePostResponse>(`/api/posts/${POSTS.fridayText.code}/quotes`, {
    asUser: clerkId,
    body: { bodyText: quoteBody },
  });
  assertStatus(quote, 201);

  const res = await api(`/p/${quote.json.post.publicCode}/${quote.json.post.slug}`, {
    headers: { "user-agent": "WhatsApp/2.23" },
  });
  assertStatus(res, 200);
  assertHtml(res.headers.get("content-type"));
  assertIncludes(
    res.text,
    `<meta property="og:description" content="${quoteBody}"`,
    "quote og:description",
  );
  assertIncludes(res.text, quoteBody, "rendered quote body");
  assertIncludes(res.text, "shared from @lucas", "rendered embedded byline");
  assertIncludes(res.text, "When prod breaks on Friday", "rendered embedded title");
});

e2eTest("unknown post code returns a 404 unavailable page that still carries OG tags", async () => {
  const res = await api("/p/zzzzzzzzzz");
  assertStatus(res, 404);
  assertHtml(res.headers.get("content-type"));
  assertIncludes(res.text, "This post is unavailable.", "unavailable copy");
  // Even the fallback must be share-safe (no broken preview).
  assertIncludes(res.text, '<meta property="og:title"', "fallback still has OG tags");
});

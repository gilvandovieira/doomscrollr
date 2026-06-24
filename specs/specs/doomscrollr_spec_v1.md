# Doomscrollr v1 Specification

**Version:** v1.0  
**Date:** 2026-06-24  
**Status:** cut-down validation specification
**Roadmap role:** controlling v1 contract  
**Temporary project name:** Doomscrollr  

> Doomscrollr remains a temporary codename. The public brand name must be rechecked before public launch for domain, handle, trademark, and product-confusion risk.

---

## 1. Scope Reset

This document defines **Doomscrollr v1**, the cut-down validation version of the product.

The canonical version ladder lives in [`doomscrollr_roadmap_v1_v2_v3_future.md`](../doomscrollr_roadmap_v1_v2_v3_future.md). This spec does not restate that ladder; it only defines the v1 product boundary.

The objective is not to ship the old full platform immediately. The objective is to validate the WhatsApp sharing loop first, then earn the right to move toward the broader **v3 platform target** through a deliberate **v2 milestone**.

The previous v3 draft described a full platform. It included ranking runs, DOOM uploads, BELL short links, mature-content gates, ad eligibility, provider rechecks, ltree comments, trust tiers, advanced moderation, and future community scaffolding.

That is not v1.

The v1 must answer one question:

```txt
Will people create posts, share them to WhatsApp, and get friends to open, react, comment, or create their own posts?
```

Every feature in v1 must support this loop:

```txt
Create post -> Share to WhatsApp -> Friend opens -> Friend reacts/comments -> Creator returns
```

The principle for v1 is:

```txt
Earn every subsystem back with usage.
```

---

## 2. Product Thesis

Doomscrollr v1 is a **SFW-only, mobile-first social posting experiment**.

Users can create:

```txt
Text posts
External image-link posts
YouTube/Shorts posts
```

Users can:

```txt
Browse the recent feed
Open post pages
Comment
React/vote
Share posts to WhatsApp
Block users
Report bad content
View simple @username profiles
```

Doomscrollr is not yet a full Reddit clone, 9GAG clone, community platform, media upload platform, or monetized ad product.

---

## 3. Strategic Fork: SFW First, Suggestive Later

Doomscrollr v1 chooses one business:

```txt
SFW social sharing app
```

For v1, **only SFW content is accepted**.

Suggestive content is **not NSFW in Doomscrollr's long-term model**, but it is **deferred from v1**. Suggestive content comes later only after the product has real users, user controls, reporting, blocking, and strong moderation.

Doomscrollr explicitly does **not** choose:

```txt
Mature/adult UGC platform
```

Mature UGC is not a visibility flag. It changes payments, moderation, hosting, CDN/object storage risk, legal exposure, age verification, recordkeeping, and monetization.

Therefore, v1 removes the mature-content model entirely and does not ship a suggestive-content surface yet.

### 3.1 Allowed Content in V1

Allowed, subject to moderation:

```txt
Normal memes
Text posts
Links
External image memes
YouTube/Shorts embeds
Profanity
Mild edgy humor
Non-sexual dark humor, within policy
```

### 3.2 Deferred Non-NSFW Content

Deferred from v1, but potentially allowed in v2+ with users and good moderation:

```txt
Mild suggestive jokes or innuendo
Non-explicit, non-nude suggestive content
Suggestive posts that require user filtering or moderator review
```

Suggestive content is not treated as NSFW, but it is not part of the v1 validation product.

### 3.3 Not Allowed

Not allowed:

```txt
Nudity
Pornography
Explicit sexual content
Sexual content designed for gratification
Explicit sexual acts
Sexualized minors
Exploitation
Non-consensual sexual content
Illegal content
Graphic gore
Hate/harassment content
Spam/phishing
```

### 3.4 Removed From V1

Removed from v1:

```txt
content_rating = mature
mature opt-in
age verification
age_verifications table
mature Open Graph fallback
mature media handling
adult-content provider checks
NSFW feeds
suggestive-content feed gates
```

V1 posts are either SFW and allowed, or they are removed.

---

## 4. System Names

The names remain useful as future architecture language, but only Scrollr is active in v1.

```txt
Doomscrollr = product / project codename
Scrollr     = core v1 application system
DOOM        = deferred uploaded image/GIF subsystem
BELL        = deferred short-link subsystem
```

### 4.1 Scrollr System

Scrollr owns v1 behavior:

```txt
users
Clerk auth integration
posts
recent feed
comments
reactions/votes
reports
basic moderation
blocking
public routes
WhatsApp sharing via canonical URLs
```

### 4.2 DOOM Deferred

DOOM is not in v1.

Deferred DOOM responsibilities:

```txt
multipart uploads
RustFS/S3 storage
image/GIF optimization
media variants
upload worker
upload cleanup jobs
```

V1 does not support native uploads. External image-link posts are used instead.

### 4.3 BELL Deferred

BELL is not in v1.

Deferred BELL responsibilities:

```txt
short links
/s/:shortCode routes
share analytics
QR share links
attribution-heavy sharing
```

V1 uses direct canonical URLs with a plain WhatsApp `wa.me` link.

---

## 5. V1 Feature Scope

### 5.1 In V1

V1 includes:

```txt
Deno monorepo
React mobile-first web app
Hono API
PostgreSQL + Drizzle
Zod validation
Pino logs
Clerk auth
@username public profiles
Text posts
External image-link posts
YouTube/Shorts posts
Recent feed only
Canonical post URLs
WhatsApp share button
Flat or shallow comments
Simple reactions/votes
Basic reports
Admin remove/restore tools
User blocking
Basic rate limits
SFW-only policy
Optional curated tags only if trivial
Server-rendered Open Graph previews for canonical post URLs
```

### 5.2 Out of V1

V1 excludes:

```txt
DOOM uploads
BELL short links
GIPHY
Tenor
AdSense
ads of any kind
paid tier
suggestive content surface
mature/adult content
age verification
ranking runs
hot/top feeds
ltree comments
deep Reddit threads
communities
friend circles
collections
notifications
mentions
search
meme battles
remixes
trust-level automation
analytics dashboards
advanced PWA service worker
```

---

## 6. Public Routing and Identity

Internal database IDs must never appear in public URLs.

### 6.1 Public Routes

```txt
/                         recent feed
/p/:postCode              post page
/p/:postCode/:slug        readable post URL
/@:username               user profile
/t/:tagSlug               tag page, optional v1 feature
```

Examples:

```txt
/@lucas
/p/7kF3mQx9Za
/p/7kF3mQx9Za/when-prod-breaks-on-friday
/t/programming
```

### 6.2 Removed Routes From V1

Not in v1:

```txt
/s/:shortCode             BELL short link, deferred
/c/:commentCode           focused comment thread, deferred unless needed
/g/:communitySlug         future community
```

### 6.3 User Handles

User profiles use handles:

```txt
/@lucas
/@maria
```

The `@id` is a public username, not a database ID.

Handle rules:

```txt
3-24 characters
lowercase letters, numbers, underscore
unique
reserved names blocked
```

Reserved examples:

```txt
admin
api
login
logout
settings
support
moderation
doom
scrollr
bell
```

---

## 7. ID Model

### 7.1 Internal IDs

Internal IDs use UUIDv7 generated by the application layer.

```txt
users.id
posts.id
comments.id
reports.id
```

Do not assume a native Postgres UUIDv7 generator. Generate UUIDv7 app-side.

### 7.2 Public Codes

Public posts use short random public codes.

```txt
posts.public_code = 7kF3mQx9Za
```

Use a URL-safe alphabet that avoids confusing characters:

```txt
23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
```

Generation rule:

```txt
generate random code
reject if it matches blocked profanity/slur patterns
insert into database
if unique constraint fails, retry
```

The profanity/slur filter matters because random codes can accidentally spell bad words.

---

## 8. Core Data Model

V1 intentionally avoids a generalized `media_assets` lifecycle.

Posts store only the fields they need.

### 8.1 Users

```sql
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'limited', 'suspended', 'banned');

CREATE TABLE users (
  id uuid PRIMARY KEY,
  clerk_user_id text NOT NULL UNIQUE,

  username text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,

  role user_role NOT NULL DEFAULT 'user',
  status user_status NOT NULL DEFAULT 'active',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (username ~ '^[a-z0-9_]{3,24}$')
);
```

### 8.2 Posts

```sql
CREATE TYPE post_kind AS ENUM (
  'text',
  'external_image',
  'youtube'
);

CREATE TYPE post_status AS ENUM (
  'published',
  'removed'
);

CREATE TABLE posts (
  id uuid PRIMARY KEY,
  public_code text NOT NULL UNIQUE,

  author_id uuid NOT NULL REFERENCES users(id),

  post_kind post_kind NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,

  body_text text,

  image_url text,
  youtube_url text,
  youtube_video_id text,
  youtube_is_short boolean NOT NULL DEFAULT false,

  status post_status NOT NULL DEFAULT 'published',
  removal_reason text,
  removed_by_user_id uuid REFERENCES users(id),
  removed_at timestamptz,

  score integer NOT NULL DEFAULT 0,
  reaction_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  report_count integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (length(trim(title)) BETWEEN 3 AND 180),

  CHECK (
    (
      post_kind = 'text'
      AND body_text IS NOT NULL
      AND length(trim(body_text)) > 0
      AND image_url IS NULL
      AND youtube_url IS NULL
      AND youtube_video_id IS NULL
    )
    OR
    (
      post_kind = 'external_image'
      AND body_text IS NULL
      AND image_url IS NOT NULL
      AND youtube_url IS NULL
      AND youtube_video_id IS NULL
    )
    OR
    (
      post_kind = 'youtube'
      AND body_text IS NULL
      AND youtube_url IS NOT NULL
      AND youtube_video_id IS NOT NULL
      AND image_url IS NULL
    )
  )
);

CREATE INDEX posts_recent_idx
ON posts (created_at DESC, id DESC)
WHERE status = 'published';

CREATE INDEX posts_author_recent_idx
ON posts (author_id, created_at DESC, id DESC)
WHERE status = 'published';
```

### 8.3 Comments

V1 comments should be flat or shallow.

Recommended v1: one-level replies through adjacency list.

```sql
CREATE TYPE comment_status AS ENUM (
  'published',
  'removed'
);

CREATE TABLE comments (
  id uuid PRIMARY KEY,
  public_code text NOT NULL UNIQUE,

  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id),

  parent_comment_id uuid REFERENCES comments(id),

  body_text text NOT NULL,
  status comment_status NOT NULL DEFAULT 'published',

  score integer NOT NULL DEFAULT 0,
  reaction_count integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,

  removal_reason text,
  removed_by_user_id uuid REFERENCES users(id),
  removed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (length(trim(body_text)) BETWEEN 1 AND 2000)
);

CREATE INDEX comments_post_recent_idx
ON comments (post_id, created_at ASC, id ASC)
WHERE status = 'published';

CREATE INDEX comments_parent_idx
ON comments (parent_comment_id, created_at ASC, id ASC)
WHERE status = 'published';
```

Service rule:

```txt
If parent_comment_id is set, the parent comment must belong to the same post.
If v1 uses one-level replies, the parent comment must be top-level.
```

No `ltree` in v1.

### 8.4 Reactions / Votes

Use simple reactions/votes. Start with one value if you want upvote-only, or `1/-1` if you want Reddit-like voting.

```sql
CREATE TABLE post_reactions (
  user_id uuid NOT NULL REFERENCES users(id),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  value smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, post_id),
  CHECK (value IN (-1, 1))
);

CREATE TABLE comment_reactions (
  user_id uuid NOT NULL REFERENCES users(id),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  value smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, comment_id),
  CHECK (value IN (-1, 1))
);
```

Counter updates must be transactional with reaction insert/update/delete.

### 8.5 Reports

```sql
CREATE TYPE report_target_type AS ENUM ('post', 'comment', 'user');
CREATE TYPE report_status AS ENUM ('open', 'dismissed', 'actioned');

CREATE TABLE reports (
  id uuid PRIMARY KEY,
  reporter_user_id uuid NOT NULL REFERENCES users(id),

  target_type report_target_type NOT NULL,
  target_id uuid NOT NULL,

  reason text NOT NULL,
  details text,
  status report_status NOT NULL DEFAULT 'open',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 8.6 User Blocks

Blocking is in v1.

```sql
CREATE TABLE user_blocks (
  blocker_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);
```

Blocking rules:

```txt
A blocker does not see posts from blocked users.
A blocker does not see comments from blocked users.
A blocked user cannot comment on the blocker's posts.
A blocked user cannot reply to the blocker's comments.
```

Feed queries must push block filters into SQL. Do not call `canViewPost` N times in a loop.

### 8.7 Tags: Optional V1 Feature

Tags are useful, but not essential to the v1 hypothesis. They may be included if they remain curated and simple.

```sql
CREATE TABLE tags (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  post_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (slug ~ '^[a-z0-9-]{2,32}$')
);

CREATE TABLE post_tags (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (post_id, tag_id)
);
```

V1 tag rules:

```txt
Max 5 tags per post.
Users select from curated tags.
No free-form public tag creation in v1.
Admins can create/disable tags.
```

---

## 9. Feed Model

V1 has recent feed only.

```txt
No hot ranking.
No top ranking.
No materialized ranking runs.
No rank-run retention.
No per-tag ranking jobs.
```

Query shape:

```sql
SELECT p.*
FROM posts p
WHERE p.status = 'published'
  AND NOT EXISTS (
    SELECT 1
    FROM user_blocks b
    WHERE b.blocker_user_id = :viewer_id
      AND b.blocked_user_id = p.author_id
  )
ORDER BY p.created_at DESC, p.id DESC
LIMIT :limit;
```

Cursor:

```txt
created_at + id
```

API:

```txt
GET /api/feed/recent?limit=20&cursor=...
```

The visual UI is mobile-first and single-column. The API may fetch 9 or 20 at a time; the product no longer needs the literal 3x3 homepage in v1.

---

## 10. WhatsApp Sharing

WhatsApp sharing is the strategic centerpiece of v1.

No BELL short links in v1.

Use canonical URLs:

```txt
https://doomscrollr.example/p/7kF3mQx9Za/when-prod-breaks-on-friday
```

WhatsApp URL:

```ts
const message = `${post.title}\n${canonicalUrl}`;
const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
```

The v1 share button should prioritize:

```txt
WhatsApp
Copy link
Native share sheet, if available
```

### 10.1 Strategic Requirement: Preview-First Sharing

The WhatsApp preview is part of the product loop, not decoration.

A user will often decide whether to open a shared Doomscrollr link from inside WhatsApp before ever seeing the site. Therefore, the canonical post URL must produce a useful preview when crawled.

This means:

```txt
/p/:postCode must not be a pure client-rendered React shell.
```

React/Vite may own the interactive app after load, but the first HTML response for post routes must already contain the correct Open Graph metadata.

Required behavior:

```txt
GET /p/:postCode
GET /p/:postCode/:slug
  -> Hono resolves the post server-side.
  -> Hono returns an HTML document with post-specific OG tags in the initial <head>.
  -> Browser users still receive the React app mount point and JS bundle.
  -> Crawlers can read the preview without executing JavaScript.
```

This is not full SSR for the entire app. It is **server-rendered metadata for share-critical routes**.

### 10.2 Share Tracking

No BELL analytics subsystem yet.

Minimal v1 tracking uses a simple event table. It is not optional in practice: it is the only source of pre-signup funnel data.

Because seeing a post and sharing it require no account (see Section 15 and Section 18), the most important funnel events are fired by logged-out users:

```txt
post_opened             anonymous or authenticated
whatsapp_share_clicked  anonymous or authenticated
copy_link_clicked       anonymous or authenticated
native_share_clicked    anonymous or authenticated
```

Two events are server-side side effects of authenticated writes and are never reported by the client:

```txt
comment_created         emitted inside the POST comment handler
reaction_created        emitted inside the POST reaction handler
```

The event ingestion endpoint is therefore **public** (see 20.2), with optional auth enrichment: if a valid session is present, attach the user id; otherwise attach the anonymous session id only. The endpoint accepts only the four client-observable events above; it must reject `comment_created` and `reaction_created`.

#### Anonymous session id

To reconstruct multi-hop propagation (`open -> share -> open -> share` among logged-out users, the best possible v1 outcome), set a first-party cookie on the first response from any public route:

```txt
cookie name: ds_aid
value:       random opaque id (UUIDv7, or 16+ random bytes base64url-encoded)
attributes:  HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age ~ 180 days
```

The cookie holds no PII. It exists only to chain anonymous funnel events. Crawlers (WhatsApp, etc.) do not accept cookies and do not execute JavaScript, so they never create sessions or fire events; only real browsers do.

Table:

```sql
CREATE TABLE post_events (
  id uuid PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

  actor_user_id uuid REFERENCES users(id),   -- null for logged-out actors
  anon_session_id text,                       -- ds_aid value; null only if the cookie is refused

  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX post_events_post_idx
ON post_events (post_id, created_at DESC);

CREATE INDEX post_events_anon_idx
ON post_events (anon_session_id, created_at DESC)
WHERE anon_session_id IS NOT NULL;
```

`anon_session_id` is deliberately nullable rather than enforced by a CHECK. A null value (cookie refused) still counts toward funnel totals such as `post_opens_from_shared_links`; it is simply excluded from propagation-chain queries. Counting must not silently drop events.

Privacy: raw client IP must **not** be persisted in `post_events`. IP is used only transiently for rate limiting (see Section 16). `metadata` may hold coarse, non-identifying fields (e.g. referrer kind) but never raw IP or other PII. This keeps anonymous funnel logging within LGPD data-minimization expectations.

Stored v1 event types:

```txt
post_opened
whatsapp_share_clicked
copy_link_clicked
native_share_clicked
comment_created
reaction_created
```

Client-submitted event types accepted by `POST /api/events`:

```txt
post_opened
whatsapp_share_clicked
copy_link_clicked
native_share_clicked
```

Server-emitted event types only:

```txt
comment_created
reaction_created
```

Do not build an analytics dashboard in v1. Use events only to answer the validation funnel.

---

## 11. Open Graph and WhatsApp Preview Rendering

Shared links must look good in WhatsApp.

Because v1 uses React/Vite for the client app, post preview rendering needs a dedicated server path. Client-side meta injection is not acceptable for `/p/:postCode` because crawlers may only inspect the initial HTML response.

### 11.1 Required Server Handler

Add a Hono web route before the SPA fallback:

```txt
GET /p/:postCode
GET /p/:postCode/:slug
```

The handler must:

```txt
1. Resolve postCode to a published post.
2. Build the canonical URL.
3. If slug is missing or stale, either redirect to the canonical slug URL or render canonical OG tags.
4. Return HTML with OG tags in the initial response.
5. Include the React app mount point for normal browser users.
6. Never require JavaScript execution for OG metadata.
```

Implementation shape:

```ts
app.get('/p/:postCode{/:slug}?', async (c) => {
  const post = await postsService.getPublishedPostForPublicPage(c.req.param('postCode'));

  if (!post) {
    return c.html(renderUnavailablePostHtml(), 404);
  }

  const canonicalUrl = buildCanonicalPostUrl(post);
  const og = buildPostOpenGraph(post, canonicalUrl);

  return c.html(renderPostShellHtml({
    og,
    canonicalUrl,
    appMount: true,
    viteOrBuiltAssets: true,
  }));
});
```

The SPA fallback must not swallow `/p/*` before this handler runs.

### 11.2 Required OG Tags

The initial HTML for a public post page must include at least:

```html
<meta property="og:title" content="Post title" />
<meta property="og:description" content="Join the discussion on Doomscrollr" />
<meta property="og:url" content="https://doomscrollr.example/p/7kF3mQx9Za/slug" />
<meta property="og:type" content="article" />
<meta property="og:image" content="https://doomscrollr.example/og/default-post.webp" />
```

Strongly recommended:

```html
<link rel="canonical" href="https://doomscrollr.example/p/7kF3mQx9Za/slug" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="description" content="Join the discussion on Doomscrollr" />
```

All OG URLs must be absolute production URLs. Relative URLs are not acceptable for share previews.

### 11.3 Preview Images by Post Kind

For text posts:

```txt
Use generic Doomscrollr preview image.
```

For external image posts:

```txt
Use the external image URL as og:image only if it passes basic validation and is publicly fetchable by WhatsApp/crawlers at render time.
Otherwise use the generic Doomscrollr preview image.
```

A valid image URL may still be bad for sharing if it blocks hotlinking, blocks crawlers, requires cookies, redirects to HTML, or times out. In those cases, the server-rendered post page must fall back to a safe generic preview image.

For YouTube posts:

```txt
Use the YouTube thumbnail as og:image.
```

Since v1 is SFW-only, any reported unsafe or suggestive-beyond-policy post can be removed rather than hidden behind mature gates.

### 11.4 Removed or Unsafe Posts

For removed posts:

```txt
Return an unavailable post page.
Use a generic safe preview.
Do not expose the original title/image if removal was for safety, privacy, abuse, or legal reasons.
Do not return a normal share preview for removed content.
```

### 11.5 Preview Acceptance Test

A v1 post page is not accepted until this works:

```bash
curl -A "WhatsApp" https://doomscrollr.example/p/7kF3mQx9Za/slug
```

The response must contain post-specific OG tags without executing JavaScript.

Also test:

```bash
curl https://doomscrollr.example/p/7kF3mQx9Za/slug
```

The normal browser response must still boot the React app.

---

## 12. Post Creation

### 12.1 Text Post

Request:

```json
{
  "postKind": "text",
  "title": "Why old forums felt better than Discord",
  "bodyText": "Here is my argument...",
  "tags": ["internet"]
}
```

### 12.2 External Image Post

Request:

```json
{
  "postKind": "external_image",
  "title": "When prod breaks on Friday",
  "imageUrl": "https://example.com/meme.jpg",
  "tags": ["programming"]
}
```

Validation:

```txt
URL must be http/https.
URL must not use private/internal IP ranges.
Content-Type should be image/jpeg, image/png, image/webp, image/gif, or image/avif when checked.
Reject SVG.
Reject unknown/binary content when detectable.
```

### 12.3 YouTube/Shorts Post

Request:

```json
{
  "postKind": "youtube",
  "title": "This short is too accurate",
  "youtubeUrl": "https://www.youtube.com/shorts/abc123"
}
```

V1 does not need the YouTube Data API unless metadata is required. It can parse the video ID and render an embed.

Supported URL forms:

```txt
https://www.youtube.com/watch?v=VIDEO_ID
https://youtu.be/VIDEO_ID
https://www.youtube.com/shorts/VIDEO_ID
```

---

## 13. Comments

V1 comments answer one question:

```txt
Do friends discuss the shared post?
```

Use flat comments first if speed matters.

If shallow replies are included:

```txt
Top-level comments can receive replies.
Replies cannot receive replies.
```

Do not build Reddit-depth comments in v1.

Comment rendering:

```txt
oldest-first or newest-first per post
simple composer
plain text only
linkify URLs client-side
no raw HTML
no Markdown in v1
```

---

## 14. Moderation

V1 moderation is small but real.

Included:

```txt
Report post
Report comment
Admin remove post
Admin restore post
Admin remove comment
Admin restore comment
Block user
SFW-only policy
Basic admin page for open reports
```

Not included:

```txt
full audited moderation queue
trust automation
age gates
ad-safety workflow
community moderation
appeals workflow
```

### 14.1 Admin Rules

Admin can:

```txt
view open reports
remove reported post
remove reported comment
dismiss report
ban/suspend user if necessary
```

A removed post should show:

```txt
This post is unavailable.
```

---

## 15. Blocking

Blocking is v1 because it protects the social loop.

User-facing behavior:

```txt
I block a user.
I stop seeing their posts.
I stop seeing their comments.
They cannot comment on my posts.
They cannot reply to my comments.
```

Technical rule:

```txt
Block filters must be pushed into feed/comment queries.
Avoid N+1 visibility checks.
```

---

## 16. Rate Limits

V1 needs basic shared-store or simple database-backed rate limits. Redis can be used, but the full policy matrix is deferred.

Minimum v1 limits:

```txt
create_post per user
create_comment per user
react/vote per user
report per user
login/auth abuse handled by Clerk
external image validation per user/IP
event ingestion per IP + anon session
```

Suggested starting values:

```txt
new user create_post: 10/day
normal user create_post: 30/day
create_comment: 60/hour
react/vote: 300/hour
report: 20/day
external image checks: 60/day
event ingestion: 600/hour per IP, 120/hour per ds_aid
```

These numbers are placeholders. Adjust based on actual abuse.

Public, unauthenticated endpoints cannot key on user id. `POST /api/events` keys on client IP and the `ds_aid` cookie. Raw IP lives only in the rate-limit store with a short TTL; it must not be persisted in `post_events` (see Section 10.2). This matters because the event endpoint is public and therefore pollutable, and the numbers it produces drive the v1 go/no-go decision.

V1 can start with hardcoded policies, but the implementation must be easy to move to Redis later.

---

## 17. Authentication and User Sync

Use Clerk for authentication.

Scrollr owns local product users.

```txt
Clerk = identity/session
Scrollr users table = username, display name, role, status, app profile
```

Sync strategy:

```txt
Clerk webhook user.created if available
Lazy upsert fallback on first authenticated API request
Doomscrollr username is local, not inherited blindly from Clerk
```

---

## 18. Frontend Scope

Use React with mobile-first layout.

Important exception: `/p/:postCode` and `/p/:postCode/:slug` require server-rendered metadata HTML from Hono before the React app boots. The frontend remains client-rendered, but post routes are not allowed to be preview-empty SPA shells.

V1 screens:

```txt
Recent feed
Post detail
Create post
Login/signup
@username profile
Tag page, if tags included
Basic admin reports page
```

Create post tabs:

```txt
Text
Image link
YouTube/Shorts
```

No upload tab in v1.

Share controls:

```txt
WhatsApp
Copy link
Native share, where supported
```

State management:

```txt
Server state: TanStack Query
Route/search state: TanStack Router
Auth state: Clerk
Local UI state: React state
No Zustand in v1
```

---

## 19. Backend Scope

Use:

```txt
Deno
Hono
Drizzle
PostgreSQL
Zod
Pino
Clerk middleware / token verification
```

Do not use Effect in v1.

Reason:

```txt
V1 is a product validation build. Plain async service functions are enough. Reconsider Effect only after the product loop is proven and workflows become complex enough to justify it.
```

---

## 20. Web and API Routes

### 20.1 Public Web Routes

```txt
GET /                         React app shell / recent feed route
GET /p/:postCode              Hono-rendered post HTML with OG tags + React mount
GET /p/:postCode/:slug        Hono-rendered post HTML with OG tags + React mount
GET /@:username               React app shell / profile route
GET /t/:tagSlug               Optional React app shell / tag route, if curated tags are included
```

The `/p/*` routes must be registered before the SPA catch-all route.

### 20.2 Public API

```txt
GET  /api/feed/recent
GET  /api/posts/:postCode
GET  /api/posts/:postCode/comments
GET  /api/users/:username
GET  /api/tags/:tagSlug/posts     optional, only if curated tags are included
POST /api/events                 funnel ingestion, public, optional auth enrichment
```

`POST /api/events` is the only write endpoint that does not require auth.

```txt
body: { eventType, postCode, metadata? }

eventType must be one of:
  post_opened
  whatsapp_share_clicked
  copy_link_clicked
  native_share_clicked

postCode is the public code; the server resolves it to post_id.
Internal database ids never cross the public boundary (see Section 6).

Server behavior:
  - run optional auth: attach actor_user_id if a valid session exists
  - read or set the ds_aid cookie; attach anon_session_id
  - reject comment_created and reaction_created (server-emitted only)
  - rate-limit by IP + ds_aid (see Section 16)
```

### 20.3 Authenticated

```txt
POST /api/posts
POST /api/posts/:postCode/reactions
POST /api/posts/:postCode/comments
POST /api/comments/:commentCode/reactions
POST /api/reports
POST /api/users/:username/block
DELETE /api/users/:username/block
```

### 20.4 Admin

```txt
GET  /api/admin/reports
POST /api/admin/posts/:postCode/remove
POST /api/admin/posts/:postCode/restore
POST /api/admin/comments/:commentCode/remove
POST /api/admin/comments/:commentCode/restore
POST /api/admin/reports/:reportId/dismiss
```

---

## 21. Validation Metrics

V1 success is not feature completeness.

V1 success is loop behavior.

Track:

```txt
created_posts
posts_per_creator
whatsapp_share_clicks
copy_link_clicks
post_opens_from_shared_links
comments_from_visitors
reactions_from_visitors
new_users_after_opening_shared_post
creators_returning_after comments/reactions
friends creating their own posts
```

Primary funnel:

```txt
create post
-> share to WhatsApp
-> friend opens
-> friend reacts/comments
-> creator returns
-> friend creates own post
```

Decision criteria should be based on whether this loop appears naturally among real users.

---

## 22. Deferred Subsystems and Earn-Back Conditions

### 22.1 BELL: Short Links

Deferred.

Earn back when:

```txt
canonical URLs are too long for sharing
share attribution becomes important
WhatsApp links need cleaner tracking
copy/share behavior is frequent enough to justify analytics
```

### 22.2 DOOM: Upload Pipeline

Deferred.

Earn back when:

```txt
users want to upload original memes
external image links are not enough
image hosting reliability becomes a problem
owned media becomes important
```

### 22.3 GIPHY/Tenor

Deferred.

Earn back when:

```txt
users frequently want GIF search inside composer
YouTube + image links are not enough
```

Pick one provider first. Do not add GIPHY and Tenor together.

### 22.4 Ranking Runs

Deferred.

Earn back when:

```txt
recent feed is insufficient
post volume is high enough that ranking matters
simple keyset or cheap hot query becomes measurably slow/wrong
```

### 22.5 Nested Reddit Comments

Deferred.

Earn back when:

```txt
threads regularly exceed shallow discussion
users ask for deeper replies
comment navigation becomes a real issue
```

Use adjacency list first. Consider ltree only if subtree queries are truly needed.

### 22.6 Ads and Monetization

Deferred.

Earn back when:

```txt
retention exists
content quality is stable
moderation is reliable
monetization can be tested without shaping the core model
```

Ad networks are pluggable later. Do not bake AdSense into v1.

### 22.7 Mature Content

Not merely deferred. Explicitly out of product scope for v1.

Reconsider only with:

```txt
legal review
payment-provider review
hosting/CDN review
moderation design
age-verification provider review
clear business reason
```

### 22.8 Communities / Friend Circles

Deferred.

Friend circles and communities are overlapping ideas. Decide later based on user behavior.

### 22.9 Search

Deferred.

Tags and profiles are enough for v1 discovery.

### 22.10 Notifications / Mentions

Deferred to a later version.

Earn back when:

```txt
users comment enough that replies need attention loops
creators return manually but need better prompts
```

### 22.11 Collections, Remixes, Meme Battles, Analytics

Deferred.

Notes:

```txt
collections: deferred
remixes: pin for exploration
meme battles: big pin for future; potentially two meme posts compete and users pick funnier
analytics: very late
```

---

## 23. Build Phases

### Phase A: Skeleton

```txt
Deno workspace
React app
Hono API
Postgres/Drizzle setup
Clerk auth
local user sync
Pino logger
Zod schemas
```

### Phase B: Posts and Feed

```txt
create text post
create external image post
create YouTube post
recent feed
post detail page
@username page
public post codes
```

### Phase C: Sharing Loop

```txt
canonical post URLs
Hono-rendered /p route with initial OG tags
Open Graph tags validated without JavaScript
WhatsApp share button
copy link button
share-click event logging
mobile post page polish
```

### Phase D: Comments and Reactions

```txt
flat or shallow comments
post reactions/votes
comment reactions/votes
transactional counters
```

### Phase E: Safety

```txt
reports
admin removal
blocking
basic rate limits
SFW-only policy enforcement
```

### Phase F: V1 Test

```txt
invite friends
seed posts
observe WhatsApp sharing
measure loop
collect feedback
```

---

## 24. V1 Acceptance Checklist

V1 is acceptable when:

```txt
A user can sign in.
A user can choose a @username.
A user can create a text post.
A user can create an external image-link post.
A user can create a YouTube/Shorts post.
A user can open /p/:postCode.
A user can share a post to WhatsApp using canonical URL.
WhatsApp shows a reasonable preview.
The /p/:postCode initial HTML contains post-specific OG tags without JavaScript.
A friend can open the shared link on mobile.
Anonymous opens and share clicks are recorded without an account.
A friend can comment or react after signing in.
The creator can see comments/reactions.
A user can block another user.
A user can report a post/comment.
An admin can remove a post/comment.
The recent feed works with keyset pagination.
No mature/NSFW content path exists.
No upload pipeline is required.
No short-link subsystem is required.
No ranking runs are required.
```

---

## 25. Roadmap Position

Doomscrollr v1 is intentionally smaller than the old v3 platform draft.

The canonical v1 -> v2 -> v3 version ladder is maintained only in [`doomscrollr_roadmap_v1_v2_v3_future.md`](../doomscrollr_roadmap_v1_v2_v3_future.md) to avoid duplicated roadmap drift.

Subsystem rule:

```txt
Earn each subsystem back with usage.
```

DOOM, BELL, suggestive content surfaces, mature/NSFW content, ads, ranking runs, communities, search, remixes, meme battles, and advanced analytics are not v1 requirements.


## 26. Final V1 Definition

Doomscrollr v1 is:

```txt
A SFW-only, mobile-first social posting experiment where users create text, external image, and YouTube/Shorts posts, share canonical post URLs to WhatsApp with reliable previews, and continue the discussion on focused post pages.
```

It is not yet:

```txt
A mature/adult UGC platform
A media upload platform
A monetized ad product
A Reddit clone
A community platform
A link-shortener product
A GIF search engine
A ranked-feed platform
```

The v1 exists to validate one thing:

```txt
Does the WhatsApp sharing loop create real engagement and return behavior?
```

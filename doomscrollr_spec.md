# Doomscrollr — Product & Technical Specification

**Status:** Draft v0.1  
**Date:** 2026-06-24  
**Temporary name:** Doomscrollr  
**Important naming note:** Doomscrollr is a working codename for the specification. It should be replaced or legally cleared before public launch.

---

## 1. Product Summary

Doomscrollr is an infinite meme, GIF, short-video, and clip feed where every post opens into its own discussion thread.

The core user experience is simple:

1. A visitor opens the homepage.
2. They see 9 posts.
3. When they scroll to the end, 9 more posts load.
4. Each post can be an uploaded image, GIF, YouTube video, YouTube Short, or GIPHY GIF.
5. Every post has its own comment section for discussion.
6. Users can vote, comment, report, and browse profiles.

Doomscrollr should feel like a modern, self-aware version of old meme sites and discussion boards: fast, chaotic, funny, and comment-driven.

---

## 2. Product Direction

### 2.1 One-line Description

Doomscrollr is an infinite meme, GIF, and short-video feed where every post becomes a discussion thread.

### 2.2 Product Promise

Fast meme discovery with better conversations than a normal comment section.

### 2.3 Core Loop

```txt
Browse feed -> open post -> react/vote -> comment -> keep scrolling
```

### 2.4 Design Principle

Doomscrollr is not just a media feed. It is a discussion layer over funny internet media.

A post may contain media from YouTube, Shorts, GIPHY, or user uploads, but Doomscrollr owns the surrounding product layer:

```txt
Post title
Author profile
Votes
Comments
Reports
Moderation state
Ad eligibility
Feed ranking
```

---

## 3. MVP Scope

### 3.1 MVP Features

The first version should include:

- Infinite homepage feed loading 9 posts at a time.
- Post detail page with media and comments.
- Auth through Clerk.
- User profiles.
- Create post from YouTube URL.
- Create post from YouTube Shorts URL.
- Create post from GIPHY selection.
- Optional uploaded images/GIFs if storage is ready.
- Comments with one-level replies.
- Meme/post votes.
- Comment votes.
- Reporting system.
- Basic moderation queue.
- Google AdSense placements on safe pages.
- Structured API logs with Pino.
- Runtime validation with Zod.

### 3.2 Deferred Features

Do not build these in v0.1:

- Subreddit-style communities.
- Deep Reddit-style nested comments.
- Direct messages.
- Complex karma economy.
- Native long-form video hosting.
- AI recommendation engine.
- Creator monetization split.
- Advanced notification system.
- Mobile apps.
- Full social graph.

---

## 4. User Roles

### 4.1 Anonymous Visitor

Can:

- Browse public feed.
- Open post detail pages.
- Read comments.
- View public profiles.

Cannot:

- Create posts.
- Vote.
- Comment.
- Report.
- Save posts.

### 4.2 Authenticated User

Can:

- Create posts.
- Comment.
- Reply to comments.
- Vote on posts.
- Vote on comments.
- Report posts/comments.
- Edit own profile.
- Delete own posts/comments, subject to moderation rules.

### 4.3 Moderator

Can:

- Review reports.
- Hide posts.
- Remove comments.
- Mark content as ad-unsafe.
- Ban or restrict users.
- Dismiss invalid reports.

### 4.4 Admin

Can:

- Manage moderators.
- Configure global moderation rules.
- Configure ad safety rules.
- View operational dashboards.
- Manage system-level settings.

---

## 5. Core Domain Model

### 5.1 Main Concepts

```txt
User
Post
Media Asset
Comment
Vote
Report
Moderation Action
Ad Eligibility
```

### 5.2 Product Language

Although the project is meme-oriented, use `post` internally where possible. This avoids locking the system to one media type.

A post can contain:

```txt
Uploaded image
Uploaded GIF
Uploaded video later
YouTube video
YouTube Short
GIPHY GIF
Tenor GIF later
```

---

## 6. Technical Stack

### 6.1 Runtime and Monorepo

- Runtime: Deno.
- Monorepo: Deno workspace.
- Package management: Deno native imports plus npm specifiers where needed.

### 6.2 Frontend

- React.
- Vite.
- TanStack Router.
- TanStack Query.
- TailwindCSS.
- shadcn/ui.
- Clerk React SDK.
- AdSense frontend slots.

### 6.3 Backend

- Hono.
- Zod.
- Pino.
- Clerk auth verification.
- Drizzle ORM.
- PostgreSQL.

### 6.4 Media Integrations

- YouTube videos.
- YouTube Shorts.
- GIPHY GIF search/selection.
- Tenor later.
- Object storage later for user uploads.

### 6.5 State Management

Do not add Zustand in v0.1.

Use:

```txt
TanStack Query   -> server/cache state
TanStack Router  -> URL/search state
Clerk            -> auth state
React state      -> local UI state
```

Zustand may be added later for global client-only state such as a persistent upload composer, media player state, or UI preferences.

---

## 7. Monorepo Structure

```txt
doomscrollr/
  deno.json
  deno.lock
  .env.example
  README.md

  apps/
    web/
      deno.json
      index.html
      src/
        main.tsx
        app/
        routes/
        components/
        features/
          feed/
          post/
          comments/
          auth/
          ads/
          upload/
          moderation/

    api/
      deno.json
      src/
        main.ts
        app.ts
        lib/
          env.ts
          logger.ts
          validation.ts
          errors.ts
        middleware/
          request-logger.ts
          auth.ts
          error-handler.ts
          rate-limit.ts
        routes/
          posts.routes.ts
          comments.routes.ts
          media.routes.ts
          gifs.routes.ts
          moderation.routes.ts
          users.routes.ts
        services/
          youtube.service.ts
          giphy.service.ts
          ads.service.ts
          moderation.service.ts
        db/
          client.ts

  packages/
    shared/
      deno.json
      src/
        schemas/
          post.schema.ts
          media.schema.ts
          comment.schema.ts
          user.schema.ts
          pagination.schema.ts
          report.schema.ts
        types.ts
        constants.ts
        errors.ts

    database/
      deno.json
      src/
        schema.ts
        migrations/

    config/
      deno.json
      src/
        env.ts
```

---

## 8. Frontend Routes

```txt
/                     Home feed
/recent               Recent posts
/top                  Top posts
/post/:postId         Post detail + comments
/upload               Create post
/@:username           User profile
/login                Login
/register             Register
/settings             Account settings
/moderation           Moderation queue
```

### 8.1 Home Feed

The homepage displays 9 posts initially.

When the user reaches the end of the page, the next batch of 9 posts loads.

The feed must use cursor pagination, not page-number pagination.

Bad:

```txt
GET /api/posts?page=10
```

Good:

```txt
GET /api/posts?limit=9&cursor=abc123
```

### 8.2 Post Detail Page

The post detail page displays:

- Media.
- Title.
- Author.
- Vote controls.
- Comment count.
- Share button.
- Comment thread.
- Report button.
- Related posts later.

### 8.3 Upload Page

The upload page should use tabs:

```txt
Upload
YouTube / Shorts URL
GIF Search
```

For v0.1, prioritize:

```txt
YouTube URL
YouTube Shorts URL
GIPHY Search
```

---

## 9. Backend API

### 9.1 Public Routes

```txt
GET /health
GET /api/posts
GET /api/posts/:id
GET /api/posts/:id/comments
GET /api/users/:username
GET /api/users/:username/posts
GET /api/gifs/search
GET /api/gifs/trending
```

### 9.2 Authenticated Routes

```txt
POST   /api/posts
POST   /api/posts/:id/vote
DELETE /api/posts/:id/vote
POST   /api/posts/:id/comments
POST   /api/comments/:id/replies
POST   /api/comments/:id/vote
DELETE /api/comments/:id
POST   /api/reports
```

### 9.3 Moderation Routes

```txt
GET  /api/moderation/reports
POST /api/moderation/reports/:id/dismiss
POST /api/moderation/reports/:id/action
POST /api/moderation/posts/:id/hide
POST /api/moderation/comments/:id/remove
POST /api/moderation/users/:id/restrict
POST /api/moderation/users/:id/ban
```

---

## 10. API Response Patterns

### 10.1 Feed Response

```json
{
  "items": [
    {
      "id": "post_123",
      "title": "When production breaks on Friday",
      "score": 421,
      "commentCount": 32,
      "createdAt": "2026-06-24T10:30:00Z",
      "author": {
        "id": "user_123",
        "username": "lucas",
        "avatarUrl": "https://example.com/avatar.png"
      },
      "media": {
        "provider": "youtube",
        "mediaType": "short",
        "providerMediaId": "abc123",
        "thumbnailUrl": "https://example.com/thumb.jpg",
        "embedUrl": "https://www.youtube.com/embed/abc123",
        "aspectRatio": "portrait"
      }
    }
  ],
  "nextCursor": "cursor_456"
}
```

### 10.2 Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body.",
    "issues": [
      {
        "path": "title",
        "message": "Title must contain at least 3 characters."
      }
    ]
  }
}
```

---

## 11. Zod Validation

Zod is the canonical runtime validation layer.

Use Zod for:

- Request body validation.
- Query string validation.
- Route param validation.
- Environment variables.
- Provider response normalization.
- Shared frontend/backend DTOs.

Do not use Zod as a replacement for:

- Database constraints.
- Authorization checks.
- Business rules that require database state.
- Moderation policy.

### 11.1 Media Schema

```ts
import { z } from "zod";

export const MediaProviderSchema = z.enum([
  "upload",
  "youtube",
  "giphy",
  "tenor",
]);

export const MediaTypeSchema = z.enum([
  "image",
  "gif",
  "video",
  "short",
]);

export const AspectRatioSchema = z.enum([
  "square",
  "landscape",
  "portrait",
  "unknown",
]);

export const CreatePostSourceSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("upload"),
    uploadId: z.string().min(1),
    mediaType: z.enum(["image", "gif", "video"]),
  }),
  z.object({
    provider: z.literal("youtube"),
    url: z.string().url(),
  }),
  z.object({
    provider: z.literal("giphy"),
    providerMediaId: z.string().min(1),
  }),
  z.object({
    provider: z.literal("tenor"),
    providerMediaId: z.string().min(1),
  }),
]);
```

### 11.2 Post Schema

```ts
import { z } from "zod";
import { CreatePostSourceSchema } from "./media.schema.ts";

export const CreatePostSchema = z.object({
  title: z.string().min(3).max(160).trim(),
  source: CreatePostSourceSchema,
  tags: z.array(
    z.string()
      .min(1)
      .max(32)
      .regex(/^[a-zA-Z0-9_-]+$/),
  ).max(8).default([]),
});

export const PostFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(9),
  cursor: z.string().optional(),
  sort: z.enum(["hot", "recent", "top"]).default("hot"),
});
```

### 11.3 Comment Schema

```ts
import { z } from "zod";

export const CreateCommentSchema = z.object({
  body: z.string().min(1).max(2000).trim(),
  parentId: z.string().optional(),
});
```

---

## 12. Logging with Pino

Pino is the canonical backend logger.

Logging rules:

- Logs must be structured JSON.
- Every request must have a request ID.
- Logs must include method, path, status, and duration.
- Sensitive fields must be redacted.
- Business events should use explicit event names.

### 12.1 Log Levels

```txt
debug -> development diagnostics
info  -> normal application events
warn  -> suspicious but handled situations
error -> failed operation
fatal -> process cannot continue
```

### 12.2 Example Events

```ts
log.info({
  event: "post_created",
  postId,
  userId,
  provider: input.source.provider,
});

log.warn({
  event: "post_reported",
  postId,
  reporterId,
  reason,
});

log.error({
  event: "giphy_api_failed",
  query,
  status,
});
```

### 12.3 Redacted Fields

Redact:

```txt
Authorization headers
Cookies
Clerk tokens
Session IDs
Email addresses where not needed
API keys
```

---

## 13. Authentication with Clerk

Clerk owns identity.

Doomscrollr owns product-specific user data.

### 13.1 Local Users Table

```ts
users {
  id
  clerk_user_id
  username
  display_name
  avatar_url
  role
  status
  created_at
  updated_at
}
```

### 13.2 Auth Rules

Anonymous users can browse.

Authenticated users can:

- Create posts.
- Comment.
- Vote.
- Report.
- Save posts later.

The API must verify Clerk auth server-side. The frontend auth state is not trusted as authorization.

---

## 14. Media Provider Strategy

### 14.1 Normalized Media Model

All providers normalize into `media_assets`.

```ts
media_assets {
  id
  provider
  media_type
  provider_media_id
  original_url
  embed_url
  thumbnail_url
  preview_url
  width
  height
  duration_seconds
  aspect_ratio
  attribution_label
  attribution_url
  metadata_json
  status
  created_at
}
```

### 14.2 YouTube and Shorts

Accepted URL shapes:

```txt
https://www.youtube.com/watch?v=VIDEO_ID
https://youtu.be/VIDEO_ID
https://www.youtube.com/shorts/VIDEO_ID
```

Normalize all of them into:

```ts
{
  provider: "youtube",
  providerMediaId: "VIDEO_ID",
  mediaType: "video" | "short"
}
```

Homepage cards should show thumbnails, not full iframes.

The full YouTube player should load on the post detail page or when the user explicitly plays the media.

### 14.3 GIPHY

The app should provide GIF search in the create-post flow.

The backend should proxy GIPHY API calls so provider keys stay private.

GIPHY media must retain provider attribution according to provider requirements.

### 14.4 Uploaded Media

Uploaded media can be added in v0.1 only if storage and moderation are ready.

Upload requirements:

- MIME type validation.
- File size limits.
- Image dimensions limit.
- Duplicate hash detection.
- Malware/scam prevention later.
- Object storage backend.
- Thumbnail generation.

---

## 15. Ads and Monetization

### 15.1 Monetization Product

Use Google AdSense for publisher-side ads.

Do not confuse this with Google Ads, which is primarily for advertisers buying campaigns.

### 15.2 Ad Placement Strategy

Ads should be represented as feed items, not random DOM insertions.

```ts
type FeedItem =
  | { type: "post"; post: Post }
  | { type: "ad"; placement: "feed_inline"; slot: string };
```

Initial placement:

```txt
9 posts
ad
9 posts
ad
9 posts
ad
```

On the post detail page:

```txt
Media
Title/votes
Comments
Ad below safe content block or desktop sidebar
Related posts later
```

### 15.3 Ad Safety

Ads must not show on unsafe or unreviewed content.

Add monetization fields:

```ts
posts {
  monetization_status // enabled, disabled, pending_review, unsafe
  ad_safety_score
}
```

Do not show ads when:

- Post is hidden, removed, or pending review.
- Post is reported for serious policy reasons.
- Comments contain unsafe content.
- Moderator has disabled monetization.
- Media provider metadata indicates unsafe content.

---

## 16. Moderation

Moderation is required from the first release.

### 16.1 Report Reasons

```txt
spam
harassment
nudity
hate
violent_content
copyright_complaint
misleading_title
low_quality
other
```

### 16.2 Report Table

```ts
reports {
  id
  reporter_id
  target_type
  target_id
  reason
  details
  status
  created_at
  reviewed_at
  reviewed_by
}
```

### 16.3 Moderation Actions

```ts
moderation_actions {
  id
  moderator_id
  target_type
  target_id
  action
  reason
  metadata_json
  created_at
}
```

Supported actions:

```txt
dismiss_report
hide_post
remove_post
remove_comment
mark_ad_unsafe
restrict_user
ban_user
restore_post
restore_comment
```

---

## 17. Database Model

### 17.1 Tables

```txt
users
posts
media_assets
comments
post_votes
comment_votes
reports
moderation_actions
tags
post_tags
saved_posts
follows_later
```

### 17.2 Posts

```ts
posts {
  id
  author_id
  media_asset_id
  title
  slug
  score
  upvote_count
  downvote_count
  comment_count
  status
  monetization_status
  ad_safety_score
  created_at
  updated_at
}
```

### 17.3 Comments

```ts
comments {
  id
  post_id
  author_id
  parent_id
  body
  score
  status
  moderation_status
  created_at
  updated_at
}
```

### 17.4 Votes

```ts
post_votes {
  id
  user_id
  post_id
  value
  created_at
}

comment_votes {
  id
  user_id
  comment_id
  value
  created_at
}
```

### 17.5 Important Constraints

```txt
unique(users.clerk_user_id)
unique(users.username)
unique(post_votes.user_id, post_votes.post_id)
unique(comment_votes.user_id, comment_votes.comment_id)
index(posts.created_at)
index(posts.score)
index(posts.status)
index(posts.monetization_status)
index(comments.post_id)
index(comments.parent_id)
index(reports.status)
```

---

## 18. Feed Ranking

### 18.1 MVP Feed

Start with:

```txt
recent
hot
top
```

### 18.2 Simple Hot Formula

```txt
score = upvotes - downvotes
hot_score = log10(max(score, 1)) - age_in_hours / 12
```

This is deterministic, understandable, and good enough for v0.1.

### 18.3 Cursor Pagination

Feed endpoints must use cursor pagination.

Example:

```txt
GET /api/posts?limit=9&sort=hot&cursor=abc123
```

The cursor should encode the ordering fields needed for the next page.

For recent:

```txt
created_at + id
```

For hot:

```txt
hot_score + id
```

For top:

```txt
score + id
```

---

## 19. Frontend Components

### 19.1 Core Components

```txt
AppLayout
Header
FeedPage
FeedGrid
FeedCard
PostCard
MediaRenderer
PostDetailPage
CommentThread
CommentComposer
VoteButton
ReportDialog
UploadComposer
GifPicker
YouTubeUrlResolver
AdSlot
ModerationQueue
```

### 19.2 Media Renderer

```tsx
function MediaRenderer({ media }: { media: MediaAsset }) {
  switch (media.provider) {
    case "upload":
      return <UploadedMedia media={media} />;
    case "youtube":
      return <YouTubeMedia media={media} />;
    case "giphy":
      return <GifMedia media={media} />;
    case "tenor":
      return <GifMedia media={media} />;
  }
}
```

### 19.3 Feed Performance

Homepage feed should:

- Render thumbnails/previews only.
- Lazy-load media.
- Avoid loading multiple YouTube iframes at once.
- Virtualize later if performance requires it.
- Use TanStack Query infinite queries.
- Use IntersectionObserver for scroll loading.

---

## 20. Security and Abuse Prevention

### 20.1 Required Controls

- Rate limit post creation.
- Rate limit comments.
- Rate limit votes.
- Rate limit reports.
- Validate all input with Zod.
- Escape/render comments safely.
- Block dangerous HTML in comments.
- Restrict allowed media providers.
- Verify Clerk auth server-side.
- Log suspicious behavior.

### 20.2 Spam Controls

- New users may have stricter limits.
- Repeated reports can trigger review.
- Duplicate post detection should be considered.
- Suspicious accounts can be restricted.

---

## 21. Testing Strategy

### 21.1 Backend Tests

Use Deno test for:

- Zod schemas.
- URL normalization.
- YouTube ID extraction.
- GIPHY response normalization.
- Feed cursor behavior.
- Voting rules.
- Comment creation.
- Authorization checks.
- Moderation actions.

### 21.2 Frontend Tests

Test:

- Feed rendering.
- Infinite scroll trigger.
- Post detail rendering.
- Authenticated vs anonymous UI.
- Upload composer validation.
- Comment composer behavior.
- AdSlot visibility rules.

### 21.3 Integration Tests

Test:

- Create post from YouTube URL.
- Create post from GIPHY selection.
- Comment on post.
- Vote on post.
- Report post.
- Moderator removes post.
- Ads do not render on unsafe posts.

---

## 22. Environment Variables

```txt
APP_ENV=development
PORT=8000
DATABASE_URL=postgres://...
CLERK_SECRET_KEY=...
VITE_CLERK_PUBLISHABLE_KEY=...
YOUTUBE_API_KEY=...
GIPHY_API_KEY=...
ADSENSE_CLIENT_ID=...
LOG_LEVEL=debug
```

Use Zod to validate environment variables at startup.

---

## 23. Roadmap

### Phase 1 — Monorepo Foundation

- Create Deno workspace.
- Add React web app.
- Add Hono API.
- Add shared package.
- Add Zod schemas.
- Add Pino logging.
- Add health endpoint.

### Phase 2 — Static Feed

- Build 3x3 feed UI.
- Add infinite scroll with mock data.
- Add post detail page with mock comments.

### Phase 3 — Database and Real Feed

- Add PostgreSQL.
- Add Drizzle schema.
- Add posts and media tables.
- Implement cursor pagination.
- Seed test posts.

### Phase 4 — Clerk Auth

- Add Clerk to React.
- Add Clerk verification to API.
- Create local user sync.
- Protect create/comment/vote routes.

### Phase 5 — Media Providers

- Add YouTube URL resolver.
- Add YouTube Shorts support.
- Add GIPHY search endpoint.
- Normalize media assets.

### Phase 6 — Posting

- Create post composer.
- Create post API.
- Support YouTube and GIPHY posts.
- Add user profile post list.

### Phase 7 — Comments and Votes

- Add comments.
- Add one-level replies.
- Add post votes.
- Add comment votes.
- Add optimistic UI with TanStack Query.

### Phase 8 — Moderation

- Add reports.
- Add moderation queue.
- Add hide/remove actions.
- Add ad safety flags.

### Phase 9 — Ads

- Add AdSense slots.
- Add feed ad items.
- Add ad visibility rules.
- Disable ads on unsafe content.

### Phase 10 — Ranking

- Add recent feed.
- Add top feed.
- Add hot feed.
- Add basic tag pages later.

---

## 24. Open Questions

1. Should uploaded images/GIFs be part of v0.1, or should v0.1 only support YouTube and GIPHY?
2. Should comments support markdown, plain text, or limited formatting?
3. Should downvotes exist, or should the app use only upvotes/reactions?
4. Should usernames be globally unique and immutable?
5. Should posts require moderator review before ads appear?
6. Should NSFW content be banned completely or allowed but non-monetized?
7. Should the project support Portuguese and English from the beginning?
8. What is the final public brand name after replacing the Doomscrollr codename?

---

## 25. Final MVP Definition

The first successful release of Doomscrollr should prove this loop:

```txt
A user can open the homepage, scroll through batches of 9 posts, open a meme/short/GIF, read the discussion, sign in, comment, vote, and continue scrolling.
```

If that loop is fast, funny, and reliable, the product has a foundation.

Everything else is secondary.

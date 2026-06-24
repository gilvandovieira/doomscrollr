# Doomscrollr — Product & Technical Specification v2.2

**Status:** Draft v2.2 / ranking, rating, and consistency correction pass  
**Date:** 2026-06-24  
**Temporary name:** Doomscrollr  
**Project type:** Infinite meme, GIF, short-video, and discussion feed  
**Important naming note:** Doomscrollr is a working codename only. It should be replaced or legally cleared before public launch.

---

## 1. Executive Summary

Doomscrollr is an infinite meme, GIF, short-video, and clip feed where every post opens into its own discussion thread.

The product combines:

- A fast 9-at-a-time infinite feed.
- A post detail page with comments and replies.
- External media providers such as YouTube, YouTube Shorts, and GIPHY.
- Clerk authentication.
- A Doomscrollr-local user/profile system.
- Google AdSense only on safe SFW surfaces.
- A future paid tier focused on ad removal and quality-of-life features.
- Optional mature-content support only behind login, age verification, and explicit opt-in.
- Strong moderation boundaries.

The core product principle:

```txt
Every post is a discussion object.
The media starts the joke.
The comments continue it.
```

---

## 2. v2.2 Correction Summary

This version keeps the v2.1 corrections and adds a second architecture correction pass focused on SQL semantics, ranking-run pagination, ad-safety counters, and operational invariants.

### 2.1 Fixed: Rating vs Moderation Outcome

`prohibited` is not a content rating.

Content rating describes the intended visibility class:

```txt
sfw
suggestive
mature
```

Moderation status describes whether the content can exist publicly:

```txt
draft
pending_review
published
hidden
removed
```

Prohibited content is represented as:

```txt
status = removed
removal_reason = prohibited_content
```

This prevents illegal states such as:

```txt
published + prohibited
```

### 2.2 Fixed: SQL Rating Ordering

`content_rating` must not be a plain `varchar` with a CHECK constraint.

The database uses a real Postgres enum declared in visibility order:

```sql
CREATE TYPE post_content_rating AS ENUM ('sfw', 'suggestive', 'mature');
```

This makes SQL comparisons such as:

```sql
posts.content_rating <= :effective_content_ceiling
```

match the product ladder instead of lexicographic string order.

### 2.3 Fixed: Suggestive vs Mature Collapse

`sfw`, `suggestive`, and `mature` have distinct visibility gates.

```txt
SFW:
  Visible to everyone.

Suggestive:
  Visible to logged-in users who explicitly opt into suggestive content.
  Does not require formal age verification.

Mature:
  Visible only to logged-in users who are age-verified and explicitly opt into mature content.
```

Mature visibility implies suggestive visibility. The derived scalar ceiling is canonical.

### 2.4 Fixed: Feed Query Rating Model

The previous `sfw | all_allowed` model is removed.

Feed queries now use:

```txt
maxRating = sfw | suggestive | mature
```

The server clamps the requested value against the viewer's actual entitlement.

### 2.5 Fixed: Hot Feed Pagination

The app must not cursor-paginate directly on a continuously mutating `hot_score`.

Hot/top feeds use materialized per-ceiling ranking runs:

```txt
feed_rank_runs
feed_rank_items
```

The cursor references:

```txt
rank_run_id + after_rank
```

not a live score.

### 2.6 Fixed: Ranking Run Edge Cases

Ranking runs are explicitly generated per content ceiling:

```txt
hot/sfw
hot/suggestive
hot/mature
```

Read-time filtering remains as a safety guard for posts that changed status/rating after the run was generated. Feed reads must over-fetch, filter, return up to the requested count, and set the next cursor to the rank of the last returned item.

Ranking runs also have a retention window so cleanup cannot delete a run while active cursors may still point to it.

### 2.7 Fixed: Ad Gating Source of Truth

The `posts` table does not carry multiple drifting fields such as:

```txt
monetization_status
ads_allowed
ad_safety_score
```

Ad eligibility is derived by a single function from canonical inputs:

```txt
post.status
post.content_rating
post.manual_ad_blocked_at
post.unsafe_comment_count
post.pending_review_comment_count
media.provider_safety_status
viewer.plan
page context
```

Pending-review comments block ads until reviewed.

### 2.8 Fixed: Embed Safety Drift

External media can change after initial classification. The spec requires:

- Provider safety mapping.
- Conservative defaults.
- No ads on unverified fresh embeds.
- Periodic provider re-checks.
- Reclassification when provider metadata, thumbnails, or availability change.

### 2.9 Fixed: User Preference and Age Verification Duplication

Mature and suggestive settings live only in `user_preferences`.

Age verification lives only in `age_verifications`.

`users` does not duplicate:

```txt
age_verified_at
mature_content_enabled
mature_content_opt_in_at
mature_content_opt_out_at
```

The active age-verification rule is explicit and protected by a partial unique index over an `is_active` flag.

### 2.10 Fixed: Operational Consistency

This version explicitly defines:

- One-level reply enforcement.
- Transactional counter updates.
- Vote flip and vote removal deltas.
- Guards against commenting/voting on non-published posts.
- Redis-backed production rate limits.
- Plain-text comments with linkification instead of raw HTML.
- Clerk webhook sync plus lazy upsert fallback.

---

## 3. Product Direction

### 3.1 One-line Description

Doomscrollr is an infinite meme, GIF, and short-video feed where every post becomes a discussion thread.

### 3.2 Product Promise

Fast meme discovery with better conversations than a normal comment section.

### 3.3 Core Loop

```txt
Browse feed -> open post -> react/vote -> comment -> keep scrolling
```

### 3.4 Product Identity

Doomscrollr should feel:

- Fast.
- Chaotic.
- Funny.
- Self-aware.
- Internet-native.
- Discussion-friendly.
- Looser than a corporate social network.
- Safer and better moderated than a random anonymous image board.

### 3.5 What Doomscrollr Is Not

Doomscrollr v1 is not:

- A Reddit clone.
- A 9GAG clone.
- A YouTube Shorts clone.
- A porn/adult-content platform.
- A creator monetization platform.
- A full social graph product.
- A mature-content subscription product.

The app should prove one thing first:

```txt
People can scroll funny media forever, open individual posts, and have good discussions under them.
```

---

## 4. MVP Scope

### 4.1 MVP Features

The first production-capable release should include:

- Infinite homepage feed loading 9 posts at a time.
- Stable cursor pagination for recent feed.
- Post detail page with media and comments.
- Auth through Clerk.
- Local product user profile linked to Clerk identity.
- Create post from YouTube URL.
- Create post from YouTube Shorts URL.
- Create post from GIPHY selection.
- Comments with one-level replies.
- Post votes.
- Comment votes.
- Report system.
- Basic moderation queue.
- Google AdSense placements only on eligible SFW pages.
- Runtime validation with Zod.
- Structured API logging with Pino.
- Deno monorepo using React frontend and Hono API.

### 4.2 Deferred Features

Do not build these in v1:

- Subreddit-style communities.
- Deep Reddit-style nested comments.
- Direct messages.
- Complex karma economy.
- Native long-form video hosting.
- AI recommendation engine.
- Creator monetization split.
- Advanced notification system.
- Mobile apps.
- Mature-content launch unless compliance and moderation operations are ready.
- Hot feed until materialized ranking runs are implemented.

### 4.3 Mature Content Status

Mature content is an architectural capability, not a growth hook.

The MVP may include the database fields and visibility logic needed for future mature-content support, but the first public launch should stay SFW unless moderation and compliance operations are deliberately staffed.

---

## 5. Technical Stack

### 5.1 Monorepo

```txt
Deno workspace
```

### 5.2 Frontend

```txt
React
Vite
TanStack Router
TanStack Query
TailwindCSS
shadcn/ui
Clerk React SDK
```

### 5.3 Backend

```txt
Deno
Hono
Zod
Pino
Drizzle
PostgreSQL
Clerk backend verification
Redis for production rate limits
```

### 5.4 External Services

```txt
Clerk              -> identity/auth
YouTube embeds     -> video/short media source
GIPHY              -> GIF search/source
AdSense            -> ads on eligible SFW pages only
Redis              -> production rate limits
Object storage     -> future uploads
```

---

## 6. Monorepo Structure

```txt
doomscrollr/
  deno.json
  deno.lock
  .env.example

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
          ad-eligibility.ts
          visibility.ts
        middleware/
          auth.ts
          request-logger.ts
          error-handler.ts
          rate-limit.ts
        routes/
          posts.routes.ts
          comments.routes.ts
          media.routes.ts
          gifs.routes.ts
          moderation.routes.ts
          auth-webhooks.routes.ts
        services/
          posts.service.ts
          comments.service.ts
          votes.service.ts
          ranking.service.ts
          provider-safety.service.ts
          clerk-sync.service.ts
        jobs/
          refresh-provider-media.job.ts
          build-feed-rankings.job.ts
          reconcile-counters.job.ts
        db/
          client.ts
          schema.ts

  packages/
    shared/
      deno.json
      src/
        schemas/
          content.schema.ts
          post.schema.ts
          comment.schema.ts
          media.schema.ts
          user.schema.ts
          pagination.schema.ts
        types.ts
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

## 7. Domain Model

### 7.1 Core Objects

```txt
User
User Preferences
Age Verification
Post
Media Asset
Comment
Vote
Report
Moderation Action
Feed Ranking Run
Feed Ranking Item
```

### 7.2 Core Rule

A post is the discussion object.

Media is attached to the post.

```txt
Post = title + author + comments + votes + moderation + one media asset
Media Asset = upload/youtube/giphy/tenor-later renderable source
```

---

## 8. Content Rating and Moderation Model

### 8.1 Content Rating Enum

`content_rating` is only a visibility/content-classification tier.

```ts
export const ContentRatingSchema = z.enum([
  "sfw",
  "suggestive",
  "mature",
]);
```

Definitions:

```txt
sfw:
  Normal public content.
  Eligible for ads if the rest of the page is safe.

suggestive:
  Sexual jokes, revealing clothing, adult humor, mild innuendo.
  No explicit nudity.
  Logged-in opt-in required.
  Ads disabled by derived ad gate.

mature:
  Adult nudity, including visible breasts.
  Logged-in + age-verified + explicit mature opt-in required.
  No AdSense.
```

### 8.2 Moderation Status Enum

`status` describes publication/moderation lifecycle.

```ts
export const PostStatusSchema = z.enum([
  "draft",
  "pending_review",
  "published",
  "hidden",
  "removed",
]);
```

Definitions:

```txt
draft:
  Created but not submitted/published.

pending_review:
  Awaiting moderation or provider-safety check.

published:
  Visible according to rating and viewer eligibility.

hidden:
  Temporarily hidden from normal feeds.
  May be restored.

removed:
  Removed as a moderation outcome.
  Not publicly visible.
```

### 8.3 Removal Reason Enum

`removal_reason` exists only when content is removed.

```ts
export const RemovalReasonSchema = z.enum([
  "prohibited_content",
  "sexual_content_violation",
  "minor_safety",
  "non_consensual_content",
  "illegal_content",
  "spam",
  "harassment",
  "hate_or_extremism",
  "copyright",
  "malware_or_phishing",
  "platform_abuse",
  "other",
]);
```

Prohibited content is represented as:

```txt
status = removed
removal_reason = prohibited_content
```

Not as:

```txt
content_rating = prohibited
```

### 8.4 Prohibited Content

The following is not allowed:

```txt
pornography
explicit sexual acts
graphic nudity for sexual gratification
non-consensual sexual content
leaked sexual images
minors or teen/lolita sexual themes
sexual exploitation
illegal content
malware/phishing
terrorist/extremist material
```

These are moderation outcomes, not visibility tiers.

### 8.5 Database Invariants

The database must enforce rating/status invariants directly.

`content_rating` must be a real Postgres enum, not a `varchar` checked by string values.

```sql
CREATE TYPE post_content_rating AS ENUM ('sfw', 'suggestive', 'mature');
CREATE TYPE post_status AS ENUM ('draft', 'pending_review', 'published', 'hidden', 'removed');
CREATE TYPE removal_reason AS ENUM (
  'prohibited_content',
  'sexual_content_violation',
  'minor_safety',
  'non_consensual_content',
  'illegal_content',
  'spam',
  'harassment',
  'hate_or_extremism',
  'copyright',
  'malware_or_phishing',
  'platform_abuse',
  'other'
);
```

The enum declaration order is part of the product model:

```txt
sfw < suggestive < mature
```

This makes SQL comparisons semantically valid:

```sql
posts.content_rating <= :effective_content_ceiling::post_content_rating
```

Never implement rating comparison against plain text. Lexicographic ordering would be wrong.

Other invariants:

```sql
CHECK (
  (status = 'removed' AND removal_reason IS NOT NULL)
  OR
  (status <> 'removed' AND removal_reason IS NULL)
)
```

All public feed queries must include:

```sql
WHERE posts.status = 'published'
```

Moderation routes may read non-published posts, but only for moderators/admins.

---

## 9. Visibility Model

### 9.1 Viewer Content Ceiling

Each viewer has an effective content ceiling.

```txt
Anonymous:
  sfw

Authenticated, default preferences:
  sfw

Authenticated + suggestive opt-in:
  suggestive

Authenticated + age-verified + mature opt-in:
  mature

Paid:
  no automatic effect on content ceiling
```

Paid status does not unlock mature content by itself.

### 9.2 Preferences and Content Ceiling Derivation

Suggestive and mature settings live in `user_preferences`.

```txt
show_suggestive_content
suggestive_content_opt_in_at
suggestive_content_opt_out_at
mature_content_enabled
mature_content_opt_in_at
mature_content_opt_out_at
```

Age verification lives in `age_verifications` only.

The scalar `contentCeiling` is derived, never independently stored as mutable user state.

```ts
type ContentRating = "sfw" | "suggestive" | "mature";

type UserPreferences = {
  showSuggestiveContent: boolean;
  matureContentEnabled: boolean;
};

type AgeVerificationState = {
  isAgeVerified: boolean;
};

export function deriveContentCeiling(
  preferences: UserPreferences | null,
  age: AgeVerificationState,
): ContentRating {
  if (!preferences) return "sfw";

  if (preferences.matureContentEnabled && age.isAgeVerified) {
    return "mature";
  }

  if (preferences.showSuggestiveContent) {
    return "suggestive";
  }

  return "sfw";
}
```

Product rule:

```txt
mature implies suggestive
```

There is no supported state where a user sees mature content but not suggestive content. The two booleans are UI/input preferences; the derived ceiling is the authorization value used by feeds and post visibility.

### 9.3 Visibility Function

Moderation visibility must be checked before public visibility rules.

```ts
type VisibilityContext = "public" | "moderation";

type Viewer = {
  id?: string;
  role?: "user" | "moderator" | "admin";
  contentCeiling: "sfw" | "suggestive" | "mature";
};

type PostForVisibility = {
  status: "draft" | "pending_review" | "published" | "hidden" | "removed";
  contentRating: "sfw" | "suggestive" | "mature";
};

function isModerator(viewer: Viewer): boolean {
  return viewer.role === "moderator" || viewer.role === "admin";
}

function ratingRank(rating: "sfw" | "suggestive" | "mature"): number {
  if (rating === "sfw") return 0;
  if (rating === "suggestive") return 1;
  return 2;
}

export function canViewPost(
  viewer: Viewer,
  post: PostForVisibility,
  context: VisibilityContext,
): boolean {
  if (context === "moderation") {
    return isModerator(viewer);
  }

  if (post.status !== "published") {
    return false;
  }

  return ratingRank(post.contentRating) <= ratingRank(viewer.contentCeiling);
}
```

This means moderators can view removed/prohibited posts through moderation routes, while public routes never leak them.

### 9.4 Feed Behavior

Default homepage:

```txt
SFW only
```

Suggestive-enabled authenticated user:

```txt
SFW + suggestive
```

Mature-enabled authenticated age-verified user:

```txt
SFW + suggestive + mature
```

Mature content must not appear in:

```txt
anonymous feeds
public SEO pages
default user feeds
ad-supported placements
```

---

## 10. Paid Tier and Monetization

### 10.1 Paid Tier Positioning

The paid tier should be positioned as:

```txt
Ad-free browsing
Better feed controls
Saved collections
Profile cosmetics
Higher posting/upload limits
Quality-of-life features
```

It must not be positioned as:

```txt
Pay to unlock NSFW
```

### 10.2 Paid Tier Does Not Replace Age Gating

Paid users still need:

```txt
login
age verification
mature opt-in
```

before seeing mature content.

### 10.3 Ads and Paid Users

Actual ad rendering checks two things:

```txt
1. Is the page eligible for ads?
2. Is the viewer supposed to see ads?
```

A paid user may visit an ad-eligible SFW page, but ads are not rendered for that paid viewer.

---

## 11. Ad Eligibility Model

### 11.1 Canonical Rule

Do not store multiple drifting ad fields on `posts`.

Do not use:

```txt
posts.monetization_status
posts.ads_allowed
posts.ad_safety_score
```

Instead, derive ad eligibility from canonical state.

### 11.2 Canonical Inputs

```txt
post.status
post.content_rating
post.manual_ad_blocked_at
post.unsafe_comment_count
post.pending_review_comment_count
media.provider_safety_status
viewer.plan
page context
```

`manual_ad_blocked_at` is not the ad decision itself. It is an explicit moderator/admin override input.

### 11.3 Derived Function

```ts
type AdEligibilityInput = {
  post: {
    status: "draft" | "pending_review" | "published" | "hidden" | "removed";
    contentRating: "sfw" | "suggestive" | "mature";
    manualAdBlockedAt: Date | null;
    unsafeCommentCount: number;
    pendingReviewCommentCount: number;
  };
  media: {
    providerSafetyStatus: "pending" | "verified_sfw" | "suggestive" | "mature" | "unsafe" | "unavailable";
  };
  page: {
    surface: "feed" | "post_detail" | "profile";
  };
};

export function deriveAdEligibility(input: AdEligibilityInput) {
  const { post, media } = input;

  if (post.status !== "published") {
    return { allowed: false, reason: "post_not_published" as const };
  }

  if (post.contentRating !== "sfw") {
    return { allowed: false, reason: "non_sfw_post" as const };
  }

  if (post.manualAdBlockedAt !== null) {
    return { allowed: false, reason: "manual_ad_block" as const };
  }

  if (post.unsafeCommentCount > 0) {
    return { allowed: false, reason: "unsafe_comments" as const };
  }

  if (post.pendingReviewCommentCount > 0) {
    return { allowed: false, reason: "pending_review_comments" as const };
  }

  if (media.providerSafetyStatus !== "verified_sfw") {
    return { allowed: false, reason: "media_not_verified_sfw" as const };
  }

  return { allowed: true, reason: "eligible" as const };
}
```

Actual render function:

```ts
function shouldRenderAds(viewer: Viewer, eligibility: { allowed: boolean }) {
  if (!eligibility.allowed) return false;
  if (viewerHasPaidAdFreePlan(viewer)) return false;
  return true;
}
```

### 11.4 Comment Safety Counters

`hasUnsafeComments` must not scan all comments on every page render.

Use denormalized counters on `posts`:

```txt
unsafe_comment_count
pending_review_comment_count
```

Both counters affect ad eligibility.

```txt
unsafe_comment_count > 0:
  ads disabled

pending_review_comment_count > 0:
  ads disabled until review is complete
```

Moderation/comment transactions must update these counters when a comment moves between pending review, clean published, ad-unsafe, hidden, and removed states.

### 11.5 Ad Placement Rules

Ads may appear only when:

```txt
post.status = published
post.content_rating = sfw
post.unsafe_comment_count = 0
post.pending_review_comment_count = 0
media.provider_safety_status = verified_sfw
post.manual_ad_blocked_at IS NULL
viewer is not paid ad-free
```

Ads must never appear on:

```txt
suggestive pages
mature pages
removed/hidden/pending-review posts
unverified external embeds
pages with unsafe published comments
pages with pending-review comments
moderation pages
user settings pages
upload/composer pages
```

---

## 12. External Media Safety

### 12.1 Problem

YouTube/GIPHY embeds are third-party content. Doomscrollr does not control them.

Risk cases:

```txt
Thumbnail looks SFW but embedded content is not.
Provider metadata changes after initial classification.
Video becomes age-restricted, removed, private, or region-blocked.
GIF rating changes.
External media is swapped or reprocessed by provider.
```

Therefore a Doomscrollr rating is only valid if provider state is checked and kept fresh.

### 12.2 Media Safety Status

`media_assets.provider_safety_status` must be explicit.

```ts
export const ProviderSafetyStatusSchema = z.enum([
  "pending",
  "verified_sfw",
  "suggestive",
  "mature",
  "unsafe",
  "unavailable",
]);
```

Meanings:

```txt
pending:
  Not enough information yet.
  No ads.

verified_sfw:
  Provider metadata and local checks indicate SFW.
  Ads may be possible if the post/page is also safe.

suggestive:
  Provider rating or local review suggests non-explicit sensitive material.
  No ads.

mature:
  Provider rating or local review suggests mature-only material.
  No ads.

unsafe:
  Not allowed or too risky.
  Post should be hidden/removed or sent to moderation.

unavailable:
  Provider media is deleted, private, blocked, or inaccessible.
  No ads and may require post downgrade/removal.
```

### 12.3 Conservative Defaults

Fresh external embeds must not be ad-eligible by default.

Default state:

```txt
provider_safety_status = pending
post.status = pending_review OR published with no ads, depending on provider/source trust
```

For MVP, the safer default is:

```txt
external embed post is not ad-eligible until provider_safety_status = verified_sfw
```

### 12.4 GIPHY Mapping

Provider ratings should map conservatively.

Example mapping:

```txt
GIPHY g:
  sfw / verified_sfw

GIPHY pg:
  sfw or suggestive depending on local policy

GIPHY pg-13:
  suggestive

GIPHY r:
  reject by default for v1, or mature only if mature feature is enabled

unknown:
  pending_review / no ads
```

Do not allow GIPHY R-rated content in the default public feed.

### 12.5 YouTube Mapping

YouTube embeds should be treated as untrusted until resolved.

The resolver should collect provider metadata and derive:

```txt
provider_media_id
provider_title
provider_channel
thumbnail_url
duration_seconds
is_short
availability_state
provider_safety_status
last_provider_checked_at
metadata_hash
thumbnail_hash
```

If the resolver cannot determine safety confidently:

```txt
provider_safety_status = pending
no ads
```

If provider metadata later changes materially:

```txt
set provider_safety_status = pending
set next_provider_check_at = now
re-run classification
recompute derived ad eligibility on next render
```

### 12.6 Periodic Re-check Job

A background job must re-check external media.

```txt
fresh posts:
  re-check frequently during first 24 hours

older posts:
  re-check on a slower cadence

reported posts:
  re-check immediately

ad-eligible external posts:
  require periodic revalidation
```

Suggested fields:

```txt
last_provider_checked_at
next_provider_check_at
provider_metadata_hash
provider_thumbnail_hash
provider_availability_state
```

### 12.7 On Provider Drift

If a provider check downgrades safety:

```txt
verified_sfw -> suggestive:
  post remains visible only to eligible users
  ads stop immediately

verified_sfw -> mature:
  post hidden from non-mature viewers
  ads stop immediately

any -> unsafe:
  post goes pending_review or removed
  ads stop immediately

any -> unavailable:
  post shows unavailable state or goes pending_review
  ads stop immediately
```

---

## 13. Authentication and User Sync

### 13.1 Auth Boundary

Clerk owns identity.

Doomscrollr owns:

```txt
local username
profile display
role
preferences
plan state
moderation state
product permissions
```

Do not treat Clerk profile fields as the app profile source of truth.

### 13.2 Local User

`users.clerk_user_id` bridges Clerk to Doomscrollr.

Doomscrollr username is local and unique.

```txt
Clerk username/email/display name may suggest defaults.
Doomscrollr username is selected and stored locally.
```

### 13.3 Sync Mechanism

Use both:

```txt
1. Clerk webhooks for primary sync.
2. Lazy upsert fallback on authenticated API requests.
```

Webhook events:

```txt
user.created
user.updated
user.deleted
```

Lazy upsert fallback:

```txt
On authenticated request:
  verify Clerk token
  find users.clerk_user_id
  if missing, create minimal local user
  ensure user_preferences row exists
```

### 13.4 Deletion Handling

If Clerk user is deleted:

```txt
mark local user as disabled/deleted
preserve public posts/comments according to policy
remove private/profile PII where required
prevent login/use
```

---

## 14. Database Schema

### 14.1 Users

```ts
users {
  id
  clerk_user_id
  username
  display_name
  avatar_url
  role // user, moderator, admin
  plan // free, paid
  status // active, restricted, banned, deleted
  created_at
  updated_at
}
```

Constraints:

```txt
unique(users.clerk_user_id)
unique(users.username)
```

Do not put age verification or mature-content preferences here.

### 14.2 User Preferences

```ts
user_preferences {
  user_id

  show_suggestive_content
  suggestive_content_opt_in_at
  suggestive_content_opt_out_at

  mature_content_enabled
  mature_content_opt_in_at
  mature_content_opt_out_at

  autoplay_gifs
  autoplay_videos
  compact_feed

  created_at
  updated_at
}
```

Constraints:

```txt
primary key(user_id)
foreign key(user_id) references users(id)
```

### 14.3 Age Verifications

```ts
age_verifications {
  id
  user_id
  provider
  status // pending, verified, failed, revoked, expired
  is_active
  verified_at
  expires_at
  external_reference_hash
  created_at
  updated_at
}
```

Rules:

```txt
Canonical age verification lives here only.
Do not duplicate age_verified_at on users.
At most one active age-verification row may exist per user.
```

Canonical active-check:

```sql
status = 'verified'
AND is_active = true
AND (expires_at IS NULL OR expires_at > now())
```

Partial unique index:

```sql
CREATE UNIQUE INDEX age_verifications_one_active_per_user
ON age_verifications (user_id)
WHERE is_active = true;
```

Expiration handling:

```txt
When expires_at <= now(), a scheduled job must set is_active = false and status = expired.
Before inserting a new active verified row, the transaction must deactivate any previous active row for that user.
```

The unique index intentionally uses `is_active`, not `expires_at > now()`, because time-dependent predicates are not suitable as durable uniqueness rules.

### 14.4 Media Assets

```ts
media_assets {
  id
  provider // upload, youtube, giphy, tenor
  media_type // image, gif, video, short
  provider_media_id
  original_url
  embed_url
  thumbnail_url
  preview_url
  width
  height
  duration_seconds
  aspect_ratio // square, landscape, portrait, unknown

  provider_rating
  provider_safety_status // pending, verified_sfw, suggestive, mature, unsafe, unavailable
  provider_availability_state
  provider_metadata_hash
  provider_thumbnail_hash
  last_provider_checked_at
  next_provider_check_at

  attribution_label
  attribution_url
  metadata_json
  created_at
  updated_at
}
```

### 14.5 Posts

```ts
posts {
  id
  author_id
  media_asset_id
  title

  status // draft, pending_review, published, hidden, removed
  content_rating // post_content_rating enum: sfw, suggestive, mature
  removal_reason // nullable unless status = removed

  manual_ad_blocked_at
  manual_ad_blocked_by
  manual_ad_block_reason

  score
  upvote_count
  downvote_count
  comment_count
  unsafe_comment_count
  pending_review_comment_count

  created_at
  updated_at
  published_at
  removed_at
  removed_by
}
```

Important:

```txt
content_rating does not include prohibited.
content_rating is a Postgres enum, not varchar.
removed/prohibited content is modeled through status + removal_reason.
```

`slug` is intentionally omitted from v1 because routes are ID-based. Add slugs later only if the route contract uses them, for example `/post/:id/:slug`.

### 14.6 Comments

```ts
comments {
  id
  post_id
  author_id
  parent_id
  depth // 0 = top-level, 1 = reply

  body_text

  status // pending_review, published, hidden, removed
  safety_state // clean, ad_unsafe
  removal_reason

  score
  upvote_count
  downvote_count

  created_at
  updated_at
  removed_at
  removed_by
}
```

Rules:

```txt
body_text is plain text only.
depth must be 0 or 1.
parent_id is null when depth = 0.
parent_id is required when depth = 1.
A reply may only target a top-level comment.
```

DB checks:

```sql
CHECK (depth IN (0, 1))
CHECK (
  (depth = 0 AND parent_id IS NULL)
  OR
  (depth = 1 AND parent_id IS NOT NULL)
)
CHECK (
  (status = 'removed' AND removal_reason IS NOT NULL)
  OR
  (status <> 'removed' AND removal_reason IS NULL)
)
```

The parent-is-top-level rule requires a service-layer transaction or DB trigger because a simple CHECK constraint cannot inspect another row.

### 14.7 Votes

```ts
post_votes {
  id
  user_id
  post_id
  value // 1 or -1
  created_at
  updated_at
}

comment_votes {
  id
  user_id
  comment_id
  value // 1 or -1
  created_at
  updated_at
}
```

Constraints:

```txt
unique(post_votes.user_id, post_votes.post_id)
unique(comment_votes.user_id, comment_votes.comment_id)
CHECK (value IN (1, -1))
```

### 14.8 Reports

```ts
reports {
  id
  reporter_id
  target_type // post, comment, user
  target_id
  reason
  details
  status // open, reviewed, dismissed, actioned
  created_at
  updated_at
}
```

### 14.9 Moderation Actions

```ts
moderation_actions {
  id
  moderator_id
  target_type
  target_id
  action
  reason
  notes
  previous_state_json
  new_state_json
  created_at
}
```

Actions:

```txt
hide_post
publish_post
remove_post
restore_post
change_content_rating
manual_ad_block
clear_manual_ad_block
hide_comment
remove_comment
restore_comment
mark_comment_ad_unsafe
mark_comment_clean
ban_user
restrict_user
```

### 14.10 Feed Ranking Runs

Ranking runs are generated per feed type and per content ceiling.

```ts
feed_rank_runs {
  id
  feed_type // hot, top_day, top_week
  content_ceiling // post_content_rating enum: sfw, suggestive, mature
  algorithm_version
  generated_at
  expires_at
  retain_until
  metadata_json
}
```

Rules:

```txt
A run with content_ceiling = sfw contains only posts rated sfw at generation time.
A run with content_ceiling = suggestive contains posts rated sfw or suggestive at generation time.
A run with content_ceiling = mature contains posts rated sfw, suggestive, or mature at generation time.
```

The SFW run serves most anonymous/default traffic. Suggestive and mature runs are generated only if those surfaces are enabled.

`retain_until` protects active cursors from cleanup. Cleanup may delete a run only when:

```txt
now() > retain_until
```

### 14.11 Feed Ranking Items

```ts
feed_rank_items {
  id
  feed_rank_run_id
  rank
  post_id
  score_snapshot
  post_created_at
  created_at
}
```

Constraints:

```txt
unique(feed_rank_items.feed_rank_run_id, rank)
unique(feed_rank_items.feed_rank_run_id, post_id)
index(feed_rank_items.feed_rank_run_id, rank)
```

`feed_rank_items` does not store `content_rating`. Public visibility and ad safety must be checked against the live `posts` row at read time. This avoids trusting stale snapshot rating data after moderation or reclassification.

---

## 15. Comment Model

### 15.1 One-level Replies

Doomscrollr v1 supports:

```txt
top-level comment
  reply
  reply
  reply
```

It does not support:

```txt
top-level comment
  reply
    reply-to-reply
```

### 15.2 Service-layer Enforcement

When creating a top-level comment, the service must verify that the target post is publicly commentable.

```txt
post.status = published
viewer can view post in public context
```

When creating a reply:

```ts
async function createReply(input) {
  return db.transaction(async (tx) => {
    const post = await tx.posts.findFirst({
      where: { id: input.postId },
      for: "update",
    });

    if (!post || post.status !== "published") {
      throw new AppError("POST_NOT_COMMENTABLE");
    }

    if (!canViewPost(input.viewer, post, "public")) {
      throw new AppError("POST_NOT_VIEWABLE");
    }

    const parent = await tx.comments.findFirst({
      where: { id: input.parentId, postId: input.postId },
      for: "update",
    });

    if (!parent) {
      throw new AppError("PARENT_COMMENT_NOT_FOUND");
    }

    if (parent.status !== "published") {
      throw new AppError("PARENT_COMMENT_NOT_REPLYABLE");
    }

    if (parent.depth !== 0) {
      throw new AppError("REPLY_TO_REPLY_NOT_ALLOWED");
    }

    const status = shouldPreModerateComment(input) ? "pending_review" : "published";

    const comment = await tx.comments.insert({
      postId: input.postId,
      authorId: input.authorId,
      parentId: parent.id,
      depth: 1,
      bodyText: input.bodyText,
      status,
      safetyState: "clean",
    });

    if (status === "published") {
      await incrementPostCounter(tx, input.postId, "comment_count", 1);
    } else {
      await incrementPostCounter(tx, input.postId, "pending_review_comment_count", 1);
    }

    return comment;
  });
}
```

The same published-post and viewer-visibility guard applies to top-level comments.

### 15.3 Plain Text Only

v1 comments are plain text only.

```txt
No raw HTML.
No user-supplied Markdown rendering.
No embedded scripts.
No custom rich text.
```

Rendering rule:

```txt
escape text
linkify URLs safely
open links with rel="nofollow ugc noopener noreferrer"
```

This sidesteps sanitizer complexity for v1.

---

## 16. Counter Consistency

### 16.1 Denormalized Counters

The app stores counters for performance:

```txt
posts.score
posts.upvote_count
posts.downvote_count
posts.comment_count
posts.unsafe_comment_count
posts.pending_review_comment_count
comments.score
comments.upvote_count
comments.downvote_count
```

These are denormalized and must be updated transactionally.

### 16.2 Vote Transaction Rules

All vote operations must run in a database transaction.

Vote preconditions:

```txt
post.status = published
viewer can view post in public context
```

Users may not vote on:

```txt
draft posts
pending-review posts
hidden posts
removed posts
posts above their content ceiling
comments whose parent post is not published/viewable
hidden or removed comments
pending-review comments
```

Pseudo-flow for a post vote:

```txt
BEGIN
  lock target post row
  assert post.status = published
  assert viewer can view post
  lock existing vote row if present
  determine old value
  determine new value or removal
  insert/update/delete vote row
  apply counter deltas to post
COMMIT
```

Pseudo-flow for a comment vote:

```txt
BEGIN
  lock target comment row
  lock parent post row
  assert post.status = published
  assert viewer can view post
  assert comment.status = published
  lock existing vote row if present
  determine old value
  determine new value or removal
  insert/update/delete vote row
  apply counter deltas to comment
COMMIT
```

### 16.3 Vote Delta Examples

New upvote:

```txt
old = none
new = 1
upvote_count += 1
score += 1
```

Remove upvote:

```txt
old = 1
new = none
upvote_count -= 1
score -= 1
```

Flip upvote to downvote:

```txt
old = 1
new = -1
upvote_count -= 1
downvote_count += 1
score -= 2
```

Flip downvote to upvote:

```txt
old = -1
new = 1
downvote_count -= 1
upvote_count += 1
score += 2
```

### 16.4 Comment Count and Safety Counter Rules

When a comment is created as `published`:

```txt
posts.comment_count += 1
```

When a comment is created as `pending_review`:

```txt
posts.pending_review_comment_count += 1
```

When a pending-review comment becomes published:

```txt
posts.pending_review_comment_count -= 1
posts.comment_count += 1
```

When a pending-review comment is removed/hidden:

```txt
posts.pending_review_comment_count -= 1
```

When a published comment is removed/hidden:

```txt
posts.comment_count -= 1
```

When a published comment becomes ad-unsafe:

```txt
posts.unsafe_comment_count += 1
```

When an ad-unsafe published comment is removed, hidden, or marked clean:

```txt
posts.unsafe_comment_count -= 1
```

When a hidden/removed ad-unsafe comment is restored as published and still ad-unsafe:

```txt
posts.comment_count += 1
posts.unsafe_comment_count += 1
```

All counter updates must be idempotent across state transitions. Service code must compute deltas from the previous state and the next state, not from a hard-coded action name alone.

### 16.5 Reconciliation Job

A scheduled job must periodically recalculate counters from source tables and report drift.

```txt
reconcile posts vote counts
reconcile comments vote counts
reconcile comment_count
reconcile unsafe_comment_count
reconcile pending_review_comment_count
log differences
repair automatically if safe
```

---

## 17. Feed and Pagination

### 17.1 Feed Types

MVP:

```txt
recent
```

Deferred until ranking infrastructure exists:

```txt
hot
top_day
top_week
```

### 17.2 Recent Feed Cursor

Recent feed can use stable cursor pagination.

Sort:

```sql
ORDER BY posts.published_at DESC, posts.id DESC
```

Cursor payload:

```ts
type RecentCursor = {
  sort: "recent";
  snapshotBefore: string;
  lastPublishedAt: string;
  lastPostId: string;
  effectiveContentCeiling: "sfw" | "suggestive" | "mature";
};
```

Query shape:

```sql
WHERE posts.status = 'published'
  AND posts.published_at <= :snapshot_before
  AND posts.content_rating <= :effective_content_ceiling::post_content_rating
  AND (
    posts.published_at < :last_published_at
    OR (posts.published_at = :last_published_at AND posts.id < :last_post_id)
  )
ORDER BY posts.published_at DESC, posts.id DESC
LIMIT :limit
```

Important:

```txt
posts.content_rating is a Postgres enum declared as sfw < suggestive < mature.
The <= comparison is valid only because the database type carries the product order.
```

`snapshotBefore` prevents newly published posts from shifting into an active scroll session.

If a cursor's `effectiveContentCeiling` is higher than the viewer's current derived ceiling, the server must reject the cursor and restart the feed at the viewer's current ceiling.

### 17.3 Hot Feed Problem

Do not paginate directly on live `hot_score`.

This is invalid:

```txt
cursor = hot_score + id
```

Because `hot_score` changes when:

```txt
time passes
votes change
comments/reports affect ranking
provider/moderation state changes
```

A cursor based on a live mutating score can produce duplicates and skipped posts.

### 17.4 Chosen Hot Feed Strategy

Use materialized ranking runs.

The ranking job periodically creates:

```txt
feed_rank_runs
feed_rank_items
```

Runs are generated per feed type and per content ceiling:

```txt
hot/sfw
hot/suggestive
hot/mature
top_day/sfw
top_day/suggestive
top_day/mature
```

The hot feed cursor references:

```txt
rank_run_id
after_rank
```

not a live score.

Cursor payload:

```ts
type HotCursor = {
  sort: "hot" | "top_day" | "top_week";
  rankRunId: string;
  afterRank: number;
  effectiveContentCeiling: "sfw" | "suggestive" | "mature";
};
```

Run selection on the first request:

```txt
1. Derive viewerContentCeiling from user preferences + age verification.
2. Clamp requested maxRating to viewerContentCeiling.
3. Select the newest non-expired feed_rank_run for feed_type + effectiveContentCeiling.
4. Return items from that run.
```

Cursor validation on later requests:

```txt
1. Decode cursor.
2. Verify the run still exists.
3. Verify cursor.effectiveContentCeiling <= current viewerContentCeiling.
4. If invalid, return CURSOR_EXPIRED_OR_NOT_ALLOWED and restart from the newest valid run.
```

Read-time filtering remains mandatory as a safety guard because posts may be removed, hidden, or re-rated after a run is generated.

Do not trust ranking-run membership alone for public visibility.

Query shape uses over-fetching:

```sql
SELECT p.*, fri.rank
FROM feed_rank_items fri
JOIN posts p ON p.id = fri.post_id
WHERE fri.feed_rank_run_id = :rank_run_id
  AND fri.rank > :after_rank
  AND p.status = 'published'
  AND p.content_rating <= :effective_content_ceiling::post_content_rating
ORDER BY fri.rank ASC
LIMIT :scan_limit
```

Where:

```txt
scan_limit = requested_limit * overfetch_factor
initial overfetch_factor = 4
requested_limit = 9
```

Application-side response algorithm:

```ts
const scanned = await queryRankItems({ scanLimit: limit * 4 });
const returned = scanned.slice(0, limit);

const nextCursor = returned.length === 0
  ? null
  : encodeCursor({
      rankRunId,
      afterRank: returned[returned.length - 1].rank,
      effectiveContentCeiling,
    });
```

The cursor uses the rank of the last returned post, not the last scanned row. This avoids jumping past eligible posts after gaps created by removals/re-ratings.

If `returned.length < requested_limit` but `scanned.length === scan_limit`, the API may perform another bounded scan window before responding. Cap this to avoid long-tail queries.

Votes affect the next ranking run, not the active scroll session.

### 17.5 Ranking Run Cadence and Retention

Suggested initial cadence:

```txt
hot:
  rebuild every 5-15 minutes

top_day/top_week:
  rebuild every 15-60 minutes
```

Ranking runs have two time fields:

```txt
expires_at:
  no longer selected for new feed sessions after this time

retain_until:
  cannot be hard-deleted before this time because active cursors may point to it
```

Cleanup rule:

```sql
DELETE FROM feed_rank_runs
WHERE retain_until < now();
```

`retain_until` should be at least:

```txt
expires_at + maximum_cursor_ttl
```

If a cursor references a missing run, the API must not return an empty page as if the feed ended. It must return a cursor-expired response and include enough information for the client to restart on the newest valid run.

Example response:

```json
{
  "error": {
    "code": "CURSOR_EXPIRED",
    "message": "This feed session expired. Restart the feed."
  },
  "restart": {
    "sort": "hot",
    "effectiveContentCeiling": "sfw"
  }
}
```

### 17.6 Feed Response

```json
{
  "items": [],
  "nextCursor": "encoded_cursor_or_null",
  "effectiveContentCeiling": "sfw",
  "rankingRunId": "optional_for_hot"
}
```


---

## 18. API Contracts and Zod Schemas

### 18.1 Content Schemas

```ts
import { z } from "zod";

export const ContentRatingSchema = z.enum([
  "sfw",
  "suggestive",
  "mature",
]);

export const MaxRatingSchema = ContentRatingSchema;

export const PostStatusSchema = z.enum([
  "draft",
  "pending_review",
  "published",
  "hidden",
  "removed",
]);
```

### 18.2 Media Source Schema

```ts
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
]);
```

### 18.3 Create Post Schema

```ts
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
```

Content rating should usually be derived by moderation/provider checks, not blindly trusted from user input.

### 18.4 Post Feed Query Schema

```ts
export const PostFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(9),
  cursor: z.string().optional(),
  sort: z.enum(["recent", "hot", "top_day", "top_week"]).default("recent"),
  maxRating: z.enum(["sfw", "suggestive", "mature"]).default("sfw"),
});
```

Server behavior:

```txt
requested maxRating is not trusted.
server derives viewerContentCeiling from user_preferences + age_verifications.
effectiveContentCeiling = min(requestedMaxRating, viewerContentCeiling) using the rating ladder.
response includes effectiveContentCeiling.
```

The SQL layer uses the Postgres `post_content_rating` enum order. Application code may still use `ratingRank()` when comparing values outside SQL.

There is no `all_allowed` enum.

### 18.5 Comment Schema

```ts
export const CreateCommentSchema = z.object({
  body: z.string().min(1).max(2000).trim(),
  parentId: z.string().optional(),
});
```

API must reject reply-to-reply at service layer.

---

## 19. API Routes

### 19.1 Public Routes

```txt
GET /api/posts?limit=9&cursor=&sort=recent&maxRating=sfw
GET /api/posts/:id
GET /api/posts/:id/comments
GET /api/users/:username
GET /api/users/:username/posts
```

Public routes return only posts visible to the viewer.

Anonymous viewers receive SFW only.

### 19.2 Authenticated Routes

```txt
POST   /api/posts
POST   /api/posts/:id/vote
DELETE /api/posts/:id/vote
POST   /api/posts/:id/comments
POST   /api/comments/:id/vote
DELETE /api/comments/:id/vote
POST   /api/reports
GET    /api/me
PATCH  /api/me/preferences
```

Authenticated does not mean action-authorized.

Comment and vote routes must still enforce:

```txt
target post status = published
viewer can view target post in public context
target comment status = published for comment votes
```

### 19.3 Media Routes

```txt
POST /api/media/resolve/youtube
GET  /api/gifs/search?provider=giphy&q=...
GET  /api/gifs/trending?provider=giphy
```

Media routes should return provider safety status and ad eligibility warnings where applicable.

### 19.4 Moderation Routes

```txt
GET  /api/moderation/reports
GET  /api/moderation/posts/:id
POST /api/moderation/posts/:id/hide
POST /api/moderation/posts/:id/remove
POST /api/moderation/posts/:id/restore
POST /api/moderation/posts/:id/rating
POST /api/moderation/posts/:id/manual-ad-block
POST /api/moderation/comments/:id/remove
POST /api/moderation/comments/:id/safety
```

Moderation routes use `context = "moderation"` in visibility checks.

### 19.5 Clerk Webhook Routes

```txt
POST /api/webhooks/clerk
```

Events handled:

```txt
user.created
user.updated
user.deleted
```

---

## 20. Frontend Routes

```txt
/                      Home feed
/recent                Recent feed
/hot                   Hot feed later
/top                   Top feed later
/post/$postId          Post detail + comments
/upload                Create post
/@$username            User profile
/login                 Login
/register              Register
/settings              Account settings
/settings/content      Suggestive/mature content preferences
/moderation            Moderation queue
```

### 20.1 Feed Rendering

The home feed renders normalized post cards.

```tsx
<PostCard post={post} />
```

Media rendering delegates by provider.

```tsx
<MediaRenderer media={post.media} />
```

Homepage should use lightweight previews.

Post detail may load the full embed/player.

### 20.2 Ads as Feed Items

Ads should be explicit feed items, not DOM hacks.

```ts
type FeedItem =
  | { type: "post"; post: Post }
  | { type: "ad"; placement: "feed_inline"; slot: string };
```

Only insert ad items when the page/surface is ad-eligible and the viewer is not paid ad-free.

---

## 21. State Management

No Zustand in v1.

Use:

```txt
TanStack Query   -> server state
TanStack Router  -> URL/search state
Clerk            -> auth state
React state      -> local component state
```

Add Zustand later only for cross-route client-only state such as:

```txt
global composer draft
media player state
UI preference state
bulk moderation selection
```

Do not use Zustand for:

```txt
posts
comments
votes
auth
pagination
route filters
```

---

## 22. Rate Limiting

### 22.1 Requirement

Rate limits must work across multiple API instances.

Do not use in-memory-only rate limiting in production.

### 22.2 Production Backing

Use Redis for production rate limits.

Local development may use in-memory fallback.

PostgreSQL-backed rate limits are acceptable for early staging if Redis is not available, but production should use Redis.

### 22.3 Rate Limit Keys

Use compound keys for normal product traffic:

```txt
ip
user_id
clerk_user_id
route_group
action_type
```

Examples:

```txt
rate:post:create:user:{user_id}
rate:comment:create:user:{user_id}
rate:vote:post:user:{user_id}
rate:report:create:user:{user_id}
rate:media:resolve:user:{user_id}
```

Do not depend on IP rate limits as the primary protection for Clerk webhooks. Clerk webhook security should be based on signature verification, timestamp/replay checks, and idempotency by event ID. IP-based throttles can accidentally block legitimate bursts from shared provider infrastructure.

Webhook protections:

```txt
verify webhook signature
reject stale timestamps
store processed event IDs for idempotency
apply a broad global safety limit only as abuse protection
never trust webhook payloads without signature validation
```

### 22.4 Initial Limits

Initial conservative defaults:

```txt
create posts:
  10/hour/user

create comments:
  60/hour/user

votes:
  300/hour/user

reports:
  20/day/user

media resolve:
  60/hour/user
```

Moderators/admins may have separate limits but should not be unlimited.

---

## 23. Logging

### 23.1 Pino

Use Pino for structured JSON logs.

```ts
import pino from "pino";

export const logger = pino({
  name: "doomscrollr-api",
  level: Deno.env.get("LOG_LEVEL") ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "clerk.token",
      "user.email",
    ],
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

### 23.2 Required Request Log Fields

```txt
request_id
method
path
status
duration_ms
user_id if available
clerk_user_id if available
```

### 23.3 Important Events

```txt
post_created
post_published
post_removed
post_rating_changed
comment_created
comment_removed
vote_changed
media_resolved
provider_safety_changed
provider_media_unavailable
ad_eligibility_denied
mature_content_blocked
clerk_user_synced
rate_limit_exceeded
```

---

## 24. Validation

### 24.1 Zod Scope

Use Zod for:

```txt
request body validation
query string validation
route param validation
environment variable validation
external provider response parsing
shared frontend/backend DTOs
```

Do not use Zod as a replacement for:

```txt
database constraints
authorization checks
moderation policy decisions
transactional invariants
```

### 24.2 Environment Schema

```ts
const EnvSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),
  GIPHY_API_KEY: z.string().min(1).optional(),
  YOUTUBE_API_KEY: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});
```

Production boot should fail if required production dependencies are missing.

---

## 25. Moderation Workflows

### 25.1 Report Review

```txt
user reports post/comment
report appears in moderation queue
moderator reviews target and context
moderator takes action
moderation_actions row is inserted
post/comment state changes transactionally
counters update transactionally
```

### 25.2 Post Removal

Post removal transaction:

```txt
set posts.status = removed
set posts.removal_reason
set posts.removed_at
set posts.removed_by
insert moderation_actions row
remove post from active feeds on next query/ranking run
```

### 25.3 Content Rating Change

Rating change transaction:

```txt
set posts.content_rating
insert moderation_actions row
invalidate relevant feed caches/ranking eligibility
ad eligibility changes automatically through derived gate
```

### 25.4 Comment Review and Safety Changes

Pending-review comment becomes published clean:

```txt
set comments.status = published
set comments.safety_state = clean
posts.pending_review_comment_count -= 1
posts.comment_count += 1
insert moderation_actions row
```

Pending-review comment becomes published ad-unsafe:

```txt
set comments.status = published
set comments.safety_state = ad_unsafe
posts.pending_review_comment_count -= 1
posts.comment_count += 1
posts.unsafe_comment_count += 1
insert moderation_actions row
```

Pending-review comment is removed:

```txt
set comments.status = removed
set comments.removal_reason
posts.pending_review_comment_count -= 1
insert moderation_actions row
```

Published comment becomes ad-unsafe:

```txt
set comments.safety_state = ad_unsafe
posts.unsafe_comment_count += 1
insert moderation_actions row
```

Published ad-unsafe comment becomes clean:

```txt
set comments.safety_state = clean
posts.unsafe_comment_count -= 1
insert moderation_actions row
```

Published comment is hidden/removed:

```txt
set comments.status = hidden OR removed
posts.comment_count -= 1
if comments.safety_state = ad_unsafe:
  posts.unsafe_comment_count -= 1
insert moderation_actions row
```

All transitions must compute deltas from previous state to next state to avoid double increment/decrement bugs.


---

## 26. Roadmap

### Phase 1 — Monorepo Foundation

- Create Deno workspace.
- Create React app.
- Create Hono API.
- Add shared Zod schemas.
- Add Pino logger.
- Add PostgreSQL + Drizzle.
- Add initial migrations.

### Phase 2 — Public Recent Feed

- Build SFW-only recent feed.
- Implement stable cursor pagination using `published_at + id + snapshotBefore`.
- Render 9 posts at a time.
- Add infinite scroll.
- Use seeded data.

### Phase 3 — Post Detail and Comments

- Add post detail page.
- Add comments UI.
- Store comments as plain text.
- Add one-level replies with `depth` enforcement.

### Phase 4 — Clerk Auth and Local Users

- Add Clerk to React.
- Add Clerk token verification to API.
- Add Clerk webhook route.
- Add lazy local user upsert fallback.
- Add local username flow.
- Add `user_preferences` creation.

### Phase 5 — Create Posts from External Media

- Add YouTube resolver.
- Add Shorts detection.
- Add GIPHY search.
- Add `media_assets`.
- Add provider safety status.
- Keep fresh embeds ad-ineligible until verified.

### Phase 6 — Votes and Counters

- Add post votes.
- Add comment votes.
- Implement transactional vote deltas.
- Add reconciliation job.

### Phase 7 — Reports and Moderation

- Add report flow.
- Add moderation queue.
- Add post/comment removal.
- Add content rating changes.
- Add manual ad block.
- Add unsafe and pending-review comment counters.

### Phase 8 — AdSense on Eligible SFW Pages

- Add ad slots as feed items.
- Add derived ad eligibility function.
- Never render ads for non-SFW or unverified embed pages.
- Disable ads for paid users later.

### Phase 9 — Paid Ad-Free Tier

- Add plan state.
- Add subscription integration later.
- Remove ads for paid users.
- Add saved collections/profile perks later.
- Do not market paid tier as NSFW unlock.

### Phase 10 — Hot Feed

- Implement materialized ranking runs.
- Create `feed_rank_runs` and `feed_rank_items`.
- Build ranking job.
- Generate ranking runs per content ceiling.
- Cursor hot feed using `rank_run_id + after_rank`.
- Use over-fetching and set the cursor to the last returned rank.
- Add run retention using `retain_until`.
- Never cursor on live `hot_score`.

### Phase 11 — Suggestive/Mature Capability

Only after moderation/compliance readiness:

- Add suggestive opt-in UI.
- Add age verification provider.
- Add mature opt-in UI.
- Add mature feed visibility logic.
- Keep mature surfaces ad-free.
- Do not include mature content in default feeds.

---

## 27. Acceptance Criteria for v2.2 Corrections

The corrected specification is acceptable only if:

```txt
content_rating never includes prohibited
prohibited content is modeled as removed + removal_reason
moderators can view removed content through moderation context
content_rating is a Postgres enum ordered sfw < suggestive < mature
SQL never compares rating values as plain varchar text
suggestive and mature have distinct gates
mature visibility implies suggestive visibility via derived content ceiling
feed query maxRating matches the content rating enum
all_allowed is removed
recent feed uses enum-safe content ceiling comparisons
hot feed does not paginate on live hot_score
hot/top ranking runs are generated per content ceiling
read-time hot feed filtering is treated as a stale-run safety guard
over-fetching prevents short pages from common removed/re-rated gaps
hot cursor advances to the rank of the last returned item, not the last scanned item
feed_rank_items does not store a dead content_rating snapshot
ranking runs have retain_until and are not deleted while cursors may reference them
missing ranking runs return CURSOR_EXPIRED instead of an empty end-of-feed page
ad eligibility is derived from one gate
unsafe comments are denormalized on posts
pending-review comments are denormalized and block ads
external embeds require provider safety status and re-checks
mature preferences live in user_preferences only
age verification lives in age_verifications only
active age verification has a canonical check and one-active-row unique index
one-level replies are enforced by depth + service transaction
comments/votes are rejected on non-published or non-viewable posts
vote/counter changes are transactional
rate limits are Redis-backed in production
Clerk webhook safety is signature/idempotency first, not IP throttle first
comments are plain text + linkified for v1
Clerk sync uses webhooks + lazy upsert fallback
Doomscrollr username is local, not Clerk-owned
slug is omitted from v1 unless routes start using it
```


---

## 28. Open Questions

These remain product/business decisions:

1. Which age-verification provider will be used if mature content launches?
2. Will suggestive content exist at launch, or only the SFW tier?
3. Should GIPHY PG content be SFW or suggestive under Doomscrollr policy?
4. Should YouTube embed posts require manual moderation before ad eligibility, or is provider metadata plus age/recheck enough?
5. Which subscription/payment provider can support the final content policy?
6. What is the final public brand name replacing Doomscrollr?

---

## 29. Final Architectural Position

Doomscrollr should keep these responsibilities separate:

```txt
Clerk:
  identity

Doomscrollr users:
  local profile, username, role, preferences, plan

Post status:
  whether content can exist publicly

Content rating:
  who may view published content

Ad eligibility:
  derived gate from canonical state

External provider safety:
  separate source freshness and safety state

Feed ranking:
  stable pagination, not live mutable scores
```

This separation is the critical design correction. It prevents illegal states, stale ad decisions, inconsistent viewer gates, and broken feed pagination.

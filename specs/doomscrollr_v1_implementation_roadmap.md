# Doomscrollr v1 Implementation Roadmap

**Date:** 2026-06-24  
**Status:** implementation roadmap from current project inspection  
**Inputs:** v1 spec, v2/v3 milestone specs, future milestones, current repository state  

This document sequences the work needed to move the current codebase toward the v1 validation product.

The active v1 source of truth is [`specs/doomscrollr_spec_v1.md`](./specs/doomscrollr_spec_v1.md).
The canonical version ladder remains [`doomscrollr_roadmap_v1_v2_v3_future.md`](./doomscrollr_roadmap_v1_v2_v3_future.md).
This file is only the build-order plan; if it conflicts with the v1 spec, the v1 spec wins.

## Current Project State

### Verified Health

- `deno task check` passes.
- `deno task test` passes: 4 tests, 0 failures.
- The repo is a Deno workspace with `apps/api`, `apps/web`, `packages/shared`, `packages/database`, and `packages/config`.
- The app has a Hono API, React/Vite web app, TanStack Router/Query, Clerk token verification, Drizzle schema/migrations, seed data, mock fallback data, and basic logging/error handling.

### Existing Product Surface

- Feed read path exists through `GET /api/posts`, with database and mock fallback.
- Post detail read path exists through `GET /api/posts/:id`.
- Comments read path exists through `GET /api/posts/:id/comments`.
- User profile and user posts read paths exist.
- A protected moderation reports read path exists.
- Web screens exist for recent feed, post detail, create shell, profile, and moderation shell.

### Main Gaps Against V1

- Public routing is not v1-aligned: the web app uses `/post/$postId`; the spec requires `/p/:postCode` and `/p/:postCode/:slug`.
- The database has no v1 `posts.public_code` contract and public APIs still use internal-style ids.
- There is no server-rendered Open Graph HTML for `/p/:postCode`; this is the highest-priority v1 share-loop requirement.
- Post creation, comment creation, reactions, report creation, moderation actions, blocking, and event ingestion are not implemented.
- Auth verifies Clerk tokens but does not yet attach or lazily sync a local Doomscrollr user.
- Shared schemas and DB schema still carry deferred/full-platform concepts: uploads, GIPHY/Tenor, mature/suggestive gates, age verification, ads, hot/top ranking runs, feed rank tables, and saved posts.
- Mock and seed data include uploads, GIF providers, ad-safety concepts, and ranking-themed data that should not be part of the v1 validation contract.
- Share, report, vote, and comment controls exist in the UI but are mostly inert.
- Basic rate limits and anonymous `ds_aid` funnel tracking are missing.

## Ordering Principle

Build only what supports this loop:

```txt
Create post -> Share to WhatsApp -> Friend opens -> Friend reacts/comments -> Creator returns
```

Do not start v2 work until the v1 acceptance checklist in `specs/doomscrollr_spec_v1.md` is satisfied or deliberately revised.

Implementation tasks in this roadmap are subordinate to the v1 spec. When a task is ambiguous,
resolve it by reading the relevant section of `specs/doomscrollr_spec_v1.md` before changing code.

## Phase 0: Freeze The V1 Contract

Goal: stop current platform-era drift before adding more behavior.

- [ ] Decide whether the local database can be reset.
  - If no production data exists, replace current migrations with a fresh v1 baseline.
  - If data must be preserved, create cleanup migrations that move from current schema to v1.
- [ ] Mark v1 as the active implementation contract in root `README.md`.
- [ ] Keep the strategic roadmap limited to version-ladder decisions.
- [ ] Remove or hide v1-excluded UI entry points before they become product commitments:
  - upload tab
  - GIF search tab
  - ad slot
  - ad status sidebar
  - hot/top ranking route copy
- [ ] Add spec-alignment tests that fail when v1-excluded API fields/providers reappear.

## Phase 1: Reset Shared And Database Contracts

Goal: make the data model match v1 before implementing writes.

- [ ] Add app-side ID helpers:
  - UUIDv7 internal ids
  - public post/comment code generator
  - profanity/slur rejection hook for generated public codes
  - slug generator
- [ ] Replace public API identifiers with public codes:
  - posts expose `publicCode`
  - comments expose `publicCode`
  - canonical URLs use `publicCode` and slug
  - internal ids stay server-side
- [ ] Reshape posts to v1 post kinds:
  - `text`
  - `external_image`
  - `youtube`
- [ ] Remove v1-excluded schema fields/tables or move them behind future migrations:
  - upload provider
  - GIPHY/Tenor providers
  - mature content fields
  - age verification
  - ad eligibility/manual ad fields
  - materialized feed rank runs
  - saved posts
- [ ] Add required v1 tables:
  - `post_reactions`
  - `comment_reactions`
  - `user_blocks`
  - `post_events`
- [ ] Add required v1 columns:
  - `posts.public_code`
  - `posts.post_kind`
  - `posts.slug`
  - `posts.body_text`
  - `posts.image_url`
  - `posts.youtube_url`
  - `posts.youtube_video_id`
  - `posts.youtube_is_short`
  - `comments.public_code`
  - report/removal fields from the v1 spec
- [ ] Keep tags only if they stay curated and simple.
- [ ] Rewrite shared Zod schemas around the v1 API contract.
- [ ] Rewrite mock and seed data to include only text, external image-link, and YouTube/Shorts posts.
- [ ] Add database/schema tests for:
  - one-level comments
  - valid post-kind field combinations
  - public-code uniqueness
  - no mature/upload/GIF/ranking/ad paths in v1 contracts

## Phase 2: Align Public Routes And Read APIs

Goal: make every read path use v1 public routing.

- [ ] Add `GET /api/feed/recent`.
- [ ] Keep or redirect `GET /api/posts` only as a temporary compatibility path during migration.
- [ ] Change post detail to `GET /api/posts/:postCode`.
- [ ] Change comments read path to `GET /api/posts/:postCode/comments`.
- [ ] Add `GET /api/users/:username` and profile post reads using public post shapes.
- [ ] Add optional `GET /api/tags/:tagSlug/posts` only if curated tags remain in v1.
- [ ] Push block filters into feed/profile/comment SQL once blocking exists.
- [ ] Add 404 behavior for removed/unpublished posts that does not leak unsafe removed content.
- [ ] Update frontend routes:
  - `/`
  - `/p/$postCode`
  - `/p/$postCode/$slug`
  - `/$username` for `@username`
  - optional `/t/$tagSlug`
- [ ] Replace all frontend links that use `/post/$postId`.

## Phase 3: Ship Preview-First Sharing

Goal: make WhatsApp sharing work before broadening product behavior.

- [ ] Introduce the Hono web route for:
  - `GET /p/:postCode`
  - `GET /p/:postCode/:slug`
- [ ] Ensure this route runs before any SPA fallback.
- [ ] Resolve published posts server-side by `postCode`.
- [ ] Return initial HTML with post-specific Open Graph tags.
- [ ] Include:
  - `og:title`
  - `og:description`
  - `og:url`
  - `og:type`
  - `og:image`
  - canonical link
  - `twitter:card`
  - normal React mount point
- [ ] Use absolute production URLs for all OG URLs.
- [ ] Add preview image rules:
  - text posts use a safe generic preview image
  - YouTube posts use YouTube thumbnail
  - external images use the image only after basic validation; otherwise fallback
- [ ] Add stale/missing slug handling.
- [ ] Add unavailable-post HTML for removed/missing posts.
- [ ] Add acceptance tests:
  - `curl -A "WhatsApp" /p/:postCode/:slug` contains OG tags without JavaScript
  - normal browser response still boots the React app

## Phase 4: Make Post Creation Real

Goal: allow users to create the three v1 post types.

- [ ] Extend auth middleware to attach local product user context.
- [ ] Implement lazy Clerk-to-Doomscrollr user upsert.
- [ ] Add username setup/update flow if the local user lacks a valid handle.
- [ ] Implement `POST /api/posts`.
- [ ] Validate text posts:
  - title
  - body text
  - optional curated tags
- [ ] Validate external image-link posts:
  - http/https only
  - reject private/internal IP ranges
  - reject SVG
  - content-type checks when detectable
  - timeout-safe probing
- [ ] Validate YouTube/Shorts posts:
  - parse supported URL forms
  - store video id
  - store `youtube_is_short`
  - avoid requiring YouTube Data API for v1
- [ ] Generate public code and slug transactionally.
- [ ] Return the canonical post URL after creation.
- [ ] Replace the create shell with v1 tabs only:
  - Text
  - Image link
  - YouTube/Shorts
- [ ] Add create-post tests for success and invalid-source rejection.

## Phase 5: Instrument The Share Funnel

Goal: capture the validation signals without building analytics product surface.

- [ ] Set a first-party `ds_aid` cookie on public routes.
- [ ] Add `POST /api/events` as the only public write endpoint.
- [ ] Accept only client-observable event types:
  - `post_opened`
  - `whatsapp_share_clicked`
  - `copy_link_clicked`
  - `native_share_clicked`
- [ ] Reject client-submitted server-only event types:
  - `comment_created`
  - `reaction_created`
- [ ] Store `post_events` with:
  - `post_id`
  - optional `actor_user_id`
  - nullable `anon_session_id`
  - event type
  - coarse metadata only
- [ ] Do not persist raw IP in `post_events`.
- [ ] Add WhatsApp share, copy link, and native share controls.
- [ ] Fire events from share controls and post-open views.
- [ ] Add event-rate limits by IP and `ds_aid`.
- [ ] Add lightweight SQL/script queries for the v1 validation funnel.

## Phase 6: Add Comments And Reactions

Goal: let friends interact after opening a shared post.

- [ ] Implement `POST /api/posts/:postCode/comments`.
- [ ] Implement one-level replies.
- [ ] Enforce parent comment belongs to the same post.
- [ ] Enforce replies cannot reply to replies.
- [ ] Implement `POST /api/posts/:postCode/reactions`.
- [ ] Implement `POST /api/comments/:commentCode/reactions`.
- [ ] Implement reaction update/delete behavior.
- [ ] Update counters transactionally:
  - post score
  - post reaction count or up/down counts
  - comment count
  - comment score
  - comment reaction count or up/down counts
  - reply count
- [ ] Emit server-side `comment_created` and `reaction_created` events inside write handlers.
- [ ] Wire frontend comment composer.
- [ ] Wire frontend post/comment reaction buttons.
- [ ] Add signed-out states that guide users to sign in without blocking read access.

## Phase 7: Add V1 Safety Controls

Goal: protect the loop enough for real testers.

- [ ] Implement `POST /api/reports`.
- [ ] Support report targets:
  - post
  - comment
  - user
- [ ] Implement admin report queue reads under `/api/admin/reports`.
- [ ] Implement admin actions:
  - remove post
  - restore post
  - remove comment
  - restore comment
  - dismiss report
- [ ] Enforce admin role checks server-side, not only Clerk sign-in.
- [ ] Implement `POST /api/users/:username/block`.
- [ ] Implement `DELETE /api/users/:username/block`.
- [ ] Enforce block rules in SQL for feeds and comments.
- [ ] Prevent blocked users from commenting on blocker-owned posts or replying to blocker-owned comments.
- [ ] Add basic rate limits:
  - create post
  - create comment
  - react/vote
  - report
  - external image validation
  - event ingestion
- [ ] Keep raw IP only in short-lived rate-limit storage.

## Phase 8: Mobile V1 Polish And Launch Readiness

Goal: make the validation product usable by invited testers.

- [ ] Audit the mobile feed and post detail pages around the core loop.
- [ ] Make share controls prominent on post detail.
- [ ] Make canonical URL copying reliable.
- [ ] Add empty, loading, error, removed-post, and signed-out states.
- [ ] Keep the feed recent-only with keyset pagination.
- [ ] Confirm no mature/NSFW, upload, GIF-search, ad, or ranking surface remains in v1 UI/API.
- [ ] Add end-to-end smoke checks for:
  - sign in
  - choose username
  - create text post
  - create external image-link post
  - create YouTube/Shorts post
  - open `/p/:postCode`
  - WhatsApp OG curl check
  - share click event
  - comment after sign-in
  - react after sign-in
  - report post/comment
  - block user
  - admin remove/restore
- [ ] Update root README with the actual v1 commands and launch checklist.

## Phase 9: V1 Validation Run

Goal: answer the product question before expanding scope.

- [ ] Seed a small set of SFW posts.
- [ ] Invite a small tester group.
- [ ] Ask creators to create posts and share canonical URLs to WhatsApp.
- [ ] Measure:
  - created posts
  - posts per creator
  - WhatsApp share clicks
  - copy link clicks
  - post opens from shared links
  - comments from visitors
  - reactions from visitors
  - new users after opening shared posts
  - creators returning after comments/reactions
  - friends creating their own posts
- [ ] Collect qualitative feedback on:
  - create flow
  - WhatsApp preview quality
  - mobile post page
  - comment friction
  - report/block confidence
- [ ] Decide whether v1 needs iteration or earns v2 planning.

## V2 Gate

Do not begin v2 by default.

Start v2 only when v1 shows real sharing and discussion behavior, and only for the weak parts proven by usage:

- better mobile/PWA polish
- notifications/mentions
- stronger curated tags
- reposts/quote posts
- stronger moderation queue
- Redis-backed rate limits
- optional BELL short links
- optional single additional media provider

Continue to defer DOOM uploads, mature/adult UGC, ads, ranking runs, communities/friend circles, search, collections, remixes, meme battles, and analytics dashboards until the roadmap earn-back triggers are met.

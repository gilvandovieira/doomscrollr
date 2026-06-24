# Doomscrollr Roadmap

**Status:** v1 implementation largely complete as of 2026-06-24\
**Source specs:** `specs/specs/doomscrollr_spec_v1.md`,
`specs/specs/doomscrollr_spec_v2_milestone.md`, `specs/specs/doomscrollr_spec_v3_target.md`

The active v1 source of truth is `specs/specs/doomscrollr_spec_v1.md`. If this roadmap conflicts
with the v1 spec, the v1 spec wins.

> **Progress (2026-06-24):** The drifted "v2.2" full-platform model was dropped and the whole stack
> was rebuilt to the v1 spec. Sections 1–10 are complete: packages typecheck, unit tests pass, E2E
> tests pass, the web app builds, OG/feed/event read paths are verified, block filtering is pushed
> into feed/comment SQL, the v1 funnel report script exists, and desktop/mobile browser smoke covers
> canonical post routes plus authenticated create/comment/react/report/block flows. **Remaining v1
> gap:** the live validation run with real testers (section 11). Verified-end-to-end items are
> checked; live-market items remain unchecked until actual tester data exists.

The product bet is:

```txt
Create post -> Share to WhatsApp -> Friend opens -> Friend reacts/comments -> Creator returns
```

v2 and v3 are not automatic. They are earned only if v1 proves real sharing, discussion, and return
behavior.

## V1: Validation Product

Goal: ship a SFW, mobile-first product that validates WhatsApp sharing and focused post discussion.

### 1. Lock The V1 Contract

- [x] `V1-001` Treat `specs/specs/doomscrollr_spec_v1.md` as the controlling implementation
      contract.
- [x] `V1-002` Keep v2/v3 specs as future planning only.
- [x] `V1-003` Remove or hide v1-excluded product surface from the current app:
  - GIF search
  - native uploads
  - ads/ad eligibility
  - mature/suggestive gates
  - age verification
  - hot/top ranking
  - saved posts/collections
- [x] `V1-004` Add contract tests or schema tests that catch v1-excluded fields/providers returning
      through public APIs.
- [x] `V1-005` Update README and docs whenever implementation scope changes.

### 2. Reset Data And Shared Contracts

- [x] `V1-006` Decide whether local database history can be reset or needs cleanup migrations.
      _(clean wipe: drop the `postgres_data` volume + single rewritten `0001` migration.)_
- [x] `V1-007` Add app-side UUIDv7 internal id generation.
- [x] `V1-008` Add public code generation for posts and comments.
- [x] `V1-009` Add slug generation for readable post URLs.
- [x] `V1-010` Add reserved username validation.
- [x] `V1-011` Add public-code profanity/slur rejection hook.
- [x] `V1-012` Align database schema to v1:
  - users
  - posts
  - comments
  - post reactions
  - comment reactions
  - reports
  - user blocks
  - optional curated tags
  - post events
- [x] `V1-013` Align shared Zod schemas to v1:
  - text posts
  - external image-link posts
  - YouTube/Shorts posts
  - recent feed only
  - public post/comment codes
  - SFW-only content state
- [x] `V1-014` Rewrite mock and seed data so it only uses v1-supported post kinds.

### 3. Public Routes And Read APIs

- [x] `V1-015` Add canonical public web routes: _(`/t/:tagSlug` optional, not built)_
  - `GET /`
  - `GET /p/:postCode`
  - `GET /p/:postCode/:slug`
  - `GET /@:username`
  - optional `GET /t/:tagSlug`
- [x] `V1-016` Add public API routes: _(`/api/tags/:tagSlug/posts` optional, not built)_
  - `GET /api/feed/recent`
  - `GET /api/posts/:postCode`
  - `GET /api/posts/:postCode/comments`
  - `GET /api/users/:username`
  - optional `GET /api/tags/:tagSlug/posts`
- [x] `V1-017` Stop exposing internal database ids in public URLs or API contracts.
- [x] `V1-018` Keep recent feed keyset pagination with `created_at + id`.
- [x] `V1-019` Return safe unavailable pages for removed or missing posts.
- [x] `V1-020` Push block filters into feed/comment SQL when blocking is implemented. _(feed,
      profile, post-detail, and comment-list filters are SQL-backed; covered by E2E.)_

### 4. Preview-First Sharing

- [x] `V1-021` Add Hono handlers for `GET /p/:postCode` and `GET /p/:postCode/:slug` before any SPA
      fallback.
- [x] `V1-022` Resolve the post server-side and return initial HTML with post-specific metadata.
- [x] `V1-023` Include required Open Graph tags:
  - `og:title`
  - `og:description`
  - `og:url`
  - `og:type`
  - `og:image`
- [x] `V1-024` Include canonical link, page description, and `twitter:card`.
- [x] `V1-025` Use absolute URLs for all OG links/images.
- [x] `V1-026` Use safe generic preview images for text and unavailable posts.
- [x] `V1-027` Use YouTube thumbnails for YouTube/Shorts posts.
- [x] `V1-028` Validate external image URLs before using them as `og:image`; fallback when unsafe or
      unavailable.
- [x] `V1-029` Add curl acceptance checks proving WhatsApp metadata exists without JavaScript.
      _(verified live; not yet a committed automated test.)_

### 5. Auth And Local Users

- [x] `V1-030` Verify Clerk tokens on protected API routes.
- [x] `V1-031` Attach authenticated Clerk identity to request context.
- [x] `V1-032` Lazily upsert local Doomscrollr users on first authenticated API request.
- [x] `V1-033` Add username setup flow for users without a valid local handle.
- [x] `V1-034` Enforce local user status for writes:
  - active
  - limited
  - suspended
  - banned
- [x] `V1-035` Enforce admin role checks server-side.

### 6. Post Creation

- [x] `V1-036` Implement `POST /api/posts`.
- [x] `V1-037` Support text posts.
- [x] `V1-038` Support external image-link posts.
- [x] `V1-039` Support YouTube/Shorts posts.
- [x] `V1-040` Validate titles, bodies, URLs, and post-kind-specific fields.
- [x] `V1-041` Reject private/internal image URLs.
- [x] `V1-042` Reject SVG and unsafe/unknown image types when detectable.
- [x] `V1-043` Parse supported YouTube URL forms.
- [x] `V1-044` Store YouTube video id and `youtube_is_short`.
- [x] `V1-045` Generate public code and slug during creation.
- [x] `V1-046` Attach optional curated tags if tags remain in v1.
- [x] `V1-047` Return canonical post URL after creation.
- [x] `V1-048` Build the frontend create flow with tabs:
  - Text
  - Image link
  - YouTube/Shorts

### 7. Share Funnel Tracking

- [x] `V1-049` Set a first-party anonymous `ds_aid` cookie on public routes.
- [x] `V1-050` Implement public `POST /api/events`.
- [x] `V1-051` Accept only client-submitted event types:
  - `post_opened`
  - `whatsapp_share_clicked`
  - `copy_link_clicked`
  - `native_share_clicked`
- [x] `V1-052` Reject client-submitted `comment_created` and `reaction_created`.
- [x] `V1-053` Store post events with optional authenticated user and nullable anonymous session id.
- [x] `V1-054` Do not persist raw IP addresses in `post_events`.
- [x] `V1-055` Add WhatsApp share, copy link, and native share controls.
- [x] `V1-056` Fire share/open events from the frontend.
- [x] `V1-057` Add basic event ingestion rate limits.
- [x] `V1-058` Add simple SQL/script reporting for the v1 funnel. _(`deno task report:funnel`
      summarizes creation, event counts, and top posts.)_

### 8. Comments And Reactions

- [x] `V1-059` Implement `POST /api/posts/:postCode/comments`.
- [x] `V1-060` Implement flat or one-level comments.
- [x] `V1-061` If replies are enabled, block replies to replies.
- [x] `V1-062` Validate parent comments belong to the same post.
- [x] `V1-063` Implement `POST /api/posts/:postCode/reactions`.
- [x] `V1-064` Implement `POST /api/comments/:commentCode/reactions`.
- [x] `V1-065` Support reaction update/delete behavior.
- [x] `V1-066` Update scores and counters transactionally.
- [x] `V1-067` Emit server-side `comment_created` events.
- [x] `V1-068` Emit server-side `reaction_created` events.
- [x] `V1-069` Wire frontend comment composer and reaction buttons.

### 9. Safety, Blocking, And Moderation

- [x] `V1-070` Implement `POST /api/reports`.
- [x] `V1-071` Support report targets:
  - post
  - comment
  - user
- [x] `V1-072` Implement admin report queue.
- [x] `V1-073` Implement admin post remove/restore.
- [x] `V1-074` Implement admin comment remove/restore.
- [x] `V1-075` Implement report dismissal.
- [x] `V1-076` Implement user blocking:
  - `POST /api/users/:username/block`
  - `DELETE /api/users/:username/block`
- [x] `V1-077` Hide blocked users' posts and comments from the blocker. _(posts and comments are
      covered by E2E.)_
- [x] `V1-078` Prevent blocked users from commenting on blocker-owned posts.
- [x] `V1-079` Prevent blocked users from replying to blocker-owned comments.
- [x] `V1-080` Add basic rate limits for:
  - create post
  - create comment
  - react/vote
  - report
  - external image validation
  - event ingestion

### 10. V1 UI Polish And Launch Readiness

- [x] `V1-081` Make the mobile feed single-column-first and recent-only.
- [x] `V1-082` Make post detail pages optimized around share, comment, and react.
- [x] `V1-083` Add signed-out states that preserve read access.
- [x] `V1-084` Add loading, empty, error, removed-post, and blocked-user states.
      _(loading/empty/error/removed done; blocked handled via SQL filtering + block control.)_
- [x] `V1-085` Add report and block UI.
- [x] `V1-086` Remove v1-excluded navigation and placeholders.
- [x] `V1-087` Validate `/p/:postCode` and `/p/:postCode/:slug` on desktop and mobile. _(covered by
      browser E2E plus OG E2E.)_
- [x] `V1-088` Run smoke checks for: _(API E2E plus mobile browser smoke using the gated test-auth
      seam.)_
  - sign in
  - choose username
  - create each v1 post kind
  - open canonical post URL
  - WhatsApp OG curl check
  - share event
  - comment
  - react
  - report
  - block
  - admin remove/restore

### 11. V1 Validation Run

- [x] `V1-089` Seed a small set of SFW posts. _(dev seed: 4 users, 4 tags, 5 posts, comments;
      refresh for the live run.)_
- [ ] `V1-090` Invite a small tester group.
- [ ] `V1-091` Ask creators to create posts and share canonical URLs to WhatsApp.
- [ ] `V1-092` Measure:
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
  - _Quantitative counters are available through `deno task report:funnel`; live-run interpretation
    still requires real tester traffic._
- [ ] `V1-093` Collect feedback on creation, previews, mobile reading, commenting, reporting, and
      blocking.
- [ ] `V1-094` Decide whether to iterate v1 or open v2 planning.

## V2: Earned Milestone

Goal: strengthen retention, safety, and sharing only after v1 proves the loop.

### V2 Gate

- [ ] `V2-001` Confirm v1 produced real shared post opens.
- [ ] `V2-002` Confirm visitors reacted, commented, or created posts after opening shared links.
- [ ] `V2-003` Confirm creators returned after comments or reactions.
- [ ] `V2-004` Identify the specific weak points v2 should improve.
- [ ] `V2-005` Keep the WhatsApp loop central.

### V2 Tasks

- [x] `V2-006` Improve mobile/PWA polish:
  - installable manifest
  - app icons
  - better back/forward behavior
  - offline fallback page
  - cached static app shell
  - improved touch/share UX
- [x] `V2-007` Strengthen curated tags if v1 tags prove useful:
  - [x] tag directory
  - [x] tag pages
  - [x] admin tag creation/disable
  - [x] tag aliases/merges
  - [x] tag moderation on posts
    - _Post creation now uses active curated tags only._
  - [x] popular tags screen/sidebar
- [x] `V2-008` Add in-app notifications:
  - [x] reply to your post
  - [x] reply to your comment
  - [x] mention via `@username`
  - [x] moderation outcome
- [x] `V2-009` Add mention rules and spam limits.
- [x] `V2-010` Add reposts/quote posts only after moderation/blocking are solid.
- [x] `V2-011` Upgrade moderation:
  - report filters
  - bulk dismiss/action
  - moderator notes
  - basic audit log
  - user suspension/ban flow
  - restore history
- [ ] `V2-012` Move rate limits to Redis or another shared store if needed.
- [ ] `V2-013` Add internal trust levels:
  - new
  - normal
  - trusted
  - limited
  - moderator
  - admin
- [ ] `V2-014` Consider BELL short links only if canonical URLs are too long or attribution matters.
- [ ] `V2-015` Consider suggestive non-NSFW content only after user controls and moderation capacity
      exist.
- [ ] `V2-016` Consider one additional media provider only if users request it repeatedly.

### Still Not V2 By Default

- [ ] `V2-017` Do not add mature/adult UGC.
- [ ] `V2-018` Do not add age verification.
- [ ] `V2-019` Do not make AdSense or ads core architecture.
- [ ] `V2-020` Do not add full DOOM uploads unless usage clearly earns it.
- [ ] `V2-021` Do not add materialized ranking runs by default.
- [ ] `V2-022` Do not add communities/friend circles unless user behavior demands them.
- [ ] `V2-023` Do not add full search unless tags/profiles are insufficient.

## V3: Earned Platform Target

Goal: expand into platform infrastructure only after v1 and v2 prove retention, sharing, moderation
capacity, and demand.

### V3 Gate

- [ ] `V3-001` Confirm v1/v2 show sustained creation and sharing.
- [ ] `V3-002` Confirm moderation workload is manageable.
- [ ] `V3-003` Confirm users have clear demand for platform capabilities.
- [ ] `V3-004` Confirm each new subsystem has a fallback/degradation story.
- [ ] `V3-005` Keep canonical post viewing independent from optional infrastructure.

### V3 Tasks

- [ ] `V3-006` Preserve Scrollr as the core system for:
  - users
  - profiles
  - posts
  - feeds
  - comments
  - reactions/votes
  - reports
  - blocking
  - moderation
  - public routes
  - tags
  - provider posts
  - sharing integration
- [ ] `V3-007` Expand post kinds only when earned:
  - link
  - provider GIF
  - uploaded image
  - uploaded GIF
  - quote
- [ ] `V3-008` Reintroduce a media asset abstraction only if media complexity requires it.
- [ ] `V3-009` Document per-provider state machines before adding provider complexity.
- [ ] `V3-010` Deepen comments only if shallow comments become limiting.
- [ ] `V3-011` Avoid `ltree` until subtree queries are proven necessary.
- [ ] `V3-012` Build BELL as an internal-only sharing subsystem if earned:
  - `/s/:shortCode`
  - short link creation
  - short link resolution
  - WhatsApp helpers
  - privacy-safe share/click events
  - optional QR links
- [ ] `V3-013` Ensure BELL never becomes a generic public URL shortener.
- [ ] `V3-014` Build DOOM uploads if earned:
  - multipart image/GIF upload
  - S3-compatible storage
  - RustFS local development
  - image/GIF validation
  - optimization variants
  - media worker
  - cleanup jobs
- [ ] `V3-015` Keep text, external image, YouTube, comments, and feeds working if DOOM is
      unavailable.
- [ ] `V3-016` Add providers one at a time; do not add GIPHY and Tenor together by default.
- [ ] `V3-017` Add stronger ranking only if recent feed is insufficient:
  - cheap hot query first if possible
  - materialized ranking runs only if measured need exists
  - lazy/on-demand materialization for active surfaces
- [ ] `V3-018` Add stronger discovery only if tags/profiles are insufficient:
  - search
  - profile discovery
  - stronger tag aliases/merges
- [ ] `V3-019` Choose communities or friend circles only after user behavior clarifies the need.
- [ ] `V3-020` Expand moderation proportionally:
  - blocked tags/domains
  - trusted-user review priority
  - content reclassification
  - deeper audit/restore flows
- [ ] `V3-021` Add monetization only after retention and moderation are proven.
- [ ] `V3-022` Keep monetization provider-agnostic.

### Out Of Default Roadmap

- [ ] `V3-NG-001` Mature/adult UGC.
- [ ] `V3-NG-002` Nudity or pornography.
- [ ] `V3-NG-003` Age-gated NSFW feeds.
- [ ] `V3-NG-004` Adult monetization.
- [ ] `V3-NG-005` Native video hosting.
- [ ] `V3-NG-006` Generic URL shortener.
- [ ] `V3-NG-007` Unbounded public tag creation.
- [ ] `V3-NG-008` Unbounded communities.
- [ ] `V3-NG-009` Full Reddit clone behavior without demand.
- [ ] `V3-NG-010` Provider zoo.
- [ ] `V3-NG-011` AdSense-dependent architecture.
- [ ] `V3-NG-012` Analytics surveillance product.

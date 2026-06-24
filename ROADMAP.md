# Doomscrollr Roadmap

**Status (2026-06-24):** v1 **and** v2 engineering are shipped and verified. The next gate is a live
validation run with real testers — a product activity, not more building.

**Sources of truth**

- v1 implementation contract: `specs/specs/doomscrollr_spec_v1.md` (wins any conflict).
- Version ladder: `specs/doomscrollr_roadmap_v1_v2_v3_future.md`.
- Live-run playbook + funnel: `specs/VALIDATION.md`.

## How to read this roadmap

This roadmap keeps four kinds of item deliberately apart, because they are owned by different people
and "done" means something different for each:

- 🔧 **Engineering** — concrete build work. `[x]` = shipped and verified. These are the only true
  _tasks_.
- ◇ **Validation gate** — a usage question answered by real testers, measured with
  `deno task report:funnel`, detailed in `specs/VALIDATION.md`. A gate clears the next engineering
  phase only when real data passes it. **An engineer never "checks off" a gate** — it is a product
  decision, not a code change.
- 🚧 **Earned backlog** — future work that stays unbuilt until a named usage trigger fires. Not
  committed; it is promoted into Engineering only when its trigger is met.
- ✋ **Guardrail** — something we deliberately do **not** build by default. A constraint, not a
  task; it is never completed or checked off.

The product bet:

```txt
Create post -> Share to WhatsApp -> Friend opens -> Friend reacts/comments -> Creator returns
```

v2 and v3 are _earned_, not scheduled. They open only if v1 proves real sharing, discussion, and
return behavior.

## Where things stand

- 🔧 **v1 engineering: complete.** 🔧 **v2 engineering: complete.** There is no committed
  engineering task currently open — everything below v2 is either a validation gate, earned backlog,
  or a guardrail.
- ◇ **The real open item is the v1 validation run** (invite testers → measure the funnel → collect
  feedback). See [Validation gates](#-validation-gates--product-run-not-engineering) and
  `specs/VALIDATION.md`.
- Note: v2 was built ahead of completing the v1 validation evidence (a founder call). That makes the
  validation gate _more_ important, not less — the usage proof is still outstanding.

---

## 🔧 Engineering

### v1 — Validation product · ✅ complete

All v1 build sections are shipped, typechecked, unit/E2E-tested, and browser-smoke-covered. IDs map
to `specs/doomscrollr_v1_implementation_roadmap.md`.

- ✅ **1. Lock the v1 contract** — `V1-001`–`V1-005`
- ✅ **2. Reset data & shared contracts** — `V1-006`–`V1-014`
- ✅ **3. Public routes & read APIs** — `V1-015`–`V1-020`
- ✅ **4. Preview-first sharing (server-rendered OG)** — `V1-021`–`V1-029`
- ✅ **5. Auth & local users** — `V1-030`–`V1-035`
- ✅ **6. Post creation (text / image-link / YouTube)** — `V1-036`–`V1-048`
- ✅ **7. Share-funnel tracking** — `V1-049`–`V1-058`
- ✅ **8. Comments & reactions** — `V1-059`–`V1-069`
- ✅ **9. Safety, blocking, moderation** — `V1-070`–`V1-080`
- ✅ **10. UI polish & launch readiness** — `V1-081`–`V1-088`
- ✅ **Seed data for the run** — `V1-089` (dev seed: 4 users, 4 tags, 5 posts, comments)

<details>
<summary>Full v1 task list (expand)</summary>

#### 1. Lock the v1 contract

- [x] `V1-001` Treat `specs/specs/doomscrollr_spec_v1.md` as the controlling implementation
      contract.
- [x] `V1-002` Keep v2/v3 specs as future planning only.
- [x] `V1-003` Remove/hide v1-excluded surface (GIF search, native uploads, ads, mature/suggestive
      gates, age verification, hot/top ranking, saved posts).
- [x] `V1-004` Contract/schema tests that catch v1-excluded fields/providers in public APIs.
- [x] `V1-005` Keep README/docs in sync when scope changes.

#### 2. Reset data & shared contracts

- [x] `V1-006` Clean DB reset (drop `postgres_data` volume + single rewritten `0001` migration).
- [x] `V1-007` App-side UUIDv7 internal ids.
- [x] `V1-008` Public code generation for posts and comments.
- [x] `V1-009` Slug generation for readable post URLs.
- [x] `V1-010` Reserved username validation.
- [x] `V1-011` Public-code profanity/slur rejection hook.
- [x] `V1-012` Align DB schema to v1 (users, posts, comments, post/comment reactions, reports,
      blocks, optional curated tags, post events).
- [x] `V1-013` Align shared Zod schemas to v1 (text / external-image / YouTube posts, recent feed,
      public codes, SFW-only state).
- [x] `V1-014` Rewrite mock/seed data to v1-supported post kinds only.

#### 3. Public routes & read APIs

- [x] `V1-015` Canonical public web routes (`/`, `/p/:postCode`, `/p/:postCode/:slug`,
      `/@:username`; `/t/:tagSlug` optional, not built).
- [x] `V1-016` Public API routes (`/api/feed/recent`, `/api/posts/:postCode`,
      `/api/posts/:postCode/comments`, `/api/users/:username`; `/api/tags/:tagSlug/posts` optional,
      not built).
- [x] `V1-017` Stop exposing internal database ids in public URLs/contracts.
- [x] `V1-018` Recent-feed keyset pagination with `created_at + id`.
- [x] `V1-019` Safe unavailable pages for removed/missing posts.
- [x] `V1-020` Push block filters into feed/comment SQL (feed, profile, post-detail, comment-list;
      E2E-covered).

#### 4. Preview-first sharing

- [x] `V1-021` Hono handlers for `/p/:postCode` and `/p/:postCode/:slug` before SPA fallback.
- [x] `V1-022` Resolve the post server-side and return post-specific HTML metadata.
- [x] `V1-023` Required OG tags (`og:title`, `og:description`, `og:url`, `og:type`, `og:image`).
- [x] `V1-024` Canonical link, page description, `twitter:card`.
- [x] `V1-025` Absolute URLs for all OG links/images.
- [x] `V1-026` Safe generic preview images for text/unavailable posts.
- [x] `V1-027` YouTube thumbnails for YouTube/Shorts posts.
- [x] `V1-028` Validate external image URLs before use as `og:image`; fallback when unsafe.
- [x] `V1-029` curl acceptance checks for WhatsApp metadata without JS (verified live; not yet a
      committed test).

#### 5. Auth & local users

- [x] `V1-030` Verify Clerk tokens on protected routes.
- [x] `V1-031` Attach authenticated Clerk identity to request context.
- [x] `V1-032` Lazily upsert local users on first authenticated request.
- [x] `V1-033` Username setup flow for users without a valid local handle.
- [x] `V1-034` Enforce local user status for writes (active / limited / suspended / banned).
- [x] `V1-035` Enforce admin role checks server-side.

#### 6. Post creation

- [x] `V1-036` `POST /api/posts`.
- [x] `V1-037` Text posts. · [x] `V1-038` External image-link posts. · [x] `V1-039` YouTube/Shorts
      posts.
- [x] `V1-040` Validate titles, bodies, URLs, kind-specific fields.
- [x] `V1-041` Reject private/internal image URLs. · [x] `V1-042` Reject SVG/unsafe image types when
      detectable.
- [x] `V1-043` Parse supported YouTube URL forms. · [x] `V1-044` Store video id and
      `youtube_is_short`.
- [x] `V1-045` Generate public code and slug at creation. · [x] `V1-046` Attach optional curated
      tags.
- [x] `V1-047` Return canonical post URL after creation.
- [x] `V1-048` Create flow with tabs (Text / Image link / YouTube-Shorts).

#### 7. Share-funnel tracking

- [x] `V1-049` First-party anonymous `ds_aid` cookie on public routes.
- [x] `V1-050` Public `POST /api/events`.
- [x] `V1-051` Accept only client event types (`post_opened`, `whatsapp_share_clicked`,
      `copy_link_clicked`, `native_share_clicked`).
- [x] `V1-052` Reject client-submitted `comment_created` / `reaction_created`.
- [x] `V1-053` Store events with optional user + nullable anon session id.
- [x] `V1-054` Do not persist raw IPs in `post_events`.
- [x] `V1-055` WhatsApp share / copy link / native share controls.
- [x] `V1-056` Fire share/open events from the frontend.
- [x] `V1-057` Basic event ingestion rate limits.
- [x] `V1-058` SQL/script funnel reporting (`deno task report:funnel`).

#### 8. Comments & reactions

- [x] `V1-059` `POST /api/posts/:postCode/comments`. · [x] `V1-060` Flat / one-level comments. · [x]
      `V1-061` Block replies to replies.
- [x] `V1-062` Validate parent comment belongs to the same post.
- [x] `V1-063` `POST /api/posts/:postCode/reactions`. · [x] `V1-064`
      `POST /api/comments/:commentCode/reactions`.
- [x] `V1-065` Reaction update/delete behavior. · [x] `V1-066` Scores/counters transactional.
- [x] `V1-067` Server-side `comment_created` events. · [x] `V1-068` Server-side `reaction_created`
      events.
- [x] `V1-069` Frontend comment composer + reaction buttons.

#### 9. Safety, blocking, moderation

- [x] `V1-070` `POST /api/reports`. · [x] `V1-071` Report targets (post / comment / user).
- [x] `V1-072` Admin report queue. · [x] `V1-073` Admin post remove/restore. · [x] `V1-074` Admin
      comment remove/restore. · [x] `V1-075` Report dismissal.
- [x] `V1-076` User blocking (`POST`/`DELETE /api/users/:username/block`).
- [x] `V1-077` Hide blocked users' posts/comments (E2E-covered). · [x] `V1-078` Block commenting on
      blocker posts. · [x] `V1-079` Block replying to blocker comments.
- [x] `V1-080` Basic rate limits (create post/comment, react, report, image validation, events).

#### 10. UI polish & launch readiness

- [x] `V1-081` Mobile feed single-column-first, recent-only.
- [x] `V1-082` Post detail optimized around share/comment/react.
- [x] `V1-083` Signed-out states preserve read access.
- [x] `V1-084` Loading/empty/error/removed-post/blocked-user states.
- [x] `V1-085` Report and block UI.
- [x] `V1-086` Remove v1-excluded navigation/placeholders.
- [x] `V1-087` Validate canonical post routes on desktop + mobile (browser + OG E2E).
- [x] `V1-088` Smoke checks (sign in, username, create each kind, open canonical URL, OG curl, share
      event, comment, react, report, block, admin remove/restore).
- [x] `V1-089` Seed a small set of SFW posts (refresh before the live run).

</details>

### v2 — Earned milestone · ✅ complete

v2 build investments shipped (mobile/PWA polish, curated tags + tag moderation, notifications +
mentions, reposts/quote posts, moderation upgrade, shared-store rate limits, internal trust levels).

- ✅ **PWA polish** — `V2-006`
- ✅ **Curated tags** (directory, pages, admin create/disable, aliases/merges, post moderation,
  popular sidebar) — `V2-007`
- ✅ **Notifications** (reply-to-post, reply-to-comment, `@mention`, moderation outcome) — `V2-008`
- ✅ **Mention rules & spam limits** — `V2-009`
- ✅ **Reposts / quote posts** — `V2-010`
- ✅ **Moderation upgrade** (filters, bulk dismiss/action, notes, audit log, suspend/ban, restore
  history) — `V2-011`
- ✅ **Shared-store rate limits** — `V2-012`
- ✅ **Internal trust levels** (new / normal / trusted / limited / moderator / admin) — `V2-013`
- 🚧 **Deferred-by-decision** — `V2-014` BELL short links, `V2-015` suggestive surface, `V2-016`
  extra media provider → moved to
  [Earned backlog](#-earned-backlog--build-only-when-the-trigger-fires).

> Recent follow-on work also shipped: post-kind sidebar filtering (lightweight discovery), an admin
> domain blocklist for media links, and a split of the admin console into **Moderation** and
> **Administration** surfaces.

### Production hardening — investigation track · 🔧 open

> The first real open engineering work since v1/v2 shipped, and the umbrella that **unblocks Gate
> A**: there is currently no way to deploy this for real testers. Today the API runs from source via
> `deno task dev` (`--watch`, no prod entry), `compose.yaml` only starts Postgres, there is no
> Dockerfile/CI/deploy config, env validation is dev-loose, and the only security middleware is
> CORS.
>
> Each item is a scoped **spike**: it ends in a short written decision (an ADR or a `docs/` note)
> plus a follow-up build ticket — not a guess committed straight to `main`. Grounded in the current
> stack: Deno workspace, Hono API on `Deno.serve`, postgres.js + Drizzle, a Vite/React SPA plus `/p`
> server-rendered OG pages, and Clerk auth.

**Runtime & deploy**

- [ ] `PROD-001` **Pin the deployment topology.** Decide and document how the three pieces ship: the
      Hono API (`apps/api`), the static web build (`apps/web` → `dist/`), and Postgres.
  - Investigate: the API serves only `/api`, `/health`, and server-rendered `/p` pages — nothing
    serves the SPA shell or hashed assets in prod (Vite does that in dev). `pages.routes.ts` links
    to a separate `WEB_ORIGIN`/`PUBLIC_BASE_URL` app origin. Decide one origin (API also serves
    `dist/` with SPA fallback) vs two origins (static host/CDN for the SPA + API origin), and the
    canonical-URL / CORS / cookie-domain consequences of each.
  - Done when: a written topology decision exists with the chosen host(s), origin map, and how `/p`
    canonical URLs resolve to the SPA in prod.
- [ ] `PROD-002` **Production runtime image + start command.** There is no `Dockerfile`, no
      `build:api`, and no non-`--watch` start task.
  - Investigate/deliver: a pinned-Deno container (or host runtime) image; a
    `deno task start`/`serve` that runs `apps/api/src/main.ts` with least-privilege flags (no
    blanket `-A`; enumerate `--allow-net/--allow-env/--allow-read` needs); `deno cache`/lockfile for
    reproducible deps; a matching static-web artifact step. Confirm `compose.yaml` is dev-only and
    add a prod compose/manifest.
  - Done when: a clean checkout builds and boots the API and web with one documented command set, no
    dev tooling in the runtime image.
- [ ] `PROD-003` **Graceful shutdown & connection draining.** `main.ts` calls `Deno.serve` with no
      `signal`/shutdown handling, so SIGTERM on deploy can drop in-flight requests and leak the
      pool.
  - Investigate/deliver: wire an `AbortController` into `Deno.serve`, trap SIGTERM/SIGINT, stop
    accepting new connections, drain in-flight work within a deadline, and close the postgres.js
    pool (`queryClient.end({ timeout })`) and any timers. Confirm behavior against the host's stop
    signal + grace period.
  - Done when: a rolling restart under light load shows zero dropped requests and no orphaned DB
    connections.

**Configuration & secrets**

- [ ] `PROD-004` **Production env contract that fails fast.** `packages/config/src/env.ts` makes
      `DATABASE_URL` and `CLERK_SECRET_KEY` optional, defaults `PUBLIC_BASE_URL` to `localhost`, and
      defaults `LOG_LEVEL` to `debug` — all wrong for prod.
  - Investigate/deliver: a refinement that, when `APP_ENV==="production"`, requires `DATABASE_URL`,
    `CLERK_SECRET_KEY`, `CLERK_AUTHORIZED_PARTIES`, a non-localhost `PUBLIC_BASE_URL`, and a sane
    `LOG_LEVEL` (≥`info`); add `WEB_ORIGIN` to the schema (it's read ad hoc in `app.ts`). Audit
    every `Deno.env.get(...)` call site so config flows through the validated schema. Confirm the
    gated test-auth seam (`APP_ENV==="test" && E2E_AUTH==="1"`) can never activate in prod.
  - Done when: booting prod with any required var missing exits non-zero with a precise message; no
    unvalidated `Deno.env.get` remains on a request path.
- [ ] `PROD-005` **Secrets handling & rotation.** Dev uses a root `.env.local`.
  - Investigate/deliver: the prod secret source (host secrets manager / orchestrator secrets), how
    secrets reach the container without landing in images or logs (pino redaction exists — verify it
    covers Clerk + DB creds), and a rotation procedure for `CLERK_SECRET_KEY` and the DB password.
  - Done when: a documented secret-injection + rotation runbook exists and no secret is present in
    the built image or log output.

**Database & data safety**

- [ ] `PROD-006` **Harden the DB client for managed Postgres.** `db/client.ts` uses
      `postgres(url, { max: 10, idle_timeout: 20 })` with no TLS, connect timeout, or statement
      timeout.
  - Investigate/deliver: TLS/`sslmode` for the managed provider, right-sized `max` against the
    provider's connection ceiling and the planned API replica count, `connect_timeout`, a
    server-side `statement_timeout`, and behavior when the DB is briefly unreachable (the app
    currently treats a missing client as "no DB" and silently serves mock data — confirm that
    fallback is impossible in prod).
  - Done when: pool settings are documented per environment and a forced DB blip degrades to clean
    5xx, never to mock data.
- [ ] `PROD-007` **Production migration & rollback flow.** Migrations are raw SQL `0001`–`0008` run
      by `packages/database/src/migrate.ts`; the v1 reset history shows migration drift caused a
      past outage (shorts insert failures).
  - Investigate/deliver: where/when migrations run in a deploy (pre-deploy job vs boot), idempotency
    & ordering guarantees, advisory-locking to stop concurrent runners, a forward-fix/rollback
    policy for destructive changes, and a check that code never deploys ahead of its required
    migration.
  - Done when: a deploy applies pending migrations exactly once, safely, with a documented rollback
    path.
- [ ] `PROD-008` **Backups, PITR, and a restore drill.** No backup story exists.
  - Investigate/deliver: automated backups + point-in-time recovery from the managed provider,
    RPO/RTO targets, and an actual restore rehearsal into a scratch instance.
  - Done when: a backup runs on schedule and a documented restore drill has succeeded at least once.
- [ ] `PROD-009` **Audit `rate_limit_buckets` growth & correctness.** The DB limiter
      (`lib/rate-limit.ts`) inserts/updates a row per key per window and never deletes expired rows,
      so the table grows unbounded; it's also a write on most requests.
  - Investigate/deliver: a cleanup job/TTL for expired buckets, an index/PK review on `bucket_key`,
    verification of fixed-window reset under concurrency, and whether the per-request write is
    acceptable at target load or should move to a faster store (ties to `V2-012`).
  - Done when: bucket rows are bounded over time and limits are proven correct under concurrent
    load.

**Security**

- [ ] `PROD-010` **Security headers & CSP.** `app.ts` sets only CORS. The `/p` server-rendered HTML
      and API responses ship no `Content-Security-Policy`, `Strict-Transport-Security`,
      `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or framing controls.
  - Investigate/deliver: a header middleware; a CSP that allows exactly what the app needs (Clerk,
    YouTube IFrame API + `youtube.com` embeds, `i.ytimg.com` thumbnails, external image hosts, the
    web origin) without `unsafe-inline` where avoidable; HSTS once TLS is terminated; framing policy
    that still lets YouTube embed _into_ us but blocks us from being framed.
  - Done when: headers are present on API + `/p` responses and the app (feed, post detail with
    embeds, Clerk) works under the CSP with no console violations.
- [ ] `PROD-011` **Prod CORS, cookies, and TLS review.** CORS hardcodes localhost origins plus
      `WEB_ORIGIN`; the `ds_aid` funnel cookie and Clerk session cross the API↔web boundary.
  - Investigate/deliver: lock CORS to the real prod origin(s); review `ds_aid` cookie attributes
    (`Secure`, `SameSite`, domain) for the chosen topology (`PROD-001`); confirm credentialed
    requests work cross-origin if two origins are chosen; enforce HTTPS end to end.
  - Done when: only prod origins are allowed, cookies carry correct prod attributes, and the
    authenticated + anonymous funnels work over HTTPS.
- [ ] `PROD-012` **SSRF audit of external-image validation.** Image-link posts fetch/validate
      arbitrary remote URLs (`V1-041`/`V1-042`, `lib/image-url.ts`), the classic SSRF surface.
  - Investigate/deliver: confirm rejection of private/loopback/link-local/metadata ranges (incl.
    IPv6 and IPv4-mapped), DNS-rebinding resistance (resolve-then-pin, re-check after redirects),
    capped redirect following, request timeouts, max content-length, and content-type allow-listing;
    verify the same protections apply to the YouTube oEmbed fetch.
  - Done when: a test suite of malicious URLs (private IPs, redirect-to-internal, oversized, wrong
    type) is all rejected, with cases committed.
- [ ] `PROD-013` **Auth, admin, and dependency hardening review.**
  - Investigate/deliver: swap Clerk to production keys + authorized parties; re-verify admin gating
    is server-enforced on every `/api/admin/*` route (not just the hidden UI entry); confirm error
    responses never leak internals (handler already hides stacks — verify in prod mode); add a
    dependency/version audit and a plan to keep Deno + npm deps patched.
  - Done when: prod auth is live, an admin-route authorization test passes for non-admins, and a
    dependency-audit step exists.

**Observability & ops**

- [ ] `PROD-014` **Liveness vs readiness + uptime alerting.** `/health` is liveness-only (static
      JSON); it doesn't check the DB, so a load balancer can't tell "process up" from "can serve".
  - Investigate/deliver: a `/ready` (or `/health?deep`) that checks DB connectivity with a short
    timeout, wired to the orchestrator's readiness probe; external uptime monitoring + alerting on
    the public canonical-post path and the API.
  - Done when: readiness flips correctly when the DB is down, and an alert fires on real downtime.
- [ ] `PROD-015` **Error tracking, tracing, and minimal metrics.** Logging is pino (JSON, redacted —
      good) with a per-request id, but there's no error aggregation, no trace correlation across the
      request, and no metrics.
  - Investigate/deliver: an error-tracking sink for unhandled 5xx (from `error-handler.ts`) with
    release/version tagging and PII scrubbing; propagate the request id into every log line + error
    report; a minimal RED metric set (request rate, error rate, p50/p95 latency) and where it's
    scraped/shipped; log shipping/retention.
  - Done when: a forced 500 appears in the tracker with its request id, and latency/error dashboards
    exist.

**Performance & capacity**

- [ ] `PROD-016` **Feed & hot-path query/index audit under load.** Validate the recent-feed keyset
      pagination (`created_at + id`), tag-feed joins, the batched repost/tag lookups, and
      notification reads against `EXPLAIN ANALYZE` on a seeded-large dataset.
  - Investigate/deliver: confirm supporting indexes exist for keyset order, `post_kind` filtering,
    `post_tags`, block-filter subqueries, and `rate_limit_buckets`; add any missing index via
    migration; set a target concurrent-request budget and find the first bottleneck (DB vs API vs
    the per-request rate-limit write).
  - Done when: hot paths have proven index usage and a documented capacity ceiling.
- [ ] `PROD-017` **Frontend production audit.** The build emits two ~226 KB `index-*.js` chunks (~66
      KB gzip each) — investigate the apparent duplication/over-bundling — and the PWA registers
      `/sw.js` (`app/pwa.ts`).
  - Investigate/deliver: bundle analysis + code-split/dedupe fixes; a service-worker versioning +
    cache strategy that can't serve stale assets after a deploy (precache manifest tied to the build
    hash, skipWaiting/clients.claim policy, an update prompt); a top-level React error boundary;
    source-map upload (private) for the error tracker; verify Clerk + the CSP from `PROD-010` work
    in the prod build.
  - Done when: bundle size is justified, a deploy reliably updates installed PWAs, and an uncaught
    render error is captured rather than blanking the page.

**Quality gates**

- [ ] `PROD-018` **CI pipeline gating merges.** There is no `.github/workflows` (or other CI).
      Quality relies on running `deno task check` / `test` / `test:e2e` by hand.
  - Investigate/deliver: a pipeline that runs `check`, `test`, `test:e2e` (with an ephemeral
    `doomscrollr_test` Postgres service + migrations), and `build:web` on every PR; cache Deno deps;
    promote the existing OG `curl` check and the PWA asset checks into committed automated tests;
    block merge on red.
  - Done when: a PR cannot merge without the full gate passing in CI.
- [ ] `PROD-019` **Pre-launch load & smoke pass.** Before inviting testers (Gate A), prove the
      deployed environment under realistic conditions.
  - Investigate/deliver: a scripted run of the full loop against staging (create each post kind →
    open canonical URL → WhatsApp OG curl → share event → comment → react → report → block → admin
    remove/restore), plus a light load test of the feed and `/p` pages; capture the funnel via
    `report:funnel` to confirm instrumentation works end to end in prod.
  - Done when: the loop passes on the real deployed stack and the funnel report shows the staged
    events. **This is the technical prerequisite for Gate A.**

**Serverless on AWS — deployment option**

> An AWS serverless alternative to the plain container host assumed by
> `PROD-001`/`PROD-002`/`PROD-003`. If chosen, these spikes refine or supersede those; if not, they
> close as "evaluated, not chosen." The catch: Deno is **not** a first-class Lambda runtime and
> postgres.js pooling fights the serverless connection model, so `PROD-021` and `PROD-022` gate
> whether this path is even worth it.

- [ ] `PROD-020` **AWS serverless architecture spike.** Map the three pieces onto AWS and pick the
      shape, refining the `PROD-001` topology decision.
  - Investigate: static SPA → S3 + CloudFront; API + the `/p` SSR pages → Lambda behind an API
    Gateway HTTP API or a Lambda Function URL (consider Lambda@Edge/CloudFront Functions for `/p`
    latency); Postgres → RDS or Aurora Serverless v2. CloudFront routing (`/api/*` and `/p/*` →
    Lambda origin, everything else → S3 SPA). Compare honestly against **serverless containers**
    (App Runner / ECS Fargate), which run the existing `Deno.serve` app unchanged.
  - Done when: a written architecture + cost/latency/ops comparison vs the container baseline, with
    a recommendation.
- [ ] `PROD-021` **Deno-on-Lambda runtime feasibility.** The API is Hono on `Deno.serve`; Lambda has
      no native Deno runtime.
  - Investigate: (a) a Deno OCI container image on Lambda (Runtime API / Lambda web adapter); (b)
    Hono's `aws-lambda` adapter vs keeping `Deno.serve` behind a Function URL; (c) cold-start size
    and latency for the bundle and for rendering the `/p` SSR HTML; (d) `deno compile`/bundling vs
    container. Weigh against App Runner/Fargate, which need no runtime surgery (and where `PROD-003`
    graceful shutdown still applies, vs Lambda where warm-invocation pool reuse matters instead).
  - Done when: a go/no-go on Lambda for this stack with the measured cold-start cost.
- [ ] `PROD-022` **Serverless Postgres connection strategy.** `db/client.ts` opens a `postgres.js`
      pool (`max: 10`); per-warm-Lambda × concurrency can exhaust RDS connections, and cold starts
      reconnect.
  - Investigate: RDS Proxy (pooling/multiplexing) in front of RDS/Aurora; vs Aurora Serverless v2 +
    Data API (HTTP, connectionless — but not postgres.js, so a driver change); module-scope client
    reuse across warm invocations and right-sizing `max`; and how the per-request
    `rate_limit_buckets` write (`PROD-009`) behaves under Lambda latency — decide if limits move to
    DynamoDB or API Gateway throttling on this path.
  - Done when: a chosen connection topology that survives a concurrency spike without exhausting the
    DB.
- [ ] `PROD-023` **AWS IaC, secrets, and ops wiring.** Tie the AWS path back to the cross-cutting
      tasks.
  - Investigate/deliver: IaC (CDK / SAM / Terraform) for the chosen stack; Secrets Manager / SSM
    Parameter Store into Lambda env (realizes `PROD-005`); CloudWatch logs/metrics/alarms + X-Ray
    (realizes `PROD-014`/`PROD-015`); migrations as a one-off Lambda/CodeBuild step in the deploy
    (realizes `PROD-007`); CloudFront cache + invalidation on deploy (pairs with the SW versioning
    in `PROD-017`); optional WAF/edge rate limiting.
  - Done when: a deployable IaC skeleton + documented deploy pipeline exist for the chosen
    architecture.

### Internationalization (i18n) — investigation · 🔧 open

> The app is English-only with hardcoded copy, and date formatting is already inconsistent:
> `Intl.DateTimeFormat("en", …)` in `PostDetailPage`/`NotificationsPage` but browser-locale
> `undefined` in `AdminReportsPage` (the reason the admin page renders "24 de jun." while others
> stay English). `<html lang="en">` is static. The likely audience (WhatsApp meme-sharers) skews
> pt-BR, so this is real, not speculative.

- [x] `I18N-001` **i18n strategy & framework — shipped.** Chose `react-i18next` + `i18next`
      (`apps/web/src/app/i18n.ts`) with inline `en` + `pt-BR` catalogs (`app/locales/`). Locale
      precedence: device choice (localStorage `doomscrollr.locale`) → browser language → `en`
      fallback. `<html lang>` is updated live on change. A **Settings dialog**
      (`components/SettingsDialog.tsx`, native `<dialog>`) is the canonical control for theme +
      language + account, opened from a header gear. Preferences persist to the signed-in profile
      (`users.locale` / `users.theme_preference` via migration `0009`,
      `POST /api/account/preferences`, private to `/api/account/me`) and apply on sign-in;
      signed-out users keep the device-local choice. Translated so far: settings dialog, sidebar
      nav + post-type filters, feed heading/empty, header.
- [ ] `I18N-002` **Finish the locale rollout: formatting + full string coverage.** The foundation
      ships; this completes it.
  - _Done so far:_ Settings dialog, header, sidebar nav + post-type filters, feed heading/empty,
    **notifications** (full), and the **whole admin console** (tabs + Moderation, History,
    Administration pages + shell states). All admin/notification date formatters now follow the
    active locale via `getLocale()`.
  - Remaining: `PostDetailPage` still hardcodes `Intl.DateTimeFormat("en", …)`. Extract the
    remaining hardcoded UI strings — feed post cards, create form, comments, report/block dialogs,
    the deep moderation **ReportRow** internals (per-report action buttons, "Reported by", note
    form, user status/trust labels), the reason/tag-status **enum** labels, and the OG `/p` shell
    `lang`. Translate `aria-label`s. Confirm layout survives longer pt-BR/German strings across the
    core loop.
  - Boundary (decided): user-generated posts/comments are **not** translated; usernames/slugs stay
    ASCII `[a-z0-9_]`; revisit non-ASCII display names + the English-only profanity hook separately.
  - Done when: every user-facing string and date flows through the active locale, with the pt-BR
    pilot clean across the whole core loop.

### Accessibility (a11y) — investigation · 🔧 open

> Baseline is decent (143 `aria-*` attributes, an `sr-only` utility, some `:focus`/`focus-visible`
> rules) but unaudited, `prefers-reduced-motion` appears only twice, and there's no skip link. The
> design work so far has caught contrast bugs ad hoc (white-on-white hover, the YouTube CTA red) —
> this makes that systematic.

- [ ] `A11Y-001` **Automated + manual audit baseline.** Establish where the app actually stands.
  - Investigate/deliver: run axe-core + Lighthouse a11y across the key flows (feed, post detail with
    a working YouTube embed _and_ the blocked-embed fallback, create, comment/react, report/block,
    auth/username gate, the Moderation/Administration console, theme toggle in light and dark); a
    keyboard-only pass (every action reachable, visible focus, logical order, no traps); a
    screen-reader pass (VoiceOver/NVDA) over the core loop. Triage into P0 blockers vs polish and
    wire axe into CI (`PROD-018`).
  - 2026-06-24 pass: axe-core now runs inside the existing Playwright mobile smoke for the username
    gate, feed, create form, post detail, and Administration console, failing on serious/critical
    WCAG A/AA violations. At that point, Lighthouse, blocked-embed coverage, full
    moderation/report/block states, keyboard transcript, SR pass, and CI wiring were still open.
  - 2026-06-24 second pass: the browser smoke now also checks landmarks, light + dark route loads
    for feed/create/post/Administration, the opened report menu, profile block/unblock states, and
    the blocked YouTube fallback by forcing the iframe API to fail. Remaining: Lighthouse, the
    Moderation report queue surface, real keyboard-only transcript, SR pass, and CI wiring through
    `PROD-018`.
  - Done when: a triaged issue list exists and an automated a11y check runs in CI.
- [ ] `A11Y-002` **Focus management, landmarks, and motion.** Fix the structural gaps the audit will
      surface.
  - Investigate/deliver: move focus to the new view on TanStack Router navigations (SPA route
    changes currently strand screen-reader/keyboard users); focus-trap + restore + `Esc` for the
    merge-confirm (`role="alertdialog"` exists with no trap) and any menus/dialogs; add a
    skip-to-content link (none today); verify landmark roles (`header`/`nav`/`main`) across the
    3-pane feed and the console layouts; expand `prefers-reduced-motion` coverage to every
    route/stagger/keyframe animation and the smooth scroll-to-top; confirm `:focus-visible` on
    _every_ interactive control (incl. the sidebar kind-filter dots and the tag `<select>`s).
  - 2026-06-24 pass: added skip-to-content, route focus transfer to `<main>`, an explicit mobile
    accessible name for "New post", and trap/restore/`Esc` behavior for the tag merge alertdialog.
    Removed opacity fades from text-bearing entrance motion so animation cannot temporarily lower
    text contrast. Remaining: manual keyboard transcript, SR verification, and the full
    focus-visible inventory.
  - 2026-06-24 second pass: report popovers now expose expanded/controlled state, move focus to the
    first reason, close on `Esc`, and restore focus to the trigger; profile block controls expose
    pressed state. Disabled controls now use explicit disabled colors instead of whole-control
    opacity, preserving contrast in both themes.
  - Done when: keyboard + SR users can traverse the core loop with correct focus, landmarks, and
    motion-reduced alternatives.
- [x] `A11Y-003` **Contrast token audit — shipped.** The OKLCH token system is now guarded instead
      of spot-checked.
  - Shipped 2026-06-24: fixed light `--muted`, flipped dark `--color-pitch` to dark-on-bright accent
    text, changed placeholder text to the guarded muted token, and changed WhatsApp share text to
    `--color-pitch-ink`. Follow-up axe failures also fixed tag-chip foregrounds and mobile
    bottom-nav contrast by using stable ink text over soft/opaque surfaces. Added
    `docs/accessibility-contrast.md` plus `apps/web/src/a11y/contrast_test.ts`, which parses
    `styles.css` and enforces >=4.5:1 across core text, soft accent, danger, post-kind, and WhatsApp
    pairings in light and dark.

---

## ◇ Validation gates — product run, not engineering

> These answer the only question that matters before more building: **are people actually using the
> loop?** They are owned by the live tester run, measured with `deno task report:funnel`, and have a
> full playbook in `specs/VALIDATION.md`. None of these is an engineering task — do not mark one
> "done" without real tester data behind it.

### Gate A — v1 live validation run

Replaces former engineering tasks `V1-090`–`V1-094` and the old "V2 Gate" (`V2-001`–`V2-005`). Run
the playbook in `specs/VALIDATION.md`: invite 5–10 WhatsApp-native testers, have creators post and
share canonical URLs, measure the funnel, collect feedback, then decide _iterate v1_ or _commit to
v2_.

The loop is proven when **real tester data** shows:

- ◇ Real opens of shared post links happened (not just author self-views).
- ◇ Visitors reacted, commented, or created posts after opening a shared link.
- ◇ Creators returned after their posts got comments or reactions.
- ◇ The specific weak points worth improving are named from the feedback.

> Engineering for v2 already shipped ahead of this evidence, so Gate A is **retroactive**: the build
> happened, but the usage proof is still outstanding and should be gathered before committing
> further v3-scale work.

### Gate B — v3 platform readiness

Replaces former "V3 Gate" (`V3-001`–`V3-005`). Relevant only much later; do not open v3 engineering
until real usage shows:

- ◇ Sustained creation and sharing across v1 + v2.
- ◇ Moderation workload is manageable at the current volume.
- ◇ Clear, repeated user demand for specific platform capabilities.
- ◇ Each proposed subsystem has a fallback/degradation story.
- ◇ Canonical post viewing stays independent of any optional infrastructure.

---

## 🚧 Earned backlog — build only when the trigger fires

> Nothing here is committed. Promote an item into 🔧 Engineering **only** after its usage trigger is
> met. Canonical triggers: `specs/doomscrollr_roadmap_v1_v2_v3_future.md` §4. Research pins:
> `specs/specs/doomscrollr_future_milestones.md`. Already-shipped sub-scopes are marked so they are
> not re-counted as future work.

| Item                                                                                | Trigger to build                                                         | Notes                                                                                                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| BELL short links (`V2-014`)                                                         | Canonical URLs prove too long, or share attribution becomes essential    | Deferred; canonical URLs are within budget today                                                                      |
| Suggestive (non-NSFW) surface (`V2-015`)                                            | Logged-in user filtering controls + moderation capacity exist first      | Deferred; schemas still reject suggestive/mature metadata                                                             |
| One extra media provider (`V2-016`)                                                 | Users repeatedly request in-composer media beyond image-link/YouTube     | Deferred; add one at a time, never a provider zoo                                                                     |
| DOOM uploads (`V3-007`/`V3-014`)                                                    | Users need original image/GIF upload and external links are insufficient | Keep text/image/YouTube/comments/feeds working if DOOM is down (`V3-015`)                                             |
| Provider GIF (GIPHY/Tenor) (`V3-007`/`V3-016`)                                      | Users repeatedly ask for in-composer GIF search                          | One provider at a time                                                                                                |
| Media-asset abstraction (`V3-008`)                                                  | Media complexity actually requires it                                    | Document per-provider state machines first (`V3-009`)                                                                 |
| Deeper comments (`V3-010`/`V3-011`)                                                 | Shallow one-level comments become limiting                               | Adjacency list first; avoid `ltree` until subtree queries are proven                                                  |
| Stronger ranking (`V3-017`)                                                         | Recent feed is insufficient                                              | Cheap hot query before any materialized run                                                                           |
| Stronger discovery / search (`V3-018`)                                              | Tags + profiles + recent feed fall short                                 | Sidebar post-kind filtering and tag aliases/merges already shipped                                                    |
| Communities **or** friend circles (`V3-019`/`V3-022`)                               | Behavior shows need for durable spaces                                   | Pick one model, not both                                                                                              |
| BELL sharing subsystem (`V3-012`)                                                   | Short-link attribution is earned                                         | Internal-only; never a generic shortener (`V3-013`)                                                                   |
| Moderation depth (`V3-020`)                                                         | Volume demands it                                                        | Domain blocklist + trust-weighted queue + basic audit/restore already shipped                                         |
| Monetization adapter (`V3-021`)                                                     | Retention + moderation are proven                                        | Provider-agnostic                                                                                                     |
| Strong profiles, collections, badges, share rooms, remixes, meme battles, analytics | Per-item triggers in `doomscrollr_future_milestones.md`                  | Research pins / very-late backlog                                                                                     |
| Scrollr core preservation (`V3-006`)                                                | n/a — invariant                                                          | Keep users/posts/feeds/comments/reactions/reports/blocking/moderation/public routes as the core through any expansion |

---

## ✋ Guardrails — not building by default

> Constraints, not tasks. They are never checked off. Reconsidering any of these is a deliberate
> business/product/legal decision — not a backlog pull.

- ✋ Ads/AdSense are **not** core architecture (`V2-019`, `V3-NG-011`).
- ✋ No full DOOM uploads unless usage clearly earns it (`V2-020`).
- ✋ No materialized ranking runs by default (`V2-021`, `V3-NG`).
- ✋ No communities/friend circles unless behavior demands them — and pick one, not both (`V2-022`).
- ✋ No full search unless tags/profiles are insufficient (`V2-023`).
- ✋ No native video hosting (`V3-NG-005`).
- ✋ No generic URL shortener; BELL stays internal-only (`V3-NG-006`).
- ✋ No unbounded public tag creation (`V3-NG-007`); tags stay curated.
- ✋ No unbounded communities (`V3-NG-008`).
- ✋ No full Reddit-clone behavior without demand (`V3-NG-009`).
- ✋ No provider zoo — one provider at a time (`V3-NG-010`).
- ✋ No analytics-surveillance product; events stay privacy-safe and aggregate-first (`V3-NG-012`).
- ✋ **Out of roadmap entirely** — mature/adult UGC, nudity, pornography, age-gated NSFW feeds,
  adult monetization (`V2-017`, `V2-018`, `V3-NG-001`–`V3-NG-004`). Not a feature flag: a separate
  legal/payment/hosting/compliance business decision.

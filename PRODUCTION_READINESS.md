# Production Readiness

This pass focused on fail-closed launch blockers: startup validation, removed-content boundaries,
SSRF resistance, bounded reads, race safety, rate-limit durability, security headers, readiness,
shutdown, CI, and deploy commands.

## Fixed

- Production env validation now fails at startup for missing database, Clerk, base URL, web origin,
  unsafe localhost origins, debug logging, or enabled mock fallback.
- API and web mock fallbacks are disabled in production. Development no-database reads remain
  ergonomic.
- Removed or unpublished posts no longer accept public comments, post reactions, comment reactions,
  reposts, quotes, or funnel events. Public comment reads return 404 for removed posts.
- Comment listing now uses top-level `limit`/`cursor` pagination and caps replies per top-level
  comment.
- External image validation now rejects localhost/private/reserved hosts, validates DNS answers,
  validates every redirect target, caps redirects, uses short timeouts, checks content length, and
  reads a bounded body instead of trusting `Range`.
- Open Graph post pages no longer refetch arbitrary external image URLs on every crawler request.
  External images are validated on post creation; `/p` only uses stored URLs after structural
  checks.
- Default OG image moved from an external placeholder to a self-hosted `/og-default.svg` endpoint.
- Wrong `/p/:postCode/:slug` slugs now redirect to the canonical URL.
- YouTube URL parsing now uses `new URL()` and an expected hostname/path allowlist.
- Same-user reactions are serialized and conflict-safe; duplicate concurrent reactions are
  idempotent.
- Published repost uniqueness is enforced with a partial database unique index and duplicate races
  return `409 REPOST_EXISTS`.
- Rate-limit buckets are cleaned up opportunistically. Public unauthenticated rate limits combine
  anonymous session, trusted client IP, and user-agent hash.
- Production responses include HSTS; all responses include nosniff, referrer policy, permissions
  policy, and CSP with `frame-ancestors`.
- `/health` remains liveness-only. `/ready` checks database connectivity with a short timeout.
- API startup handles `SIGTERM`/`SIGINT`, drains the Deno server briefly, and closes the DB pool.
- Production service worker registration is disabled unless `VITE_ENABLE_SERVICE_WORKER=1`.
- Notifications no longer expose removed post titles or removed comment body previews.
- Suspended or banned users' existing posts/comments are hidden from public feeds, post detail, and
  comment threads. Limited users remain visible.
- Migrations now take a Postgres advisory lock.
- Added API Dockerfile, CI workflow, root CI tasks, and production start command that does not load
  `.env.local`.

## Required Production Env

- `APP_ENV=production`
- `PORT`
- `DATABASE_URL`
- `PUBLIC_BASE_URL` for API/canonical `/p` origin, non-localhost
- `WEB_ORIGIN` for the interactive SPA origin, non-localhost
- `CLERK_SECRET_KEY`
- `CLERK_AUTHORIZED_PARTIES`
- `VITE_CLERK_PUBLISHABLE_KEY` or `CLERK_PUBLISHABLE_KEY` for the web build
- `LOG_LEVEL=info`, `warn`, `error`, or `fatal`
- `ENABLE_MOCK_FALLBACK=0`
- `VITE_ENABLE_MOCK_FALLBACK=0`
- Optional: `YOUTUBE_API_KEY`
- Optional and off by default: `VITE_ENABLE_SERVICE_WORKER=1`

## Deployment Commands

```sh
deno task ci
deno task db:migrate
APP_ENV=production deno task --cwd apps/api start
deno task build:web
```

API container:

```sh
docker build -f apps/api/Dockerfile -t doomscrollr-api .
docker run --env-file /path/to/runtime.env -p 8000:8000 doomscrollr-api
```

Web deployment:

```sh
VITE_API_URL=https://api.example.com \
VITE_CLERK_PUBLISHABLE_KEY=pk_live_placeholder \
deno task build:web
```

Serve `apps/web/dist` from the chosen static host/CDN. Do not bake runtime secrets into images or
web assets.

## Pre-Launch Checklist

- Rotate every secret ever stored in `.env.local` or any copied development env artifact.
- Confirm `.env.local` and real env files are untracked and ignored.
- Set real `PUBLIC_BASE_URL`, `WEB_ORIGIN`, Clerk authorized parties, and CORS expectations.
- Run migrations once as a pre-deploy job. The advisory lock is a guard, not a replacement for a
  single migration owner.
- Confirm the edge/proxy overwrites `X-Forwarded-For`, `X-Real-IP`, or `CF-Connecting-IP`; otherwise
  do not trust those headers for abuse controls.
- Run `deno task ci` and `deno task test:e2e` against a disposable database.
- Check CSP in staging with real Clerk and YouTube flows.
- Keep service worker disabled until its cache strategy is build-hash-safe.
- Configure log shipping, retention, and alerting for `/ready`, 5xx rate, and DB errors.

## Remaining Risks

- CSP is conservative but still needs staging verification against the final Clerk domain/topology.
- Existing legacy external-image rows are not DNS-refetched on `/p` to avoid SSRF amplification;
  only newly created image posts get full DNS/fetch validation.
- Observability is still logs plus health/readiness. Metrics/tracing/error tracking are not yet
  implemented.
- Rate limiting is DB-backed and safe across API instances, but there is no separate edge/WAF layer.
- Web static hosting, TLS termination, cookie domain policy, and CDN cache rules must be finalized
  in the deployment platform.

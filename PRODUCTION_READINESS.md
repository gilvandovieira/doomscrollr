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

## Runtime, Memory & Deployment Targets

Measured on this app (Hono + Drizzle + Clerk + postgres.js + Pino). Full data and reproductions in
[`RUNTIME_MEMORY_REPORT.md`](RUNTIME_MEMORY_REPORT.md) and [`bench/`](bench/).

- **Production build is `deno compile` (container).** The shipped `apps/api/Dockerfile` compiles a
  standalone binary: warm RSS **~641 MB under `deno run` → ~226 MB compiled**, zero code change. The
  saving is the npm/Node-compat startup transpile + retained module graph that `deno run` holds and the
  binary drops. This is the single largest no-code-change production memory lever and is specific to this
  npm-heavy (Drizzle) stack — a fully-JSR stack would not benefit from compiling.
- **The compiled binary is glibc-only.** The runtime stage must stay on glibc —
  `debian:bookworm-slim` (shipped) or `distroless/cc-debian12` (smaller). Alpine/musl cannot exec it
  (`__res_init` failure). Do not switch the runtime stage to Alpine.
- **`deno task start` (`deno run`) is the heavier path (~641 MB).** Prefer the compiled container image
  for production; use the raw `start` only where a binary cannot be shipped.
- **Never run `deno run --watch` for a long-lived process.** It retains the npm-compat module graph
  across reloads and ramps linearly (~+530 MB/save with this stack) until OOM on a host with free RAM;
  it only plateaus under a container memory cap. Dev uses `watchexec -r` (fresh process per change, flat
  memory) — see the `apps/api` `dev` task and README. Production runs the compiled binary, which has no
  watcher and is unaffected. This is also why several concurrent agents/editors on `--watch` could lock
  up a dev machine.

### Future: AWS Lambda (not deployed yet)

Captured so the current build carries forward; none of the Lambda numbers below are measured on this app.

- **Path A — stay on Deno: `deno compile` binary + AWS Lambda Web Adapter (container image).** Runs the
  existing HTTP-server binary on Lambda with no rewrite; preserves dev/prod parity and ~226 MB. Cost:
  Deno is not an official Lambda runtime, so this leans on LWA + OCI images (community-supported).
- **Path B — Node managed runtime + `hono/aws-lambda`.** Lowest-friction and best-supported: every
  dependency (Drizzle, Clerk, postgres.js, Hono) is npm-native, Node is a first-class managed runtime,
  memory ≈ compiled Deno (~206 MB). Cost: migrate the entrypoint off `Deno.serve` — the `bench/shim/`
  Deno-global shim already runs the app on Node unmodified, so the lift is modest.
- **The real Lambda gate is connection pooling, not runtime memory.** Lambda concurrency × per-container
  Postgres connections exhausts the database. Front Postgres with **RDS Proxy** (or pgBouncer / a
  serverless driver) and set `postgres({ max: 1 })` per container before any rollout. Cold start and pool
  behavior through RDS Proxy must be load-tested when Lambda becomes real.

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
- Deploy the compiled `apps/api/Dockerfile` image (~226 MB RSS) as the API artifact, not
  `deno task start` (~641 MB); keep the runtime base on glibc (debian-slim / distroless-cc), never Alpine.

## Remaining Risks

- CSP is conservative but still needs staging verification against the final Clerk domain/topology.
- Existing legacy external-image rows are not DNS-refetched on `/p` to avoid SSRF amplification;
  only newly created image posts get full DNS/fetch validation.
- Observability is still logs plus health/readiness. Metrics/tracing/error tracking are not yet
  implemented.
- Rate limiting is DB-backed and safe across API instances, but there is no separate edge/WAF layer.
- Web static hosting, TLS termination, cookie domain policy, and CDN cache rules must be finalized
  in the deployment platform.
- AWS Lambda is not yet validated for this app: the compiled-Deno-on-Lambda path (Lambda Web Adapter)
  and Postgres connection pooling under Lambda concurrency (RDS Proxy) are unmeasured. See *Runtime,
  Memory & Deployment Targets*.

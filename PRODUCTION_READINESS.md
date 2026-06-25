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
- **Give the compiled binary ≥384 MB; it OOM-kills at 256.** Under a hard memory cap (a 256 MB
  container/cgroup limit or Lambda tier, no swap), the ~291 MB boot transient exceeds 256 and the kernel
  kills it **at boot** — even with `DENO_V8_FLAGS=--max-old-space-size=128` (the memory is runtime /
  code-space, not V8 old-space, so heap tuning doesn't bound it). **384 MB is the floor** (it reclaims
  under load to fit), 512 MB is comfortable. If a 256 MB ceiling is required, that is the **Node** case —
  Node runs the same app at ~219 MB and fits 256. (Tested with `docker run --memory`.)
- **`deno task start` (`deno run`) is the heavier path (~641 MB).** Prefer the compiled container image
  for production; use the raw `start` only where a binary cannot be shipped.
- **Never run `deno run --watch` for a long-lived process.** It retains the npm-compat module graph
  across reloads and ramps linearly (~+530 MB/save with this stack) until OOM on a host with free RAM;
  it only plateaus under a container memory cap. Dev uses `watchexec -r` (fresh process per change, flat
  memory) — see the `apps/api` `dev` task and README. Production runs the compiled binary, which has no
  watcher and is unaffected. This is also why several concurrent agents/editors on `--watch` could lock
  up a dev machine.

### Future: AWS Lambda

Benchmarked locally on this app, concurrency=1 (the Lambda per-instance model), full CPU / no memory cap
— **memory transfers to Lambda; cold-start and throughput here are optimistic** (Lambda couples CPU to
memory). Repro: `bench/lambda-image-bench.sh`, `apps/api/Dockerfile.lambda`. Lambda enforces a hard
memory ceiling and bills per GB-second, so peak RSS both sizes and prices the function.

**The `--watch` reload ramp does not apply to Lambda.** It is a dev-loop concern (a long-lived process
reloading on file change). Lambda restarts the whole execution environment — a fresh process per cold
start, like the external watcher — and never reloads a process in place, so nothing accumulates across
invocations. On Lambda only **per-instance peak RSS and cold start** matter, not the reload retention.

| Runtime (full app) | boot peak | warm peak (under load) | feed rps | Lambda tier |
|---|---:|---:|---:|---|
| **Node 26** (managed runtime, deps npm-native) | 219 MB | **219 MB — flat** | 457 | **256–384 MB** |
| Deno `compile` + Lambda Web Adapter (container) | 291 MB | **~390 MB — climbs** | 325 | 384–512 MB |

- **Path B — Node managed runtime is the better fit for this npm-heavy stack (recommended for Lambda).**
  Every dependency (Drizzle, Clerk, postgres.js, Hono) is npm-native, so Node runs them with no compat
  layer; measured peak **~219 MB, flat under load — roughly half the compiled-Deno peak** — fitting a
  256–384 MB function vs Deno's 512. It is a first-class managed runtime (zip; no 433 MB container image
  to load). Entrypoint: swap `Deno.serve` for `@hono/node-server` (server) or `hono/aws-lambda` (handler);
  `bench/shim/` already proves the full app runs unmodified on Node. Ship precompiled JS (tsc/esbuild),
  not `tsx`, so cold start is fast (the 686 ms measured here is `tsx`-inflated).
- **Path A — `deno compile` + Lambda Web Adapter keeps Deno parity, no rewrite.** `apps/api/Dockerfile.lambda`
  runs the existing HTTP-server binary on Lambda as a container image via LWA — the app is unchanged
  (verified: serves the real feed). But the compiled binary's ~300 MB boot transient plus Drizzle's growth
  to ~390 MB under load pin it to a **384–512 MB** tier (384 is the floor — it OOM-kills at 256), in a
  433 MB image. Heavier and pricier on Lambda than Node; choose it only if staying on Deno outweighs that.
- **On Node the query layer and JSR swaps barely move memory — the runtime floor (~200 MB) dominates**
  (`bench/node-stacks/run.sh`, concurrency=1): Drizzle 208, Kysely 196, Kysely + JSR-safe (`@hono/hono`,
  `@zod/zod`) 200 MB warm — same tier for all three. The **JSR swap is a no-op on Node**: `jsr add`
  installs `npm:@jsr/…` packages and Node has no Deno npm-compat loader, so the JSR memory win is
  Deno-only (it only pays off on Deno's `--watch` dev loop). Where Kysely helps on Node is **cold start**
  (136 ms vs Drizzle's 348 ms) and boot peak (85 vs 208 MB), not the tier — so on Node, choose the query
  layer for DX / cold start, not memory.
- **On the compiled-Deno path it's different:** Kysely lowers the under-load peak (drizzle 402 → kysely
  301 MB on the feed server) but the ~300 MB compile boot transient still pins the 512 tier, so **Kysely
  does not drop a tier when compiled**.
- **The real Lambda gate is connection pooling, not runtime memory.** Lambda concurrency × per-instance
  Postgres connections exhausts the database. Front Postgres with **RDS Proxy** (or pgBouncer / a
  serverless driver) and set `postgres({ max: 1 })` per instance before any rollout. Cold start, the LWA
  event translation, and pool behaviour through RDS Proxy must be load-tested when Lambda becomes real.

### Final image numbers (actual full app, Drizzle) and cost levers on a small budget

Authoritative numbers for the current project (rebuilt Lambda image, hono-jsr + zod4 + Drizzle,
concurrency=1, `bench/lambda-image-bench.sh`):

| Runtime / artifact | cold start | peak RSS | tier | note |
|---|---:|---:|---|---|
| **`deno compile`** (container, shipped) | 438 ms | **407 MB** | 512 (≥384 floor) | 430 MB image; the runtime we use |
| Node + esbuild bundle (deps external) | 386 ms | ~297 MB | 384 | precompiled app + `node_modules`; fixes tsx cold start |
| Node + tsx | 686 ms | ~219 MB | 256–384 | tsx = slow cold start |
| *without Drizzle* — feed-server proxy (compiled) | — | Kysely 301 vs Drizzle 402 | — | Drizzle ≈ **+100 MB**; full Kysely app not built |

`deno bundle` only targets `deno`/`browser` (not node), and the Node bundle hits CJS dynamic-`require`
gotchas (pino `require("node:os")`) unless deps stay external — so for us the runtime stays the
**`deno compile` binary**. Within that, ranked by $ saved ÷ effort:

1. **Scale-to-zero hosting (free, deploy choice — biggest win for low traffic).** Run the binary on
   Cloud Run / Fly.io (auto-stop) → ~$0 when idle; for low traffic this dominates any memory micro-gain.
   A flat ~$5/mo VPS (always warm, the 226 MB binary fits) is the simpler no-cold-start alternative.
2. **Smaller image base (free, ~1 line).** Runtime stage → `distroless/cc-debian12`: 430 → 331 MB image,
   identical RSS (verified) — cheaper registry storage + faster cold-start image pulls.
3. **Drizzle → Kysely (multi-day rewrite, ~−100 MB).** Could drop the compiled app from the 512 to the
   384 tier (~25% cheaper running cost). The only code-level runtime gain left that keeps `deno compile`.
4. Switching runtime (Node 256 tier) needs the entrypoint migration + a build step — ruled out for now.

For a small budget: take **1–2 now** (free); treat **3** as "only when sustained traffic makes the tier
cost exceed your engineering time" — saving 100 MB isn't worth days of work until the dollars justify it.

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
- AWS Lambda memory is now benchmarked (Node ~219 MB flat vs compiled-Deno ~390 MB peak → Node fits a
  256–384 MB tier, Deno needs 512), but the LWA event translation, real-Lambda (CPU-throttled) cold
  start, and Postgres pooling through RDS Proxy are still unvalidated on real Lambda. See *Runtime,
  Memory & Deployment Targets*.

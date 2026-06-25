# Deploying to Deno Deploy (Free) + Neon (Free)

**One** Deno Deploy project: the Deno/Hono backend serves the API **and** the built React/Vite SPA
(`apps/web/dist`) from the same origin. No Docker, no DNS, no separate frontend host. Drizzle + Clerk
stay as-is.

## What was changed to make this work

| File | Change |
|---|---|
| `apps/api/src/app.ts` | Serve `apps/web/dist` static files + SPA `index.html` fallback (after `/api` and `/p`); JSON 404 for unknown `/api/*`; added `GET /api/health/db` (SELECT 1) |
| `apps/api/deno.json` | Added `hono/deno` import; added `--allow-read=../web/dist` to the run tasks |
| `apps/api/src/db/client.ts` | `prepare: false` (required for Neon's pooled endpoint) + `max: 5` (Neon Free / serverless) |
| `apps/api/src/main.ts` | Guarded `Deno.addSignalListener` (Deno Deploy may not support OS signals) |

Validated locally in production mode against a real Neon database: `/health`, `/ready`, `/api/health/db`,
`/api/feed/recent` (the complex Drizzle query, with `prepare:false`), static assets, SPA fallback, and
the `/api/*` JSON-404 all pass.

## 0. Prerequisites (no DNS, no Docker)

- A **Neon** project. Use the **pooled** connection string (host contains `-pooler`), e.g.
  `…-pooler.<region>.aws.neon.tech`, with `?sslmode=require`. The pooled endpoint is required for a
  many-isolate platform like Deno Deploy; the direct endpoint will exhaust Neon Free's connection limit.
- **Clerk** application: a Publishable Key (`pk_…`) and a Secret Key (`sk_…`).

## 1. Run migrations against Neon (once, before deploy)

```sh
DATABASE_URL='postgresql://<user>:<pass>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require' \
  deno task db:migrate
```

`migrate.ts` is advisory-locked and idempotent (applies the hand-written `.sql` files in
`packages/database/src/migrations/`). Run it from your machine or CI — **not** on Deno Deploy.

## 2. Build the frontend (build-time env matters)

```sh
VITE_API_URL='https://<project>.deno.dev' \
VITE_CLERK_PUBLISHABLE_KEY='pk_live_xxx' \
  deno task build:web          # → apps/web/dist
```

`VITE_API_URL` must be the deployed origin so API calls **and** WhatsApp share URLs are absolute and
same-origin. If unset it falls back to `http://localhost:8000` (dev only).

## 3. Deno Deploy configuration

| Setting | Value |
|---|---|
| **Entrypoint** | `apps/api/src/main.ts` |
| **Build command** | `VITE_API_URL=https://<project>.deno.dev VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx deno task build:web` |
| **Install** | (default — Deno resolves npm/jsr from `deno.lock`) |

The app starts with `Deno.serve(app.fetch)` (`main.ts`); Deno Deploy provides the port. Permissions are
granted by the platform (the local `--allow-read` is only for local runs).

### Required environment variables (Deno Deploy → Settings → Environment)

**App:**
```
APP_ENV=production
PUBLIC_BASE_URL=https://<project>.deno.dev
WEB_ORIGIN=https://<project>.deno.dev
LOG_LEVEL=info
ENABLE_MOCK_FALLBACK=0
```
**Neon:**
```
DATABASE_URL=postgresql://<user>:<pass>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
```
**Clerk:**
```
CLERK_SECRET_KEY=sk_live_xxx                         # server-only — never a VITE_ var
CLERK_AUTHORIZED_PARTIES=https://<project>.deno.dev
```
**Build-time (set in the build environment):** `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`.

`PORT` is optional (defaults to 8000; Deno Deploy binds its own port). In production the app **fails
closed** if any required var is missing or points at localhost (see `packages/config/src/env.ts`).

## 4. Smoke tests (after deploy)

```sh
APP=https://<project>.deno.dev
curl $APP/health                 # {"status":"ok",...}
curl $APP/ready                  # {"status":"ready","checks":{"database":"ok"}}   (may 503 once on Neon cold start)
curl $APP/api/health/db          # {"database":"ok"}
curl $APP/api/feed/recent        # {"items":[...],"nextCursor":...}
curl -I $APP/                    # 200 text/html  (SPA shell)
curl -I $APP/create              # 200 text/html  (SPA fallback)
curl -I $APP/assets/<hashed>.js  # 200 text/javascript
curl $APP/api/does-not-exist     # 404 {"error":{"code":"NOT_FOUND",...}}  (JSON, not the SPA)
curl -A WhatsApp $APP/p/<code>   # Open Graph <meta> present, no JS
```

## 5. Known risks / notes

- **Neon cold start.** Neon Free scales compute to zero; the first request after idle takes ~1–3 s and
  can make the first `/ready` return 503 (its check times out at 1500 ms) even though the DB is fine — it
  recovers on the next hit. Use the **pooled** endpoint (keeps things warmer) and treat `/ready` as
  eventually-consistent. Optionally raise the timeout in `db/client.ts` (`checkDatabaseReady`).
- **Use the Neon pooled endpoint + `prepare:false`** (already set). The direct endpoint + many isolates
  exhausts Neon Free's connection limit; `prepare:false` is required because Neon's pooler (PgBouncer
  transaction mode) rejects named prepared statements. The app's interactive `db.transaction()` calls
  work over transaction-mode pooling.
- **Do not switch to `drizzle-orm/neon-http`** — it can't run the app's interactive transactions
  (6 repositories use `db.transaction`). If you ever want a Neon-native driver, it must be
  `drizzle-orm/neon-serverless` (WebSocket).
- **Clerk Dashboard:** add `https://<project>.deno.dev` to the allowed origins / redirect URLs there
  (callback URLs live in Clerk, not the codebase). `CLERK_AUTHORIZED_PARTIES` must match the deployed
  origin.
- **Workspace import maps:** the entrypoint is a workspace member; Deno Deploy resolves the import maps
  via `deno.lock`. Confirm the first deploy builds clean.
- **Secrets:** set `DATABASE_URL` / `CLERK_SECRET_KEY` as Deno Deploy environment variables (secrets),
  never commit them. Rotate any credential that has been shared in plaintext.

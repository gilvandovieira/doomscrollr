# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Doomscrollr is a **Deno workspace monorepo** for a SFW, mobile-first social-posting experiment built around
one loop: *create post → share to WhatsApp → friend opens → friend reacts/comments → creator returns*.

**The v1 spec is the source of truth.** If code, README, `ROADMAP.md`, or mock data conflict with
[`specs/specs/doomscrollr_spec_v1.md`](specs/specs/doomscrollr_spec_v1.md), the spec wins. v2/v3 specs under
`specs/` are not build scope until v1 earns them.

## Commands

Run from the repo root (Deno workspace tasks). Postgres must be up (`docker compose up -d`) and seeded
(`deno task db:seed`) for the feed to return data.

```sh
deno task dev:api          # API on :8000 — uses watchexec (see Runtime conventions); run in its own terminal
deno task dev:web          # web on :5173 (Vite) — separate terminal
deno task check            # typecheck the whole workspace (authoritative — see Gotchas)
deno task test             # unit/contract tests (colocated *_test.ts)
deno task test:e2e         # API + browser E2E against an ephemeral doomscrollr_test DB
deno task db:migrate       # apply hand-written .sql migrations (takes a Postgres advisory lock)
deno task db:seed          # seed SFW sample data;  db:unseed to clear
deno task report:funnel    # print the v1 funnel report from DATABASE_URL
deno task build:web        # production web build (Vite → apps/web/dist)
deno task ci               # fmt:check + lint + frozen-lock cache + check + test + build:web
```

Single test: `deno test --allow-env <path/to/file_test.ts>` or add `--filter "<test name>"`.
Single E2E: `deno test -A apps/api/e2e/core-loop.e2e.test.ts`.

The API `dev` task lives in `apps/api/deno.json`; the Deno-native watcher fallback is
`deno task --cwd apps/api dev:deno-watch` (use only if `watchexec` isn't installed).

## Architecture (the parts that span multiple files)

**Workspace** — `apps/web`, `apps/api`, and `packages/{config,database,shared}`, wired by the import maps in
each `deno.json`. `packages/shared` holds the **Zod schemas + types consumed by *both* the API and the web
app** — so a schema change affects both runtimes (and the Vite build).

**Web is SSR-OG-then-SPA.** Canonical post pages `/p/:postCode[/:slug]` are **server-rendered by the API**
(`apps/api/src/routes/pages.routes.ts` + `apps/api/src/lib/og.ts`) so Open Graph metadata is present
**without JavaScript** — WhatsApp/crawler previews must never depend on client-side React. The same URL then
also boots the React/Vite SPA (TanStack Router + Query) for humans. External OG image URLs are SSRF-validated
**at post-creation time**; `/p` only re-serves stored, structurally-checked URLs (never re-fetches arbitrary
hosts per request).

**API is layered Hono** — `routes/*` → `repositories/*` (Drizzle ORM over `postgres.js`) → Postgres, with
`middleware/`, `services/`, and `lib/`. Public reads, authenticated writes, an admin surface, and a public
`POST /api/events` funnel endpoint. Rate limits are **DB-backed** (durable across instances), combining
anon-session + trusted client IP + UA hash. `/health` is liveness-only; `/ready` checks the DB.

**Public identity rule.** Internal DB ids (UUIDv7, app-side) never appear in URLs or API payloads. Posts/
comments are addressed by a short random `public_code`; users by `@username`. Don't expose internal ids.

**Auth is Clerk.** E2E tests use a **gated test seam** (`test:<clerkId>`) for deterministic offline auth —
see `apps/api/e2e/harness.ts` and `apps/api/e2e/README.md`. The seam is only active under the test env.

**Production env fails closed.** Startup validation rejects missing DB/Clerk/origins, localhost origins,
debug logging, or enabled mock fallback in production. See `PRODUCTION_READINESS.md`.

## Runtime & deployment conventions (non-obvious; measured — see RUNTIME_MEMORY_REPORT.md / bench/)

- **Dev: use `watchexec` (the `dev` task), NOT `deno run --watch`.** `--watch` retains the npm/Node-compat
  module graph across reloads and ramps memory linearly to OOM on a roomy host (Drizzle ≈ +530 MB/save;
  even the Clerk floor +64). An external watcher respawns a fresh process per change → flat. Multiple
  concurrent dev servers (e.g. parallel agents) compound this and lock up the machine — tear them down.
- **Prod: ship the `deno compile` binary (`apps/api/Dockerfile`), NOT `deno run`.** Compile reclaims the
  startup-transpile + retained module graph: ~641 MB (`deno run`) → ~226 MB warm, zero code change. The
  `deno task start` path is the heavy one — use only where a binary can't ship.
- **The compiled binary is glibc-only and needs ≥384 MB.** Runtime base must be glibc
  (`debian:bookworm-slim` shipped, or `distroless/cc-debian12`) — **never Alpine/musl**. It OOM-kills under a
  256 MB hard cap (boot transient ~290 MB); 384 MB floor, 512 comfortable. V8 heap flags don't change this.
- **Dependency-form convention (a real compatibility trap).** `jsr:` specifiers (e.g. `jsr:@hono/hono`) are
  **Deno-only** — they live in Deno's cache, not `node_modules`, so they break on Node and in Vite/Rollup
  (fine for hono: backend-only + `deno compile`). The npm-compat form `npm:@jsr/<scope>__<name>` (e.g. zod =
  `npm:@jsr/zod__zod@^4`, Zod 4) is **portable** (materializes to `node_modules`, works on Node + Vite) but
  goes through the npm-compat loader, so it does **not** give the jsr memory benefit. The Vite frontend needs
  the `zod → @jsr/zod__zod` alias in `apps/web/vite.config.ts` to bundle it. `drizzle-orm` and
  `@clerk/backend` are npm-only (no JSR).
- **Cost levers on a small budget** (runtime ≈ `deno compile` binary): scale-to-zero hosting (Cloud Run /
  Fly auto-stop) or a flat ~$5 VPS first (free, biggest win); `distroless/cc` base (smaller image, same RSS);
  Drizzle → Kysely (~−100 MB, drops 512→384 tier) only when traffic justifies the rewrite. The full benchmark
  suite and Lambda analysis live in `bench/`, `RUNTIME_MEMORY_REPORT.md`, and `PRODUCTION_READINESS.md`.

## Gotchas

- **Editor LSP shows false "Cannot find module `jsr:`/`npm:`/`Deno`" errors — ignore them.** `deno task check`
  is authoritative; if it passes, the code resolves at runtime.
- The web app runs Vite **under Deno** (`deno run -A npm:vite`) with `nodeModulesDir: "auto"`; Vite resolves
  bare specifiers from `node_modules`, which is why `jsr:` deps and the zod alias matter for the build.

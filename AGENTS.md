# AGENTS.md

Guidance for Codex agents working in this repository.

## Project Shape

Doomscrollr is a Deno workspace monorepo for a SFW, mobile-first social posting app centered on:

```txt
Create post -> Share to WhatsApp -> Friend opens -> Friend reacts/comments -> Creator returns
```

The v1 spec is the product source of truth:

- `specs/specs/doomscrollr_spec_v1.md`
- `ROADMAP.md` tracks implementation and production-readiness work.
- v2/v3 specs under `specs/` are not current scope until v1 earns them.

Workspace members:

- `apps/api`: Hono API on Deno, Drizzle over `postgres.js`, Clerk auth, Pino logs.
- `apps/web`: React/Vite SPA.
- `packages/config`, `packages/database`, `packages/shared`: env, SQL migrations/schema, shared Zod schemas/types.

## Commands

Run from the repo root unless noted:

```sh
deno task check
deno task test
deno task test:e2e
deno task build:web
deno task ci
deno task db:migrate
deno task db:seed
deno task dev:api
deno task dev:web
```

Single unit test:

```sh
deno test --allow-env path/to/file_test.ts --filter "test name"
```

Single E2E:

```sh
deno test -A apps/api/e2e/core-loop.e2e.test.ts
```

Postgres is expected via `compose.yaml` and `.env.local` for local DB-backed work:

```sh
docker compose up -d --wait
deno task db:migrate
deno task db:seed
```

## Runtime Cost Rules

This repo is optimizing for low-cost runtime. Read these before changing deployment/runtime code:

- Authoritative benchmark summaries live in `bench/RESULTS.md`, `RUNTIME_MEMORY_REPORT.md`, and `PRODUCTION_READINESS.md`.
- Production should use the compiled Deno binary from `apps/api/Dockerfile`, not `deno run`.
- `deno compile` is the current container baseline: roughly `641 MB` warm RSS under `deno run` to roughly `226 MB` compiled, with no app rewrite.
- The compiled binary is glibc-only. Use `debian:bookworm-slim` or `distroless/cc-debian12`; do not switch it to Alpine/musl.
- Size the compiled binary at `>=384 MB` hard memory. It OOM-kills under a `256 MB` cap because boot transient memory is around `291 MB`; `512 MB` is comfortable.
- `deno task start` / raw `deno run` is the heavy production path and should only be used where a binary cannot ship.
- For low-traffic production, deployment topology beats micro-optimization: scale-to-zero hosts such as Cloud Run/Fly auto-stop or a small fixed VPS are the first cost lever.
- The free image-size win is `distroless/cc-debian12`: about `430 MB -> 331 MB` image, same RSS.
- The only code-level memory lever that keeps compiled Deno is Drizzle -> Kysely, expected around `-100 MB` peak. Treat that as worth doing only when sustained runtime cost justifies a multi-day rewrite.

## Dev Loop Rules

- Use `deno task dev:api`. It runs `watchexec -r`, killing and respawning a fresh Deno process per change.
- Do not use `deno run --watch` for a long-lived API process. With this npm-heavy stack it retains the npm/Node-compat module graph across reloads and ramps linearly on a roomy host.
- Multiple agents each starting watch servers compound the problem. Prefer one shared dev API on `:8000`, or non-watch `start`/`start:local` tasks for short checks.
- If a port is stuck, inspect before killing broadly:

```sh
ss -ltnp | grep -E ':80(00|01)'
```

## Benchmark Conclusions

Measured on this repo with Deno 2.8.3 / Node 26.1.0 / Bun 1.3.14:

- The API code was not leaking. Prior lockups came from multiple heavyweight Deno dev processes plus a shutdown bug that has been hardened.
- The app's intrinsic working set is small, about `27 MB` above an empty server on Node/Bun.
- The large Deno number is mostly `deno run` retaining/transpiling the TypeScript/npm-compat module graph.
- Throughput differences narrow on real `/api/feed/recent` traffic because the DB dominates. Memory, cold start, and deployment model are the primary cost decisions.
- Bun is the lowest measured memory container runtime, about `100 MB`, but a Bun-native port is not justified by memory alone because it requires tooling/test/e2e/security parity work.
- Node is the practical choice only if AWS Lambda managed runtime is the target. Node's memory is similar to compiled Deno but it avoids a Lambda container/custom runtime.
- Lambda's real blocker is Postgres connection strategy. Use RDS Proxy/pgBouncer/serverless driver planning and reduce per-instance pool size before any Lambda rollout.

## Dependency Cost Notes

- Drizzle is the dominant Deno npm-compat cost. Per-reload retention measurements put `drizzle-orm` around `+462 MB/save`.
- Clerk is the remaining npm-only floor, around `+62 MB/save`.
- `postgres.js` is effectively cheap in these measurements, around `+2 MB/save`.
- Safe JSR swaps are worthwhile but not sufficient while Drizzle remains:
  - `hono` can be `jsr:@hono/hono` in the API.
  - `zod` is currently the portable npm wrapper `npm:@jsr/zod__zod` because the web/Vite build needs `node_modules`.
  - Vite needs the `zod -> @jsr/zod__zod` alias in `apps/web/vite.config.ts`.
- Do not assume `deno compile` and a full JSR stack compose into a smaller artifact. The benchmark says compiled Deno has a fixed roughly `234 MB` floor; a JSR `deno run` server can be lighter than the binary.

## Architecture Guardrails

- Public IDs only: posts/comments use `public_code`; users use `@username`; do not expose internal UUIDs in public URLs or payloads.
- `/p/:postCode[/:slug]` is server-rendered by the API for Open Graph previews, then boots the SPA for humans. WhatsApp previews must not depend on client-side React.
- External image URLs are SSRF-validated at creation time. Do not add request-time refetching of arbitrary stored external URLs.
- Production env must fail closed. Do not reintroduce localhost defaults, debug logging, mock fallback, or test-auth seams in production.
- Rate limits are DB-backed for multi-instance correctness; be mindful that they add request-path writes.

## Editing Practices

- Prefer existing Deno workspace patterns and import maps.
- Keep changes scoped. Avoid runtime migrations, query-layer rewrites, or dependency-source swaps unless the task explicitly calls for them.
- Preserve user changes in the working tree. There are benchmark/doc changes that may be intentionally uncommitted.
- Use `deno task check`, focused tests, and `deno task build:web` based on blast radius. For deployment/runtime changes, also inspect or rerun the relevant `bench/` script rather than extrapolating.

# Bun Port Cost Analysis

**Date:** 2026-06-24 · **Scope:** entire monorepo (`apps/api`, `apps/web`, `packages/{config,database,shared}`)
**Question:** can this become **Bun-native** — no Deno compat shims, no added production risk, no permanent dual-runtime burden?
**Inputs:** full repo inspection (Deno API usage, all 6 `deno.json`, `deno.lock`, CI, Docker, tests, e2e harness) + the prior runtime benchmark (`RUNTIME_MEMORY_REPORT.md`).

> No secrets included. `.env.local` is discussed by variable *shape* only.

---

## Executive Summary

**Recommendation: CONDITIONAL — technically feasible and genuinely clean, but not justified by memory alone. Default to staying on `deno compile`; proceed with a Bun-native port only if a strategic driver exists (e.g. a serverless target, or a deliberate move to the Bun ecosystem).**

Why feasible:
- **No `jsr:` imports anywhere.** Every dependency is already an `npm:` specifier or a local `@doomscrollr/*` path alias. This removes the single largest Deno-lock-in risk.
- The **production runtime** Deno surface is tiny and well-bounded: `Deno.serve`, `Deno.exit`, `Deno.addSignalListener`, `Deno.env`, `Deno.resolveDns` across **6 files**. All have direct Bun-native replacements.
- Source already uses **`.ts` extension imports**, which **Bun resolves natively** (this is a Bun advantage over Node, which would need a loader/build step).
- The benchmark already booted the *unmodified* app on Bun against the live DB (`/ready` = db ok) at ~100 MB.

Why conditional (the cost is **not** in the runtime):
- The hard work is **tests, e2e harness, tooling, and config**, not the server. The 2,500-line e2e suite is deeply coupled to `Deno.Command`/`Deno.serve`/`Deno.listen`; there are **36 `Deno.test`** calls to convert; `deno fmt`/`deno lint`/`deno check` have **no Bun equivalent** (need Biome + `tsc`); six `deno.json` manifests must become `package.json` + workspaces + `tsconfig`.
- **Security parity is the real risk:** the SSRF protection in `image-url.ts` depends on `Deno.resolveDns` + manual `fetch` redirect/range handling. Bun's `fetch`/DNS must be re-validated against the existing SSRF test suite before this is production-safe.
- We **already solved the original problem** (memory) with `deno compile`: 641 MB → 226 MB, zero code change, zero migration. Bun's 100 MB is better but the ~125 MB delta does not, on its own, pay for a 2–3 week migration plus a security re-validation.

**Bottom line:** the Bun-native end state is achievable without shims and without permanent dual-runtime. But pick it for a *reason beyond memory*. If the driver is serverless/Lambda, note that the managed-runtime choice there is Node, not Bun — see the Decision Matrix.

---

## Current Runtime Assumptions

Deno is embedded structurally, not just at the entrypoint:

- **Workspace & resolution:** root `deno.json` declares a 5-member `workspace` with `"nodeModulesDir": "auto"`. Module resolution is driven by `deno.json` `imports` maps (the `@doomscrollr/*` path aliases) in every package, plus inline `npm:` specifiers.
- **Entry/runtime:** `apps/api/src/main.ts` boots with `Deno.serve` and handles lifecycle with `Deno.addSignalListener`/`Deno.exit`. Env is read through `Deno.env` (and `Deno.env.toObject()` is the default arg of `readServerEnv`).
- **Permissions model:** tasks pass explicit `--allow-net --allow-env --allow-sys=hostname` (API) and `--allow-read` (migrations). This is a Deno-only concept; Bun has no permission flags (everything is allowed) — a *posture change* to note, not a blocker.
- **Tooling:** `deno fmt`, `deno lint`, `deno check` are the formatter, linter, and type-checker. `deno.lock` (1,422 lines) is the lockfile. `deno task` orchestrates everything.
- **Tests:** `Deno.test` + (implicitly) `@std/assert`-style assertions; `deno test` with fine-grained permissions; a bespoke e2e harness that spawns `deno run` subprocesses.
- **CI:** `.github/workflows/ci.yml` uses `denoland/setup-deno` and runs `deno task` steps.
- **Docker:** `apps/api/Dockerfile` currently does a `deno compile` multi-stage build (the production path we just shipped).
- **Frontend:** `apps/web` runs Vite via `deno run -A npm:vite`; `deno.json` `compilerOptions.lib` includes the Deno-only `"deno.window"`.

---

## Deno-Specific Usage Inventory

**Difficulty:** trivial / small / medium / hard · **Risk:** low / med / high · **Blocks prod runtime?** = would stop the server from running in production (vs. only blocking *acceptance*: tooling/tests).

### A. Production runtime path (these gate a shim-free prod server)

| File | Usage | Bun-native replacement | Diff | Risk | Blocks prod runtime |
|---|---|---|---|---|:--:|
| `apps/api/src/main.ts` | `Deno.serve({port}, app.fetch)` | `Bun.serve({ port, fetch: app.fetch })` | small | med | ✅ |
| `apps/api/src/main.ts` | `Deno.exit(0/1/130)` ×3 | `process.exit(...)` | trivial | low | ✅ |
| `apps/api/src/main.ts` | `Deno.addSignalListener("SIGTERM"/"SIGINT")` ×2 | `process.on("SIGTERM"/"SIGINT", …)` | trivial | med | ✅ |
| `apps/api/src/main.ts` | graceful shutdown via `server.shutdown()` + 10s race + failsafe | `Bun.serve` `server.stop(true)`; re-implement drain | small | med | ✅ |
| `packages/config/src/env.ts:133` | `Deno.env.toObject()` (default arg of `readServerEnv`) | `process.env` (or `Bun.env`) | trivial | low | ✅ |
| `apps/api/src/middleware/auth.ts` | `Deno.env.get(...)` ×4 (CLERK_SECRET_KEY, APP_ENV, E2E_AUTH, CLERK_AUTHORIZED_PARTIES) | `process.env.X` | trivial | low | ✅ |
| `apps/api/src/lib/clerk.ts:15` | `Deno.env.get("CLERK_SECRET_KEY")` | `process.env` | trivial | low | ✅ |
| `apps/api/src/lib/anon-session.ts:23` | `Deno.env.get("APP_ENV")` | `process.env` | trivial | low | ✅ |
| `apps/api/src/lib/image-url.ts:34-35` | `Deno.env.get` (E2E gate) | `process.env` | trivial | low | ✅ |
| **`apps/api/src/lib/image-url.ts:262`** | **`Deno.resolveDns(host, "A"/"AAAA")`** (SSRF guard) | `node:dns/promises` `resolve4`/`resolve6` | small | **high** | ✅ |

The whole runtime port is ~1 file of substance (`main.ts`) plus mechanical `env.get` swaps. The **single high-risk item is `image-url.ts`** because it is the SSRF defense (DNS + manual redirect/range `fetch`), and it must keep behaving identically under Bun.

### B. Operational scripts (run as tasks; gate deploy/migrations, not the server process)

| File | Usage | Bun-native replacement | Diff | Risk | Blocks |
|---|---|---|---|---|:--:|
| `packages/database/src/migrate.ts` | `Deno.readDir`, `Deno.readTextFile`, `Deno.env`, `import.meta.url` | `node:fs/promises` `readdir`/`readFile`, `import.meta.dir`/`url` | small | med | deploy (migrations) |
| `packages/database/src/seed.ts` | `Deno.env.get` | `process.env` | trivial | low | seeding |
| `packages/database/src/unseed.ts` | `Deno.env.get` | `process.env` | trivial | low | ops |
| `packages/database/src/funnel-report.ts` | `Deno.env.get` ×2 | `process.env` | trivial | low | reporting |

### C. Tests & e2e (gate *acceptance*, not the running server)

| File(s) | Usage | Bun-native replacement | Diff | Risk |
|---|---|---|---|---|
| `packages/config/src/env_test.ts`, `packages/shared/src/**/*_test.ts`, `apps/api/src/{lib,services}/*_test.ts` (8 files, 36 `Deno.test`) | `Deno.test(name, fn)` + std asserts | `bun:test` `test()/expect()` | medium (volume) | low |
| `apps/web/src/a11y/contrast_test.ts` | `Deno.test` + `Deno.readTextFile(styles.css)` | `bun:test` + `node:fs` / `Bun.file` | small | low |
| **`apps/api/e2e/harness.ts`** | `Deno.serve`, `Deno.Command("deno", …)`, `Deno.NetAddr`, `Deno.env.set/delete` | `Bun.serve`, `Bun.spawn(["bun", …])`, `server.port`, `process.env` | **hard** | **high** |
| `apps/api/e2e/web-smoke.e2e.test.ts` | `Deno.listen`, `Deno.NetAddr`, `Deno.ChildProcess`, `Deno.Command("deno", …)` (vite), `Deno.statSync`, `npm:playwright` | `node:net`/`Bun.listen`, `Bun.spawn`, `node:fs.statSync`, Playwright runner | **hard** | **high** |
| `apps/api/e2e/core-loop.e2e.test.ts` | `Deno.Command(Deno.execPath(), …)` | `Bun.spawn([process.execPath, …])` | medium | med |
| `apps/api/e2e/{auth-and-limits,moderation,reshares,og-sharing}.e2e.test.ts` | drive via `fetch` (mostly portable) + harness | rewrite `Deno.test` → `bun:test` | medium | med |

### D. Config / tooling / CI / Docker

| Item | Current | Bun-native target | Diff | Risk |
|---|---|---|---|---|
| 6× `deno.json` (`imports`, `tasks`, `exports`, `workspace`) | Deno workspace + import maps | `package.json` workspaces + `tsconfig.json` `paths` | medium | med |
| `deno.lock` | Deno lockfile | `bun.lock` | trivial (regen) | low (churn) |
| `deno fmt` | formatter | **Biome** (or Prettier) — *new tool/config* | small | low |
| `deno lint` | linter | **Biome** (or ESLint) — *new tool/config* | small | low |
| `deno check` | type-check | `tsc --noEmit` per package — *add `typescript`* | small | low |
| `apps/web/deno.json` `lib: ["deno.window", …]` | Deno DOM lib | drop `deno.window`; standard `tsconfig` | trivial | low |
| `.github/workflows/ci.yml` | `denoland/setup-deno` + `deno task …` | `oven-sh/setup-bun` + `bun …` + Biome + `tsc` + `bun test` | medium | med |
| `apps/api/Dockerfile` | `deno compile` multi-stage (debian-slim) | `oven/bun` base (Alpine **possible** here, unlike compiled Deno) | small | low |
| Permissions (`--allow-*`) | explicit allowlist | none (Bun runs unrestricted) | n/a | **med (posture loss)** |

---

## Dependency Compatibility Matrix

`works` / `import-change` (package.json + bare specifier) / `replace` / `unknown-until-tested` / `incompatible`.

| Dependency | Used by | Current source | Bun status | Required change | Risk |
|---|---|---|---|---|---|
| `hono` (+ `/cors`, `/cookie`) | api | `npm:hono@^4.8.12` | **works** (Bun is a first-class Hono target) | manifest only | low |
| `drizzle-orm` (+ `/postgres-js`,`/pg-core`) | api, database | `npm:drizzle-orm@^0.44.5` | **works** | manifest only | low |
| `postgres` (postgres.js) | api, database, e2e | `npm:postgres@^3.4.7` | **works** (pure-JS TCP) — verify SSL + prepared-stmt behavior under load | manifest only | med |
| `@clerk/backend` | api | `npm:@clerk/backend@^3.7.1` | **works** (Node-targeted; Bun node-compat) — verify JWKS fetch + token verify | manifest only | med |
| `zod` | api, web, config, shared | `npm:zod@^3.25.76` | **works** (pure JS) | manifest only | low |
| `pino` | api | `npm:pino@^9.7.0` | **works** (ran fine in benchmark) — verify worker-thread transport under sustained load | manifest only | med |
| `react`, `react-dom` | web | `npm:react@^18.3.1` | **works** (build/browser, runtime-agnostic) | manifest only | low |
| `@tanstack/react-{query,router,table}` | web | `npm:@tanstack/*` | **works** (browser) | manifest only | low |
| `vite`, `@vitejs/plugin-react` | web | `npm:vite@^7` | **works** under Bun (`bunx vite`) or keep on Node | task change | low |
| `tailwindcss`, `autoprefixer`, `i18next`, `react-i18next`, `lucide-react` | web | `npm:*` | **works** (build/browser) | manifest only | low |
| `@clerk/react` | web | `npm:@clerk/react` | **works** (browser) | manifest only | low |
| **`playwright`** | e2e | `npm:playwright@1.61.0` | **unknown-until-tested** (Playwright's runner under Bun is historically fragile) | maybe keep e2e on Node | **high** |
| `axe-core` | e2e | `npm:axe-core@^4.10.3` | **works** (pure JS) | manifest only | low |
| std assertions (`Deno.test`) | all tests | Deno built-in | **replace** with `bun:test` | rewrite tests | med |
| `deno fmt`/`lint`/`check` | tooling | Deno built-in | **replace** (Biome + `tsc`) | new config | low |

No dependency is classified `incompatible`. The only `unknown-until-tested` of consequence is **Playwright on Bun** — which may force e2e to stay on Node (a *partial* dual-runtime, exactly what we want to avoid).

---

## Runtime Boundary Analysis

| Boundary | Today (Deno) | Under Bun (native) | Notes / risk |
|---|---|---|---|
| HTTP server start | `Deno.serve({port}, app.fetch)` | `Bun.serve({ port, fetch: app.fetch })` | Hono fetch handler is portable; `server.port` replaces `addr.port` |
| Request handling | Hono | Hono | unchanged (runtime-agnostic) |
| Env loading | `Deno.env` + `--env-file` | `process.env`/`Bun.env`; Bun auto-loads `.env*` (and `--env-file`) | **behavior diff:** Bun auto-loads `.env.local`; ensure prod still reads injected env, not a file |
| Filesystem (migrations) | `Deno.readDir`/`readTextFile` | `node:fs/promises` | small; path via `import.meta.dir` |
| DB client | postgres.js (npm) | same | verify SSL negotiation + prepared-statement reuse |
| Signals / shutdown | `Deno.addSignalListener` + `server.shutdown()` race | `process.on` + `server.stop(true)` | re-implement the drain + 12s failsafe; **must keep failsafe** (the prod-fix we shipped) |
| Logging | pino → stdout | pino → stdout | verify transport/flush under load |
| Crypto | `crypto.subtle`, `crypto.randomUUID`, `crypto.getRandomValues`, `TextEncoder`, `btoa/atob` | identical (WHATWG, present in Bun) | **low risk** — all Web-standard |
| `fetch` | Deno fetch w/ `redirect:"manual"`, `range`, `AbortSignal.timeout`, `body.cancel()`, `getReader()` | Bun fetch (WHATWG) | **HIGH:** re-validate manual-redirect + abort + stream-cancel semantics (SSRF) |
| DNS | `Deno.resolveDns(host,"A"/"AAAA")` | `node:dns/promises` `resolve4/6` | **HIGH:** SSRF allow/deny must be byte-for-byte equivalent against the IP test matrix |
| SSRF/image validation | `image-url.ts` (DNS + redirect walk + bounded body) | same logic, Bun fetch/DNS | gated by `image-url_test.ts` (private IPv4/IPv6, metadata IP, redirects) |
| Test runner | `deno test` (+permissions) | `bun test` (`bun:test`) | rewrite tests; no permission flags |
| Build (web) | `deno run -A npm:vite build` | `bunx vite build` (or Node) | output identical (Vite/Rollup) |
| Migrations | `deno run … migrate.ts` | `bun migrate.ts` | FS port + advisory-lock logic unchanged |
| Docker startup | compiled binary on debian-slim | `oven/bun` (Alpine OK) running `bun src/main.ts` | Bun supports musl → smaller image than compiled Deno |
| CI | `denoland/setup-deno` + tasks | `oven-sh/setup-bun` + bun/biome/tsc | full step rewrite |

---

## Required Code Changes (exact targets)

**Runtime (must change for shim-free prod):**
- `apps/api/src/main.ts` — `Bun.serve`, `process.on`, `process.exit`, shutdown re-impl.
- `packages/config/src/env.ts` — default arg → `process.env`.
- `apps/api/src/middleware/auth.ts`, `apps/api/src/lib/clerk.ts`, `apps/api/src/lib/anon-session.ts`, `apps/api/src/lib/image-url.ts` — `Deno.env.get` → `process.env`.
- `apps/api/src/lib/image-url.ts` — `Deno.resolveDns` → `node:dns/promises` (**security-critical**).

**Ops scripts:**
- `packages/database/src/migrate.ts` (FS), `seed.ts`, `unseed.ts`, `funnel-report.ts` (env).

**Tests (acceptance):**
- 8 unit `*_test.ts` files (36 `Deno.test`) → `bun:test`.
- `apps/web/src/a11y/contrast_test.ts` → `bun:test` + `node:fs`.
- `apps/api/e2e/harness.ts` + 6 `*.e2e.test.ts` (~2,500 lines) → `Bun.spawn`/`Bun.serve`/`node:net`; Playwright runner decision.

**Config / tooling / infra:**
- Replace 6× `deno.json` with `package.json` (workspaces) + per-package `tsconfig.json` (`paths` for `@doomscrollr/*`).
- Add `biome.json` (fmt+lint) and `typescript` (tsc) dev deps; delete `deno.lock`, add `bun.lock`.
- `apps/web/deno.json` → `package.json` + `tsconfig` (drop `deno.window`).
- `.github/workflows/ci.yml` — rewrite to Bun.
- `apps/api/Dockerfile` — `oven/bun` base (reuse `.dockerignore`).
- Docs: `README.md`, `apps/api/e2e/README.md`, `PRODUCTION_READINESS.md`, `ROADMAP.md` references.

---

## Migration Plan (phased)

| Phase | Work | Files | Main risk | Validation | Rollback |
|---|---|---|---|---|---|
| **0. Spike** | Boot `main.ts` on Bun shim-free + env + DNS swap; confirm `/ready` | `main.ts`, `env.ts`, `image-url.ts` | DNS/fetch parity surfaces early | manual `/health`+`/ready`+1 image check | branch only |
| **1. Deps/config** | `package.json` workspaces, `tsconfig` paths, Biome, `bun.lock` | 6 `deno.json`, new manifests | resolution of `@doomscrollr/*` + `.ts` imports | `bun install`, `tsc --noEmit` green | keep `deno.json` until Phase 7 |
| **2. API runtime** | serve/signals/exit/env shim-free; shutdown re-impl | `main.ts` + 5 env files | graceful-shutdown regression | unit + manual SIGTERM drain test | revert file set |
| **3. DB + tests** | migrate.ts FS port; 36 `Deno.test`→`bun:test`; e2e harness + suite | `packages/database/*`, all `*_test.ts`, `e2e/*` | **e2e harness rewrite + Playwright-on-Bun** | `bun test` green; e2e green | e2e may stay on Node temporarily |
| **4. Frontend/scripts** | web `package.json`/`tsconfig`, vite under bun, contrast test | `apps/web/*` | vite plugin/loader quirks | `bunx vite build` byte-equivalent | keep web on Node |
| **5. Docker/CI** | Bun Dockerfile; CI rewrite | `Dockerfile`, `ci.yml` | CI flakiness; image base | green pipeline + image boots `/ready` | keep old workflow file |
| **6. Prod parity** | SSRF re-validation, fetch/redirect, pg/pino under load, shutdown, rerun benchmark | — | **security parity** | full acceptance checklist below | do not cut over until green |
| **7. Deno removal** | delete `deno.json`/`deno.lock`/Deno tasks/docs | repo-wide | losing fmt/lint/check parity | one rollback release cycle elapsed | revert deletion commit |

---

## Cost Estimate

Engineering days (one experienced engineer). The runtime is cheap; **tests + e2e + tooling + parity validation dominate.**

| Phase | Best | Realistic | Worst |
|---|---:|---:|---:|
| 0 Spike | 0.5 | 1 | 1 |
| 1 Deps/config | 1 | 2 | 3 |
| 2 API runtime | 0.5 | 1 | 2 |
| 3 DB+tests+e2e | 2 | 4 | 8 |
| 4 Frontend | 0.5 | 1 | 2 |
| 5 Docker/CI | 1 | 1.5 | 3 |
| 6 Prod parity | 1.5 | 2.5 | 4 |
| 7 Deno removal | 0.5 | 0.5 | 1 |
| **Total** | **~7.5 days (~1.5 wk)** | **~13.5 days (~3 wk)** | **~24 days (~5 wk)** |

### A. Best case — ~1.5 weeks · confidence: low
All deps "just work," Playwright runs under Bun, Bun `fetch`/DNS pass the SSRF tests unchanged. Bun becomes primary. *Optimistic; assumes no parity surprises.*

### B. Realistic case — ~3 weeks · confidence: medium-high
e2e harness rewrite is the long pole; one or two parity fixes (fetch redirect or shutdown drain); Biome reformat churn; CI iteration. Likely blockers: Playwright-on-Bun, fetch-redirect semantics. **Bun can become primary** if parity tests pass.

### C. Worst case — ~5 weeks · confidence: medium
Playwright won't run under Bun (e2e stays on Node = partial dual-runtime); `fetch`/DNS SSRF behavior diverges and needs reworked guards; postgres.js or pino edge cases under load; tooling migration drags. **Bun should *not* become sole runtime** if e2e is stuck on Node — that's a dual-runtime end state the brief explicitly rejects.

---

## Hidden Costs and Risks

- **Loss of `deno fmt`/`lint`/`check`** — must adopt Biome + `tsc`. New configs, a one-time reformat diff (lockfile/format churn across the repo), and a re-tuned lint ruleset.
- **Loss of the permission model** — Deno's `--allow-net/--allow-env/--allow-read/--allow-sys` are an explicit, auditable capability allowlist. Bun has none. This is a **security posture regression** that should be compensated at the container/infra layer (seccomp, read-only FS, egress controls).
- **Playwright-on-Bun uncertainty** → risk of a permanent Node island for e2e (dual-runtime).
- **`fetch`/redirect/abort/stream-cancel** subtle differences — directly affect SSRF safety; not visible without the test matrix.
- **DNS resolution differences** (`Deno.resolveDns` vs `node:dns`) — error shapes and ordering differ; SSRF deny-list must stay exact.
- **Bun auto-loads `.env*`** — convenient in dev, but a foot-gun in prod if a stray `.env` shadows injected secrets; env-loading must be made explicit.
- **postgres.js behavior** — prepared-statement caching / SSL negotiation parity under Bun must be confirmed under load (not just `/ready`).
- **pino transport** — worker-thread/sonic-boom behavior under sustained load on Bun.
- **Lockfile + CI churn** — `deno.lock` → `bun.lock`; full CI rewrite; cache keys change.
- **Docker base change** — `oven/bun` (Alpine viable) vs the current glibc compiled-binary image; re-verify TLS/ca-certs.
- **Developer onboarding** — docs, mental model, and "how do I run X" all change; the team must learn Bun's quirks.
- **Observability/debugging** — stack traces, source maps, and profiling differ between V8 (Deno) and JSC (Bun).

---

## Testing and Validation Plan

Must all pass under Bun before cutover:

1. `bun install` clean; `tsc --noEmit` green for every package.
2. `bun test` — all 36 migrated unit tests green (config, shared, api lib/services, web a11y).
3. **SSRF suite** (`image-url_test.ts`) green: private IPv4 (`127.0.0.1`, `10.x`, `169.254.169.254`, decimal `2130706433`, hex `0x7f000001`), IPv6 (`[::1]`, `[fd00::1]`, `[::ffff:169.254.169.254]`), `localhost.`/trailing-dot, redirect-to-private, oversized-body, content-type rejection — **identical pass/fail to Deno**.
4. Migrations: `bun migrate.ts` against a fresh DB applies all SQL, advisory lock works, idempotent re-run skips.
5. e2e suite green (auth-and-limits, core-loop, moderation, reshares, og-sharing, web-smoke) — comments/reactions/events/reshare behavior unchanged.
6. `/health` returns ok; `/ready` returns 503 when DB down and 200 when up (fail-closed).
7. **Graceful shutdown:** SIGTERM drains in-flight + exits within the failsafe window; second signal force-exits (the prod-fix must survive the port).
8. **Env validation fails closed** in production mode for missing required vars (same as Deno).
9. `bunx vite build` produces a working SPA bundle.
10. Docker image builds, boots, `/ready` = db ok, idle RSS measured.
11. CI green end-to-end on Bun.

---

## Benchmark Plan (fair re-run after port)

Re-run the comparison so the decision rests on production-mode numbers, not dev:

- **Production mode only** — `NODE_ENV=production`/`APP_ENV=production`; **no dev transpilers** (no `tsx`, no `--watch`). Compare Bun-native vs the `deno compile` binary (both production artifacts) and the current `deno run` as the "before."
- **Same container conditions** — identical base sizing, CPU/memory limits (`--cpus`, `--memory`), `taskset` pinning; server and load generator on separate cores (reuse `bench/bench-comprehensive.sh`).
- **Randomized run order**, **≥5 repetitions** per mode; discard first (warm-up); report median across reps.
- **Latency:** p50 / p95 / p99 (add p95 to the existing p50/p99) on `/health` (pure runtime) and `/api/feed/recent` (real DB).
- **Resource:** RSS (`VmRSS`) idle + peak-under-load, `VmHWM`, CPU%, thread count.
- **DB metrics:** active connections, query latency, that the pool stays bounded under load.
- **`/ready` gating:** every run verifies `/ready` = db ok before measuring; reject runs where it isn't.
- **Acceptance:** Bun-native memory **≤** `deno compile` and latency **≤ or ≈** at equal CPU. If Bun is not clearly better in production mode, the port is not justified on performance.

---

## Decision Matrix

| Option | Migration cost | Runtime risk | Memory (warm) | Cold start | Ops complexity | Long-term maintainability | Verdict |
|---|---|---|---:|---:|---|---|---|
| **`deno run` (today)** | none | low | 641 MB | 202 ms | simple | current, but RAM-heavy in dev/prod | ❌ memory |
| **`deno compile` (shipped)** | ~none (done) | low | **226 MB** | 199 ms | binary in container | single runtime, no churn | ✅ **pragmatic default** |
| **Bun-native** | **2–3 wk** | **med** (fetch/DNS/SSRF parity; e2e) | **100 MB** | 118 ms | Bun toolchain; needs Biome/tsc | single runtime once done; clean | ✅ **only with a strategic driver** |
| **Bun + Deno shim** | ~3–5 d | med-high | 100 MB | 118 ms | shim = permanent coupling | ❌ violates "no shim / no dual-runtime" | ❌ **reject** |
| **Node production** | 2–3 wk + needs TS build/loader (no native `.ts` like Bun) | low-med | 206 MB | (precompiled, fast) | Lambda-native; standard toolchain | single runtime; widest ecosystem | ✅ **iff Lambda-on-Node** |

---

## Recommendation

**Defer the Bun-native port; keep `deno compile` as the production runtime — unless a non-memory driver appears.**

Reasoning, brutally practical:
1. **The problem that started this is already solved.** `deno compile` took prod from 641 MB to 226 MB with zero code change and zero risk. Memory is no longer a fire.
2. **Bun-native is feasible and genuinely shim-free** (no `jsr:`, all `npm:`, native `.ts`, tiny runtime surface) — but the cost is ~3 weeks realistic, concentrated in tests/e2e/tooling, and it carries **security-parity risk** (SSRF `fetch`/DNS) that must be re-earned. A ~125 MB memory win does not pay for that.
3. **The shim path is rejected** outright: it makes the Deno coupling permanent and is the dual-runtime burden the brief forbids.
4. **If the real driver is serverless/Lambda**, the managed-runtime choice there is **Node, not Bun** — Node gives dev/prod parity and ~ties compiled Deno on memory; Bun on Lambda needs a container/custom runtime (no parity advantage). So "we're going serverless" points to Node, not Bun.
5. **Proceed with Bun-native only if** there's a deliberate strategic bet on the Bun ecosystem/toolchain (or a container deploy where the 100 MB floor and Bun's speed genuinely matter), **and** Phase 0's spike confirms `fetch`/DNS SSRF parity and Playwright-on-Bun within ~1 day. If the spike shows either is shaky, stop — the worst-case (Node island for e2e) is the dual-runtime outcome we're trying to avoid.

**Acceptance gate (port is acceptable only if ALL hold):** API runs with **no Deno globals/shims**; all prod-readiness fixes remain (graceful shutdown failsafe, fail-closed env); `bun test` + e2e green; migrations safe under Bun; Docker builds clean; `/health`+`/ready` correct and fail-closed; SSRF/image validation provably unchanged; comments/reactions/events/reshare behavior unchanged; frontend builds; CI is Bun-primary; benchmark re-run in production mode shows memory/latency **equal or better** than `deno compile`; and Deno support is removable after one rollback release cycle. **Anything less than all of these → do not adopt Bun as primary.**

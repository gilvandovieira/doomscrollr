# Doomscrollr API — Memory Investigation & Runtime Benchmark

**Date:** 2026-06-24
**Scope:** `apps/api` (Hono on Deno) — diagnose a reported "memory leak / system lockup,"
then measure whether the runtime itself is the cost.
**Machine:** 12th Gen Intel Core i7-12700H (20 logical cores), 15 GiB RAM, CachyOS (Linux 7.0.12),
Docker 29.6.0. Runtimes: Deno 2.8.3, Node 26.1.0, Bun 1.3.14.
**DB:** Postgres 16 in Docker, `localhost:5433` (healthy).
**Method:** same app code on each runtime (Node/Bun via a ~70-line `Deno` global shim, zero app
changes); memory from `/proc/<pid>/VmRSS`/`VmHWM`; load via a closed-loop client; server and load
generator pinned to separate cores (`taskset`) for fairness; every run verified `/ready` = db ok.

---

## TL;DR

1. **There is no memory leak in the API code.** A full sweep of `apps/api/src` found no
   unbounded caches, leaking timers, stream/listener accumulation, or per-request retention.
   The process can't even buffer files at runtime (`--allow-read` is not granted).
2. **The "3 GB+ → lockup" was process multiplication**, not a leak: multiple concurrent agent
   sessions each started a dev server (plus one orphaned test-auth server left from a prior
   screenshot session). Each Deno dev process sits at **~0.65–2 GB**, so a handful at once
   exhausts RAM and the OOM killer reaps the biggest process (the server).
3. **One real bug was fixed:** the SIGTERM handler in `main.ts` could wedge, leaving servers
   that only `SIGKILL` could clear — which let zombies pile up. Now hardened.
4. **Most of the per-process footprint is `deno run` overhead, not the app or the runtime.**
   Running the *identical* app (against the same live DB) gives **641 MB (`deno run`)**, but
   **226 MB once `deno compile`d** — a 2.8× drop with **zero code changes**. The same app on
   Node is **206 MB** and on Bun **100 MB** (via a small `Deno` global shim).
5. **This reshapes the decision around your deploy target (and dev/prod parity):**
   - **Container (Fargate/App Runner):** `deno compile` → 226 MB, **no migration**. Best value.
   - **Lambda (native runtime):** only **Node** is a managed Lambda runtime → 206 MB **and**
     dev/prod parity. Migration is justified by *parity*, not memory (≈ compiled Deno).
   - **Bun:** lightest (100 MB) but no native Lambda runtime (container/custom only) and loses
     parity. Worth it only when absolute memory wins and a container deploy is fine.

---

## Part 1 — The "leak" hunt

### Symptom
System locked up; memory seen climbing past 3 GB; the only process that died was the API
server. Reported as a suspected leak in `apps/api`.

### What was swept
`app.ts`, `main.ts`, `db/client.ts`, `lib/logger.ts`, `middleware/request-logger.ts`,
`middleware/auth.ts`, `lib/image-url.ts`, `lib/rate-limit.ts`, `routes/events.routes.ts`,
`lib/og.ts`, plus a grep of all of `apps/api/src` for timers, streams, listeners, and
module-level mutable collections.

### Findings — no leak
- **No** `setInterval`, no SSE/stream controllers, no accumulating event listeners.
- Module-level collections are all constant (`PASSTHROUGH_STATUSES`, `YOUTUBE_HOSTS`) or
  self-cleaning (`rate-limit`'s `memoryStore` has expiry cleanup, and the DB-backed path is
  used in normal operation anyway).
- `lib/image-url.ts` reads response bodies **bounded to 5 MB** and cancels the reader — clean.
- Clerk `verifyToken` uses an internal, bounded JWKS cache.
- The server runs with `--allow-net --allow-env --allow-sys=hostname` — **no `--allow-read`**,
  so it cannot buffer files at runtime.

### Actual root cause
Confirmed live with `ps`/`ss`/`/proc`: **two** `deno run … src/main.ts` processes were running
at once —
- the real `dev:api` on `:8000` (~2.0 GB), and
- an **orphaned `APP_ENV=test E2E_AUTH=1` server on `:8001`** (~0.85 GB) left over from an
  earlier screenshot session (reparented to systemd).

The user confirmed they run **multiple production-readiness agent passes concurrently**, each of
which can spin up its own server. N servers × ~1–2 GB each ⇒ 3 GB+ ⇒ lockup. Not a leak —
process multiplication.

### Fix shipped — `apps/api/src/main.ts`
The shutdown handler could swallow signals: a second signal early-returned without exiting, and
there was no failsafe if `server.shutdown()`/`closeDatabase()` hung. That orphaned `:8001`
server **ignored SIGTERM and only died on SIGKILL** — exactly how zombies accumulate. Hardened:

- A second signal now force-exits (`Deno.exit(130)`) instead of being ignored.
- A 12 s failsafe timer guarantees the process exits even if the drain hangs.
- The failsafe is cleared on the normal clean-exit path.

Verified: a real SIGTERM now logs `api_shutdown_started → api_shutdown_complete` in ~4 ms and
exits cleanly.

### Prevention (operational)
- **Cap memory per process so the box can never lock:**
  `systemd-run --user --scope -p MemoryMax=1500M -p MemorySwapMax=0 deno task dev:api`
  (cgroup v2 + user delegation are on by default here). Worst case becomes "that one server
  dies," never a system freeze. `systemd-oomd` is a complementary safety net.
- One long-lived `dev:api` on `:8000`; agents talk to it instead of each spawning one.
- Agent-spawned servers should use the **non-watch** `start`/`start:local` task (a `--watch`
  server is what balloons; see Part 2).
- Spot/clear strays: `ss -ltnp | grep -E ':80(00|01)'` and `pkill -f 'deno run.*main\.ts'`.

---

## Part 2 — Why one process is so big (runtime benchmark)

A single **idle** Deno server holding ~650 MB (0 % CPU) is *retained* memory, not an active
leak. Two experiments isolated the cause.

### Experiment A — synthetic baseline (runtime + deps only)
A minimal Hono server importing the exact dependency set
(`@clerk/backend`, `drizzle-orm`, `postgres`, `pino`, `zod`, `hono`), measured identically on
each runtime. Cold RSS:

| Runtime | Cold RSS | Engine |
|---|---:|---|
| Bun  |  **73 MB** | JavaScriptCore |
| Deno | **126 MB** | V8 |
| Node | **180 MB** | V8 |

The deps + runtime baseline is modest everywhere (and Deno was actually *lower* than Node here).
So the deps are **not** what makes the real app 650 MB.

### Experiment B — the real app, live DB, three runtimes
The **unmodified** `apps/api` app was booted on each runtime against the **same live Docker
Postgres**, using a ~70-line `Deno` global shim (`deno-shim.ts`) that maps
`Deno.env`/`Deno.exit`/`Deno.addSignalListener`/`Deno.serve`/`Deno.resolveDns` onto
Node/Bun primitives. App code was changed **zero** lines. All three returned
`/ready → {"database":"ok"}`, confirming real DB connectivity.

| Runtime / mode | Cold | Warm | Peak | Threads | vs `deno run` (warm) |
|---|---:|---:|---:|---:|---|
| **Deno** (`deno run`) | 631 MB | 641 MB | 685 MB | 20 | baseline |
| **Deno** (`deno compile`) | 216 MB | 226 MB | 281 MB | 7 | **2.8× lighter** (−65 %) |
| **Node** | 204 MB | 206 MB | 233 MB | 12 | **3.1× lighter** (−68 %) |
| **Bun**  |  99 MB | 100 MB | 100 MB | 30 | **6.4× lighter** (−84 %) |

(Warm = after `/health` ×5, `/ready`, `/api/feed` ×10. All returned `/ready` = db ok.)

**The `deno compile` result is the most actionable one:** a standalone binary
(`deno compile --allow-net --allow-env --allow-sys=hostname src/main.ts`, 231 MB on disk, ~6 s
to build) reclaims ~415 MB of the `deno run` overhead and lands at ~Node parity — without
changing a line of code or leaving Deno. The leftover gap to Bun (226 → 100 MB) is the
engine/compat difference (V8 + npm-compat vs JSC + native).

### The decisive number
Going from the minimal server (Exp. A) to the full app (Exp. B):

| Runtime | minimal → real | delta |
|---|---|---:|
| Deno | 126 → 641 MB | **+515 MB** |
| Node | 180 → 206 MB | +26 MB |
| Bun  |  73 → 100 MB | +27 MB |

The app's *intrinsic* working set is only ~27 MB of live objects (Node/Bun agree). **Deno spends
~515 MB holding/transpiling this app's full TypeScript module graph + npm-compat layer.** That
overhead — not the app, not the deps, not a leak — is the 650 MB. **`deno compile` reclaims ~415
MB of it** (641 → 226 MB) because the binary is pre-bundled: no startup transpilation and no need
to retain the source graph at runtime. So this overhead is mostly a `deno run` (dev/JIT) cost,
addressable without leaving Deno.

---

## Part 3 — Deployment implications

Decision matrix, given the `deno compile` result and dev/prod **parity** (matching the dev
runtime to the production/Lambda runtime to avoid runtime-specific surprises):

| Deploy target | Best fit | Warm RSS | Migration | Why |
|---|---|---:|---|---|
| Container (Fargate / App Runner) | **`deno compile`** | 226 MB | **none** | ship a binary; stay on Deno; lowest effort/risk |
| Lambda, native managed runtime | **Node** | 206 MB | full rewrite | only Node is a managed Lambda runtime → parity; memory ≈ compiled Deno |
| Container, want minimum memory | **Bun** | 100 MB | full rewrite | lightest; native TS; but no Lambda-native, loses parity |

Notes:
- **`deno compile`** drops Deno to ~Node levels with **no code change** — so on containers there
  is no memory reason to migrate at all. Build the existing `apps/api/Dockerfile` to run the
  compiled binary instead of `deno run`.
- **Lambda:** only **Node** is a managed runtime. Both Deno (compiled) and Bun on Lambda require
  a container image / custom runtime (PROD-021), which forfeits the parity benefit. So if Lambda
  is the target, **Node wins on parity** and its memory (206 MB) basically ties compiled Deno —
  the migration is justified by parity, not by footprint.
- The **PROD-022** blocker is unchanged regardless of runtime: the `postgres.js` `max:10` pool vs
  serverless connection limits (needs RDS Proxy or a connectionless driver).

### Recommendation
1. **Now, zero-risk:** switch the production image to a **`deno compile`d binary** (641 → 226 MB,
   fewer threads, faster start, no leak risk after the Part 1 fixes). This is worth doing
   regardless of the long-term target.
2. **If the target is Lambda-on-Node:** migrate to **Node** for dev/prod **parity** — memory is a
   wash vs compiled Deno, but parity removes a whole class of runtime-specific bugs. The port is
   small (Hono routes are runtime-agnostic; only ~6 files touch `Deno.*`).
3. **Choose Bun only** if you want the absolute-minimum footprint *and* a container deploy is
   acceptable (no Lambda-native, no parity with a Node Lambda).

---

## Part 4 — Hard-hitting load test (throughput, latency, memory under load)

Server pinned to cores 0–3, load generator to cores 4–15 (no CPU contention). Two endpoints:
`/health` (pure runtime) and `/api/feed/recent` (real keyset DB query, 18 KB JSON). 0 errors
everywhere.

| Mode (4 cores) | Cold start | Idle RSS | Peak under load | `/health` req/s (p50) | `/feed/recent` req/s (p50) |
|---|---:|---:|---:|---|---|
| Deno (`deno run`) | 202 ms | 254 MB | **826 MB** | 5,961 (16.6 ms) | 812 (61 ms) |
| Deno (`deno compile`) | 199 ms | 215 MB | 401 MB | 5,961 (16.6 ms) | 862 (58 ms) |
| Node 26 | 567 ms¹ | 196 MB | 246 MB | 20,824 (4.6 ms) | 1,240 (40 ms) |
| Bun 1.3 | 118 ms | 91 MB | 198 MB | 33,698 (2.8 ms) | 884 (56 ms) |

¹ Node's cold start is inflated by running TS through `tsx` (dev transpiler); a precompiled-JS
deploy starts far faster. Listed for honesty, not as a real Node number.

What this adds beyond idle RSS:
- **Memory under sustained load is where `deno run` is worst:** it climbs to **826 MB and stays
  there** (it grew +572 MB over idle and didn't release). `deno compile` grew +186 MB, Node +50 MB,
  Bun +107 MB. So the heavy retained memory is again a `deno run` trait, largely fixed by compiling.
- **CPU count drives Deno's idle memory:** `deno run` idled at 254 MB on 4 cores vs 641 MB on 20
  cores (it sizes thread pools / heaps to available CPUs). In a CPU-limited container it's leaner.
- **Pure-HTTP throughput:** `Deno.serve` did ~6k req/s where Node did ~21k and Bun ~34k on the same
  4 cores; `deno compile` does **not** change this (identical 5,961), so it's a serving-path cost,
  not startup.
- **Real DB workload throughput:** the gap narrows sharply (DB is the bottleneck) — Node leads
  (1,240 req/s), then Bun ≈ compiled Deno ≈ `deno run`, all within ~1.5×. For *this* app's actual
  traffic, runtime throughput differences mostly wash out; memory and cold start are the real levers.

## Part 5 — Production image (`deno compile` Dockerfile + base-image comparison)

`apps/api/Dockerfile` now builds a standalone binary (`deno compile`) in a Deno builder stage and
copies it into a minimal runtime stage. Verified end-to-end: image builds, container boots,
`/ready` = db ok, serves real feed data, idle **~177 MiB** in-container.

Runtime base comparison (same compiled binary; runtime RSS is identical across bases — only image
size differs):

| Runtime base | Image size | Runs the binary? | Notes |
|---|---:|:---:|---|
| `debian:bookworm-slim` (current) | 421 MB | ✅ | glibc; ~177 MiB idle |
| `gcr.io/distroless/cc-debian12` | 331 MB | ✅ | glibc; ~178 MiB idle; smallest that works; no shell |
| `alpine:3.20` (plain) | 309 MB | ❌ | musl: `exec /app/server: no such file or directory` |
| `alpine:3.20` + `gcompat` | 313 MB | ❌ | `Error relocating: __res_init: symbol not found` |

**`deno compile` cannot ship on Alpine.** Deno emits glibc-only binaries; musl (plain Alpine) can't
exec it, and `gcompat` lacks symbols Deno needs (`__res_init`). The standalone binary is ~231 MB on
disk and dominates image size regardless of base, so the base only saves ~90 MB. If a smaller image
matters, use **distroless/cc** (glibc, 331 MB); Alpine is only an option if you *don't* compile
(e.g. Node/Bun, which have official `*-alpine` musl images).

## Part 6 — Root cause of the `--watch` retention: the `npm:` loader, not `--watch` itself

Part 2's reload retention is specifically Deno's **`npm:`/Node-compat module layer** not releasing across
reloads — JSR/native modules don't have it. (Matches Deno #28107.)

**Same library, two loaders (the isolation):** `import { Hono }` from `npm:hono` retains ~**+19 MB/reload**
across `--watch` reloads; from `jsr:@hono/hono` — identical code — ~**+2 MB**. The loader is the variable,
not the library/bytes/module-count (the JSR build has *more* modules).

**Per-dependency decomposition** (each npm dep alone on a `jsr:@hono/hono` base, no load):

| npm dep | +MB/reload |
|---|---:|
| `drizzle-orm` | **+462** (~84% of the cost) |
| `@clerk/backend` | +62 (npm-only floor) |
| `hono` | +19 |
| `pino` | +4 |
| `postgres` (postgres.js) | +2 |

Drizzle dominates; `postgres.js` is free — it's the ORM's module graph through node-compat, not the
driver. Drizzle and Clerk are npm-only → the irreducible part.

**Real app, real DB** (matched feed servers, `bench/jsr-bench/`; npm via Drizzle vs JSR via raw
`@db/postgres`):

| metric | npm | JSR | Δ |
|---|---:|---:|---|
| warm RSS | 496 MB | 152 MB | 3.3× less |
| startup peak | 499 MB | 157 MB | 3.2× less |
| `--watch` retention | +552 MB/reload | +64 MB/reload | 8.6× less |
| `/feed` throughput | 2,745 rps | 2,531 rps | ~equal |

Repro: `bench/dev-loop/npm-vs-jsr/run.sh` (the decomposition + same-library control) and
`bench/jsr-bench/run.sh` (the real-DB comparison). External asks written from this:
`DENO_TEAM_FEEDBACK.md` (the Deno `--watch` bug), `DRIZZLE_JSR_REQUEST.md`, `CLERK_JSR_REQUEST.md`.

## Part 7 — `deno compile` does NOT help the JSR stack (it's an npm-stack fix)

The Part 2/5 win — `deno run` 641 MB → `deno compile` 226 MB — is **specific to the npm/Drizzle stack.**
Compiling the matched JSR feed server makes it *heavier*. Same DB, back-to-back
(`bench/jsr-bench/compile-compare.sh`):

| Stack | `deno run` warm | run peak | `deno compile` warm | compile peak | binary | compile |
|---|---:|---:|---:|---:|---:|---:|
| **JSR** (@hono/hono + @db/postgres + @std/log + @zod/zod) | **153 MB** | 156 MB | 234 MB | 301 MB | 226 MB | 3.8 s |
| **npm** (hono + drizzle + postgres.js + pino + zod) | 639 MB | 698 MB | 235 MB | 296 MB | 223 MB | 3.0 s |

Both binaries converge to a fixed **~234 MB floor** (JSR 234, npm 235 — they agree, cross-validating
the measurement): the embedded Deno runtime + V8 snapshot baked into the ~225 MB binary. `deno compile`
strips `deno run`'s npm-compat overhead — a **2.7× win for npm** (639→235) but a **~1.5× loss for JSR**
(153→234), whose `deno run` already sits *below* the binary floor. The lightest warm config of anything
measured is **JSR + plain `deno run`, 153 MB** — under both binaries, with the tightest startup peak.

So the two low-memory paths are alternatives, not additive:

- Stay on npm/Drizzle → `deno compile` (~226 MB, zero code change).
- Go maximalist JSR → just `deno run` (~153 MB); **don't** compile.

(npm `deno run` warm is core-pinning/warm-up sensitive — 639 MB here vs 496 in the earlier matched run;
the JSR 153 and the ~234 compiled floor are stable.)

## Part 8 — The dev loop: linear (not bounded), and the external-watcher + Kysely fix

This is the part that actually bit (the original "3 GB lockup"), now fully characterized.

**`--watch` is linear on a roomy host — it does NOT plateau (`bench/jsr-bench/plateau-test.sh`).** The
minimal-npm (Clerk-floor) server climbed a straight line **143 → 2,740 MB over 41 saves**, slope
unchanged end to end (+65 → +63 MB/save). It only plateaus (~600 MB) inside a **memory-capped
container**, where cgroup pressure forces reclamation. On bare metal with free RAM nothing forces it, so
it climbs to OOM. (This corrects the earlier "ramps then plateaus / bounded" framing — that plateau is
environment-specific, not a host property.)

**An external watcher fixes it — verified with real `watchexec -r` over 18 saves
(`bench/jsr-bench/external-watcher-test.sh`).** A fresh `deno run` per change (~200 ms cold start) never
stacks: the previous run's npm-compat layer dies with the process. The 2×2:

| query layer | `deno run --watch` | `watchexec -r` (fresh process) |
|---|---|---|
| heavy npm — Drizzle | +530/save → 3.4 GB in 6 saves (OOM) | flat ~340 MB |
| minimal npm — raw `@db/postgres` | +64/save → 2.7 GB in 41 saves (OOM) | flat ~147 MB |
| minimal npm — **Kysely** (ORM feel) | +64/save → 2.7 GB in 41 saves (OOM) | **flat ~148 MB** |

Two independent, additive axes: the **external watcher flattens the ramp** (every row goes flat), and
**minimal npm lowers the baseline** (147 vs 340 MB). **Kysely is the practical Drizzle replacement** —
a pure-ESM, zero-runtime-dep typed query builder used as a compiler over `@db/postgres`; it keeps
compile-time type-safety and sits on the floor (152 MB warm, +64/save, ~+1 over the Clerk floor), ~8×
under Drizzle, and needs no JSR publish (`npm:kysely` is already this clean through node-compat).

**Why coding agents explode this:** the two mechanisms compound. Each `--watch` server self-inflates per
save, *and* N agents run N servers → N processes each ramping linearly → 6–9 GB and a locked-up laptop,
fast. An *idle* watch server is harmless; agents are the opposite of idle. And it takes only **one**
`npm:` dependency — Drizzle alone explodes in ~6 saves, the lone Clerk floor climbs to OOM over ~41. It's
the node-compat loader path, not the library (same Hono: +19 `npm:` vs +2 `jsr:`). The only safe configs
are a fresh process per reload, zero npm deps (pure JSR), or memory-pressure (a capped container) — or
Clerk shipping JSR, which would make `--watch` itself safe.

## Reproducing this

Worktrees (kept on branches `bench/bun`, `bench/node`; Deno = `main`):

```
../doomscrollr-bun   (branch bench/bun)    # git worktrees, siblings of this repo
../doomscrollr-node  (branch bench/node)
```

Each worktree adds, at its root: `deno-shim.ts`, `boot.ts`, `package.json`, `tsconfig.json`
(path aliases for `@doomscrollr/*`), plus a copied `.env.local`. The app source is unchanged.

```bash
# Bun
cd ../doomscrollr-bun  && bun install
PORT=8090 bun boot.ts

# Node (tsx handles .ts + tsconfig paths; node 26 --env-file loads .env.local)
cd ../doomscrollr-node && npm install --legacy-peer-deps
PORT=8091 node --env-file=.env.local --import tsx boot.ts

# Deno (current app)
cd apps/api   # from the repo root
PORT=8092 deno run --allow-net --allow-env --allow-sys=hostname --env-file=../../.env.local src/main.ts

# Measure (per pid): grep -E 'VmRSS|VmHWM' /proc/<pid>/status
```

## Caveats
- RSS includes mapped shared libraries and V8/JSC reserved heap; it's the figure the OS and any
  cgroup/Lambda limit act on, so it's the right number for capacity planning, but "live JS
  objects" are lower.
- Deno's `deno run` figure (641 MB) is the dev/JIT cost; `deno compile` (tested) brings it to
  226 MB. Production should use the compiled binary, not `deno run`.
- Numbers are dev-machine, single-instance, low-traffic. Steady-state under real concurrency
  will differ, but the **relative** runtime gap (Deno ≫ Node > Bun for this app) is large and
  consistent across both experiments.
- The `deno run --watch` reload-accumulation finding (RSS grows ~475 MB/reload under real traffic;
  matches Deno #28107; localized to native, non-GC-reclaimable retention) is in `bench/dev-loop/`
  and written up for the Deno team in `DENO_TEAM_FEEDBACK.md`.

## War story (kept out of the public issue, on purpose)

During a cleanup pass a script ran `docker rm -f $(docker ps -aq --filter name=t)` to remove a
throwaway container named `t`. Docker's `name` filter is a **substring** match, and `postgres`
contains a `t` — so we force-removed the running `doomscrollr-postgres-1` container mid-benchmark
(that's the source of a few stray `/api/feed/recent` 500s in the logs). It was a local dev
container, the data lived in the `doomscrollr_postgres_data` named volume, and `docker compose up -d`
brought it back with all 50 rows intact. No production database was harmed; one engineer's composure
was. Lesson: `--filter name=t` is not a noun, it's a regex looking for trouble.

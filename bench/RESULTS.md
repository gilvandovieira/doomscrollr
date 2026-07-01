# Benchmark results (2026-06-24)

Machine: i7-12700H (20 cores), 15 GiB RAM, CachyOS. Deno 2.8.3 / Node 26.1.0 / Bun 1.3.14.
Same app on every runtime (Node/Bun via the `Deno` shim). Postgres 16 in Docker.

## Experiment A — synthetic baseline (minimal Hono + same deps), cold RSS
| Runtime | Cold RSS |
|---|---:|
| Bun | 73 MB |
| Deno | 126 MB |
| Node | 180 MB |

## Experiment B — real app, idle RSS (no CPU limit / all 20 cores)
| Mode | Idle RSS |
|---|---:|
| Deno (`deno run`) | 641 MB |
| Deno (`deno compile`) | 226 MB |
| Node | 206 MB |
| Bun | 100 MB |

→ App's intrinsic working set ≈ 27 MB (Node/Bun add only ~27 MB over the empty server).
The rest is runtime overhead; `deno compile` reclaims ~415 MB of `deno run`'s.

## Comprehensive load test (server pinned to 4 cores; 0 errors everywhere)
| Mode | Cold start | Idle RSS | Peak under load | `/health` rps (p50) | `/feed/recent` rps (p50) |
|---|---:|---:|---:|---|---|
| Deno (`deno run`) | 202 ms | 254 MB | 826 MB | 5,961 (16.6 ms) | 812 (61 ms) |
| Deno (`deno compile`) | 199 ms | 215 MB | 401 MB | 5,961 (16.6 ms) | 862 (58 ms) |
| Node (tsx)¹ | 567 ms | 196 MB | 246 MB | 20,824 (4.6 ms) | 1,240 (40 ms) |
| Bun | 118 ms | 91 MB | 198 MB | 33,698 (2.8 ms) | 884 (56 ms) |

¹ Node cold start inflated by `tsx` (dev transpiler); precompiled-JS deploy starts far faster.

Reading the rps: `rps ≈ concurrency ÷ avg latency`. `/health` = pure runtime (gaps wide);
`/feed/recent` = real DB query + 18 KB JSON (DB dominates, gaps collapse to ~1.5×, Node leads).
Idle RSS scales with core count on `deno run` (254 MB @4 cores vs 641 MB @20).

## Production image — runtime base comparison (same compiled binary)
| Base | Image size | Runs? | Idle (in container) | Note |
|---|---:|:---:|---:|---|
| debian:bookworm-slim (shipped) | 421 MB | ✅ | ~177 MiB | glibc |
| distroless/cc-debian12 | 331 MB | ✅ | ~178 MiB | glibc, smallest that works |
| alpine:3.20 (plain) | 309 MB | ❌ | — | musl: `exec: no such file or directory` |
| alpine:3.20 + gcompat | 313 MB | ❌ | — | `__res_init: symbol not found` |

`deno compile` emits glibc-only binaries → Alpine (musl) can't run them. Runtime RSS is identical
across bases (same binary); only image size differs. The 231 MB binary dominates image size.

## npm vs JSR — the `--watch` retention root cause

The reload retention is Deno's `npm:`/Node-compat loader, not `--watch` itself or graph size.

**Same library, two loaders** (no load, restarts verified, ×2): `npm:hono` **+19 MB/reload** vs
`jsr:@hono/hono` **+2** (identical code; the JSR build has *more* modules).

**Per-dependency** (each npm dep alone on a `jsr:@hono/hono` base):

| dep | +MB/reload |
|---|---:|
| `drizzle-orm` | +462 (~84%) |
| `@clerk/backend` | +62 |
| `hono` | +19 |
| `pino` | +4 |
| `postgres` (postgres.js) | +2 |

**Real app, real DB** (matched feed servers, `bench/jsr-bench/`):

| metric | npm (Drizzle) | JSR (raw `@db/postgres`) |
|---|---:|---:|
| warm RSS | 496 MB | 152 MB |
| startup peak | 499 MB | 157 MB |
| `--watch` retention | +552 MB/reload | +64 MB/reload |
| `/feed` throughput | 2,745 rps | 2,531 rps |

→ JSR is 3.3× lighter warm, 8.6× less reload retention, ~equal throughput. Drizzle is the killer
(npm-only); Clerk is the +62 floor (npm-only); postgres.js is free.

**Do the safe JSR swaps alone help? No — Drizzle dominates** (`bench/jsr-bench/jsr-safe-run.sh`, same
session): swapping the JSR-available deps (hono/zod/logging) to JSR while *keeping Drizzle* barely moves
the dev-loop ramp.

| Deno stack | warm RSS | `--watch` retention |
|---|---:|---|
| all-npm (Drizzle + npm hono/zod/pino) | 574 MB | +528/save → OOM @ 6 |
| safe-JSR only (hono/zod/log → JSR, Drizzle kept) | 496 MB | +510/save → OOM @ 6 |
| **Kysely + full safe-JSR** (+ `@db/postgres`) | **158 MB** | **+64/save** |

The safe swaps alone shave ~14% warm RSS (free) but only ~3% off the reload ramp — still OOMs in ~6
saves. **Drizzle → Kysely is the move that matters**; hono/zod/log → JSR are cheap free-riders done
alongside it, not instead. (npm warm RSS wanders 496–574 across runs; the retention is stable ~+510–550.)

## `deno compile` × JSR vs npm — compile does NOT help the JSR stack (`bench/jsr-bench/compile-compare.sh`)

Same matched feed servers, same DB, back-to-back. `deno run` vs a `deno compile` binary:

| Stack | `deno run` warm | run peak | `deno compile` warm | compile peak | binary | compile |
|---|---:|---:|---:|---:|---:|---:|
| **JSR** (@hono/hono + @db/postgres + @std/log + @zod/zod) | **153 MB** | 156 MB | 234 MB | 301 MB | 226 MB | 3.8 s |
| **npm** (hono + drizzle + postgres.js + pino + zod) | 639 MB | 698 MB | 235 MB | 296 MB | 223 MB | 3.0 s |

The 641→226 win is **specific to the npm/Drizzle stack.** Both binaries converge to a fixed **~234 MB
floor** (JSR 234, npm 235 — they agree, cross-validating the measurement) = the embedded runtime + V8
snapshot baked into the ~225 MB binary. `deno compile` strips `deno run`'s npm-compat overhead — a 2.7×
win for npm (639→235), but a **~1.5× loss for JSR** (153→234), whose `deno run` is already below the
binary floor. **Lightest warm config tested = JSR + plain `deno run`, 153 MB** (below both binaries;
tightest peak too). So the two low-memory paths are alternatives, not additive:
- Stay on npm/Drizzle → `deno compile` (~226 MB, zero code change).
- Go maximalist JSR → just `deno run` (~153 MB); **don't** compile.

(npm `deno run` warm is core-pinning/warm-up sensitive: 639 MB here vs 496 in the earlier matched run.
JSR 153 (vs 152) and the ~234 compiled floor are stable.)

## The dev loop — `--watch` is linear (not bounded), external watcher + Kysely is the fix

**`--watch` does NOT plateau on a roomy host (`bench/jsr-bench/plateau-test.sh`).** The minimal-npm
(Clerk-floor) server climbed a dead-straight line 143 → 2,740 MB over 41 saves, slope unchanged
(+65 → +63 MB/save). It only plateaus (~600 MB) inside a memory-capped container, where cgroup pressure
forces reclamation — on bare metal with free RAM it climbs to OOM. (Correction to an earlier
"ramps then plateaus / bounded" reading: that plateau is container-only.)

**An external watcher fixes it — verified with real `watchexec -r`, 18 saves
(`bench/jsr-bench/external-watcher-test.sh`).** A fresh `deno run` per change (~200 ms cold start) never
stacks; the previous run's npm-compat layer dies with the process. The 2×2:

| query layer | `deno run --watch` | `watchexec -r` (fresh process) |
|---|---|---|
| heavy npm — Drizzle | +530/save → 3.4 GB in 6 saves (OOM) | flat ~340 MB |
| minimal npm — raw `@db/postgres` | +64/save → 2.7 GB in 41 saves (OOM) | flat ~147 MB |
| minimal npm — **Kysely** (ORM feel) | +64/save → 2.7 GB in 41 saves (OOM) | **flat ~148 MB** |

External watcher flattens the ramp; minimal npm lowers the baseline; **Kysely keeps type-safe query
building for free** (148 MB, identical to raw SQL, ~8× under Drizzle, no JSR publish needed —
`npm:kysely` is pure-ESM with zero runtime deps, ~+1 MB/save over the Clerk floor).

**Why agents hit the wall:** the two mechanisms compound — each `--watch` server self-inflates per save,
*and* N agents run N servers. N processes each ramping linearly → 6–9 GB fast. One `npm:` dep is enough
(Drizzle explodes in ~6 saves; even the lone Clerk floor climbs to OOM). Safe configs: fresh process per
reload, zero npm deps (pure JSR), or a capped container. Clerk on JSR would make `--watch` itself safe.

## Bottom line
- Container deploy → `deno compile` (stay on Deno, ~3× less RAM than `deno run`, no code change).
- Lambda native runtime → Node (only managed option → parity; memory ≈ compiled Deno).
- Absolute min memory → Bun (but no Lambda-native; container only).
- Throughput is ~a wash for this DB-bound app; memory + cold start are the real differentiators.

---

# Re-baseline (2026-06-30) — Deno 2.9.0, + Sisal ORM

Machine: same 20-core host. **Deno 2.9.0** (the sections above were **2.8.3**). Same local Postgres 16
(`:5433`), same feed query, same core pinning (server 0-3, loadgen 8-15), `@clerk/backend` npm floor in
every stack. Harness: `bench/jsr-bench/sisal-vs-run.sh` (4 stacks × 3 rounds, `--minimum-dependency-age=0
--no-lock` so every stack resolves current-latest — the workspace pins a 2026-06-24 age cutoff that would
otherwise block the post-cutoff `@sisal/*` packages). Stack files: `npm-feed.ts` (Drizzle), `jsr-feed.ts`
(raw `@db/postgres`), `kysely-jsr-full.ts` (Kysely), `sisal-feed.ts` (`@sisal/orm` + `@sisal/pg`, which
rides `jsr:@db/postgres`).

Medians of 3 rounds (warm RSS is warm-up sensitive — range shown):

| Stack | warm RSS (med) | warm range | startup peak | post-load RSS | `/feed` rps | p50 | `--watch` +MB/reload |
|---|---:|---:|---:|---:|---:|---:|---:|
| npm — **Drizzle** | 130 | 111–183 | ~1584 | 242 | 5,550 | 2.0 ms | +17 (12–23) |
| jsr — raw `@db/postgres` | 180 | 152–185 | ~997 | 236 | 3,001 | 3.7 ms | +60 (55–61) |
| **Kysely** (compiler + `@db/postgres`) | 127 | 127–202 | ~1658 | 138 | 25† | 505 ms† | +11 (8–13) |
| **Sisal** (`@sisal/orm` + `@sisal/pg`) | 162 | 148–191 | ~968 | 179 | 120† | 90 ms† | +61 (54–74) |

## Headline: Deno 2.9 dissolved the npm-compat memory tax

The entire 2.8.3 story above — **Drizzle at 496–639 MB warm and +530 MB/`--watch` reload → OOM in ~6 saves**
— is **gone on 2.9.0.** Same Drizzle stack now sits at **~130 MB warm** (median) with **+17 MB/reload**. The
`--watch` linear-ramp-to-OOM that motivated `watchexec` and the whole "Drizzle is the killer" conclusion no
longer reproduces on this runtime. All four stacks now cluster in a tight **~127–190 MB warm** band; the old
~8× Drizzle-vs-JSR spread has collapsed. The 2.8.3 findings should be read as **version-specific to that
Deno**, not intrinsic to the stack.

Two inversions vs 2.8.3 worth noting: (1) the **JSR-driver stacks now retain *more* per `--watch` reload**
(raw +60, Sisal +61) than the npm stacks (Drizzle +17, Kysely +11) — the opposite of before; (2) Drizzle's
warm RSS is at/under raw `@db/postgres`. None of it matters much: every stack is far under the old ceiling.

## Where Sisal lands

- **Memory: competitive, in the pack.** 162 MB warm median (148–191), and the **lowest startup peak tested
  (~968 MB, tied with raw `@db/postgres`)** — well under Drizzle/Kysely's ~1.6 GB npm-compat transpile
  transient. On 2.9 Sisal does **not** beat Drizzle on warm RSS (they're within noise), but it's the same
  class — respectable for a v0.5.0 ORM, and fully JSR-native (no npm-compat loader, portable).
- **Throughput: the real gap.** Sisal served **120 rps at ~90 ms p50** vs Drizzle's 5,550 rps @ 2 ms and raw
  `@db/postgres`'s 3,001 @ 3.7 ms — a **~45× throughput / ~25× latency gap**, *stable across all 3 rounds*
  (90.2 / 90.0 / 88.5 ms). Since `@sisal/pg` rides the same `@db/postgres` driver that raw uses at 3.7 ms,
  the ~90 ms is **Sisal's own per-request overhead** (SQL build/render + decode, or pool-acquisition
  cost), not the driver. This is the thing to profile before any real swap.

† **Throughput is not apples-to-apples**: each bench file uses a different connection strategy (Drizzle =
postgres.js pool `max:5`; raw & Kysely = a single non-pooled `@db/postgres` `Client`; Sisal = `@db/postgres`
`Pool(5)` via `@sisal/pg`). Kysely's 25 rps / **505 ms** (eerily constant) is an artifact of that stack's
single-Client path, not a Kysely property — treat both Kysely and Sisal throughput as indicative, not
ranked. The **memory** columns are the clean comparison.

## Bottom line for the Drizzle → Sisal question

On **Deno 2.9**, the memory argument for leaving Drizzle has largely evaporated (Drizzle ≈ 130 MB warm,
`--watch` no longer ramps). So a Sisal swap would be justified by **ergonomics / JSR-portability / owning the
ORM**, not by RAM. Sisal is memory-competitive today but carries a **large, reproducible per-query latency
penalty (~90 ms)** that should be profiled and closed before it's a candidate for the real app's hot feed
path. Recommend: re-confirm the 2.9 memory picture holds for the *full* app (not just the feed stack) before
weighting memory at all, and treat the Sisal throughput gap as the gating issue.

## Follow-up (2026-06-30): the postgres.js adapter closes — and reverses — the gap

The ~90 ms Sisal throughput gap was root-caused to `jsr:@db/postgres`'s parameterized/extended-protocol path
(a ~42 ms/query TCP delayed-ACK stall — see `SISAL_PG_ADAPTER_PERF_REPORT.md`). A prototype postgres.js-backed
`PgPool` injected via the public `connect({ pool })` (no Sisal source change,
`bench/jsr-bench/sisal-postgresjs-pool.ts`) was benchmarked as a 5th stack (`sisal-pgjs-feed.ts`), full suite,
3 rounds, same session:

| Stack (Deno 2.9.0) | warm RSS (med) | range | startup peak | post-load RSS | `/feed` rps | p50 | `--watch` +MB/reload |
|---|---:|---:|---:|---:|---:|---:|---:|
| npm — Drizzle (postgres.js) | 122 | 121–139 | ~1555 | 232 | 5,445 | 2.0 ms | +15 |
| jsr — raw `@db/postgres` (literals) | 179 | 155–188 | ~955 | 237 | 2,888 | 3.8 ms | +60 |
| Kysely (`@db/postgres`, parameterized) | 130 | 128–147 | ~1612 | 140 | 25 | 505 ms | +26 |
| Sisal → `@db/postgres` (parameterized) | 155 | 146–155 | ~951 | 173 | 120 | 90 ms | +62 |
| **Sisal → postgres.js (prototype)** | **169** | 151–171 | **~968** | 276 | **6,774** | **1.6 ms** | +69 |

**Result: the driver swap took Sisal from last to first on throughput** — 120 → **6,774 rps** (~56×), 90 ms →
**1.6 ms** p50, now **ahead of Drizzle** (5,445 rps @ 2.0 ms; both ride postgres.js, so it's a wash ±noise).
Rows identical, interactive `db.transaction()` intact (adapter reserves a connection per `pool.connect()`).

**Memory cost of the swap is small.** warm RSS 169 MB (vs Sisal-default 155, Drizzle 122) and post-load 276 MB
(vs 232) — postgres.js adds some working set, but Sisal+postgres.js **keeps the lowest-tier startup peak
(~968 MB, like Sisal-default; vs Drizzle/Kysely's ~1.6 GB npm-compat transient)** and stays mid-pack warm.
`--watch` +69/reload, in line with the other postgres.js/JSR-driver stacks and far under the old 2.8.3 ceiling.

**Net:** on Deno 2.9, Sisal + a postgres.js driver = **Drizzle-class-or-better throughput + full ORM ergonomics
+ competitive memory + the lowest startup peak.** The only open item is upstreaming the driver into `@sisal/pg`
(or fixing `TCP_NODELAY` in deno-postgres so the JSR-native driver is viable too).

## Released: `@sisal/pg` v0.5.1 (2026-07-01, clean re-run)

The driver shipped in **`@sisal/pg` v0.5.1** as a built-in, selected via `connect({ url, driver:
"postgres-js" })` (postgres.js lazily `import()`-ed; `@db/postgres` stays the pure-JSR default; the release also
adds bigint/date/timestamp decoders so rows are byte-identical across drivers). Full 5-stack suite re-run
against the **published** `jsr:@sisal/pg@0.5.1` + `@sisal/orm@0.5.1` — `sisal-pgjs-feed.ts` now uses the
official option, not the injected prototype. **An initial run overlapped with Sisal's own repo benchmarks and
was discarded** for CPU/DB contention (npm rps drifted 5,491 → 4,760 across rounds); the numbers below are the
clean re-run on an idle box (rps tight round-to-round).

| Stack (Deno 2.9.0, @sisal 0.5.1) | warm RSS (med) | range | startup peak | post-load | `/feed` rps | p50 | `--watch` +MB/reload |
|---|---:|---:|---:|---:|---:|---:|---:|
| npm — Drizzle (postgres.js) | 136 | 132–186 | ~1603 | 247 | 5,638 | 2.0 ms | +18 |
| jsr — raw `@db/postgres` (literals) | 163 | 145–182 | ~976 | 223 | 2,971 | 3.8 ms | +65 |
| Kysely (`@db/postgres`, parameterized) | 129 | 117–136 | ~1550 | 140 | 25 | 505 ms | +10 |
| Sisal → `@db/postgres` (v0.5.1 default) | 169 | 163–173 | ~951 | 187 | 120 | 91 ms | +63 |
| **Sisal → postgres.js (v0.5.1 driver)** | **157** | 148–159 | **~957** | 264 | **6,655** | **1.65 ms** | +64 |

**The shipped v0.5.1 driver reproduces the prototype exactly: 6,655 rps @ 1.65 ms** (prototype was 6,774 @
1.6 ms) — top of the table, **ahead of Drizzle** (5,638 @ 2.0 ms) and **~55× over Sisal-default** (120 @ 91 ms).
Memory story unchanged: warm 157 MB (mid-pack), **lowest-tier startup peak ~957 MB** (vs Drizzle/Kysely
~1.6 GB), post-load 264 MB, `--watch` +64. Cross-round consistency (Drizzle 5,628–5,645; Sisal+pgjs
6,579–6,706) confirms the clean run vs the discarded contended one. **Ship-and-done: `@sisal/pg` v0.5.1 with
`driver: "postgres-js"` delivers Drizzle-class-or-better throughput + Sisal ergonomics + competitive memory +
the lowest startup peak of any stack tested.**

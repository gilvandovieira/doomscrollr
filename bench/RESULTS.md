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

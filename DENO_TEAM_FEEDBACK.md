# `deno run --watch` per-reload RSS ramp to OOM on 2.9.0 — the trigger is an on-disk `node_modules` (`nodeModulesDir: "auto"`); a `jsr:@hono` + `npm:@clerk/backend` island ramps linearly, and `--node-modules-dir=none` makes the *same code* plateau

> _Disclaimer: this report was researched and drafted with the assistance of an LLM (Anthropic's Claude). The
> measurements are real and independently reproducible via the scripts/commands referenced herein; the LLM
> assisted with the benchmarking, isolation, and write-up._

> **This is the updated version.** After filing, we isolated an additional trigger — an on-disk `node_modules`
> (`nodeModulesDir: "auto"`) — that the originally-filed text didn't mention, and the version below now leads
> with it. The original post is filed as **[#35664]**; a short, plain-words reproduction is in
> `DENO_TEAM_FEEDBACK_FOLLOWUP.md`.

> **Update for Deno 2.9.0 (leads; the original 2.8.3 report is retained as a baseline at the bottom).**
> The original report (Deno **2.8.3**, follow-up to [#28107]) showed `deno run --watch` retaining `npm:`/
> Node-compat module graphs per reload — an all-`npm:` stack climbed **+530 MB/reload → OOM in ~6 saves**. On
> 2.9.0 the homogeneous-`npm:` case is fixed (it **plateaus ~295 MB** and reclaims). **But `--watch` still
> ramps to OOM for one shape, and we have now pinned its trigger to an on-disk `node_modules`:**
>
> - **Necessary condition — `nodeModulesDir: "auto"` (an on-disk `node_modules`).** The *same*
>   `jsr:@hono` + `npm:@clerk/backend` file ramps **+57 MB/reload → OOM** with `node_modules` materialized on
>   disk, but **plateaus ~120 MB** when run with `--node-modules-dir=none` (npm deps served from Deno's global
>   cache). One flag flips ramp ↔ plateau.
> - **It's the _contents_ of a real install, not `node_modules` size.** The same 2-import server ramps
>   **+56/reload** against our app's real `node_modules`, but stays flat against a *synthetic* `node_modules`
>   of similar size — and copying our real `node_modules` into a bare folder (one-line `deno.json`, no
>   workspace) reproduces the ramp (+48/reload). So **a bare two-file snippet in an empty folder does _not_
>   reproduce; a real project (or a copy of its `node_modules`) does.** We have not isolated which package(s).
> - **Composition still sets ramp vs plateau at a fixed `node_modules`.** With the 199 MB `node_modules` held
>   constant, `jsr:@hono` + Clerk ramps linearly while `npm:hono` + Clerk **plateaus** (~240 MB, confirmed over
>   20 reloads). So the ramp is **(jsr-framework + `npm:` island) × on-disk `node_modules`** — a JSR-native
>   framework plus the one npm dep with no JSR build (Clerk), run the normal way (`nodeModulesDir: "auto"`).
> This is exactly our app's shape (`@hono/hono`, `@sisal/*` + `npm:@clerk/backend`).

## TL;DR — the ramp needs an on-disk `node_modules`

| condition (Deno 2.9.0) | behavior |
|---|---|
| `jsr:@hono` + `npm:@clerk/backend`, **`nodeModulesDir: "auto"`** (our repo, 199 MB `node_modules`) | **+56 MB/reload, linear → OOM** ❌ |
| **same file, `--node-modules-dir=none`** (npm deps from Deno's global cache) | **plateaus ~120 MB** ✅ |
| same file, **2-package `node_modules`** (empty folder) | +4–6 MB/reload, plateaus |
| `npm:hono` + `npm:@clerk/backend`, `nodeModulesDir: "auto"` | **plateaus ~240 MB** ✅ |
| all-`npm:` (hono + drizzle + … + clerk), `nodeModulesDir: "auto"` | **plateaus ~295 MB**, reclaims ✅ |
| `jsr:@hono` + `postgres.js` / `@db/postgres`, `nodeModulesDir: "auto"` | **plateaus** (~243 / ~378) |

Three findings stack up. (1) The **necessary condition is an on-disk `node_modules`** — with
`--node-modules-dir=none` the identical code plateaus; one flag flips it. (2) It's the **contents of a real
install, not `node_modules` size** — a *synthetic* `node_modules` of the same size stays flat, but copying our
real `node_modules` into a bare folder reproduces the ramp; individual heavy packages (`drizzle-orm` imported,
or `@jsr/zod`) don't trigger it on their own. (3) At a fixed `node_modules`, **composition** decides ramp vs
plateau: a `jsr:` framework + an `npm:` island (Clerk) ramps, while all-`npm:` reclaims. Net: the ramp needs a
**real, materialized `node_modules`** plus the **(jsr-framework + `npm:` island)** shape — so a minimal
two-file snippet won't show it; run it in a real project (below). We have not isolated which package(s).

## The trigger — an on-disk `node_modules` (`nodeModulesDir: "auto"`)

The single decisive variable is whether the npm deps are materialized to an on-disk `node_modules`. Same file
(`iso-jsr-hono-clerk.ts`), same machine, only the resolution mode changes:

```
deno run --watch iso-jsr-hono-clerk.ts                          → boot 155 → 613 MB in 8 reloads (+57/reload), ramps to OOM
deno run --watch --node-modules-dir=none iso-jsr-hono-clerk.ts  → boot  81, flat ~120 MB, plateaus
```

With `--node-modules-dir=none` the npm deps load from Deno's global cache and the same code reclaims per
reload. With `nodeModulesDir: "auto"` (the default way a Deno app that uses npm packages is run, and what our
repo sets) it ramps linearly. **This is why a bare two-file snippet in an empty folder doesn't reproduce** — it
needs a real `node_modules`.

It is **not** raw `node_modules` size, and **not** any single heavy package. A controlled sweep (same server;
`node_modules` size varied only via *unimported* packages) did **not** scale with size — a 124 MB synthetic
`node_modules` ramped *less* than a 33 MB one. What does reproduce it is **copying our real `node_modules` into
a bare folder** (minimal `deno.json`, no workspace). The server imports only `@hono/hono` + `@clerk/backend` in
every row:

| `iso-jsr-hono-clerk.ts` run against… | `node_modules` | per-reload (12 reloads) |
|---|---|---|
| empty folder / small synthetic install | ≤ few MB | +4–6, flat |
| synthetic install, biggest tier | 124 MB | +7, flat |
| `drizzle-orm` imported (full module graph) | 17 MB | +6, flat |
| `@jsr/zod` added | 17 MB | +3, flat |
| **our real `node_modules`, copied into a bare folder** | **197 MB** | **+48, linear → OOM** |
| **our repo, in place** | **197 MB** | **+56, linear → OOM** |

So the trigger is the **contents of a real dependency install**: the bare-folder copy rules out the workspace/
config, the synthetic tiers rule out raw size, and drizzle / `@jsr/zod` on their own rule out a single heavy
package. We have **not** isolated the exact package(s) — it appears to need the full real dependency set. What
is certain: `--watch` retains something tied to the materialized `node_modules`, and `--node-modules-dir=none`
turns it off.

## 2.9.0 evidence — two long `--watch` soaks

Method (both): no load; reload = append a `// …` comment to the watched entry file (each restart verified
via the watcher log); after `/ready`, warm the feed once, then read `VmRSS` of the (stable) PID. Loop stops
at a **3 GB loop-level cap** (a *hard cgroup* cap is avoided — it would force reclamation and fake a
plateau). Deno 2.9.0, Postgres 16 over loopback, server pinned to 4 cores.

**A. all-`npm:` (Drizzle) — PLATEAUS.** `npm-feed.ts`, 32 reloads:
`159 → ~300 MB by reload ~22, then flat/oscillating 288–307`. **Last 10 reloads: net −7 MB** (reclaiming).
Overall +4 MB/reload and falling. **Bounded ~295 MB.**

**B. Full JSR-native app stack (jsr `@hono`/`@sisal/*` + `npm:postgres` + the `npm:@clerk` floor) — RAMPS.**
`sisal-pgjs-feed.ts`, 52 reloads to the 3 GB cap: `191 → 3050 MB`. **+54 MB/reload, dead-linear** (last-8
slope = first-8 slope; no plateau). Would OOM. *The isolation below pins the cause to the `npm:@clerk` island
— not the JSR modules or the DB driver.*

```
A (Drizzle, npm):  159 215 241 264 252 218 182 207 221 216 206 207 225 231 219 221 220 234 239 254
                   278 271 302 300 287 294 296 288 291 307 298 292 295   → plateau ~295, last-10 net −7
B (Sisal, pgjs):   191 281 341 400 477 492 537 620 … 1046(r14) … 1999(r32) … 2837(r48) … 3050(r52, cap)
                   → straight line, +54/reload, no plateau
```

**Cross-stack, first 6 reloads (2.9, median of 3 rounds), for context:**

| stack | +MB/reload (6-reload) | long-soak behavior |
|---|---:|---|
| npm — Drizzle | +18 | **plateaus ~295 MB** |
| Kysely (`@hono/hono`+`npm:kysely`+`@db/postgres`) | +10 | (not soaked; low) |
| raw `@db/postgres` (`@hono/hono`+`@db/postgres`) | +65 | (not soaked; matches the ramper rate) |
| Sisal → `@db/postgres` | +63 | (not soaked; matches the ramper rate) |
| **Sisal → postgres.js** | +64 | **ramps → 3 GB @ 52 reloads** |

A 6-reload window **cannot distinguish plateau from ramp**: Drizzle looks like +18/reload early, then
decelerates and caps ~295 MB; the JSR/pg-driver stacks look similar early (+63–65) but stay linear to OOM. A
short window overestimates the long-run rate for plateau-ers and hides the unbounded ones — long soaks are
required.

## The 2.9 isolation — composition axis (at a fixed on-disk `node_modules`)

> All rows below were measured **in our repo** (`nodeModulesDir: "auto"`, the 199 MB workspace
> `node_modules`), so the on-disk-`node_modules` trigger above is held constant across them — this table
> isolates the *second* factor, graph composition. The same rows in an empty folder (no materialized
> `node_modules`) all plateau, including the `jsr:@hono` + Clerk one.

We re-ran the original report's same-library control **with long soaks** (5 reloads can't tell plateau from
ramp), then added one dependency at a time on a bare Hono base (no load; same soak/cap method, ~45 reloads):

| minimal stack (Deno 2.9) | result |
|---|---|
| `npm:hono` | **plateaus ~225 MB** |
| `jsr:@hono/hono` | **plateaus ~201 MB** |
| `jsr:@hono` + `npm:postgres` (postgres.js) | **plateaus ~243 MB** |
| `jsr:@hono` + `jsr:@db/postgres` | **plateaus ~378 MB** |
| **`jsr:@hono` + `npm:@clerk/backend`** | **RAMPS +51 MB/reload → 133 → 2434 MB, no plateau** |
| `npm:hono` + `npm:@clerk/backend` | **plateaus ~265 MB** |

- **The loader is not the axis.** Bare `npm:hono` and `jsr:@hono/hono` **both plateau** on 2.9 (~225 vs ~201)
  — the 2.8.3 `npm:hono` +19/reload retention is **fixed**. The polarity didn't "flip"; homogeneous-npm
  graphs simply reclaim now.
- **The DB driver is not the ramp.** `jsr:@hono` + `postgres.js` and `jsr:@hono` + `@db/postgres` both
  **plateau** (postgres.js was already the near-free +2 dep on 2.8.3; still is).
- **The culprit is `npm:@clerk/backend` — but only as an `npm:` island in a JSR-dominant graph.** `jsr:@hono`
  + Clerk **ramps linearly to OOM** (+51/reload, dead straight, would hit 3 GB ~reload 58); the **same Clerk
  in an all-`npm:` graph plateaus** (`npm:hono` + Clerk ~265 MB; the all-npm Drizzle stack ~295 MB). So
  retention scales with an npm dep's **node-compat weight × graph composition**: a heavy npm package whose
  node-compat graph isn't reclaimed per reload **when it's the minority in a JSR graph**.

This is exactly our real-world shape — a JSR-native stack (`@hono/hono`, `@sisal/*`) plus the **one npm dep
with no JSR equivalent, Clerk** — which is why every JSR-based stack in the app (`sisal`, `sisal-pgjs`,
`jsr-feed`) ramps while the all-npm Drizzle stack plateaus.

**The earlier "Kysely anomaly" dissolves:** its +10 was a 6-reload artifact; Kysely also imports `jsr:@hono` +
`npm:@clerk/backend`, so a long soak ramps like the rest. Short windows are unreliable — long soaks mandatory.

## Related Deno changes (2.8.3 → 2.9.0)

We traced this against the Deno repo. The shift is **2.9.0-scoped** — there are **no patch releases** between
the 2.8.3 tag (2026-06-11) and 2.9.0 (2026-06-25). We did **not** find a changelog line that names
"`npm:` module-graph retention under `deno run --watch`," but three things are directly relevant:

- **[#28107] "Memory leak with file watcher" was closed COMPLETED (2026-06-04) as "not a per-run leak — it
  plateaus."** A maintainer re-ran the original repro (`@huggingface/transformers`, 8 `--watch` restarts) and
  got `1077 → 1245 → … → 1452 MB` — *"grows during the first couple of restarts and then plateaus ~1.45 GB …
  consistent with allocator fragmentation and module/npm caches rather than a per-run leak."* That plateau
  **matches our 2.9 all-npm (Drizzle) result** (grows, then caps ~295 MB). Two caveats in that comment matter
  here: it was tested on **aarch64-macOS** (we're on **x86_64/glibc** — allocator behavior differs, and our
  plateau-vs-ramp split is environment-sensitive), and it exercised the **WASM** backend, with the explicit
  note that **native N-API addons are "the one path that can survive isolate teardown."** Our ramper uses no
  native addon and no DB — isolated to bare `jsr:@hono` + `npm:@clerk/backend`. What survives teardown here is
  the **`npm:`/node-compat module graph of a heavy npm dep embedded in a JSR graph** — a path the WASM/npm
  repro on macOS never exercised.
- **`fix(serve): shut down old workers on watcher restart` ([#35136], merged 2026-06-13 → ships in 2.9.0)**
  is the same *class* of bug: *"a watcher restart only dropped the `do_serve` future, but the previous
  generation of workers kept running … the leaked main worker task eventually crashed the process."* **But it
  fixes [#26052] = `deno serve --parallel --watch`** — a different entry point from our `deno run --watch` +
  `Deno.serve`, which that change does **not** cover.
- Lower-confidence 2.9.0 entries in the same area: `perf(snapshot): guard against lazy modules leaking into
  eager snapshot` and `fix(core): always register isolate to prevent silent foreground task drop`.

So Deno currently treats watcher memory as **resolved/plateauing**, and fixed watcher-restart worker cleanup
**only for `deno serve --parallel`** — yet a minimal, reproducible **`deno run --watch` + `jsr:@hono` +
`npm:@clerk/backend`** case ramps **linearly to OOM** (133 → 2.4 GB in 45 saves, no plateau), neither covered
by #35136 nor consistent with the "it plateaus now" close of #28107. The homogeneous-npm plateau the
maintainer observed is real (we confirm it); the uncovered case is a **heavy `npm:` dep as a minority island
in a JSR graph.**

## Reproduction (2.9.0)

```bash
# EASIEST — from the repo root (needs the on-disk node_modules; no DB, no .env). Runs BOTH cases + a verdict.
# A) jsr:@hono + npm:@clerk/backend → RAMPS ;  B) npm:hono + npm:@clerk/backend → PLATEAUS.
deno install                                   # materialize node_modules (nodeModulesDir: auto) — this is what makes it ramp
RELOADS=30 bash bench/jsr-bench/repro-clerk-island.sh
# (Linux: RSS is read from /proc; tested on Deno 2.9.0. A bare copy of the two files in an empty
#  folder does NOT ramp — the ramp needs node_modules materialized on disk. See below.)

# THE on/off switch — same file, only the resolution mode changes (run from the repo root, no DB):
deno run --watch --allow-net --allow-env --allow-sys=hostname bench/jsr-bench/iso-jsr-hono-clerk.ts                       # → RAMPS to OOM
deno run --watch --node-modules-dir=none --allow-net --allow-env --allow-sys=hostname bench/jsr-bench/iso-jsr-hono-clerk.ts  # → PLATEAUS ~120 MB

# single-variable isolation via the soak harness (no DB; run from the repo root so node_modules is on disk):
#   iso-jsr-hono-clerk.ts : import { Hono } from "jsr:@hono/hono"; import { verifyToken } from "npm:@clerk/backend"
#   iso-npm-hono-clerk.ts : import { Hono } from "npm:hono";        import { verifyToken } from "npm:@clerk/backend"
CAP_MB=3000 MAX_RELOADS=45 bash bench/jsr-bench/watch-soak.sh iso-jsr-hono-clerk.ts  # → RAMPS +56/reload → OOM
CAP_MB=3000 MAX_RELOADS=45 bash bench/jsr-bench/watch-soak.sh iso-npm-hono-clerk.ts  # → plateaus ~240 MB
CAP_MB=3000 MAX_RELOADS=45 bash bench/jsr-bench/watch-soak.sh iso-jsr-hono-pgjs.ts   # → plateaus ~243 MB (light npm dep)
# full-stack confirmation:
CAP_MB=3000 MAX_RELOADS=160 bash bench/jsr-bench/watch-soak.sh npm-feed.ts        # all-npm     → plateaus ~295 MB
CAP_MB=3000 MAX_RELOADS=60  bash bench/jsr-bench/watch-soak.sh sisal-pgjs-feed.ts # jsr + clerk → ramps to 3 GB @ ~52
# fresh process per reload stays flat (unchanged from 2.8.3):
watchexec -r -e ts -- deno run --allow-net --allow-env --allow-sys=hostname --env-file=.env.local <entry>
```

## The ask (reframed)

1. **Why does `nodeModulesDir: "auto"` ramp when `--node-modules-dir=none` reclaims?** This is the cleanest
   lever we found: the *identical* `deno run --watch` + `jsr:@hono` + `npm:@clerk/backend` file **ramps
   linearly to OOM** with an on-disk `node_modules` and **plateaus ~120 MB** with `--node-modules-dir=none`.
   Whatever `--watch` retains per reload seems tied to the on-disk `node_modules` materialization. It's the
   *contents* of a real install — copying our `node_modules` into a bare folder reproduces it — **not** the
   size (a synthetic same-size `node_modules` doesn't ramp) and **not** any single heavy package (`drizzle-orm`
   or `@jsr/zod` alone don't). We have not isolated the exact package(s).
2. **Please reopen [#28107] (or track this as a new issue).** Its "resolved — it plateaus" close holds for
   the homogeneous-npm path on 2.9 (we confirm the plateau, ~295 MB), but is **directly contradicted** by a
   `deno run --watch` + `jsr:@hono` + `npm:@clerk/backend` case (run the normal way, `nodeModulesDir: "auto"`)
   that ramps **linearly to OOM** (no plateau, no reclamation) on x86_64/glibc — no DB, no native addon. The
   #28107 repro exercised only the WASM path on macOS; this `node_modules`-dependent path wasn't covered.
   Secondary question: at a fixed `node_modules`, why does `npm:hono` + Clerk plateau (~240 MB) while
   `jsr:@hono` + Clerk ramps? The composition matters on top of the `node_modules` trigger.
3. **Does [#35136] ("shut down old workers on watcher restart") apply to `deno run --watch` + `Deno.serve`,
   or only `deno serve --parallel`?** The mechanism it fixes (old workers/isolate state not cancelled on
   restart) is the same class, but #26052/#35136 are scoped to `deno serve`. If `deno run --watch` doesn't
   get the same cancellation-on-restart, that gap is a prime suspect.
4. Failing a fix: **release the previous run's retained `npm:`/node-compat module graph on `--watch`
   restart** (the isolate itself is reclaimed — bare hono, and the driver stacks, all plateau), or a flag to
   fork a fresh process per reload (the fresh-process control is flat), plus a way to **report** what a
   `--watch` process retains across reloads.

> **Note for Clerk users specifically:** since Clerk is `npm:`-only (no JSR build), a JSR-native Deno app
> can't avoid this by going full-JSR — the one required `npm:@clerk/backend` import is itself the trigger. A
> JSR distribution of `@clerk/backend` would sidestep it entirely (tracked in our `CLERK_JSR_REQUEST.md`).

## Environment (2.9 update)

| | |
|---|---|
| Deno | **2.9.0** (stable, x86_64-unknown-linux-gnu) |
| CPU / RAM | i7-12700H (20 cores) / 15 GiB |
| DB | Postgres 16 (Docker, loopback) |
| Resolver | `nodeModulesDir: "auto"`, 199 MB on-disk workspace `node_modules` (the trigger) |

---

# Appendix — 2.8.3 baseline (the original report, retained for history + isolation methodology)

> Everything in this appendix was measured on **Deno 2.8.3** and is **superseded** by the 2.9 update above
> for the all-npm case. It is kept because (a) it documents the same-library `npm:` vs `jsr:` control and
> per-dep methodology — which we **did re-run on 2.9** (see *The trigger* and *The 2.9 isolation* above), and
> (b) it records the npm-compat mechanism that 2.9 fixed for homogeneous-npm graphs. **Caveat:** these 2.8.3
> runs were also in-repo with `nodeModulesDir: "auto"`, so the on-disk-`node_modules` trigger we isolated on
> 2.9 very likely applied on 2.8.3 too — we have not re-tested 2.8.3 with `--node-modules-dir=none`.

**Same library, two resolution paths (the 2.8.3 isolation).** `import { Hono }` from `npm:hono` retained
~**+19 MB/reload**; from `jsr:@hono/hono` ~**+2 MB/reload** (×2, stable) — identical library/code, only the
`npm:`/Node-compat loader differs, and the JSR build has *more* modules. So on 2.8.3 it was **not** library,
byte size, or module count; the retained RSS tracked the `npm:`/Node-compat module path.

**Module count didn't explain it (reversed on 2.8.3):** a 327-module JSR graph stayed flat (~+7 MB/reload)
while a 10-module npm graph ballooned (~+549 MB/reload).

**Per-`npm:` dependency, alone on a `jsr:@hono/hono` base (2.8.3):**

| npm dep | +MB/reload (2.8.3) |
|---|---:|
| `drizzle-orm` | **+462** |
| `@clerk/backend` | +62 |
| `hono` | +19 |
| `pino` | +4 |
| `postgres` (postgres.js) | +2 |

On a real app + DB (2.8.3), replacing Drizzle (via raw `jsr:@db/postgres`) and moving the rest to JSR took
`--watch` retention **+552 → +64 MB/reload** and warm RSS **496 → 152 MB**, at ~equal throughput.

**Localization (2.8.3):** `MALLOC_ARENA_MAX=2` unchanged (not glibc-arena); RSS climbed GBs past
`--max-old-space-size=256` (not V8 old-space → code-space/npm-compat native suspect); `gc()` per reload gave
no point-in-time drop (deferred reclamation). Reproduced in `denoland/deno:2.8.3` (Debian, stock glibc).
Fresh process per reload (external watcher / `deno compile`) stayed flat.

> **2.9 outcome of this control (done — see *The 2.9 isolation* above):** on 2.8.3 `npm:hono` (+19) ≫
> `jsr:@hono/hono` (+2); on **2.9 both plateau** (~225 vs ~201) — the `npm:hono` retention is fixed. The
> per-dep sweep no longer shows a broad npm penalty: `postgres.js` and `@db/postgres` plateau on a `jsr:@hono`
> base; only **`npm:@clerk/backend` on `jsr:@hono` ramps** (+51/reload → OOM), while the same Clerk on
> `npm:hono` plateaus. So it is **not** a loader-polarity flip — it's a heavy npm dep left un-reclaimed as an
> island in a JSR graph.

[#28107]: https://github.com/denoland/deno/issues/28107
[#35136]: https://github.com/denoland/deno/pull/35136
[#26052]: https://github.com/denoland/deno/issues/26052
[#35664]: https://github.com/denoland/deno/issues/35664

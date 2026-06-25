# `deno run --watch` retains far more RSS for `npm:` modules than for JSR across reloads (Deno 2.8.3) — follow-up to #28107

> **Follow-up to [#28107 "Memory leak with file watcher"] (closed).** #28107 reported `deno run
> --watch` retaining each run's memory until the watcher is killed (Deno **2.1.10**, a CLIP script
> using `@huggingface/transformers` — an **npm** package — ~600 MB/run, up to ~50 GB). It still
> reproduces on **2.8.3**, and a *same-library control* isolates the path: the **same library (Hono)
> retains ~+19 MB/reload via `npm:` but ~+2 MB/reload via `jsr:`**. Since #28107 is closed, this is
> probably best as a **new issue** linking #28107 as prior art — it's a regression only if #28107 was
> closed as fixed, which is worth confirming first.

## Summary

- **Same library, two resolution paths (the isolation).** `import { Hono }` from `npm:hono` retains
  ~**+19 MB/reload**; from `jsr:@hono/hono` ~**+2 MB/reload** (×2, stable). Identical library and code —
  only the `npm:`/Node-compat loader differs — so it is **not** the library, its byte size, or its
  module count. The retained RSS appears tied to the `npm:`/Node-compat module path.
- **Module count doesn't explain it either — it's reversed.** A **327-module** JSR graph stays flat
  (~+7 MB/reload) while a **10-module** npm graph balloons (~+549 MB/reload). (`deno info` counts each
  npm package as ~one module but loads its bundled code + `node:` compat surface.)
- A **fresh process per reload** (external watcher → `deno run`, or `deno compile`) stays **flat** — so
  it is `--watch` process reuse, not the app or workload.
- Reclamation is **deferred, not absent**: a point-in-time `gc()` of the live isolate doesn't drop it
  (it can't touch a *prior* run's retained isolate); over many reloads RSS reaches a ceiling.
- Not glibc-arena fragmentation; not V8 old-space (a 256 MB heap cap doesn't bound it → code-space /
  npm-compat native state is the suspect). Reproduces in the official `denoland/deno:2.8.3` image
  (Debian, stock glibc), so it isn't our distro.

We have **not** captured heap snapshots or read the runtime source, so we describe the *mechanism*
(npm-compat module/code-space not released on restart) as the suspect, while the **`npm:` >> `jsr:`
difference is directly measured**.

## Environment

| | |
|---|---|
| Deno | 2.8.3 (stable, x86_64-unknown-linux-gnu); reproduced in `denoland/deno:2.8.3` (Debian, glibc 2.41) |
| CPU / RAM | i7-12700H (20 cores) / 15 GiB |
| OS / kernel | Linux 7.0.12 |

## Finding 1 — same library, `npm:` vs `jsr:` resolution (isolates the compat path)

No load. Append a comment to the watched entry file to reload (each restart verified), read `VmRSS`;
divide the (last − first) delta by **5 reloads**:

| import | modules (`deno info`) | RSS over 5 reloads (MB) | per reload |
|---|---:|---|---:|
| `npm:hono` | 5 | 79 → 175 | **~+19 MB** |
| `jsr:@hono/hono` | 39 | 62 → 74 | **~+2 MB** |

Same Hono library, same app shape — only the resolver/compat path differs, and `jsr:@hono/hono`
actually has *more* modules. The `npm:` path retains ~10×.

## Finding 2 — module count doesn't explain it (the size confound is reversed)

A comparable Deno-native (JSR) server shape vs an `npm:` one (no load, restarts verified, ×3 stable;
per reload = delta ÷ 5):

| config | modules | RSS over 5 reloads (MB) | per reload |
|---|---:|---|---:|
| `npm:hono` | 5 | 79 → 175 | ~+19 |
| `npm:` hono + clerk + drizzle + postgres + pino + zod | 10 | 624 → 3,368 | **~+549** |
| `jsr:@oak/oak` | 146 | 77 → 104 | ~+5 |
| `+ jsr:@std/log` + `jsr:@db/postgres` | 198 | 83 → 113 | ~+6 |
| `+ 8 more jsr:@std/*` | **327** | 84 → 119 | **~+7** |

If graph size drove it, the 327-module graph would be worst; instead the 10-module npm graph is. Note
the JSR stack is a *comparable server shape*, not an equivalent of the npm stack (different libraries
and pg drivers) — the same-library control above is the clean isolation; this rules out size.

## Finding 3 — which `npm:` packages, and how much

Each `npm:` dependency **alone** on a `jsr:@hono/hono` base (no load) — the retention is dominated by a
few heavy packages, tracking how much code each pulls through node-compat:

| npm dep | +MB/reload |
|---|---:|
| `drizzle-orm` | **+462** |
| `@clerk/backend` | +62 |
| `hono` | +19 |
| `pino` | +4 |
| `postgres` (postgres.js) | +2 |

It is not "any `npm:` package" uniformly — `postgres.js` is essentially free, so it scales with the
package's node-compat module graph. On a real app + real DB (matched feed servers), replacing the worst
offender (Drizzle, via raw `jsr:@db/postgres`) and moving the rest to JSR took `--watch` retention from
**+552 to +64 MB/reload** (8.6×) and warm RSS **496 → 152 MB** (3.3×), at ~equal throughput.

## Control — a fresh process per reload is flat

External watcher → `deno run` holds ~631 MB flat; `deno compile` + binary ~221 MB flat. The app has
module-scope state (a `postgres` pool, per-boot signal listeners), but that can't explain the
npm-vs-jsr gap — the difference is the resolution path.

## Localization

| Probe | Effect | Reads as |
|---|---|---|
| `MALLOC_ARENA_MAX=2` | unchanged | not glibc-arena fragmentation |
| `--v8-flags=--max-old-space-size=256` | RSS climbs to GBs past the cap | not V8 old-space (→ code-space / npm-compat native suspect) |
| `--v8-flags=--expose-gc` + `gc()` per reload | no point-in-time drop | deferred reclamation (gc can't touch a prior run's isolate) |

## How severe / is it bounded?

Two operating points, and they differ by **environment**, not footprint:
- our full app **in a container** (Debian/stock glibc) **plateaued ~600 MB** over 80 reloads and
  oscillated — clearly reclaiming;
- the **6-npm-dep** server **on the host** climbed to **~3.9 GB in 6 reloads** (we stopped — approaching
  OOM) and we did not observe a plateau.

So the container reclaims aggressively (low ceiling) while the host kept climbing; the variable
separating them is the runtime/host reclamation behavior, not the per-run footprint. *Qualitatively*,
if the reclamation lag is roughly constant then a large per-run npm footprint (e.g. #28107's
transformers model) would explain reaching tens of GB — but we don't have the data to put a number on
that, so we offer it only as a hypothesis. (Under concurrent load the reload loop is also **CPU-bound**,
~6 of 20 cores, not memory-bound.)

## Reproduction

```bash
# the isolation: SAME library, two loaders (npm vs jsr) — expect ~+19 vs ~+2 MB/reload
deno run --watch a.ts   # import { Hono } from "npm:hono@^4.8.12"
deno run --watch b.ts   # import { Hono } from "jsr:@hono/hono@^4.8.12"
# trigger + sample (PID stable). NB: edit a file Deno is watching *in the repo*, not /tmp:
echo "// reload $(date +%s%N)" >> a.ts
awk '/VmRSS|VmHWM/{print}' /proc/<pid>/status
# fresh-process control stays flat (same flags incl. --env-file as the affected command):
watchexec -r -e ts -- deno run --allow-net --allow-env --allow-sys=hostname --env-file=../../.env.local src/main.ts
# localization: MALLOC_ARENA_MAX=2 / --v8-flags=--max-old-space-size=256 / --v8-flags=--expose-gc + gc-probe.ts
```

A one-command containerized repro (official `denoland/deno:2.8.3` image + bundled Postgres) and the
reduced server files are available on request.

## Why this hurts DX

We run a couple of automated agents that each spawn their own `deno run --watch` dev server; with our
`npm:` dependency set each retains hundreds of MB per save and climbs into the GBs over a session, so
two or three at once on a 16 GB laptop go into swap. Going full-JSR isn't an option (no JSR equivalent
for Clerk/Drizzle), so the practical workaround is an external watcher that kills + respawns.

## What would help

1. **Release the previous run's `npm:`/Node-compat modules on `--watch` restart** (or a flag to fork a
   fresh process per reload). The same-library control points straight at the `npm:` resolution/compat
   path's module lifetime in the watcher restart.
2. A way to **report** what a `--watch` process retains across reloads.
3. The close reason for #28107 — if it was closed as fixed, this is a regression.

## Artifacts available

- the same-library (`npm:hono` vs `jsr:@hono/hono`) control and the npm/JSR graph sweeps, with verified
  restart counts and raw `/proc/<pid>/status` samples;
- the fresh-process control, the localization probes, the load generator, and a one-command
  containerized repro (official `denoland/deno` image + bundled Postgres).

These commands reproduce the `npm:`-vs-`jsr:` difference **in our environments**; we can provide the
reduced, self-contained reproduction repo so maintainers can verify it directly.

[#28107 "Memory leak with file watcher"]: https://github.com/denoland/deno/issues/28107
